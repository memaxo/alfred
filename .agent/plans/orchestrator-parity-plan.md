# ALFRED Orchestrator Parity Plan: AI SDK v6 Runner, Structured Tool-Result Persistence, Observability, and Policy Tightening

This ExecPlan is a living document. The sections "Progress", "Surprises & Discoveries", "Decision Log", and "Outcomes & Retrospective" must be kept up to date as work proceeds. Follow this plan exactly; it is self-contained and assumes no context outside this document.

## 1) Title + Purpose / Big Picture

Title: Orchestrator Parity (AI SDK v6) — Full Workflow Runner, Structured Persistence/Replays, Observability, and Policy

Purpose / Big Picture:

Complete the refactor of ALFRED’s workflow/orchestrator to full AI SDK v6 parity by:

- Implementing a Mastra-free workflow runner and integrating it with the existing orchestration UI and run-registry (memory/redis).
- Restoring structured tool-result persistence and replay across assistant and orchestrator for both streaming and non-streaming flows, using AI SDK v6 message parts (UIMessage) as the canonical format.
- Tightening observability with Prometheus metrics for workflow runners and streams, adding per-route rate limiting, structured audit logs, redaction, and strengthening policy enforcement boundaries at tRPC routers and tools.
- Finalizing documentation and migration notes; eliminating any lingering gaps from Mastra removal.

Observable end result:

- /api/orchestrator SSE emits AI SDK v6 UIMessage parts for plan execution. The workflow router (tRPC) supports start/stream/resume/cancel using AI SDK v6 and the run-registry.
- Assistant and orchestrator non-streaming generate endpoints return structured tool results without coercion to assistant text, and persisted messages can be replayed to clients.
- Policy gate defaults no longer grant "owner" when roles are missing; obligations and scopes are enforced for orchestrator/workflow operations (mfa=passkey + elevated=true for medium/high autonomy).
- Metrics give visibility into workflow stream health, resume delivery, runner durations, and tool execution outcomes; dashboards and SLOs are defined.
- bun test and tsc -b succeed; docs updated.

## 2) Progress

- [x] (2025-11-08T18:10Z) Drafted Orchestrator Parity ExecPlan with architecture, milestones, and validation.
- [x] (2025-11-08T18:30Z) Implemented v6 Workflow Runner (packages/api/src/workflow/runner.ts) and integrated with workflow router start/stream/resume.
- [x] (2025-11-08T18:45Z) Added durable persistence for workflow runs/events via packages/db/src/repo/workflow.ts; router persists each streamed event.
- [x] (2025-11-08T18:50Z) Tightened policy gate defaults (no implicit owner); verified gate.ts uses trimmed roles with no fallback.
- [x] (2025-11-08T19:05Z) Restored non-stream structured tool replay: assistant/orchestrator generate optionally persist results to durable store (ENABLE_GENERATE_PERSIST=1).
- [x] (2025-11-08T18:55Z) Observability baseline: workflow stream counters/histograms wired; run-registry metrics active.
- [x] (2025-11-08T19:25Z) Tests: adjusted web and API tests; suite green locally (DB-gated tests skipped by default).
- [x] (2025-11-08T19:30Z) Docs & env: README documents SSE + workflow routers and metrics; env.example adds AI_MODEL and ENABLE_GENERATE_PERSIST.

## 3) Surprises & Discoveries

Add as implementation proceeds:

- Observation: runRegistry supports Redis and memory backends; instance ownership and acknowledgment logic sufficient for single-shot resume events. Confirm ack TTL and owner TTL on busy systems.
- Observation: Chat parts typed in packages/ui mismatch the v6 schema for "reasoning" and "data-status"; we must align rendering helpers so replayed parts render correctly (see "UI Correctness" risk).
- Observation: The policy middleware in gate.ts defaults roles to "owner" when absent — this must be corrected immediately to avoid privilege escalation.

## 4) Decision Log

- Decision: Use AI SDK v6 UIMessage as the canonical persistence format for workflow events and plan messages, serialized into workflow_events.event_data JSONB.
  Rationale: Minimizes lossy transforms and guarantees UI replay fidelity.
  Date/Author: 2025-11-08 (Codex)

- Decision: Implement a workflow runner (runPlanV6) as a plain TypeScript module (packages/api/src/workflow/runner.ts) that relies on AI SDK v6 tools and emits WorkflowEvent as a unified stream.
  Rationale: Avoid router-to-router coupling; keep orchestration logic independent and testable.
  Date/Author: 2025-11-08 (Codex)

- Decision: Policy gate must not fall back to "owner" when roles missing; instead, default to [] and optionally fail with FORBIDDEN for missing roles in sensitive operations.
  Rationale: Security: least-privilege default; explicit roles required.
  Date/Author: 2025-11-08 (Codex)

- Decision: Maintain HTTP SSE (/api/orchestrator) as canonical streaming path for UI; keep tRPC stream as an internal server stream primarily for run viewer and internal clients.
  Rationale: Aligns assistant endpoints and keeps the wire protocol uniform for UI components.
  Date/Author: 2025-11-08 (Codex)

- Decision: Add per-route rate limiting for workflow/assistant/orchestrator endpoints and structured audit logs + redaction for policy/runner events.
  Rationale: Prevent abuse, improve traceability, and reduce data leakage.
  Date/Author: 2025-11-08 (Codex)

## 5) Outcomes & Retrospective

(Complete at the end.)

Expected outcomes:

- Workflow router is Mastra-free and streams AI SDK v6 UI messages (parts) via SSE and tRPC.
- Structured tool results are persisted in DB and replayed coherently in both streaming and non-streaming modes.
- Policy boundaries enforced; no default "owner" roles; obligations honored (mfa+elevation).
- Metrics cover end-to-end orchestrations; runner/resume health and rate-limit saturation are visible; dashboards/SLOs committed.
- Tests green; type checks pass; docs updated.

## 6) Context and Orientation

Repository (root: /Users/jackmazac/Development/alfred)

- API (packages/api)
  - Routers: assistant.ts, orchestrator.ts, workflow.ts, token.ts, etc.
  - Run-registry: packages/api/src/run-registry.ts (memory/redis; ack; heartbeat).
  - Metrics: packages/api/src/metrics.ts (Prometheus registry; counters/histograms).
  - Gate: packages/api/src/gate.ts (policy enforcement middleware).
  - Context/TRPC: packages/api/src/{context.ts,trpc.ts,index.ts}.

- Agent (packages/agent)
  - Tool registry: packages/agent/src/v6.ts exposing getOpenAI, getModelId, buildOrchestratorTools, buildAssistantTools.
  - Orchestrator tools: packages/agent/src/orchestrator/tool/* (docker, git, web, router, ticket, proxmox, droid, codex).
  - Assistant tools: packages/agent/assistant/src/tool/* (handoff, home), handoff now Mastra-free placeholder.

- Types (packages/type)
  - stream.ts/stream.zod.ts: AI SDK v6 message types/schemas; UIMessage, ModelMessage.
  - plan.ts: early plan schemas with TODOs (align with DB schema).
  - runtime-context.ts: minimal context shim shared across services.

- Data (packages/db)
  - schema/workflow.ts: durable workflow_runs and workflow_events; migrations 0019_workflow_durable.sql, 0018_rag_optimize.sql.
  - repo/rag.ts: RAG operations.

- UI (apps/web, packages/ui)
  - apps/web/src/routes/api/{assistant, orchestrator}/$.ts: SSE endpoints using AI SDK v6.
  - apps/web/src/routes/orchestrator/run.tsx: Run viewer UI.
  - packages/ui/src/chat/{chat.tsx,parts.ts}: unified Chat rendering, typed parts.

## 7) Plan of Work (Milestones with Goals, Work, Result, Proof)

Milestone M1: Fix Security Default and Prepare Types

Goal:
- Remove dangerous default "owner" role when roles are missing.
- Ensure type schemas for UIMessage/tool parts match Chat rendering helpers and persistence model.

Work:
1. packages/api/src/gate.ts
   - Replace default roles fallback:
     - Before: subjectRoles = rawRoles && rawRoles.length > 0 ? rawRoles : ["owner"]
     - After:  subjectRoles = Array.isArray(rawRoles) && rawRoles.length > 0 ? rawRoles : []
   - Optionally deny in sensitive routes when roles are empty (add requirePolicy rules to enforce explicit roles).
2. packages/ui/src/chat/parts.ts and chat.tsx
   - Align part guards to AI SDK v6 schema:
     - reasoning uses `.reasoning`
     - data-status uses type `data-status`
     - file uses `{ mimeType, data }`
   - Update buildRenderBlock in chat.tsx: use part.reasoning instead of part.text.

Result:
- Secure, least-privilege policy defaults; part rendering correctness.

Proof:
- grep for "owner" fallback removed in gate.ts.
- UI tests (packages/ui/test/pane.render-shape.test.ts) pass with reasoning rendered correctly.

Milestone M2: Define Structured Persistence Format & Contracts

Goal:
- Adopt UIMessage as the canonical structure for persisting workflow events and messages.
- Define storage mapping for workflow_events.event_data and replay logic.

Work:
1. Persistence strategy
   - Use workflow_runs for high-level run state; workflow_events for event stream (step_start, tool-call, tool-result, text-delta, finish).
   - Persist each emitted UIMessage chunk as a record in workflow_events:
     - event_type: "step_start" | "assistant" | "tool_call" | "tool_result" | "notice" | "error" | "progress" | "finish" | "context"
     - event_data: JSON payload containing the UIMessage chunk or normalized structure; recommended: store the full UIMessage part(s) or a single part per record with metadata.
     - step_id: if applicable for grouping parts by step; otherwise null.
2. Replay contract
   - For stream replay: reconstruct the UI stream by fetching workflow_events in timestamp order and yielding parts as UIMessage chunks.
   - For non-stream replay: reconstruct messages by aggregating parts into assistant messages grouped by step boundaries.
3. Update types (packages/type/src/plan.ts)
   - Finalize/extend WorkflowEvent types to cover:
     - type: "run" | "status" | "progress" | "notice" | "error" | "assistant" | "tool-call" | "tool-result" | "finish" | "context" | "data-cache-handoff"
     - parts: UIMessage["parts"] for assistant/tool-calls/results
     - stepId, module/task info if available
4. Document field size/limits and truncation behavior; link to tool truncation notices.

Result:
- Clear mapping for persistence/replay; type schemas ready.

Proof:
- A design note (Artifacts & Notes) showing example workflow_events rows and a replay pseudo-iterator that merges parts to UI.

Milestone M3: Implement v6 Workflow Runner (runPlanV6) and Integrate with Workflow Router

Goal:
- Implement a Mastra-free runner that executes a plan using AI SDK v6 tools and emits WorkflowEvent as an AsyncGenerator; integrate with runRegistry and workflow router.

Work:
1. Create packages/api/src/workflow/runner.ts
   - Exports:
     - type RunHandleV6 = { runId: string; stream: AsyncGenerator<WorkflowEvent>; resume(payload): Promise<void>; cancel(): Promise<void>; }
     - function runPlanV6({ requirement, auto, authz, cw, mode, workspace, repoBase, profile, context, userId }: RunInput, deps: { tools: ToolSet; runRegistry: RunRegistry; db: { insertEvent(runId: string, type: string, data: unknown, stepId?: string | null): Promise<void>; setRunStatus(runId: string, status: string): Promise<void>; }; metrics: typeof import("../metrics") }): RunHandleV6
   - Responsibilities:
     - Generate runId (crypto.randomUUID()).
     - Assemble execution steps (context gather, code/web search via orchestrator tools, optional RAG).
     - For each step:
       - Emit WorkflowEvent chunks (e.g., { type: "context", phase, receipts/bundle }; { type: "progress", pct }).
       - When calling tools: emit "tool-call" parts; after execution, emit "tool-result" parts.
       - Optional: on text-generation summarization (generateText using model), emit assistant message parts.
     - Persist events via db.insertEvent(runId, event_type, event_data).
     - Register handle in runRegistry to receive resume events (deploy-authz, linear-authz, bio-authz); resume modifies runner state and continues.
     - Support cancel: abort controller that stops generator; set run status to "cancelled".
2. Update packages/api/src/routers/workflow.ts
   - start: Use runPlanV6 to generate runId and begin streaming; create workflow_runs row.
   - stream: Iterate runner.stream; on each event, persist to DB; record metrics; on complete set status to "completed".
   - resume: Dispatch to runRegistry; ensure payload maps to runner.resume.
   - cancel (optional): add cancel mutation; call runner.cancel() and persist final status.
   - events (replay): fetch persisted events in timestamp order for late-join hydration.
3. Metric instrumentation
   - Use workflowStreamEventsTotal for emitted event types.
   - workflowStreamDurationSeconds for completed status (ok/error/cancel).
   - Record resume delivery outcomes in runRegistryEventsTotal ("deliver" events).

Result:
- Functional v6 runner streaming; integrated with persistence and resume.

Proof:
- SSE smoke test and tRPC subscription test pass; DB rows recorded in workflow_events; replay endpoint yields persisted events.

Milestone M4: Restore Structured Tool-Result Replay (Non-Stream & Stream) and DB Persistence

Goal:
- Non-stream assistant/orchestrator generate endpoints return structured tool results and persist AI SDK messages (no coercion).
- Streaming endpoints continue to stream and persist events.

Work:
1. packages/api/src/routers/assistant.ts and orchestrator.ts
   - For generate mutation:
     - Use generateText with tools; on result, persist response messages as normalized UIMessage or ModelMessage mapping.
     - Return text + toolCalls + toolResults + usage; no coercion of tool into assistant role.
     - Provide an optional flag (persist?: boolean) — default true.
2. Persistence service helper (packages/api/src/ai/generate.ts or new module)
   - function persistModelMessages(runRef | threadId, messages: ModelMessage[], db): void
     - Convert ModelMessage array to normalized stored parts with minimal transformation.
3. Replay endpoints
   - Add GET/tRPC endpoint to fetch persisted messages for UI hydration (thread/run id).
   - Pagination/windowing for large runs.

Result:
- Non-stream flows maintain structured state; UI can fetch and replay persisted messages identically.

Proof:
- Unit test calls assistant.generate, then replay endpoint, ensures tool-call/result pairs are persisted and renderable.

Milestone M5: Tighten Policy and Resource Mapping for Orchestration

Goal:
- Enforce precise resource mapping and roles/scopes for workflow.start, workflow.stream, workflow.resume, orchestrator.generate, deploy.promote, etc.; add per-route rate limits.

Work:
1. packages/api/src/gate.ts
   - Confirm requirePolicy mapping functions cover:
     - resource.kind = "workflow", id = run id or "plan"
     - attrs = { auto, mode, workspace, repoBase }
   - Add conditions/obligations for medium/high autonomy (requires passkey).
2. Routers
   - workflow.start/resume: requirePolicy("workflow.plan", mapResource) with context including auto/mode; enforce obligations (mfa+elevated) for medium/high.
   - orchestrator.generate: requirePolicy("orchestrator.generate", mapResource).
3. Rate limiting
   - Implement per-route token bucket: assistant.generate, orchestrator.generate, workflow.start/stream/resume (configurable via env).
   - Return 429 with Retry-After; expose saturation via rateLimitHitsTotal metrics.
4. Audits + redaction
   - Create structured audit logs for policy decisions and runner lifecycle (start/step/resume/cancel).
   - Add redaction middleware to sanitize secrets/PII in logs and persisted parts (API keys, tokens, emails).
5. Tests
   - Add tests for forbidden without roles, missing scopes, PRECONDITION_FAILED for unmet obligations.
   - Add rate-limit tests for bursty traffic returning 429 (metrics increment).

Result:
- Consistent policy enforcement across orchestration flows; abuse-resistant endpoints.

Proof:
- Tests assert FORBIDDEN and PRECONDITION_FAILED paths; 429 under load; audit entries and redaction verified.

Milestone M6: Observability — Metrics, Dashboards, and Logs

Goal:
- Expose orchestration metrics with clear dimensionality; avoid high-cardinality labels; add dashboards and SLOs.

Work:
1. Metrics expansions
   - workflowStreamEventsTotal ({ event })
   - workflowStreamDurationSeconds ({ status }) — ok/error/cancel
   - runRegistryEventsTotal ({ event, backend, outcome })
   - runRegistryDispatchDurationSeconds ({ backend, outcome })
   - rateLimitHitsTotal ({ route })
   - runnerStepsTotal (optional) — counts by step type: context, plan, tool, summarize
2. Structured logging
   - Log resume events (runId,event,delivered); errors at error level.
   - Log runner start/complete with runId and duration.
3. Dashboards & SLOs
   - Add Grafana JSON dashboards to repo; SLOs for availability and p95 stream start; minimal dev alerts.

Result:
- Operators can observe orchestration health in Prometheus; dashboards capture key trends.

Proof:
- Metrics endpoint lists new counters/histograms; dashboards committed and render locally.

Milestone M7: UI Integration — Orchestrator Run Viewer and Chat Hydration

Goal:
- Orchestrator Run Viewer hydrates from persisted workflow_events and/or subscribes to stream; Chat UI renders structured parts; late-join works.

Work:
1. apps/web/src/routes/orchestrator/run.tsx
   - On mount: read runId query; open tRPC subscription; concurrently fetch persisted events; then merge live updates (dedupe).
   - Display tool-call/result parts; show progress and notices; surface obligations requiring elevation.
2. packages/ui/src/chat/chat.tsx
   - Confirm reasoning/tool/file/data-status parts render correctly; handle long lists via virtualization; ensure perf metrics capture windows.
3. Optional native prototype (Expo)
   - Build minimal page that streams orchestrator SSE; auto-resume reconnect; optional offline queue.

Result:
- Smooth operator viewer; consistent rendering; late join works; native baseline streams.

Proof:
- Manual test: Start run → refresh page mid-run → viewer replays persisted events then continues live; native baseline streams.

Milestone M8: Redis-backed Resume Validation (Optional)

Goal:
- Validate resume event delivery using Redis backend (RUN_REGISTRY_BACKEND=redis).

Work:
1. Integration test (skipped without REDIS_URL)
   - Start a run on instance A, resume from instance B; assert "delivered" ack and runner receives resume.
2. Timeouts and TTLs
   - Verify owner TTL and ack timeout settings are sane (owner TTL ~120s, ack timeout ~2000ms).

Result:
- Resume works cross-instance; metrics show delivered.

Proof:
- Test logs / metrics.

Milestone M9: Docs & Migration Notes

Goal:
- Document runner semantics, persistence schema, and policy behaviors; update env.example.

Work:
1. Docs:
   - docs/alfred-ai-sdk-v6-migration-examples.md — add workflow runner examples with UIMessage parts.
   - docs/alfred-ai-sdk-v6-audit.md — mark orchestrator parity done.
   - docs/test-mocking-review.md — add guidance for streaming tests and DB-gated tests.
2. config/env.example
   - Add RUN_REGISTRY_BACKEND, REDIS_URL
   - Document OPENAI_API_KEY, AI_MODEL, EXA_API_KEY, CADDY_ADMIN_URL where relevant.

Result:
- Self-contained documentation for operators and devs.

Proof:
- Grep "Mastra" shows no architectural references; v6 docs exist and are current.

## 8) Concrete Steps

Run from repo root: /Users/jackmazac/Development/alfred

1) Security default fix + Chat parts alignment
   - Edit packages/api/src/gate.ts to remove "owner" fallback; default to [] and optionally deny missing roles in sensitive ops.
   - Edit packages/ui/src/chat/{parts.ts,chat.tsx} to align with v6 schema (reasoning, data-status, file).
   - bun run typecheck

2) Persistence contracts
   - Confirm workflow schema tables exist (workflow_runs, workflow_events).
   - Add persistence helper in packages/api/src/ai to write UIMessage parts to DB.
   - bun run --filter @alfred/api typecheck

3) Runner implementation
   - Create packages/api/src/workflow/runner.ts with runPlanV6 implementation (AsyncGenerator, cancel, resume).
   - Wire workflow router start/stream/resume to runner; persist each event; instrument metrics.
   - bun run --filter @alfred/api typecheck

4) Non-stream structured replay
   - Modify assistant/orchestrator generate to persist structured messages; add replay endpoints.
   - bun run --filter @alfred/api typecheck

5) Policy & tests
   - Strengthen requirePolicy resource mapping; enforce obligations for medium/high autonomy.
   - Add tests: forbidden, obligations, rate-limit 429.
   - bun test

6) Observability
   - Add metrics counters/histograms; commit dashboards JSON; ensure metrics endpoint lists them.
   - bun test

7) UI integration
   - Update Orchestrator Run viewer: hydrate from persisted events before subscribing; dedupe merges.
   - Verify Chat UI message parts render for replay.
   - bun test

8) Redis resume validation (optional)
   - Test with RUN_REGISTRY_BACKEND=redis; verify ack/delivery.

## 9) Validation and Acceptance

Checklist:
- [ ] gate.ts no longer defaults roles to "owner"; least-privilege holds.
- [ ] /api/orchestrator streams v6 UIMessage parts; workflow router start/stream/resume integrated with runPlanV6; cancel works.
- [ ] Structured tool results persisted and replayed without coercion; assistant/orchestrator generate return toolCalls/toolResults properly.
- [ ] Orchestrator Run viewer hydrates from persisted events and continues via live stream; dedupe works.
- [ ] Metrics reflect runner activity (workflowStreamEventsTotal, workflowStreamDurationSeconds, runRegistryEventsTotal, rateLimitHitsTotal).
- [ ] Performance budgets: runner step p95 < 150ms (dev fixtures); TTFB p95 < 200ms; context bundle p95 < 300ms (dev sample).
- [ ] bun test and tsc -b pass; CI green; Redis tests gated by REDIS_URL.
- [ ] Docs updated; env.example lists relevant env vars.

## 10) Idempotence and Recovery

- Runner changes are additive; if an error occurs, revert to previous commit.
- If stream breaks, temporarily rely on /api/assistant SSE endpoint for demo and disable orchestrator run viewer streaming; continue to persist events and debug runner loop.
- If Redis resume fails, switch RUN_REGISTRY_BACKEND=memory; document limitations in docs; investigate Redis connectivity and sub/pub channels.

Rollback plan:
- Maintain work in a feature branch; rollback via git revert.
- Keep Mastra-free interim handoff tool to preserve escalate UX if runner integration needs rollback.

## 11) Risks and Mitigations

- UI Correctness risk (tool/parts rendering)
  - Mitigation: Align parts.ts and chat.tsx to v6 schema; add UI tests.
- Policy mis-scope risk
  - Mitigation: Expand tests for forbidden conditions; require explicit roles/scopes; remove owner fallback; enforce obligations for medium/high autonomy.
- Redis availability risk
  - Mitigation: Provide memory fallback; document REDIS_URL gating; handle ack timeouts gracefully.
- Data shape drift risk
  - Mitigation: Persist UIMessage parts as-is; avoid bespoke schemas for tool calls; version events in DB if needed.
- Backpressure/memory risk in AsyncGenerator
  - Mitigation: Use small buffers; write-through persist; allow client cancellation; ensure abort flows clear timers and registry.
- Rate limiting false positives
  - Mitigation: Calibrate token buckets; exempt admin users; add Retry-After guidance; monitor via rateLimitHitsTotal.

## 12) Artifacts and Notes

- Example workflow_events persistence record:

  {
    "run_id": "uuid",
    "event_type": "tool-call",
    "event_data": {
      "message": {
        "id": "msg-xyz",
        "role": "assistant",
        "parts": [
          { "type": "tool-call", "toolCallId": "call-1", "toolName": "web", "args": { "q": "..." } }
        ],
        "metadata": { "step": 3, "agent": "orchestrator" }
      }
    },
    "step_id": "step-3",
    "timestamp": "2025-11-08T12:34:56.789Z"
  }

- Sample runner yield:

  yield { type: "progress", pct: 45, message: "Context preparation complete" }
  yield { type: "assistant", parts: [{ type: "text", text: "Proposed plan: ..." }] }
  yield { type: "tool-call", parts: [{ type: "tool-call", toolCallId: "call-1", toolName: "git", args: {...} }] }
  yield { type: "tool-result", parts: [{ type: "tool-result", toolCallId: "call-1", toolName: "git", result: {...} }] }
  yield { type: "finish" }

- Replay logic (pseudo):

  const rows = await db.getEvents(runId);
  for (const row of rows) {
    const chunk = toUIChunk(row.event_type, row.event_data);
    writer.merge(chunk);
  }

## 13) Interfaces and Dependencies

- Runner:
  - function runPlanV6(input: {
      requirement: string;
      auto: "read" | "low" | "medium" | "high";
      authz?: string;
      cw?: string;
      mode: "sequential" | "parallel";
      workspace?: string;
      repoBase?: string;
      profile?: string;
      context?: { enable?: boolean; web?: boolean; topK?: number; maxTokens?: number; exts?: string[]; ignore?: string[]; seeds?: string[] };
      userId: string;
    },
    deps: {
      tools: ReturnType<typeof buildOrchestratorTools>;
      runRegistry: RunRegistry;
      db: { insertEvent(runId: string, type: string, data: unknown, stepId?: string | null): Promise<void>; setRunStatus(runId: string, status: string): Promise<void>; };
      metrics: typeof import("../metrics");
    }
  ): { runId: string; stream: AsyncGenerator<WorkflowEvent>; resume(payload: { event: "deploy-authz" | "linear-authz" | "bio-authz"; authz: string }): Promise<void>; cancel(): Promise<void> };

- WorkflowEvent (packages/type/src/plan.ts or nearby):
  - Discriminated union for "run | status | progress | notice | error | assistant | tool-call | tool-result | finish | context | data-cache-handoff".

- Persistence helper:
  - persistEvent(runId, type, data, stepId?)

- Replay endpoint:
  - GET /api/workflow/:runId/events or tRPC workflow.getEvents({ runId, limit?, after? }).

- Policy:
  - requirePolicy("workflow.plan", mapResource), "orchestrator.generate", "deploy.promote", etc.

- Env:
  - RUN_REGISTRY_BACKEND (memory|redis), REDIS_URL, OPENAI_API_KEY, AI_MODEL, EXA_API_KEY, CADDY_ADMIN_URL

By completing this plan, ALFRED’s orchestrator achieves full AI SDK v6 parity, with strong policy, observability, and structured persistence that enables robust replay and late-join resilience.
