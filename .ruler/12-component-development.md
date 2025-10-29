# Component Development Rules

## Core Principles

- **Composition.** Small, composable components that combine into larger interfaces.
- **Performance.** Zero allocations in hot paths, memoized rendering, stable callbacks.
- **Type Safety.** Full TypeScript coverage with shared types from `@alfred/type`.
- **Accessibility.** WCAG 2.1 AA compliant with ARIA labels and keyboard navigation.
- **Simplicity.** Pure functions, zero side effects, deterministic rendering.

## Component Patterns

### 1. Single-Word Naming

Follow `.ruler/01-naming-conventions.md` strictly:

- ✅ `chat.tsx`, `msg.tsx`, `orb.tsx`, `plan.tsx`
- ❌ `conversation-bar.tsx`, `message-bubble.tsx`, `planning-widget.tsx`

**UI ergonomics exceptions (limited):**
- Hook prefixes: `use-agent-stream.ts`
- Compound UI elements: `voice-btn.tsx`, `chat-container.tsx`
- Framework conventions: `sign-in.tsx`, `sign-up.tsx`

### 2. Composition Pattern

Design components for maximum composition:

```tsx
// Chat = Msg[] + Chatbar
function Chat({ messages, onSend }: ChatProps) {
  return (
    <div>
      {messages.map(msg => <Msg key={msg.id} {...msg} />)}
      <Chatbar onSend={onSend} />
    </div>
  );
}

// Plan = Task[] + Branch[]
function Plan({ plan }: PlanProps) {
  return (
    <div>
      {plan.tasks.map(task => <Task key={task.id} {...task} />)}
      {plan.branches && <Branch branches={plan.branches} />}
    </div>
  );
}
```

### 3. Pure Functions

Every component is a pure function:

```tsx
// ✅ Pure: deterministic rendering
function Msg({ role, content }: MsgProps) {
  return <div>{content}</div>;
}

// ❌ Impure: side effects in render
function Msg({ role, content }: MsgProps) {
  useEffect(() => console.log("rendered")); // Bad!
  return <div>{content}</div>;
}
```

**Requirements:**
- No side effects in render
- No object creation in render (`new Date()`, `{}`, `[]`)
- Deterministic output for same props
- No mutations of props or external state

### 4. Memoization Strategy

Memoize all components to prevent unnecessary re-renders:

```tsx
import { memo } from "react";

function ChatInner({ messages, onSend }: ChatProps) {
  // Component implementation
}

// Memoize with custom comparison
export const Chat = memo(ChatInner, (prev, next) => {
  return (
    prev.messages.length === next.messages.length &&
    prev.messages.every((msg, i) => msg.id === next.messages[i]?.id)
  );
});
```

**When to memoize:**
- All components that receive props
- Custom comparison for expensive updates
- Stable callbacks with `useCallback`

### 5. Null Safety

Handle missing data gracefully:

```tsx
function Msg({ role, content, timestamp }: MsgProps) {
  // Early return for null/missing data
  if (!content) return null;
  
  // Optional chaining for nested properties
  const timeStr = timestamp?.toLocaleTimeString() ?? "";
  
  return (
    <div>
      {timeStr && <span>{timeStr}</span>}
      <p>{content}</p>
    </div>
  );
}
```

**Requirements:**
- Early returns for missing required data
- Nullish coalescing (`??`) for optional data
- Conditional rendering for optional elements
- Never throw on null/undefined props

### 6. Error Boundaries

Isolate errors per component tree:

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

function ChatContainer() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <Chat messages={messages} />
    </ErrorBoundary>
  );
}
```

**Pattern:**
- One boundary per major UI section (Chat, Voice, Canvas)
- Clear error messages
- Recovery actions (retry, clear, etc.)

### 7. Accessibility

Every interactive element must be accessible:

```tsx
// ✅ Proper ARIA labels
<Button
  onClick={onClick}
  aria-label="Send message"
  aria-pressed={isPressed}
  role="button"
>
  <Icon aria-hidden="true" />
</Button>

// ✅ Live regions for status updates
<div role="status" aria-live="polite" aria-label="Loading">
  Loading...
</div>

// ✅ Semantic HTML
<form onSubmit={handleSubmit}>
  <input type="text" aria-label="Message input" />
  <button type="submit" aria-label="Send">Send</button>
</form>
```

**Requirements:**
- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Semantic HTML where possible
- `aria-hidden="true"` for decorative icons

### 8. Performance Budgets

Meet performance budgets for hot paths:

| Component Type | Budget | Measurement |
|----------------|--------|-------------|
| Message render | < 1ms | 95th percentile |
| List virtualization | < 5ms | Initial render |
| Form submission | < 10ms | User-triggered |
| Animation frame | < 16ms | 60fps |

**Techniques:**
- Memoize expensive computations with `useMemo`
- Virtualize long lists (`react-window` or `react-virtual`)
- Lazy load components (`React.lazy`)
- Code split by route (`@tanstack/react-router`)

### 9. Type Safety

Use shared types from `@alfred/type`:

```tsx
import type { StreamEvent, MessageEvent, ActionEvent } from "@alfred/type/stream";
import type { Message } from "@alfred/type/msg";

interface ChatProps {
  messages: Message[];
  onSend: (text: string) => void;
}
```

**Patterns:**
- Import types, never redefine
- Zod schemas for runtime validation
- Discriminated unions for events
- Type guards for filtering (`isMessageEvent`, `isActionEvent`)

### 10. Streaming Integration

Components must handle streaming events:

```tsx
import { useAssistantStream } from "@/hooks/use-assistant-stream";

function ChatContainer() {
  const { messages, actions, status, send } = useAssistantStream();
  
  return (
    <div>
      <Connect status={status} />
      <Chat messages={messages} onSend={send} />
      {actions.length > 0 && <Actions actions={actions} />}
    </div>
  );
}
```

**Streaming patterns:**
- Event-driven updates via hooks
- Cache handoff for TanStack Query
- Progress indicators for long operations
- Error states for failed streams

## Component File Structure

```
apps/web/src/components/
├── index.ts              # Central exports
├── manifest.ts           # Registry mapping
├── error-boundary.tsx    # Error isolation
├── chat.tsx              # Core components
├── msg.tsx
├── chatbar.tsx
├── controls.tsx
├── connect.tsx
├── audio.tsx             # Voice components
├── voice-btn.tsx
├── orb.tsx
├── plan.tsx              # AI SDK Elements
├── actions.tsx
├── tool.tsx
├── task.tsx
├── node.tsx              # Canvas components
├── canvas.tsx
├── edge.tsx
└── ui/                   # shadcn/ui primitives
    ├── button.tsx
    ├── card.tsx
    └── input.tsx
```

## Hooks Patterns

### Streaming Hooks

```tsx
// Generic agent streaming
export function useAgentStream({ agent, onError }: Options) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("disconnected");
  
  const handleEvent = useCallback((event: StreamEvent) => {
    if (isMessageEvent(event)) {
      setMessages(prev => [...prev, event.data]);
    } else if (isStatusEvent(event)) {
      setStatus(event.data.state);
    }
  }, []);
  
  return { messages, status, send, clear };
}
```

**Requirements:**
- Single responsibility per hook
- Pure event transformations
- Automatic cache handoff
- Error handling with `onError` callback

### Component Hooks

```tsx
function ChatbarInner({ onSend }: ChatbarProps) {
  const [message, setMessage] = useState("");
  
  // Stable callbacks: no recreations
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed) {
      onSend(trimmed);
      setMessage("");
    }
  }, [message, onSend]);
  
  return <form onSubmit={handleSubmit}>...</form>;
}

export const Chatbar = memo(ChatbarInner);
```

**Requirements:**
- Stable callbacks with `useCallback`
- Memoized components with `React.memo`
- No inline object creation
- Early returns for invalid states

## Testing Strategy

### Component Tests

```tsx
import { render, screen } from "@testing-library/react";
import { Chat } from "./chat";

describe("Chat", () => {
  it("renders messages", () => {
    const messages = [
      { id: "1", role: "user", content: "Hello", timestamp: new Date() },
    ];
    render(<Chat messages={messages} onSend={() => {}} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
  
  it("handles empty state", () => {
    render(<Chat messages={[]} onSend={() => {}} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
```

**Requirements:**
- Render tests for all components
- Event handler tests
- Empty state tests
- Error state tests
- Accessibility tests (`axe-core`)

## Performance Monitoring

### Metrics

Track component performance in production:

```tsx
import { performance } from "perf_hooks";

function ChatInner({ messages }: ChatProps) {
  useEffect(() => {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (duration > 16) {
        console.warn(`Chat render took ${duration}ms`);
      }
    };
  });
  
  return <div>...</div>;
}
```

**Metrics to track:**
- Component render time
- Re-render frequency
- Event handler latency
- Memory allocations

## Common Pitfalls

### ❌ Avoid These Patterns

```tsx
// ❌ Impure: side effects in render
function Component() {
  console.log("rendered"); // Bad!
  return <div>...</div>;
}

// ❌ Allocations: object creation in render
function Component({ data }) {
  return <div>{new Date().toISOString()}</div>; // Bad!
}

// ❌ Unstable: new function every render
function Component({ onAction }) {
  return <Button onClick={() => onAction("test")} />; // Bad!
}

// ❌ Missing memoization
function Component({ items }) {
  return items.map(item => <Item key={item.id} {...item} />); // Bad!
}
```

### ✅ Use These Patterns

```tsx
// ✅ Pure: no side effects
function Component() {
  return <div>...</div>;
}

// ✅ Stable: memoized value
function Component({ data }) {
  const timestamp = useMemo(() => new Date().toISOString(), []);
  return <div>{timestamp}</div>;
}

// ✅ Stable: useCallback
function Component({ onAction }) {
  const handleClick = useCallback(() => onAction("test"), [onAction]);
  return <Button onClick={handleClick} />;
}

// ✅ Memoized: prevent re-renders
const Component = memo(({ items }) => {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

## Carmack-Karpathy Alignment

### Carmack: Measure Everything
- Profile before optimizing
- Track render times
- Monitor allocations
- Question conventional wisdom

### Karpathy: Beautiful Simplicity
- Pure functions over classes
- Composition over inheritance
- Type safety over runtime checks
- Teaching is compression

### Alfred Persona
- "Indeed, sir. Components execute in < 1ms."
- "Might I suggest memoization for this hot path?"
- "Regrettably, this violates our accessibility standards."
- "Excellent. Zero allocations detected."

## Example: Complete Component

```tsx
/**
 * Message Component
 * 
 * Pure function: deterministic rendering
 * Memoized: prevents unnecessary re-renders
 * Null-safe: handles missing data
 * Accessible: ARIA labels and keyboard support
 */

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface MsgProps {
  role: "user" | "assistant" | "orchestrator";
  content: string;
  timestamp: Date;
  className?: string;
}

function MsgInner({ role, content, timestamp, className }: MsgProps) {
  // Null safety: early return
  if (!content) return null;
  
  // Pre-compute values
  const isUser = role === "user";
  const timeStr = timestamp?.toLocaleTimeString() ?? "";
  
  return (
    <Card
      className={cn(
        "w-fit max-w-[80%]",
        isUser && "ml-auto",
        !isUser && "mr-auto",
        className,
      )}
      role="article"
      aria-label={`Message from ${role}`}
    >
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {role}
            </span>
            {timeStr && (
              <span className="text-xs text-muted-foreground">
                {timeStr}
              </span>
            )}
          </div>
          <p className="text-sm">{content}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Memoize: pure component
export const Msg = memo(MsgInner);
```

This component demonstrates:
- ✅ Single-word naming
- ✅ Pure function (no side effects)
- ✅ Memoized rendering
- ✅ Null safety
- ✅ Accessibility
- ✅ Performance (zero allocations)
- ✅ Type safety

