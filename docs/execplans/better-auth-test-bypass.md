# Reliable Test Auth Bypass

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Goal: make every integration, smoke, and Playwright suite run without reaching the real Better Auth service or Postgres. After this work, a contributor can run `bun test` (Vitest/Bun suites) and `bunx playwright test` locally or in CI with deterministic auth behavior, while still having the option to hit the real backend when explicitly requested. Acceptance is observed by running the suspend → biometric → resume Playwright spec and Mindscape component tests without network access to Better Auth; both should pass using the new bypass.

## Progress

- [x] Capture current auth call sites and confirm failure modes in tests.
- [x] Implement shared test auth facade (custom fetch + session helpers) and guard UI components against null sessions.
- [ ] Wire Playwright + Bun test harnesses to set deterministic sessions; update docs and rerun suites.

## Surprises & Discoveries

- Mindscape’s server-side frame loader ignored `VITE_TEST_MODE` because `process.env` is unset under DevServer; we now also treat the test-session header as the decisive signal, but the Playwright suite still needs a deterministic TRPC stub to avoid relying on the real knowledge graph.
- Starting the Vite dev server repeatedly registers Prometheus metrics (`runtime_executions_total`), causing cascading reloads that make `bunx playwright` flake after the first failure. Until the registry learns to de-duplicate, the suite requires a clean server start per run.

## Decision Log

- Added `@/lib/test-auth` as the single entrypoint for issuing, serializing, and installing test sessions; `auth-client.ts` now always instantiates through that shim so that SSR/header plumbing stays centralized.
- Playwright helper still exposes the UI-based sign-up path as a fallback because the deterministic session injection path is blocked by the missing Mindscape TRPC stub. We gate the new bypass behind env toggles until the data stub lands.

## Outcomes & Retrospective

- Shared helpers exist and Bun suites can run without Better Auth/Postgres; Playwright still depends on the legacy login because the Mindscape initial frame stub is unfinished. Next step is stubbing `/api/trpc/mindscape.initial` (or equivalent) so the deterministic session can render the canvas without the DB.

## Context and Orientation

Better Auth is consumed through `apps/web/src/lib/auth-client.ts`, which instantiates the SDK via `createAuthClient`. UI components such as `apps/web/src/components/user-menu.tsx` call `authClient.useSession()` to fetch the current user. Tests invoke `signUpTestUser` in `apps/web/tests/helpers/auth.ts`, which navigates to `/login` and relies on real backend responses. The Playwright server is launched through `bun run dev:test`, which loads routes under `apps/web/src/routes`. When Better Auth or Postgres are unavailable, `/login` throws before rendering, causing timeouts.

The repo already has a TRPC test server harness under `apps/web/src/test/server.ts`, and test utilities live in `apps/web/src/test`. There is no shared mock for auth today; Playwright currently intercepts a few HTTP endpoints but SSR still sees `null` sessions, crashing components.

### Auth client call sites (rg -n "authClient" apps/web/src on 2025-11-24)

- `apps/web/src/test/auth.ts`
- `apps/web/src/lib/auth-client.ts`
- `apps/web/src/components/sign-in-form.tsx`
- `apps/web/src/lib/token.ts`
- `apps/web/src/components/sign-up-form.tsx`
- `apps/web/src/components/biometric-challenge-dialog.tsx`
- `apps/web/src/components/user-menu.tsx`
- `apps/web/src/components/mindscape/nodes/profile-node.tsx`
- `apps/web/src/hooks/use-biometric-resume.ts`

## Plan of Work

First, audit every usage of `authClient` to confirm which surfaces need session data during tests. Focus on `apps/web/src/lib/auth-client.ts`, `apps/web/src/components/user-menu.tsx`, and helpers under `apps/web/tests/helpers`. Document the list inside this plan so contributors know what to patch.

Second, implement a test-only auth facade:

- Create `apps/web/src/lib/test-auth.ts` exporting `issueTestSession(userOverrides)` and `installTestAuthClient()`. It should wrap Better Auth’s `createAuthClient` with a `customFetchImpl` that routes requests to `auth.api` handlers directly when `VITE_TEST_MODE === "true"` (per Better Auth docs). Provide helpers to serialize a session into headers (`x-alfred-test-session`) so SSR can short-circuit without reaching the network.
- Update `apps/web/src/lib/auth-client.ts` to detect `VITE_TEST_MODE` and, if a `globalThis.__TEST_SESSION__` exists, return a proxy client whose `getSession`/`useSession` resolve to that object. Fall back to the real SDK otherwise.
- Guard `apps/web/src/components/user-menu.tsx` (and any other consumer) so it gracefully renders a skeleton when no session is available.

Third, wire test harnesses:

- For Bun/Vitest suites, add a helper (`apps/web/src/test/auth.ts`) that sets `global.__TEST_SESSION__` before rendering, using the facade’s `issueTestSession`. Update existing integration tests (e.g., `mindscape.workflow-navigation.integration.test.tsx`) to call this helper in `beforeEach`.
- For Playwright, extend `apps/web/tests/helpers/auth.ts` to call `page.addInitScript` and set both `window.__TEST_SESSION__` and `sessionStorage` before navigation. Add `page.route` handlers for `/api/auth/*` only as a fallback; the primary path should be the injected session recognized by the SSR short-circuit.
- Ensure `bun run dev:test` also sees the session header. Update the dev server middleware (in `apps/web/src/routes`) to read `x-alfred-test-session` from requests and feed it into the Better Auth context.

Fourth, document the toggle. Add an environment variable (`PLAYWRIGHT_REAL_AUTH=1` or similar). When set, skip the bypass to allow full-stack testing. Update `.env.example`, `docs/execplans/ui-testing-coverage-improvements.md`, and any relevant README to explain how to switch modes.

## Concrete Steps

1. From repository root, run `rg -n "authClient" apps/web/src` and list files that call `useSession` or `getSession`; paste the list into this plan’s context section as validation evidence.
2. Implement `apps/web/src/lib/test-auth.ts` and modify `auth-client.ts` accordingly. No commands yet.
3. Update `apps/web/src/components/user-menu.tsx` and any other guards; run `bun run lint:web` if available.
4. Modify Playwright helper `apps/web/tests/helpers/auth.ts`: inject session via `page.addInitScript`. Re-run `bunx playwright test --config apps/web/playwright.config.ts --project=e2e mindscape.droid-resume.e2e.spec.ts` to confirm.
5. Adjust Bun/Vitest helpers (`apps/web/src/test/...`) and run `bun test apps/web/src/components/__tests__/droid-node.integration.test.tsx`.
6. Update docs (.env example, testing guides) and commit.

## Validation and Acceptance

- `bun test apps/web/src/components/__tests__/droid-node.integration.test.tsx` passes without touching network.
- `bunx playwright test --config apps/web/playwright.config.ts --project=e2e mindscape.droid-resume.e2e.spec.ts` succeeds on a machine without Better Auth running.
- Starting the dev server with `VITE_TEST_MODE=true bun run dev:test` shows `/login` immediately with a test user avatar, demonstrating SSR sees the injected session. Set `PLAYWRIGHT_REAL_AUTH=1` and confirm the flow hits real endpoints again.

## Idempotence and Recovery

All changes are additive and guarded by env flags; re-running the helpers simply overwrites the global test session. If a test still hits real auth accidentally, verify `VITE_TEST_MODE` is set; toggling it off/on is safe. No migrations or destructive steps are involved.

## Artifacts and Notes

- Pending.

## Interfaces and Dependencies

- `apps/web/src/lib/test-auth.ts` must export:

    interface TestSession {
        id: string;
        email: string;
        name: string;
    }

    export function issueTestSession(overrides?: Partial<TestSession>): TestSession

    export function installTestAuthBridge(session: TestSession): void

- `apps/web/src/lib/auth-client.ts` must read from `globalThis.__TEST_SESSION__?: { data: { user: TestSession } }` when `import.meta.env.VITE_TEST_MODE === "true"`.
- Playwright helpers must set `window.__TEST_SESSION__` via `page.addInitScript` and pass the serialized session in a `x-alfred-test-session` header so SSR can hydrate.
