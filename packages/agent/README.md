# @alfred/agent

AI SDK v6 tooling surface for ALFRED.

## Responsibilities

- Expose assistant and orchestrator tool registries (`buildAssistantTools`, `buildOrchestratorTools`) for API consumers.
- Configure model access helpers (`getOpenAI`, `getModelId`) so callers share provider wiring.
- Publish metrics hooks used by the API package (tool counters, deployment timers, etc).

## Local Development

```
bun run typecheck --filter @alfred/agent
bun test --filter @alfred/agent
```

Set `OPENAI_API_KEY` (or compatible provider keys) and tool-specific env vars per `config/env.example`. Tool executors rely on service-specific settings (Docker, Git, Router, etc).

## JS Artifacts

Several orchestrator and security modules are imported via `.js` paths so Codex runtimes can execute them without a TypeScript loader. After editing any matching `.ts` source under `packages/agent/src/**`, run `bun run tools:sync-js` to regenerate the sidecar `.js` files (pre-commit hooks run it automatically). CI calls `bun run tools:sync-js:check`, so keeping the artifacts in sync locally avoids drift and flaky Codex executions.

## Next Steps

- Flesh out the assistant `home` tool and orchestrator toolset with production integrations.
- Reintroduce end-to-end workflow orchestration on top of the AI SDK scaffolding.
- Add structured tool-result replay helpers once the storage schema is finalized.
