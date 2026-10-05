import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EXECUTION_CONTRACT_VERSION,
  EXECUTION_ERROR_CODES,
  EXECUTION_MODES,
  EXECUTION_STATUS,
  EXECUTION_TRANSITIONS,
  RESUMABLE_STATUSES,
  TERMINAL_STATUSES,
  createExecutionRequest,
  createExecutionResult,
  assertExecutionRequest,
  assertExecutionResult,
  assertExecutionHistory,
  assertExecutionTransition,
  assertRunHistory,
  assertResumeRequestFor,
  canTransition,
  isResumableStatus,
  isTerminalStatus,
} from "../runtime/executionContract.js";
import { WORK_STATUSES } from "../runtime/portfolio.js";

test("execution contract defines provider-neutral lifecycle states and modes", () => {
  assert.equal(EXECUTION_CONTRACT_VERSION, "1.0");
  assert.deepEqual(EXECUTION_STATUS, {
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    WAITING_FOR_FOUNDER: "WAITING_FOR_FOUNDER",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
    STOPPED: "STOPPED",
  });
  assert.deepEqual(EXECUTION_MODES, {
    AUTONOMOUS: "autonomous",
    INTERACTIVE: "interactive",
    RESUME: "resume",
  });
  assert.equal(EXECUTION_ERROR_CODES.TIMEOUT, "timeout");
  assert.equal(EXECUTION_ERROR_CODES.RESUME_UNAVAILABLE, "resume_unavailable");
});

test("execution request is a small provider-neutral envelope", () => {
  const request = createExecutionRequest({
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "colon-biopsy-ai-app",
    mode: EXECUTION_MODES.AUTONOMOUS,
  });
  assert.deepEqual(request, {
    contract_version: "1.0",
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "colon-biopsy-ai-app",
    mode: "autonomous",
    resume_handle: null,
  });
});

test("resume handle remains opaque and may be supplied only as a string", () => {
  const request = createExecutionRequest({
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "p1",
    mode: EXECUTION_MODES.RESUME,
    resume_handle: "provider-specific-checkpoint-token",
  });
  assert.equal(request.resume_handle, "provider-specific-checkpoint-token");
  assert.throws(
    () =>
      createExecutionRequest({
        run_id: "run-1",
        work_unit_id: "wu-1",
        product_id: "p1",
        mode: EXECUTION_MODES.RESUME,
        resume_handle: { node: 3 },
      }),
    /opaque string/
  );
});

test("execution result allows provider usage to be partially unavailable", () => {
  const result = createExecutionResult({
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "p1",
    status: EXECUTION_STATUS.PAUSED,
    resume_handle: "host-token",
    summary: "Paused after an interrupt.",
    usage: { tool_calls: 3 },
  });
  assert.deepEqual(result.usage, {
    input_tokens: null,
    output_tokens: null,
    tool_calls: 3,
    duration_ms: null,
  });
});

test("execution result validates errors without prescribing provider internals", () => {
  const result = createExecutionResult({
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "p1",
    status: EXECUTION_STATUS.FAILED,
    error: { code: EXECUTION_ERROR_CODES.TIMEOUT, message: "Provider timed out." },
  });
  assert.equal(result.error.code, "timeout");
  assert.throws(
    () =>
      createExecutionResult({
        run_id: "run-1",
        work_unit_id: "wu-1",
        product_id: "p1",
        status: EXECUTION_STATUS.FAILED,
        error: { code: "provider_specific_internal_enum", message: "x" },
      }),
    /invalid error code/
  );
});

test("assert helpers reject incompatible or tampered envelopes", () => {
  const request = createExecutionRequest({
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "p1",
    mode: EXECUTION_MODES.INTERACTIVE,
  });
  assert.deepEqual(assertExecutionRequest(request), request);
  assert.throws(
    () => assertExecutionRequest({ ...request, contract_version: "9.0" }),
    /unsupported contract_version/
  );

  const result = createExecutionResult({
    run_id: "run-1",
    work_unit_id: "wu-1",
    product_id: "p1",
    status: EXECUTION_STATUS.COMPLETED,
  });
  assert.deepEqual(assertExecutionResult(result), result);
  assert.throws(
    () => assertExecutionResult({ ...result, status: "NOT_A_STATUS" }),
    /invalid status/
  );
});

test("envelopes that contradict the lifecycle are rejected, not just malformed ones", () => {
  const id = { run_id: "run-1", work_unit_id: "wu-1", product_id: "p1" };
  const err = { code: EXECUTION_ERROR_CODES.TOOL, message: "tool failed" };

  assert.throws(() => createExecutionRequest({ ...id, mode: EXECUTION_MODES.RESUME }), /requires a non-empty resume_handle/);
  assert.throws(
    () => createExecutionRequest({ ...id, mode: EXECUTION_MODES.RESUME, resume_handle: "" }),
    /requires a non-empty resume_handle/
  );

  for (const status of [EXECUTION_STATUS.PAUSED, EXECUTION_STATUS.WAITING_FOR_FOUNDER]) {
    assert.throws(() => createExecutionResult({ ...id, status }), /requires a non-empty resume_handle/);
    assert.equal(createExecutionResult({ ...id, status, resume_handle: "h" }).resume_handle, "h");
  }

  assert.throws(() => createExecutionResult({ ...id, status: EXECUTION_STATUS.FAILED }), /FAILED requires an error/);
  assert.equal(createExecutionResult({ ...id, status: EXECUTION_STATUS.FAILED, error: err }).error.code, "tool");
  assert.throws(
    () => createExecutionResult({ ...id, status: EXECUTION_STATUS.COMPLETED, error: err }),
    /COMPLETED must not carry an error/
  );
});

const ID = { run_id: "run-1", work_unit_id: "wu-1", product_id: "p1" };
const ERR = { code: EXECUTION_ERROR_CODES.TOOL, message: "tool failed" };

function result(status, extra = {}) {
  const needsHandle = RESUMABLE_STATUSES.includes(status);
  return createExecutionResult({
    ...ID,
    status,
    resume_handle: needsHandle ? "h1" : null,
    error: status === EXECUTION_STATUS.FAILED ? ERR : null,
    ...extra,
  });
}

test("transition table is exactly the documented matrix", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(EXECUTION_TRANSITIONS).map(([from, to]) => [from, [...to]])),
    {
      RUNNING: ["RUNNING", "PAUSED", "WAITING_FOR_FOUNDER", "COMPLETED", "FAILED", "STOPPED"],
      PAUSED: ["RUNNING", "STOPPED", "FAILED"],
      WAITING_FOR_FOUNDER: ["RUNNING", "STOPPED", "FAILED"],
      COMPLETED: [],
      FAILED: [],
      STOPPED: [],
    }
  );
  assert.deepEqual(Object.keys(EXECUTION_TRANSITIONS).sort(), Object.values(EXECUTION_STATUS).sort());
});

test("terminal states have no exits; resumable states are exactly those that can return to RUNNING", () => {
  assert.deepEqual([...TERMINAL_STATUSES].sort(), ["COMPLETED", "FAILED", "STOPPED"]);
  for (const from of TERMINAL_STATUSES) {
    for (const to of Object.values(EXECUTION_STATUS)) {
      assert.equal(canTransition(from, to), false, from + " -> " + to);
      assert.throws(() => assertExecutionTransition(from, to), /terminal/);
    }
  }
  for (const status of Object.values(EXECUTION_STATUS)) {
    const canReturnToRunning = status !== EXECUTION_STATUS.RUNNING && canTransition(status, EXECUTION_STATUS.RUNNING);
    assert.equal(isResumableStatus(status), canReturnToRunning, status);
    assert.equal(isTerminalStatus(status), EXECUTION_TRANSITIONS[status].length === 0, status);
  }
});

test("only RUNNING may repeat itself; a suspended unit never jumps to COMPLETED or another suspension", () => {
  for (const status of Object.values(EXECUTION_STATUS)) {
    assert.equal(canTransition(status, status), status === EXECUTION_STATUS.RUNNING, status);
  }
  for (const from of RESUMABLE_STATUSES) {
    assert.equal(canTransition(from, EXECUTION_STATUS.COMPLETED), false);
    assert.equal(canTransition(from, EXECUTION_STATUS.PAUSED), false);
    assert.equal(canTransition(from, EXECUTION_STATUS.WAITING_FOR_FOUNDER), false);
  }
  assert.throws(() => assertExecutionTransition("RUNNING", "NOT_A_STATUS"), /unknown status/);
});

test("execution states are not portfolio states, apart from the shared WAITING_FOR_FOUNDER name", () => {
  const shared = Object.values(EXECUTION_STATUS).filter((status) => WORK_STATUSES.includes(status));
  assert.deepEqual(shared, ["WAITING_FOR_FOUNDER"]);
  for (const portfolioOnly of WORK_STATUSES.filter((status) => status !== "WAITING_FOR_FOUNDER")) {
    assert.throws(() => assertExecutionTransition("RUNNING", portfolioOnly), /unknown status/);
  }
});

test("a work-unit history must follow the lifecycle and nothing may follow a terminal status", () => {
  assert.equal(assertExecutionHistory([result("COMPLETED")]).length, 1);
  assert.equal(
    assertExecutionHistory([result("RUNNING"), result("PAUSED"), result("RUNNING"), result("COMPLETED")]).length,
    4
  );
  assert.throws(() => assertExecutionHistory([]), /non-empty array/);
  assert.throws(() => assertExecutionHistory([result("COMPLETED"), result("RUNNING")]), /COMPLETED is terminal/);
  assert.throws(() => assertExecutionHistory([result("STOPPED"), result("STOPPED")]), /STOPPED is terminal/);
  assert.throws(() => assertExecutionHistory([result("PAUSED"), result("COMPLETED")]), /illegal transition PAUSED -> COMPLETED/);
});

test("FAILED is terminal: retrying is a new work unit, never a second outcome for the same one", () => {
  const failed = result("FAILED");
  assert.throws(() => assertExecutionHistory([failed, result("RUNNING")]), /FAILED is terminal.*new work unit/);
  assert.throws(() => assertExecutionHistory([failed, result("COMPLETED")]), /FAILED is terminal/);

  const retry = { ...ID, work_unit_id: "wu-2" };
  const retried = [createExecutionResult({ ...retry, status: "RUNNING" }), createExecutionResult({ ...retry, status: "COMPLETED" })];
  assert.equal(assertExecutionHistory([failed]).length, 1);
  assert.equal(assertExecutionHistory(retried).length, 2);
});

test("a history is one work unit of one run on one product", () => {
  assert.throws(
    () => assertExecutionHistory([result("RUNNING"), createExecutionResult({ ...ID, work_unit_id: "wu-2", status: "COMPLETED" })]),
    /exactly one work unit/
  );
  assert.throws(
    () => assertExecutionHistory([result("RUNNING"), createExecutionResult({ ...ID, run_id: "run-2", status: "COMPLETED" })]),
    /exactly one work unit/
  );
  assert.throws(
    () => assertExecutionHistory([result("RUNNING"), createExecutionResult({ ...ID, product_id: "p2", status: "COMPLETED" })]),
    /product_id changed/
  );
});

test("resume applies only to a suspended work unit, with the handle that suspension issued", () => {
  for (const status of RESUMABLE_STATUSES) {
    const suspended = result(status);
    const request = createExecutionRequest({ ...ID, mode: EXECUTION_MODES.RESUME, resume_handle: "h1" });
    assert.deepEqual(assertResumeRequestFor([suspended], request), request);
    assert.throws(
      () => assertResumeRequestFor([suspended], { ...request, resume_handle: "stale-or-foreign" }),
      /not the one issued/
    );
    for (const mismatch of [{ run_id: "run-2" }, { work_unit_id: "wu-2" }, { product_id: "p2" }]) {
      assert.throws(() => assertResumeRequestFor([suspended], { ...request, ...mismatch }), /does not match the suspended/);
    }
  }

  const resume = createExecutionRequest({ ...ID, mode: EXECUTION_MODES.RESUME, resume_handle: "h1" });
  for (const status of [...TERMINAL_STATUSES, EXECUTION_STATUS.RUNNING]) {
    assert.throws(() => assertResumeRequestFor([result(status)], resume), /cannot resume a work unit in status/);
  }
  assert.throws(
    () => assertResumeRequestFor([result("PAUSED")], createExecutionRequest({ ...ID, mode: EXECUTION_MODES.AUTONOMOUS })),
    /not a resume request/
  );
});

test("a resume handle exists only while its work unit is suspended and is single-use", () => {
  for (const status of [EXECUTION_STATUS.RUNNING, ...TERMINAL_STATUSES]) {
    const extra = status === EXECUTION_STATUS.FAILED ? { error: ERR } : {};
    assert.throws(
      () => createExecutionResult({ ...ID, status, resume_handle: "h1", ...extra }),
      /must not carry a resume_handle/
    );
  }
  for (const mode of [EXECUTION_MODES.AUTONOMOUS, EXECUTION_MODES.INTERACTIVE]) {
    assert.throws(() => createExecutionRequest({ ...ID, mode, resume_handle: "h1" }), /only mode "resume" may carry/);
  }

  // After the resume the unit is RUNNING again, so the spent handle matches nothing.
  const spent = createExecutionRequest({ ...ID, mode: EXECUTION_MODES.RESUME, resume_handle: "h1" });
  assert.throws(() => assertResumeRequestFor([result("PAUSED"), result("RUNNING")], spent), /cannot resume a work unit in status RUNNING/);

  // A stale suspension cannot stand in for the latest one: the unit was
  // resumed and suspended again, so only the second handle is live.
  const second = (status) => createExecutionResult({ ...ID, status, resume_handle: "h2" });
  const history = [result("PAUSED"), result("RUNNING"), second("WAITING_FOR_FOUNDER")];
  assert.throws(() => assertResumeRequestFor(history, spent), /not the one issued/);
  const live = createExecutionRequest({ ...ID, mode: EXECUTION_MODES.RESUME, resume_handle: "h2" });
  assert.deepEqual(assertResumeRequestFor(history, live), live);

  // The history itself must be a legal one: a suspension reported after a
  // terminal status, or a handle issued twice, is not a unit that can resume.
  const afterTerminal = [result("COMPLETED"), result("PAUSED")];
  assert.throws(() => assertResumeRequestFor(afterTerminal, spent), /terminal|cannot move/i);
  const reusedHandle = [result("PAUSED"), result("RUNNING"), result("PAUSED")];
  assert.throws(() => assertResumeRequestFor(reusedHandle, spent), /reused/);
});

test("a Founder decision that changes the plan ends the suspended unit; a rejected handle fails it", () => {
  const waiting = result("WAITING_FOR_FOUNDER");
  const abandoned = createExecutionResult({ ...ID, status: "STOPPED", summary: "Decision changed the plan." });
  assert.equal(assertExecutionHistory([waiting, abandoned]).length, 2);
  assert.throws(() => assertExecutionHistory([waiting, abandoned, result("RUNNING")]), /STOPPED is terminal/);

  const lost = createExecutionResult({
    ...ID,
    status: "FAILED",
    error: { code: EXECUTION_ERROR_CODES.RESUME_UNAVAILABLE, message: "Host no longer holds this checkpoint." },
  });
  assert.equal(assertExecutionHistory([result("PAUSED"), lost]).length, 2);
});

test("a run spans many work units: one suspended on a Founder boundary does not stop the next", () => {
  const report = (work_unit_id, product_id, status) =>
    createExecutionResult({
      run_id: "run-1",
      work_unit_id,
      product_id,
      status,
      resume_handle: RESUMABLE_STATUSES.includes(status) ? work_unit_id + "-h" : null,
    });

  // Reports in the order they happen: A suspends on HH, B and C run to completion, A is resumed.
  const run = [
    report("wu-A", "product-a", "WAITING_FOR_FOUNDER"),
    report("wu-B", "product-b", "RUNNING"),
    report("wu-B", "product-b", "COMPLETED"),
    report("wu-C", "product-c", "COMPLETED"),
    report("wu-A", "product-a", "RUNNING"),
    report("wu-A", "product-a", "COMPLETED"),
  ];
  assert.equal(assertRunHistory(run).length, 6);

  assert.throws(
    () => assertRunHistory([...run, createExecutionResult({ ...ID, run_id: "run-2", status: "COMPLETED" })]),
    /exactly one run/
  );
  assert.throws(() => assertRunHistory([]), /non-empty array/);
});

test("a terminal work_unit_id cannot be reused for a retry anywhere in the run", () => {
  const unit = (work_unit_id, status) =>
    createExecutionResult({ ...ID, work_unit_id, status, error: status === "FAILED" ? ERR : null });

  const retriedAsNewUnit = [unit("wu-1", "FAILED"), unit("wu-2", "RUNNING"), unit("wu-2", "COMPLETED")];
  assert.equal(assertRunHistory(retriedAsNewUnit).length, 3);

  const retriedUnderSameId = [unit("wu-1", "FAILED"), unit("wu-2", "COMPLETED"), unit("wu-1", "RUNNING"), unit("wu-1", "COMPLETED")];
  assert.throws(() => assertRunHistory(retriedUnderSameId), /FAILED is terminal.*new work unit/);
});

test("every suspension issues a new handle, and a handle belongs to one work unit", () => {
  const suspended = (work_unit_id, status, handle) =>
    createExecutionResult({ ...ID, work_unit_id, status, resume_handle: handle });

  assert.throws(
    () => assertExecutionHistory([suspended("wu-1", "PAUSED", "h1"), suspended("wu-1", "RUNNING", null), suspended("wu-1", "PAUSED", "h1")]),
    /resume_handle reused/
  );
  assert.equal(
    assertExecutionHistory([suspended("wu-1", "PAUSED", "h1"), suspended("wu-1", "RUNNING", null), suspended("wu-1", "PAUSED", "h2")]).length,
    3
  );
  assert.throws(
    () => assertRunHistory([suspended("wu-1", "PAUSED", "h1"), suspended("wu-2", "WAITING_FOR_FOUNDER", "h1")]),
    /shared between work units/
  );
});

test("resume_unavailable only ends a suspended work unit", () => {
  const unavailable = createExecutionResult({
    ...ID,
    status: "FAILED",
    error: { code: EXECUTION_ERROR_CODES.RESUME_UNAVAILABLE, message: "Host no longer holds this checkpoint." },
  });
  for (const status of RESUMABLE_STATUSES) {
    assert.equal(assertExecutionHistory([result(status), unavailable]).length, 2);
  }
  assert.throws(() => assertExecutionHistory([unavailable]), /resume_unavailable can only end a suspended work unit/);
  assert.throws(() => assertExecutionHistory([result("RUNNING"), unavailable]), /resume_unavailable can only end a suspended/);

  // It is the only way a suspended unit fails, and it is only ever a FAILED.
  for (const status of RESUMABLE_STATUSES) {
    for (const code of Object.values(EXECUTION_ERROR_CODES).filter((c) => c !== EXECUTION_ERROR_CODES.RESUME_UNAVAILABLE)) {
      const failed = createExecutionResult({ ...ID, status: "FAILED", error: { code, message: "m" } });
      assert.throws(() => assertExecutionHistory([result(status), failed]), /a suspended work unit can only fail as resume_unavailable/);
    }
  }
});

test("only a FAILED result carries an error", () => {
  const handle = (status) => (RESUMABLE_STATUSES.includes(status) ? { resume_handle: "h1" } : {});
  for (const status of Object.values(EXECUTION_STATUS).filter((s) => s !== EXECUTION_STATUS.FAILED)) {
    assert.throws(
      () => createExecutionResult({ ...ID, status, ...handle(status), error: ERR }),
      new RegExp("status " + status + " must not carry an error; only FAILED does")
    );
  }
  // A history cannot smuggle a failure into a non-FAILED report either.
  assert.throws(
    () => assertExecutionHistory([result("RUNNING"), { ...result("STOPPED"), error: ERR }]),
    /must not carry an error/
  );
});

test("honouring a resume is reported as RUNNING before anything else; a suspended unit never completes directly", () => {
  assert.equal(assertExecutionHistory([result("PAUSED"), result("RUNNING"), result("COMPLETED")]).length, 3);
  assert.equal(assertExecutionHistory([result("WAITING_FOR_FOUNDER"), result("RUNNING"), result("COMPLETED")]).length, 3);
  assert.throws(() => assertExecutionHistory([result("PAUSED"), result("COMPLETED")]), /illegal transition PAUSED -> COMPLETED/);
});

test("envelopes carry no payload: unknown fields are rejected, not silently dropped", () => {
  const request = createExecutionRequest({ ...ID, mode: EXECUTION_MODES.AUTONOMOUS });
  assert.throws(() => assertExecutionRequest({ ...request, objective: "do X" }), /unexpected request field "objective"/);
  const completed = result("COMPLETED");
  assert.throws(() => assertExecutionResult({ ...completed, decisions: [{ id: "d1" }] }), /unexpected result field "decisions"/);
});

test("nested envelope objects carry no payload either, and a validated result is not aliased to its input", () => {
  const failed = result("FAILED");
  assert.throws(
    () => assertExecutionResult({ ...failed, error: { ...ERR, objective: "do X" } }),
    /unexpected error field "objective"/
  );
  assert.throws(
    () => assertExecutionResult({ ...failed, usage: { tool_calls: 1, objective: "do X" } }),
    /unexpected usage field "objective"/
  );

  const input = { ...ERR };
  const validated = assertExecutionResult({ ...failed, error: input });
  input.message = "changed after validation";
  assert.equal(validated.error.message, ERR.message);
});

test("constructors reject unknown fields and non-objects with a contract error, not a TypeError", () => {
  assert.throws(() => createExecutionRequest({ ...ID, mode: EXECUTION_MODES.AUTONOMOUS, objective: "do X" }), /unexpected request field "objective"/);
  assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", payload: {} }), /unexpected result field "payload"/);
  for (const bad of [null, "text", 7, []]) {
    assert.throws(() => createExecutionRequest(bad), /Execution contract: request must be an object/);
    assert.throws(() => createExecutionResult(bad), /Execution contract: result must be an object/);
  }
});

test("a blank resume_handle is no handle", () => {
  assert.throws(() => createExecutionRequest({ ...ID, mode: EXECUTION_MODES.RESUME, resume_handle: "   " }), /requires a non-empty resume_handle/);
  assert.throws(() => createExecutionResult({ ...ID, status: "PAUSED", resume_handle: "   " }), /requires a non-empty resume_handle/);
});

test("scalar envelope fields are type-checked", () => {
  assert.throws(() => createExecutionRequest({ ...ID, mode: "background" }), /invalid mode/);
  assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", summary: 42 }), /summary must be a string/);
  for (const field of ["input_tokens", "output_tokens", "tool_calls", "duration_ms"]) {
    assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", usage: { [field]: -1 } }), /non-negative/);
  }
  for (const field of ["input_tokens", "output_tokens", "tool_calls"]) {
    assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", usage: { [field]: 1.5 } }), /non-negative integer/);
  }
  assert.equal(createExecutionResult({ ...ID, status: "RUNNING", usage: { duration_ms: 12.5 } }).usage.duration_ms, 12.5);
});

test("a constructor does not launder a wrong contract_version", () => {
  for (const contract_version of ["9.0", null, 1]) {
    assert.throws(() => createExecutionRequest({ ...ID, mode: EXECUTION_MODES.AUTONOMOUS, contract_version }), /unsupported contract_version/);
    assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", contract_version }), /unsupported contract_version/);
    assert.throws(() => assertExecutionResult({ ...result("RUNNING"), contract_version }), /unsupported contract_version/);
  }
  assert.equal(createExecutionRequest({ ...ID, mode: EXECUTION_MODES.AUTONOMOUS, contract_version: "1.0" }).contract_version, "1.0");
  assert.throws(() => assertExecutionResult({ ...ID, status: "RUNNING" }), /unsupported contract_version "missing"/);
  assert.throws(() => assertExecutionRequest({ ...ID, mode: EXECUTION_MODES.AUTONOMOUS }), /unsupported contract_version "missing"/);
  assert.throws(() => assertExecutionRequest(null), /unsupported contract_version "missing"/);
});

test("identity, error message, usage and error shapes are validated", () => {
  for (const field of Object.keys(ID)) {
    for (const bad of ["", "   ", null, 7]) {
      assert.throws(() => createExecutionRequest({ ...ID, [field]: bad, mode: EXECUTION_MODES.AUTONOMOUS }), new RegExp(field + " must be a non-empty string"));
      assert.throws(() => createExecutionResult({ ...ID, [field]: bad, status: "RUNNING" }), new RegExp(field + " must be a non-empty string"));
    }
  }
  assert.throws(() => createExecutionResult({ ...ID, status: "FAILED", error: { code: "tool", message: "" } }), /error.message must be a non-empty string/);
  assert.throws(() => createExecutionResult({ ...ID, status: "FAILED", error: { code: "oops", message: "m" } }), /invalid error code/);
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", usage: { duration_ms: bad } }), /usage.duration_ms must be null or a non-negative finite number/);
  }
  for (const bad of [5, "x", []]) {
    assert.throws(() => createExecutionResult({ ...ID, status: "RUNNING", usage: bad }), /usage must be an object/);
    assert.throws(() => createExecutionResult({ ...ID, status: "FAILED", error: bad }), /error must be an object/);
  }
});

// The tables in docs/EXECUTION_CONTRACT.md are the contract's human-readable
// form; this keeps them from drifting away from the constants that enforce them.
test("the contract document's tables match the validator's constants", () => {
  const doc = readFileSync(new URL("../docs/EXECUTION_CONTRACT.md", import.meta.url), "utf8").split("\n");
  const statuses = Object.values(EXECUTION_STATUS);

  const matrixRows = doc.filter((line) => /^\| \*\*[A-Z_]+\*\* \|/.test(line));
  assert.equal(matrixRows.length, statuses.length);
  for (const row of matrixRows) {
    const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
    const from = cells[0].replaceAll("*", "");
    assert.ok(statuses.includes(from), "unknown status in the matrix: " + from);
    statuses.forEach((to, i) => {
      assert.equal(canTransition(from, to), cells[i + 1].startsWith("yes"), from + " -> " + to + " differs between the document and the validator");
    });
  }

  const stateRows = doc.filter((line) => /^\| [A-Z_]+ \| (yes|no) \|/.test(line));
  assert.equal(stateRows.length, statuses.length);
  for (const row of stateRows) {
    const [status, terminal, resumable] = row.split("|").slice(1, -1).map((cell) => cell.trim());
    assert.equal(isTerminalStatus(status), terminal === "yes", status + " terminal flag");
    assert.equal(isResumableStatus(status), resumable.startsWith("yes"), status + " resumable flag");
  }

  const envelope = doc.slice(doc.findIndex((line) => line.startsWith("## 11. Result envelope")));
  const block = envelope.slice(0, envelope.findIndex((line) => line.startsWith("`summary` is an execution summary"))).join("\n");
  for (const code of Object.values(EXECUTION_ERROR_CODES)) {
    assert.ok(block.includes('"' + code + '"'), "error code missing from the §11 envelope: " + code);
  }
  for (const status of statuses) {
    assert.ok(block.includes('"' + status + '"'), "status missing from the §11 envelope: " + status);
  }
});
