# Runtime Integration AI SDK v6 Audit

**Date:** 2025-11-16  
**Purpose:** Verify all AI SDK v6 references in runtime-integration.md against official AI SDK v6 documentation

---

## Executive Summary

This audit systematically reviews all AI SDK v6 API calls, event types, patterns, and best practices in the [runtime-integration.md](runtime-integration.md) ExecPlan to ensure alignment with AI SDK v6 specification.

**Status:** In Progress

**Scope:**
- Question 9: Streaming Model (lines 723-816)
- Question 10: Event Normalization (lines 819-863)
- Question 11: Tool Execution (lines 866-924)
- Question 12: Error Handling (lines 928-1035)
- Question 20: Testability & Observability (lines 1531-1631)

---

## Milestone 1: Extracted References

### Question 9: Streaming Model (lines 723-816)

**AI SDK Imports:**
```typescript
import { streamText, type StreamTextResult } from 'ai';
```

**AISDKAdapter Class:**
```typescript
export class AISDKAdapter {
  async *stream(options: StreamTextOptions): AsyncGenerator<WorkflowEvent> {
    const stream = await streamText(options);
    
    for await (const event of stream.fullStream) {
      const mapped = this.mapEvent(event);
      if (mapped) yield mapped;
    }
  }
  
  private mapEvent(sdkEvent: any): WorkflowEvent | null {
    switch (sdkEvent.type) {
      case 'text-delta':
        return { type: 'text-delta', delta: sdkEvent.textDelta };
      
      case 'tool-call':
        return {
          type: 'tool-call',
          id: sdkEvent.toolCallId,
          toolName: sdkEvent.toolName,
          args: sdkEvent.args,
        };
      
      case 'tool-result':
        return {
          type: 'tool-result',
          id: sdkEvent.toolCallId,
          toolName: sdkEvent.toolName,
          result: sdkEvent.result,
        };
      
      case 'finish':
        return {
          type: 'finish',
          finishReason: sdkEvent.finishReason,
          usage: sdkEvent.usage,
        };
      
      case 'error':
        return {
          type: 'error',
          message: sdkEvent.error.message,
        };
      
      default:
        return null;  // Ignore unknown events
    }
  }
}
```

**Runtime Usage:**
```typescript
export class WorkflowRuntime {
  private readonly aiAdapter: AISDKAdapter;
  
  constructor(options: RuntimeOptions) {
    this.aiAdapter = new AISDKAdapter(options.streamText);
  }
  
  async *execute(): AsyncGenerator<WorkflowEvent> {
    for await (const event of this.aiAdapter.stream({
      model: this.model,
      messages: this.messages,
      tools: this.tools,
    })) {
      yield event;
    }
  }
}
```

**Event Types Handled:**
- `text-delta` - Maps to `{ type: 'text-delta', delta: sdkEvent.textDelta }`
- `tool-call` - Maps to `{ type: 'tool-call', id, toolName, args }`
- `tool-result` - Maps to `{ type: 'tool-result', id, toolName, result }`
- `finish` - Maps to `{ type: 'finish', finishReason, usage }`
- `error` - Maps to `{ type: 'error', message }`

**Event Types Not Handled:**
- `text-start`, `text-end` - Text block lifecycle
- `reasoning`, `reasoning-delta`, `reasoning-end` - Reasoning steps
- `tool-input-start`, `tool-input-delta`, `tool-input-end` - Streaming tool inputs
- `source` - RAG model sources
- `file` - Generated files
- `start-step`, `finish-step` - Multi-step workflow events
- `start`, `abort` - Stream lifecycle events

---

### Question 10: Event Normalization (lines 819-863)

**Event Mapping Table:**

| AI SDK Event | WorkflowEvent | Notes |
|--------------|---------------|-------|
| `text-delta` | `{ type: 'text-delta', delta }` | Forward directly |
| `tool-call` | `{ type: 'tool-call', id, toolName, args }` | Map fields |
| `tool-result` | `{ type: 'tool-result', id, toolName, result }` | Map fields |
| `finish` | `{ type: 'finish', finishReason, usage }` | Map fields |
| `error` | `{ type: 'error', message }` | Extract error message |
| `reasoning` | `{ type: 'reasoning', text }` | For o1/o3 models |

**Router Pass-Through Pattern:**
```typescript
stream: authedProcedure.subscription(({ input, ctx }) =>
  observable<WorkflowEvent>((emit) => {
    const runtime = createRuntime({ user: ctx.session.user, input });
    
    (async () => {
      for await (const event of runtime.execute()) {
        emit.next(event);  // No normalization, just pass through
        await workflowRepo.appendEvent({ runId: runtime.runId, ...event });
      }
      emit.complete();
    })();
  })
),
```

---

### Question 11: Tool Execution (lines 866-924)

**Tool Execution Flow:**
1. Runtime calls `aiAdapter.stream({ tools })`
2. AI SDK invokes tool when model requests it
3. Tool executes (potentially long-running)
4. Tool emits progress via `writer` pattern
5. AI SDK gets tool result
6. Runtime receives `tool-result` event
7. Runtime forwards event to router

**Tool Example:**
```typescript
export const toolCodex = {
  async execute({ input, writer }) {
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    
    await writer?.write({ type: 'notice', message: 'codex_turn_started' });
    
    const result = await runCodexWithTimeout(input, timeoutSec);
    
    await writer?.write({ type: 'notice', message: 'codex_turn_completed' });
    
    return result;
  }
};
```

**streamText Configuration:**
```typescript
const stream = streamText({
  model: this.model,
  messages: this.messages,
  tools: this.tools,
  maxSteps: 12,  // Limit tool call depth
  abortSignal: this.abortController.signal,  // For cancellation
  // No global timeout (tools manage their own)
});
```

**Parameters Referenced:**
- `model` - Language model to use
- `messages` - Conversation history
- `tools` - Tool registry
- `maxSteps` - Limit for tool call depth
- `abortSignal` - For cancellation support

---

### Question 12: Error Handling (lines 928-1035)

**Error Classification Table:**

| Error Type | Recoverable | Action |
|------------|-------------|--------|
| Model timeout | Yes | Emit error event, retry with shorter context |
| Rate limit | Yes | Emit error event, wait and retry |
| Invalid API key | No | Emit error event, abort workflow |
| Network error | Yes | Emit error event, retry up to 3 times |
| Tool execution error | Yes | Emit error event, continue workflow |

**Error Mapping Code:**
```typescript
private handleError(error: unknown): WorkflowEvent {
  if (error instanceof Error) {
    if (error.name === 'AI_APICallError') {
      const apiError = error as { statusCode?: number; message: string };
      
      if (apiError.statusCode === 401 || apiError.statusCode === 403) {
        return { 
          type: 'error', 
          message: 'authentication_failed',
          recoverable: false 
        };
      }
      
      if (apiError.statusCode === 429) {
        return { 
          type: 'error', 
          message: 'rate_limit_exceeded',
          recoverable: true,
          retryAfter: this.extractRetryAfter(apiError),
        };
      }
    }
    
    if (error.name === 'AbortError') {
      return { 
        type: 'error', 
        message: 'workflow_cancelled',
        recoverable: false 
      };
    }
  }
  
  return { 
    type: 'error', 
    message: error instanceof Error ? error.message : String(error),
    recoverable: true
  };
}
```

**Error Types Referenced:**
- `AI_APICallError` - API call failures (checked via `error.name`)
- `AbortError` - Cancellation via AbortController
- Status codes: 401 (unauthorized), 403 (forbidden), 429 (rate limit)

**Retry Logic:**
```typescript
async *executeWithRetry(): AsyncGenerator<WorkflowEvent> {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      for await (const event of this.aiAdapter.stream(options)) {
        if (event.type === 'error' && !event.recoverable) {
          yield event;
          throw new Error(event.message);
        }
        
        if (event.type === 'error' && event.recoverable) {
          yield event;
          
          if (event.retryAfter) {
            await delay(event.retryAfter);
            attempts++;
            continue;
          }
        }
        
        yield event;
      }
      
      return;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        yield { type: 'error', message: 'max_retries_exceeded', recoverable: false };
        throw error;
      }
      
      yield { type: 'notice', message: `retry_attempt_${attempts}` };
      await delay(1000 * attempts);
    }
  }
}
```

---

### Question 20: Testability (lines 1531-1631)

**Mock AI SDK Implementation:**
```typescript
export function createMockStreamText() {
  const mock = vi.fn();
  
  mock.mockImplementation(async (options) => ({
    async *fullStream() {
      yield { type: 'text-delta', textDelta: 'Planning...' };
      
      yield { 
        type: 'tool-call', 
        toolCallId: 'tc-1',
        toolName: 'grep',
        args: { pattern: 'test' },
      };
      
      yield {
        type: 'tool-result',
        toolCallId: 'tc-1',
        toolName: 'grep',
        result: { matches: ['test'] },
      };
      
      yield { type: 'finish', finishReason: 'stop', usage: { totalTokens: 100 } };
    },
  }));
  
  return mock;
}
```

**Test Pattern:**
```typescript
describe('WorkflowRuntime', () => {
  it('executes workflow phases in order', async () => {
    const mockStreamText = createMockStreamText();
    const mockCognitive = {
      capture: vi.fn().mockReturnValue({ _: 'capturing' }),
      think: vi.fn().mockReturnValue({ _: 'thinking' }),
    };
    
    const runtime = new WorkflowRuntime({
      streamText: mockStreamText,
      cognitive: mockCognitive,
    });
    
    const events: WorkflowEvent[] = [];
    for await (const event of runtime.execute()) {
      events.push(event);
    }
    
    expect(events.map(e => e.type)).toEqual([
      'run',
      'progress',
      'context',
      'text-delta',
      'tool-call',
      'tool-result',
      'progress',
    ]);
    
    expect(mockCognitive.capture).toHaveBeenCalledWith('test requirement');
    expect(mockCognitive.think).toHaveBeenCalled();
  });
});
```

**Mock Event Sequence:**
1. `{ type: 'text-delta', textDelta: 'Planning...' }`
2. `{ type: 'tool-call', toolCallId: 'tc-1', toolName: 'grep', args: { pattern: 'test' } }`
3. `{ type: 'tool-result', toolCallId: 'tc-1', toolName: 'grep', result: { matches: ['test'] } }`
4. `{ type: 'finish', finishReason: 'stop', usage: { totalTokens: 100 } }`

---

## Summary of Findings

### APIs Referenced:
- `streamText()` from `'ai'` package
- `stream.fullStream` async iterable
- `StreamTextOptions` type
- `StreamTextResult` type

### Event Types Used:
- `text-delta`
- `tool-call`
- `tool-result`
- `finish`
- `error`
- `reasoning` (mentioned in table)

### Parameters Used:
- `model`
- `messages`
- `tools`
- `maxSteps`
- `abortSignal`

### Error Types:
- `AI_APICallError`
- `AbortError`
- Status codes: 401, 403, 429

---

---

## Milestone 2: Event Type Verification

### AI SDK v6 fullStream Event Types (from reference_ai-sdk-core_stream-text.md)

According to the official AI SDK v6 documentation, `fullStream` emits the following event types:

**Text Events:**
- `{ type: 'text-start', id: string }` - Start of text block
- `{ type: 'text-delta', id: string, delta: string }` - Text chunk (NOTE: property is `delta`, not `textDelta`)
- `{ type: 'text-end', id: string }` - End of text block

**Reasoning Events (O1/O3 models):**
- `{ type: 'reasoning-start', id: string }` - Start of reasoning
- `{ type: 'reasoning-delta', id: string, delta: string }` - Reasoning chunk
- `{ type: 'reasoning-end', id: string }` - End of reasoning
- `{ type: 'reasoning', text: string, providerMetadata?: ... }` - Complete reasoning block
- `{ type: 'reasoning-part-finish' }` - Reasoning part completion

**Tool Events:**
- `{ type: 'tool-input-start', id: string, toolName: string }` - Start of tool input streaming
- `{ type: 'tool-input-delta', id: string, delta: string }` - Tool input chunk
- `{ type: 'tool-input-end', id: string }` - End of tool input streaming
- `{ type: 'tool-call', toolCallId: string, toolName: string, input: object }` - Complete tool call (NOTE: property is `input`, not `args`)
- `{ type: 'tool-result', toolCallId: string, toolName: string, input: object, output: any }` - Tool result (NOTE: properties are `input` and `output`, not `args` and `result`)

**Source Events (RAG models):**
- `{ type: 'source', sourceType: 'url', id: string, url: string, title?: string }` - Source citation

**File Events:**
- `{ type: 'file', file: GeneratedFile }` - Generated file

**Step Events (Multi-step workflows):**
- `{ type: 'start-step', request: LanguageModelRequestMetadata, warnings: CallWarning[] }` - Start of workflow step
- `{ type: 'finish-step', response: LanguageModelResponseMetadata, usage: LanguageModelUsage, finishReason: string }` - End of workflow step

**Stream Lifecycle Events:**
- `{ type: 'start' }` - Stream start
- `{ type: 'finish', finishReason: string, totalUsage: LanguageModelUsage }` - Stream completion
- `{ type: 'abort' }` - Stream aborted
- `{ type: 'error', error: unknown }` - Error in stream

### Property Name Mismatches

#### CRITICAL Issue #1: `text-delta` event property name

**Current Plan (INCORRECT):**
```typescript
case 'text-delta':
  return { type: 'text-delta', delta: sdkEvent.textDelta };
```

**AI SDK v6 Specification (CORRECT):**
```typescript
case 'text-delta':
  return { type: 'text-delta', id: sdkEvent.id, delta: sdkEvent.delta };
```

**Issue:** 
- Property is `delta` not `textDelta` (v4 legacy name)
- Missing required `id` field for tracking text blocks

**Severity:** CRITICAL - Will break at runtime with `undefined` values

---

#### CRITICAL Issue #2: `tool-call` event property name

**Current Plan (INCORRECT):**
```typescript
case 'tool-call':
  return {
    type: 'tool-call',
    id: sdkEvent.toolCallId,
    toolName: sdkEvent.toolName,
    args: sdkEvent.args,  // WRONG
  };
```

**AI SDK v6 Specification (CORRECT):**
```typescript
case 'tool-call':
  return {
    type: 'tool-call',
    toolCallId: sdkEvent.toolCallId,  // Keep original property name
    toolName: sdkEvent.toolName,
    input: sdkEvent.input,  // CORRECT property name
  };
```

**Issue:** 
- Property is `input` not `args`
- Inconsistent property naming (`id` vs `toolCallId`)

**Severity:** CRITICAL - Will break at runtime with `undefined` values

---

#### CRITICAL Issue #3: `tool-result` event property names

**Current Plan (INCORRECT):**
```typescript
case 'tool-result':
  return {
    type: 'tool-result',
    id: sdkEvent.toolCallId,
    toolName: sdkEvent.toolName,
    result: sdkEvent.result,  // WRONG
  };
```

**AI SDK v6 Specification (CORRECT):**
```typescript
case 'tool-result':
  return {
    type: 'tool-result',
    toolCallId: sdkEvent.toolCallId,  // Keep original property name
    toolName: sdkEvent.toolName,
    input: sdkEvent.input,  // Include input that was passed
    output: sdkEvent.output,  // CORRECT property name
  };
```

**Issue:** 
- Property is `output` not `result`
- Missing `input` field (what was passed to tool)
- Inconsistent property naming (`id` vs `toolCallId`)

**Severity:** CRITICAL - Will break at runtime with `undefined` values

---

### Missing Event Types

#### HIGH Priority: Missing text block lifecycle events

**Missing:**
- `text-start` - Text block initiation
- `text-end` - Text block completion

**Impact:** Cannot track text block boundaries, may cause issues with partial rendering

---

#### HIGH Priority: Missing reasoning events

**Missing:**
- `reasoning-start` - Reasoning initiation
- `reasoning-delta` - Reasoning chunks
- `reasoning-end` - Reasoning completion
- `reasoning-part-finish` - Reasoning part completion

**Impact:** Cannot support O1/O3 models that emit reasoning steps

---

#### MEDIUM Priority: Missing tool input streaming events

**Missing:**
- `tool-input-start` - Tool input streaming start
- `tool-input-delta` - Tool input chunks
- `tool-input-end` - Tool input streaming end

**Impact:** Cannot stream tool inputs incrementally (less important, tool calls work)

---

#### MEDIUM Priority: Missing source and file events

**Missing:**
- `source` - RAG model source citations
- `file` - Generated files

**Impact:** Cannot support RAG models or file generation features

---

#### HIGH Priority: Missing step events

**Missing:**
- `start-step` - Workflow step initiation
- `finish-step` - Workflow step completion

**Impact:** Cannot track multi-step workflows properly, no step-level metadata

---

#### MEDIUM Priority: Missing stream lifecycle events

**Missing:**
- `start` - Stream initiation
- `abort` - Stream cancellation

**Impact:** Cannot track stream lifecycle properly, `abort` especially important for cancellation UX

---

### Mock Test Event Property Mismatches

#### Issue #4: Mock uses incorrect property names

**Current Mock (INCORRECT):**
```typescript
yield { type: 'text-delta', textDelta: 'Planning...' };  // WRONG

yield { 
  type: 'tool-call', 
  toolCallId: 'tc-1',
  toolName: 'grep',
  args: { pattern: 'test' },  // WRONG
};

yield {
  type: 'tool-result',
  toolCallId: 'tc-1',
  toolName: 'grep',
  result: { matches: ['test'] },  // WRONG
};
```

**Correct Mock:**
```typescript
yield { type: 'text-delta', id: 'text-1', delta: 'Planning...' };  // CORRECT

yield { 
  type: 'tool-call', 
  toolCallId: 'tc-1',
  toolName: 'grep',
  input: { pattern: 'test' },  // CORRECT
};

yield {
  type: 'tool-result',
  toolCallId: 'tc-1',
  toolName: 'grep',
  input: { pattern: 'test' },  // Include input
  output: { matches: ['test'] },  // CORRECT
};
```

**Severity:** CRITICAL - Tests will pass but production code will fail

---

## Milestone 3: streamText() API Usage Verification

### Parameters Used in Runtime Plan

From Question 9 and Question 11:

```typescript
const stream = streamText({
  model: this.model,
  messages: this.messages,
  tools: this.tools,
  maxSteps: 12,
  abortSignal: this.abortController.signal,
});
```

### AI SDK v6 Specification Verification

**✅ CORRECT:** All parameters used match AI SDK v6 specification

- `model: LanguageModel` - ✅ Correct
- `messages: Array<ModelMessage>` - ✅ Correct (vs `prompt` for single-turn)
- `tools: Record<string, Tool>` - ✅ Correct
- `maxSteps: number` - ✅ Correct (for multi-step workflows)
- `abortSignal: AbortSignal` - ✅ Correct (for cancellation)

### Async Generator Consumption Pattern

**Current Pattern:**
```typescript
async *stream(options: StreamTextOptions): AsyncGenerator<WorkflowEvent> {
  const stream = await streamText(options);
  
  for await (const event of stream.fullStream) {
    const mapped = this.mapEvent(event);
    if (mapped) yield mapped;
  }
}
```

**✅ CORRECT:** Pattern matches AI SDK v6 best practices
- `fullStream` is correctly used as `AsyncIterable`
- `for await` consumption is correct
- Wrapping in AsyncGenerator is valid

### Potential Enhancements (Optional)

The plan could benefit from additional AI SDK v6 parameters:

**Optional Parameters Not Used:**
- `system?: string` - System prompt for behavior specification
- `temperature?: number` - Sampling temperature
- `topP?: number` - Nucleus sampling
- `maxTokens?: number` - Output token limit
- `onFinish?: callback` - Completion callback
- `onStepFinish?: callback` - Step completion callback

**Note:** These are optional and can be added later. Current usage is correct.

---

## Milestone 4: Tool Execution Pattern Verification

### Tool Execution Flow Analysis

**Current Flow (from Question 11):**
1. Runtime calls `aiAdapter.stream({ tools })`
2. AI SDK invokes tool when model requests it
3. Tool executes (potentially long-running)
4. Tool emits progress via `writer` pattern
5. AI SDK gets tool result
6. Runtime receives `tool-result` event
7. Runtime forwards event to router

**✅ CORRECT:** This matches AI SDK v6 automatic tool execution pattern

### Tool Definition Pattern

**Current Pattern:**
```typescript
export const toolCodex = {
  async execute({ input, writer }) {
    const timeoutSec = input.timeoutSec ?? DEFAULT_TIMEOUT_SEC;
    
    await writer?.write({ type: 'notice', message: 'codex_turn_started' });
    
    const result = await runCodexWithTimeout(input, timeoutSec);
    
    await writer?.write({ type: 'notice', message: 'codex_turn_completed' });
    
    return result;
  }
};
```

### AI SDK v6 Tool Structure Verification

According to AI SDK v6, tools should have this structure:

```typescript
{
  description?: string;
  parameters: z.ZodSchema;  // Zod schema for input validation
  execute?: (input, options) => Promise<any>;  // Optional execute function
}
```

**⚠️ MEDIUM Issue #5: Tool structure not fully specified**

The runtime plan doesn't show:
- How tool `parameters` schema is defined
- How tool `description` is provided
- How tools are registered in the `buildTools()` function

**Recommendation:** Add example showing complete tool definition:

```typescript
export const toolCodex = {
  description: 'Execute code using the Codex tool',
  parameters: z.object({
    code: z.string(),
    timeoutSec: z.number().optional(),
  }),
  execute: async ({ input, writer }) => {
    // ... execution logic
  },
};
```

### Writer Pattern Verification

**⚠️ LOW Issue #6: Writer pattern not standard AI SDK v6**

The `writer` pattern in tools (e.g., `await writer?.write({ type: 'notice', message: '...' })`) appears to be custom, not from AI SDK v6.

AI SDK v6 doesn't have a built-in progress streaming mechanism during tool execution. The plan should clarify:
1. This is a custom extension to AI SDK tools
2. How `writer` is injected into tool execution context
3. How progress events are forwarded to the client

**Status:** Not a bug, but needs documentation that this is custom functionality.

---

## Milestone 5: Error Handling Verification

### Error Type Names

**Current Plan Uses:**
```typescript
if (error.name === 'AI_APICallError') {
  // ...
}
```

### AI SDK v6 Error Types

According to `docs/reference/ai-sdk-v6/reference_ai-sdk-errors/`, AI SDK v6 error classes are:

- `AISDKError` - Base class
- `AI_APICallError` ✅ - API call failures (CORRECT)
- `AI_InvalidArgumentError` - Invalid arguments
- `AI_InvalidResponseDataError` - Invalid response
- `AI_InvalidPromptError` - Invalid prompt
- `AI_JSONParseError` - JSON parsing failure
- `AI_TypeValidationError` - Type validation failure
- `AI_NoContentGeneratedError` - No content generated
- `AI_RetryError` - Retry exhaustion
- `AI_LoadAPIKeyError` - API key loading failure

**✅ MOSTLY CORRECT:** Error name `AI_APICallError` matches specification

### AbortError Handling

**Current Plan:**
```typescript
if (error.name === 'AbortError') {
  return { 
    type: 'error', 
    message: 'workflow_cancelled',
    recoverable: false 
  };
}
```

**⚠️ MEDIUM Issue #7: AbortError detection method**

The check `error.name === 'AbortError'` may not be reliable across all JavaScript environments. Better approach:

```typescript
if (error instanceof DOMException && error.name === 'AbortError') {
  // More robust detection
}
```

Or use AI SDK's abort handling via `onAbort` callback in `streamText()`:

```typescript
const stream = streamText({
  // ...
  onAbort: async ({ steps }) => {
    // Handle abortion gracefully
  },
});
```

### Status Code Handling

**Current Plan:**
```typescript
if (apiError.statusCode === 401 || apiError.statusCode === 403) {
  // authentication_failed
}

if (apiError.statusCode === 429) {
  // rate_limit_exceeded
}
```

**✅ CORRECT:** Status code handling matches HTTP standards

**Note:** AI SDK v6 `AI_APICallError` includes `statusCode` property according to documentation.

### Retry Logic Pattern

**Current Plan:**
```typescript
while (attempts < maxAttempts) {
  try {
    for await (const event of this.aiAdapter.stream(options)) {
      // Handle events
    }
    return;
  } catch (error) {
    attempts++;
    if (attempts >= maxAttempts) {
      yield { type: 'error', message: 'max_retries_exceeded', recoverable: false };
      throw error;
    }
    await delay(1000 * attempts);  // Exponential backoff
  }
}
```

**✅ CORRECT:** Exponential backoff pattern is appropriate

**Recommendation:** Consider using AI SDK v6's built-in retry mechanism if available, or ensure retry logic only retries transient errors (429, 5xx), not permanent errors (401, 403, 400).

---

## Milestone 6: Testing Pattern Verification

### Mock streamText Implementation

**Current Mock:**
```typescript
export function createMockStreamText() {
  const mock = vi.fn();
  
  mock.mockImplementation(async (options) => ({
    async *fullStream() {
      yield { type: 'text-delta', textDelta: 'Planning...' };  // ❌ WRONG property name
      
      yield { 
        type: 'tool-call', 
        toolCallId: 'tc-1',
        toolName: 'grep',
        args: { pattern: 'test' },  // ❌ WRONG property name
      };
      
      yield {
        type: 'tool-result',
        toolCallId: 'tc-1',
        toolName: 'grep',
        result: { matches: ['test'] },  // ❌ WRONG property name
      };
      
      yield { type: 'finish', finishReason: 'stop', usage: { totalTokens: 100 } };
    },
  }));
  
  return mock;
}
```

### AI SDK v6 Testing Best Practices

According to `docs/reference/ai-sdk-v6/ai-sdk-core_testing.md`, the recommended approach is:

```typescript
import { MockLanguageModelV1 } from 'ai/test';

// Use mock model instead of mocking streamText directly
const mockModel = new MockLanguageModelV1({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hello' },
      { type: 'text-delta', id: 'text-1', delta: ', ' },
      { type: 'text-delta', id: 'text-1', delta: 'world!' },
      { type: 'text-end', id: 'text-1' },
    ]),
    // ...
  }),
});
```

**⚠️ HIGH Issue #8: Testing approach doesn't use AI SDK's MockLanguageModelV1**

**Current Approach:** Mocking `streamText` function directly  
**Recommended Approach:** Use `MockLanguageModelV1` from `'ai/test'`

**Benefits of MockLanguageModelV1:**
- Type-safe event generation
- Matches real AI SDK behavior more closely
- Easier to maintain as AI SDK evolves
- Built-in helpers for common patterns

**Corrected Test Pattern:**
```typescript
import { MockLanguageModelV1 } from 'ai/test';
import { streamText } from 'ai';

describe('WorkflowRuntime', () => {
  it('executes workflow phases in order', async () => {
    const mockModel = new MockLanguageModelV1({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Planning...' },
          { type: 'text-end', id: 'text-1' },
          { 
            type: 'tool-call', 
            toolCallId: 'tc-1',
            toolName: 'grep',
            input: { pattern: 'test' },
          },
          {
            type: 'tool-result',
            toolCallId: 'tc-1',
            toolName: 'grep',
            input: { pattern: 'test' },
            output: { matches: ['test'] },
          },
          { type: 'finish', finishReason: 'stop', usage: { totalTokens: 100 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
    
    const runtime = new WorkflowRuntime({
      streamText, // Use real streamText, inject mock model
      model: mockModel,
      // ...
    });
    
    // ... rest of test
  });
});
```

### Test Isolation

**✅ CORRECT:** The plan shows proper test isolation with dependency injection:
```typescript
const runtime = new WorkflowRuntime({
  streamText: mockStreamText,
  cognitive: mockCognitive,
  // ... other mocks
});
```

This pattern allows testing runtime in isolation from real AI SDK and domain packages.

---

## Milestone 7: Summary of Findings & Recommendations

### Critical Issues (Must Fix Before Implementation)

#### Issue #1: `text-delta` property name incorrect
- **Location:** Question 9, line 749
- **Severity:** CRITICAL
- **Current:** `sdkEvent.textDelta`
- **Correct:** `sdkEvent.delta`
- **Missing:** `sdkEvent.id` field
- **Impact:** Runtime will fail with undefined values

#### Issue #2: `tool-call` property name incorrect
- **Location:** Question 9, line 756
- **Severity:** CRITICAL
- **Current:** `args: sdkEvent.args`
- **Correct:** `input: sdkEvent.input`
- **Impact:** Runtime will fail with undefined values

#### Issue #3: `tool-result` property names incorrect
- **Location:** Question 9, line 764
- **Severity:** CRITICAL
- **Current:** `result: sdkEvent.result`
- **Correct:** `output: sdkEvent.output` + `input: sdkEvent.input`
- **Impact:** Runtime will fail with undefined values

#### Issue #4: Mock test events use incorrect property names
- **Location:** Question 20, lines 1549, 1555, 1562
- **Severity:** CRITICAL
- **Current:** Mock uses `textDelta`, `args`, `result`
- **Correct:** Should use `delta`, `input`, `output`
- **Impact:** Tests pass but production fails

**Corrected AISDKAdapter Code:**

```typescript
// packages/runtime/src/adapters/ai-sdk-adapter.ts
import { streamText, type StreamTextResult } from 'ai';

export class AISDKAdapter {
  async *stream(options: StreamTextOptions): AsyncGenerator<WorkflowEvent> {
    const stream = await streamText(options);
    
    for await (const event of stream.fullStream) {
      const mapped = this.mapEvent(event);
      if (mapped) yield mapped;
    }
  }
  
  private mapEvent(sdkEvent: any): WorkflowEvent | null {
    switch (sdkEvent.type) {
      case 'text-delta':
        return {
          type: 'text-delta',
          id: sdkEvent.id,           // ADDED: required id field
          delta: sdkEvent.delta,     // FIXED: was sdkEvent.textDelta
        };
      
      case 'tool-call':
        return {
          type: 'tool-call',
          toolCallId: sdkEvent.toolCallId,  // FIXED: consistent naming
          toolName: sdkEvent.toolName,
          input: sdkEvent.input,             // FIXED: was sdkEvent.args
        };
      
      case 'tool-result':
        return {
          type: 'tool-result',
          toolCallId: sdkEvent.toolCallId,  // FIXED: consistent naming
          toolName: sdkEvent.toolName,
          input: sdkEvent.input,             // ADDED: include input
          output: sdkEvent.output,           // FIXED: was sdkEvent.result
        };
      
      case 'finish':
        return {
          type: 'finish',
          finishReason: sdkEvent.finishReason,
          usage: sdkEvent.usage,
        };
      
      case 'error':
        return {
          type: 'error',
          message: sdkEvent.error instanceof Error 
            ? sdkEvent.error.message 
            : String(sdkEvent.error),
        };
      
      // ADD missing event types
      case 'text-start':
      case 'text-end':
      case 'reasoning':
      case 'reasoning-start':
      case 'reasoning-delta':
      case 'reasoning-end':
      case 'tool-input-start':
      case 'tool-input-delta':
      case 'tool-input-end':
      case 'source':
      case 'file':
      case 'start-step':
      case 'finish-step':
      case 'start':
      case 'abort':
        // Forward these if WorkflowEvent supports them, or ignore
        return sdkEvent as WorkflowEvent;  // Type-safe forwarding
      
      default:
        return null;  // Ignore unknown events
    }
  }
}
```

---

### High Priority Issues (Should Fix)

#### Issue #5: Missing event types for advanced features
- **Location:** Question 9, mapEvent() switch statement
- **Severity:** HIGH
- **Missing:** Text lifecycle (`text-start`, `text-end`), reasoning events, step events, abort event
- **Impact:** Cannot support O1/O3 models, no multi-step tracking, poor cancellation UX
- **Recommendation:** Add handlers for all missing event types or document which are intentionally excluded

#### Issue #6: Testing approach doesn't use AI SDK's MockLanguageModelV1
- **Location:** Question 20, lines 1543-1570
- **Severity:** HIGH
- **Current:** Mocking `streamText` directly with incorrect property names
- **Correct:** Use `MockLanguageModelV1` from `'ai/test'` package
- **Impact:** Tests don't match real AI SDK behavior, fragile test infrastructure
- **Recommendation:** Adopt `MockLanguageModelV1` for more robust testing

**Corrected Test Code:**

```typescript
// packages/runtime/test/utils/mock-ai-sdk.ts
import { MockLanguageModelV1 } from 'ai/test';
import { convertArrayToReadableStream } from 'ai';

export function createMockModel() {
  return new MockLanguageModelV1({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Planning...' },
        { type: 'text-end', id: 'text-1' },
        { 
          type: 'tool-call', 
          toolCallId: 'tc-1',
          toolName: 'grep',
          input: { pattern: 'test' },
        },
        {
          type: 'tool-result',
          toolCallId: 'tc-1',
          toolName: 'grep',
          input: { pattern: 'test' },
          output: { matches: ['test'] },
        },
        { type: 'finish', finishReason: 'stop', usage: { totalTokens: 100 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

// Usage in tests
const mockModel = createMockModel();
const runtime = new WorkflowRuntime({
  model: mockModel,  // Inject mock model instead of mocking streamText
  // ... other dependencies
});
```

---

### Medium Priority Issues (Nice to Have)

#### Issue #7: AbortError detection could be more robust
- **Location:** Question 12, line 973
- **Severity:** MEDIUM
- **Current:** `error.name === 'AbortError'`
- **Better:** `error instanceof DOMException && error.name === 'AbortError'`
- **Alternative:** Use AI SDK's `onAbort` callback
- **Impact:** May miss abort errors in some environments
- **Recommendation:** Use more robust detection or AI SDK's built-in abort handling

#### Issue #8: Tool structure not fully specified
- **Location:** Question 11, lines 888-903
- **Severity:** MEDIUM
- **Current:** Only shows `execute` function
- **Missing:** `description` and `parameters` schema
- **Impact:** Incomplete documentation, unclear how tools are defined
- **Recommendation:** Add complete tool definition example with Zod schema

---

### Low Priority Issues (Documentation/Clarity)

#### Issue #9: Writer pattern needs documentation
- **Location:** Question 11, lines 894, 899
- **Severity:** LOW
- **Issue:** Writer pattern appears custom, not from AI SDK v6
- **Impact:** Unclear how this integrates with AI SDK
- **Recommendation:** Document that this is custom functionality and how it's injected

---

### Event Mapping Table Update

The event mapping table in Question 10 needs these corrections:

| AI SDK Event | WorkflowEvent (Corrected) | Notes |
|--------------|---------------------------|-------|
| `text-delta` | `{ type: 'text-delta', id, delta }` | ✅ Added `id` field, fixed property name |
| `tool-call` | `{ type: 'tool-call', toolCallId, toolName, input }` | ✅ Fixed property names |
| `tool-result` | `{ type: 'tool-result', toolCallId, toolName, input, output }` | ✅ Fixed property names, added `input` |
| `finish` | `{ type: 'finish', finishReason, usage }` | ✅ No changes needed |
| `error` | `{ type: 'error', message }` | ✅ No changes needed |
| `reasoning` | `{ type: 'reasoning', text }` | ✅ Mentioned but not implemented |
| **NEW:** `text-start` | `{ type: 'text-start', id }` | ⚠️ Not implemented |
| **NEW:** `text-end` | `{ type: 'text-end', id }` | ⚠️ Not implemented |
| **NEW:** `start-step` | `{ type: 'start-step', ... }` | ⚠️ Not implemented |
| **NEW:** `finish-step` | `{ type: 'finish-step', ... }` | ⚠️ Not implemented |
| **NEW:** `abort` | `{ type: 'abort' }` | ⚠️ Not implemented |

---

### Recommendations Priority List

**Before Implementation (Critical):**
1. Fix all property name mismatches in `AISDKAdapter.mapEvent()`
2. Fix mock test event property names
3. Add missing `id` field to `text-delta` events
4. Update event mapping table in Question 10

**During Implementation (High Priority):**
5. Add handlers for missing event types (especially `abort`, `text-start/end`, `start-step/finish-step`)
6. Adopt `MockLanguageModelV1` for testing instead of mocking `streamText` directly

**Post-Implementation (Medium Priority):**
7. Improve AbortError detection or use AI SDK's `onAbort` callback
8. Add complete tool definition examples with `description` and `parameters` schema

**Documentation (Low Priority):**
9. Document custom writer pattern and how it integrates with AI SDK
10. Consider optional AI SDK parameters (`system`, `temperature`, `onFinish`, etc.)

---

## Next Steps

**Milestone 8:** Apply all corrections to runtime-integration.md and update Decision Log

