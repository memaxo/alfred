# Implement Workflow Runtime Phases and Remove Legacy Runner (Runtime-Only Path)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with repository guidance in .agent/PLANS.md.

## Purpose / Big Picture

We will complete the workflow runtime implementation by:
- Implementing all four runtime phases (scan → plan → act → report) in packages/runtime/src/core.ts, integrating the existing ContextBuilder and AISDKAdapter.
- Removing the deprecated legacy runner and the runtime/runner feature flag logic from the API router, unifying on the new runtime path.
- Updating tests to be runtime-only, removing legacy runner references and feature flag mocks.

User-visible outcomes:
- Workflows always execute via the new runtime (no feature flags). Cancellation and resume flows continue to function. Router persists events identically, with improved consistency and maintainability.
- UI surfaces (Mindscape, Workflow Detail modal) continue to receive the same event stream semantics. No user-facing breaking changes are expected.

Non-functional improvements:
- Simpler, single execution path reduces maintenance costs and flakiness.
- Clear observability via runtime metrics; removal of dead code paths.
- Future integrations (policy, knowledge persistence) are easier with a single runtime.

## Progress

- [x] (2025-11-21 00:00Z) Drafted ExecPlan with concrete steps and architectural details.
- [ ] Implement runtime scan/plan/act/report methods as specified.
- [ ] Remove feature flag and legacy runner from router.
- [ ] Delete packages/api/src/workflow/runner.ts.
- [ ] Update tests to be runtime-only and remove feature flag mocks.
- [ ] Run test suite; ensure green.
- [ ] Update Outcomes & Retrospective.

## Surprises & Discoveries

- Observation: Router tests currently include dual-path compatibility checks and explicit env flag toggles.
  Evidence: packages/api/test/workflow.router.test.ts defines setupExecutorPath and runner-vs-runtime tests; packages/api/test/workflow.runtime-integration.test.ts sets process.env.USE_WORKFLOW_RUNTIME.

- Observation: core.ts includes a waitForResume() method annotated as reserved with a ts-expect-error. We will begin using it in the act phase.
  Evidence: packages/runtime/src/core.ts waitForResume is present with a // @ts-expect-error comment; phases contain TODOs.

## Decision Log

<decision id="1">
  <chosen>Remove legacy runner and feature flag; use runtime exclusively</chosen>
  <rationale>Single execution path improves reliability, reduces code size and cognitive load. No functional advantage to keeping legacy runner; runtime API already matches RunPlanV6 interface. Estimated maintenance reduction: 2x. Test simplification: ~25% fewer mocks.</rationale>
  <discards>Option A: Keep feature flag for rollback – rejected due to ongoing confusion and dead code; Option B: Migrate incrementally – rejected as runtime parity is already validated by tests.</discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

<decision id="2">
  <chosen>Integrate ContextBuilder during scan phase; cache-aware; emit detailed context events</chosen>
  <rationale>Reuses existing code/web context and RAG integration, preserves token budgets and metrics. Adds minimal code in core.ts and aligns with observability goals.</rationale>
  <discards>Option A: Ad-hoc context in core – rejected; duplicates logic and loses caching; Option B: Push context to router – rejected; violates separation of concerns.</discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

<decision id="3">
  <chosen>Use AISDKAdapter for planning and reporting; minimal toolset initially</chosen>
  <rationale>Adapter already maps AI SDK events to WorkflowEvent; leverages history selection and preference prompts. Tools can be expanded later without refactoring.</rationale>
  <discards>Option A: Manual streamText integration – rejected; adapter already implemented; Option B: Agent class – overkill for current structured workflow design.</discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

<decision id="4">
  <chosen>Act phase uses require-scope + waitForResume() for medium/high autonomy</chosen>
  <rationale>Meets security elevation needs and keeps flows explicit; leverages existing resume mechanism in runtime core.</rationale>
  <discards>Option A: Implicit continuation without resume – rejected; unsafe; Option B: Router-level resume gating – rejected; resume belongs in execution loop.</discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

## Outcomes & Retrospective

(To be updated after implementation)
- Expected: Single runtime path, all router and runtime tests green, simpler codebase.
- Lessons: Remove feature flags promptly post-migration to avoid drift. Runtime phases isolate concerns well; integration points (context, AI, tools) can evolve independently.

## Context and Orientation

Core components and roles:

- Runtime engine: packages/runtime/src/core.ts
  - WorkflowRuntime orchestrates phases: scan → plan → act → report
  - AsyncGenerator yields WorkflowEvent types throughout execution
  - Supports cancel and resume; enforces per-phase timeouts via AbortSignal

- AI integration: packages/runtime/src/adapters/ai.ts
  - AISDKAdapter.stream() wraps AI SDK v6 streamText
  - Validates UI messages and builds history context
  - Emits WorkflowEvent types: text-delta, tool-call, tool-result, stdout, stderr, error, etc.

- Context gathering: packages/runtime/src/context.ts
  - ContextBuilder.build(ContextBuildInput) gathers code/web context and optional RAG chunks
  - Emits metrics: runtimeContextBuildDurationSeconds, runtimeContextCacheHitsTotal, runtimeContextTokensTotal, runtimeRagRetrieval metrics

- API router integration: packages/api/src/routers/workflow.ts
  - start/stream procedures create executor (runtime), register run/cancel/resume, and persist events
  - Currently has feature flag path shouldUseWorkflowRuntime(), createWorkflowExecutor(); we will remove these and always use createRuntime()

- Legacy runner (deprecated): packages/api/src/workflow/runner.ts
  - Reference-only; demonstrates similar phase structure; will be deleted

- Tests:
  - packages/api/test/workflow.router.test.ts: currently covers both legacy runner and runtime; will be simplified to runtime-only
  - packages/api/test/workflow.runtime-integration.test.ts: runtime-focused; remove env flag setting

Data flow:
- Router creates runtime with input and model; consumes executor.stream and persists events to db (workflow_events), updates workflow_runs on completion/cancel/error.
- Runtime phases:
  - scan: ContextBuilder.build() to gather context; emit context event with receipts/bundle metadata
  - plan: AISDKAdapter.stream() with requirement and context; emit tool and text events
  - act: If auto in ["medium","high"], emit require-scope and wait for resume; then execute tools via AISDKAdapter.stream()
  - report: AISDKAdapter.stream() to produce final summary; emit progress 100% and end

## Plan of Work

Milestone 1: Implement runtime phases in core.ts (Core: minimal; Enhancements: richer context/report)
- Goal: Replace TODO placeholders with production logic using ContextBuilder and AISDKAdapter.
- Work:
  - Add private fields for holding scan context to reuse in plan/act/report (e.g., private execContext: ExecutionContext | null = null).
  - Implement executeScanPhase(signal):
    - Build ContextBuildInput from this._input.context fields, requirement, workspace, repoBase, web flag; set sensible defaults (topK, maxTokens).
    - Call new ContextBuilder().build(input); store result on this.execContext.
    - Emit context events:
      - { type: "context", phase: "scan", message: "context_gathered", receipts, tokens, topK, web }
      - Optional: { type: "notice", message: "rag_chunks_retrieved", count: n } if applicable.
  - Implement executePlanPhase(signal):
    - Build initial UIMessage[] containing the requirement from user and optional system instructions derived from context (bundle summary, top files, RAG chunk summaries).
    - Invoke new AISDKAdapter(this.runId).stream({ model: this._model, messages, tools, abortSignal: signal, system: combinedSystemPrompt }).
    - For each yielded event, yield directly to consumer.
  - Implement executeActPhase(signal):
    - If this._input.auto is "medium" or "high":
      - Determine required resume event: prefer "bio-authz" by default; if input.linear present, also allow/emit "require-scope" with scopes and event "linear-authz".
      - Emit { type: "require-scope", scopes: [...], event: "bio-authz" | "linear-authz" }.
      - Await this.waitForResume(requiredEvent). If null (timeout), emit { type: "notice", message: "resume_timeout" } and continue safely or degrade to read-only execution.
    - Execute tool-bearing steps via AISDKAdapter this same as plan phase, potentially with different system prompt indicating "execution" phase and enabling tools. Yield tool-call/tool-result events.
  - Implement executeReportPhase(signal):
    - Build a concise report prompt (what was requested, what was done, any deltas).
    - Use AISDKAdapter.stream to generate final assistant summary. Yield text events and finish with progress 100%.
- Proof: The runtime stream will now produce context, planning, execution, and reporting events, enabling the router to persist them. Existing metrics are incremented as before.

Milestone 2: Remove legacy runner & feature flags from router.ts
- Goal: Single execution path via runtime.
- Work:
  - Remove shouldUseWorkflowRuntime() and createWorkflowExecutor() helpers.
  - Delete all references to runPlanV6 and its import in router.ts.
  - In workflow.start and workflow.stream handlers, construct executor exclusively via createRuntime({ input, model, signal, stepTimeoutMs, workflowTimeoutMs }).
  - Remove checks and env flag USE_WORKFLOW_RUNTIME entirely.

Milestone 3: Delete legacy runner file
- Goal: Remove dead code.
- Work:
  - Delete packages/api/src/workflow/runner.ts

Milestone 4: Update tests to runtime-only
- Goal: Simplify tests to a single path and remove env flag toggles.
- Work:
  - packages/api/test/workflow.runtime-integration.test.ts:
    - Remove beforeAll hooks setting process.env.USE_WORKFLOW_RUNTIME. Ensure mocks target runtime (createRuntime) continue to function.
  - packages/api/test/workflow.router.test.ts:
    - Remove setupExecutorPath() and all tests/loci relying on legacy runner path (USE_WORKFLOW_RUNTIME=false scenario).
    - Convert tests that expected workflowRunnerMocks.runPlanV6 to instead mock workflowRuntimeMocks.createRuntime and validate runtime-only behaviors.
    - Delete the entire "executor compatibility" group, leaving only runtime path expectations.
  - Ensure metrics mocks remain, expectations updated accordingly.

Milestone 5: Cleanup
- Goal: Remove unused imports and stale code.
- Work:
  - In router.ts, remove now-unused imports (runPlanV6, helper functions).
  - Search repo for runPlanV6 references; remove or update as necessary (tests already covered).

## Concrete Steps

Run commands from repository root.

1) Implement runtime phases in packages/runtime/src/core.ts

- Edit class fields:

    // Add near other private fields
    private execContext: import("./context").ExecutionContext | null = null;

- Remove "@ts-expect-error" comment above waitForResume; it will be used now.

- Implement executeScanPhase(signal):

    - Construct ContextBuildInput:
      - requirement: this._input.requirement
      - workspace: this._input.workspace
      - repoBase: this._input.repoBase
      - web: Boolean(this._input.context?.web)
      - topK: this._input.context?.topK
      - maxTokens: this._input.context?.maxTokens
      - exts: this._input.context?.exts
      - ignore: this._input.context?.ignore
      - seeds: this._input.context?.seeds
      - authz: this._input.linear?.authz (optional pass-through)

    - Call new (await import("./context")).ContextBuilder().build(input)
    - Save to this.execContext
    - Emit:

        { type: "context", phase: "scan", message: "context_gathered", receipts: ctx.receipts, tokens: ctx.totalTokens }

      Optionally, if ctx.bundle present:

        { type: "notice", message: "context_bundle_ready", files: ctx.bundle?.files?.length ?? 0 }

- Implement executePlanPhase(signal):

    - Build UIMessage[]:
      - user message: id random; role "user"; parts [{ type: "text", text: this._input.requirement }]
      - Optionally include "system" prompt via AISDKAdapter merge behavior; here pass system with context summary: include top matches from receipts or rag cnt.

    - Call new (await import("./adapters/ai")).AISDKAdapter(this.runId).stream({
        model: this._model,
        messages,
        tools: undefined (or minimal toolset when ready),
        abortSignal: signal,
        system: "You are Alfred planner. Produce a concise plan." + optional context summary,
      })

    - for await (const evt of adapter.stream(...)) { yield evt; }

- Implement executeActPhase(signal):

    - If ["medium","high"].includes(this._input.auto):
      - Determine required event:
        - If this._input.linear present: required = "linear-authz"
        - Else: required = "bio-authz"
      - Emit: { type: "require-scope", scopes: ["droid.exec","repo.write"], event: required }
      - const resume = await this.waitForResume(required)
      - If !resume: yield { type: "notice", message: "resume_timeout" }
      - Continue; optionally pass authz into tools if applicable later.

    - Use AISDKAdapter as in plan phase with execution-oriented instruction:

        system: "You are Alfred executor. Execute planned steps. Use tools when necessary."

    - Yield adapter events (tool-call/tool-result/stdout/stderr).

- Implement executeReportPhase(signal):

    - Build concise report prompt summarizing requirement and progress
    - Use AISDKAdapter to generate assistant text
    - Yield events and then progress 100%.

2) Remove feature flag and legacy runner logic from packages/api/src/routers/workflow.ts

- Remove functions:

    function shouldUseWorkflowRuntime(): boolean { ... }
    function createWorkflowExecutor(...) { ... }

- Remove import of runPlanV6. Only keep createRuntime import and model wiring.

- In workflow.start and workflow.stream:
  - Replace usage of createWorkflowExecutor(...) with:

        const model = openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o");
        const executor = createRuntime({
          input: {
            requirement: input.requirement,
            auto: input.auto,
            workspace: input.workspace,
            repoBase: input.repoBase,
            mode: input.mode,
            context: input.context,
            linear:
              input.linear?.sessionId && input.authzLinear
                ? { sessionId: input.linear.sessionId, space: input.linear.space, authz: input.authzLinear }
                : undefined,
          },
          model,
          signal: abortController.signal,
          stepTimeoutMs: 5 * 60 * 1000,
          workflowTimeoutMs: 30 * 60 * 1000,
        });

- Ensure no environment checks for USE_WORKFLOW_RUNTIME remain.

3) Delete legacy runner

- Remove file:

    packages/api/src/workflow/runner.ts

4) Update tests to be runtime-only

- packages/api/test/workflow.runtime-integration.test.ts:
  - Remove lines setting process.env.USE_WORKFLOW_RUNTIME.
  - Expectations already reference workflowRuntimeMocks.createRuntime; keep as-is except env flags.

- packages/api/test/workflow.router.test.ts:
  - Remove setupExecutorPath() and any calls to it.
  - Remove "with legacy runner (USE_WORKFLOW_RUNTIME=false)" describe block entirely.
  - Update tests that previously used workflowRunnerMocks.runPlanV6 to use workflowRuntimeMocks.createRuntime instead:
    - For "start", "stream", "persists tool-call", "handles persistence failures", "marks workflow runs as cancelled", replace mock executor from runner with runtime executor.
    - Update expectations to assert workflowRuntimeMocks.createRuntime called and workflowRunnerMocks.runPlanV6 not called.
  - Remove process.env.USE_WORKFLOW_RUNTIME manipulation anywhere.

5) Cleanup

- Remove unused imports in router.ts after deletions.
- Search/replace across repo for runPlanV6 references; remove stale code paths in tests only.

## Validation and Acceptance

- Run all tests:

    bun test

  Expected:
  - All API tests pass.
  - runtime-only tests in workflow.runtime-integration.test.ts pass without env flag.
  - workflow.router.test.ts passes with runtime-only executor.
  - No references to USE_WORKFLOW_RUNTIME or runPlanV6 remain.

- Manual smoke (optional):
  - Start API and Web app if applicable.
  - Run a simple workflow via UI Mindscape node:
    - Expect initial run event, context event, progress updates, and completed event.
    - Cancellation updates status and emits cancel event metrics.

<edge-cases>
  <edge-case>
    <input>Abort before scan completes</input>
    <expected>Emit notice 'workflow_cancelled_before_start' and finalize with status cancelled</expected>
  </edge-case>
  <edge-case>
    <input>Medium/high autonomy without resume</input>
    <expected>Emit require-scope; after timeout, proceed read-only with notice 'resume_timeout'</expected>
  </edge-case>
  <edge-case>
    <input>No context available (empty repo, web disabled)</input>
    <expected>Emit context_gathered with zero counts; continue planning normally</expected>
  </edge-case>
  <edge-case>
    <input>AI SDK error during planning</input>
    <expected>Emit error event with message; propagate failure; router records 'error' and updates run status</expected>
  </edge-case>
</edge-cases>

## Idempotence and Recovery

- Removing feature flags and runner is idempotent; repeated edits do not cause drift.
- If phase implementation partially applied:
  - Re-run code edits safely; functions are pure additions replacing TODO placeholders.
- Deleting runner.ts is safe; no backups needed; version control provides rollback.
- Tests can be re-run repeatedly; mocks reset between tests (existing utilities handle resetAllMocks()).

## Artifacts and Notes

Example event shapes to expect/emit:

  // Context event (scan)
  { "type": "context", "phase": "scan", "message": "context_gathered", "receipts": { "code": [...], "web": [...] }, "tokens": 12345 }

  // Require-scope (act, medium/high)
  { "type": "require-scope", "scopes": ["droid.exec", "repo.write"], "event": "bio-authz" }

  // Tool call/result (plan/act via AISDKAdapter)
  { "type": "tool-call", "toolCallId": "call-1", "toolName": "git.status", "input": { "repo": "alfred" } }
  { "type": "tool-result", "toolCallId": "call-1", "toolName": "git.status", "output": { "clean": true } }

  // Final progress
  { "type": "progress", "pct": 100, "message": "completed" }

## Interfaces and Dependencies

<interfaces>
  <interface path="packages/runtime/src/core.ts">
    <class name="WorkflowRuntime">
      <field name="execContext" type="ExecutionContext | null" />
      <fn name="executeScanPhase">
        <param name="signal" type="AbortSignal" />
        <returns>AsyncGenerator<WorkflowEvent, void, void></returns>
        <side-effects>Sets this.execContext; emits context and notice events</side-effects>
      </fn>
      <fn name="executePlanPhase">
        <param name="signal" type="AbortSignal" />
        <returns>AsyncGenerator<WorkflowEvent, void, void></returns>
        <side-effects>Streams AISDKAdapter events; no state mutations</side-effects>
      </fn>
      <fn name="executeActPhase">
        <param name="signal" type="AbortSignal" />
        <returns>AsyncGenerator<WorkflowEvent, void, void></returns>
        <side-effects>May wait for resume; streams AISDKAdapter events</side-effects>
      </fn>
      <fn name="executeReportPhase">
        <param name="signal" type="AbortSignal" />
        <returns>AsyncGenerator<WorkflowEvent, void, void></returns>
        <side-effects>Streams AISDKAdapter events to produce summary</side-effects>
      </fn>
      <fn name="waitForResume">
        <param name="requiredEvent" type="ResumePayload['event']" />
        <returns>Promise<ResumePayload | null></returns>
        <side-effects>Consumes queued resume; times out after 10s returning null</side-effects>
      </fn>
    </class>
  </interface>

  <interface path="packages/runtime/src/context.ts">
    <class name="ContextBuilder">
      <fn name="build">
        <param name="input" type="ContextBuildInput" />
        <returns>Promise<ExecutionContext></returns>
      </fn>
    </class>
  </interface>

  <interface path="packages/runtime/src/adapters/ai.ts">
    <class name="AISDKAdapter">
      <fn name="stream">
        <param name="options" type="StreamOptions" />
        <returns>AsyncGenerator<WorkflowEvent, void, void></returns>
      </fn>
    </class>
  </interface>

  <interface path="packages/api/src/routers/workflow.ts">
    <fn name="workflow.start" />
    <fn name="workflow.stream" />
    <note>Both construct executor with createRuntime only</note>
  </interface>
</interfaces>

Revision Note: Initial ExecPlan created to implement runtime phases, remove legacy runner/feature flags, and update tests to be runtime-only. Chosen to unify on runtime for simplicity and maintainability.