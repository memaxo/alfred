# AI SDK v6 Agents Alignment Analysis

**Date:** 2025-01-27  
**Status:** Analysis Complete  
**Scope:** Current ALFRED agents implementation vs AI SDK v6 `ToolLoopAgent` patterns

## Executive Summary

The current ALFRED implementation calls [`generateText`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md) with optional [`stepCountIs`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md) stop conditions in the tRPC routers, while the streaming endpoint uses [`streamText`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md) without additional loop control but with per-request preference prompts. Although this setup is correct, it scatters shared configuration (model, tools, defaults). Migrating to [`ToolLoopAgent`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md) instances is still **recommended**, but agents must act as configuration holders. Per-request overrides (tool choice, max steps, abort signals, dynamic system prompts) will continue to route through `generateText`/`streamText` directly, using the agent’s model/tools as defaults.

**Key Findings:**
- ✅ Current implementation correctly uses AI SDK v6 tool wrapping, message conversion, and per-request validation
- ⚠️ Missing: Reusable agent configuration (`ToolLoopAgent`) shared across routers/streaming
- ⚠️ Missing: Valid `prepareStep` usage aligned with documented parameters
- ⚠️ Missing: `createAgentUIStreamResponse()` adoption (optional) and shared helper for both assistant/orchestrator streams
- ⚠️ Missing: Type inference via `InferAgentUIMessage`
- ✅ Loop control via `stopWhen` exists only in non-streaming routers today (streaming path relies on `streamText` defaults)

## 1. Current Implementation Analysis

### 1.1 Agent Configuration (`packages/agent/src/v6.ts`)

**Current Pattern:**
```typescript
// Tool wrapping (correct) - Uses AI SDK v6 tool() helper
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool.md
export function wrapLegacyToolToAISDK<TLegacy extends LegacyTool>(legacy: TLegacy) {
  return tool({
    description: legacy.description,
    inputSchema: legacy.inputSchema,
    outputSchema: legacy.outputSchema,
    async execute(input) {
      return await legacy.execute({ input });
    },
  });
}

// Tool organization (static)
const assistantTools = wrapAll(assistantToolSources);
const orchestratorTools = wrapAll(orchestratorToolSources);

export function buildAssistantTools(): ToolMap {
  return assistantTools;
}

export function buildTools(): ToolMap {
  return orchestratorTools;
}
```

**Observations:**
- ✅ Correctly wraps legacy tools to AI SDK v6 format using [`tool()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool.md)
- ✅ Uses static tool maps (efficient)
- ❌ No agent instance creation (should use [`ToolLoopAgent`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md))
- ❌ Model configuration duplicated in routers
- ❌ No centralized agent configuration
- ⚠️ Model ID is resolved at runtime per request, so changing `AI_MODEL` today does not require a restart

### 1.2 Assistant Router (`packages/api/src/routers/assistant.ts`)

**Current Pattern:**
```typescript
// Uses AI SDK v6 native functions:
// - convertToModelMessages: docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md
// - stepCountIs: docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md
// - generateText: docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md
export const assistantRouter = router({
  generate: authedProcedure
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const model = getOpenAI().chat(getModelId());
      const validatedMessages = validateMessages(input.messages);
      const modelMessages = convertToModelMessages(validatedMessages);
      const stopWhen = typeof input.maxSteps === "number"
        ? stepCountIs(input.maxSteps)
        : undefined;

      const result = await generateText({
        model,
        messages: modelMessages,
        tools: buildAssistantTools(),
        toolChoice: input.toolChoice,
        ...(stopWhen ? { stopWhen } : {}),
      });

      return sanitizeResult(result);
    }),
});
```

**Observations:**
- ✅ Correctly uses [`convertToModelMessages`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md) (AI SDK v6 standard)
- ✅ Correctly uses [`stepCountIs`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md) for loop control
- ✅ Proper message validation
- ✅ Supports per-request overrides via `toolChoice` and `maxSteps`
- ❌ Creates model instance on every request (should use [`ToolLoopAgent`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md) instance)
- ❌ Rebuilds tool map on every request (though cached)
- ❌ No agent reuse
- ❌ Manual loop control setup (should use agent's `stopWhen` configuration)

### 1.3 Orchestrator Router (`packages/api/src/routers/orchestrator.ts`)

**Current Pattern:**
Identical to assistant router with `buildTools()` instead of `buildAssistantTools()`.

**Observations:**
- Same patterns as assistant router
- Same limitations

### 1.4 Streaming Implementation (`apps/web/src/routes/api/stream-handler.ts`)

**Current Pattern:**
```typescript
// Uses AI SDK v6 native streaming:
// - streamText: docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md
// - convertToModelMessages: docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md
// - toUIMessageStreamResponse: docs/reference/ai-sdk-v6/reference_ai-sdk-ui_create-ui-message-stream-response.md
export async function handleStreamRequest(
  request: Request,
  buildTools: BuildToolsFn,
  errorPrefix: string
): Promise<Response> {
  const model = getOpenAI().chat(getModelId());
  const result = streamText({
    model,
    messages: convertToModelMessages(messages),
    tools: buildTools(),
    abortSignal: request.signal,
    system: preferencePrompt,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: generateId,
    consumeSseStream: consumeStream,
    onFinish: async ({ isAborted, messages: streamedMessages }) => {
      // Persistence logic
    },
  });

  return response;
}
```

**Observations:**
- ✅ Correctly uses [`toUIMessageStreamResponse`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_create-ui-message-stream-response.md) (AI SDK v6 standard)
- ✅ Proper abort handling via `abortSignal` parameter
- ✅ Injects dynamic per-user system prompts before each stream (`preferencePrompt`)
- ❌ Not using [`createAgentUIStreamResponse()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_create-agent-ui-stream-response.md) (agent-specific utility)
- ❌ Recreates model/tools on every request (should use [`ToolLoopAgent`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md) instance)
- ⚠️ No explicit stop condition in streaming path (relies on model default loop length)

## 2. AI SDK v6 Standard Patterns

### 2.1 ToolLoopAgent Class

**Standard Pattern:**
```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
// Reference: docs/reference/ai-sdk-v6/agents_building-agents.md
import { ToolLoopAgent, stepCountIs } from 'ai';

const agent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: 'You are a helpful assistant.',
  tools: {
    weather: weatherTool,
    calculator: calculatorTool,
  },
  stopWhen: stepCountIs(20), // Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md
});

// Reusable across requests
// agent.generate() returns GenerateTextResult - Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md
const result = await agent.generate({
  prompt: 'What is the weather?',
});
```

**Benefits:**
- **Encapsulation:** Model, tools, and behavior in one place
- **Reusability:** Single instance used across requests
- **Type Safety:** `InferAgentUIMessage<typeof agent>` for UI types
- **Consistency:** Same configuration everywhere
- **Maintainability:** Change agent behavior in one place

### 2.2 Loop Control

**Standard Pattern:**
```typescript
// Reference: docs/reference/ai-sdk-v6/agents_loop-control.md
// stopWhen accepts StopCondition | StopCondition[] - Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
const agent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  stopWhen: [
    stepCountIs(20), // Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md
    hasToolCall('someTool'), // Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_has-tool-call.md
    customCondition({ steps }) => steps.length > 10,
  ],
});
```

**Benefits:**
- Multiple stop conditions (OR logic)
- Access to step history for custom conditions
- Declarative configuration

### 2.3 Prepare Step

**Standard Pattern:**
```typescript
// Reference: docs/reference/ai-sdk-v6/agents_loop-control.md
// prepareStep: PrepareStepFunction - Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
const agent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  prepareStep: async ({ stepNumber, messages, steps }) => {
    // Dynamic model selection
    if (stepNumber > 2) {
      return { model: 'openai/gpt-4o' };
    }

    // Context management
    if (messages.length > 20) {
      return {
        messages: [messages[0], ...messages.slice(-10)],
      };
    }

    // Tool selection
    // toolChoice: ToolChoice - Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
    if (stepNumber === 0) {
      return {
        toolChoice: { type: 'tool', toolName: 'search' },
      };
    }

    return {};
  },
});
```

**Benefits:**
- Dynamic model switching
- Context window management
- Per-step tool selection
- Message transformation

### 2.4 Agent Streaming

**Standard Pattern:**
```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_create-agent-ui-stream-response.md
import { createAgentUIStreamResponse } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  // createAgentUIStreamResponse accepts Agent instance and UIMessage[]
  // Returns Promise<Response> with streaming UI messages
  return createAgentUIStreamResponse({
    agent: myAgent,
    messages,
  });
}
```

**Benefits:**
- Simplified streaming setup
- Automatic message handling
- Type-safe message types
- Consistent streaming behavior

### 2.5 Type Inference

**Standard Pattern:**
```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
// InferAgentUIMessage provides type inference for agent's UIMessage types
import { ToolLoopAgent, InferAgentUIMessage } from 'ai';

const agent = new ToolLoopAgent({
  // ... configuration
});

// InferAgentUIMessage<typeof agent> infers UIMessage type from agent's tools
export type AgentUIMessage = InferAgentUIMessage<typeof agent>;

// Use in UI components
// useChat hook - Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-ui_use-chat.md
const { messages } = useChat<AgentUIMessage>();
```

**Benefits:**
- Full type safety for UI messages
- Tool call/result types inferred
- Compile-time validation

## 3. Gap Analysis

### 3.1 Missing Features

| Feature | Current | AI SDK v6 Standard | Impact |
|---------|---------|-------------------|---------|
| Agent instances | ❌ Manual setup per request | ✅ `ToolLoopAgent` class | High - Reusability |
| `prepareStep` | ❌ Not available | ✅ Dynamic step configuration | Medium - Context management |
| `createAgentUIStreamResponse` | ❌ Manual `toUIMessageStreamResponse` | ✅ Agent-specific utility | Low - Convenience |
| Type inference | ❌ Manual types | ✅ `InferAgentUIMessage` | Medium - Type safety |
| Structured output | ❌ Not used | ✅ `output` schema | Low - Optional feature |
| Agent instructions | ❌ Per-request system prompts | ✅ Agent-level instructions | Medium - Consistency |

### 3.2 Current Strengths

- ✅ Correct tool wrapping using [`tool()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool.md) (`wrapLegacyToolToAISDK`)
- ✅ Correct message conversion using [`convertToModelMessages`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md)
- ✅ Proper loop control using [`stepCountIs`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md)
- ✅ Correct streaming using [`toUIMessageStreamResponse`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_create-ui-message-stream-response.md)
- ✅ Message validation
- ✅ Error handling

### 3.3 Code Duplication

**Current Issues:**
1. Model creation duplicated in routers
2. Tool building duplicated (though cached)
3. Loop control setup duplicated
4. Message validation duplicated

**With ToolLoopAgent:**
- Single agent instance per agent type
- Configuration in one place
- Reused across all endpoints

## 4. Migration Recommendations

### 4.1 Should We Migrate?

**Recommendation: YES**

**Rationale:**
1. **Reusability:** Agent instances can be reused across requests, reducing setup overhead
2. **Maintainability:** Configuration changes happen in one place
3. **Type Safety:** `InferAgentUIMessage` provides better type inference
4. **Future-Proofing:** Aligns with AI SDK v6 evolution
5. **Consistency:** Ensures same behavior across all endpoints

**Migration Complexity:** Medium
- Requires refactoring routers
- Requires agent instance creation
- Requires testing streaming endpoints
- Low risk (backward compatible patterns)

### 4.2 Migration Strategy

#### Phase 1: Create Agent Instances

**File: `packages/agent/src/agents.ts` (new)**

```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
// Reference: docs/reference/ai-sdk-v6/agents_building-agents.md
import { ToolLoopAgent, stepCountIs } from "ai";
import { getModelId, getOpenAI } from "./v6";
import { buildAssistantTools, buildTools } from "./v6";

const ASSISTANT_MAX_STEPS = 12;
const ORCHESTRATOR_MAX_STEPS = 12;

const assistantDefaults = {
  model: getOpenAI().chat(getModelId()),
  tools: buildAssistantTools(),
  stopWhen: stepCountIs(ASSISTANT_MAX_STEPS),
};

const orchestratorDefaults = {
  model: getOpenAI().chat(getModelId()),
  tools: buildTools(),
  stopWhen: stepCountIs(ORCHESTRATOR_MAX_STEPS),
};

// ToolLoopAgent constructor accepts model, tools, stopWhen, prepareStep, etc.
export const assistantAgent = new ToolLoopAgent(assistantDefaults);
export const orchestratorAgent = new ToolLoopAgent(orchestratorDefaults);

export function getAssistantAgentDefaults() {
  return assistantDefaults;
}

export function getOrchestratorAgentDefaults() {
  return orchestratorDefaults;
}

// Export types for UI
import type { InferAgentUIMessage } from "ai";

export type AssistantUIMessage = InferAgentUIMessage<typeof assistantAgent>;
export type OrchestratorUIMessage = InferAgentUIMessage<typeof orchestratorAgent>;

> If dynamic model selection or runtime env changes are required, swap `assistantDefaults` for a lightweight factory that re-runs `getOpenAI().chat(getModelId())` on each call to `getAssistantAgentDefaults()`. By default we retain the performance benefits of a single cached configuration, matching the current behavior described in Section 5.5.
```

**Benefits:**
- Single source of truth for agent configuration
- Reusable instances
- Type inference available

#### Phase 2: Update Routers

**File: `packages/api/src/routers/assistant.ts`**

```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md
// Use ToolLoopAgent for defaults, but call generateText directly for overrides.
import { convertToModelMessages, generateText, stepCountIs } from "ai";
import { getAssistantAgentDefaults } from "@alfred/agent/agents";

const assistantDefaults = getAssistantAgentDefaults();

export const assistantRouter = router({
  generate: authedProcedure
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const validatedMessages = validateMessages(input.messages);
      const modelMessages = convertToModelMessages(validatedMessages);

      const stopWhen =
        typeof input.maxSteps === "number"
          ? stepCountIs(input.maxSteps)
          : assistantDefaults.stopWhen;

      const result = await generateText({
        ...assistantDefaults,
        messages: modelMessages,
        toolChoice: input.toolChoice,
        stopWhen,
      });

      const output = sanitizeResult(result);
      if (!ctx.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }
      const replayId = await persistResult({
        userId: ctx.session.user.id,
        kind: "assistant",
        input,
        result: output,
      });

      return {
        ...output,
        replayId: replayId ?? undefined,
      };
    }),
});
```

**Changes:**
- Remove per-request model/tool creation in the router; rely on agent defaults returned by `getAssistantAgentDefaults()`
- Continue validating messages via `uiMessageSchema` before conversion
- Preserve `toolChoice` overrides by passing them directly to [`generateText`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md)
- Preserve `maxSteps` overrides by swapping in a per-request `stopWhen`
- Keep `persistResult()` so workflow replay remains intact
- Continue exporting `assistantAgent` for `InferAgentUIMessage` while routing runtime calls through `generateText`

#### Phase 3: Update Streaming Endpoints

**File: `apps/web/src/routes/api/stream-handler.ts`**

**Option A: Use `createAgentUIStreamResponse` (after validation)**

```typescript
import { createAgentUIStreamResponse } from "ai";
import { assistantAgent } from "@alfred/agent/agents";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { uiMessageSchema } from "@alfred/type/stream.zod";

export async function handleAssistantStream(request: Request): Promise<Response> {
  const body = await request.json();
  const parsed = z.object({ messages: z.array(z.unknown()).min(1) }).safeParse(body);
  if (!parsed.success) {
    return invalidResponse(parsed.error);
  }
  const validated = parsed.data.messages.map((msg) => {
    const result = uiMessageSchema.safeParse(msg);
    if (!result.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "invalid_message" });
    }
    return result.data;
  });

  return createAgentUIStreamResponse({
    agent: assistantAgent,
    messages: validated,
    consumeSseStream: consumeStream,
    onFinish: async ({ messages: streamedMessages }) => {
      await persistMessages(streamedMessages);
    },
  });
}
```

> `invalidResponse`, `persistMessages`, and the logger helpers already exist in `apps/web/src/routes/api/stream-handler.ts`; reuse them so error handling stays aligned with `.ruler/16-error-handling.md`.

**Option B: Shared HTTP handler using `streamText()` (recommended)**

```typescript
import {
  consumeStream,
  convertToModelMessages,
  generateId,
  streamText,
} from "ai";
import {
  getAssistantAgentDefaults,
  getOrchestratorAgentDefaults,
} from "@alfred/agent/agents";
import { auth } from "@alfred/auth";
import { buildPreferenceSystemPrompt } from "@alfred/agent/preference/prompt";

type GetDefaultsFn =
  | typeof getAssistantAgentDefaults
  | typeof getOrchestratorAgentDefaults;

export async function handleStreamRequest(
  request: Request,
  getDefaults: GetDefaultsFn,
  errorPrefix: string
): Promise<Response> {
  const rawBody = await request.json();
  const parsed = requestSchema.safeParse(rawBody); // reuse the existing schema from apps/web/src/routes/api/stream-handler.ts
  if (!parsed.success) {
    return invalidResponse(parsed.error);
  }

  const messages = parsed.data.messages ?? [];
  const validated = messages.map((message) => {
    const result = uiMessageSchema.safeParse(message);
    if (!result.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "invalid_message" });
    }
    return result.data;
  });

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  const defaults = getDefaults();
  const preferencePrompt = await buildPreferenceSystemPrompt(userId, {
    conversationType: errorPrefix === "assistant" ? "assistant" : "chat",
    toolNames: Object.keys(defaults.tools ?? {}),
  });

  const stream = streamText({
    ...defaults,
    messages: convertToModelMessages(validated),
    system: preferencePrompt ?? undefined,
    abortSignal: request.signal,
  });

  return stream.toUIMessageStreamResponse({
    originalMessages: validated,
    generateMessageId: generateId,
    consumeSseStream: consumeStream,
    onFinish: async ({ isAborted, messages: streamedMessages }) => {
      if (!isAborted) {
        await persistMessages(streamedMessages);
      }
    },
  });
}
```

> The shared persistence helpers (`persistMessages`, `conversationRepo`, `logger`, etc.) remain unchanged; only the stream creation now relies on `getDefaults()` + `streamText`.

**Recommendation:** Option B preserves the existing shared handler, keeps validation, dynamic system prompts, abort handling, and message persistence for both assistant and orchestrator routes. ToolLoopAgent instances supply the base `model`/`tools` config via `getDefaults`, while per-request overrides (system prompt, headers, abort signal) continue to flow through [`streamText`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md). Option A remains viable for simple routes, but it must still perform validation and inject request-scoped prompts before calling `createAgentUIStreamResponse`.

#### Phase 4: Add `prepareStep` (Optional)

**Use Cases:**
1. Dynamic preference injection per step
2. Context window management for long conversations
3. Tool selection based on step number

**Example:**
```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
// prepareStep: PrepareStepFunction - Reference: docs/reference/ai-sdk-v6/agents_loop-control.md
export const assistantAgent = new ToolLoopAgent({
  ...assistantDefaults,
  prepareStep: async ({ stepNumber, messages, steps }) => {
    // Keep the system prompt deterministic; trim history instead.
    if (messages.length > 40) {
      return {
        messages: [messages[0], ...messages.slice(-20)],
      };
    }

    // Bias the loop after the first tool execution.
    const toolCalls = steps.flatMap((step) => step.toolCalls ?? []);
    if (toolCalls.length >= 1 && stepNumber <= 3) {
      return {
        toolChoice: { type: "tool", toolName: "summarize" },
      };
    }

    return {};
  },
});
```

**Note:** `prepareStep` receives only `{ model, stepNumber, steps, messages }` (docs/reference/ai-sdk-v6/agents_loop-control.md:409-420). Request-scoped data such as `userId`, preference prompts, or policy contexts must continue to flow through the per-request `system` parameter when calling `generateText`/`streamText`, not via `prepareStep`.

### 4.3 Architecture Proposal

#### 4.3.1 Agent Structure

```
packages/agent/
  src/
    v6.ts                    # Tool wrapping, model config (keep)
    agents.ts               # Agent instances (new)
    assistant/
      tool/                 # Assistant tools (keep)
    orchestrator/
      tool/                 # Orchestrator tools (keep)
```

#### 4.3.2 Router Structure

```
packages/api/src/routers/
  assistant.ts              # Use assistantAgent
  orchestrator.ts          # Use orchestratorAgent
```

#### 4.3.3 Streaming Structure

```
apps/web/src/routes/api/
  stream-handler.ts        # Use streamText() with agent defaults or createAgentUIStreamResponse()
```

### 4.4 Type Safety Improvements

**Before:**
```typescript
// Manual types
type AssistantMessage = UIMessage;
```

**After:**
```typescript
// Inferred from agent
import type { AssistantUIMessage } from "@alfred/agent/agents";

// Full type safety for tool calls/results
const { messages } = useChat<AssistantUIMessage>();
```

## 5. Risk Assessment

### 5.1 Breaking Changes

**Risk Level: LOW**

**Potential Issues:**
1. Agent instance creation timing (model initialization)
2. Per-request overrides (maxSteps, toolChoice)
3. Streaming behavior differences

**Mitigation:**
- Keep per-request overrides supported
- Test streaming endpoints thoroughly
- Gradual migration (assistant first, then orchestrator)

### 5.2 Performance Impact

**Risk Level: LOW**

**Concerns:**
- Agent instance creation overhead
- Model instance caching

**Analysis:**
- Agent instances created once at module load (negligible)
- Model instances already cached (`getOpenAI()`)
- Tool maps already cached (static)
- **Net impact: Positive** (reduced per-request setup)

### 5.3 Type Safety

**Risk Level: LOW**

**Concerns:**
- Type inference compatibility
- UI component updates

**Analysis:**
- `InferAgentUIMessage` provides better types
- Existing `UIMessage` types remain compatible
- Gradual adoption possible

### 5.4 Migration Complexity

**Risk Level: MEDIUM**

**Effort Estimate:**
- Agent instance creation: 2 hours
- Router updates: 4 hours
- Streaming updates: 4 hours
- Testing: 4 hours
- **Total: ~14 hours**

### 5.5 Model Configuration Drift

Caching `getModelId()` and `createOpenAI()` inside agent defaults means any runtime change to `AI_MODEL`, `OPENAI_API_KEY`, or related env vars will not apply until the process restarts. Evaluate whether this is acceptable, or introduce a lightweight factory (e.g., `getAssistantAgentDefaults()` reading env vars on demand) to preserve today’s behavior (`packages/agent/src/v6.ts:46-50`).

## 6. Implementation Plan

### Phase 1: Agent Instances (Week 1)

1. Create `packages/agent/src/agents.ts`
2. Export `assistantAgent` and `orchestratorAgent`
3. Export type inference types
4. Update `packages/agent/src/index.ts` exports
5. Add tests for agent creation

**Deliverables:**
- Agent instances created
- Types exported
- Tests passing
- Agent singletons remain available for `InferAgentUIMessage` and other compile-time consumers even though routers/handlers call `generateText`/`streamText` for runtime overrides.

### Phase 2: Router Migration (Week 1-2)

1. Update `assistantRouter.generate` to pull defaults from `getAssistantAgentDefaults()` and call `generateText` with overrides
2. Update `orchestratorRouter.generate` to follow the same wrapper pattern
3. Keep per-request overrides (`maxSteps`, `toolChoice`) plus `persistResult`
4. Update tests

**Deliverables:**
- Routers using agent instances
- Backward compatibility maintained
- Tests updated

### Phase 3: Streaming Migration (Week 2)

1. Update `handleStreamRequest` to fetch agent defaults and call `streamText` with per-request overrides
2. Keep shared handler for assistant/orchestrator (buildTools → getDefaults)
3. Verify message validation, dynamic system prompts, and persistence still run
4. Verify abort handling

**Deliverables:**
- Streaming using agent instances
- All streaming tests passing
- Performance verified

### Phase 4: Optional Enhancements (Week 3)

1. Add `prepareStep` for context management (if needed)
2. Add structured output schemas (if needed)
3. Add agent-level instructions (if needed)
4. Update documentation

**Deliverables:**
- Enhanced agent configuration
- Documentation updated

### Phase 5: Type Safety (Week 3)

1. Update UI components to use `InferAgentUIMessage` types
2. Update type exports
3. Verify type safety

**Deliverables:**
- Full type inference in UI
- Type errors resolved

## 7. Specific Questions Answered

### Q1: Should we migrate to `ToolLoopAgent` instances?

**Answer: YES**

**Benefits:**
- Reusability across requests (shared defaults for model/tools/stopWhen)
- Single source of truth for configuration while still calling `generateText`/`streamText` for per-request overrides
- Better type safety (`InferAgentUIMessage`)
- Alignment with AI SDK v6 patterns without sacrificing current overrides

**Trade-offs:**
- Requires refactoring (medium effort)
- Must wrap `generateText`/`streamText` to keep `toolChoice`, `maxSteps`, `system`, and `abortSignal` overrides functioning

### Q2: How should assistant vs orchestrator agents be structured?

**Answer: Separate agent instances**

```typescript
// packages/agent/src/agents.ts
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
export const assistantAgent = new ToolLoopAgent({
  model: getOpenAI().chat(getModelId()),
  tools: buildAssistantTools(),
  stopWhen: stepCountIs(ASSISTANT_MAX_STEPS), // Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md
});

export const orchestratorAgent = new ToolLoopAgent({
  model: getOpenAI().chat(getModelId()),
  tools: buildTools(),
  stopWhen: stepCountIs(ORCHESTRATOR_MAX_STEPS),
});
```

**Rationale:**
- Different tool sets
- Different max steps
- Different use cases
- Clear separation of concerns

### Q3: Can we leverage `prepareStep` for dynamic tool selection or context management?

**Answer: YES, with limitations**

**Use Cases (driven only by `{ model, stepNumber, steps, messages }`):**
- Context window management (e.g., trim message history after it exceeds a threshold)
- Tool biasing based on previous steps (e.g., force `summarize` after the first tool call)
- Model switching after specific steps

**Limitations:**
- No access to request context (userId, preferences, policy requirements)
- Dynamic prompts or user-specific instructions must still be supplied via the `system` parameter when invoking `generateText`/`streamText`

**Example:**
```typescript
prepareStep: async ({ stepNumber, messages, steps }) => {
  if (messages.length > 40) {
    return { messages: [messages[0], ...messages.slice(-20)] };
  }
  const toolCalls = steps.flatMap((step) => step.toolCalls ?? []);
  if (toolCalls.length >= 1 && stepNumber <= 3) {
    return { toolChoice: { type: "tool", toolName: "summarize" } };
  }
  return {};
}
```

### Q4: Should we use `output` schemas for structured responses?

**Answer: OPTIONAL**

**Use Cases:**
- When responses need structured format (analysis, reports)
- When type safety for output is critical

**Current State:**
- Not needed for current use cases
- Can be added later if needed

**Example:**
```typescript
// Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md
// output: Output - Reference: docs/reference/ai-sdk-v6/reference_ai-sdk-core_generating-structured-data.md
const analysisAgent = new ToolLoopAgent({
  model: getOpenAI().chat(getModelId()),
  output: Output.object({
    schema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      summary: z.string(),
    }),
  }),
});
```

### Q5: How does `createAgentUIStreamResponse()` compare to current streaming?

**Answer: Convenience wrapper, but current pattern is fine**

**Comparison:**

| Feature | `createAgentUIStreamResponse` | Current Pattern ( `streamText` + `toUIMessageStreamResponse`) |
|---------|------------------------------|-----------------|
| Setup | Simpler | More control |
| Customization | Limited | Full control |
| Message handling | Automatic | Manual |
| Type safety | Good | Good |

**Recommendation:**
- Keep the current HTTP handler (`streamText` + [`toUIMessageStreamResponse`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_create-ui-message-stream-response.md)) fed by agent defaults for shared config
- More control over streaming behavior (validation, dynamic system prompts, persistence, dual agents)
- Can migrate to [`createAgentUIStreamResponse`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_create-agent-ui-stream-response.md) later if a simpler endpoint is needed

## 8. Conclusion

The current ALFRED implementation correctly uses AI SDK v6 patterns for tool wrapping, message conversion, and streaming. However, it doesn't leverage the `ToolLoopAgent` class, which provides better encapsulation and reusability.

**Migration is recommended** for:
1. Improved maintainability
2. Better type safety
3. Reduced code duplication
4. Alignment with AI SDK v6 best practices

**Migration is low-risk** because:
1. Backward compatible patterns
2. Per-request flexibility maintained
3. Gradual migration possible
4. Existing functionality preserved

**Next Steps:**
1. Review this analysis
2. Approve migration plan
3. Begin Phase 1 implementation
4. Test thoroughly before production

## 9. References

### Core Documentation
- [AI SDK v6 Agents Overview](docs/reference/ai-sdk-v6/agents_overview.md)
- [Building Agents](docs/reference/ai-sdk-v6/agents_building-agents.md)
- [Loop Control](docs/reference/ai-sdk-v6/agents_loop-control.md)
- [Workflow Patterns](docs/reference/ai-sdk-v6/agents_workflows.md)

### API References
- [`ToolLoopAgent`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md) - Agent class constructor and methods
- [`tool()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool.md) - Tool definition helper
- [`generateText()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_generate-text.md) - Text generation function
- [`streamText()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_stream-text.md) - Streaming text generation
- [`stepCountIs()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_step-count-is.md) - Stop condition helper
- [`hasToolCall()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_has-tool-call.md) - Tool call stop condition
- [`convertToModelMessages()`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_convert-to-model-messages.md) - UI message conversion
- [`createAgentUIStreamResponse()`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_create-agent-ui-stream-response.md) - Agent streaming utility
- [`toUIMessageStreamResponse()`](docs/reference/ai-sdk-v6/reference_ai-sdk-ui_create-ui-message-stream-response.md) - Stream response conversion
- [`InferAgentUIMessage`](docs/reference/ai-sdk-v6/reference_ai-sdk-core_tool-loop-agent.md) - Type inference helper

### Standards
- [AI SDK v6 Standards](.ruler/15-ai-sdk-v6.md) - ALFRED-specific AI SDK v6 guidelines
