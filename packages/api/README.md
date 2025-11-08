# @alfred/api

tRPC routers, policy middleware, and streaming adapters for the ALFRED assistant.

## Responsibilities

- Publish the root router (`appRouter`) wiring assistant, orchestrator, workflow, and domain routers.
- Provide request context creation (`src/context.ts`) and policy enforcement (`src/gate.ts`).
- Emit AI SDK v6 streaming responses for assistant/orchestrator HTTP routes.
- Export metrics helpers for both HTTP and streaming surfaces.

## Local Development

```
bun run typecheck --filter @alfred/api
bun test --filter @alfred/api
```

The package expects `DATABASE_URL`, auth secrets, and model keys configured as documented in `config/env.example`.

## Next Steps

- Implement orchestrator/home router logic once integrations are ready.
- Surface policy obligations through HTTP errors so the UI can prompt for biometric elevation.
- Add integration smoke tests for each router using the tRPC caller utilities.
