# Streaming Patterns

## Core Principles

- **Event-Driven.** Pure event model with type guards and factory functions.
- **Zero Allocations.** Stable callbacks, memoized state, no object creation in hot paths.
- **Cache Handoff.** Automatic TanStack Query updates without flicker.
- **Error Isolation.** Clear error states with recovery paths.

## Event Model

### Base Event Structure

```typescript
interface BaseEvent {
  type: string;
  ts: number; // Unix timestamp for zero-allocation lookups
}
```

### Event Types

```typescript
// Message events
interface MessageEvent extends BaseEvent {
  type: "message";
  data: {
    delta: string;
    cumulative: string;
    role: "user" | "assistant" | "orchestrator";
  };
}

// Action events (tool invocations)
interface ActionEvent extends BaseEvent {
  type: "action";
  data: {
    id: string;
    tool: string;
    args: Record<string, unknown>;
    status: "pending" | "running" | "completed" | "error";
    result?: unknown;
    error?: string;
  };
}

// Status events
interface StatusEvent extends BaseEvent {
  type: "status";
  data: {
    state: "connecting" | "connected" | "disconnected" | "error";
    message?: string;
  };
}

// Progress events
interface ProgressEvent extends BaseEvent {
  type: "progress";
  data: {
    taskId: string;
    percent: number;
    message: string;
  };
}

// Cache handoff events
interface CacheHandoffEvent extends BaseEvent {
  type: "cache_handoff";
  data: {
    key: string[];
    value: unknown;
    merge?: boolean;
  };
}

// Error events
interface ErrorEvent extends BaseEvent {
  type: "error";
  data: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}
```

### Type Guards

```typescript
export function isMessageEvent(event: StreamEvent): event is MessageEvent {
  return event.type === "message";
}

export function isActionEvent(event: StreamEvent): event is ActionEvent {
  return event.type === "action";
}

export function isStatusEvent(event: StreamEvent): event is StatusEvent {
  return event.type === "status";
}

export function isProgressEvent(event: StreamEvent): event is ProgressEvent {
  return event.type === "progress";
}

export function isCacheHandoffEvent(event: StreamEvent): event is CacheHandoffEvent {
  return event.type === "cache_handoff";
}

export function isErrorEvent(event: StreamEvent): event is ErrorEvent {
  return event.type === "error";
}
```

### Event Factories

```typescript
// Zero-allocation event creation
export function createMessageEvent(
  delta: string,
  cumulative: string,
  role: "user" | "assistant" | "orchestrator",
): MessageEvent {
  return {
    type: "message",
    ts: Date.now(),
    data: { delta, cumulative, role },
  };
}

export function createActionEvent(
  id: string,
  tool: string,
  args: Record<string, unknown>,
  status: "pending" | "running" | "completed" | "error",
  result?: unknown,
  error?: string,
): ActionEvent {
  return {
    type: "action",
    ts: Date.now(),
    data: { id, tool, args, status, result, error },
  };
}
```

## Hook Patterns

### Basic Streaming Hook

```typescript
export function useAgentStream({ agent, onError }: Options) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("disconnected");
  
  // Handle cache handoff automatically
  const handleCacheHandoff = useCallback((event: StreamEvent) => {
    if (isCacheHandoffEvent(event)) {
      const { key, value, merge } = event.data;
      if (merge) {
        queryClient.setQueryData(key, (old: unknown) => ({
          ...(old as Record<string, unknown>),
          ...(value as Record<string, unknown>),
        }));
      } else {
        queryClient.setQueryData(key, value);
      }
    }
  }, [queryClient]);
  
  // Transform event to state
  const handleEvent = useCallback((event: StreamEvent) => {
    if (isMessageEvent(event)) {
      setMessages(prev => [...prev, event.data]);
    } else if (isStatusEvent(event)) {
      setStatus(event.data.state);
    } else if (isErrorEvent(event)) {
      const err = new Error(event.data.message);
      onError?.(err);
    }
    
    // Always handle cache handoff
    handleCacheHandoff(event);
  }, [handleCacheHandoff, onError]);
  
  return { messages, status, send, clear };
}
```

### tRPC Integration

```typescript
export function useAssistantStream({ thread, resource }: Options) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  
  // Handle streaming chunk
  const handleChunk = useCallback((chunk: Record<string, unknown>) => {
    const chunkType = chunk.type as string;
    
    // Message deltas
    if (chunkType === "message-delta" || chunkType === "text-delta") {
      const content = (chunk.delta as string) ?? "";
      if (content) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content,
          timestamp: new Date(),
        }]);
      }
    }
    
    // Cache handoff
    if (chunkType === "data-cache-handoff") {
      const key = chunk.key as string[];
      const value = chunk.value;
      if (key && value) {
        queryClient.setQueryData(key, value);
      }
    }
  }, [queryClient]);
  
  // TODO: Wire to tRPC subscription
  const send = useCallback((message: string) => {
    // trpc.assistant.stream.useSubscription({ ... }, { onData: handleChunk });
  }, [handleChunk]);
  
  return { messages, send, clear };
}
```

## Component Integration

### Stream-Aware Components

```typescript
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { Chat } from "./chat";
import { Connect } from "./connect";
import { Actions } from "./actions";

function ChatContainer() {
  const { messages, actions, status, send, clear } = useAssistantStream();
  
  return (
    <div>
      <Connect status={status} />
      <Chat messages={messages} onSend={send} />
      {actions.length > 0 && <Actions actions={actions} />}
    </div>
  );
}
```

### Error Handling

```typescript
import { ErrorBoundary } from "./error-boundary";

function ChatContainer() {
  return (
    <ErrorBoundary
      fallback={<ErrorFallback />}
      onError={(error) => console.error(error)}
    >
      <ChatStream />
    </ErrorBoundary>
  );
}
```

## Performance Constraints

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Event transformation | < 100μs | 95th percentile |
| Cache handoff | < 1ms | 99th percentile |
| State update | < 1ms | 95th percentile |
| Component render | < 16ms | Animation frame |

## Best Practices

### ✅ Do

- Use type guards for event filtering
- Memoize event handlers with `useCallback`
- Handle cache handoff automatically
- Isolate errors with boundaries
- Track events with timestamps

### ❌ Don't

- Create objects in event handlers
- Forget to handle error events
- Skip cache handoff for state updates
- Mix streaming logic with component logic
- Allocate memory in hot paths

## Carmack-Karpathy Alignment

### Carmack: Measure Everything
- Profile event transformations
- Track cache hit rates
- Monitor allocation rates
- Benchmark hot paths

### Karpathy: Beautiful Simplicity
- Pure event transformations
- Explicit type guards
- Clear error states
- Teaching is compression

### Alfred Persona
- "Indeed, sir. Event processing completes in 0.05ms."
- "Might I suggest memoization for this stream handler?"
- "Regrettably, this event allocation exceeds our budget."
- "Excellent. Zero cache misses detected."

