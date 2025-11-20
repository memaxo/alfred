# Alfred Runtime & UI Lint Remediation Plan

<chatName="Alfred-TS-Build-and-Lint-Fix-Plan"/>

This ExecPlan is maintained per `.agent/PLANS.md`. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current as work advances.

## Executive Summary

Biome currently reports 2,300+ lint violations across runtime, API, and front-end packages, masking correctness issues like un-awaited Promises, shadowed error objects, and console logging that bypasses the structured logger requirement. This plan sequences the remediation so TypeScript continues to build (`bun run typecheck`) while critical lint categories (`useAwait`, `noExplicitAny`, `noConsole` in production code, structural hook misuse) are eliminated first. Completion is demonstrated when `bunx biome check .` exits cleanly and a curated changelog states which rule classes remain intentionally disabled (if any).

## Scope & Acceptance

Acceptance criteria:

1. `bun run typecheck` succeeds from a clean checkout.
2. `bunx biome check . --max-diagnostics 5000` reports zero errors.
3. Structured logging replaces every console usage outside explicitly documented development utilities.
4. Async code either awaits returned Promises or explicitly documents fire-and-forget behavior via `void` plus error handling.
5. All fixes include automated coverage where feasible (unit tests for logic changes, component tests for JSX refactors). When tests are impractical, document reasoning under `Surprises & Discoveries`.

## Environment

Run commands from the repo root (`/Users/jackmazac/Development/alfred`) using Bun 1.2.18. Install dependencies with `bun install` if the lockfile changes. Biome commands use `bunx biome ...`. Use `rg` for searching, and prefer `bun test` for package-level suites noted in milestones.

## Current State Snapshot (2025-11-19)

- TypeScript build passes after runtime decoupling.
- Biome errors per `/tmp/biome.json`:
  - 738 `lint/style/noMagicNumbers` (UI + tests)
  - 246 `lint/style/useBlockStatements`
  - 116 `lint/suspicious/useAwait`
  - 116 `lint/suspicious/noExplicitAny`
  - 116 `lint/nursery/useConsistentTypeDefinitions`
  - 100 `lint/suspicious/noEmptyBlockStatements`
  - 68 `assist/source/organizeImports`
  - 66 `lint/suspicious/noConsole`
- Hot directories: `packages/api`, `packages/agent`, `apps/web`, `apps/native`, `packages/runtime`, `packages/voice`.

## Milestones

### Milestone 1 – Async & Error-Safety Remediation

Focus on Biome `lint/suspicious/useAwait`, `lint/suspicious/noConsole`, `lint/correctness/useExhaustiveDependencies`, and `lint/nursery/noShadow`. Prioritize runtime-critical files (`apps/web/src/routes/api/*`, `apps/native/app/(drawer)/ai.tsx`, `packages/runtime/*`).

Key steps:

1. Generate targeted diagnostics: `bunx biome check apps/native/app/(drawer)/ai.tsx apps/web/src/routes/api`. Capture JSON output for references.
2. For each async warning:
   - If the result is required, add `await`.
   - If it must run in background, wrap with `void fn().catch(logger.error)`.
3. Replace `console.*` with shared loggers (`packages/runtime/src/utils/logger.ts`, `packages/api/src/utils/logger.ts`, or a UI alert when on the client).
4. Update React hooks with correct dependency arrays, memoization, or stable callbacks.
5. Add/update tests if behavior changes (e.g., ensuring awaited calls return expected values).

### Milestone 2 – Type Discipline in Voice & Native Modules

Eliminate `lint/suspicious/noExplicitAny` and `lint/nursery/useConsistentTypeDefinitions` by introducing typed primitives for voice queues and drive mode.

Key steps:

1. Create `apps/native/lib/voice/types.ts` with `AudioChunk`, `PendingItem`, `VoiceSessionState`.
2. Swap `any` usages in `apps/native/lib/voice/{queue,session,index}.ts` and drive tabs with these types.
3. Use Zod schemas or TypeScript type guards for untyped inbound payloads (e.g., WebSocket frames).
4. Run `bun test apps/native` (or `bun test` if tests colocated) to ensure behavior unchanged.

### Milestone 3 – Structural Readability Rules

Address `lint/style/useBlockStatements`, `lint/style/noNestedTernary`, and `lint/style/noMagicNumbers` in shared UI.

Key steps:

1. Introduce module-level constants for repeated presentation values (`HEADER_BUTTON_ACTIVE_OPACITY = 0.7`).
2. Rewrite nested ternaries as explicit `if`/`else` or helper render functions.
3. Ensure hooks/components remain pure and memoized according to `.ruler/12-component-development.md`.
4. Verify UI tests or snapshot tests cover restructured components; add tests if missing.

### Milestone 4 – Repository-Wide Autofix & Verification

Once critical categories are resolved, run Biome autofix where safe and verify no regressions.

Steps:

1. `bunx biome check --write apps packages`.
2. Manually review diffs touching generated code or vendored files; revert if necessary.
3. Re-run `bunx biome check . --max-diagnostics 5000 --reporter summary` to confirm zero errors.
4. Run `bun run typecheck && bun test` (or targeted `turbo run test --filter ...`) to ensure no regressions.
5. Update docs (`docs/alfred-prd.md`, `docs/changelog.md`) if lint remediation surfaces user-facing changes (e.g., new UI states).

## Testing & Verification

- On each milestone completion:
  - `bun run typecheck`
  - Targeted `bun test <package>` (e.g., `cd apps/web && bun test` if tests exist).
  - `bunx biome check <touched paths>`
- Final verification: `bun run typecheck && bun test && bunx biome check .`

Document command outputs or notable failures in `Surprises & Discoveries`.

## Progress

Track progress per milestone with timestamps (UTC). Example entries shown; replace `YYYY-MM-DD HH:MMZ` with actual time.

### Milestone 1 – Async & Error-Safety
- [x] (2025-11-19 19:20Z) Replace console usage in `apps/native/app/(drawer)/ai.tsx`
- [x] (2025-11-19 19:24Z) Resolve `useAwait` violations in `apps/web/src/routes/api/assistant/$.ts`
- [x] (2025-11-19 19:24Z) Resolve `useAwait` violations in `apps/web/src/routes/api/orchestrator/$.ts`
- [x] (2025-11-19 19:36Z) Remove redundant `async` wrappers in `apps/web/src/routes/api/stream-handler.ts`
- [x] (2025-11-19 19:37Z) Remove redundant `async` wrappers in `apps/web/src/routes/healthz.ts`
- [x] (2025-11-19 19:38Z) Remove redundant `async` wrappers in `apps/web/src/server/bootstrap.ts`
- [x] (2025-11-19 19:42Z) Create `apps/native/lib/devlog.ts` and route native console usage through it
- [x] (2025-11-19 19:45Z) Replace drive-mode queue logging with `logError`
- [x] (2025-11-19 19:48Z) Remove redundant `async` wrappers in `apps/web/src/lib/token.ts`
- [x] (2025-11-19 19:52Z) Remove redundant `async` wrappers in `packages/agent/assistant/src/mem/preference.ts`
- [x] (2025-11-19 19:55Z) Remove redundant `async` wrappers in `packages/agent/src/lib/proxmox.ts`
- [x] (2025-11-19 19:57Z) Await legacy tool execution in `packages/agent/src/v6.ts`
- [x] (2025-11-19 20:00Z) Remove redundant `async` wrappers in `packages/api/src/metrics.ts`
- [ ] (YYYY-MM-DD HH:MMZ) Audit runtime/agent async utilities for `useAwait`

### Milestone 2 – Type Discipline
- [x] (2025-11-19 20:12Z) Type native TRPC client (`apps/native/utils/trpc.ts`)
- [x] (2025-11-19 20:18Z) Replace dynamic `any` traversal in `apps/native/lib/voice/session.ts` with type guards
- [x] (2025-11-19 20:26Z) Add `apps/native/lib/voice/voice.types.ts`
- [x] (2025-11-19 20:28Z) Remove `any` from `apps/native/lib/voice/queue.ts` and align helpers with new types
- [x] (2025-11-19 20:33Z) Provide typed CarPlay module declaration to replace `any`
- [x] (2025-11-19 20:45Z) Remove `any` usage from `packages/runtime/src/adapters/ai.ts`
- [x] (2025-11-19 20:22Z) Remove casts/`any` from `packages/api/src/ai/normalize.ts` and align tool parts with AI SDK types
- [ ] (YYYY-MM-DD HH:MMZ) Remove `any` from drive tab components
- [ ] (YYYY-MM-DD HH:MMZ) Update or add relevant tests

### Milestone 3 – Structural Readability
- [x] (2025-11-19 20:29Z) Refactor `apps/native/components/header-button.tsx`
- [x] (2025-11-19 20:25Z) Replace ternaries in `apps/native/app/(drawer)/index.tsx`
- [x] (2025-11-19 20:27Z) Replace nested ternaries in `apps/native/app/(drawer)/todos.tsx`
- [x] (2025-11-19 20:30Z) Address native voice lint (capture/index barrel, no-block statements)
- [x] (2025-11-19 20:31Z) Clean `apps/web/src/components/chat-container.tsx` imports/hooks/props ordering
- [x] (2025-11-19 20:34Z) Format + organize `apps/web/src/components/autonomy-slider.tsx`
- [x] (2025-11-19 20:36Z) Refactor `apps/web/src/components/chat-render.tsx` (complexity, imports)
- [ ] (YYYY-MM-DD HH:MMZ) Verify component tests (or document absence)
- [x] (2025-11-19 21:05Z) Reduce complexity and lint noise in `apps/web/src/routes/orchestrator/run.tsx`

### Milestone 4 – Autofix & Final Checks
- [ ] (YYYY-MM-DD HH:MMZ) Run `bunx biome check --write` and review diffs
- [ ] (YYYY-MM-DD HH:MMZ) Final `bunx biome check .` passes
- [ ] (YYYY-MM-DD HH:MMZ) Final `bun run typecheck && bun test` passes
- [ ] (YYYY-MM-DD HH:MMZ) Update docs/changelog if required

## Surprises & Discoveries

- (YYYY-MM-DD HH:MMZ) _None yet._

Add entries as issues arise; describe cause, impact, and mitigation.

## Decision Log

- (2025-11-19) Use shared registry from `@alfred/metrics/registry` to avoid cross-package imports (pre-existing, documented for completeness). Future lint fixes must respect the same boundary.
- (2025-11-19) Prioritize lint remediation order as async safety → type discipline → readability so regressions that affect runtime correctness are addressed before stylistic cleanups.
- (YYYY-MM-DD) Pending decisions go here with reasoning.

## Outcomes & Retrospective

Populate after completion, summarizing impact, test evidence, and any follow-up work.
