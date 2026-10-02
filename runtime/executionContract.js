// Provider-neutral contract for the PDM Execution Host boundary.
//
// This module is intentionally small. It defines lifecycle vocabulary and
// validates transport envelopes; it does not call a model, perform I/O, or
// choose a provider. PDM judgment remains in runtime/orchestrator.js and
// governance/. Provider-specific execution belongs behind an adapter.
//
// Semantic durable state remains in Git-backed Product Context / Work State /
// decision records. Host execution state (pause position, retries, provider
// handles) is opaque and is not a second PDM memory system.
//
// Model (see docs/EXECUTION_CONTRACT.md section 4): a run contains many work
// units; every envelope and every status here describes ONE work-unit
// execution. A work_unit_id reaches exactly one terminal status. Retrying
// failed work is a new work unit; resume applies only to a suspended one.

export const EXECUTION_CONTRACT_VERSION = "1.0";

export const EXECUTION_STATUS = Object.freeze({
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  WAITING_FOR_FOUNDER: "WAITING_FOR_FOUNDER",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  STOPPED: "STOPPED",
});

export const EXECUTION_MODES = Object.freeze({
  AUTONOMOUS: "autonomous",
  INTERACTIVE: "interactive",
  RESUME: "resume",
});

export const EXECUTION_ERROR_CODES = Object.freeze({
  PROVIDER: "provider",
  TOOL: "tool",
  TIMEOUT: "timeout",
  INTERRUPT: "interrupt",
  CONFIGURATION: "configuration",
  RESUME_UNAVAILABLE: "resume_unavailable",
  UNKNOWN: "unknown",
});

// Transitions of ONE work-unit execution. beginWorkUnit puts the unit in
// RUNNING, so RUNNING is the implicit state before its first reported status.
// RUNNING -> RUNNING is a progress report.
export const EXECUTION_TRANSITIONS = Object.freeze({
  RUNNING: Object.freeze(["RUNNING", "PAUSED", "WAITING_FOR_FOUNDER", "COMPLETED", "FAILED", "STOPPED"]),
  PAUSED: Object.freeze(["RUNNING", "STOPPED", "FAILED"]),
  WAITING_FOR_FOUNDER: Object.freeze(["RUNNING", "STOPPED", "FAILED"]),
  COMPLETED: Object.freeze([]),
  FAILED: Object.freeze([]),
  STOPPED: Object.freeze([]),
});

export const TERMINAL_STATUSES = Object.freeze(["COMPLETED", "FAILED", "STOPPED"]);
export const RESUMABLE_STATUSES = Object.freeze(["PAUSED", "WAITING_FOR_FOUNDER"]);

const STATUSES = new Set(Object.values(EXECUTION_STATUS));
const MODES = new Set(Object.values(EXECUTION_MODES));
const ERROR_CODES = new Set(Object.values(EXECUTION_ERROR_CODES));

const REQUEST_FIELDS = new Set(["contract_version", "run_id", "work_unit_id", "product_id", "mode", "resume_handle"]);
const RESULT_FIELDS = new Set([
  "contract_version", "run_id", "work_unit_id", "product_id", "status", "resume_handle", "summary", "usage", "error",
]);

function assertKnownFields(value, allowed, kind) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error("Execution contract: unexpected " + kind + " field " + JSON.stringify(key) + "; the envelope carries no payload.");
    }
  }
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Execution contract: " + field + " must be a non-empty string.");
  }
}

function assertRunIdentity(value) {
  assertNonEmptyString(value?.run_id, "run_id");
  assertNonEmptyString(value?.work_unit_id, "work_unit_id");
  assertNonEmptyString(value?.product_id, "product_id");
}

export function createExecutionRequest({
  run_id,
  work_unit_id,
  product_id,
  mode,
  resume_handle = null,
} = {}) {
  assertNonEmptyString(run_id, "run_id");
  assertNonEmptyString(work_unit_id, "work_unit_id");
  assertNonEmptyString(product_id, "product_id");
  if (!MODES.has(mode)) {
    throw new Error("Execution contract: invalid mode " + JSON.stringify(mode) + ".");
  }
  if (resume_handle !== null && typeof resume_handle !== "string") {
    throw new Error("Execution contract: resume_handle must be null or an opaque string.");
  }
  if (mode === EXECUTION_MODES.RESUME && (resume_handle === null || resume_handle === "")) {
    throw new Error("Execution contract: mode \"resume\" requires a non-empty resume_handle.");
  }
  if (mode !== EXECUTION_MODES.RESUME && resume_handle !== null) {
    throw new Error("Execution contract: only mode \"resume\" may carry a resume_handle; a handle belongs to one suspended work unit.");
  }
  return {
    contract_version: EXECUTION_CONTRACT_VERSION,
    run_id,
    work_unit_id,
    product_id,
    mode,
    resume_handle,
  };
}

export function createExecutionResult({
  run_id,
  work_unit_id,
  product_id,
  status,
  resume_handle = null,
  summary = "",
  usage = {},
  error = null,
} = {}) {
  const identity = { run_id, work_unit_id, product_id };
  assertRunIdentity(identity);
  if (!STATUSES.has(status)) {
    throw new Error("Execution contract: invalid status " + JSON.stringify(status) + ".");
  }
  if (resume_handle !== null && typeof resume_handle !== "string") {
    throw new Error("Execution contract: resume_handle must be null or an opaque string.");
  }
  if (typeof summary !== "string") {
    throw new Error("Execution contract: summary must be a string.");
  }
  if (usage === null || typeof usage !== "object" || Array.isArray(usage)) {
    throw new Error("Execution contract: usage must be an object.");
  }

  const normalizedUsage = {
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
    tool_calls: usage.tool_calls ?? null,
    duration_ms: usage.duration_ms ?? null,
  };

  for (const [field, value] of Object.entries(normalizedUsage)) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new Error("Execution contract: usage." + field + " must be null or a non-negative finite number.");
    }
  }

  if (error !== null) {
    if (typeof error !== "object" || Array.isArray(error)) {
      throw new Error("Execution contract: error must be null or an object.");
    }
    if (!ERROR_CODES.has(error.code)) {
      throw new Error("Execution contract: invalid error code " + JSON.stringify(error.code) + ".");
    }
    assertNonEmptyString(error.message, "error.message");
  }

  const resumable = RESUMABLE_STATUSES.includes(status);
  if (resumable && (resume_handle === null || resume_handle === "")) {
    throw new Error("Execution contract: status " + status + " requires a non-empty resume_handle.");
  }
  if (!resumable && resume_handle !== null) {
    throw new Error("Execution contract: status " + status + " must not carry a resume_handle; a handle exists only while the work unit is suspended.");
  }
  if (status === EXECUTION_STATUS.FAILED && error === null) {
    throw new Error("Execution contract: status FAILED requires an error.");
  }
  if (status === EXECUTION_STATUS.COMPLETED && error !== null) {
    throw new Error("Execution contract: status COMPLETED must not carry an error.");
  }

  return {
    contract_version: EXECUTION_CONTRACT_VERSION,
    run_id,
    work_unit_id,
    product_id,
    status,
    resume_handle,
    summary,
    usage: normalizedUsage,
    error,
  };
}

export function assertExecutionRequest(value) {
  if (!value || value.contract_version !== EXECUTION_CONTRACT_VERSION) {
    throw new Error(
      "Execution contract: unsupported contract_version " +
      JSON.stringify(value?.contract_version ?? "missing") +
      "."
    );
  }
  assertKnownFields(value, REQUEST_FIELDS, "request");
  return createExecutionRequest(value);
}

export function assertExecutionResult(value) {
  if (!value || value.contract_version !== EXECUTION_CONTRACT_VERSION) {
    throw new Error(
      "Execution contract: unsupported contract_version " +
      JSON.stringify(value?.contract_version ?? "missing") +
      "."
    );
  }
  assertKnownFields(value, RESULT_FIELDS, "result");
  return createExecutionResult(value);
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

export function isResumableStatus(status) {
  return RESUMABLE_STATUSES.includes(status);
}

export function canTransition(from, to) {
  return Object.hasOwn(EXECUTION_TRANSITIONS, from) && EXECUTION_TRANSITIONS[from].includes(to);
}

export function assertExecutionTransition(from, to) {
  if (!STATUSES.has(from) || !STATUSES.has(to)) {
    throw new Error("Execution contract: unknown status in transition " + JSON.stringify(from) + " -> " + JSON.stringify(to) + ".");
  }
  if (isTerminalStatus(from)) {
    throw new Error("Execution contract: " + from + " is terminal; a work unit cannot move to " + to + ". Retry is a new work unit.");
  }
  if (!canTransition(from, to)) {
    throw new Error("Execution contract: illegal transition " + from + " -> " + to + ".");
  }
}

// Checks the ordered results reported for ONE work unit: identity never
// changes, every step is a legal transition, and nothing follows a terminal
// status.
export function assertExecutionHistory(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Execution contract: a work-unit history must be a non-empty array of results.");
  }
  const checked = results.map(assertExecutionResult);
  const { run_id, work_unit_id, product_id } = checked[0];
  let previous = EXECUTION_STATUS.RUNNING;
  const handles = new Set();
  for (const result of checked) {
    if (result.run_id !== run_id || result.work_unit_id !== work_unit_id) {
      throw new Error("Execution contract: a history describes exactly one work unit of one run.");
    }
    if (result.product_id !== product_id) {
      throw new Error("Execution contract: product_id changed within work unit " + work_unit_id + ".");
    }
    assertExecutionTransition(previous, result.status);
    if (result.error?.code === EXECUTION_ERROR_CODES.RESUME_UNAVAILABLE && !isResumableStatus(previous)) {
      throw new Error("Execution contract: resume_unavailable can only end a suspended work unit, not one in " + previous + ".");
    }
    if (result.resume_handle !== null) {
      if (handles.has(result.resume_handle)) {
        throw new Error("Execution contract: resume_handle reused; every suspension issues a new handle.");
      }
      handles.add(result.resume_handle);
    }
    previous = result.status;
  }
  return checked;
}

// Checks the ordered results of one run, possibly interleaving many work
// units: one run_id, each unit a valid history of its own (so a terminal
// work_unit_id can never be reused for a retry), and no handle shared between
// units.
export function assertRunHistory(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Execution contract: a run history must be a non-empty array of results.");
  }
  const checked = results.map(assertExecutionResult);
  if (new Set(checked.map((result) => result.run_id)).size !== 1) {
    throw new Error("Execution contract: a run history describes exactly one run.");
  }
  const units = new Map();
  for (const result of checked) {
    if (!units.has(result.work_unit_id)) units.set(result.work_unit_id, []);
    units.get(result.work_unit_id).push(result);
  }
  const handles = new Set();
  for (const history of units.values()) {
    assertExecutionHistory(history);
    for (const { resume_handle } of history) {
      if (resume_handle === null) continue;
      if (handles.has(resume_handle)) {
        throw new Error("Execution contract: resume_handle shared between work units; a handle belongs to one suspended unit.");
      }
      handles.add(resume_handle);
    }
  }
  return checked;
}

// A resume request is valid only against the latest result of a suspended
// work unit, carrying exactly the handle that result issued.
export function assertResumeRequestFor(latestResult, request) {
  const result = assertExecutionResult(latestResult);
  const req = assertExecutionRequest(request);
  if (req.mode !== EXECUTION_MODES.RESUME) {
    throw new Error("Execution contract: not a resume request.");
  }
  if (
    req.run_id !== result.run_id ||
    req.work_unit_id !== result.work_unit_id ||
    req.product_id !== result.product_id
  ) {
    throw new Error("Execution contract: resume request does not match the suspended work unit.");
  }
  if (!isResumableStatus(result.status)) {
    throw new Error("Execution contract: cannot resume a work unit in status " + result.status + ".");
  }
  if (req.resume_handle !== result.resume_handle) {
    throw new Error("Execution contract: resume_handle is not the one issued with the latest result.");
  }
  return req;
}
