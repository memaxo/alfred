# Transport Parity

**Owner:** web/api  
**Status:** Implemented (2026-01-28)

## Purpose

Enable seamless switching between assistant and orchestrator backends while maintaining identical streaming behavior.

## Pattern

```
Chat UI ──┬──→ /api/assistant ──→ Assistant Agent (≤5 tools)
          │
          └──→ /api/orchestrator ──→ Orchestrator Agent (≤5 tools)
```

Both endpoints produce AI SDK v6 UIMessage streams with identical part types:

- `text` — Response content
- `tool-call` — Tool invocation
- `tool-result` — Tool execution result
- `reasoning` — Chain-of-thought (if enabled)

## Implementation

### Web Layer

```typescript
// useChatLogic.ts
const apiBase =
  currentAgent === "assistant" ? "/api/assistant" : "/api/orchestrator";

const { messages, send } = useAssistantStream({ api: apiBase });
```

### API Layer

- `/api/assistant` → `handleAssistantRequest()` in `packages/api`
- `/api/orchestrator` → `handleOrchestratorRequest()` in `packages/api`

Both use `toUIMessageStreamResponse()` for consistent SSE formatting.

## Verification

Tests in `apps/web/src/tests/routes/transport-parity.test.ts` verify:

- Both endpoints accept identical UIMessage format
- Both return `Cache-Control: no-store` headers
- Both produce compatible streaming responses
- Hook correctly swaps endpoints when `handleAgentChange()` is called

## See Also

- `.ruler/15-ai-sdk-v6.md` — Streaming standards
- `docs/execplans/alfred-web-unification.md` — Milestone 3 spec
