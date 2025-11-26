# Codex Error Sanitization

This ExecPlan is a living document. Maintain it per `.agent/PLANS.md`; update every section (especially `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`) the moment work advances.

## Purpose / Big Picture

This change targets ALFRED itself: the Codex orchestrator APIs must stop leaking SDK internals to end users. Today, any Codex execution failure streams the raw SDK exception back to clients, revealing file paths and stack traces. After this work, ALFRED's codex run endpoints will surface only high-level, user-friendly error codes while retaining detailed logs (with correlation IDs) on the server for debugging.

## Progress

- [x] (2025-11-26 18:25Z) Drafted ExecPlan describing scope, constraints, and validation path.
- [x] (2025-11-26 18:45Z) Implemented sanitized stderr handling and tagged runtime failures inside `packages/agent/src/orchestrator/tool/codex/exec.ts` (generic stderr output, logger traces, consistent `codex_exec_failed` prefix).
- [ ] Introduce shared `sanitizeCodexError` helper plus correlation-ID aware logging in `packages/api/src/routers/codex.ts`; refactor run + stream procedures to use it.
- [ ] Update `packages/api/src/routers/codex-intent.ts` to reuse the helper and return sanitized TRPC errors.
- [ ] Add regression tests proving sanitized responses and absence of internal details; run relevant test suites.
- [ ] Final validation + retrospective.

## Surprises & Discoveries

- None yet; populate as implementation surfaces new information.

## Decision Log

- Decision: Capture raw Codex SDK error payloads in `exec.ts` logs while emitting only generic stderr text to clients.
  Rationale: Streaming consumers receive stderr directly from the tool; sanitizing at the source prevents leaks even if API callers bypass router helpers, while logs still retain diagnostic detail.
  Date/Author: 2025-11-26 / Coding agent

## Outcomes & Retrospective

- To be filled after final validation.

## Context and Orientation

The Codex orchestrator lives in `packages/agent/src/orchestrator/tool/codex`. The execution entrypoint (`exec.ts`) interacts with the OpenAI Codex SDK, streams events, and forwards stderr to API writers. The API layer exposes two relevant routers under `packages/api/src/routers`: `codex.ts` (general run + stream) and `codex-intent.ts` (intent-based prompt builder). Both routers currently forward raw `Error.message` strings to clients. Testing happens under `packages/api/test`, powered by Bun/Vitest via helpers like `createTestCaller`.

## Plan of Work

1. **Harden tool stderr emission (`exec.ts`).** Import `logger` to capture raw SDK error payloads server-side. Ensure `turn.failed` and `error` events write generic stderr messages (no SDK details) while logging the detailed payload. Tag runtime failures thrown from these events with the `codex_exec_failed:` prefix so sanitization can detect them consistently.
2. **Introduce sanitization + correlation helper (`codex.ts`).** Define `sanitizeCodexError(error: Error)` that maps `codex_exec_failed:*`, `codex_exec_timeout`, and `biometric_required` to explicit user-facing codes/messages with `internal_error` fallback. Add a helper (e.g., `handleCodexError`) that generates a `randomUUID` correlation ID, logs the original error via `logger.error`, invokes `sanitizeCodexError`, and returns the sanitized payload plus ID. Update both the `run` mutation and `stream` subscription to wrap `toolCodex.execute` in try/catch, emit sanitized errors (including `code` + `correlationId`), and throw `TRPCError`s whose messages append the correlation ID so clients can cite it.
3. **Reuse helper in `codex-intent.ts`.** Replace the bespoke try/catch with the shared helper so intent runs also log, sanitize, and expose the correlation ID while still returning `PRECONDITION_FAILED` for biometric requirements.
4. **Testing.** Add new Bun tests under `packages/api/test` that mock `toolCodex.execute` to throw representative errors. Assert that the resulting TRPC errors (for both `codex.run` and `codexIntent.run`) contain the friendly message and omit internal substrings. Also assert that the emitted stream error payload exposes the sanitized code/message plus a correlation ID. Extend tests to cover helper function edge cases if needed.
5. **Validation.** Run targeted test suites (at least the new tests plus affected router tests) via `bun test packages/api/test/<file>.test.ts` or `bun test packages/api/test`. Confirm no TypeScript or lint regressions are introduced.

## Concrete Steps

1. Edit `packages/agent/src/orchestrator/tool/codex/exec.ts`:
   - Import `logger`.
   - When handling `turn.failed` or `error` events, log `event.error` details and emit standard stderr text instead of `event.error.message`.
   - Wrap runtime failures from `event.message` with the `codex_exec_failed:` prefix for uniform downstream handling.
2. Modify `packages/api/src/routers/codex.ts`:
   - Define and export `sanitizeCodexError` and a `buildCodexErrorResponse` helper.
   - Wrap both `run` and `stream` bodies in try/catch using the helper, ensuring `emit.next` / return payloads include sanitized codes and correlation IDs.
3. Update `packages/api/src/routers/codex-intent.ts` to import and reuse the helper, simplifying its error handling while keeping biometric errors mapped to `PRECONDITION_FAILED`.
4. Add tests (`packages/api/test/codex.router.test.ts`, etc.) that mock `toolCodex.execute` failures and verify sanitized outputs for run, stream, and intent routes.
5. Execute Bun tests for the new suites and any impacted areas.

## Validation and Acceptance

- Run `bun test packages/api/test/codex.router.test.ts` to ensure the codex run + stream sanitization behaves as expected (tests should fail before the change and pass afterward).
- Run `bun test packages/api/test/codex-intent.test.ts` (updated or new cases) to confirm sanitized intent failures.
- Optionally run `bun test` within `packages/api` to guard against collateral regressions if runtime allows.

## Idempotence and Recovery

All code edits are additive or localized. Re-running tests is safe. If mocking `toolCodex` disrupts other suites, reset via `vi.resetModules()` or rerun `bun test` fresh. No migrations or persistent side effects are involved.

## Artifacts and Notes

To be populated (e.g., sanitizer diff excerpts, test logs) if discoveries arise during implementation.

## Interfaces and Dependencies

- New helper signature in `packages/api/src/routers/codex.ts`:

    sanitizeCodexError(error: Error): { code: string; message: string }
    buildCodexErrorResponse(error: unknown, scope: string): {
      sanitized: { code: string; message: string };
      correlationId: string;
      trpcCode: "PRECONDITION_FAILED" | "INTERNAL_SERVER_ERROR";
    }

- `packages/agent/src/orchestrator/tool/codex/exec.ts` continues exporting `executeWithSdk` but now ensures errors thrown on the streaming path consistently start with `codex_exec_failed:` and only emit generic stderr text to clients.
