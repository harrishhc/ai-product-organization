import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXECUTION_CONTRACT_VERSION,
  EXECUTION_ERROR_CODES,
  EXECUTION_MODES,
  EXECUTION_STATUS,
  createExecutionRequest,
  createExecutionResult,
  assertExecutionRequest,
  assertExecutionResult,
} from "../runtime/executionContract.js";

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
