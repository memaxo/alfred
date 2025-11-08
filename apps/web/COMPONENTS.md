# ALFRED Web Components

## Overview

This directory contains UI components for the ALFRED web application, following the Carmack-Karpathy principles:
- **Simplicity**: Pure functions, zero allocations in hot paths
- **Composition**: Small, composable components
- **Performance**: Memoized, optimized rendering
- **Type Safety**: Full TypeScript coverage
- **Accessibility**: WCAG 2.1 AA compliant

## Component Philosophy

### Single-Word Naming
All components follow the single-word naming convention from `.ruler/01-naming-conventions.md`:
- ✅ `chat.tsx`, `msg.tsx`, `orb.tsx`
- ❌ `conversation-bar.tsx`, `message-bubble.tsx`

Exceptions allowed for UI ergonomics (e.g., `voice-btn.tsx`).

### Composition Pattern
Components are designed for maximum composition:
```tsx
// Chat = Msg[] + Chatbar
<Chat messages={messages} onSend={send} />

// Plan = Task[] + Branch[]
<Plan plan={plan} />

// Actions = Tool[] + Status
<Actions actions={actions} />
```

### Pure Functions
Every component is a pure function:
- Deterministic rendering
- No side effects
- No object creation in render
- Stable props

### Error Isolation
Each component tree has its own error boundary:
```tsx
<ErrorBoundary>
  <Chat messages={messages} />
</ErrorBoundary>
```

## Core Components

### Conversation
- **ChatContainer**: Integrates streaming hooks with the shared `@alfred/ui` Chat component (virtualized + perf metrics)
- **Controls**: Agent switcher (Assistant/Orchestrator)
- **Connect**: Connection status indicator

### AI SDK Elements
- **Actions**: Tool invocation display
- **Ctx**: Runtime context display
- **Think**: Reasoning chain
- **Plan**: Task breakdown
- **Tool**: Tool execution details
- **Task**: Task progress
- **Confirm**: Confirmation dialogs
- **Cite**: Inline citations
- **Branch**: Decision branches
- **Thought**: Chain of thought
- **Code**: Code blocks

### Voice & Audio
- **Audio**: Audio player
- **Viz**: Bar visualizer
- **Voice**: Voice picker
- **Orb**: Floating orb for visual feedback
- **Wave**: Live waveform
- **Mic**: Microphone selector
- **VoiceBtn**: Large voice button for drive mode
- **DriveMode**: Full-screen drive mode UI

### Canvas & Preview
- **Preview**: App preview display
- **Node**: Workflow node
- **Artifact**: Droid output artifacts
- **Panel**: Side panel
- **Toolbar**: Action toolbar
- **Canvas**: Workflow canvas
- **Edge**: Node connections

## Hooks

### Streaming Hooks
- **useAssistantStream**: Assistant-specific streaming
- **useVoiceCapture**: Voice input/output handling

### Usage Example
```tsx
import { useAssistantStream } from "@/hooks/use-assistant-stream";
import { ChatContainer } from "@/components/chat-container";

function MyPage() {
  return (
    <ChatContainer
      agent="assistant"
      thread="user-123"
      resource="user-123"
    />
  );
}
```

## Type Safety

All components use shared types from `@alfred/type`:
- **StreamEvent**: Pure event model for streaming
- **Message**: Message types for conversation
- **ToolCall**: Tool invocation structure

## Performance

### Memoization
All components are memoized with `React.memo`:
```tsx
export const Chat = memo(ChatInner, (prev, next) => {
  return prev.messages.length === next.messages.length &&
    prev.messages.every((msg, i) => msg.id === next.messages[i]?.id);
});
```

### Stable Callbacks
All callbacks use `useCallback`:
```tsx
const handleSubmit = useCallback((e: React.FormEvent) => {
  e.preventDefault();
  const trimmed = message.trim();
  if (trimmed) {
    onSend(trimmed);
    setMessage("");
  }
}, [message, onSend]);
```

## Accessibility

All interactive elements have ARIA labels:
```tsx
<Button
  onClick={onClick}
  aria-label="Send message"
  aria-pressed={isPressed}
  role="button"
>
  <Icon aria-hidden="true" />
</Button>
```

Live regions for status updates:
```tsx
<div role="status" aria-live="polite" aria-label="Loading">
  Loading...
</div>
```

## Error Handling

Component-level error boundaries:
```tsx
<ErrorBoundary
  fallback={<ErrorFallback />}
  onError={(error) => console.error(error)}
>
  <ComponentTree />
</ErrorBoundary>
```

## Testing

Components are tested with Vitest + React Testing Library:
```tsx
describe("Chat", () => {
  it("renders messages", () => {
    const { getByText } = render(<Chat messages={messages} />);
    expect(getByText("Hello")).toBeInTheDocument();
  });
});
```

## Future Enhancements

1. **Phase 2**: Data visualization components (chart, number, matrix)
2. **Phase 3**: Form field components (text, select, date, etc.)
3. **Voice Integration**: Complete STT/TTS wiring
4. **Layout Components**: Grid, dock, terminal
5. **Profile Components**: Profile dropdown, settings panels
