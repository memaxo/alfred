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

## Next Steps

- Flesh out the assistant `home` tool and orchestrator toolset with production integrations.
- Reintroduce end-to-end workflow orchestration on top of the AI SDK scaffolding.
- Add structured tool-result replay helpers once the storage schema is finalized.
