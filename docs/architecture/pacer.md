# pacer

Owner: runtime, web

ALFRED standardizes debouncing/throttling/batching/queueing behind `@alfred/pacer` and `@alfred/pacer/react`.

## Where Pacer is the standard

- **UI (web/native)**: debounce/throttle hooks and utilities (`@alfred/pacer/react`, `@alfred/pacer`).
- **Pipeline observers**: batching/queueing observer side-effects (e.g. Linear syncing) via `@alfred/pacer`.

## Non-obvious gotchas (so you don’t rediscover them)

- **TypeScript project references**: new workspace packages added to root `tsconfig.json` must be `composite: true` (or TS will error with `TS6306`).
- **Test runner behavior**: `scripts/test-bun.ts` skips `dist/` paths; avoid relying on emitted `dist/test` copies being executed.
- **Async init + buffering**: if an observer buffers events while dependencies load (dynamic import), explicitly flush after the dependency becomes available to avoid “completed before init” drops.

## Where explicit guards remain required

These are security / edge controls and should remain purpose-built for now:

- SSE connection caps/rate limiting: `packages/api/src/utils/sse-connections.ts`
- Voice WS upgrade caps/rate limiting: `packages/api/src/voice/streaming.ts`
- tRPC rate limiting middleware: `packages/api/src/trpc.ts`
- LLM concurrency + token bucket: `packages/agent/src/utils/rate-limiter.ts`

## References

- TanStack Pacer overview: `https://tanstack.com/pacer/latest/docs/overview`
- Utility selection: `https://tanstack.com/pacer/latest/docs/guides/which-pacer-utility-should-i-choose`
