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
  UNKNOWN: "unknown",
});

const STATUSES = new Set(Object.values(EXECUTION_STATUS));
const MODES = new Set(Object.values(EXECUTION_MODES));
const ERROR_CODES = new Set(Object.values(EXECUTION_ERROR_CODES));

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

  const resumable = status === EXECUTION_STATUS.PAUSED || status === EXECUTION_STATUS.WAITING_FOR_FOUNDER;
  if (resumable && (resume_handle === null || resume_handle === "")) {
    throw new Error("Execution contract: status " + status + " requires a non-empty resume_handle.");
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
  return createExecutionResult(value);
}
