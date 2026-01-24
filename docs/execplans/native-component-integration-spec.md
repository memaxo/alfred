# Native Component Integration — Implementation Spec

## Overview

This spec details the technical approach for wiring the 54+ void aesthetic components into the live ALFRED iOS app. The goal is to transform the static component library into a fully functional app with real data bindings.

---

## Phase 1: Message Rendering Integration

### Current State

- `ChatList` uses `MessageBubble` component
- Messages have `parts` array with types: `text`, `reasoning`, `tool-call`, `tool-result`, `data-ui`
- `MessageBubbleVoid` exists but not connected

### Implementation

**1.1 Update ChatList**

```tsx
// apps/native/components/chat/chat-list.tsx
import { MessageBubbleVoid } from "./MessageBubbleVoid";

const renderItem = useCallback(
  ({ item }: { item: UIMessage }) => (
    <MessageBubbleVoid
      message={item}
      onCopy={() => handleCopy(item)}
      onRetry={() => handleRetry(item)}
    />
  ),
  [handleCopy, handleRetry]
);
```

**1.2 Wire GenUI Renderer**

```tsx
// apps/native/components/chat/MessageBubbleVoid.tsx
import { GenUIRenderer } from "../genui/renderer";

// Inside render, for each part:
{
  part.type === "data-ui" && (
    <GenUIRenderer part={part} fallbackToJson={true} />
  );
}
```

**1.3 Connect Streaming Text**

```tsx
// Detect streaming state from message metadata
const isStreaming = message.metadata?.streaming === true;

{
  isStreaming ? (
    <StreamingText text={textContent} speed={30} />
  ) : (
    <BiolumText>{textContent}</BiolumText>
  );
}
```

**1.4 Wire Tool Cards**

```tsx
// Map tool-call parts to ToolCallCard
{
  part.type === "tool-call" && (
    <ToolCallCard
      toolName={part.toolName}
      params={part.input}
      state={getToolState(part.toolCallId)} // pending/running/success/error
    />
  );
}

{
  part.type === "tool-result" && (
    <ToolCallCard
      toolName={part.toolName}
      output={part.output}
      isError={part.isError}
      state="completed"
    />
  );
}
```

---

## Phase 2: Voice System Integration

### Current State

- `useVoiceSessionNative` provides `voice.stream` with:
  - `vadConfidence`: 0-1 float
  - `transcript`: string
  - `status`: 'idle' | 'recording' | 'processing' | 'playing' | 'error'
- Voice components exist but use placeholder data

### Implementation

**2.1 Wire Waveform**

```tsx
// apps/native/app/(drawer)/(tabs)/drive.tsx
const audioLevel = voice.stream?.vadConfidence ?? 0;

<Waveform
  audioLevel={audioLevel}
  active={status === "holding"}
  barCount={32}
  height={60}
/>;
```

**2.2 Wire VADIndicator**

```tsx
<VADIndicator
  active={voice.stream?.status === "recording"}
  intensity={voice.stream?.vadConfidence ?? 0}
  size={220}
/>
```

**2.3 Wire TranscriptStream**

```tsx
// Create transcript entries from voice stream
const transcriptEntries = useMemo(() => {
  if (!voice.stream?.transcript) return [];
  return [
    {
      id: "current",
      text: voice.stream.transcript,
      speaker: "user",
      timestamp: Date.now(),
      isFinal: voice.stream.status !== "recording",
    },
  ];
}, [voice.stream?.transcript, voice.stream?.status]);

<TranscriptStream
  entries={transcriptEntries}
  isListening={voice.stream?.status === "recording"}
/>;
```

---

## Phase 3: Chat Input Integration

### Implementation

**3.1 Create VoidChatInput**

```tsx
// apps/native/components/chat/ChatInputVoid.tsx
export function ChatInputVoid({
  onSend,
  onVoice,
  disabled,
  isRecording,
}: ChatInputVoidProps) {
  const theme = useVoidTheme();
  const [text, setText] = useState("");

  return (
    <HUDSurface elevation={2} style={styles.container}>
      <TextInput
        style={[styles.input, { color: theme.colors.biolum.standard }]}
        value={text}
        onChangeText={setText}
        placeholder="Message Alfred..."
        placeholderTextColor={theme.colors.biolum.faint}
        multiline
        maxLength={4000}
      />
      <View style={styles.actions}>
        <FluidButton
          icon={<Ionicons name={isRecording ? "stop" : "mic"} />}
          variant="ghost"
          onPress={onVoice}
        />
        <FluidButton
          icon={<Ionicons name="send" />}
          variant="primary"
          onPress={() => {
            onSend(text);
            setText("");
          }}
          disabled={disabled || !text.trim()}
          breathing={!!text.trim()}
        />
      </View>
    </HUDSurface>
  );
}
```

---

## Phase 4: GenUI Data Binding

### Schema Mapping

```tsx
// apps/native/components/genui/types.ts
export interface GenUISchema {
  component: string;
  props: Record<string, unknown>;
  children?: GenUISchema[];
}

export interface ChartSchema {
  component: "chart";
  props: {
    type: "line" | "bar" | "area";
    data: Array<{ x: number | string; y: number }>;
    xLabel?: string;
    yLabel?: string;
  };
}

export interface ListSchema {
  component: "list";
  props: {
    items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      icon?: string;
    }>;
  };
}

// ... similar for other components
```

### Registry Update

```tsx
// apps/native/components/genui/registry.ts
import { transformChartData, transformListData } from "./transforms";

export const GENUI_TRANSFORMS = {
  chart: transformChartData,
  list: transformListData,
  grid: transformGridData,
  // ... etc
};

export function renderGenUIComponent(schema: GenUISchema) {
  const Component = GENUI_REGISTRY[schema.component];
  const transform = GENUI_TRANSFORMS[schema.component];

  if (!Component) return <JsonFallback data={schema} />;

  const props = transform ? transform(schema.props) : schema.props;
  return <Component {...props} />;
}
```

---

## Phase 5: Library Screens

### Screen Structure

```
apps/native/app/(drawer)/library/
├── _layout.tsx          # Stack navigator
├── index.tsx            # Library home (current two.tsx)
├── notes.tsx            # Notes list
├── notes/[id].tsx       # Note detail
├── reminders.tsx        # Reminders list
├── reminders/[id].tsx   # Reminder detail
├── timers.tsx           # Timers list
├── bookmarks.tsx        # Bookmarks list
```

### Example Screen

```tsx
// apps/native/app/(drawer)/library/notes.tsx
export default function NotesScreen() {
  const { data: notes, isLoading } = trpc.note.list.useQuery({ limit: 50 });
  const theme = useVoidTheme();

  if (isLoading) return <LoadingSkeleton />;
  if (!notes?.length)
    return <EmptyState icon="document-text" title="No notes" />;

  return (
    <VoidContainer gradient="ambient">
      <FlatList
        data={notes}
        renderItem={({ item }) => (
          <HUDSurface elevation={1} style={styles.card}>
            <BiolumText variant="body" size="large">
              {item.title}
            </BiolumText>
            <CaptionText color="dim">{item.preview}</CaptionText>
          </HUDSurface>
        )}
        // Performance props
        removeClippedSubviews
        maxToRenderPerBatch={10}
      />
    </VoidContainer>
  );
}
```

---

## Phase 6: Toast System

### Context Implementation

```tsx
// apps/native/contexts/toast.tsx
interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const ToastContext = createContext<{
  show: (type: ToastType, title: string, message?: string) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = `toast-${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        { id, type, title, message, duration: 3000 },
      ]);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
```

### Usage

```tsx
// In any component
const toast = useToast();

// On error
toast.show("error", "Failed to save", error.message);

// On success
toast.show("success", "Note saved");
```

---

## Phase 7: Bottom Sheet System

### Context Implementation

```tsx
// apps/native/contexts/sheet.tsx
interface SheetState {
  content: ReactNode | null;
  snapPoints: (string | number)[];
}

const SheetContext = createContext<{
  open: (content: ReactNode, snapPoints?: (string | number)[]) => void;
  close: () => void;
} | null>(null);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheetState>({
    content: null,
    snapPoints: ["50%"],
  });
  const sheetRef = useRef<BottomSheet>(null);

  const open = useCallback(
    (content: ReactNode, snapPoints = ["50%", "90%"]) => {
      setState({ content, snapPoints });
      sheetRef.current?.expand();
    },
    []
  );

  const close = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  return (
    <SheetContext.Provider value={{ open, close }}>
      {children}
      <BottomSheet
        ref={sheetRef}
        snapPoints={state.snapPoints}
        onClose={() => setState((s) => ({ ...s, content: null }))}
      >
        {state.content}
      </BottomSheet>
    </SheetContext.Provider>
  );
}
```

---

## Phase 10: Error Boundaries

### Screen Error Boundary

```tsx
// apps/native/components/ErrorBoundary.tsx
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <VoidContainer gradient="ambient">
          <ErrorPanel
            title="Something went wrong"
            message={this.state.error?.message}
            onRetry={this.handleRetry}
            onDismiss={this.handleRetry}
          />
        </VoidContainer>
      );
    }
    return this.props.children;
  }
}
```

### Usage in Layout

```tsx
// apps/native/app/_layout.tsx
export default function RootLayout() {
  return (
    <ToastProvider>
      <SheetProvider>
        <ScreenErrorBoundary>
          <Stack />
        </ScreenErrorBoundary>
      </SheetProvider>
    </ToastProvider>
  );
}
```

---

## File Changes Summary

### New Files to Create

- `apps/native/components/chat/ChatInputVoid.tsx`
- `apps/native/components/genui/types.ts`
- `apps/native/components/genui/transforms.ts`
- `apps/native/contexts/toast.tsx`
- `apps/native/contexts/sheet.tsx`
- `apps/native/components/ErrorBoundary.tsx`
- `apps/native/app/(drawer)/library/_layout.tsx`
- `apps/native/app/(drawer)/library/notes.tsx`
- `apps/native/app/(drawer)/library/notes/[id].tsx`
- `apps/native/app/(drawer)/library/reminders.tsx`
- `apps/native/app/(drawer)/library/timers.tsx`
- `apps/native/app/(drawer)/library/bookmarks.tsx`

### Files to Modify

- `apps/native/components/chat/chat-list.tsx`
- `apps/native/components/chat/MessageBubbleVoid.tsx`
- `apps/native/app/(drawer)/(tabs)/index.tsx`
- `apps/native/app/(drawer)/(tabs)/drive.tsx`
- `apps/native/app/(drawer)/(tabs)/two.tsx`
- `apps/native/app/_layout.tsx`
- `apps/native/components/genui/registry.ts`
- `apps/native/components/genui/renderer.tsx`
- `apps/native/hooks/use-chat-logic.ts`

---

## Testing Checklist

### Phase 1 Tests

- [ ] Send text message → renders with BiolumText
- [ ] Assistant responds with chart → Chart component renders
- [ ] Tool call in progress → ToolCallCard shows "running" state
- [ ] Tool call complete → ToolCallCard shows output

### Phase 2 Tests

- [ ] Tap orb → waveform appears and animates with voice
- [ ] Speak → VAD ring expands
- [ ] Speak → transcript appears in real-time
- [ ] Stop speaking → transcript finalizes

### Phase 5 Tests

- [ ] Open Library → shows section counts from API
- [ ] Tap Notes → shows list of notes
- [ ] Tap note → opens detail view
- [ ] Create/edit/delete → changes persist

### Phase 6 Tests

- [ ] API error → toast appears with error message
- [ ] Save action → success toast appears
- [ ] Swipe toast → dismisses

---

## Implementation Order

1. **Week 1 (Critical Path)**
   - Phase 1: Message rendering (enables core chat UX)
   - Phase 2: Voice integration (enables Drive mode)
   - Phase 10: Error boundaries (prevents crashes)

2. **Week 2 (High Priority)**
   - Phase 3: Chat input
   - Phase 4: GenUI data binding
   - Phase 6: Toast system

3. **Week 3 (Medium Priority)**
   - Phase 5: Library screens
   - Phase 7: Bottom sheet
   - Phase 9: State persistence

4. **Week 4 (Polish)**
   - Phase 8: Navigation
   - Phase 11: Accessibility
   - Phase 12: Testing

---

_Spec created: 2026-01-23_
_Associated ExecPlan: native-component-integration.md_
