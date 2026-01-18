# Pacer Standards

## Rules

1. **Single import surface.** Use `@alfred/pacer` (core) and `@alfred/pacer/react` (React) for debouncing/throttling/batching/queueing; do not introduce new ad-hoc helpers in apps/packages.
2. **UI migrations are API-preserving.** When replacing UI utilities, keep existing exported function/hook signatures and behavior as defined by existing tests.
3. **Observers only.** Use Pacer in pipeline observers for internal buffering/batching, not for pipeline stage orchestration or core execution semantics.
4. **Do not replace edge guards.** Do not use Pacer for SSE/WS/tRPC/LLM security and quota limiters; keep purpose-built guards in `packages/api` and `packages/agent`.
5. **Import safety.** Observer pacing must not introduce new always-on timers; keep existing `setInterval(...).unref()` patterns and ensure any async initialization flushes buffered work once ready.
6. **Testing.** Add focused unit tests that assert behavioral equivalence (debounce/throttle semantics, observer flush timing) rather than snapshotting internal Pacer state.

