# tanstack-start-audit-closeout

Owner: web

## Purpose

Close out the TanStack Start adherence audit with **verifiable checks** (tests + curl) for SSR boundaries, caching headers, and streaming safety.

## What is verified (contract)

- **`.well-known` OAuth discovery**
  - Routes exist in the generated route tree.
  - Responses are cacheable: `Cache-Control: public, max-age=3600`.
  - Tests: `apps/web/src/tests/routes/well-known.route.test.ts`.

- **Operational endpoints are never cached**
  - `/healthz`, `/healthz/deps`, `/api/metrics`: `Cache-Control: no-store`.
  - Tests: `apps/web/src/tests/routes/operational.route.test.ts`.

- **Streaming endpoints never cache**
  - `/api/assistant/*` and `/api/orchestrator/*` set `Cache-Control: no-store` on:
    - validation errors
    - session errors
    - rate limiting
    - successful SSE responses
    - unexpected errors (route-level catch)
  - Test evidence:
    - `apps/web/src/lib/api/__tests__/stream-handler.refresh.test.ts` asserts `Cache-Control: no-store` on the **200** stream response.
    - `apps/web/src/lib/api/__tests__/stream-handler.auth.test.ts` asserts `Cache-Control: no-store` on the **401** session-required path.

## Non-regression guardrails

- **No `process.env` in client-reachable state**
  - Stores: `apps/web/src/tests/boundaries/store-env.test.ts`
  - Components: `apps/web/src/tests/boundaries/components-env.test.ts`

- **No `@vite-ignore` on aliased `@/…` imports inside routes**
  - Guardrail: `apps/web/src/tests/boundaries/routes-viteignore.test.ts`
  - Rationale: `@vite-ignore` disables Vite resolution; `@/…` relies on Vite/tsconfig aliasing.

## How to re-verify locally (dev)

### Headers (non-streaming)

```bash
curl -si "http://localhost:3001/.well-known/oauth-authorization-server" | sed -n '1,20p'
curl -si "http://localhost:3001/.well-known/oauth-protected-resource" | sed -n '1,20p'
curl -si "http://localhost:3001/healthz" | sed -n '1,20p'
curl -si "http://localhost:3001/healthz/deps" | sed -n '1,20p'
curl -si "http://localhost:3001/api/metrics" | sed -n '1,20p'
```

### SSE headers (authenticated)

The streaming routes require an authenticated session (copy your `Cookie` from DevTools).

```bash
curl -iN \
  -X POST "http://localhost:3001/api/assistant/test" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste-cookie>" \
  --data '{"messages":[{"id":"msg-1","role":"user","parts":[{"type":"text","text":"hi"}]}]}'
```

Expected: response headers include **`Cache-Control: no-store`**.

## How to re-verify in CI

From `apps/web/`:

```bash
bun run test
```

