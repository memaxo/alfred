# tool-graph-runtime

Owner: runtime

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan targets **ALFRED core runtime** (`packages/runtime/`) and **does not** modify generated applications.

If `.agent/PLANS.md` is checked into the repo, maintain this document in accordance with it.

## Purpose / Big Picture

Enable ALFRED’s runtime **act** phase to execute tool calls as a deterministic, dependency-aware **DAG** (directed acyclic graph) rather than relying on model-driven tool calling. This allows:

- Explicit output passing between tool calls (`$ref` input references).
- Automatic dependency resolution (implicit deps inferred from `$ref` usage).
- Parallel execution of independent tool calls with deterministic tie-breaking.
- Per-node retry with bounded backoff and optional fallback tool execution.
- Tool output validation against the tool’s declared output schema.

The user-visible outcome is improved reliability: multi-tool workflows succeed more often, fail more clearly, and avoid accidental infinite tool loops.

## Progress

- [x] (2026-01-10) Implemented a runtime tool-graph schema + executor in `packages/runtime/src/chain.ts`.
- [x] (2026-01-10) Integrated graph planning + execution into `packages/runtime/src/phases/act.ts` so tools are executed by the executor (not the model).
- [x] (2026-01-10) Added bounded parallelism (`maxParallel`) and abort propagation behavior; added deterministic tests.
- [x] (2026-01-10) Added guardrails: max node limit enforcement (`tool_graph_too_many_nodes`).
- [x] (2026-01-10) Defined failure contract: act escalates to plan when tool-graph execution returns `failed`.
- [x] (2026-01-10) Added unit tests for success, deps, parallelism, retry, fallback, validation, abort behavior, and escalation.
- [x] (2026-01-10) Promoted tool-graph tuning to a first-class per-run config (`input.toolgraph`), with env as fallback.

## Surprises & Discoveries

- Observation: Bun `mock.module()` is process-global; missing named exports in a mocked module hard-crashes the import graph.
  Evidence: `packages/runtime/test/adapter-preferences.test.ts` required stubbing `stepCountIs` when mocking `ai`.

- Observation: AI SDK schema validation is most reliable using `safeValidateTypes` from `@ai-sdk/provider-utils` rather than attempting Zod parsing directly at runtime.
  Evidence: `packages/runtime/src/chain.ts` validates tool outputs against the tool’s `outputSchema` via `safeValidateTypes`.

## Decision Log

- Decision: Execute tool graphs in runtime code, not by letting the LLM drive tool-call loops.
  Rationale: Enables deterministic dependency scheduling, bounded parallelism, retries/fallback, and consistent validation/error reporting.
  Date/Author: 2026-01-10 / Codex

- Decision: Escalate act → plan when tool graph finishes with `status: "failed"`.
  Rationale: If tool execution fails, a re-plan is usually required; pipeline runner already includes a MAX_TRANSITIONS safeguard.
  Date/Author: 2026-01-10 / Codex

- Decision: Hard-limit planned/executed tool graphs to 32 nodes.
  Rationale: Prevents stampedes and pathological graphs; most workflows should require far fewer tool calls.
  Date/Author: 2026-01-10 / Codex

## Outcomes & Retrospective

Implemented a complete DAG-based tool execution layer with explicit `$ref` output passing, dependency resolution, parallel scheduling, retries/fallback, and schema validation. Integrated the executor into the runtime act phase and added deterministic tests.

Key evidence:

- Executor + schema: `packages/runtime/src/chain.ts:73` (`toolGraphSchema`) and `packages/runtime/src/chain.ts:134` (`executeToolGraph()`).
- Guardrails + scheduling: `packages/runtime/src/chain.ts:60` (max nodes), `packages/runtime/src/chain.ts:158` (deterministic batching), `packages/runtime/src/chain.ts:265` (runtime max-node enforcement).
- Act integration + contract: `packages/runtime/src/phases/act.ts:50` (graph-planner prompt), `packages/runtime/src/phases/act.ts:296` (executor invocation + tuning), `packages/runtime/src/phases/act.ts:333` (escalate on tool-graph failure).
- Per-run config plumbing: `packages/runtime/src/types.ts:51` (`RuntimeInput.toolgraph`), `packages/agent/src/workflow/schema.ts:17` (workflow input validation), and `packages/agent/src/workflow/services.ts:64` (thread into runtime input).
- Config docs: `config/env.example:75` (`RUNTIME_TOOL_GRAPH_MAX_PARALLEL`) and `config/env.example:77` (`RUNTIME_TOOL_GRAPH_BACKOFF_MS`).
- Tests: `packages/runtime/test/chain.test.ts:418` (max node limit), `packages/runtime/test/phases/act.test.ts:226` (act escalation contract), and `packages/runtime/test/phases/act.test.ts:172` (input.toolgraph overrides env).

Remaining work (optional):

- Consider removing env tuning once all call sites set `input.toolgraph` (or clearly document precedence and keep both).
- Add richer graph-level metrics (graph run totals, failure breakdowns) if dashboards need them.

## Context and Orientation

**Tool graph**: a JSON object with `nodes[]`, where each node is a tool invocation:

- `id`: unique node identifier (string).
- `toolName`: tool catalog name (string).
- `input`: JSON-safe value; may include `$ref` objects to read outputs from earlier nodes.
- `dependsOn`: optional explicit dependencies (in addition to `$ref`-inferred deps).
- `retries`: optional retry count (bounded).
- `fallback`: optional `{ toolName, input }` run if retries exhaust.

**$ref syntax** (JSON-safe):

    { "$ref": { "step": "<node-id>", "path": "foo.bar[0].baz" } }

The executor resolves refs by reading the referenced node’s output and extracting the provided path.

## Plan of Work

1. Define and validate a `ToolGraph` schema in runtime (`packages/runtime/src/chain.ts`).
2. Build a DAG executor that:
   - Infers deps from `$ref` usage and merges with `dependsOn`.
   - Topologically schedules nodes; runs ready nodes in deterministic batches.
   - Emits `WorkflowEvent` tool-call/tool-result events.
   - Validates tool inputs and outputs against schemas (when present).
   - Applies retries/backoff and fallback execution.
   - Stops scheduling new work after abort.
3. Integrate into act:
   - Plan a tool graph via `generateObject({ schema: toolGraphSchema })`.
   - Execute the graph via `executeToolGraph()`.
   - Stream a final text-only summary call (tools disabled) after successful tool execution.
   - Escalate to plan when tool execution fails.
4. Add tests that prove:
   - Output passing, dependency resolution, parallelism.
   - Retry/fallback/validation behavior.
   - Abort behavior and escalation contract.

## Concrete Steps

Run tests:

    cd packages/runtime
    bun run test

Typecheck:

    cd packages/runtime
    bun run typecheck

Optional tuning (operational):

    export RUNTIME_TOOL_GRAPH_MAX_PARALLEL=4
    export RUNTIME_TOOL_GRAPH_BACKOFF_MS=25

## Validation and Acceptance

Acceptance is met when:

- `executeToolGraph()` runs a dependency chain where node B consumes node A output via `$ref`.
- Independent nodes execute concurrently (proven deterministically by a barrier-style test).
- A transient tool failure is retried and then succeeds.
- A persistent failure triggers fallback when configured.
- Invalid tool output (schema mismatch) is treated as failure and triggers retry/fallback.
- After abort, no new nodes are scheduled.
- When the tool graph finishes `failed`, act returns `{ escalated: true, reason: "tool_graph_failed" }` and the pipeline runner escalates back to plan (bounded by MAX_TRANSITIONS).

## Idempotence and Recovery

- Tool retries are bounded and should be kept low; tools must be designed to be idempotent or safe under retry.
- The pipeline runner protects against infinite escalation loops via its MAX_TRANSITIONS limit.

## Artifacts and Notes

The executor emits `WorkflowEvent` entries for:

- `tool-call` (with `input`)
- `tool-result` (with `input`/`output`)
- `error` events for invalid inputs/outputs or execution failures

This enables downstream persistence, replay, and UI display without special-casing model-driven tool loops.
