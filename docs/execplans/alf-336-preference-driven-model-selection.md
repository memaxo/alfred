# ALF-336: Preference-driven model selection in API generation paths

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository includes ExecPlan requirements in `.agent/PLANS.md` at the repo root. This document must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, a signed-in user can change their active LLM model per role (chat vs orchestrator vs planner vs voice) by setting preferences like `domain.ai.model.chat` through the existing `preference.set` API, and the next AI request will immediately use the new model without restarting any server process.

“Immediately” means: after the preference write succeeds, the next `/api/assistant` or `/api/orchestrator` request (and the next tRPC `assistant.generate` / `orchestrator.generate` call) uses the updated model selection for both generation and history budgeting, as evidenced by the model key appearing in stream metadata and metrics labels.

This work targets ALFRED itself (core runtime + web API handlers), not any applications ALFRED generates.

## Progress

- [x] (2026-01-10 06:42Z) Create ExecPlan for preference-driven model selection.
- [x] (2026-01-10 06:59Z) Add write-path cache invalidation in `packages/api/src/routers/preference.ts`.
- [x] (2026-01-10 07:18Z) Wire `@alfred/agent/selector` model preferences into tRPC assistant/orchestrator generation.
- [x] (2026-01-10 07:18Z) Wire `@alfred/agent/selector` model preferences into `/api/assistant` + `/api/orchestrator` streaming (TanStack Start server handlers).
- [x] (2026-01-10 07:18Z) Wire model preferences into voice + any AI adapter paths used by voice/cognitive follow-ups.
- [x] (2026-01-10 07:18Z) Add/adjust tests across `packages/api`, `packages/agent`, and `apps/web` to prove model flips without restart.
- [ ] Validate end-to-end in the web UI by changing `domain.ai.model.chat` and observing the next message uses the new model.

## Surprises & Discoveries

- Observation: Preference loading is cached in-process (L1) and optionally in Redis (L2). Immediate flips require invalidation on write and (for multi-process deployments) Redis pubsub propagation.
  Evidence: `packages/agent/src/preference/loader.ts` exports `invalidatePreferenceCache()` which clears L1, deletes Redis L2, and publishes on `preference:invalidate`.

- Observation: The streaming endpoints that users actually hit in the browser are TanStack Start routes in `apps/web/src/routes/api/*`, not the tRPC routers in `packages/api/src/routers/*` (though those still matter for non-streaming calls and internal usage).
  Evidence: `apps/web/src/routes/api/assistant/$.ts`, `apps/web/src/routes/api/orchestrator/$.ts`, and their shared handler `apps/web/src/lib/api/stream-handler.ts`.

- Observation: The agent model selector previously threw when a user model preference was malformed (unknown provider or non-string), which could break generation; this is now treated as “no preference” to preserve safety.
  Evidence: `packages/agent/src/selector.ts` now catches parse/type errors in `readUserModelForRole()` and falls back to env defaults.

## Decision Log

- Decision: Use the existing agent model selector (`@alfred/agent/selector` → `getModelForRole`) as the single source of truth for preference-based model choice, instead of re-implementing preference parsing in API/web handlers.
  Rationale: The selector already understands `domain.ai.model.<role>` preferences, env fallbacks, and stable `modelKey` formatting (`provider/modelId`), and keeps the dependency direction `apps/* -> packages/*` intact.
  Date/Author: 2026-01-10 (Codex)

- Decision: Treat invalid model preference values as non-fatal at runtime (fall back to env defaults), and prevent invalid values from being persisted where feasible.
  Rationale: A user should not be able to “brick” their assistant by setting a malformed model preference; immediate switching must remain safe.
  Date/Author: 2026-01-10 (Codex)

- Decision: Normalize model preferences on write to canonical `provider:modelId` before persisting to the DB.
  Rationale: Removes ambiguity across legacy formats (`provider/modelId`, bare `modelId`), and ensures future reads/logs are consistent.
  Date/Author: 2026-01-10 (Codex)

## Outcomes & Retrospective

- Outcome: Model selection is now role + user preference driven across both streaming (`/api/assistant`, `/api/orchestrator`) and non-streaming (tRPC `assistant.generate`, `orchestrator.generate`) paths.
- Outcome: Preference writes (`preference.set` / `preference.delete`) invalidate L1/L2 preference caches, making model flips effective on the next request without process restart.
- Outcome: Voice assistant + cognitive follow-ups now resolve the model via `getModelForRole("voice", { userId, projectId? })` (direct call + `DefaultAIAdapter`).
- Remaining: Manual verification in the web UI (set `domain.ai.model.chat`, send next message, confirm `x-model` header and stream metadata `model` change).

## Context and Orientation

ALFRED has two main “API generation paths” where LLM calls happen:

1. **Streaming chat endpoints (web server).** The browser uses HTTP POST streaming endpoints:
   - `/api/assistant` handled by `apps/web/src/routes/api/assistant/$.ts`
   - `/api/orchestrator` handled by `apps/web/src/routes/api/orchestrator/$.ts`
   - Both call `apps/web/src/lib/api/stream-handler.ts` which:
     - authenticates via `@alfred/auth` (`auth.api.getSession`)
     - builds an optional preference system prompt via `@alfred/agent/preference/prompt`
     - prunes history via `@alfred/history/buildHistoryContext`
     - streams model output via `ai/streamText`

   Today, the stream handler uses `getModelId()` from `@alfred/agent` (env-driven) and uses agent defaults that also resolve the model without userId.

2. **tRPC non-streaming endpoints (API router).**
   - Assistant: `packages/api/src/routers/assistant.ts` (`assistant.generate`)
   - Orchestrator: `packages/api/src/routers/orchestrator.ts` (`orchestrator.generate`)
   - These call `packages/api/src/ai/messages.ts` (history selection) and `packages/api/src/ai/generate.ts` (`generateText`).

   Today, these endpoints import `@alfred/agent/agents` defaults which choose a model without a user id, so user preferences are not applied.

The model preference system already exists:

- Preferences are stored via `preference.set` (`packages/api/src/routers/preference.ts`) and read through `@alfred/agent/src/preference/loader.ts`.
- The agent model selector `packages/agent/src/selector.ts` maps roles to preference keys:
  - `domain.ai.model.chat`
  - `domain.ai.model.orchestrator`
  - `domain.ai.model.planner`
  - `domain.ai.model.background`
  - `domain.ai.model.voice`
- The selector returns:
  - `model`: an AI SDK `LanguageModel`
  - `modelKey`: a stable string `provider/modelId` used for history budgeting and metrics labels.

Important terms used in this plan:

- “Role”: The intent of the model call. In this repo it maps to `ModelRole` in `@alfred/type/model` (`chat`, `orchestrator`, `planner`, `background`, `voice`).
- “ModelKey”: The stable string key used by history + metrics, shaped like `provider/modelId` (example: `openrouter/anthropic/claude-3.5-sonnet`).
- “ModelRef”: The canonical preference/env string shaped like `provider:modelId` (example: `openrouter:anthropic/claude-3.5-sonnet`).
- “Immediate flip”: The next request uses the new model key, not the cached previous key.

## Plan of Work

### Milestone 1: Ensure preference writes invalidate caches (immediacy)

Change `packages/api/src/routers/preference.ts` so that any mutation that can change preferences calls `invalidatePreferenceCache(userId, projectId?)` after it writes to the database. This ensures the in-process (L1) cache and Redis (L2) cache do not serve stale preference values.

Edits:

- In `preference.set`, after `userRepo.setPreference(...)`, call:
  - `await invalidatePreferenceCache(session.user.id, input.projectId)`

- In `preference.delete`, after `userRepo.deletePreference(...)`, call:
  - `await invalidatePreferenceCache(session.user.id, input.projectId)`

- In `preference.updateFromFeedback`, it already calls invalidation once at the end; ensure it passes `projectId` when set.

Validation change (optional but recommended for safety):

- If `input.key` matches `domain.ai.model.<role>`, require that `input.value` is a string and that it parses as a valid model ref after coercion:
  - Accept user input in any of these formats: `provider:modelId`, `provider/modelId`, or bare `modelId` (assume OpenAI).
  - Normalize before persisting to avoid confusing UI output.

Tests:

- Update `packages/api/test/preference.router.test.ts` to assert that `invalidatePreferenceCache()` is called for:
  - `preference.set`
  - `preference.delete` (when removed > 0; still fine to call even when 0)
  - `preference.updateFromFeedback` (already asserted; ensure it covers projectId too)

### Milestone 2: Apply per-user model selection in tRPC generation

Update `packages/api/src/routers/assistant.ts` and `packages/api/src/routers/orchestrator.ts` so they choose the model via `getModelForRole(role, { userId, projectId })` at request time.

Concrete approach:

- In assistant generate mutation:
  - After verifying `ctx.session.user.id`, call:
    - `const { getModelForRole } = await import("@alfred/agent/selector");`
    - `const selection = await getModelForRole("chat", { userId: ctx.session.user.id, projectId: input.projectId });`
  - Use `selection.model` for the AI SDK `generateText` call.
  - Use `selection.modelKey` for history selection by passing it into `prepareModelMessagesForGenerate({ model: selection.modelKey, ... })`.

- In orchestrator generate mutation:
  - Same pattern, but role is `"orchestrator"`.

Acceptance for this milestone:

- A user preference change updates the model used for non-streaming tRPC calls on the next request (no restart).

Tests:

- Add or adjust unit tests in `packages/api/test/assistant.router.test.ts` and `packages/api/test/orchestrator.router.test.ts` (or add new focused tests) that:
  - mock `@alfred/agent/selector` to return a known `modelKey`
  - assert `prepareModelMessagesForGenerate` is invoked with `model` consistent with that modelKey
  - assert `generateText` is called with a model object derived from the selection (exact identity can be mocked)

### Milestone 3: Apply per-user model selection in streaming endpoints (web)

Update `apps/web/src/lib/api/stream-handler.ts` so that after authenticating the user it selects a model via `@alfred/agent/selector` and uses it consistently:

- Determine role:
  - if `errorPrefix === "assistant"`, use `role = "chat"`
  - if `errorPrefix === "orchestrator"`, use `role = "orchestrator"`

- Call:
  - `const { getModelForRole } = await import("@alfred/agent/selector");`
  - `const selection = await getModelForRole(role, { userId });`

- Use:
  - `selection.modelKey` as the `modelId` passed to `buildHistoryContext`
  - `selection.modelKey` as the `model` label recorded in metrics (`historyContextTokensTotal`, etc.)
  - `selection.model` as the `model` passed to `streamText`
  - `selection.modelKey` in stream “start” metadata (`metadata.model = selection.modelKey`) so developers can verify model choice.

Optional ergonomics:

- Add a response header like `x-model` containing `selection.modelKey` to make verification via curl/devtools trivial.
  - Keep it informational only; do not treat it as an auth signal.

Tests:

- Update existing tests under `apps/web/src/lib/api/__tests__/`:
  - Replace mocks of `@alfred/agent/getModelId` with mocks of `@alfred/agent/selector/getModelForRole`.
  - Update assertions that reference `"mock-model"` to reference `"mock-provider/mock-model"` (a realistic `modelKey`) and ensure the handler uses the selector output.
  - Add at least one test that changes the mocked selector return value between two calls to `handleStreamRequest` to prove the selected model can change without restarting any module (this simulates an immediate flip).

### Milestone 4: Voice + AI adapter paths

Voice and cognitive follow-ups in API code should also respect user model preferences:

- In `packages/api/src/voice/assistant.ts`:
  - After resolving `userId`, call `getModelForRole("voice", { userId, projectId })` and use its `model` and `modelKey` for:
    - the `generateText` call
    - the history budgeting (`buildHistoryContext` / `prepareModelMessagesForGenerate`)

- In `packages/api/src/adapters/ai-generation.ts` (`DefaultAIAdapter`):
  - Add an optional constructor `{ userId?: string; projectId?: string; role?: ModelRole }`.
  - When `userId` is present, resolve the model via `getModelForRole(role, { userId, projectId })` for both `generateText` and `generateObject`.
  - When absent, preserve current behavior (env defaults).

Acceptance:

- Changing `domain.ai.model.voice` affects the next voice request output without restart.

### Milestone 5: End-to-end manual verification

Run the web app and demonstrate preference-driven model switching:

Build/run instructions (for humans running ALFRED locally):

1. From repo root, start the dev server:
   - `bun run dev:web`

2. In the web UI, open Settings → Preferences (custom preferences section).

3. Set:
   - Key: `domain.ai.model.chat`
   - Value: `"openai:gpt-4o-mini"` (or any valid `provider:modelId`)

4. Send a message in chat. In devtools Network, inspect the `/api/assistant` response stream:
   - Verify the stream “start” metadata includes `model: "openai/gpt-4o-mini"` or the derived `modelKey` form `openai/gpt-4o-mini` (depending on what the handler emits; this plan expects `modelKey`).

5. Change the preference value to a different model (example: `"openai:gpt-4o"`), send another message, and verify the model metadata changes on the next request without restarting the server.

## Concrete Steps

These are the exact commands a contributor should run during implementation.

From the repo root:

- API unit tests (focus on preference invalidation + model selection):
  - `bun scripts/test-bun.ts packages/api/test/preference.router.test.ts`
  - `bun scripts/test-bun.ts packages/api/test/assistant.router.test.ts packages/api/test/orchestrator.router.test.ts`

- Agent selector tests (if modified for invalid preference tolerance):
  - `bun scripts/test-bun.ts packages/agent/src/selector.test.ts`

- Web stream handler tests:
  - `bun scripts/test-bun.ts apps/web/src/lib/api/__tests__/stream-handler.*.test.ts`

- Typechecks (only for touched packages):
  - `bun run --cwd packages/api typecheck`
  - `bun run --cwd packages/agent typecheck`
  - `bun run --cwd apps/web typecheck` (if a script exists; otherwise `bun run typecheck` at repo root)

## Validation and Acceptance

Acceptance criteria:

1. Writing `domain.ai.model.chat` via `preference.set` causes the _next_ `/api/assistant` request to use the new model key (no process restart).
2. Writing `domain.ai.model.orchestrator` causes the _next_ `/api/orchestrator` request to use the new model key (no restart).
3. The selected model key is visible to developers:
   - in stream “start” metadata and/or
   - in a response header (`x-model`) and/or
   - in metrics labels (where present).
4. Preference cache invalidation occurs on all preference writes, so cached values do not delay the flip.

## Idempotence and Recovery

All code changes in this plan are additive/refactor-only and safe to apply repeatedly. If a step introduces a regression, revert by:

- restoring the previous model selection behavior (env-only) in the affected handler, and
- keeping cache invalidation in place (it is safe even if model selection is not yet preference-driven).

For multi-instance deployments, ensure `REDIS_URL` is configured; otherwise cache invalidation cannot propagate between processes.

## Artifacts and Notes

Example preference values that should be accepted:

    domain.ai.model.chat = "openai:gpt-4o-mini"
    domain.ai.model.orchestrator = "openrouter:anthropic/claude-3.5-sonnet"
    domain.ai.model.planner = "cerebras:llama3.1-70b"

Example stream start metadata that should reflect the chosen modelKey:

    { createdAt: "…", model: "openrouter/anthropic/claude-3.5-sonnet", eventType: "start" }

## Interfaces and Dependencies

Required interfaces and functions (must exist and be used):

- `@alfred/agent/selector`:
  - `getModelForRole(role: ModelRole, opts: { userId: string; projectId?: string }): Promise<{ model: LanguageModel; modelKey: string }>`

- `@alfred/agent/preference/loader`:
  - `invalidatePreferenceCache(userId: string, projectId?: string): Promise<void>`

- Streaming handler:
  - `apps/web/src/lib/api/stream-handler.ts` must pass a user-specific `LanguageModel` to `ai.streamText` and must use the returned `modelKey` for history budgeting (`buildHistoryContext`).

---

Plan change notes:

- Initial creation of plan for preference-driven model selection (no implementation yet).
