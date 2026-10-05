# PDM Execution Contract

Status: contract definition. No provider adapter exists yet: nothing in this repository produces or consumes these envelopes, and the current Claude Code / Codex path does not emit them. `runtime/executionContract.js` validates the vocabulary, the envelopes and the lifecycle in §6; nothing else depends on it.

This contract defines the boundary between **PDM Core** and the **agent execution host**. It exists so Claude Code, Codex, LangGraph, or another execution backend can run the same PDM role without moving PDM's governance, methodology, or semantic state into the provider.

The boundary is lifecycle-oriented on purpose. It says *which* run, work unit and product the host is executing, *what state* that execution is in, and *who may do what* at the edges. It does not carry the objective, the methodology or the context for the work: the PDM Worker runs inside the provider process and does its own product selection, methodology selection, context retrieval, delegation and persistence (§2). Adding such a payload would be a contract change justified by a host that cannot run the PDM Worker role itself; no such host exists.

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
9. classifying execution results into product-relevant outcomes (§7);
10. persisting durable semantic state through the existing runtime boundaries;
11. deciding whether interrupted work is resumed, and whether failed or superseded work is retried as a new work unit or dropped (§9).

The execution host must not reinterpret these responsibilities as provider-specific agent policy.

## 3. What the execution host owns

The host is responsible for:

1. starting and keeping alive the provider process;
2. invoking the model/agent implementation;
3. executing provider-supported tools that PDM requested (§8);
4. streaming progress where available;
5. retaining the execution checkpoint of a *suspended* work unit until the unit leaves the suspended state or its run closes;
6. retrying transport/provider failures only where the step is idempotent or had no side effect (§9);
7. exposing an opaque resume handle for a suspended work unit;
8. reporting actual provider usage/quota signals to the Runtime Governor boundary;
9. translating provider-specific interrupts into the contract's lifecycle states.

The host must not silently turn a provider-side preference into a PDM decision.

**Relation to `governance/COLLABORATION_PROTOCOL.md`.** That protocol names two things: the *Host* (today a VM with `tmux`, which keeps the process alive and reachable) and the *Provider process* (Claude Code, Codex CLI, which invokes the model and tools). Both sit on the host side of this contract; "execution host" here means the two taken together, and the contract does not require them to be separate processes. In the current deployment the PDM Worker role itself runs inside that provider process, so judgment and execution share a process: the contract separates *authority*, not processes.

## 4. Runs, work units, and what resume covers

| Term | Meaning | Identified by |
|---|---|---|
| **Run** | One continuous execution of the PDM Worker role on a host, from `startRun` until the run is closed. It is the scope the Runtime Governor accumulates over (`runtime/instrumentation.js#createSession`: "one instance per PDM session/run") and the long-lived `A → B → C` worker of the Collaboration Protocol. It may span many work units and many products. A run has no lifecycle status of its own: it is open until `stopRun` or until the host loses it. | `run_id` |
| **Work unit** | One coherent unit of PDM work on exactly one product, selected and named by PDM. It is the "do one coherent work unit" step of the worker loop and the unit the Governor counts between (`recordWorkItem`; `shouldContinue` is "checked between work items, never mid-item"). Every lifecycle state in §6 describes a work unit's execution. | `work_unit_id` |

Work on PDM itself is work on the registered `pdm-core` product, so it has a `product_id` like any other. Portfolio bookkeeping (refreshing the portfolio, regenerating the index) is part of the worker loop between units, not a work unit.

There is no separate attempt or session identifier: `(run_id, work_unit_id)` identifies one execution, and the lifecycle below never needs more.

Cardinality:

1. A run contains zero or more work units; a work unit belongs to exactly one run.
2. A work unit has exactly one `product_id`, fixed for its lifetime. Different work units in the same run may be different products.
3. A work unit reaches **at most one terminal status**, once. Nothing follows a terminal status.
4. A run has **at most one RUNNING work unit** at a time: PDM does not begin or resume a unit while another is RUNNING. PAUSED and WAITING_FOR_FOUNDER units are dormant: they hold a resume handle and no execution slot, so a dormant unit does not stop the worker from starting its next unit. This is how a Founder checkpoint stays a product-local stop (Collaboration Protocol: "never a global stop").
5. **Retrying failed work is a new work unit** with a new `work_unit_id`, never a second attempt of the old one (§9).
6. **Resume continues a suspended work unit** — same `run_id`, same `work_unit_id` — and nothing else (§9).
7. A product has **at most one non-terminal work unit** at a time. Before PDM begins new work on a product that has a dormant unit, it resumes that unit or stops it with `stopWorkUnit`; otherwise two in-flight contexts of one product could diverge, and the dormant handle would leak until the run closes. This is PDM's obligation (the Collaboration Protocol already makes a Founder checkpoint a stop for that product); the validator does not enforce it.

Rules 2, 3, 5 and 6 are enforced over *reported* results by `assertRunHistory`, `assertExecutionHistory` and `assertResumeRequestFor`: a terminal `work_unit_id` cannot reappear, a handle is never reused, and `resume_unavailable` only ends a suspended unit. Rule 1 holds by construction (every result carries one `run_id`). Rules 4 and 7 are about `beginWorkUnit` and `resumeWorkUnit` calls. The validator sees only reported results, and the order in which results arrive is not the order in which calls were made, so it cannot reliably check them (`assertRunHistory` accepts two units both reporting RUNNING); PDM and the host must respect them. The validator does no I/O, so conditions that need durable state, such as "the decision is recorded" (§6), are PDM's to check.

**Run loss.** A run lasts as long as the host keeps it. Whether it survives a host process dying depends on whether the host durably stored its checkpoints, which this contract does not require (§17). A non-terminal unit of a lost run, RUNNING or dormant, reports nothing further on its own. PDM treats it as unfinished, reads durable state to see what was actually persisted, and begins a new work unit, in the same run if the host still holds the run and otherwise in a new run opened with `startRun`. If PDM does attempt `resumeWorkUnit` on a host that no longer knows the unit, the host answers FAILED with `resume_unavailable`; that answer is the unit's terminal status. A unit that goes silent while its run is still open holds the run's only RUNNING slot until PDM or HH releases it with `stopWorkUnit`; how long silence is tolerated is an adapter decision (§17). This is what the Collaboration Protocol means by "A host restart is therefore a resume operation": the PDM Worker *role* resumes from Git-backed state. It is not by itself a `mode: "resume"` request, which is only for a suspended work unit; PDM may issue one only if the host durably kept that unit's checkpoint, and otherwise starts new work units from durable state.

## 5. Contract primitives

An adapter should expose these provider-neutral capabilities. The function names are implementation details; the table fixes their meaning, not their spelling. Apart from the request and result envelopes (§10, §11), the arguments and return values of these primitives are adapter-defined: this contract specifies no API shape for them.

| Primitive | Initiated by | What it does | Work unit after |
|---|---|---|---|
| `startRun` | PDM side | Opens the run: starts the host's execution context, or attaches to an already-running provider process (for example the persistent `tmux` worker) without starting a second one. Fixes `run_id`. Selects no product and no work.  | none yet |
| `beginWorkUnit` | PDM | Opens one work unit for one product inside an open run, from the request envelope (§10), whose `mode` must be `autonomous` or `interactive`. It does not bind the run to that unit or product. | RUNNING |
| `resumeWorkUnit` | PDM | Continues a suspended work unit: `mode: "resume"` plus the handle issued by its suspension. The unit takes the run's RUNNING slot again. If the host cannot honour the handle, the unit becomes FAILED with `resume_unavailable`. | RUNNING |
| `interrupt` | host or PDM | Suspends a RUNNING unit for a human or policy event and returns the opaque resume handle (the host's checkpoint). An interrupt for a Founder decision gives WAITING_FOR_FOUNDER; any other pause gives PAUSED. | PAUSED / WAITING_FOR_FOUNDER |
| `completeWorkUnit` | host, after the PDM Worker has finished the unit's work and its persistence (§7) | Reports that the requested execution finished. | COMPLETED |
| `failWorkUnit` | host | Reports that the unit did not finish its requested lifecycle, without fabricating product completion. | FAILED |
| `stopWorkUnit` | PDM or HH | Ends one unit intentionally, running or suspended — for example a suspended unit whose plan a Founder decision superseded. | STOPPED |
| `stopRun` | PDM, HH or the host | Closes the run; every non-terminal unit becomes STOPPED and its handle is discarded. A stop is not itself a product decision. A stopped worker need not close its run (§6). | STOPPED |
| `invokeTool` | PDM | Runs a provider/tool capability PDM requested. See §8. | unchanged |
| `emitExecutionEvent` | host | Emits a lifecycle event for tracing and debugging. | unchanged |

Execution events are telemetry, not a second source of truth. Durable product facts, evidence, assumptions, hypotheses, and decisions continue to use the existing Product Context / Work State / decision-record paths.

Checkpointing is not a separate primitive. A host may snapshot its execution position whenever it likes for its own recovery (§9); a snapshot becomes visible to PDM only as the resume handle of a suspension. The handle must not contain product truth encoded as a replacement for Git state.

A host must not silently continue after a PDM work-unit boundary when the PDM Runtime Governor or autonomy rules require a stop. Because the Governor is checked between work items, a Governor stop shows up as PDM not calling `beginWorkUnit` again, not as STOPPED on a running unit; an explicit HH stop is the case that ends a running unit.

## 6. Lifecycle states and transitions

These are **execution states of a work unit**, not portfolio states and not states of the worker. `beginWorkUnit` puts a unit in RUNNING, so RUNNING is the implicit state before its first reported status.

| From \ To | RUNNING | PAUSED | WAITING_FOR_FOUNDER | COMPLETED | FAILED | STOPPED |
|---|---|---|---|---|---|---|
| **RUNNING** | yes (progress report) | yes | yes | yes | yes | yes |
| **PAUSED** | yes (resume) | no | no | no | yes (resume unavailable) | yes |
| **WAITING_FOR_FOUNDER** | yes (resume) | no | no | no | yes (resume unavailable) | yes |
| **COMPLETED** | no | no | no | no | no | no |
| **FAILED** | no | no | no | no | no | no |
| **STOPPED** | no | no | no | no | no | no |

This matrix is `EXECUTION_TRANSITIONS` in `runtime/executionContract.js`, and a test compares it, cell by cell, with a literal copy of the matrix. A host that honours a resume reports RUNNING before any later status. The resume request is not among the reported results, so `PAUSED → COMPLETED` would be indistinguishable from a host skipping execution, and it is rejected; a suspended unit leaves its status only as RUNNING (resume honoured), STOPPED, or FAILED, and that FAILED is always `resume_unavailable` (a dormant unit executes nothing that could fail otherwise); `resume_unavailable` is in turn used for nothing else. The validator checks both directions.

| State | Terminal | Resumable | Meaning |
|---|---|---|---|
| RUNNING | no | — | The host is executing the work unit. |
| PAUSED | no | yes | Suspended by a human or host event that is not a Founder decision: HH pausing the in-flight unit, or an orderly host shutdown from which the host can durably restore it. Carries a resume handle. |
| WAITING_FOR_FOUNDER | no | yes, conditionally | Suspended on a Founder boundary. PDM has already persisted the pending decision record (§12); the state means the host is holding this execution open for the answer. Carries a resume handle. |
| COMPLETED | yes | no | The host finished the requested work-unit execution. It says nothing about the product outcome (§7). |
| FAILED | yes | no | The execution did not finish its requested lifecycle (error code `provider`, `tool`, `timeout`, `interrupt`, `configuration`, `resume_unavailable` or `unknown`). It is not retried *as the same unit*, and it may have left partial durable writes behind. PDM decides what happens next (§9). |
| STOPPED | yes | no | Ended by decision rather than by its execution: HH or PDM stopped it (including releasing a superseded or unresponsive unit), or its run was closed. Neither a product decision nor a failure. |

**WAITING_FOR_FOUNDER is resumable only after the decision is recorded, and only if the plan is unchanged.** The host never resumes it on its own, and resuming is never approval: authority comes from the decision record. After HH answers and PDM records the response, PDM chooses:

- the response confirms the plan the unit was executing: `resumeWorkUnit`;
- the response changes the plan (a different option, a request for more analysis, a deferral, a challenge to the recommendation): `stopWorkUnit` (STOPPED), then, if work remains, a *new* work unit from the updated durable state. The old unit's in-flight context is not trusted to reflect a changed plan.

**Execution WAITING_FOR_FOUNDER versus portfolio WAITING_FOR_FOUNDER.** The portfolio status is derived from the pending decision record (`runtime/portfolio.js#deriveWorkStatus`) and never reads execution status. Execution WAITING_FOR_FOUNDER implies a pending decision record existed when the unit suspended (PDM persists it first, §12). Once PDM records HH's response the record is no longer pending, yet the unit stays WAITING_FOR_FOUNDER until PDM resumes or stops it. The converse does not hold. A unit that raises a checkpoint and has nothing left to do should finish COMPLETED, because the checkpoint lives in the decision record and not in the host; the product still derives to WAITING_FOR_FOUNDER. WAITING_FOR_FOUNDER is for a unit PDM wants to continue in place once HH answers. READY, BLOCKED, IDLE and UNINITIALIZED remain PDM portfolio states and are not execution states.

**None of these states describes the worker.** A dormant (PAUSED or WAITING_FOR_FOUNDER) unit does not by itself stop the run. Whether the worker continues is decided by the stop conditions of the Collaboration Protocol (no runnable work, the Governor, a safety boundary, HH's stop or pause), never by a unit's status: when HH pauses the worker, PDM begins no further unit until HH resumes it, although the in-flight unit's own status is just PAUSED. The Governor is checked between work items, so it never pauses a unit; it only stops PDM from beginning the next one. A stopped worker does not have to close its run: an open idle run keeps its dormant handles at the host's cost, and `stopRun` closes it, which STOPs every dormant unit and discards their handles. That loses nothing PDM relies on: after HH answers, PDM continues from durable state with a new work unit (§9).

## 7. Completion and persistence

- **COMPLETED means the host finished the requested execution.** PDM classifies the outcome — advanced, blocked, Founder checkpoint raised, nothing useful — from durable state (Work State, decision records, Product Context) and records that classification through the existing paths. The host does not classify.
- **Invariant:** a host may report COMPLETED only for an execution that has finished its requested lifecycle and has not lost any semantic output that PDM was responsible for persisting. The PDM Worker persists through the runtime boundaries *before* the unit is reported complete (the checkpoint-raise and session-close rules of `governance/WORK_STATE_BOUNDARY.md`). If the host cannot be sure — a crash between model output and persistence, a failed write — it reports FAILED, or reports nothing; it does not report COMPLETED.
- COMPLETED is a claim about the host's execution, not proof of persistence. Where they disagree, "the durable record wins" (Collaboration Protocol): a COMPLETED report with no corresponding durable change is classified by PDM as an outcome of "nothing persisted", not turned into a product fact.
- The result envelope stays small on purpose. `summary` and `usage` are execution telemetry. PDM does not read product facts, evidence or decisions from `summary`, and nothing may rely on it to carry what should have been persisted. There is no payload for semantic output, so the host result cannot become a second semantic memory.
- This contract does not own Product Context semantics. What counts as a fact, evidence, hypothesis or decision, and how it is classified, stays with Product Context, Work State and decision records.

## 8. Tool execution authority

`invokeTool` is not a general tool protocol; this contract does not define the request or result shapes (§17). It only fixes who has authority, by separating two kinds of operation:

- **Provider / model / tool execution** — host-owned: running the model, shell commands, reading files, searching, calling an MCP tool.
- **PDM Runtime operations that write authoritative state** — PDM-owned: Product Context (`writeProductContext`), Work State (`writeWorkState`), decision records (`upsertDecisionRecord`), the derived Active Brief and portfolio index, and publishing them (`publishProductRepositoryChanges`).

Rules:

1. The host executes tools PDM or the active methodology requested. It does not add, substitute or reinterpret them, and a tool being available is not authority to use it: the stop-and-wait list of `governance/AUTONOMY_BOUNDARY.md` §3 (merging to a default branch, external blast radius, writes to team-visible tools, destroying history, creating or deleting repositories or changing access) still needs HH however the host runs the call.
2. A tool result is evidence for PDM's judgment. It is never itself a durable record and never a product decision; it becomes durable only when PDM writes it through the Runtime operations above.
3. The host is not an authority for mutating authoritative PDM state. Those writes go through the runtime functions, invoked by PDM, which validate and classify. A generic host tool (a shell, a file writer) may be the *means* of running those functions, as it is today, but editing `context.json`, `work-state.json` or decision records directly through it bypasses validation and is not a sanctioned path; and the host must not auto-persist tool results into them.
4. Whether the Runtime functions run in the host process or as child processes started through a host shell tool changes nothing: the rule is about who decides and through which path state is written, not about processes.

## 9. Retry and resume

Three different things share the word "retry":

| | Transport retry | Semantic retry | Resume |
|---|---|---|---|
| What | The host re-sends or re-executes one step after a transport/provider failure | PDM doing failed or uncertain work again | Continuing a suspended work unit |
| Decided by | the host, within the safety rule below | PDM | PDM, via `resumeWorkUnit` |
| Visible in the contract | no: same unit, no new envelope, no new attempt | yes: a **new work unit** with a new `work_unit_id` | yes: a resume request on the same unit |
| Applies to | one step inside a RUNNING unit | a FAILED unit, or one whose outcome is unknown | PAUSED / WAITING_FOR_FOUNDER only |

1. **Transport retry only when safe.** The host may retry a step that is idempotent or known to have had no side effect: a model call that has not executed tools, a read-only tool call. It must not blindly retry an operation with side effects or an unknown outcome — a `git push`, a ClickUp or Slack write, a multi-step file write. Unknown side-effect profile means do not retry: end the unit as FAILED with the error, so PDM can look at the real state first. Recovering from the host's own snapshot after a crash is a transport retry and obeys the same rule.
2. **Semantic retry is PDM's decision.** PDM re-reads durable state first — a FAILED unit may already have persisted part of its work — then decides whether the work is still wanted and begins a new work unit. Git-backed state does not record writes to external systems (ClickUp, Slack, a remote): for an unknown-outcome side effect there, PDM inspects the target system itself and, if it still cannot tell, asks HH (such writes need HH's confirmation anyway, `governance/AUTONOMY_BOUNDARY.md` §3). It never re-runs the write on the assumption that it did not happen. Existing precedents: decision records are upserted by id, so re-recording is idempotent; and "on publish failure, retry only the publish — never redo the write" (`governance/WORK_STATE_BOUNDARY.md`).
3. **No attempt counter.** Each `work_unit_id` has at most one terminal outcome, so there is nothing to disambiguate. The link between a failed unit and its replacement is not carried in the envelope; whether repeated failures of the same work matter is judged by PDM from durable state; the Governor has no failure counter.
4. **The resume handle is narrow.** It is valid only for the unit that received it, in the run that issued it, and with the host/provider runtime that issued it. It is opaque, not portable across providers, hosts or versions, and single-use: it is spent when the unit returns to RUNNING, and every later suspension issues a new one (a repeated handle is rejected). PDM must not parse it, and must not persist it into Product Context, Work State or decision records, since that would tie durable state to one host.
5. **Prefer durable state over the handle.** When a handle is unusable — the host restarted without durable checkpoints, its checkpoint was lost, the provider changed — the host ends the unit as FAILED with `resume_unavailable`, and PDM continues from Git-backed durable state with a new work unit. A deliberate provider switch is a new run on the new provider, with new work units from durable state, as in the Collaboration Protocol's cross-provider handoff; PDM does not try to carry a handle across. A handle only saves rebuilding in-flight context; it is never the source of truth.

## 10. Request envelope

A request opens or resumes **one work unit** inside a run:

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

- `run_id` identifies the run the work unit belongs to, not the work unit.
- `work_unit_id` identifies the coherent unit PDM is asking the host to execute. PDM generates it; it is unique within a run and never reused, so a retry gets a new one.
- `product_id` scopes the work unit; it is fixed for the unit, and the host must not silently switch products. Other units in the same run may use other products.
- `mode` `autonomous` or `interactive` is the interaction policy for the unit (the Collaboration Protocol's interaction modes). `resume` marks entry by resuming a suspended unit; that unit then continues under the interaction policy it started with. Changing the policy mid-unit is not expressible: PDM stops the suspended unit and begins a new one.
- `resume_handle` is opaque host state, non-null exactly when `mode` is `resume`. PDM must never parse it to infer product truth.

`startRun` and `stopRun` carry run-level arguments that are adapter-defined. The host may attach provider/model metadata, usage, timing, and transport diagnostics separately.

## 11. Result envelope

A result reports the current status of one work unit:

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
    code: "provider" | "tool" | "timeout" | "interrupt" | "configuration"
          | "resume_unavailable" | "unknown",
    message: "diagnostic text"
  }
}
~~~

`summary` is an execution summary, not a substitute for writing durable product state (§7).

Consistency rules, enforced by `runtime/executionContract.js`:

- a request with `mode: "resume"` must carry a `resume_handle`, and any other mode must not;
- a result carries a `resume_handle` exactly when its status is `PAUSED` or `WAITING_FOR_FOUNDER`: otherwise nothing can resume it, or a stale handle invites resuming a unit that cannot be resumed;
- a result with status `FAILED` must carry an `error`, and a `COMPLETED` result must not;
- the ordered results of one work unit follow the transition matrix in §6, keep the same `run_id`, `work_unit_id` and `product_id`, and nothing follows a terminal status; a suspended unit can fail only as `resume_unavailable`, and `resume_unavailable` appears only as the FAILED that follows a suspension; a handle is never issued twice within a unit (`assertExecutionHistory`);
- the results of one run cover one `run_id`, are grouped per `work_unit_id` and each group is validated as above, and no handle is shared between work units (`assertRunHistory`);
- a resume request is checked against the unit's whole reported history: its latest result must be a suspension, and the request carries exactly the handle that result issued, so a handle from an earlier suspension is rejected (`assertResumeRequestFor`);
- a request, a result, and the `usage` and `error` objects inside a result accept only the fields defined above, and the constructors as well as the `assert*` functions reject any other, so a payload cannot enter the envelope unnoticed (`summary` remains a free-form string, §7); a non-object is rejected with a contract error, and the validated `error` is a copy of the input;
- `usage.input_tokens`, `output_tokens` and `tool_calls` are null or non-negative integers, and `duration_ms` is null or a non-negative finite number;
- a blank string is not a `resume_handle`.

Usage fields may be null because not every provider exposes the same telemetry. The host is responsible for reporting the actual quota signal when the provider makes it available.

## 12. Founder checkpoint sequence

Founder checkpoints cross the execution boundary but not the authority boundary:

~~~text
PDM identifies HH-only decision
        ↓
PDM persists pending decision record
        ↓
PDM creates Founder Decision Brief
        ↓
the unit ends in one of two ways; the run continues with the next runnable work either way
  a. nothing left to do        → COMPLETED
  b. PDM wants it continued    → WAITING_FOR_FOUNDER + opaque resume handle
        ↓
HH decides / asks for more analysis
        ↓
PDM records the response in the decision record and updates durable state
        ↓
  a. PDM selects follow-up work from durable state as a new work unit
  b. plan unchanged → resumeWorkUnit
     plan changed   → stopWorkUnit, then a new work unit if work remains
~~~

The host never converts a pause into an approval. A resumed unit still receives its authority from PDM's durable decision state.

## 13. Runtime Governor boundary

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

The Governor's counters are scoped to a run, so a host that continues work in a new run must inject the progress already made (`bin/pdm-run.mjs --done N`); otherwise the new run's ceilings start from zero. `--done N` carries one thing: how many work units this run has already used (`recordWorkItem`). Every work unit PDM began counts, whatever status it ended in, so a loop of failures or Founder checkpoints is still capped by `maxWorkItems`; a retry is a new unit and counts again. It carries no tool-call or token counters, and since the runtime keeps no state between invocations, the host passes it on every `bin/pdm-run.mjs` call, not only when it starts a new run.

## 14. Methodology boundary

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

## 15. Specialist boundary

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

A host may implement the actual specialist agent as a subagent, separate process, provider-native agent, or another mechanism. The implementation must remain replaceable. A specialist is part of its parent work unit's execution, not a work unit of its own.

## 16. Provider adapters

The current **Claude Code / Codex host path** is not yet an adapter: it does not produce these envelopes. The contract is written so that path could become one without requiring direct model API access.

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

## 17. Deliberately not specified yet

This contract defines the boundary, not the implementation details. It does **not** decide:

- which provider is used;
- which model is selected;
- where host checkpoints are stored, or whether they survive a host process restart;
- whether execution is a LangGraph graph, a Claude Code session, or another runtime;
- which transport carries streaming events;
- whether specialist agents run as subagents, processes, or remote workers;
- how long a silent work unit is tolerated before PDM releases it;
- any relaxation of the one-RUNNING-unit-per-run rule (§4);
- the shape of tool requests and results, or any cross-provider common tool protocol;
- a scheduler or queue.

Those are adapter / deployment decisions that should be evaluated against concrete execution needs.

## 18. Compatibility rule

A provider is contract-compatible only when it can preserve these invariants:

1. PDM remains the source of product-management judgment.
2. Git-backed PDM semantic state remains authoritative.
3. Execution state can pause and resume without inventing product facts.
4. Founder checkpoints can suspend execution without silently deciding them.
5. Runtime Governor decisions remain enforceable.
6. Methodology remains HH-owned and provider-neutral.
7. Product identity cannot silently switch during a work unit.
8. Provider replacement does not require rewriting PDM governance or methodology.
9. A work unit reaches at most one terminal status and is never resumed after it; failed work is retried as a new work unit.
10. Opaque host state, such as a resume handle, is never written into Product Context, Work State or decision records.
