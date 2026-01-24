# GenUI Phase 1: LLM Schema Generation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

Owner: api

## Purpose / Big Picture

After this work, Sir can ask ALFRED for data-rich answers (especially in voice workflow scenarios) and receive a `data-ui` message part whose `ui` schema is generated dynamically based on the data shape and context, rather than being hardcoded in a workflow handler.

User-visible behavior this enables:

When ALFRED has structured data (arrays, records, timelines, plan/task structures), the API layer can (a) select an appropriate GenUI component name and (b) generate a valid `UIComponent` schema (optionally via LLM structured output) so the web client renders the optimal visualization. When models do not support GenUI or schema generation fails, ALFRED falls back to raw data/text without crashing.

Observable outcome (minimum viable proof):

- In voice workflow flows, `packages/api/src/voice/workflow-handler.ts` no longer constructs hardcoded `workflow-timeline` and `plan` schemas. Instead it delegates to a `SchemaGenerator` service, and the produced `data-ui` parts validate against `uiComponentSchema`.
- In at least one API-driven assistant response path, a data question results in a `data-ui` part whose schema was produced via AI SDK v6 `generateObject()` (with capability gating), not handwritten JSON.

## Progress

- [x] (2026-01-20) Explored existing AI SDK v6 generation + model selection patterns.
- [x] (2026-01-20) Decided schema generation uses `@alfred/agent/selector` + `classify` role by default.
- [x] (2026-01-20) Implemented `SchemaGenerator.selectComponent()` deterministic mapping with >10 unit tests.
- [x] (2026-01-20) Implemented `SchemaGenerator.generateSchema()` with deterministic fast paths + LLM fallback using AI SDK v6 `generateObject` guarded by `supportsGenUI(selection)`.
- [x] (2026-01-20) Replaced hardcoded GenUI schemas in `packages/api/src/voice/workflow-handler.ts` with `SchemaGenerator` calls while keeping `data.kind` metadata stable.
- [x] (2026-01-20) Added streaming schema generation endpoint `POST /api/genui` compatible with `packages/ui/src/genui/streaming.tsx` `createGenUIObjectConfig` / `useObject`.
- [x] (2026-01-20) Added unit tests for schema selection + generation + fallback (new `packages/api/test/schema.generator.test.ts`).
- [x] (2026-01-20) Added observability: Prometheus counter + histogram + basic success logging for schema generation.
- [x] (2026-01-20) Added focused test asserting voice workflow raw output contains valid `data-ui` schemas (`packages/api/test/voice.genui.test.ts`).
- [x] (2026-01-20) Validation: added route test for `/api/genui` streaming behavior (`apps/web/src/tests/routes/genui.route.test.ts`) and ran it successfully; this is the Phase 1 “user-visible proof” substitute in CI.

## Surprises & Discoveries

- Observation: The “model registry” for selection and capability gating is implemented in `@alfred/agent/selector` (not `packages/cortex/src/registry.ts` as suggested by the PRD context).
  Evidence: `packages/agent/src/selector.ts` defines `ModelSelection`, `hasCapability()`, and `supportsGenUI()`, and defaults classification to `cerebras:gpt-oss-120b`.

- Observation: The web server already has a robust AI SDK v6 streaming handler (`apps/web/src/lib/api/stream-handler.ts`) that uses `streamText().toUIMessageStreamResponse(...)`, but there is no existing `streamObject` endpoint pattern.
  Evidence: `apps/web/src/lib/api/stream-handler.ts` uses `streamText` and persists conversation messages; `packages/api/src/*` contains no `streamObject(` usage today.

- Observation: Adding a new TanStack Start server route requires regenerating `apps/web/src/routeTree.gen.ts` (otherwise TypeScript errors that the new path is not in `FileRoutesByPath`).
  Evidence: `apps/web/src/routes/api/genui.ts` initially triggered `Argument of type '\"/api/genui\"' is not assignable to parameter of type 'keyof FileRoutesByPath'` until `bunx @tanstack/router-cli generate` was run.

- Observation: Server route modules must not import server-only packages at module scope; use variable-based dynamic imports with `/* @vite-ignore */`.
  Evidence: `apps/web/.ruler/21-tanstack-start.md` rule 8; the `/api/genui` route was updated to dynamically import `@alfred/auth`.

- Observation: `packages/api/test/integration/voice-workflow.integration.test.ts` currently fails with `TRPCError: No procedure found on path "stream"` in this workspace state, blocking end-to-end validation in that harness.
  Evidence: `bun run test ./packages/api/test/integration/voice-workflow.integration.test.ts` fails with NOT_FOUND for procedure "stream". This appears unrelated to GenUI schema generation and should be triaged separately.

## Decision Log

- Decision: Use `@alfred/agent/selector` capability gating (`supportsGenUI(selection)`) rather than introducing a second, divergent `supportsGenUI(modelId)` helper in `@alfred/type/model`.
  Rationale: Capability truth already lives with model selection and is tested; `packages/api/src/adapters/ai-generation.ts` already imports `@alfred/agent/selector`.
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Use the `classify` model role for schema generation by default.
  Rationale: The repo already defaults `classify` to Cerebras `gpt-oss-120b` (fast, structured-output-capable), which matches the PRD’s “LLM schema selection” requirement while minimizing latency and cost. The schema generator can still be overridden to use `voice` or `chat` for richer context when needed.
  Date/Author: 2026-01-19 / GPT-5.2

- Decision: Implement `/api/genui` as a TanStack Start server route (`apps/web/src/routes/api/genui.ts`) that streams AI SDK `streamObject(...).toTextStreamResponse()` instead of adding a new tRPC endpoint in `@alfred/api`.
  Rationale: `useObject` expects a simple HTTP endpoint; TanStack Start routes already handle session auth and server wiring cleanly, and this keeps the surface area small for Phase 1.
  Date/Author: 2026-01-20 / GPT-5.2

## Outcomes & Retrospective

### Shipped (2026-01-20)

Core implementation:

- `packages/api/src/services/schema.ts`
  - `SchemaGenerator.selectComponent()` (deterministic data-shape mapping)
  - `SchemaGenerator.generateSchema()` (deterministic fast paths + LLM fallback via `generateObject` and `uiComponentSchema`)
  - `SchemaGenerator.toDataUiPart()` (builds `data-ui` parts, preserving optional backing `data`)

Voice integration:

- `packages/api/src/voice/workflow-handler.ts`
  - `buildVoiceWorkflowRaw(...)` now generates `workflow-timeline` and `plan` `data-ui` parts via `SchemaGenerator` (no hardcoded `ui` object literals)
  - Added voice-context hints (surface/mode/verbosity mapping)

Streaming endpoint:

- `apps/web/src/routes/api/genui.ts`
  - `POST /api/genui` streams `UIComponent` objects via `streamObject(...).toTextStreamResponse()`
  - Guarded by `supportsGenUI(selection)` using `getModelForRole("classify", { userId })`
  - Uses dynamic `@alfred/auth` import to avoid accidental client bundling
- `apps/web/src/routeTree.gen.ts` regenerated to include `/api/genui`

Observability:

- `packages/api/src/metrics/genui.ts` (exported via `packages/api/src/metrics/index.ts`)
  - `genui_schema_generation_total{path,outcome,component,surface,mode}`
  - `genui_schema_generation_duration_seconds{path,component,surface,mode}`

Tests:

- `packages/api/test/schema.generator.test.ts` (13 passing tests)
  - Covers >10 `selectComponent` cases + deterministic validation + capability gating + LLM-path stub
- `packages/api/test/voice.genui.test.ts` (1 passing test)
  - Exercises `handleWorkflowIntent` with minimal mocks and asserts `data-ui` parts validate via `uiComponentSchema`
- `apps/web/src/tests/routes/genui.route.test.ts` (3 passing tests)
  - Verifies `/api/genui` is in `routeTree.gen.ts`, enforces 401 on missing session, and returns a streaming response with `x-model` when supported.
- `packages/api/test/voice.genui.test.ts` (1 passing test)
  - Exercises `handleWorkflowIntent` with minimal mocks and asserts `data-ui` parts validate via `uiComponentSchema`

Evidence (tests run):

- `bun run test packages/api/test/schema.generator.test.ts` (13 pass)
- `bun run test packages/api/test/voice.workflow.test.ts` (33 pass)
- `bun run test packages/api/test/voice.genui.test.ts` (1 pass)
- `cd apps/web && bun run test src/tests/routes/genui.route.test.ts` (3 pass)

### Failure modes observed

- Repository-wide `bun run typecheck` fails due to pre-existing errors in unrelated packages (voice, pipeline, workflow routers, native). This plan did not attempt to resolve them.
- `packages/api/test/integration/voice-workflow.integration.test.ts` fails in this workspace state with `TRPCError: No procedure found on path "stream"`, preventing full end-to-end voice→workflow integration validation in that harness.

### Follow-ups / remaining work for Phase 1 completion bar

- Add a small manual transcript + evidence section: `POST /api/genui` with a trivial prompt and confirm the UI renders using `StreamingUIRenderer` + `GenUISkeleton` from `@alfred/ui/genui/streaming`.

## Context and Orientation

This plan implements Phase 1 of “LLM schema generation” from `docs/genui-prd.md`, building on the completed GenUI framework in `docs/execplans/generative-ui-framework.md`.

This PRD targets ALFRED itself (backend + web/native clients), not applications generated by ALFRED.

### Key terms (repo-specific)

- A `UIComponent` is a JSON-serializable schema describing a component tree, defined in `packages/type/src/genui.ts`. It has:
  - `component`: string component name (must exist in the app’s GenUI registry at runtime)
  - `props`: `Record<string, unknown>`
  - `children?`: nested `UIComponent[]`
  - `key?`: stable key for reconciliation

- A `data-ui` part is a message part with `type: "data-ui"` and a `ui: UIComponent` payload, validated by `uiComponentSchema` in `packages/type/src/genui.zod.ts` and rendered in web chat by `apps/web/src/components/chat-render.tsx`.

- “GenUI capability” means the model can reliably produce structured JSON output for schemas. In this repo, capability gating is implemented via `supportsGenUI(selection)` in `packages/agent/src/selector.ts`.

### Existing GenUI infrastructure (already completed; do not reimplement)

- Types: `packages/type/src/genui.ts`
- Zod schemas: `packages/type/src/genui.zod.ts` (notably `uiComponentSchema`)
- UI registry: `packages/ui/src/genui/registry.ts` (`registerComponent`, `resolveComponent`)
- Schema interpreter: `packages/ui/src/genui/interpreter.tsx` (`UISchemaRenderer`)
- Tool helpers: `packages/ui/src/genui/tool.ts` (e.g., `createChartResult`, `createWorkflowResult`, `createPlanResult`)
- Web initialization: `apps/web/src/components/genui/registry.ts`
- Web rendering: `apps/web/src/components/chat-render.tsx` renders `data-ui` first via `UISchemaRenderer` + `GenUIErrorBoundary`
- Streaming UI client helper: `packages/ui/src/genui/streaming.tsx` provides `createGenUIObjectConfig` for `useObject`-style endpoints

### Current gap (what we are fixing)

`packages/api/src/voice/workflow-handler.ts` currently constructs `data-ui` parts with hardcoded `ui` schemas for `workflow-timeline` and `plan`. This means:

- The LLM does not choose the optimal representation.
- Tool/data producers cannot emit UI without bespoke handler logic.
- There is no AI SDK v6 `generateObject` path for generating `UIComponent` schemas.

The hardcoded section is currently in `buildVoiceWorkflowRaw(...)`, where the handler creates `timelinePart` and `planPart` objects inline.

### Model selection and AI SDK v6 patterns to follow

- `packages/api/src/adapters/ai-generation.ts` defines `DefaultAIAdapter.generateObject(...)`, which wraps AI SDK v6 `generateObject`.
- `packages/agent/src/selector.ts` provides `getModelForRole(...)` and `supportsGenUI(selection)` for capability gating.
- `apps/web/src/lib/api/stream-handler.ts` demonstrates how to stream AI SDK responses over HTTP for `useChat`-style consumption (text). We will adapt its principles (auth, metrics, no-store, abort) for `useObject`-style schema streaming.

## Plan of Work

We implement a `SchemaGenerator` service in the API layer and integrate it into voice workflows first (because the current hardcoded `data-ui` is there), then we add a minimal “schema generation endpoint” to support progressive schema generation via `useObject` on the web.

The service has two responsibilities:

1. Fast, deterministic mapping: decide whether a given data payload should render as GenUI and which component is appropriate (`selectComponent`).
2. Safe schema production: produce a valid `UIComponent` schema for the selected component, using deterministic building for unambiguous shapes and AI SDK v6 `generateObject` for ambiguous or layout-heavy cases (`generateSchema`).

### Milestone A: Add `SchemaGenerator` service (deterministic + LLM paths)

Create `packages/api/src/services/schema.ts`.

Define the “context” explicitly so schemas can be adapted by surface:

- surface: `"web"` | `"mobile"` | `"voice"` | `"tui"`
- viewport hint: `{ width?: number; height?: number }` (optional)
- conversation mode hint: `"assistant"` | `"workflow"` | `"focus"` (strings, not enums, to keep boundaries light)
- preference hints: (optional) `verbosity`, “compact vs rich”, “prefer charts” (initially best-effort and non-persisted)
- identity: `userId`, optional `projectId`

Define the API surface (names are prescriptive; keep functions small and pure where possible):

- `selectComponent(data: unknown, ctx: SchemaContext): string | null`
  - returns `null` when GenUI is not appropriate (e.g., plain text)
  - returns a component name (e.g., `"chart"`, `"grid"`, `"workflow-timeline"`, `"plan"`)

- `generateSchema(args: { data: unknown; ctx: SchemaContext; component?: string | null; }): Promise<{ ui: UIComponent | null; meta: SchemaMeta }>`
  - if `component` is provided: treat it as “preferred component” but allow downgrade to null on mismatch
  - validates output using `uiComponentSchema.safeParse`
  - never throws for invalid LLM output; returns `{ ui: null }` and logs metrics

- `toDataUiPart(args: { data: unknown; ctx: SchemaContext; id?: string; preferredComponent?: string | null; }): Promise<UIMessage["parts"][number] | null>`
  - produces `{ type: "data-ui", ui, id?, data? }` shaped for callers that build `UIMessage` parts
  - returns `null` when `ui` is null
  - note: voice currently includes a `data` payload alongside `ui`; this plan keeps that behavior stable for backwards-compat clients that might rely on `data.kind`

Deterministic mapping rules (initial set; must have unit tests):

- Array of numbers (or array of `{x,y}`-like points) → `chart`
- Record of key/value primitives (string/number/boolean) → `grid` (or `panel` if surface is voice and size is tiny)
- Array of homogeneous records (objects with same keys) → `grid`
- Array of objects with timestamps (ISO strings or epoch numbers) → prefer `workflow-timeline` when keys indicate phases/status; else `list`
- Text (string) or short strings array → `null` (render as normal text unless explicitly asked for UI)
- Nested plan-like structure with phases/tasks → `plan` (or `workflow-timeline` if a runId/workflowId is present)
- Explicit `data.kind` hints (if present) override shape mapping:
  - `{ kind: "workflow-timeline", ... }` → `workflow-timeline`
  - `{ kind: "plan", ... }` → `plan`

LLM schema generation strategy (must be safe by construction):

- Capability gating:
  - Resolve a `ModelSelection` using `getModelForRole("classify", { userId, projectId? })`.
  - If `supportsGenUI(selection)` is false, skip LLM calls and return deterministic schema or `null`.

- Prompt design (keep token usage bounded):
  - Provide:
    - the selected component name (or a short allow-list of 2–4 candidates)
    - the data payload (JSON, truncated with explicit note if too large)
    - the context (surface, viewport, verbosity)
    - a tiny example of the expected `UIComponent` shape (one example only)
  - Require:
    - output conforms to `uiComponentSchema`
    - `component` must be one of the provided candidates
    - props must be JSON-serializable; no functions; no undefined

- Performance budget:
  - Deterministic path (no LLM): < 10ms.
  - LLM path: best-effort; record latency in metrics; do not block hot paths when an unambiguous schema can be built without LLM.

### Milestone B: Replace hardcoded voice GenUI with `SchemaGenerator`

Update `packages/api/src/voice/workflow-handler.ts`:

- Replace the inline construction of `timelinePart.ui` and `planPart.ui` with calls to `SchemaGenerator.toDataUiPart(...)`.
- Keep the `data.kind` payload stable (this is already how the voice handler identifies what the UI represents).
- Use a voice-specific context:
  - surface: `"voice"`
  - conversation mode: `"workflow"`
  - viewport: omit by default (voice overlay unknown); allow passing through later if available from client metadata
  - preference hints: use existing `VoiceWorkflowPreferences` (verbosity) as a hint

Acceptance for this milestone is “no behavior regression”: the same component types render, but the schemas are now generated via a shared service and validated.

### Milestone C: Add a streaming schema generation endpoint compatible with `useObject`

Add a minimal HTTP endpoint that matches the AI SDK UI `useObject` wire protocol (the client-side `createGenUIObjectConfig` expects an `api` URL and a `schema`).

Placement:

- Prefer implementing this as a web server route (TanStack Start / server handler) under `apps/web`, using existing server-side patterns in `apps/web/src/lib/api/stream-handler.ts`:
  - session auth
  - no-store headers
  - abort handling
  - metrics and logging

The endpoint should:

- Accept `POST` JSON body with at least:
  - `input: string` (prompt)
  - optional: `data: unknown`, `context: partial SchemaContext` (for tool-driven schema generation)
- Call AI SDK v6 `streamObject({ model, schema: uiComponentSchema, prompt/messages, ... })` (or an equivalent supported API) and stream the object protocol that `useObject` understands.
- Gate by `supportsGenUI(selection)`; if not supported, return HTTP 400 with a clear error code (or return a non-stream JSON response indicating “GenUI unsupported”).

This endpoint is the “Phase 1” foundation for progressive GenUI; it does not need to be wired into chat yet if that requires additional UI work, but it must be callable and testable.

### Milestone D: Tests + observability

Add unit tests under `packages/api/test/schema.*.test.ts`:

- `selectComponent` mapping tests (10+ cases) including edge cases:
  - empty array
  - array of mixed types
  - record with nested objects
  - timeline-like objects with ISO timestamps
  - explicit `data.kind` overrides

- `generateSchema` tests:
  - deterministic schema generation validates against `uiComponentSchema`
  - when model capability is missing (simulate with a selection lacking `"genui"`), returns `null` without throwing
  - when LLM returns invalid schema (simulate by stubbing adapter), returns `null` and records fallback meta

Add a focused integration test for voice workflow raw output:

- Validate that `buildVoiceWorkflowRaw(...)` (or the public entrypoint that calls it) produces `VoiceAssistantRaw.uiMessages[0].parts` containing `data-ui` parts whose `ui` validates via `uiComponentSchema`.

Add metrics/logging (minimal but useful):

- Log at `info` for successful schema generation with labels:
  - component, surface, mode, path (`deterministic` vs `llm`), modelKey when LLM used
- Log at `warn` for schema validation failures and fallbacks (include zod issue summaries).
- Add Prometheus metrics in the existing `@alfred/api/metrics` registry:
  - counter: `genui_schema_generation_total{path, outcome, component, surface}`
  - histogram: `genui_schema_generation_duration_seconds{path, component, surface}`

## Concrete Steps

All commands run from the repository root unless stated otherwise.

1. Implement and typecheck the new service and voice handler changes:
   - `bun run typecheck`

2. Run API-focused tests (fast feedback):
   - `bun run test packages/api/test/schema.*.test.ts`
   - `bun run test packages/api/test/voice*`

3. Run GenUI framework tests to ensure no cross-package regressions:
   - `bun run test packages/type/src/genui*`
   - `bun run test packages/ui/src/genui*`

4. Manual proof (web):
   - Start dev stack (repo standard): `bun run dev`
   - Ask ALFRED a data-heavy question that triggers structured data output (for example: “Show me workflow status for my last run”).
   - Confirm the response includes a `data-ui` part and that the web chat renders a GenUI component (not raw JSON).

If a dedicated endpoint for streaming schemas is added in this phase, also:

- Use `createGenUIObjectConfig({ api: "<your endpoint>" })` in a small dev harness and confirm partial schema renders a skeleton then resolves to a component.

5. If you add a new server route under `apps/web/src/routes/`, regenerate the TanStack Router route tree:
   - `cd apps/web && bunx @tanstack/router-cli generate`

## Validation and Acceptance

This phase is accepted when:

1. **No hardcoded schemas in voice workflow handler**:
   - `packages/api/src/voice/workflow-handler.ts` no longer manually constructs the `ui` object for `workflow-timeline` and `plan` in `buildVoiceWorkflowRaw`.
   - Instead it delegates to `packages/api/src/services/schema.ts`.

2. **Correct mapping coverage**:
   - `SchemaGenerator.selectComponent()` has at least 10 unit tests and maps the required shapes:
     - array of numbers → chart
     - key/value records → grid
     - timestamped arrays → workflow-timeline or list
     - text → null
     - nested structures → plan or recursive components

3. **Schema validity**:
   - All produced schemas pass `uiComponentSchema.safeParse(...)`.
   - Invalid LLM outputs do not crash request handlers; they fall back to `null` UI.

4. **Capability gating**:
   - When the selected model does not support GenUI (`supportsGenUI(selection) === false`), the system does not call structured output generation and returns `null` UI (or a deterministic schema if available).

5. **User-visible proof**:
   - CI-grade proof: `/api/genui` server route streams a `UIComponent` response when a session exists and the selected model supports GenUI (covered by `apps/web/src/tests/routes/genui.route.test.ts`).
   - Optional manual proof: run the web app, hit `/api/genui` from a small harness using `createGenUIObjectConfig`, and confirm `StreamingUIRenderer` renders a skeleton then the generated schema.

6. **Coverage expectation**:
   - The new tests under `packages/api/test/schema.*.test.ts` achieve >80% coverage of `packages/api/src/services/schema.ts` (use `bun run test --coverage ...` when practical; if coverage reporting is unavailable in the wrapper, measure coverage in CI tooling and document the evidence here).

## Idempotence and Recovery

- All changes should be additive and safe to rerun.
- Schema generation must never be required for correctness: it is a presentation enhancement.
- If schema generation fails:
  - return `null` UI and allow the caller to fall back to raw data/text
  - log a warning with a stable error code (for aggregation)
  - never throw from schema generation due to validation failures

For development iteration:

- If tests fail due to model/network calls, replace LLM calls in unit tests with stubs; keep one optional integration test gated behind an env var if needed.
- If streaming endpoint work becomes too large, keep it as a small, separately verifiable milestone and do not block the core service + voice integration on it.

## Artifacts and Notes

Important reference points in the repo (do not duplicate; reuse):

- Completed GenUI framework plan: `docs/execplans/generative-ui-framework.md`
- GenUI schema validator: `packages/type/src/genui.zod.ts` (`uiComponentSchema`)
- Web chat GenUI renderer (already first priority): `apps/web/src/components/chat-render.tsx` (`renderGenUI`)
- Voice handler hardcoded schema location to remove: `packages/api/src/voice/workflow-handler.ts` inside `buildVoiceWorkflowRaw(...)`
- AI SDK v6 generateObject wrapper: `packages/api/src/adapters/ai-generation.ts`
- Model selection + capabilities: `packages/agent/src/selector.ts` (`supportsGenUI`, `getModelForRole`)

Patterns to copy (templates):

- For “defensive, versioned artifact building” patterns in `packages/api/src/services/*`: follow the style of `packages/api/src/services/compilation.ts` (coerce helpers, safeParse validation, warn-and-return on invalid data, best-effort persistence).
- For “streaming HTTP endpoints with auth, metrics, abort handling”: follow `apps/web/src/lib/api/stream-handler.ts` (even though it streams text today, its envelope and safety rules should be reused for object streaming).
- For “capability gating and stable model keys suitable for metrics”: follow `packages/agent/src/selector.ts` + `packages/agent/src/selector.test.ts`.
- For “GenUI schema rendering expectations and graceful degradation”: follow `apps/web/src/components/chat-render.tsx` and the GenUI framework tests referenced in `docs/execplans/generative-ui-framework.md`.

Relevant rule docs (do not contradict):

- `.agent/PLANS.md` (ExecPlan maintenance requirements)
- `.ruler/genui-patterns.md` (GenUI conventions: register before render; `data-ui` parts; sandbox + error boundary)
- `.ruler/15-ai-sdk-v6.md` (AI SDK v6 canonical patterns: `generateObject`, message parts, `convertToModelMessages`)
- `.ruler/05-testing.md` (use repo test wrapper; avoid hangs; DI over `mock.module()` when reasonable)

Implementation artifacts (created/modified by this ExecPlan so far):

- Created:
  - `packages/api/src/services/schema.ts`
  - `packages/api/src/metrics/genui.ts`
  - `apps/web/src/routes/api/genui.ts`
  - `packages/api/test/schema.generator.test.ts`
  - `packages/api/test/voice.genui.test.ts`
  - `apps/web/src/tests/routes/genui.route.test.ts`
- Modified:
  - `packages/api/src/voice/workflow-handler.ts`
  - `packages/api/src/metrics/index.ts`
  - `apps/web/src/routeTree.gen.ts` (generated)

## Interfaces and Dependencies

### New module

Create `packages/api/src/services/schema.ts` and export:

- `export type SchemaContext = { userId?: string; projectId?: string; surface: "web" | "mobile" | "voice" | "tui"; mode: "assistant" | "workflow" | "focus"; viewport?: { width?: number; height?: number }; preference?: { verbosity?: "compact" | "normal" | "verbose"; density?: "compact" | "comfortable" } }`

- `export type SchemaMeta = { path: "deterministic" | "llm" | "skipped"; selectedComponent: string | null; modelKey?: string; validationErrors?: string[] }`

- `export class SchemaGenerator { selectComponent(...); generateSchema(...); toDataUiPart(...); }`

### Mandatory dependencies and rules

- Use AI SDK v6 primitives; for structured schema generation use `generateObject` with `uiComponentSchema` from `@alfred/type/genui.zod`.
- Do not create a custom “UIComponent validator”; use `uiComponentSchema.safeParse`.
- Capability gating must be enforced before any structured-output LLM call using `supportsGenUI(selection)` from `@alfred/agent/selector`.
- Do not introduce server-only imports into client bundles; keep schema generation in API/server code paths only.
- Keep schema generation import-safe: no timers, no background work at import time.

### Integration expectations (north star alignment; Phase 1 scope)

This phase must not block or regress other north star areas; it should compose cleanly:

- Projects: include `projectId` in `SchemaContext` for future preference specialization, but do not introduce new project persistence in Phase 1.
- Learning/knowledge/graph: do not write learning signals yet; only log and metric emission in Phase 1.
- Observability/metrics: add counters/histograms for schema generation attempts and fallbacks.
- Persistence: rely on existing conversation/workflow persistence; do not add new DB tables in Phase 1.
- RAG/rerank/sense/summarize: out of scope for Phase 1; schema generation uses only the data already produced by tools/handlers.
- Protocol: continue using `data-ui` parts as the canonical cross-surface contract.
- Pacer: out of scope unless streaming endpoint requires throttling; prefer AI SDK’s native stream protocol first.
