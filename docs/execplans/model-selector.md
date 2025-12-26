# Model Selector System (Cerebras + OpenRouter)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan must be maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

ALFRED currently makes LLM calls from multiple places and sometimes constructs models directly in call sites. After this change, ALFRED will have one canonical “model selector” that decides which model to use for each purpose (chat, planner, background work, voice, etc.) and will construct the correct AI SDK v6 `LanguageModel` via either Cerebras or OpenRouter. A single user will be able to choose their preferred primary chat model, planner model, background model, and voice model without code changes, and ALFRED will reliably use those choices across API routers, workflow runtime streaming, and plan generation.

You can see it working after implementation by starting the app and observing:
- The assistant/orchestrator routers return `modelId` values that match your selected role models.
- A workflow run logs/metrics show the selected model id for streaming calls.
- Changing the user’s model preference changes the model used in subsequent chat/workflow runs, without deploying new code.

Provider references (non-authoritative; this plan is self-contained):
- Cerebras provider overview: https://ai-sdk.dev/providers/ai-sdk-providers/cerebras
- OpenRouter provider overview: https://ai-sdk.dev/providers/community-providers/openrouter

## Progress

- [ ] (2025-12-25) Create `@alfred/type` model-role and model-ref types + runtime schemas.
- [ ] (2025-12-25) Implement `@alfred/agent` model selector (providers + parsing + precedence).
- [ ] (2025-12-25) Migrate API LLM entrypoints (assistant/orchestrator) to selector.
- [ ] (2025-12-25) Migrate runtime streaming (workflow) to selector.
- [ ] (2025-12-25) Migrate plan-generation LLM calls to selector.
- [ ] (2025-12-25) Add persistence for user-configured model choices and a UI to edit them.
- [ ] (2025-12-25) Add tests covering normal success, escalation, and MAX_TRANSITIONS safeguards for workflows after the migration.
- [ ] (2025-12-25) Add tests for model selection precedence and provider routing.
- [ ] (2025-12-25) Update docs/env example and ensure CI prevents reintroducing direct provider usage in runtime paths.
- [ ] (2025-12-25) Fill in Outcomes & Retrospective with file/line evidence once implemented.

## Surprises & Discoveries

(Keep this section updated during implementation; add evidence snippets.)

- Observation: Cerebras context window limits may be smaller than current defaults in some tiers.
  Evidence: (add concrete failing prompt/token budget output if encountered)
- Observation: Some packages currently call `generateText/generateObject` with model construction patterns that are inconsistent with newer `@ai-sdk/gateway` usage.
  Evidence: (add grep excerpts or failing typecheck outputs)

## Decision Log

(Record decisions as they are made; initial decisions below reflect the intended design.)

- Decision: Use a canonical `ModelRef` string format `provider:modelId` (for chat models) plus an optional structured representation.
  Rationale: Keeps model switching cheap and avoids scattering provider-specific construction.
  Date/Author: 2025-12-25 / assistant

- Decision: Support both Cerebras and OpenRouter simultaneously rather than forcing a single provider.
  Rationale: Cerebras provides fast inference for specific models; OpenRouter provides “universal model access” and quick switching as the market changes.
  Date/Author: 2025-12-25 / assistant

- Decision: Define role-based model selection rather than a single global `AI_MODEL`.
  Rationale: Planner and background workloads have different latency/cost/reliability needs than interactive chat and voice.
  Date/Author: 2025-12-25 / assistant

## Outcomes & Retrospective

(To be filled after implementation. Must include evidence with file paths and line numbers.)

- Outcome:
- Evidence:
- Remaining gaps:
- Lessons learned:

## Context and Orientation

This repository is a Bun + Turborepo monorepo. ALFRED’s runtime has multiple LLM call paths:
- API (tRPC) routers perform non-stream generation for chat-like endpoints.
- Workflow runtime performs streaming generation to drive multi-step orchestration.
- The plan package performs “planner” work using object generation and prompt-based transformations.

Key locations relevant to this change:

### Existing model configuration patterns

- `packages/agent/src/v6.ts` contains env-based model id selection and provider initialization. It currently constructs a provider via `@ai-sdk/gateway` and exposes `getModelId()` and `getOpenAI()`. The naming is misleading: the returned provider is not “OpenAI-only”.
- `packages/agent/src/agents.ts` builds agent settings (`ToolLoopAgentSettings`) and uses `getOpenAI().languageModel(getModelId())` for assistant and orchestrator defaults.

### API generation entry points

- `packages/api/src/routers/assistant.ts` calls `generateText` to produce assistant output.
- `packages/api/src/routers/orchestrator.ts` calls `generateText` to produce orchestrator output.
- `packages/api/src/ai/messages.ts` prepares and budgets message history by resolving a model id.

### Runtime streaming entry points

- `packages/runtime/src/adapters/ai.ts` is a streaming adapter around AI SDK `streamText`.
- `packages/runtime/src/workflow/executor.ts` currently constructs a model using `@ai-sdk/openai` directly for workflow execution (this must be replaced).

### Plan-generation LLM usage

- `packages/plan/src/generate/phased.ts`, `packages/plan/src/evaluate/revise.ts`, `packages/plan/src/pattern/trigger.ts` call AI SDK core (`generateObject`/`generateText`) directly.

These entry points must all be unified behind a single selector so that model/provider choices are consistent and user-configurable.

## Definitions (plain language)

- “Provider” means a library module that knows how to talk to a specific model API (e.g., Cerebras API or OpenRouter API) and can construct a `LanguageModel` object used by AI SDK v6.
- “LanguageModel” (AI SDK v6) is an object the `ai` package uses to call models for `generateText`, `generateObject`, and `streamText`.
- “Model role” means the purpose of the LLM call, such as interactive chat or background summarization.
- “Model selector” means the single module that maps `(role, user preferences, environment defaults)` to a concrete `LanguageModel` and a stable `modelId` string used for metrics and budgeting.

## Design: model roles and delineation

The model selector will route LLM calls by role. Roles are chosen to match ALFRED’s real workloads and to make “switching a model for one purpose” easy without breaking others.

### Required roles

- `chat`: the user-facing assistant chat experience (streaming + tool calling).
- `orchestrator`: multi-step tool orchestration for workflows (streaming + tool calling; robustness more important than speed).
- `planner`: structured plan generation and critique/revision (object generation; correctness and structured output adherence matters most).
- `background`: non-urgent, low-cost tasks (summaries, titles, metadata extraction, quick classification).
- `voice`: voice assistant path (latency-sensitive; can be faster/cheaper than chat but must still be coherent).

### Optional roles (add only if needed)

- `coder`: code-heavy reasoning tasks where a dedicated model can outperform chat defaults.

### Why this delineation is “best”

- It matches distinct capability requirements:
  - Planner needs structured outputs and often longer reasoning.
  - Background needs cost control and can tolerate lower capability.
  - Voice needs latency control and aggressive history pruning.
- It matches distinct operational patterns:
  - Orchestrator may have higher token usage and tool-call patterns.
  - Chat should remain stable even if background changes.
- It keeps UI/UX manageable: users can understand “chat vs planner vs background vs voice” without needing to understand internal pipelines.

## Design: canonical model reference and portability

### Canonical model reference

Define a single, stable representation that can be stored in DB and env vars:

- String form (stored and transmitted): `"<provider>:<modelId>"`
  - Examples:
    - `cerebras:zai-glm-4.7`
    - `cerebras:gpt-oss-120b`
    - `cerebras:llama3.1-8b`
    - `openrouter:anthropic/claude-3.5-sonnet`
    - `openrouter:meta-llama/llama-3.1-405b-instruct`

- Structured form (in TypeScript): `{ provider: "cerebras" | "openrouter", id: string, mode?: "chat" | "completion" }`
  - For OpenRouter, default to chat mode; completion mode is an explicit opt-in if ever needed.

The selector must convert either form to a `LanguageModel` object.

### Why not hardcode “smart/fast/cheap” models

Hardcoding model ids in code is brittle because:
- provider catalogs change (models deprecated/renamed),
- “best” models change rapidly,
- deployments want different defaults without code forks.

Instead we will:
- ship recommended defaults in `config/env.example`,
- store per-user preferred models in the DB,
- treat env vars as deployment defaults.

## Design: configuration sources and precedence

The model selector must implement strict precedence. The goal is: user choices always win; env provides default; there is no hidden behavior.

Precedence for each role:
1. **User preference** in DB: if the user set a model for that role, use it.
2. **Env default** for that role: if set, use it.
3. **Role fallback**: a safe, explicit fallback for development/testing only.

We will expose and document this precedence.

### Environment variables

Introduce role-based defaults. Names are stable and descriptive; do not use multiple overlapping env vars that fight each other.

- `CEREBRAS_API_KEY`: required if any selected model uses Cerebras.
- `OPENROUTER_API_KEY`: required if any selected model uses OpenRouter.

Default models by role (deployment defaults):
- `AI_CHAT_MODEL` (string `provider:modelId`)
- `AI_ORCHESTRATOR_MODEL`
- `AI_PLANNER_MODEL`
- `AI_BACKGROUND_MODEL`
- `AI_VOICE_MODEL`
- Optional: `AI_CODER_MODEL`

Optional fallback for planner robustness:
- `AI_PLANNER_FALLBACK_MODEL` (same canonical format). This is an explicit “fallback chain” only for planner outputs when structured output fails.

Compatibility (temporary):
- If `AI_MODEL` exists, treat it as the default for `AI_CHAT_MODEL` only, but log a warning and document deprecation.

### Persistence

Persist role selections for the single user. The plan intentionally does not assume the storage layer; instead it gives two viable repository-native options and selects one:

Option A (preferred if existing preference infra fits): store role models via the preference system in `packages/agent/src/preference/*`. This keeps “user config” consolidated and avoids new DB tables.

Option B: add a dedicated DB table for model settings. Use this if preferences are not intended for operational configuration or if preference loading is too expensive/unreliable at runtime.

This plan will implement Option A first, but if code review reveals the preference system cannot load reliably early in server startup, switch to Option B and record that decision in the Decision Log.

## Design: provider construction (Cerebras + OpenRouter)

### Cerebras provider

The Cerebras AI SDK provider constructs models by id. The selector must create a provider instance and then use `.languageModel(modelId)` (or the default function call form) to produce a `LanguageModel`.

This plan will treat Cerebras models as chat-capable models and will use the model ids exactly as configured (e.g., `zai-glm-4.6`, `zai-glm-4.7`, `gpt-oss-120b`, `llama3.1-8b`). The selector will not attempt to validate “model exists” at startup unless a required role model is missing; runtime errors will be handled at call sites with clear classification.

### OpenRouter provider

OpenRouter provides a single gateway key for many models. The selector must create an instance via `createOpenRouter({ apiKey })` and then use `openrouter.chat(modelId)` for chat-capable models. The selector will default to chat mode unless the canonical model ref explicitly encodes completion mode.

Because OpenRouter model ids include provider prefixes (e.g., `anthropic/claude-3.5-sonnet`), the selector must not attempt to “normalize” them. It must treat the right side as an opaque string.

## Design: history budgeting and context windows

ALFRED already has history budgeting logic that needs a model id string (for context window selection). After this change:
- The selector must expose a stable `modelKey` string for budgeting and metrics, such as `cerebras:zai-glm-4.7`.
- The budgeting system must be updated to accept these ids and must not default to `openai/*`.
- We must maintain an override mapping so deployments can set context windows without changing code. Existing patterns include `HISTORY_MODEL_CONTEXT` in `config/env.example`.

Plan requirements:
- Extend model metadata mapping to include commonly used Cerebras and OpenRouter ids.
- Keep a safe default context window (conservative) if unknown.
- Ensure “voice” role is allowed to prune aggressively for latency.

## Plan of Work

This section is prescriptive. It names the files, the interfaces, and the behavior that must exist.

### Milestone 1: Introduce shared types for model selection (`@alfred/type`)

Goal: define cross-layer types and runtime validation schemas so API, agent, runtime, and UI all speak the same language.

Work:
- Add a new file in `packages/type/src/` defining:
  - `ModelProvider = "cerebras" | "openrouter"`
  - `ModelRole = "chat" | "orchestrator" | "planner" | "background" | "voice" | "coder"`
  - `ModelRef = { provider: ModelProvider; id: string; mode?: "chat" | "completion" }`
  - `ModelRefString = string` with a parser/validator
  - `ModelConfig = Record<ModelRole, ModelRefString>` for stored settings
- Add Zod schemas:
  - `modelRoleSchema`
  - `modelRefSchema`
  - `modelRefStringSchema` (validates `provider:modelId` and provider is known)
- Export types and schemas from `packages/type/src/index.ts` or appropriate subpath exports.

Result:
- All other packages can import `ModelRole` and a `parseModelRef()` helper without needing to guess string formats.

Proof:
- Typecheck passes for packages importing these types.
- A unit test in `packages/type` validates parsing edge cases:
  - empty string rejects
  - missing colon rejects
  - unknown provider rejects
  - `openrouter:anthropic/claude-3.5-sonnet` accepts

### Milestone 2: Implement the canonical model selector (`@alfred/agent`)

Goal: one module constructs provider instances and returns `LanguageModel` + `modelKey` for any role, using precedence rules.

Work:
- Add a single module in `packages/agent/src/` (single-word name) that exports:
  - `getModelForRole(role: ModelRole, userId?: string): Promise<{ model: LanguageModel; modelKey: string }>`
  - `getModelKeyForRole(role: ModelRole, userId?: string): Promise<string>`
  - `resolveModelRefForRole(role, userId?)` returning the chosen `ModelRefString` and source (`user` | `env` | `fallback`)
- Provider instantiation:
  - Initialize Cerebras provider using `CEREBRAS_API_KEY` when needed.
  - Initialize OpenRouter provider using `OPENROUTER_API_KEY` when needed.
  - Cache provider instances at module scope to avoid repeated initialization.
- Env mapping:
  - Read `AI_CHAT_MODEL`, `AI_PLANNER_MODEL`, etc.
  - Provide `config/env.example` recommended defaults but do not hardcode them here.
- User preference:
  - Load model preferences via the preference system if possible; otherwise use a dedicated repo function to fetch settings. This must be async and safe in SSR.

Result:
- All other code can ask for “role model” and does not know providers.

Proof:
- Unit tests in `packages/agent`:
  - precedence test: DB value overrides env
  - env fallback test: if no DB, uses env
  - error test: requesting OpenRouter model with missing `OPENROUTER_API_KEY` throws a clear error code string (e.g., `openrouter_api_key_missing`)
  - parsing test: correctly routes to cerebras/openrouter

### Milestone 3: Migrate API router generation to use selector

Goal: assistant/orchestrator API endpoints use role-selected models and report correct model ids to the client.

Work:
- Update `packages/api/src/routers/assistant.ts`:
  - Replace any dependence on `getAssistantAgentDefaults().model` as the model source.
  - Use selector role `chat` for assistant generation.
- Update `packages/api/src/routers/orchestrator.ts`:
  - Use selector role `orchestrator` for orchestrator generation.
- Update `packages/api/src/ai/messages.ts`:
  - Ensure `resolveModelId(...)` can work with the new `modelKey` strings and does not default to `openai/gpt-4o-mini`.
  - Prefer passing the selector-provided `modelKey` explicitly into budgeting rather than trying to infer it from the `LanguageModel` object.
- Ensure `getConfig` endpoints return the correct selected model id.

Result:
- API generation uses role models; model ids reflect user selection.

Proof:
- API router tests updated/added to assert `modelId` returned matches configured defaults.

### Milestone 4: Migrate runtime workflow streaming to use selector

Goal: workflow runtime streaming uses the selector’s `orchestrator` model and does not instantiate providers directly.

Work:
- Replace `@ai-sdk/openai` usage in:
  - `packages/runtime/src/workflow/executor.ts`
  - `packages/agent/src/workflow/services.ts`
- Ensure runtime passes the chosen `LanguageModel` from selector into `packages/runtime/src/adapters/ai.ts` (which already accepts `LanguageModel`).
- Ensure metrics labels in runtime streaming reflect `modelKey` from selector.

Result:
- No runtime `openai(...)` construction.
- Streaming continues to work.

Proof:
- Workflow integration tests still pass; add a test that asserts selected model id is recorded in events/metrics (mock metrics if needed).

### Milestone 5: Migrate plan package LLM calls to use selector

Goal: plan generation and revisions use role `planner` (and optionally `background` for cheap tasks like titling).

Work:
- Update `packages/plan/src/generate/phased.ts` to request the planner model from selector.
- Update `packages/plan/src/evaluate/revise.ts` similarly.
- Update `packages/plan/src/pattern/trigger.ts` to use background model if desired, otherwise planner; record decision.

Result:
- Plan package does not construct providers itself.

Proof:
- Existing plan tests updated; ensure failure modes show clear errors.

### Milestone 6: User-facing configuration and persistence

Goal: user can choose models per role.

Work:
- Add UI in web settings:
  - A settings panel showing roles with a text input for canonical `provider:modelId` strings.
  - “Test model” button (optional) that runs a short `generateText` call and returns success/failure.
- Add API endpoints (tRPC) to get/set model prefs.
- Persist choices via preference system or new DB table; ensure it’s scoped to the single user.

Result:
- User can change role model without redeploy.

Proof:
- Manual test: change chat model, refresh, new chat uses new model id.

### Milestone 7: Hardening, tests, and safeguards

Goal: prevent regression and ensure workflow runtime remains safe.

Work:
- Add tests that cover (must be explicit):
  - normal success path in workflow orchestration
  - escalation path (assistant → orchestrator or similar)
  - MAX_TRANSITIONS safeguard (ensures loops don’t become infinite)
- Add a CI check (or reuse existing build verification scripts) to fail if forbidden provider imports appear in runtime codepaths:
  - disallow `@ai-sdk/openai` imports in `packages/runtime/**` and in new selector call paths (docs/tests can be exempted).

Result:
- Tests and CI enforce the new architecture.

Proof:
- CI job runs and fails on intentionally reintroducing `@ai-sdk/openai`.

## Concrete Steps

These are the commands and expected outcomes that a contributor should run while implementing. Use Bun and repo scripts.

1. Install dependencies (repo root):

    bun install

2. Typecheck the monorepo (repo root):

    bun run typecheck

   Expect: no TypeScript errors.

3. Run relevant tests:
- API tests:

    bun test packages/api

- Runtime tests:

    bun test packages/runtime

- Plan tests:

    bun test packages/plan

   Expect: all passing; new tests fail before implementation and pass after.

4. Manual smoke:
- Start web app and exercise assistant chat and a workflow run.
- Confirm logs/metrics show `modelKey` values like `cerebras:zai-glm-4.7` or `openrouter:...`.

## Validation and Acceptance

Acceptance is behavior-based.

- After setting `AI_CHAT_MODEL` to `cerebras:zai-glm-4.7`, a request to assistant generate uses Cerebras GLM 4.7 and reports `modelId` including `cerebras:zai-glm-4.7`.
- After setting `AI_PLANNER_MODEL` to `openrouter:anthropic/claude-3.5-sonnet`, plan generation uses OpenRouter and reports the correct model id.
- After setting user preferences in the UI, subsequent calls use user preference values over env defaults.
- Workflow streaming still works and does not import or instantiate `@ai-sdk/openai` in runtime codepaths.
- Tests include coverage for workflow success, escalation, and MAX_TRANSITIONS safeguard.

## Idempotence and Recovery

- All configuration steps are idempotent: changing env vars or DB preferences does not corrupt state.
- If a selected provider key is missing, the system should fail with a clear error (and never silently fall back to a different provider).
- If a model id is invalid, the error should be actionable and include the role and model ref that failed.

## Interfaces and Dependencies

### New/changed dependencies

- Add `@ai-sdk/cerebras` for Cerebras provider integration.
- Add `@openrouter/ai-sdk-provider` for OpenRouter provider integration.

### Selector interface (must exist)

In `packages/agent/src/<singleword>.ts` (exact filename to be chosen by implementer but must be single-word), implement:

    export async function getModelForRole(
      role: ModelRole,
      opts?: { userId?: string }
    ): Promise<{ model: LanguageModel; modelKey: string }>

    export async function resolveModelRefForRole(
      role: ModelRole,
      opts?: { userId?: string }
    ): Promise<{ modelRef: ModelRefString; source: "user" | "env" | "fallback" }>

### Model roles (must exist)

In `packages/type/src/<singleword>.ts`, implement:

    export type ModelRole = "chat" | "orchestrator" | "planner" | "background" | "voice" | "coder"

and parsers/validators for `provider:modelId`.

## Artifacts and Notes

Recommended defaults for `config/env.example` (to be written during implementation):

- AI_CHAT_MODEL=cerebras:zai-glm-4.7
- AI_ORCHESTRATOR_MODEL=cerebras:zai-glm-4.7
- AI_PLANNER_MODEL=cerebras:zai-glm-4.7
- AI_BACKGROUND_MODEL=cerebras:llama3.1-8b
- AI_VOICE_MODEL=cerebras:gpt-oss-120b

These are only defaults. The core goal is that the user can change them freely and persist their choices.

---

(When revising this plan during implementation, add a short note here stating what changed and why.)