# droid-resume

Owner: execution

The droid router now supports obligation-aware suspend/resume flows so biometric elevation can complete without restarting executions.

## Flow Summary

- `droid.run` or `droid.stream` evaluate policy + PDP and may return obligations instead of executing.
- When obligations exist, the server registers a resumable run, emits the structured payload `{ reason, obligations, runId }`, and suspends work.
- The client prompts for biometric elevation, then calls `droid.resume` with the `runId` and elevated `authz` token.
- On resume, the server re-evaluates policy, restarts the underlying process, and either returns buffered stdout/stderr (run) or pushes output through the existing stream connection.

## Streaming Behaviour

- Streams stay open after the obligation event; clients must watch for `type: "obligation"` messages and cache the `runId`.
- After `droid.resume` succeeds, the same subscription receives a `type: "resume"` marker followed by live `stdout`/`stderr` and `exit` events.
- If the owning instance disappears before resume, the server falls back to `event: "ready"` in the resume response and the client may reissue the stream manually.

## Persistence & Observability

- Pending runs are stored under `droid:pending:<runId>` with a 30-minute TTL, exposing prompt metadata for dashboards.
- Resume completions land at `droid:resume:<runId>:result` for 15 minutes so operators can audit outcomes.
- Run registry metrics (`run_registry_*`) reflect registrations, resume dispatches, and deliveries; alert when misses increase.
- A scheduled cleanup job (`packages/api/src/workers/droid-pending-cleanup.ts`) scans `droid:pending:*`, removes stale entries, and unregisters forgotten runs while emitting `droid_pending_runs` + `droid_pending_cleanup_total` metrics.

## Client Checklist

1. Call `droid.run`/`droid.stream` normally; if you receive `PRECONDITION_FAILED` (run) or an `obligation` event (stream), surface biometric UI.
2. Perform elevation to mint a new `authz` value scoped for `droid.exec` with `mfa="passkey"`.
3. Invoke `droid.resume({ runId, authz })`.
4. Resume response semantics:
   - `result` object → prior run completed while suspended.
   - `event: "ready"` → reattach/await stream data (fallback).
   - No payload → original stream will begin emitting immediately; keep listening.
5. Handle timeout/cancel by calling `runRegistry.dispatchCancel` (API TODO) or letting TTL expire.
