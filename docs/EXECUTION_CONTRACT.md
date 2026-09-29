# PDM Execution Contract

Status: Phase 2 — contract definition. No provider adapter is implemented by this document.

This contract defines the boundary between **PDM Core** and the **agent execution host**. It exists so Claude Code, Codex, LangGraph, or another execution backend can run the same PDM role without moving PDM's governance, methodology, or semantic state into the provider.

## 1. Boundary

The contract separates two kinds of state:

| State | Owner | Durable source of truth |
|---|---|---|
| Product facts, evidence, hypotheses, decisions | PDM Core / Product repository | Git-backed Product Context |
| PDM operational state | PDM Core / Product repository | Git-backed Work State / decision records |
| Methodology | PDM Core | methodology/ + derived registry |
| Portfolio policy | PDM Core | Product Registry |
| Execution position, retries, paused node, provider session handle | Execution host | Host checkpoint/state; opaque to PDM |
| Model/tool transport details | Execution host | Provider/backend |
| Human control events | Shared contract | Interpreted by PDM and reflected into durable state when needed |

**Critical rule:** execution checkpoints are not a second PDM memory system. A host may remember where execution paused; it must not become the authoritative store for product facts or decisions.

## 2. What PDM owns

PDM remains responsible for:

1. selecting the product and coherent work unit;
2. stating the dominant uncertainty;
3. selecting and applying methodology;
4. deciding whether composition members are needed;
5. retrieving bounded Product / Organization Context;
6. deciding whether to delegate to Research / Design / QA / Engineering;
7. evaluating Founder authority boundaries;
8. deciding whether the worker may continue;
9. classifying execution results into product-relevant outcomes;
10. persisting durable semantic state through the existing runtime boundaries.

The execution host must not reinterpret these responsibilities as provider-specific agent policy.

## 3. What the execution host owns

The host is responsible for:

1. starting and keeping alive the provider process;
2. invoking the model/agent implementation;
3. executing provider-supported tools;
4. streaming progress where available;
5. retaining execution checkpoints needed to resume an interrupted run;
6. retrying transport/execution failures where safe;
7. exposing an opaque resume handle;
8. reporting actual provider usage/quota signals to the Runtime Governor boundary;
9. translating provider-specific interrupts into the contract's lifecycle states.

The host must not silently turn a provider-side preference into a PDM decision.

## 4. Contract primitives

An adapter should expose these provider-neutral capabilities. The exact function names are implementation details.

### Session lifecycle

startRun(request) -> executionHandle

Starts or attaches an execution run.

resumeRun(resumeRequest) -> executionHandle

Resumes a paused/interrupted run using an opaque host-owned resume handle plus the PDM durable state.

stopRun(stopRequest) -> stoppedExecution

Stops execution intentionally. A stop is not itself a product decision.

### Work-unit lifecycle

beginWorkUnit(workUnit) -> executionHandle

Binds one execution run to one PDM work unit.

completeWorkUnit(result) -> executionResult

Closes one coherent work unit and returns a provider-neutral outcome summary.

failWorkUnit(failure) -> executionResult

Reports a failed work unit without fabricating product completion.

A host must not silently continue after a PDM work-unit boundary when the PDM Runtime Governor or autonomy rules require a stop.

### Suspension and human control

checkpoint(checkpointRequest) -> checkpointHandle

Persists enough execution position to resume. The returned handle is opaque and must not contain product truth encoded as a replacement for Git state.

interrupt(interruptRequest) -> interruptedExecution

Pauses execution for a human or policy event.

resumeAfterInterrupt(resumeRequest) -> executionHandle

Continues from a previously recorded interrupt after the controlling decision is available.

The most important interrupt type is founder_decision_required. The host pauses execution; **PDM owns the decision semantics and writes the durable decision record**.

### Tool execution

invokeTool(toolRequest) -> toolResult

Runs a provider/tool capability selected by PDM or required by the active methodology.

Tool execution may fail, time out, or be retried, but a successful tool result must not be mistaken for a product decision.

### Observability

emitExecutionEvent(event)

Emits a typed lifecycle event for tracing and debugging.

Execution events are telemetry, not a second source of truth. Durable product facts, evidence, assumptions, hypotheses, and decisions continue to use the existing Product Context / Work State / decision-record paths.

## 5. Canonical lifecycle states

The execution host reports only these states:

RUNNING
PAUSED
WAITING_FOR_FOUNDER
COMPLETED
FAILED
STOPPED

These are **execution states**, not portfolio states.

For example:

- WAITING_FOR_FOUNDER means this execution is suspended on a Founder boundary.
- Portfolio WAITING_FOR_FOUNDER is derived independently from the product's pending decision record.
- BLOCKED, READY, IDLE, and UNINITIALIZED remain PDM portfolio states and are not execution-host states.

## 6. Request envelope

Every host invocation should carry a small provider-neutral envelope:

~~~js
{
  contract_version: "1.0",
  run_id: "opaque-run-id",
  work_unit_id: "pdm-generated-id",
  product_id: "product-id",
  mode: "autonomous" | "interactive" | "resume",
  resume_handle: null | "host-owned-opaque-value"
}
~~~

Rules:

- run_id identifies one execution run.
- work_unit_id identifies the coherent unit PDM is asking the host to execute.
- product_id scopes execution; the host must not silently switch products.
- mode describes how the run was entered, not a different PDM identity.
- resume_handle is opaque host state. PDM must never parse it to infer product truth.

The host may attach provider/model metadata, usage, timing, and transport diagnostics separately.

## 7. Result envelope

A completed lifecycle operation returns a provider-neutral result shape:

~~~js
{
  contract_version: "1.0",
  run_id: "opaque-run-id",
  work_unit_id: "pdm-generated-id",
  product_id: "product-id",
  status: "RUNNING" | "PAUSED" | "WAITING_FOR_FOUNDER"
         | "COMPLETED" | "FAILED" | "STOPPED",
  resume_handle: null | "host-owned-opaque-value",
  summary: "human-readable execution summary",
  usage: {
    input_tokens: null,
    output_tokens: null,
    tool_calls: null,
    duration_ms: null
  },
  error: null | {
    code: "provider" | "tool" | "timeout" | "interrupt" | "configuration" | "unknown",
    message: "diagnostic text"
  }
}
~~~

summary is an execution summary, not a substitute for writing durable product state.

Usage fields may be null because not every provider exposes the same telemetry. The host is responsible for reporting the actual quota signal when the provider makes it available.

## 8. Founder checkpoint sequence

Founder checkpoints cross the execution boundary but not the authority boundary:

~~~text
PDM identifies HH-only decision
        ↓
PDM persists pending decision record
        ↓
PDM creates Founder Decision Brief
        ↓
Execution host emits WAITING_FOR_FOUNDER
        ↓
host preserves opaque resume handle
        ↓
HH decides / asks for more analysis
        ↓
PDM records the response and updates durable state
        ↓
PDM asks host to resume or changes the work plan
~~~

The host never converts a pause into an approval. A resumed run still receives its authority from PDM's durable decision state.

## 9. Runtime Governor boundary

The PDM Runtime Governor remains the policy authority for whether the worker may continue.

The host provides what only the host can know, such as an authoritative provider-quota signal. PDM Runtime combines that injected signal with its existing self-imposed ceilings.

~~~text
Provider usage / quota
        ↓
Execution host
        ↓
injected Governor signal
        ↓
runtime/instrumentation.js#shouldContinue()
        ↓
PDM Worker decides whether another work unit may start
~~~

The execution host must not replace the Governor with provider-specific stopping logic.

## 10. Methodology boundary

Methodology selection stays entirely in PDM Core:

~~~text
dominant uncertainty
      ↓
runtime/registry.js
      ↓
entrypoint + composition
      ↓
PDM judgment
      ↓
selected methodology detail
      ↓
execution host runs the resulting work
~~~

The host may provide a mechanism for loading or presenting a skill, but it must not decide that a particular methodology is authoritative merely because a provider has an identically named skill.

The repository's methodology/ remains canonical.

## 11. Specialist boundary

Specialist delegation is also PDM-owned:

~~~text
PDM uncertainty judgment
      ↓
runtime/orchestrator.js#delegateToSpecialist()
      ↓
Research / Design / QA / Engineering execution
      ↓
result returned to PDM
      ↓
PDM synthesis + durable state
~~~

A host may implement the actual specialist agent as a subagent, separate process, provider-native agent, or another mechanism. The implementation must remain replaceable.

## 12. Provider adapters

The first production adapter is expected to remain the current **Claude Code / Codex host path**, so this contract does not require direct model API access.

A future LangGraph adapter is a separate implementation question. It may use an API, Agent SDK, or another provider transport, but those choices do not change this contract.

~~~text
PDM Core
   ↓
Execution Contract
   ├── Claude Code adapter
   ├── Codex adapter
   └── future LangGraph adapter
~~~

No provider-specific dependency is required in PDM Core by this contract.

## 13. Deliberately not specified yet

Phase 2 defines the boundary, not the implementation details. It does **not** decide:

- which provider is used;
- which model is selected;
- where host checkpoints are stored;
- whether execution is a LangGraph graph, a Claude Code session, or another runtime;
- which transport carries streaming events;
- whether specialist agents run as subagents, processes, or remote workers;
- a scheduler or queue;
- a cross-provider common tool protocol.

Those are adapter / deployment decisions that should be evaluated against concrete execution needs.

## 14. Compatibility rule

A provider is contract-compatible only when it can preserve these invariants:

1. PDM remains the source of product-management judgment.
2. Git-backed PDM semantic state remains authoritative.
3. Execution state can pause and resume without inventing product facts.
4. Founder checkpoints can suspend execution without silently deciding them.
5. Runtime Governor decisions remain enforceable.
6. Methodology remains HH-owned and provider-neutral.
7. Product identity cannot silently switch during a work unit.
8. Provider replacement does not require rewriting PDM governance or methodology.
