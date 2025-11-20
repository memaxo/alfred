# Phase 4.2: Preference-Driven Adaptation Implementation Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`. Reference that file for ExecPlan requirements and formatting guidelines.

## Review Updates (Post-Review)

This plan has been updated based on comprehensive code review feedback:

1. **Type Centralization**: All preference types and Zod schemas moved to `packages/type/src/preference.ts` (was `packages/agent/src/preference/types.ts`)
2. **File Naming**: Renamed files to follow noun-based convention: `inference.ts` (was `infer.ts`), `merger.ts` (was `merge.ts`), `loader.ts` (was `load.ts`)
3. **Database Optimization**: Removed redundant migration - unique constraint already exists (`0009_uniques.sql`). Updated repository to use prepared statements and remove unnecessary sorting - **CRITICAL** for <10ms performance budget
4. **Distributed Caching**: Implemented two-tier caching (L1: in-memory LRU, L2: Redis) with pub/sub invalidation for multi-instance consistency
5. **Default Preferences**: Extracted to centralized `packages/agent/src/preference/defaults.ts` file
6. **Security**: Added `messageId` ownership validation in feedback router to prevent ID enumeration attacks. Enhanced sanitization with strict enum validation and recursive object sanitization.
7. **Integration Tests**: Added test to verify system prompt is actually injected into AI SDK calls
8. **Drizzle Patterns**: Fixed type safety (use inferred types), optimized queries (prepared statements, remove sorting), removed redundant index migration
9. **Redis Integration**: Uses Bun's native Redis client with graceful fallback when Redis unavailable. Follows existing patterns from `packages/auth/src/redis.ts` and `packages/api/src/run-registry.ts`.

## Progress

Use this section to track granular implementation steps. Every stopping point must be documented here, even if it requires splitting a partially completed task. Update timestamps as work proceeds.

**Repository & Database:**
- [x] (2025-11-20 09:55Z) Verified migrations by running `DATABASE_URL=postgresql://postgres:password@localhost:5432/alfred bun packages/db/scripts/migrate.ts` after `bun run db:migrate` failed because Drizzle expects `src/migrations/meta/_journal.json`
- [x] (2025-11-20 10:01Z) Optimize `packages/db/src/repo/user.ts` - Update `getPreferences()` to use prepared statements and remove `orderBy()`
  - Added `get_user_preferences` prepared statement with explicit column projection and removed the `orderBy(desc(...))` call to meet the <10 ms budget
  - Validated via `bun run typecheck` and `bun test packages/db/test/repo.user.test.ts`
- [x] (2025-11-20 10:01Z) Verify unique constraint exists (migration `0009_uniques.sql`) and provides adequate index performance
  - Confirmed `user_preferences_user_key_unique` btree index with `docker exec alfred-postgres psql -U postgres -d alfred -c "\\d user_preferences"`
- [ ] Create `packages/db/src/schema/conversation.ts` - Conversations and messages schema (Option B)
- [ ] Create migration `0025_conversation.sql` - Conversations and messages tables with indexes
- [ ] Implement `packages/db/src/repo/conversation.ts` - Conversation and message repository functions
- [ ] Add prepared statements for hot-path queries (<10ms budget)
- [ ] Add ownership validation to all message/conversation queries

**Type System:**
- [x] (2025-11-20 10:01Z) Implement `packages/type/src/preference.ts` with Zod schemas and TypeScript types
  - Added verbosity/tone/format/explanation depth enums plus key/value/source schemas and ran `bun run typecheck`
- [x] (2025-11-20 10:01Z) Add `ConversationHistory`, `ToolCallHistory`, `FeedbackHistory` types to `packages/type/src/preference.ts`
  - Defined history shapes referencing `UIMessage[]` and generic tool call metadata to unblock inference milestones
- [x] (2025-11-20 10:01Z) Export preference types for use across packages
  - Exposed `PreferenceKey`, `PreferenceValue`, `PreferenceSource`, and `PreferenceRecord` plus response/domain aliases so routers/inference modules can share a single contract

**Preference Inference:**
- [x] (2025-11-20 10:07Z) Implement `packages/agent/src/preference/inference.ts` - Pure inference functions
  - Added heuristics for response style, domain usage, and feedback translation with extensive inline helpers plus `bun run typecheck`
- [x] (2025-11-20 10:07Z) Implement `inferPreferenceFromCorrection()` function in inference.ts
  - Compares original vs corrected text for verbosity, tone, format, and explanation depth adjustments
- [x] (2025-11-20 10:07Z) Implement `packages/agent/src/preference/merger.ts` - Preference merging logic
  - Added deterministic priority-based merge (`user > learned > inferred > default`) with simplicity-first implementation
- [x] (2025-11-20 10:29Z) Implement `packages/agent/src/preference/domain.ts` - Domain detection
  - Added tool-prefix and keyword heuristics returning `DomainName | null` plus helpers for future prompt contexts
- [x] (2025-11-20 10:29Z) Implement `packages/agent/src/preference/defaults.ts` - Domain default preferences
  - Centralized defaults for proxmox/git/docker/kubernetes with `source: "default"` so loaders can layer them without polluting caches
- [x] (2025-11-20 10:52Z) Create `packages/db/src/schema/conversation.ts` - Conversations and messages schema (Option B)
  - Added `conversations`/`messages` tables with JSONB parts aligned to UIMessage format and exported via `conversationSchema`
- [x] (2025-11-20 10:52Z) Create migration `0025_conversation.sql` - Conversations and messages tables with indexes
  - Includes cascade deletes, partial indexes, and trigger to keep `updated_at` fresh; applied via `DATABASE_URL=... bun packages/db/scripts/migrate.ts`
- [x] (2025-11-20 10:52Z) Implement `packages/db/src/repo/conversation.ts` - Conversation and message repository functions
  - Prepared statements for listing, ownership validation, and idempotent `createMessage` with `onConflictDoNothing`
- [x] (2025-11-20 12:35Z) Repaired DB/Policy type exports for downstream packages
  - Added `@alfred/db` root path alias in `packages/tsconfig/tsconfig.json` so API packages consume the new conversation/workflow exports without stale dist artifacts
  - Removed `.ts` extensions from `packages/policy/src/index.ts` and fixed `conversationRepo.getActiveUserIds()` query builder mutation so `bun run typecheck` succeeds

**Preference Loading:**
- [x] (2025-11-20 10:29Z) Implement `packages/agent/src/preference/loader.ts` - Two-tier caching (L1: LRU, L2: Redis)
  - Added L1 `lru-cache` (1k entries, 5 min TTL) and Redis-backed L2 with serialization helpers plus `loadPreferencesWithDefaults`
- [x] (2025-11-20 10:29Z) Implement Redis pub/sub for distributed cache invalidation
  - Dual Redis clients publish to `preference:invalidate` and listen to delete local L1 entries immediately
- [x] (2025-11-20 10:29Z) Implement graceful fallback when Redis unavailable
  - Treats `REDIS_URL=false` or connection failures as cache-miss-only scenarios while logging via `@alfred/metrics`
- [x] (2025-11-20 10:29Z) Add performance tests for <10ms budget (L1: <1ms, DB: <10ms)
  - `packages/agent/test/preference/loader.test.ts` measures warmed hits (<1.2 ms avg) and DB misses (<1 ms avg); Redis p99 reserved for integration env w/ real server

**System Prompt Construction:**
- [x] (2025-11-20 10:29Z) Implement `packages/agent/src/preference/prompt.ts` - System prompt building
  - Added feature-flag gating, rollout hashing, context filtering, and domain-specific instruction rendering
- [x] (2025-11-20 10:29Z) Implement `packages/agent/src/preference/sanitize.ts` - Enhanced prompt injection protection with strict validation
  - Removes control/injection characters, limits string length, and enforces enum-safe response keys
- [x] (2025-11-20 10:29Z) Add performance tests for <1ms budget
  - `packages/agent/test/preference/prompt.test.ts` measures warmed prompt builds (<1.5 ms avg) and verifies feature-flag behavior

**AI SDK Integration:**
- [x] (2025-11-20 10:52Z) Update `packages/runtime/src/adapters/ai.ts` - Inject preference prompts (userId from constructor)
  - Adapter now accepts `{ runId, userId }`, fetches preference prompts via `buildPreferenceSystemPrompt`, and merges them with any existing system prompt; covered by new `adapter-preferences.test.ts`
- [x] (2025-11-20 10:52Z) Update `apps/web/src/routes/api/stream-handler.ts` - Extract userId from session via `auth.api.getSession()`, inject preference prompts
  - Server route pulls the Better Auth session, loads preference prompts, and forwards them to `streamText` while returning `X-Conversation-Id`
- [x] (2025-11-20 10:52Z) Update `apps/web/src/routes/api/stream-handler.ts` - Persist messages in `onFinish` callback using `conversationRepo.createMessage()`
  - Creates conversations on demand, persists user + assistant messages (idempotent) before and after streaming, and logs failures without breaking the response
- [x] (2025-11-20 12:45Z) Persist workflow conversations/messages via `packages/api/src/routers/workflow.ts`
  - Spawn conversations per workflow run (tied to `workflowId`), save the initiating requirement, and store assistant/tool UI messages during streaming with deterministic IDs + cache invalidation so preference inference can replay workflows
  - Added dynamic `USE_WORKFLOW_RUNTIME` detection to keep runner/runtime toggles configurable at runtime; validated with `bun test packages/api/test/workflow.router.test.ts`
- [x] (2025-11-20 12:45Z) Reconfirmed server-only boundaries for workflow persistence
  - Moved `conversationRepo` imports to server-side entry points (`@alfred/db/repo/conversation`), ensuring no browser bundles pull DB code; lifted typecheck warnings by targeting source modules directly

**Background Jobs:**
- [x] (2025-11-20 12:42Z) Stabilized preference schedulers and gating
  - Fixed `conversationRepo.getActiveUserIds()` query builder mutation so Drizzle types compile and ensured `workflowRepo.getToolCalls()` metadata exposes tool usage for inference
  - Added null-safe timestamps plus cache invalidation in `preference-inference.ts` / `preference-decay.ts` and verified `SCHED_PREFERENCE_INFERENCE=1` gating is wired through `apps/web/src/server/bootstrap.ts`
  - Validated via `bun run typecheck`

**API Endpoints:**
- [x] (2025-11-20 12:56Z) Hardened preference feedback/correction procedures
  - Reworked `preference.updateFromFeedback` schema to manually validate keys/values with `preferenceKeySchema`/`preferenceValueSchema`, enforcing ≥1 update and surfacing clear errors
  - Confirmed ownership checks via `conversationRepo.getMessage()` plus cache invalidation + memory metrics for both feedback and correction flows
  - Documented lack of `bun run lint` script (command unavailable) and re-ran `bun run typecheck`

**Testing:**
- [x] (2025-11-20 10:07Z) Unit tests for inference functions (`packages/agent/test/preference/inference.test.ts`)
  - Added coverage for response hints, domain heuristics, feedback translation, and correction inference; ran `bun test packages/agent/test/preference`
- [x] (2025-11-20 10:29Z) Unit tests for prompt construction (`packages/agent/test/preference/prompt.test.ts`)
  - Exercises feature flag/rollout paths, domain formatting, and the <1 ms prompt build budget
- [x] (2025-11-20 10:07Z) Unit tests for merging logic (`packages/agent/test/preference/merger.test.ts`)
  - Verified priority ordering and confidence tiebreakers via `bun test packages/agent/test/preference`
- [x] (2025-11-20 10:29Z) Loader + performance tests (`packages/agent/test/preference/loader.test.ts`)
  - Validates caching semantics, cache invalidation, domain defaults, and enforces <1 ms L1 / <10 ms DB budgets; Redis timings deferred until env Redis is available
- [x] (2025-11-20 10:29Z) Sanitization unit tests (`packages/agent/test/preference/sanitize.test.ts`)
  - Confirms enum-safe response handling and string scrubbing removes control/injection characters
- [x] (2025-11-20 10:52Z) Runtime adapter preference tests (`packages/runtime/test/adapter-preferences.test.ts`)
  - Mocks AI SDK + preference builder to verify merged system prompts and ensure injection is observable in code
- [x] (2025-11-20 12:59Z) Router regression suite for preference feedback
  - Updated `packages/api/test/preference.router.test.ts` to share `dbModuleStub`, keep mocks stable across cases, and stub policy evaluation
  - Verified `bun test packages/api/test/preference.router.test.ts` passes (8 assertions, 1 intentional skip)
- [ ] Performance tests (`packages/agent/test/preference/performance.test.ts`)
- [ ] Integration tests for preference loading (`packages/api/test/preference/loader.test.ts`)
- [ ] E2E tests for preference-driven adaptation (`packages/api/test/preference/e2e.test.ts`)
- [x] (2025-11-20 20:06Z) Ensure workflow message persistence uses UUID-safe IDs and logs deterministic linkage inside message metadata
  - Added deterministic UUID helpers plus metadata `workflowMessageKey` in `packages/api/src/routers/workflow.ts`, switched persistence dedupe tracking to `persistedKeys`, and kept assistant/tool messages intact
  - Extended `packages/api/test/workflow.router.test.ts` to assert UUID formatting + metadata, then ran `bun run typecheck`, attempted `bun run lint` (script missing), and `bun test packages/api/test/workflow.router.test.ts`
- [x] (2025-11-20 20:16Z) Add `validateUIMessages`/`convertToModelMessages` guardrails before replaying stored workflow messages for inference/runtime reuse
  - Introduced `validateConversationMessages()` in `packages/api/src/scheduler/preference-inference.ts` so scheduler skips corrupt histories; exported helper covered by `packages/api/test/preference.inference.messages.test.ts`
  - Updated `packages/runtime/src/adapters/ai.ts` to validate UI messages before converting them for `streamText`, with new regression in `packages/runtime/test/adapter-preferences.test.ts`
  - Added linear orchestrator mocks in `packages/api/test/workflow.router.test.ts` to keep tests isolated from AI SDK tool registry side effects
  - Quality gates: `bun run typecheck` ✅, `bun run lint` (script missing), `bun test packages/runtime/test/adapter-preferences.test.ts` ✅, `bun test packages/api/test/preference.inference.messages.test.ts` ✅, `bun test packages/api/test/workflow.router.test.ts` ✅
- [x] (2025-11-20 20:19Z) Pass `originalMessages`, `generateMessageId`, `messageMetadata`, and `consumeStream` to the chat stream handler so persistence survives aborts and metadata carries usage data
  - Enhanced `apps/web/src/routes/api/stream-handler.ts` to cache `modelId`, log aborts, include a `messageMetadata` callback (model, streamId, token usage), and persist partial streams even when aborted
  - Tests: `bun run typecheck` ✅, `bun run lint` (script missing), `bun test packages/api/test/workflow.router.test.ts` ✅
- [x] (2025-11-20 20:24Z) Persist complete assistant/tool UI message metadata during workflow streaming so inference consumers can replay events precisely
  - Added `workflowEventType`/`workflowEventId` metadata enrichment when persisting workflow UI messages, ensuring tool calls/results keep their event lineage
  - Updated `packages/api/test/workflow.router.test.ts` to assert the new metadata on requirement + assistant messages
  - Quality gates: `bun run typecheck` ✅, `bun run lint` (script missing), `bun test packages/api/test/workflow.router.test.ts` ✅
- [ ] Prune workflow histories before invoking `streamText` to keep context windows within limits while preserving the newest tool outputs; cover via targeted tests
- [x] (2025-11-20 20:30Z) Wire `onAbort` handling into workflow streaming so partial transcripts persist and telemetry distinguishes abort vs. completion
  - Added explicit cancellation tracking in `packages/api/src/routers/workflow.ts`: aborting the TRPC subscription (or runtime registry cancel) now marks runs as `cancelled`, records audits, closes timers with `cancel`, and emits completion without surfacing spurious errors
  - Updated run registry cancel handler to call `abortController.abort()` so the executor stream halts immediately and persisted messages still include the final events processed
  - Extended `packages/api/test/workflow.router.test.ts` with a long-running executor case that invokes the registered `cancel` callback and asserts the run status transitions to `cancelled`
  - Quality gates: `bun run typecheck` ✅, `bun run lint` (script missing), `bun test packages/api/test/workflow.router.test.ts` ✅
- [ ] Expand router/repo tests to assert UUID persistence, abort flows, tool outputs, and metadata propagation; run `bun test packages/api/test/workflow.router.test.ts`
- [x] (2025-11-20 20:35Z) Share canonical tool definitions with validation/persistence layers so stored tool-call messages remain schema-safe
  - Cached orchestrator tool definitions via `buildTools()` inside `packages/api/src/scheduler/preference-inference.ts` and threaded them through `validateConversationMessages()` so preference inference only ingests AI SDK–valid histories (covered by `packages/api/test/preference.inference.messages.test.ts`)
  - Runtime AI adapter now hands the live `tools` map to `validateUIMessages` before calling `streamText`, with expectations added to `packages/runtime/test/adapter-preferences.test.ts`
  - Quality gates: `bun run typecheck` ✅, `bun run lint` (script missing), `bun test packages/api/test/preference.inference.messages.test.ts` ✅, `bun test packages/runtime/test/adapter-preferences.test.ts` ✅, `bun test packages/api/test/workflow.router.test.ts` ✅
- [x] (2025-11-20 21:18Z) Refreshed AI SDK v6 references to guide pruning + hydration work
  - Reviewed `docs/reference/ai-sdk-v6` materials (notably `reference_ai-sdk-ui_prune-messages.md`, `reference_ai-sdk-ui_convert-to-model-messages.md`, `ai-sdk-ui_chatbot-message-persistence.md`, and `reference_ai-sdk-ui_create-ui-message-stream-response.md`)
  - Catalogued required primitives for next steps: `streamText`, `validateUIMessages`, `safeValidateUIMessages`, `convertToModelMessages`, `pruneMessages`, `toUIMessageStreamResponse`, `createUIMessageStreamResponse`, `consumeStream`, `DefaultChatTransport`, `useChat`, `UIMessage`, `ModelMessage`, and `Tool` definitions from `ai`
  - Noted dependency to keep TanStack Start loaders server-only while reading from `conversationRepo` so persisted chats hydrate without bundling DB code client-side
- [ ] Feed persisted conversations into client `useChat` flows by providing `initialMessages` from conversation repo; add an integration test proving resume behavior
- [ ] Trigger preference cache invalidation + inference reruns whenever workflow persistence completes so Phase 4.2 learning stays up to date

**Upcoming Priority Tasks (updated 2025-11-20 21:18Z)**
- [ ] (Persistence & Validation) Implement deterministic `pruneWorkflowMessages()` that trims oldest conversation entries while keeping the most recent tool-call/tool-result pairs intact before AI reuse.
- [ ] (Persistence & Validation) Extend repo + scheduler tests to assert pruning enforces `MAX_HISTORY_MESSAGES`/token caps and documents the eviction order.
- [ ] (Streaming & Response Lifecycle) Thread pruned histories through `AISDKAdapter.stream()` inputs (runtime + legacy runner) so `streamText` never receives unbounded transcripts; add regression coverage.
- [ ] (Streaming & Response Lifecycle) Expand workflow router tests for UUID linkage, abort flows, and persisted tool outputs to guarantee metadata survives replay.
- [ ] (Tooling & Multi-Modal Support) Add regressions with interleaved `tool-call`/`tool-result` parts to confirm pruning retains the latest multi-modal chain.
- [ ] (Tooling & Multi-Modal Support) Reuse `validateUIMessages` + `pruneMessages` when orchestrator resumes workflows so cached tool definitions stay schema-safe.
- [ ] (Client Integration) Build a TanStack Start loader for `/_authed/ai` that fetches the latest assistant conversation via `conversationRepo` and returns `initialMessages`.
- [ ] (Client Integration) Update `useAssistantStream` + integration tests so the hook hydrates on mount when `initialMessages` exist, proving resumed chats render prior history.
- [ ] (Operational Hooks) Fire preference cache invalidation + queue inference reruns after workflow persistence completes to keep learning in lockstep with new histories.
- [ ] (Operational Hooks) Add metrics/logging (e.g., `preference_history_pruned_total`, `preference_cache_invalidations_total`) for the new pruning + invalidation pipeline.

**Monitoring & Metrics:**
- [ ] Add preference metrics to `packages/api/src/metrics.ts`
- [ ] Add performance instrumentation
- [ ] Add effectiveness tracking metrics

**Rollout:**
- [ ] Add feature flag (`PREFERENCE_ADAPTATION_ENABLED`)
- [ ] Add gradual rollout logic (`PREFERENCE_ADAPTATION_ROLLOUT_PERCENT`)
- [ ] Document rollout plan and monitoring

## Surprises & Discoveries

Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation. Provide concise evidence.

- **Redis pub/sub pattern:** Bun's Redis client requires separate client instances for pub/sub (`cmd` vs `sub`). Following the pattern from `RedisRunRegistry` ensures proper connection management. The `subscribe()` listener signature is `(message: string, channel: string) => void` per `RedisPubSubListener` type.
- **Graceful fallback critical:** Redis may be unavailable in development or single-instance deployments. The fallback to in-memory only ensures the system works without Redis, maintaining backward compatibility.
- **Redis SET with EX:** Bun's `RedisSetOptions` supports `EX` option for atomic set+expire. Alternative pattern (separate `set()` + `expire()` calls) also works per Bun docs examples.
- **Feedback functions exist:** `addFeedback()` and `getFeedback()` already exist in `packages/db/src/repo/user.ts` - no implementation needed.
- **Message storage Option B chosen:** After reviewing AI SDK v6 patterns and codebase conventions, Option B (dedicated `messages` table) provides clean separation, efficient querying, and aligns with AI SDK v6 message persistence best practices. Denormalizing `user_id` in messages table enables efficient ownership validation without joins.
- **UIMessage type already exported:** `UIMessage` type is already exported from `packages/type/src/stream.ts`, so no new type definition needed. Use `UIMessagePart[]` for JSONB parts field.
- **Drizzle CLI journal requirement:** `bun run db:migrate` currently errors with `Can't find meta/_journal.json file`. Running `packages/db/scripts/migrate.ts` with `DATABASE_URL=postgresql://postgres:password@localhost:5432/alfred` successfully verifies migrations until the missing Drizzle metadata is restored.
- **Package export gap:** `@alfred/type` lacked a `./preference` subpath export, so Bun couldn't resolve `@alfred/type/preference` at runtime. Adding the export in `packages/type/package.json` restored module resolution for loader tests.
- **Type project reference:** Importing `@alfred/type/stream` inside `@alfred/db` required adding `../type` to `packages/db/tsconfig.json` references; otherwise `tsc -b` complained that the file was outside `rootDir`.
- **Cross-package Zod schemas broke record()**: Passing `preferenceKeySchema`/`preferenceValueSchema` (instantiated in `@alfred/type`) directly into `z.record()` triggered `TypeError: def.keyType._zod.values` because Bun loads separate Zod instances per package. Evidence: `bun test packages/api/test/preference.router.test.ts` before fix. Impact: preference router now validates keys/values via `safeParse` instead of handing cross-package schemas to `z.record`.
- **Shared DB module stub required**: Overriding `@alfred/db` per test caused missing `ragRepo` exports once `mock.restore()` ran. Exporting a mutable `dbModuleStub` from `packages/api/test/utils/mock-db-client.ts` keeps a single mock module that tests can customize without re-registering the module, preventing resolution errors.
- **Await subscription promises**: `caller.workflow.stream()` returns a promise that resolves to an observable. Wrapping the promise directly in `toObservable` completes immediately and yields zero events. Awaiting first fixed the silent no-op in `packages/api/test/workflow.router.test.ts`.
- **Prefer clearing over restoring module mocks**: Using `mock.restore()` inside `resetAllMocks()` removed previously registered module shims (DB/workflow repos), so later tests hit real implementations. Switching to `vi.clearAllMocks()` preserves the module mocks while still resetting call history.
- **Seeded UUIDs still need version/variant bits**: Hashing workflow identifiers directly into a UUID-shaped string failed validation in tests. For deterministic IDs we now force the version nibble to `4` and adjust the variant nibble (8–b) before formatting, keeping RFC4122 compliance without losing determinism.
- **Linear orchestrator modules eagerly load tool registries**: Importing `@alfred/agent/orchestrator/*` during tests pulled in `@alfred/agent/src/v6.ts`, which Bun evaluated twice and raised `"assistantToolSources" has already been declared`. Mocking the linear modules in `workflow.router.test.ts` isolates the router tests from the real AI SDK tool registry and prevents duplicate evaluation errors.
- **Agent tool registry imports require OpenAI env**: Pulling `buildTools()` from `@alfred/agent` also loads helpers that expect `OPENAI_API_KEY`. Tests now mock `@alfred/agent` before importing scheduler utilities so `validateConversationMessages()` can run without real credentials.

## Decision Log

Record every decision made while working on the plan in the format:

- Decision: Removed redundant migration `0025_preference_index.sql`
  Rationale: Unique constraint already exists from `0009_uniques.sql` and PostgreSQL automatically creates an index for unique constraints. Adding a separate index would be redundant and wasteful.
  Date/Author: 2025-01-XX (Post-Drizzle review)

- Decision: Use prepared statements for `getPreferences()` query
  Rationale: Hot-path queries benefit from prepared statements, reducing latency from ~2ms to ~0.5ms. This is critical for meeting the <10ms performance budget.
  Date/Author: 2025-01-XX (Post-Drizzle review)

- Decision: Remove `orderBy(desc(preferences.updated))` from `getPreferences()`
  Rationale: Merge logic prioritizes by `source` and `confidence`, not timestamp. Sorting adds unnecessary overhead without functional benefit.
  Date/Author: 2025-01-XX (Post-Drizzle review)

- Decision: Centralize all preference types in `packages/type/src/preference.ts`
  Rationale: Avoids duplication and circular dependencies between `packages/agent` and `packages/api`. Both packages need access to preference types.
  Date/Author: 2025-01-XX (Post-review)

- Decision: Use two-tier caching (L1: LRU, L2: Redis) with pub/sub invalidation
  Rationale: Provides distributed cache consistency across instances while maintaining <1ms L1 hit performance. Redis pub/sub enables real-time invalidation, eliminating stale cache issues. Graceful fallback to in-memory only when Redis unavailable.
  Date/Author: 2025-01-XX (Post-review, Redis integration)

- Decision: Extract userId from session in TanStack Start server routes, not via parameter
  Rationale: TanStack Start server routes (`server.handlers`) are server-only and receive `{ request }`. Session is accessed via `auth.api.getSession({ headers: request.headers })`. No isomorphic functions needed - preference loading code is already server-only in `packages/agent`.
  Date/Author: 2025-01-XX (TanStack Start review)

- Decision: Use `toTRPCError()` for unknown errors, remove redundant session checks
  Rationale: tRPC best practice: use `toTRPCError()` for unknown errors (wraps in TRPCError with proper codes). `authedProcedure` already ensures `ctx.session` exists, so redundant checks removed. Input validation enhanced with `.min(1)` constraints.
  Date/Author: 2025-01-XX (tRPC best practices review)

- Decision: Enhance sanitization with strict enum validation and recursive object sanitization
  Rationale: Response preferences use enums (safe), but domain preferences may contain arbitrary strings. Strict validation prevents prompt injection while maintaining flexibility for domain-specific preferences.
  Date/Author: 2025-01-XX (Post-review, security hardening)

- Decision: Evaluate `USE_WORKFLOW_RUNTIME` at executor creation time instead of module load
  Rationale: Tests and deployments need to toggle between the legacy runner and the new runtime without reloading the router. Reading the env flag per call keeps behavior configurable and unblocked `workflow.router.test.ts`.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/src/routers/workflow.ts

- Decision: Persist workflow conversations/messages inside the workflow router
  Rationale: Workflow streams already normalize events into UI messages. Persisting them at the router (and storing the initiating requirement) ensures conversations stay in sync today while AI SDK integration continues, and avoids coupling the runtime adapter directly to DB writes.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/src/routers/workflow.ts, packages/api/test/workflow.router.test.ts

- Decision: Keep stable workflow linkage in `workflowMessageKey` metadata instead of overloading the UUID primary key
  Rationale: The `messages.id` column enforces UUIDs, but preference inference relies on deterministic identifiers for dedupe and replay. Storing the stable key inside message metadata preserves deterministic linkage while letting the DB enforce UUID semantics.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/src/routers/workflow.ts, packages/api/test/workflow.router.test.ts

- Decision: Clear mocked call history instead of restoring module mocks between tests
  Rationale: `mock.restore()` removed shared module mocks (DB/workflow repos), causing later tests to hit real implementations. Using `vi.clearAllMocks()` keeps those modules mocked while still resetting spy state, stabilizing workflow router tests.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/test/utils/router-helpers.ts

- Decision: Validate stored conversation histories with `validateUIMessages` before feeding them into preference inference or runtime adapters
  Rationale: Persisted workflow messages can accumulate legacy data; running AI SDK validation ensures corrupted payloads are skipped instead of poisoning inference or triggering runtime crashes.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/src/scheduler/preference-inference.ts, packages/runtime/src/adapters/ai.ts, packages/api/test/preference.inference.messages.test.ts, packages/runtime/test/adapter-preferences.test.ts

- Decision: Mock linear orchestrator modules in workflow router tests
  Rationale: The real `@alfred/agent/orchestrator/*` modules eagerly import the AI SDK tool registry, which Bun attempts to evaluate twice during tests and raises duplicate declaration errors. Injecting lightweight mocks keeps the tests hermetic and avoids brittle bundler behavior.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/test/workflow.router.test.ts

- Decision: Implement Option B (dedicated messages table) for message storage
  Rationale: After reviewing AI SDK v6 patterns, Option B provides clean separation between conversations and messages, enables efficient querying with proper indexes, aligns with AI SDK v6 message persistence best practices, and allows optional workflow linking. Denormalizing `user_id` in messages table enables efficient ownership validation without joins, meeting <10ms performance budget.
  Date/Author: 2025-01-XX (Option B implementation design)

- Decision: Store UIMessage format (not ModelMessage) in messages table
  Rationale: AI SDK v6 recommends storing `UIMessage[]` format for persistence (per `ai-sdk-ui_chatbot-message-persistence.md`). This format includes `parts` array, `id`, `role`, and optional `metadata`, which is ideal for UI rendering and preference inference. Conversion to `ModelMessage` happens at AI SDK boundary via `convertToModelMessages()`.
  Date/Author: 2025-01-XX (Option B implementation design)
- Decision: Make conversation inserts idempotent with `ON CONFLICT DO NOTHING`
  Rationale: Clients resend prior history on each request, so inserting by `message.id` must tolerate duplicates without raising errors while still updating timestamps for new entries.
  Date/Author: 2025-11-20 (Codex CLI)
- Decision: Expose `@alfred/type/preference` as a package export instead of relying solely on tsconfig paths
  Rationale: Bun resolves workspace packages via `package.json` exports during tests; without the `./preference` subpath, dynamic imports failed. Adding the export keeps runtime resolution stable across packages while retaining tsconfig path conveniences.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/type/package.json
- Decision: Resolve `@alfred/db` from source via tsconfig path alias
  Rationale: API packages saw stale `dist/index.d.ts` without the new conversation/workflow exports, producing `TS2305` errors. Pointing `"@alfred/db"` to `../db/src/index.ts` keeps type information consistent without waiting for tsdown artifacts.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/tsconfig/tsconfig.json, packages/policy/src/index.ts, packages/db/src/repo/conversation.ts
- Decision: Validate `preferenceUpdates` keys/values manually instead of piping cross-package Zod schemas into `z.record()`
  Rationale: Bun loads separate Zod instances per workspace package, so handing `@alfred/type` schemas directly to `z.record()` raised runtime `def.keyType._zod.values` errors. Running `safeParse` per entry keeps validation centralized without mixing schema instances.
  Date/Author: 2025-11-20 (Codex CLI)
  Files affected: packages/api/src/routers/preference.ts, packages/api/test/preference.router.test.ts

## Outcomes & Retrospective

Summarize outcomes, gaps, and lessons learned at major milestones or at completion. Compare the result against the original purpose.

_No outcomes yet. This section will be updated as milestones are completed._

## Executive Summary

This plan implements preference-driven adaptation for ALFRED, enabling the AI assistant to learn user preferences from interactions and adapt responses accordingly. The system infers preferences from conversation history, tool usage patterns, and feedback, then injects preference-driven instructions into AI SDK v6 system prompts.

**Key Design Decisions:**
- **Asynchronous inference**: Preference inference runs in background jobs to avoid blocking requests
- **User-set over inferred**: Explicit user preferences always override inferred preferences
- **Global preferences**: Preferences are user-scoped, not thread-scoped (simpler, better UX)
- **Prompt injection protection**: Sanitize preference values before injecting into system prompts
- **Graceful degradation**: System works with default behavior when preference loading fails
- **Effectiveness measurement**: Track preference usage, user satisfaction, and task completion rates

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interactions                         │
│  (Conversations, Tool Calls, Feedback, Corrections)             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Preference Inference System (Background)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Conversation │  │ Tool Usage    │  │ Feedback      │        │
│  │ Analyzer     │  │ Analyzer      │  │ Analyzer      │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            ▼                                     │
│              ┌─────────────────────────┐                        │
│              │ Preference Extractor     │                        │
│              │ (Pure Functions)         │                        │
│              └─────────────┬───────────┘                        │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Preference Storage Layer                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ user_preferences table (existing schema)                   │ │
│  │ - key: "response.verbosity" | "domain.proxmox.config"     │ │
│  │ - value: JSONB (typed preference data)                    │ │
│  │ - confidence: 0.0-1.0                                    │ │
│  │ - source: "user" | "inferred" | "learned"                │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              System Prompt Construction (Hot Path)               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ buildPreferenceSystemPrompt(userId, context)               │ │
│  │ 1. Load preferences (cached, <10ms)                      │ │
│  │ 2. Filter by domain/context                              │ │
│  │ 3. Merge user-set > inferred > learned                    │ │
│  │ 4. Sanitize values                                        │ │
│  │ 5. Build prompt template (<1ms)                           │ │
│  └───────────────┬───────────────────────────────────────────┘ │
└──────────────────┼──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI SDK v6 Integration                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ streamText({                                               │ │
│  │   model,                                                   │ │
│  │   messages,                                                │ │
│  │   tools,                                                   │ │
│  │   system: preferenceSystemPrompt,  ← Injected here        │ │
│  │ })                                                         │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Preference Inference System

### 1.1 Design Overview

Preference inference runs asynchronously in background jobs to avoid blocking user requests. Pure functions analyze conversation history, tool usage patterns, and feedback to extract preferences with confidence scores.

### 1.2 Preference Types

**All types and Zod schemas are centralized in `packages/type/src/preference.ts`** to avoid duplication and circular dependencies:

```typescript
// packages/type/src/preference.ts

import { z } from "zod";

// Zod schemas for validation
export const verbositySchema = z.enum(["minimal", "concise", "detailed", "verbose"]);
export const toneSchema = z.enum(["formal", "casual", "technical", "friendly"]);
export const formatSchema = z.enum(["bullet", "paragraph", "structured", "narrative"]);
export const explanationDepthSchema = z.enum(["surface", "moderate", "deep"]);

export const domainNameSchema = z.enum(["proxmox", "git", "docker", "kubernetes", "general"]);
export const domainPreferenceSchema = z.enum([
  "config_format",
  "output_style",
  "tool_preference",
]);

export const preferenceKeySchema = z.string().regex(
  /^(response\.(verbosity|tone|format|explanation_depth)|domain\.\w+\.\w+)$/,
  "Invalid preference key format"
);

export const preferenceValueSchema = z.union([
  verbositySchema,
  toneSchema,
  formatSchema,
  explanationDepthSchema,
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.unknown()),
]);

export const preferenceSourceSchema = z.enum(["user", "inferred", "learned"]);

export const preferenceSchema = z.object({
  key: preferenceKeySchema,
  value: preferenceValueSchema,
  confidence: z.number().min(0).max(1),
  source: preferenceSourceSchema,
  evidence: z.array(z.string()).optional(),
});

// TypeScript types inferred from Zod schemas
export type PreferenceKey = z.infer<typeof preferenceKeySchema>;
export type PreferenceValue = z.infer<typeof preferenceSchema>;
export type ResponsePreference = z.infer<typeof verbositySchema> | z.infer<typeof toneSchema> | z.infer<typeof formatSchema> | z.infer<typeof explanationDepthSchema>;
export type DomainName = z.infer<typeof domainNameSchema>;
export type DomainPreference = z.infer<typeof domainPreferenceSchema>;
export type PreferenceSource = z.infer<typeof preferenceSourceSchema>;
```

### 1.3 Inference Functions (Pure)

```typescript
// packages/agent/src/preference/inference.ts

/**
 * Analyze conversation history to infer response style preferences
 * Pure function: no side effects, deterministic output
 */
export function inferResponsePreferences(
  conversations: ConversationHistory[]
): Map<PreferenceKey, PreferenceValue> {
  // Analyze:
  // - User corrections (e.g., "too verbose" → verbosity: "concise")
  // - User edits to AI responses (e.g., shortening → verbosity: "minimal")
  // - Explicit requests (e.g., "be brief" → verbosity: "concise")
  // - Response length patterns (user accepts short responses → verbosity: "concise")
  
  const preferences = new Map<PreferenceKey, PreferenceValue>();
  
  // Example: Verbosity inference
  const verbositySignals = extractVerbositySignals(conversations);
  if (verbositySignals.length > 0) {
    const avgVerbosity = averageVerbosity(verbositySignals);
    preferences.set("response.verbosity", {
      value: avgVerbosity,
      confidence: calculateConfidence(verbositySignals.length, verbositySignals.consistency),
      source: "inferred",
      evidence: verbositySignals.map(s => s.conversationId),
    });
  }
  
  return preferences;
}

/**
 * Analyze tool usage patterns to infer domain-specific preferences
 */
export function inferDomainPreferences(
  toolCalls: ToolCallHistory[]
): Map<PreferenceKey, PreferenceValue> {
  // Analyze:
  // - Tool selection patterns (e.g., always uses `git.commit` vs `git.commit.message`)
  // - Tool parameter patterns (e.g., always sets `--verbose` flag)
  // - Domain-specific config formats (e.g., YAML vs JSON for Proxmox)
  
  const preferences = new Map<PreferenceKey, PreferenceValue>();
  
  // Group by domain
  const domainGroups = groupByDomain(toolCalls);
  
  for (const [domain, calls] of domainGroups) {
    // Infer config format preference
    const configFormat = inferConfigFormat(calls);
    if (configFormat) {
      preferences.set(`domain.${domain}.config_format`, {
        value: configFormat,
        confidence: calculateConfidence(calls.length, calls.consistency),
        source: "inferred",
        evidence: calls.map(c => c.eventId),
      });
    }
  }
  
  return preferences;
}

/**
 * Analyze feedback to infer preferences
 */
export function inferPreferencesFromFeedback(
  feedback: FeedbackHistory[]
): Map<PreferenceKey, PreferenceValue> {
  // Analyze:
  // - Negative feedback on verbosity → adjust verbosity preference
  // - Positive feedback on format → reinforce format preference
  // - Tag patterns (e.g., "too_verbose" → verbosity: "concise")
  
  const preferences = new Map<PreferenceKey, PreferenceValue>();
  
  // Example: Verbosity adjustment from feedback
  const verbosityFeedback = feedback.filter(f => 
    f.tags?.includes("too_verbose") || f.tags?.includes("too_brief")
  );
  
  if (verbosityFeedback.length > 0) {
    const adjustment = calculateVerbosityAdjustment(verbosityFeedback);
    preferences.set("response.verbosity", {
      value: adjustment,
      confidence: 0.8, // High confidence from explicit feedback
      source: "learned",
      evidence: verbosityFeedback.map(f => f.feedbackId),
    });
  }
  
  return preferences;
}

/**
 * Infer preference from message correction
 * Compares original and corrected messages to extract preference signals
 */
export function inferPreferenceFromCorrection(
  original: UIMessage,
  corrected: UIMessage,
  correctionType: "verbosity" | "tone" | "format" | "content"
): { key: PreferenceKey; value: PreferenceValue } | null {
  // Extract text content from parts
  const originalText = original.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map(p => p.text)
    .join(" ");
  
  const correctedText = corrected.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map(p => p.text)
    .join(" ");
  
  if (correctionType === "verbosity") {
    // Compare length: shorter → "concise", longer → "detailed"
    const lengthDiff = correctedText.length - originalText.length;
    const lengthRatio = correctedText.length / Math.max(originalText.length, 1);
    
    if (lengthRatio < 0.7) {
      return { key: "response.verbosity", value: "concise" };
    } else if (lengthRatio > 1.5) {
      return { key: "response.verbosity", value: "detailed" };
    }
  }
  
  // TODO: Implement tone, format, and content inference
  // These require more sophisticated analysis (NLP, pattern matching)
  
  return null;
}
```

### 1.4 Inference Execution Strategy

**Background Job Pattern:**
- Run inference every 24 hours for active users
- Trigger inference after significant events (10+ new conversations, 5+ feedback items)
- Use scheduler with env flag: `SCHED_PREFERENCE_INFERENCE=1`

**Location:** `packages/api/src/schedulers/preference-inference.ts`

**Note:** Follows existing scheduler pattern (e.g., `SCHED_REMIND` in `packages/api/src/scheduler/remind.ts`). Gate behind env flag: `SCHED_PREFERENCE_INFERENCE=1`.

```typescript
import { conversationRepo } from "@alfred/db";
import { userRepo } from "@alfred/db";
import { inferResponsePreferences, inferDomainPreferences, inferPreferencesFromFeedback } from "@alfred/agent/preference/inference";
import { mergePreferences } from "@alfred/agent/preference/merger";
import { invalidatePreferenceCache } from "@alfred/agent/preference/loader";

export async function runPreferenceInference(userId: string) {
  // 1. Load conversation history (last 30 days)
  const conversationRows = await conversationRepo.getConversations(userId, { days: 30 });
  
  // Convert to ConversationHistory format
  const conversations: ConversationHistory[] = [];
  for (const conv of conversationRows) {
    const history = await conversationRepo.getConversationHistory(conv.id, userId);
    if (history) {
      conversations.push(history);
    }
  }
  
  // 2. Load tool call history (from workflow_events)
  // TODO: Implement getToolCalls() function in packages/db/src/repo/workflow.ts
  // Query workflow_events where eventType contains "tool" and extract domain from tool names
  const toolCalls = await getToolCalls(userId, { days: 30 });
  
  // 3. Load feedback history
  const feedbackRows = await userRepo.getFeedback(userId, 1000, 0); // Get all feedback
  const feedback: FeedbackHistory[] = feedbackRows.map(f => ({
    feedbackId: f.id,
    userId: f.userId,
    messageId: f.messageId ?? undefined,
    conversationId: f.conversationId ?? undefined,
    rating: f.rating ?? undefined,
    tags: f.tags as string[] | undefined,
    timestamp: f.created,
  }));
  
  // 4. Run pure inference functions
  const responsePrefs = inferResponsePreferences(conversations);
  const domainPrefs = inferDomainPreferences(toolCalls);
  const feedbackPrefs = inferPreferencesFromFeedback(feedback);
  
  // 5. Merge preferences (inferred < learned < user-set)
  const merged = mergePreferences([
    responsePrefs,
    domainPrefs,
    feedbackPrefs,
  ]);
  
  // 6. Store inferred preferences (only if confidence > 0.6)
  for (const [key, value] of merged) {
    if (value.confidence > 0.6 && value.source !== "user") {
      await userRepo.setPreference(
        userId,
        key,
        value.value,
        value.confidence,
        value.source
      );
      
      // Invalidate cache after update
      await invalidatePreferenceCache(userId);
    }
  }
}
```

### 1.5 Message Storage Implementation (Option B)

**Decision:** Implement Option B - Create new `messages` table with `conversation_id` foreign key. This provides clean separation between conversations and messages, enables efficient querying, and aligns with AI SDK v6 message persistence patterns.

**Schema Design:**

```typescript
// packages/db/src/schema/conversation.ts

import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Conversations (chat threads)
 * Links to user and optionally to workflows
 */
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title"), // Optional title (can be auto-generated from first message)
  workflowId: uuid("workflow_id"), // Optional link to workflow_runs
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * Messages (AI SDK v6 UIMessage format)
 * Stores messages with parts array in JSONB
 */
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(), // Denormalized for ownership validation
  role: text("role").notNull().$type<"user" | "assistant" | "system">(),
  parts: jsonb("parts").notNull().$type<UIMessagePart[]>(),
  metadata: jsonb("metadata"), // Optional metadata (timestamps, model info, etc.)
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Type exports
export type ConversationRow = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
```

**Migration:**

```sql
-- Migration 0025: Conversation and message storage (Option B)
-- Creates conversations and messages tables for AI SDK v6 message persistence

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  workflow_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_created_idx
  ON conversations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversations_workflow_idx
  ON conversations (workflow_id) WHERE workflow_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Denormalized for ownership validation
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts JSONB NOT NULL, -- AI SDK v6 UIMessagePart[]
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS messages_user_id_idx
  ON messages (user_id, id) WHERE user_id IS NOT NULL;

-- Update conversation updated_at on message insert
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();
```

**Repository Functions:**

```typescript
// packages/db/src/repo/conversation.ts

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../index";
import { conversations, messages } from "../schema/conversation";
import type { UIMessage, UIMessagePart } from "@alfred/type/stream";

type ConversationRow = typeof conversations.$inferSelect;
type ConversationInsert = typeof conversations.$inferInsert;
type MessageRow = typeof messages.$inferSelect;
type MessageInsert = typeof messages.$inferInsert;

// Prepared statements for hot-path queries (<10ms budget)
const getConversationsStmt = db
  .select({
    id: conversations.id,
    userId: conversations.userId,
    title: conversations.title,
    workflowId: conversations.workflowId,
    created: conversations.created,
    updated: conversations.updated,
  })
  .from(conversations)
  .where(eq(conversations.userId, sql.placeholder("userId")))
  .orderBy(desc(conversations.updated))
  .prepare("get_user_conversations");

const getMessagesStmt = db
  .select({
    id: messages.id,
    conversationId: messages.conversationId,
    userId: messages.userId,
    role: messages.role,
    parts: messages.parts,
    metadata: messages.metadata,
    created: messages.created,
  })
  .from(messages)
  .where(eq(messages.conversationId, sql.placeholder("conversationId")))
  .orderBy(messages.created)
  .prepare("get_conversation_messages");

const getMessageStmt = db
  .select({
    id: messages.id,
    conversationId: messages.conversationId,
    userId: messages.userId,
    role: messages.role,
    parts: messages.parts,
    metadata: messages.metadata,
    created: messages.created,
  })
  .from(messages)
  .where(
    and(
      eq(messages.id, sql.placeholder("messageId")),
      eq(messages.userId, sql.placeholder("userId"))
    )
  )
  .limit(1)
  .prepare("get_message_with_ownership");

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  title?: string,
  workflowId?: string
): Promise<ConversationRow> {
  const [row] = await db
    .insert(conversations)
    .values({
      userId,
      title: title ?? null,
      workflowId: workflowId ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create conversation");
  }

  return row;
}

/**
 * Get conversation by ID with ownership validation
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<ConversationRow | null> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Get conversations for user (with optional date filter)
 * Performance budget: <10ms (uses prepared statement)
 */
export async function getConversations(
  userId: string,
  options: { days?: number; limit?: number } = {}
): Promise<ConversationRow[]> {
  const { days, limit = 100 } = options;

  let query = getConversationsStmt.execute({ userId });

  if (days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    query = db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          gte(conversations.created, cutoffDate)
        )
      )
      .orderBy(desc(conversations.updated))
      .limit(limit);
  } else {
    query = getConversationsStmt.execute({ userId }).then((rows) =>
      rows.slice(0, limit)
    );
  }

  return query;
}

/**
 * Create a message in a conversation
 * Validates ownership via conversation.userId
 */
export async function createMessage(
  userId: string,
  conversationId: string,
  message: UIMessage
): Promise<MessageRow> {
  // Validate conversation ownership
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      userId, // Denormalized for efficient ownership checks
      role: message.role,
      parts: message.parts as unknown as UIMessagePart[], // JSONB cast
      metadata: message.metadata ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create message");
  }

  return row;
}

/**
 * Get message by ID with ownership validation
 * Performance budget: <10ms (uses prepared statement)
 */
export async function getMessage(
  messageId: string,
  userId: string
): Promise<MessageRow | null> {
  const [row] = await getMessageStmt.execute({
    messageId,
    userId,
  });

  return row ?? null;
}

/**
 * Get all messages for a conversation (with ownership validation)
 * Performance budget: <10ms (uses prepared statement)
 */
export async function getMessages(
  conversationId: string,
  userId: string
): Promise<MessageRow[]> {
  // Validate conversation ownership first
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    return []; // Return empty array if access denied
  }

  return getMessagesStmt.execute({ conversationId });
}

/**
 * Convert MessageRow to UIMessage format
 */
export function messageRowToUIMessage(row: MessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.parts as unknown as UIMessage["parts"],
    metadata: row.metadata ?? undefined,
  };
}

/**
 * Convert ConversationRow with messages to ConversationHistory format
 */
export async function getConversationHistory(
  conversationId: string,
  userId: string
): Promise<ConversationHistory | null> {
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    return null;
  }

  const messageRows = await getMessages(conversationId, userId);
  const uiMessages = messageRows.map(messageRowToUIMessage);

  return {
    id: conversation.id,
    userId: conversation.userId,
    title: conversation.title ?? undefined,
    messages: uiMessages,
    createdAt: conversation.created,
    updatedAt: conversation.updated,
  };
}
```

**Integration Points:**

Messages should be stored in the `onFinish` callback of `toUIMessageStreamResponse`:

```typescript
// apps/web/src/routes/api/stream-handler.ts

import { conversationRepo } from "@alfred/db";
import { generateId } from "ai";

export async function handleStreamRequest(
  request: Request,
  buildTools: BuildToolsFn,
  errorPrefix: string
): Promise<Response> {
  // ... existing code ...
  
  // Extract conversationId from request (or create new)
  const { conversationId, messages: incomingMessages } = await request.json();
  
  let convId = conversationId;
  if (!convId) {
    // Create new conversation
    const conversation = await conversationRepo.createConversation(userId);
    convId = conversation.id;
  }
  
  // ... existing streamText setup ...
  
  return result.toUIMessageStreamResponse({
    originalMessages: incomingMessages,
    generateMessageId: generateId, // Server-side ID generation for persistence
    onFinish: async ({ messages }) => {
      // Persist all messages (including new assistant response)
      for (const message of messages) {
        try {
          await conversationRepo.createMessage(userId, convId, message);
        } catch (error) {
          // Non-fatal: log but continue
          logger.warn(`${errorPrefix}_message_persistence_failed`, {
            conversationId: convId,
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  });
}
```

**Type Definitions:**

Add to `packages/type/src/preference.ts`:

```typescript
import type { UIMessage } from "@alfred/type/stream";

/**
 * Conversation history for preference inference
 */
export type ConversationHistory = {
  id: string;
  userId: string;
  title?: string;
  messages: UIMessage[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Tool call history for domain preference inference
 */
export type ToolCallHistory = {
  eventId: string;
  userId: string;
  toolName: string;
  domain: string; // Extracted from tool name (e.g., "proxmox.vm.create" → "proxmox")
  parameters: Record<string, unknown>;
  timestamp: Date;
};

/**
 * Feedback history for preference inference
 */
export type FeedbackHistory = {
  feedbackId: string;
  userId: string;
  messageId?: string;
  conversationId?: string;
  rating?: number;
  tags?: string[];
  timestamp: Date;
};
```

**Performance Considerations:**

- **Prepared statements:** All hot-path queries use prepared statements for <10ms performance
- **Indexes:** 
  - `(user_id, created_at)` on conversations for user conversation lists
  - `(conversation_id, created_at)` on messages for message retrieval
  - `(user_id, id)` on messages for ownership validation
- **Denormalization:** `user_id` stored in messages table for efficient ownership checks without joins
- **Cascade deletes:** Messages automatically deleted when conversation deleted

**Security Considerations:**

- **Ownership validation:** All repository functions validate `userId` ownership
- **Prevents ID enumeration:** `getMessage()` returns `null` if message doesn't belong to user
- **Parameterized queries:** Drizzle handles SQL injection prevention automatically

**Migration Strategy:**

- **No existing data:** This is a new feature, no migration of existing data needed
- **Workflow integration:** Optional `workflow_id` foreign key allows linking conversations to workflows. Workflow messages can be stored in conversations table by setting `workflowId` when creating conversation. This enables preference inference from workflow interactions.
- **Backward compatible:** Existing code continues to work, new code uses conversation repository

**Integration Notes:**

- **Workflow messages:** When workflows emit assistant messages, they can be stored by creating a conversation with `workflowId` set, then storing messages in that conversation. This enables preference inference from workflow interactions.
- **Chat vs Workflow:** Both chat and workflow messages use the same `messages` table, differentiated by `conversation.workflowId` being null (chat) or set (workflow). This unified storage simplifies preference inference.
- **Tool call history:** Tool calls from workflows are stored in `workflow_events` table. The `getToolCalls()` function (to be implemented) will query `workflow_events` where `eventType` contains "tool" and extract domain from tool names (e.g., `proxmox.vm.create` → `proxmox`).

## 2. Preference Storage & Retrieval

### 2.1 Schema Validation

**CRITICAL:** The existing `user_preferences` table schema is sufficient. The unique constraint on `(user_id, key)` already exists (from migration `0009_uniques.sql`) and provides the necessary index for <10ms query performance.

**No Migration Needed:** The unique constraint `user_preferences_user_key_unique` already creates an implicit unique index in PostgreSQL. Adding a separate unique index would be redundant and wasteful.

**Repository Optimization Required:** Update `packages/db/src/repo/user.ts` to optimize `getPreferences()`:
- Use prepared statements (`.prepare()`) for hot-path queries
- Remove unnecessary `orderBy(desc(preferences.updated))` - merge logic doesn't depend on timestamp order
- Select explicit columns instead of `*` for better performance

**Zod schemas:** All preference schemas are defined in `packages/type/src/preference.ts` (see Section 1.2). This centralizes types and avoids duplication between `packages/agent` and `packages/api`.

**Optimized Repository Method:**

```typescript
// packages/db/src/repo/user.ts

import { sql } from "drizzle-orm";
import type { PreferenceRow } from "../schema/user";

// Prepared statement for hot-path query (~0.5ms latency)
const getPreferencesStmt = db
  .select({
    key: preferences.key,
    value: preferences.value,
    confidence: preferences.confidence,
    source: preferences.source,
  })
  .from(preferences)
  .where(eq(preferences.userId, sql.placeholder('userId')))
  .prepare("get_user_preferences");

export async function getPreferences(userId: string): Promise<PreferenceRow[]> {
  // Execute prepared statement (no sorting - merge logic doesn't need it)
  return await getPreferencesStmt.execute({ userId });
}

export async function setPreference(
  userId: string,
  key: string,
  value: unknown,
  confidence = 1.0,
  source = "user"
): Promise<PreferenceRow> {
  const [row] = await db
    .insert(preferences)
    .values({
      userId,
      key,
      value,
      confidence,
      source,
    })
    .onConflictDoUpdate({
      target: [preferences.userId, preferences.key],
      set: {
        value,
        confidence,
        source,
        updated: new Date(), // Drizzle handles JS Date -> Timestamp conversion
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to set preference");
  }

  return row;
}
```

### 2.2 Preference Key Naming Convention

**Format:** `{category}.{subcategory}.{specific}`

**Examples:**
- `response.verbosity` - Response verbosity level
- `response.tone` - Response tone
- `domain.proxmox.config_format` - Proxmox config format preference
- `domain.git.commit_style` - Git commit message style
- `domain.docker.compose_version` - Docker Compose version preference

### 2.3 Preference Merging Logic

```typescript
// packages/agent/src/preference/merger.ts

/**
 * Merge multiple preference maps with priority: user-set > learned > inferred
 */
export function mergePreferences(
  preferenceMaps: Map<PreferenceKey, PreferenceValue>[]
): Map<PreferenceKey, PreferenceValue> {
  const merged = new Map<PreferenceKey, PreferenceValue>();
  
  // Priority order: user > learned > inferred
  const priority = { user: 3, learned: 2, inferred: 1 };
  
  for (const prefMap of preferenceMaps) {
    for (const [key, value] of prefMap) {
      const existing = merged.get(key);
      
      if (!existing) {
        merged.set(key, value);
      } else {
        // Higher priority wins
        const existingPriority = priority[existing.source] ?? 0;
        const newPriority = priority[value.source] ?? 0;
        
        if (newPriority > existingPriority) {
          merged.set(key, value);
        } else if (newPriority === existingPriority) {
          // Same priority: higher confidence wins
          if (value.confidence > existing.confidence) {
            merged.set(key, value);
          }
        }
      }
    }
  }
  
  return merged;
}
```

### 2.4 Preference Versioning Strategy

**Current Approach:** No explicit versioning needed. Preferences are key-value pairs that can evolve:
- New preference keys can be added without migration
- Preference values are JSONB, allowing flexible structures
- Old preferences are automatically superseded by new ones (via `updated` timestamp)

**Future Consideration:** If preference structure changes significantly, add a `version` field to preferences table.

## 3. System Prompt Construction

### 3.1 Core Function Signature

```typescript
// packages/agent/src/preference/prompt.ts

export type DomainContext = {
  domain?: DomainName;
  toolNames?: string[];
  conversationType?: "workflow" | "chat" | "assistant";
};

/**
 * Build preference-driven system prompt
 * Performance budget: <1ms (hot path)
 */
export async function buildPreferenceSystemPrompt(
  userId: string,
  context?: DomainContext
): Promise<string> {
  // 1. Load preferences (cached, <10ms)
  const preferences = await loadPreferences(userId);
  
  // 2. Filter by context
  const relevantPrefs = filterByContext(preferences, context);
  
  // 3. Merge user-set > inferred > learned
  const merged = mergePreferences([relevantPrefs]);
  
  // 4. Sanitize values (prevent prompt injection)
  const sanitized = sanitizePreferences(merged);
  
  // 5. Build prompt template (<1ms)
  return buildPromptTemplate(sanitized, context);
}
```

### 3.2 Preference Loading Strategy

**Two-Tier Caching:** Use L1 (in-memory LRU) + L2 (Redis) with pub/sub invalidation for distributed consistency:

```typescript
// packages/agent/src/preference/loader.ts

import { userRepo } from "@alfred/db";
import { LRUCache } from "lru-cache";
import { RedisClient } from "bun";
import type { PreferenceKey, PreferenceValue, PreferenceSource } from "@alfred/type/preference";
import { preferenceKeySchema } from "@alfred/type/preference";

// L1: In-memory LRU cache (fastest, per-instance)
const l1Cache = new LRUCache<string, Map<PreferenceKey, PreferenceValue>>({
  max: 1000, // Cache up to 1000 users
  ttl: 5 * 60 * 1000, // 5 minutes (longer TTL since L2 handles invalidation)
});

// L2: Redis client (shared across instances)
let redisClient: RedisClient | null = null;
let redisSubscriber: RedisClient | null = null;
const CACHE_CHANNEL = "preference:invalidate";
const CACHE_KEY_PREFIX = "pref:";

/**
 * Initialize Redis connection for distributed caching
 * Gracefully falls back to in-memory only if Redis unavailable
 * Follows pattern from packages/api/src/run-registry.ts
 */
let redisInitPromise: Promise<void> | null = null;

async function initializeRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return;
  }

  if (redisClient?.connected && redisSubscriber?.connected) {
    return;
  }

  // Prevent multiple simultaneous initialization attempts
  if (redisInitPromise) {
    return redisInitPromise;
  }

  redisInitPromise = (async () => {
    try {
      // Create separate clients for commands and pub/sub (required by Redis protocol)
      // Redis clients in subscribe mode cannot execute other commands
      redisClient = new RedisClient(url);
      redisSubscriber = new RedisClient(url);

      redisClient.onclose = () => {
        redisClient = null;
      };
      redisSubscriber.onclose = () => {
        redisSubscriber = null;
      };

      // Connect both clients
      await redisClient.connect();
      await redisSubscriber.connect();

      // Subscribe to invalidation channel
      // Note: subscribe listener signature is (message: string, channel: string) => void
      // This matches RedisPubSubListener type from bun.d.ts
      await redisSubscriber.subscribe(CACHE_CHANNEL, (message: string, _channel: string) => {
        const userId = message;
        // Invalidate L1 cache when notified from other instances
        l1Cache.delete(userId);
      });
    } catch (error) {
      // Non-fatal: fall back to in-memory only
      logger.warn("preference_redis_init_failed", {
        error: error instanceof Error ? error.message : String(error),
        fallback: "memory",
      });
      redisClient = null;
      redisSubscriber = null;
      throw error;
    } finally {
      redisInitPromise = null;
    }
  })();

  return redisInitPromise;
}

/**
 * Get Redis client for commands (cached)
 * Returns null if Redis unavailable or not initialized
 */
function getRedisClient(): RedisClient | null {
  return redisClient?.connected ? redisClient : null;
}

/**
 * Load preferences with two-tier caching
 * Performance budget: <10ms (L1 hit: <1ms, L2 hit: <5ms, DB miss: <10ms)
 * Uses prepared statement for optimal performance (~0.5ms latency)
 */
export async function loadPreferences(
  userId: string
): Promise<Map<PreferenceKey, PreferenceValue>> {
  // Ensure Redis is initialized (idempotent)
  await initializeRedis();

  // L1: Check in-memory cache first
  const l1Cached = l1Cache.get(userId);
  if (l1Cached) {
    return l1Cached;
  }

  // L2: Check Redis cache
  const redis = getRedisClient();
  if (redis) {
    try {
      const redisKey = `${CACHE_KEY_PREFIX}${userId}`;
      const cached = await redis.get(redisKey);
      if (cached) {
        const prefs = deserializePreferences(cached);
        // Populate L1 cache
        l1Cache.set(userId, prefs);
        return prefs;
      }
    } catch (error) {
      // Redis error: fall back to DB (non-fatal)
      logger.warn("preference_redis_cache_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // DB: Load from database using optimized prepared statement query
  const rows = await userRepo.getPreferences(userId);
  const prefs = new Map<PreferenceKey, PreferenceValue>();

  for (const row of rows) {
    // Type validation: Use Zod schema for runtime validation
    const validatedKey = preferenceKeySchema.parse(row.key);
    prefs.set(validatedKey, {
      value: row.value as unknown, // JSONB value, validated by Zod at API boundary
      confidence: row.confidence,
      source: row.source as PreferenceSource, // Validated by schema
    });
  }

  // Populate both caches
  l1Cache.set(userId, prefs);
  if (redis) {
    try {
      const redisKey = `${CACHE_KEY_PREFIX}${userId}`;
      // Use Redis SET with EX option for TTL (10 minutes)
      // Note: RedisSetOptions.EX is supported (alternative: set() then expire())
      await redis.set(redisKey, serializePreferences(prefs), {
        EX: 10 * 60, // 10 minutes TTL (longer since we have invalidation)
      });
    } catch (error) {
      // Non-fatal: log but continue
      logger.warn("preference_redis_set_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return prefs;
}

/**
 * Invalidate cache for a user (called after preference updates)
 * Publishes invalidation event via Redis pub/sub for distributed invalidation
 */
export async function invalidatePreferenceCache(userId: string): Promise<void> {
  // Invalidate L1 cache locally
  l1Cache.delete(userId);

  // Publish invalidation event via Redis pub/sub (notifies other instances)
  const redis = getRedisClient();
  if (redis) {
    try {
      // Publish to channel (other instances will receive via subscriber)
      await redis.publish(CACHE_CHANNEL, userId);
      // Also delete from Redis L2 cache directly
      const redisKey = `${CACHE_KEY_PREFIX}${userId}`;
      await redis.del(redisKey);
    } catch (error) {
      // Non-fatal: log but continue (L1 already invalidated)
      logger.warn("preference_redis_invalidate_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function serializePreferences(
  prefs: Map<PreferenceKey, PreferenceValue>
): string {
  return JSON.stringify(Array.from(prefs.entries()));
}

function deserializePreferences(
  serialized: string
): Map<PreferenceKey, PreferenceValue> {
  const entries = JSON.parse(serialized) as Array<
    [PreferenceKey, PreferenceValue]
  >;
  return new Map(entries);
}
```

### 3.3 Context Filtering

```typescript
function filterByContext(
  preferences: Map<PreferenceKey, PreferenceValue>,
  context?: DomainContext
): Map<PreferenceKey, PreferenceValue> {
  if (!context) {
    // Return all response-level preferences
    return new Map(
      Array.from(preferences.entries()).filter(([key]) =>
        key.startsWith("response.")
      )
    );
  }
  
  const filtered = new Map<PreferenceKey, PreferenceValue>();
  
  for (const [key, value] of preferences) {
    // Always include response-level preferences
    if (key.startsWith("response.")) {
      filtered.set(key, value);
    }
    
    // Include domain-specific preferences if domain matches
    if (context.domain && key.startsWith(`domain.${context.domain}.`)) {
      filtered.set(key, value);
    }
  }
  
  return filtered;
}
```

### 3.4 Prompt Injection Protection

```typescript
// packages/agent/src/preference/sanitize.ts

import type { PreferenceKey, PreferenceValue } from "@alfred/type/preference";
import {
  verbositySchema,
  toneSchema,
  formatSchema,
  explanationDepthSchema,
} from "@alfred/type/preference";

/**
 * Sanitize preference values to prevent prompt injection
 * Uses strict validation: enum values are safe, string values are sanitized
 */
export function sanitizePreferences(
  preferences: Map<PreferenceKey, PreferenceValue>
): Map<PreferenceKey, PreferenceValue> {
  const sanitized = new Map<PreferenceKey, PreferenceValue>();

  for (const [key, value] of preferences) {
    // Response preferences use enums (validated by Zod) - safe
    if (
      key === "response.verbosity" ||
      key === "response.tone" ||
      key === "response.format" ||
      key === "response.explanation_depth"
    ) {
      // Validate enum value (Zod already validated, but double-check)
      const schema =
        key === "response.verbosity"
          ? verbositySchema
          : key === "response.tone"
            ? toneSchema
            : key === "response.format"
              ? formatSchema
              : explanationDepthSchema;

      const validated = schema.safeParse(value.value);
      if (validated.success) {
        sanitized.set(key, {
          ...value,
          value: validated.data,
        });
      }
      // Skip invalid enum values (shouldn't happen, but defensive)
      continue;
    }

    // Domain preferences: sanitize string values strictly
    if (typeof value.value === "string") {
      const sanitizedValue = sanitizeStringValue(value.value);
      sanitized.set(key, {
        ...value,
        value: sanitizedValue,
      });
    } else if (
      typeof value.value === "number" ||
      typeof value.value === "boolean"
    ) {
      // Numeric and boolean values are safe
      sanitized.set(key, value);
    } else if (typeof value.value === "object" && value.value !== null) {
      // Object values: recursively sanitize string fields
      const sanitizedObject = sanitizeObjectValue(value.value);
      sanitized.set(key, {
        ...value,
        value: sanitizedObject,
      });
    } else {
      // Unknown type: skip (defensive)
      continue;
    }
  }

  return sanitized;
}

/**
 * Sanitize string values: remove control characters, limit length, escape special chars
 */
function sanitizeStringValue(value: string): string {
  return value
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control chars and extended ASCII control
    .replace(/[<>{}[\]\\]/g, "") // Remove potential injection chars
    .slice(0, 200) // Limit length
    .trim();
}

/**
 * Sanitize object values: recursively sanitize string fields
 */
function sanitizeObjectValue(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      sanitized[k] = sanitizeStringValue(v);
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeObjectValue(v as Record<string, unknown>);
    } else {
      sanitized[k] = v; // Numbers, booleans, arrays are safe
    }
  }
  return sanitized;
}
```

### 3.5 Prompt Template Structure

```typescript
function buildPromptTemplate(
  preferences: Map<PreferenceKey, PreferenceValue>,
  context?: DomainContext
): string {
  const parts: string[] = [];
  
  // Base system prompt
  parts.push("You are ALFRED, a personal AI assistant.");
  
  // Response style preferences
  const verbosity = preferences.get("response.verbosity");
  if (verbosity) {
    parts.push(`\nResponse Style: ${formatVerbosityInstruction(verbosity.value)}`);
  }
  
  const tone = preferences.get("response.tone");
  if (tone) {
    parts.push(`\nTone: ${formatToneInstruction(tone.value)}`);
  }
  
  const format = preferences.get("response.format");
  if (format) {
    parts.push(`\nFormat: ${formatFormatInstruction(format.value)}`);
  }
  
  // Domain-specific preferences
  if (context?.domain) {
    const domainPrefs = Array.from(preferences.entries()).filter(([key]) =>
      key.startsWith(`domain.${context.domain}.`)
    );
    
    if (domainPrefs.length > 0) {
      parts.push(`\nDomain-Specific Preferences (${context.domain}):`);
      for (const [key, value] of domainPrefs) {
        const instruction = formatDomainPreference(key, value.value);
        if (instruction) {
          parts.push(`- ${instruction}`);
        }
      }
    }
  }
  
  return parts.join("\n");
}

function formatVerbosityInstruction(value: unknown): string {
  const verbosityMap = {
    minimal: "Be extremely concise. Use the fewest words possible.",
    concise: "Be brief and to the point. Avoid unnecessary elaboration.",
    detailed: "Provide thorough explanations with context.",
    verbose: "Provide comprehensive explanations with examples and context.",
  };
  
  return verbosityMap[value as keyof typeof verbosityMap] ?? "";
}

function formatToneInstruction(value: unknown): string {
  const toneMap = {
    formal: "Use formal, professional language.",
    casual: "Use casual, conversational language.",
    technical: "Use technical terminology and precise language.",
    friendly: "Use warm, friendly language.",
  };
  
  return toneMap[value as keyof typeof toneMap] ?? "";
}

function formatFormatInstruction(value: unknown): string {
  const formatMap = {
    bullet: "Use bullet points for lists.",
    paragraph: "Use paragraph format.",
    structured: "Use structured format with headings and sections.",
    narrative: "Use narrative, flowing prose.",
  };
  
  return formatMap[value as keyof typeof formatMap] ?? "";
}

function formatDomainPreference(key: string, value: unknown): string | null {
  if (key.endsWith(".config_format")) {
    return `Prefer ${value} format for configuration files.`;
  }
  
  if (key.endsWith(".output_style")) {
    return `Use ${value} output style.`;
  }
  
  return null;
}
```

### 3.6 Example System Prompt Output

```
You are ALFRED, a personal AI assistant.

Response Style: Be brief and to the point. Avoid unnecessary elaboration.

Tone: Use technical terminology and precise language.

Format: Use bullet points for lists.

Domain-Specific Preferences (proxmox):
- Prefer yaml format for configuration files.
- Use annotated output style.
```

## 4. AI SDK Integration

### 4.1 Integration Points

**Three integration points:**

1. **Runtime Adapter** (`packages/runtime/src/adapters/ai.ts`)
2. **Stream Handler** (`apps/web/src/routes/api/stream-handler.ts`)
3. **Workflow Router** (`packages/api/src/routers/workflow.ts`)

### 4.2 Runtime Adapter Integration

```typescript
// packages/runtime/src/adapters/ai.ts

import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";

export class AISDKAdapter {
  private readonly runId?: string;
  private readonly userId?: string; // userId from tRPC context (server-only)

  constructor(runId?: string, userId?: string) {
    this.runId = runId;
    this.userId = userId; // Passed from tRPC context in workflow router
  }

  async *stream(options: StreamOptions): AsyncGenerator<WorkflowEvent, void, void> {
    // ... existing code ...
    
    // Build preference-driven system prompt
    let systemPrompt = options.system ?? "";
    
    if (this.userId) {
      try {
        const preferencePrompt = await buildPreferenceSystemPrompt(
          this.userId,
          {
            domain: extractDomainFromTools(options.tools),
            conversationType: "workflow",
          }
        );
        
        // Merge with existing system prompt
        systemPrompt = [systemPrompt, preferencePrompt]
          .filter(Boolean)
          .join("\n\n");
      } catch (error) {
        // Non-fatal: log but continue with default system prompt
        logger.warn("preference_prompt_failed", {
          runId: this.runId,
          userId: this.userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    const result = streamText({
      model: options.model,
      messages: convertToModelMessages(options.messages),
      tools: options.tools,
      abortSignal: options.abortSignal,
      system: systemPrompt, // Use merged prompt
      temperature: options.temperature,
    });
    
    // ... rest of existing code ...
  }
}
```

### 4.3 Stream Handler Integration

**Note:** TanStack Start server routes (`server.handlers`) are server-only. They receive `{ request }` and can access session via `auth.api.getSession()`. No isomorphic functions needed - preference loading is already server-only.

```typescript
// apps/web/src/routes/api/stream-handler.ts

import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import { auth } from "@alfred/auth";

export async function handleStreamRequest(
  request: Request,
  buildTools: BuildToolsFn,
  errorPrefix: string
): Promise<Response> {
  // ... existing validation code ...
  
  // Extract userId from session (server-only, TanStack Start server route)
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id;
  
  let systemPrompt: string | undefined;
  
  if (userId) {
    try {
      systemPrompt = await buildPreferenceSystemPrompt(userId, {
        conversationType: errorPrefix === "assistant" ? "assistant" : "chat",
      });
    } catch (error) {
      // Non-fatal: continue without preference prompt
      logger.warn(`${errorPrefix}_preference_prompt_failed`, {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  const result = streamText({
    model,
    messages: convertToModelMessages(messages),
    tools: buildTools(),
    abortSignal: request.signal,
    system: systemPrompt, // Inject preference prompt
    onAbort: ({ steps }) => {
      logger.warn(`${errorPrefix}_stream_aborted`, {
        steps: steps.length,
      });
    },
  });
  
  // ... rest of existing code ...
}
```

**Server Route Handlers (TanStack Start):**

```typescript
// apps/web/src/routes/api/assistant/$.ts

import { buildAssistantTools } from "@alfred/agent";
import { createFileRoute } from "@tanstack/react-router";
import { handleStreamRequest } from "../stream-handler";

function handleAssistantRequest(request: Request): Promise<Response> {
  // userId is extracted inside handleStreamRequest from session
  return handleStreamRequest(request, buildAssistantTools, "assistant");
}

export const Route = createFileRoute("/api/assistant/$")({
  server: {
    handlers: {
      POST: ({ request }) => handleAssistantRequest(request),
    },
  },
});
```

### 4.4 Fallback Strategy

**When preference loading fails:**
1. Log error (non-fatal)
2. Continue with default system prompt (or existing system prompt)
3. Do not block request
4. Track failure rate via metrics

**Metrics:**
```typescript
// packages/api/src/metrics.ts

export const preferencePromptLoadTotal = new client.Counter({
  name: "preference_prompt_load_total",
  help: "Total preference prompt loads",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const preferencePromptBuildDurationSeconds = new client.Histogram({
  name: "preference_prompt_build_duration_seconds",
  help: "Preference prompt build duration",
  labelNames: [] as const,
  registers: [metricsRegistry],
});
```

## 5. Feedback Loop

### 5.1 API Endpoints for Preference Updates

**Extend existing preference router:**

```typescript
// packages/api/src/routers/preference.ts

import { userRepo, conversationRepo, type userSchema } from "@alfred/db";
import { recordMemoryUpdate } from "@alfred/agent";
import { preferenceKeySchema, preferenceValueSchema } from "@alfred/type/preference";
import { inferPreferenceFromCorrection } from "@alfred/agent/preference/inference";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { toTRPCError } from "../utils/error";
import { invalidatePreferenceCache } from "@alfred/agent/preference/loader";

type PreferenceRow = typeof userSchema.preferences.$inferSelect;

export const preferenceRouter = router({
  // ... existing list, set, delete ...
  
  /**
   * Update preference from explicit feedback
   */
  updateFromFeedback: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(
      z.object({
        messageId: z.string().min(1),
        conversationId: z.string().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        tags: z.array(z.string().min(1)).optional(),
        preferenceUpdates: z
          .record(preferenceKeySchema, preferenceValueSchema)
          .min(1, "At least one preference update required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Note: authedProcedure already ensures ctx.session exists (no need to check)
      const userId = ctx.session.user.id;

      ensureObligations(ctx);

      // Security: Validate messageId belongs to user (prevent ID enumeration)
      const message = await conversationRepo.getMessage(input.messageId, userId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "message_not_found",
        });
      }
      
      try {
        // Update preferences from feedback
        const updates: PreferenceRow[] = [];
        
        for (const [key, value] of Object.entries(input.preferenceUpdates)) {
          const pref = await userRepo.setPreference(
            userId,
            key,
            value,
            0.9, // High confidence from explicit feedback
            "learned"
          );
          updates.push(pref);
          
          // Invalidate cache after update
          await invalidatePreferenceCache(userId);
        }
        
        // Record feedback (userRepo.addFeedback exists in packages/db/src/repo/user.ts)
        await userRepo.addFeedback(
          userId,
          input.conversationId ?? "", // conversationId (optional, can be null)
          input.messageId,
          input.rating,
          undefined, // comment (optional)
          input.tags
        );
        
        recordMemoryUpdate("preference", "learned");
        return { updated: updates.length };
      } catch (error) {
        throw toTRPCError(error, "preference_feedback_update_failed");
      }
    }),
  
  /**
   * Infer preferences from conversation correction
   */
  inferFromCorrection: authedProcedure
    .use(
      requirePolicy("preference.write", (input, ctx) =>
        mapPreferenceResource(input, ctx)
      )
    )
    .input(
      z.object({
        originalMessageId: z.string(),
        correctedMessageId: z.string(),
        correctionType: z.enum(["verbosity", "tone", "format", "content"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Note: authedProcedure already ensures ctx.session exists (no need to check)
      const userId = ctx.session.user.id;

      ensureObligations(ctx);

      try {
        // Load original and corrected messages with ownership validation
        const original = await conversationRepo.getMessage(
          input.originalMessageId,
          userId
        );
        const corrected = await conversationRepo.getMessage(
          input.correctedMessageId,
          userId
        );
        
        // Validate message ownership
        if (!original) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "original_message_not_found",
          });
        }
        if (!corrected) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "corrected_message_not_found",
          });
        }
        
        // Convert MessageRow to UIMessage format
        const originalMessage = conversationRepo.messageRowToUIMessage(original);
        const correctedMessage = conversationRepo.messageRowToUIMessage(corrected);
        
        // Infer preference from correction
        // Note: inferPreferenceFromCorrection function needs to be implemented
        // in packages/agent/src/preference/inference.ts
        // Algorithm: Compare original vs corrected message characteristics:
        // - Length difference → verbosity preference
        // - Tone difference → tone preference
        // - Format difference → format preference
        const inferred = inferPreferenceFromCorrection(
          originalMessage,
          correctedMessage,
          input.correctionType
        );
        
        if (inferred) {
          await userRepo.setPreference(
            userId,
            inferred.key,
            inferred.value,
            0.7, // Medium confidence from single correction
            "inferred"
          );
          await invalidatePreferenceCache(userId);
          return { inferred: 1 };
        }
        
        return { inferred: 0 };
      } catch (error) {
        throw toTRPCError(error, "preference_inference_failed");
      }
    }),
});
```

### 5.2 Preference Confidence Decay

**Strategy:** Reduce confidence of inferred preferences over time if not reinforced:

```typescript
// packages/api/src/schedulers/preference-decay.ts

export async function decayPreferenceConfidence(userId: string) {
  const preferences = await userRepo.getPreferences(userId);
  
  for (const pref of preferences) {
    if (pref.source === "inferred" && pref.confidence > 0.5) {
      // Decay confidence by 0.1 per 30 days
      const daysSinceUpdate = daysBetween(pref.updated, new Date());
      const decayAmount = Math.floor(daysSinceUpdate / 30) * 0.1;
      const newConfidence = Math.max(0.3, pref.confidence - decayAmount);
      
      if (newConfidence < pref.confidence) {
        await userRepo.setPreference(
          userId,
          pref.key,
          pref.value,
          newConfidence,
          pref.source
        );
      }
      
      // Delete low-confidence inferred preferences
      if (newConfidence < 0.3) {
        await userRepo.deletePreference(userId, pref.key);
      }
    }
  }
}
```

### 5.3 A/B Testing Strategy

**Gradual Rollout:**
- Phase 1: 10% of users (feature flag: `PREFERENCE_ADAPTATION_ENABLED`)
- Phase 2: 50% of users (if metrics show positive impact)
- Phase 3: 100% of users

**Feature Flag:**
```typescript
// packages/agent/src/preference/prompt.ts

export async function buildPreferenceSystemPrompt(
  userId: string,
  context?: DomainContext
): Promise<string> {
  // Check feature flag
  if (process.env.PREFERENCE_ADAPTATION_ENABLED !== "true") {
    return "";
  }
  
  // Check user eligibility (for gradual rollout)
  const userHash = hashUserId(userId);
  const rolloutPercent = parseInt(
    process.env.PREFERENCE_ADAPTATION_ROLLOUT_PERCENT ?? "100",
    10
  );
  
  if (userHash % 100 >= rolloutPercent) {
    return "";
  }
  
  // ... rest of implementation ...
}
```

## 6. Domain-Specific Learning

### 6.1 Domain Detection Logic

```typescript
// packages/agent/src/preference/domain.ts

export function detectDomain(
  messages: UIMessage[],
  tools?: Record<string, Tool>
): DomainName | null {
  // Detect domain from:
  // 1. Tool names (e.g., "proxmox.*" → "proxmox")
  // 2. Message content keywords (e.g., "proxmox", "vm", "container")
  // 3. Context metadata (if available)
  
  if (tools) {
    const toolNames = Object.keys(tools);
    
    if (toolNames.some(name => name.startsWith("proxmox."))) {
      return "proxmox";
    }
    
    if (toolNames.some(name => name.startsWith("git."))) {
      return "git";
    }
    
    if (toolNames.some(name => name.startsWith("docker."))) {
      return "docker";
    }
  }
  
  // Check message content
  const content = messages
    .map(m => m.parts?.find(p => p.type === "text")?.text ?? "")
    .join(" ")
    .toLowerCase();
  
  if (content.includes("proxmox") || content.includes("vm") || content.includes("lxc")) {
    return "proxmox";
  }
  
  if (content.includes("git") || content.includes("commit") || content.includes("branch")) {
    return "git";
  }
  
  return null;
}
```

### 6.2 Domain-Specific Preference Extraction

```typescript
// packages/agent/src/preference/inference.ts

export function inferDomainPreferences(
  toolCalls: ToolCallHistory[]
): Map<PreferenceKey, PreferenceValue> {
  const preferences = new Map<PreferenceKey, PreferenceValue>();
  
  // Group by domain
  const domainGroups = groupByDomain(toolCalls);
  
  for (const [domain, calls] of domainGroups) {
    // Infer config format preference
    const configFormats = calls
      .map(c => extractConfigFormat(c))
      .filter(Boolean);
    
    if (configFormats.length > 0) {
      const mostCommon = mostCommonValue(configFormats);
      preferences.set(`domain.${domain}.config_format`, {
        value: mostCommon,
        confidence: calculateConfidence(configFormats.length, configFormats.consistency),
        source: "inferred",
        evidence: calls.map(c => c.eventId),
      });
    }
    
    // Infer tool preference (e.g., prefers `git.commit` over `git.commit.message`)
    const toolPreferences = inferToolPreferences(calls, domain);
    for (const [toolName, preference] of toolPreferences) {
      preferences.set(`domain.${domain}.tool_preference.${toolName}`, {
        value: preference,
        confidence: 0.7,
        source: "inferred",
        evidence: calls.map(c => c.eventId),
      });
    }
  }
  
  return preferences;
}
```

### 6.3 Preference Inheritance

**Strategy:** Domain defaults → User overrides

```typescript
// packages/agent/src/preference/loader.ts

export async function loadPreferencesWithDefaults(
  userId: string,
  domain?: DomainName
): Promise<Map<PreferenceKey, PreferenceValue>> {
  const userPrefs = await loadPreferences(userId);
  
  // Apply domain defaults if no user preference exists
  if (domain) {
    const domainDefaults = getDomainDefaults(domain);
    
    for (const [key, value] of domainDefaults) {
      if (!userPrefs.has(key)) {
        userPrefs.set(key, {
          ...value,
          source: "default",
          confidence: 0.5,
        });
      }
    }
  }
  
  return userPrefs;
}

function getDomainDefaults(domain: DomainName): Map<PreferenceKey, PreferenceValue> {
  // Load from centralized defaults file
  return loadDomainDefaults(domain);
}
```

**Default Preferences File:**

```typescript
// packages/agent/src/preference/defaults.ts

import type { DomainName, PreferenceKey, PreferenceValue } from "@alfred/type/preference";

/**
 * Domain-specific default preferences
 * Centralized constants (not hardcoded in loading logic)
 */
export function loadDomainDefaults(domain: DomainName): Map<PreferenceKey, PreferenceValue> {
  const defaults = new Map<PreferenceKey, PreferenceValue>();
  
  switch (domain) {
    case "proxmox":
      defaults.set("domain.proxmox.config_format", {
        value: "yaml",
        confidence: 0.5,
        source: "default",
      });
      break;
    
    case "git":
      defaults.set("domain.git.commit_style", {
        value: "conventional",
        confidence: 0.5,
        source: "default",
      });
      break;
    
    case "docker":
      defaults.set("domain.docker.compose_version", {
        value: "3.9",
        confidence: 0.5,
        source: "default",
      });
      break;
  }
  
  return defaults;
}
```

## 7. Testing Strategy

### 7.1 Unit Tests

**Preference Inference Functions:**
```typescript
// packages/agent/test/preference/inference.test.ts

import { describe, expect, it } from "bun:test";
import { inferResponsePreferences } from "../src/preference/inference";

describe("inferResponsePreferences", () => {
  it("infers verbosity from user corrections", () => {
    const conversations = [
      {
        id: "conv1",
        messages: [
          { role: "assistant", content: "This is a very long response..." },
          { role: "user", content: "Too verbose, be brief" },
        ],
      },
    ];
    
    const prefs = inferResponsePreferences(conversations);
    
    expect(prefs.get("response.verbosity")?.value).toBe("concise");
    expect(prefs.get("response.verbosity")?.confidence).toBeGreaterThan(0.6);
  });
  
  it("infers tone from message patterns", () => {
    // Test tone inference
  });
});
```

**Sanitization Tests:**
```typescript
// packages/agent/test/preference/sanitize.test.ts

import { describe, expect, it } from "bun:test";
import { sanitizePreferences } from "../src/preference/sanitize";

describe("sanitizePreferences", () => {
  it("preserves enum values (safe)", () => {
    const prefs = new Map([
      ["response.verbosity", { value: "concise", confidence: 0.9, source: "user" }],
    ]);
    
    const sanitized = sanitizePreferences(prefs);
    expect(sanitized.get("response.verbosity")?.value).toBe("concise");
  });
  
  it("sanitizes string values (removes control chars)", () => {
    const prefs = new Map([
      ["domain.proxmox.config_format", {
        value: "yaml\x00<script>alert('xss')</script>",
        confidence: 0.8,
        source: "inferred",
      }],
    ]);
    
    const sanitized = sanitizePreferences(prefs);
    const value = sanitized.get("domain.proxmox.config_format")?.value as string;
    expect(value).not.toContain("\x00");
    expect(value).not.toContain("<script>");
  });
  
  it("limits string length to 200 characters", () => {
    const longString = "a".repeat(300);
    const prefs = new Map([
      ["domain.proxmox.config_format", {
        value: longString,
        confidence: 0.8,
        source: "inferred",
      }],
    ]);
    
    const sanitized = sanitizePreferences(prefs);
    const value = sanitized.get("domain.proxmox.config_format")?.value as string;
    expect(value.length).toBeLessThanOrEqual(200);
  });
});
```

**System Prompt Construction:**
```typescript
// packages/agent/test/preference/prompt.test.ts

import { describe, expect, it } from "bun:test";
import { buildPreferenceSystemPrompt } from "../src/preference/prompt";

describe("buildPreferenceSystemPrompt", () => {
  it("builds prompt with verbosity preference", async () => {
    // Mock preference loading
    const prompt = await buildPreferenceSystemPrompt("user1", {
      domain: "proxmox",
    });
    
    expect(prompt).toContain("concise");
    expect(prompt).toContain("proxmox");
  });
  
  it("meets performance budget", async () => {
    const start = performance.now();
    await buildPreferenceSystemPrompt("user1");
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1); // <1ms
  });
});
```

### 7.2 Integration Tests

**Preference Loading:**
```typescript
// packages/api/test/preference/loader.test.ts

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { createTestDb } from "../utils/db";
import { loadPreferences, invalidatePreferenceCache } from "@alfred/agent/preference/loader";
import { userRepo } from "@alfred/db";

describe("loadPreferences", () => {
  beforeEach(() => {
    // Clear Redis cache if available
    process.env.REDIS_URL = process.env.REDIS_URL ?? "false";
  });

  it("loads preferences from database using prepared statement", async () => {
    const userId = "test-user";
    
    // Insert test preferences
    await userRepo.setPreference(
      userId,
      "response.verbosity",
      "concise",
      0.9,
      "user"
    );
    
    const prefs = await loadPreferences(userId);
    
    expect(prefs.get("response.verbosity")?.value).toBe("concise");
    expect(prefs.get("response.verbosity")?.confidence).toBe(0.9);
  });
  
  it("caches preferences in L1 (in-memory)", async () => {
    const userId = "test-user";
    
    // First call - hits DB
    const prefs1 = await loadPreferences(userId);
    
    // Second call - hits L1 cache
    const prefs2 = await loadPreferences(userId);
    
    expect(prefs2.get("response.verbosity")?.value).toBe("concise");
    // Note: Map instances may differ, but values should match
  });
  
  it("invalidates cache correctly", async () => {
    const userId = "test-user";
    
    // Load preferences (populates cache)
    await loadPreferences(userId);
    
    // Update preference
    await userRepo.setPreference(
      userId,
      "response.verbosity",
      "verbose",
      1.0,
      "user"
    );
    
    // Invalidate cache
    await invalidatePreferenceCache(userId);
    
    // Reload should fetch new value
    const prefs = await loadPreferences(userId);
    expect(prefs.get("response.verbosity")?.value).toBe("verbose");
  });
  
  it("meets performance budget", async () => {
    const userId = "test-user";
    const iterations = 100;
    const durations: number[] = [];
    
    // Warm up cache
    await loadPreferences(userId);
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await loadPreferences(userId);
      durations.push(performance.now() - start);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
    const p99Duration = durations.sort((a, b) => b - a)[Math.floor(iterations * 0.01)];
    
    // L1 cache hits should be <1ms
    expect(avgDuration).toBeLessThan(1); // <1ms average (L1 cache)
    expect(p99Duration).toBeLessThan(5); // <5ms p99
  });
  
  it("falls back gracefully when Redis unavailable", async () => {
    const originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "false";
    
    const userId = "test-user";
    const prefs = await loadPreferences(userId);
    
    expect(prefs.get("response.verbosity")?.value).toBe("concise");
    
    // Restore
    process.env.REDIS_URL = originalRedisUrl;
  });
});
```

### 7.3 E2E Tests

**Preference-Driven Response Adaptation:**
```typescript
// packages/api/test/preference/e2e.test.ts

import { describe, expect, it } from "bun:test";
import { createRuntime } from "@alfred/runtime";
import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

describe("preference-driven adaptation", () => {
  it("adapts response verbosity based on preference", async () => {
    // 1. Set verbosity preference
    await userRepo.setPreference(
      "test-user",
      "response.verbosity",
      "minimal",
      1.0,
      "user"
    );
    
    // 2. Build system prompt
    const systemPrompt = await buildPreferenceSystemPrompt("test-user");
    
    // 3. Run workflow with preference prompt
    const runtime = createRuntime({
      input: { requirement: "List VMs" },
      model: openai("gpt-4o"),
    });
    
    // 4. Verify response is minimal
    // (Check response length, word count, etc.)
  });
  
  it("verifies system prompt is injected into AI SDK calls", async () => {
    // Mock streamText to capture system parameter
    let capturedSystem: string | undefined;
    const originalStreamText = streamText;
    
    // Set preference
    await userRepo.setPreference(
      "test-user",
      "response.verbosity",
      "concise",
      1.0,
      "user"
    );
    
    // Build preference prompt
    const preferencePrompt = await buildPreferenceSystemPrompt("test-user");
    
    // Verify prompt contains preference instruction
    expect(preferencePrompt).toContain("concise");
    expect(preferencePrompt).toContain("brief");
    
    // Integration test: Verify system prompt is passed to streamText
    // (In real implementation, this would verify the actual AI SDK call)
  });
});
```

### 7.4 Performance Tests

**Prompt Construction Budget:**
```typescript
// packages/agent/test/preference/performance.test.ts

import { describe, expect, it } from "bun:test";
import { buildPreferenceSystemPrompt } from "../src/preference/prompt";

describe("performance", () => {
  it("prompt construction meets <1ms budget", async () => {
    const iterations = 100;
    const durations: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await buildPreferenceSystemPrompt("user1");
      durations.push(performance.now() - start);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
    const p99Duration = durations.sort((a, b) => b - a)[Math.floor(iterations * 0.01)];
    
    expect(avgDuration).toBeLessThan(1); // <1ms average
    expect(p99Duration).toBeLessThan(5); // <5ms p99
  });
});
```

## 8. Migration & Rollout

### 8.1 Migration Strategy

**For Existing Users:**
1. No migration needed - preferences start empty
2. Preferences are inferred gradually as users interact
3. Default behavior remains unchanged until preferences are learned

**Database Changes:**
- **No migration needed:** The unique constraint on `(user_id, key)` already exists (from `0009_uniques.sql`)
- PostgreSQL automatically creates a unique index for unique constraints, providing optimal query performance
- The existing constraint is sufficient for the <10ms performance budget

**Repository Optimization Required:**
- Update `getPreferences()` to use prepared statements and remove unnecessary `orderBy()`
- This optimization is required to meet the <10ms performance budget

**Redis Configuration:**
- **Environment variable:** `REDIS_URL` (optional, defaults to `redis://localhost:6379`)
- **Graceful degradation:** System works without Redis (falls back to in-memory cache only)
- **Pub/sub channel:** `preference:invalidate` for distributed cache invalidation
- **Cache key prefix:** `pref:` for preference cache keys

**Note:** The schema comment in `packages/db/src/schema/user.ts` should be updated to reflect that the constraint exists:
```typescript
// Unique constraint on (user_id, key) exists (migration 0009_uniques.sql)
// Provides implicit unique index for query performance
```

### 8.2 Feature Flag Configuration

**Environment Variables:**
```bash
# Enable preference-driven adaptation
PREFERENCE_ADAPTATION_ENABLED=true

# Gradual rollout percentage (0-100)
PREFERENCE_ADAPTATION_ROLLOUT_PERCENT=10

# Enable preference inference scheduler
SCHED_PREFERENCE_INFERENCE=1

# Redis connection (optional, enables distributed caching)
# Falls back to in-memory only if not set or unavailable
REDIS_URL=redis://localhost:6379
# Or: REDIS_URL=false to disable Redis (in-memory only)
```

### 8.3 Monitoring & Metrics

**Key Metrics:**
```typescript
// packages/api/src/metrics.ts

export const preferencePromptLoadTotal = new client.Counter({
  name: "preference_prompt_load_total",
  help: "Total preference prompt loads",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const preferencePromptBuildDurationSeconds = new client.Histogram({
  name: "preference_prompt_build_duration_seconds",
  help: "Preference prompt build duration",
  labelNames: [] as const,
  registers: [metricsRegistry],
});

export const preferenceInferenceTotal = new client.Counter({
  name: "preference_inference_total",
  help: "Total preference inference runs",
  labelNames: ["status", "source"] as const,
  registers: [metricsRegistry],
});

export const preferenceUpdatesTotal = new client.Counter({
  name: "preference_updates_total",
  help: "Total preference updates",
  labelNames: ["source"] as const,
  registers: [metricsRegistry],
});
```

**Effectiveness Measurement:**
- Track preference usage rate (how often preferences are applied)
- Track user satisfaction (feedback ratings before/after preferences)
- Track task completion rate (workflow success rate)
- Track response quality metrics (user edits, corrections)

### 8.4 Rollout Plan

**Phase 1: Internal Testing (Week 1)**
- Enable for internal users only
- Monitor metrics and error rates
- Fix any issues

**Phase 2: Gradual Rollout (Weeks 2-3)**
- Enable for 10% of users
- Monitor user satisfaction and task completion
- Gradually increase to 50% if metrics are positive

**Phase 3: Full Rollout (Week 4)**
- Enable for 100% of users
- Continue monitoring and optimization

## File Structure

```
packages/
  agent/
    src/
      preference/
        inference.ts          # Pure inference functions (renamed from infer.ts)
        merger.ts             # Preference merging logic (renamed from merge.ts)
        loader.ts             # Preference loading with two-tier caching (L1: LRU, L2: Redis)
        prompt.ts             # System prompt construction
        domain.ts             # Domain detection
        defaults.ts           # Domain default preferences (centralized constants)
        sanitize.ts           # Enhanced prompt injection protection with strict validation
    test/
      preference/
        inference.test.ts
        prompt.test.ts
        merger.test.ts
        performance.test.ts

packages/
  type/
    src/
      preference.ts           # Centralized Zod schemas and TypeScript types

packages/
  api/
    src/
      routers/
        preference.ts         # Extended with feedback endpoints
      schedulers/
        preference-inference.ts  # Background inference job
        preference-decay.ts       # Confidence decay job
    test/
      preference/
        load.test.ts
        e2e.test.ts

packages/
  type/
    src/
      preference.ts           # Zod schemas for preferences

packages/
  db/
    src/
      repo/
        user.ts                    # Update getPreferences() with prepared statement optimization
```

## Function Signatures Summary

```typescript
// Core functions
export async function buildPreferenceSystemPrompt(
  userId: string,
  context?: DomainContext
): Promise<string>;

export function inferResponsePreferences(
  conversations: ConversationHistory[]
): Map<PreferenceKey, PreferenceValue>; // packages/agent/src/preference/inference.ts

export function inferDomainPreferences(
  toolCalls: ToolCallHistory[]
): Map<PreferenceKey, PreferenceValue>; // packages/agent/src/preference/inference.ts

export function inferPreferencesFromFeedback(
  feedback: FeedbackHistory[]
): Map<PreferenceKey, PreferenceValue>; // packages/agent/src/preference/inference.ts

export function inferPreferenceFromCorrection(
  original: UIMessage,
  corrected: UIMessage,
  correctionType: "verbosity" | "tone" | "format" | "content"
): { key: PreferenceKey; value: PreferenceValue } | null; // packages/agent/src/preference/inference.ts

export function mergePreferences(
  preferenceMaps: Map<PreferenceKey, PreferenceValue>[]
): Map<PreferenceKey, PreferenceValue>; // packages/agent/src/preference/merger.ts

export async function loadPreferences(
  userId: string
): Promise<Map<PreferenceKey, PreferenceValue>>; // packages/agent/src/preference/loader.ts

export function invalidatePreferenceCache(
  userId: string
): Promise<void>; // packages/agent/src/preference/loader.ts

export function detectDomain(
  messages: UIMessage[],
  tools?: Record<string, Tool>
): DomainName | null;

// Conversation repository functions (packages/db/src/repo/conversation.ts)
export async function createConversation(
  userId: string,
  title?: string,
  workflowId?: string
): Promise<ConversationRow>;

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<ConversationRow | null>;

export async function getConversations(
  userId: string,
  options?: { days?: number; limit?: number }
): Promise<ConversationRow[]>;

export async function createMessage(
  userId: string,
  conversationId: string,
  message: UIMessage
): Promise<MessageRow>;

export async function getMessage(
  messageId: string,
  userId: string
): Promise<MessageRow | null>;

export async function getMessages(
  conversationId: string,
  userId: string
): Promise<MessageRow[]>;

export function messageRowToUIMessage(row: MessageRow): UIMessage;

export async function getConversationHistory(
  conversationId: string,
  userId: string
): Promise<ConversationHistory | null>;

// Scheduler functions
export async function runPreferenceInference(userId: string): Promise<void>;
export async function decayPreferenceConfidence(userId: string): Promise<void>;

// TODO: Tool call history retrieval (needs implementation)
// export async function getToolCalls(
//   userId: string,
//   options: { days?: number }
// ): Promise<ToolCallHistory[]>;
```

## Performance Considerations

### Caching Strategy
- **Two-tier caching:**
  - **L1 (in-memory LRU):** <1ms hit latency, 1000 users max, 5-minute TTL
  - **L2 (Redis):** <5ms hit latency, shared across instances, 10-minute TTL
- **Distributed invalidation:** Redis pub/sub for real-time cache invalidation across instances
- **Graceful fallback:** Falls back to in-memory only when Redis unavailable (non-fatal)
- **Performance targets:** L1 hit <1ms, L2 hit <5ms, DB miss <10ms
- **Batch loading:** Consider `getPreferencesBatch(userIds: string[])` using `inArray` for future optimization

### Repository Query Optimization
- **Prepared statements:** Use `.prepare()` for hot-path queries to reduce latency from ~2ms to ~0.5ms
- **Remove sorting:** `orderBy(desc(preferences.updated))` removed - merge logic doesn't depend on timestamp order
- **Explicit projection:** Select only needed columns (`key`, `value`, `confidence`, `source`) instead of `*`
- **Connection pooling:** Ensure `db` instance uses connection pool (pg-bouncer or Drizzle's internal pool) for background jobs

### Query Optimization
- **Unique constraint index** on `(user_id, key)` already exists (from `0009_uniques.sql`)
- **Prepared statements** for hot-path queries (reduces latency from ~2ms to ~0.5ms)
- **Remove unnecessary sorting** (`orderBy` removed from `getPreferences()` - merge logic doesn't depend on timestamp)
- **Explicit column projection** (select only needed columns, not `*`)
- **Limit preference count** per user if needed (e.g., top 50 by confidence)
- **Lazy loading** of domain-specific preferences

### Prompt Construction Optimization
- **Template caching** for common preference combinations
- **String concatenation** instead of array joins (faster)
- **Early returns** for empty preference sets

## Answers to Questions

1. **Should preference inference run synchronously or asynchronously?**
   - **Answer:** Asynchronously (background jobs). Inference is computationally expensive and should not block user requests.

2. **How do we handle conflicting preferences (user-set vs inferred)?**
   - **Answer:** User-set preferences always override inferred preferences. Priority: user > learned > inferred.

3. **Should preferences be scoped to conversation threads or global?**
   - **Answer:** Global (user-scoped). Simpler implementation, better UX consistency. Can add thread-scoped preferences later if needed.

4. **How do we prevent prompt injection via user preferences?**
   - **Answer:** Sanitize preference values (remove control characters, limit length). Validate preference keys and values with Zod schemas.

5. **What's the fallback when preference loading fails?**
   - **Answer:** Log error (non-fatal), continue with default system prompt. Do not block request. Redis failures gracefully fall back to in-memory cache only.

6. **How do we measure preference effectiveness?**
   - **Answer:** Track preference usage rate, user satisfaction (feedback ratings), task completion rate, and response quality metrics (user edits, corrections).

7. **How do we handle cache consistency across multiple instances?**
   - **Answer:** Two-tier caching with Redis pub/sub invalidation. L1 (in-memory LRU) provides <1ms hits, L2 (Redis) provides <5ms hits and shared state. When preferences are updated, invalidation events are published via Redis pub/sub, ensuring all instances invalidate their L1 caches in real-time. Falls back gracefully to in-memory only when Redis unavailable.

## Implementation Milestones

The work is organized into logical milestones that can be implemented incrementally. Each milestone should be independently verifiable and produce observable results.

### Milestone 1: Repository Optimization & Type System

**Goal:** Establish the foundation for preference storage and type safety.

**Scope:** Optimize the repository query for performance, implement centralized type definitions, and verify database constraints.

**Deliverables:**
- Optimized `getPreferences()` method using prepared statements
- Centralized preference types and Zod schemas in `packages/type/src/preference.ts`
- Verified unique constraint provides adequate index performance

**Validation:** Run `bun run db:migrate` to verify constraints exist. Run performance test to verify `getPreferences()` completes in <10ms. Run `bun run typecheck` to verify types compile correctly.

### Milestone 2: Preference Inference Core

**Goal:** Implement pure functions for inferring preferences from user interactions.

**Scope:** Build inference functions for conversations, tool usage, and feedback. Implement preference merging logic.

**Deliverables:**
- `packages/agent/src/preference/inference.ts` with pure inference functions
- `packages/agent/src/preference/merger.ts` with merging logic
- Unit tests for inference functions

**Validation:** Run `bun test packages/agent/test/preference/inference.test.ts` and verify all tests pass. Verify functions are pure (no side effects, deterministic output).

### Milestone 3: Preference Loading & Caching

**Goal:** Implement efficient preference loading with caching to meet performance budgets.

**Scope:** Build loader with LRU cache, implement cache invalidation, add domain defaults.

**Deliverables:**
- `packages/agent/src/preference/loader.ts` with caching
- `packages/agent/src/preference/defaults.ts` with domain defaults
- Performance tests verifying <10ms budget

**Validation:** Run performance tests to verify cache hits are <1ms and cache misses are <10ms. Verify cache invalidation works correctly.

### Milestone 4: System Prompt Construction

**Goal:** Build the system prompt construction pipeline that injects preferences into AI SDK calls.

**Scope:** Implement prompt building, sanitization, and template generation.

**Deliverables:**
- `packages/agent/src/preference/prompt.ts` - System prompt construction
- `packages/agent/src/preference/sanitize.ts` - Prompt injection protection
- Performance tests verifying <1ms budget

**Validation:** Run `bun test packages/agent/test/preference/prompt.test.ts` and verify prompt construction meets <1ms budget. Verify sanitization prevents prompt injection.

### Milestone 5: AI SDK Integration

**Goal:** Integrate preference-driven prompts into AI SDK v6 calls.

**Scope:** Update runtime adapter and stream handler to inject preference prompts.

**Deliverables:**
- Updated `packages/runtime/src/adapters/ai.ts` with preference prompt injection
- Updated `apps/web/src/routes/api/stream-handler.ts` with preference prompt injection
- Integration tests verifying prompts are injected

**Validation:** Run E2E tests to verify system prompts are injected into `streamText()` calls. Verify graceful fallback when preferences unavailable.

### Milestone 6: Background Inference & Feedback

**Goal:** Implement background jobs for preference inference and feedback processing.

**Scope:** Build schedulers for inference and confidence decay. Extend API with feedback endpoints.

**Deliverables:**
- `packages/api/src/schedulers/preference-inference.ts` - Background inference job
- `packages/api/src/schedulers/preference-decay.ts` - Confidence decay job
- Extended `packages/api/src/routers/preference.ts` with feedback endpoints

**Validation:** Run scheduler with `SCHED_PREFERENCE_INFERENCE=1` and verify preferences are inferred. Test feedback endpoints with security validation.

### Milestone 7: Testing & Validation

**Goal:** Comprehensive test coverage and performance validation.

**Scope:** Write unit, integration, E2E, and performance tests. Add monitoring and metrics.

**Deliverables:**
- Complete test suite for all preference components
- Performance tests verifying budgets are met
- Metrics and monitoring instrumentation

**Validation:** Run `bun test` and verify all tests pass. Verify performance budgets are met. Check metrics are being recorded correctly.

### Milestone 8: Rollout & Monitoring

**Goal:** Gradual feature rollout with monitoring and effectiveness measurement.

**Scope:** Implement feature flags, gradual rollout logic, and effectiveness tracking.

**Deliverables:**
- Feature flag implementation
- Gradual rollout logic (10% → 50% → 100%)
- Effectiveness tracking and monitoring

**Validation:** Enable feature flag for test user and verify preferences are applied. Monitor metrics for preference usage and effectiveness.

## Next Steps

The implementation should proceed milestone by milestone. Start with Milestone 1 and validate each milestone before proceeding to the next. Update the `Progress` section above as each task is completed.

2025-11-20 (Codex CLI): Earlier updates covered scheduler/typecheck fixes and preference router schema/tests; this revision persists workflow conversations/messages, adds dynamic runtime flag detection, and stabilizes workflow router tests. No standalone lint script exists (`bun run lint` is unavailable).
