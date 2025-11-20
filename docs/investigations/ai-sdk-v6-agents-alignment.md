# AI SDK v6 Agents Alignment Analysis

**Date:** 2025-11-20  
**Status:** In Progress (Implementation underway)  
**Scope:** Document how ALFRED’s AI SDK v6 integration now works, confirm alignment with official ToolLoopAgent guidance, and outline any remaining follow ups.

## Executive Summary

Routers and streaming handlers now share configuration through cached `ToolLoopAgent` instances defined in `packages/agent/src/agents.ts`. Each request calls `generateText` or `streamText` directly while spreading the agent defaults so that per-request overrides (`toolChoice`, `maxSteps`, `system`, `abortSignal`) remain available—consistent with the official ToolLoopAgent API, which only accepts `prompt` or `messages`. Agents still expose `assistantAgent`/`orchestratorAgent` for `InferAgentUIMessage` typing, and `prepareStep` callbacks trim history before each loop iteration. The only remaining gaps are optional conveniences (`createAgentUIStreamResponse`) and continued rollout of agent-specific UI types in every surface.

**Key Findings**
- ✅ `packages/agent/src/agents.ts` centralizes model, tools, `stopWhen`, and `prepareStep`, while `get*AgentDefaults()` re-reads env-configured models per call to preserve hot-swapping.
- ✅ `packages/api/src/routers/{assistant,orchestrator}.ts` validate `UIMessage[]`, convert via `convertToModelMessages`, and call `generateText({ ...getDefaults(), ...overrides })`, keeping `persistResult()` intact.
- ✅ `apps/web/src/routes/api/stream-handler.ts` shares a handler for both agents, validates messages with `uiMessageSchema`, injects dynamic preference prompts, and calls `streamText({ ...getDefaults(), system, abortSignal })`.
- ✅ UI hooks (`useAssistantStream`) and tests import `AssistantUIMessage`/`OrchestratorUIMessage`, improving tool-call typing.
- ⚠️ Optional enhancements (agent instructions, `createAgentUIStreamResponse`, more advanced `prepareStep` logic) remain future work.

## 1. Current Implementation Analysis

### 1.1 Agent Configuration (`packages/agent/src/agents.ts`)
- Two ToolLoopAgent instances (`assistantAgent`, `orchestratorAgent`) capture shared configuration.
- `assistantPrepareStep` / `orchestratorPrepareStep` trim message history before each loop step, matching the documented `prepareStep({ stepNumber, steps, messages })` signature.
- `getAssistantAgentDefaults()` / `getOrchestratorAgentDefaults()` rebuild the `model` on every call but reuse cached `tools`, `stopWhen`, and `prepareStep`, so runtime env changes to `AI_MODEL` or `OPENAI_*` take effect without restarts.
- `InferAgentUIMessage` exports feed UI hooks/tests for type-safe streams.

### 1.2 Assistant Router (`packages/api/src/routers/assistant.ts`)
- Validates incoming messages with `uiMessageSchema` per `.ruler/15-ai-sdk-v6.md`.
- Converts to model messages, derives `stopWhen` from user-provided `maxSteps` or agent default, and calls `generateText` with `{ ...defaults, toolChoice, stopWhen }`.
- `persistResult()` still records deterministic replays.
- `prepareStep` now propagates automatically because it is part of the defaults spread.

### 1.3 Orchestrator Router (`packages/api/src/routers/orchestrator.ts`)
- Mirrors the assistant router pattern, enforcing the same validation, overrides, and persistence logic.
- Shares the same test helpers (`packages/api/test/orchestrator.router.test.ts`) to verify that `prepareStep` reaches `generateText`.

### 1.4 Streaming Handler (`apps/web/src/routes/api/stream-handler.ts`)
- Shared `handleStreamRequest` accepts either agent’s `getDefaults` function.
- Validates request body, truncates history (`pruneMessagesForStream`), injects preference prompts via `buildPreferenceSystemPrompt`, and streams via `streamText({ ...defaults, system, abortSignal, prepareStep })`.
- Uses `toUIMessageStreamResponse` for SSE responses and persists transcript chunks after completion.

### 1.5 UI & Tests
- `AssistantUIMessage` is used across hooks, components, and mock utilities; orchestrator UI adoption is underway for the remaining views.
- Router tests now ensure `prepareStep` is passed downstream, protecting the loop-control contract.

## 2. Alignment With AI SDK v6 Documentation

| Topic | Official Guidance | ALFRED Implementation |
| --- | --- | --- |
| Agent methods | `agent.generate()` / `agent.stream()` accept only `prompt` or `messages` (`docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md`). | We keep calling `generateText` / `streamText` directly when per-request overrides (toolChoice, system prompts, abort signals) are required, while spreading agent defaults. |
| Message conversion | Use `convertToModelMessages` with validated UI messages (`docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md`). | Routers & stream handler validate with `uiMessageSchema` then convert before calling SDK APIs. |
| Loop control | `stopWhen` and `prepareStep` receive `{ model, stepNumber, steps, messages }` (`docs/reference/ai-sdk-v6/agents_loop-control.md:409`). | Prepare-step callbacks only inspect those parameters and return trimmed message arrays, avoiding request-context leakage. |
| Streaming utilities | `toUIMessageStreamResponse` and `consumeStream` manage SSE responses (`docs/reference/ai-sdk-v6/reference_ai-sdk-ui_create-ui-message-stream-response.md`). | The shared handler uses these helpers; `createAgentUIStreamResponse` remains optional future work. |
| Type inference | `InferAgentUIMessage<typeof agent>` recommended for UI hooks. | Adopted for assistant flows; orchestrator UI migration is ongoing. |

## 3. ALFRED Rule Compliance Check

- **Naming:** All new files (`agents.ts`, UI hooks) maintain single-word filenames; no route naming violations.
- **Architecture:** Flow remains `packages/agent` (config) → `packages/api` (routers) → `apps/web` (HTTP/SSE). No inward dependency violations.
- **Purity & Performance:** `prepareStep` keeps loops deterministic and under the `<100 µs` transition budget by just trimming arrays. Tool maps remain cached to avoid repeated allocations.
- **Error Handling:** Validation errors return structured responses; persistence failures are logged with prefixes per `.ruler/16-error-handling.md`.
- **Type Safety:** No `any` escapes were introduced. Tests confirm schema validation and `prepareStep` wiring.

## 4. Migration Strategy (Updated)

### Phase 1 – Agent Instances (Complete)
- ✅ Create `packages/agent/src/agents.ts`, instantiate ToolLoopAgents, export `get*AgentDefaults()` and `InferAgentUIMessage` aliases.
- ✅ Ensure defaults rebuild `model` on demand while sharing cached `tools`/`stopWhen`/`prepareStep` references.

### Phase 2 – Router Updates (Complete)
- ✅ Routers fetch defaults once per request, still call `generateText` directly for overrides, and keep `persistResult()`.
- ✅ Tests assert `prepareStep` is forwarded.

### Phase 3 – Streaming Updates (Complete)
- ✅ Shared handler now accepts a `getDefaults` factory, validates messages, injects preference prompts, and calls `streamText` with overrides.
- ✅ Applies to both `/api/assistant` and `/api/orchestrator` routes.

### Phase 4 – Optional Enhancements (Planned)
1. Consider adding agent-level `instructions` for static guidance while keeping dynamic per-user prompts via `system` overrides.
2. Evaluate `createAgentUIStreamResponse` once router + HTTP transport requirements relax.
3. Expand `prepareStep` callbacks (e.g., dynamic tool bias) using only the documented parameters.

### Phase 5 – Type Safety Rollout (In Progress)
- Continue replacing generic `UIMessage` usages with agent-specific message types in remaining UI components and tests.

## 5. Risk Assessment

| Risk | Status | Mitigation |
| --- | --- | --- |
| Loss of per-request overrides if switching to `agent.generate()` directly | Avoided by keeping manual `generateText` / `streamText` calls. Documented in router comments. |
| Model/env changes requiring restart | Resolved; defaults rebuild the `model` per call. Tool maps remain cached for performance. |
| `prepareStep` misuse (accessing request context) | Callbacks limit themselves to `{ messages, steps }`. Tests ensure the function is included in every call. |
| Streaming divergence between assistant/orchestrator | Shared handler + `getDefaults` ensure parity. |
| Type drift in UI | Partial migration completed; remaining components tracked in Phase 5. |

## 6. Implementation Checklist

- [x] ToolLoopAgent instances + exports
- [x] Router wrappers keeping overrides + persistence
- [x] Shared streaming handler using defaults
- [x] Message validation in all entry points
- [ ] Optional agent instructions / structured outputs
- [ ] Complete UI adoption of `AssistantUIMessage` / `OrchestratorUIMessage`

## 7. Specific Questions Answered

1. **Why not call `agent.generate()` directly?**  
   Because ToolLoopAgent methods only accept `prompt`/`messages`. We need per-request `toolChoice`, `stopWhen`, `system`, and `abortSignal`, so we spread the agent defaults into `generateText`/`streamText` instead.

2. **How do we preserve per-request overrides?**  
   Routers derive `stopWhen` from user inputs, pass through `toolChoice`, and streaming handlers inject dynamic `system` prompts. Overrides simply sit alongside the spread defaults.

3. **How is `prepareStep` used safely?**  
   Callbacks only examine `{ messages, steps }` to trim history, matching AI SDK guidance. Request-scoped data stays in the `system` prompt when invoking `generateText`/`streamText`.

4. **What about streaming persistence?**  
   `handleStreamRequest` still persists both the initial and streamed messages via `conversationRepo`, logging failures without aborting the stream.

5. **Are models still hot-swappable?**  
   Yes. `get*AgentDefaults()` re-evaluates `getOpenAI().chat(getModelId())` every time, so changing `AI_MODEL` applies immediately; only tool maps stay cached.

## 8. References

- [`ToolLoopAgent` reference](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md)
- [`generateText`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md)
- [`streamText`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md)
- [`convertToModelMessages`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md)
- [`prepareStep` + loop control](docs/reference/ai-sdk-v6/agents_loop-control.md)
- ALFRED internal rules: `.ruler/01-naming-conventions.md`, `.ruler/02-architecture.md`, `.ruler/15-ai-sdk-v6.md`, `.ruler/16-error-handling.md`
