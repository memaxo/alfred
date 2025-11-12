# UI Integration Patterns

## Core Principle

Leverage AI SDK v6 native patterns for structured content rendering. Use pure functions for part rendering, unified layouts for panes, and consistent patterns for settings and voice integration.

## Rules

1. **AI SDK v6 Part Rendering.** Always render structured message parts using the `renderPart` pattern. Create pure functions that switch on `part.type` and extract data from `data-${name}` parts or `tool-result` parts. Reference: `apps/web/src/components/chat-render.tsx`.

2. **Part Type Guards.** Extend `packages/ui/src/chat/parts.ts` with `isDataPartNamed(part, name)` to check for specific data parts. Use `extractStructuredData(part)` to extract data from both data parts and tool-result parts uniformly.

3. **Chat Component Integration.** Pass `renderPart` prop to `Chat` component from `@alfred/ui`. The renderer should return `ReactNode | null` for each part. Unknown structures fall back to JSON display or are filtered out.

4. **Pane Layout Pattern.** Use `PaneLayout` component for consistent pane UX. Props: `title`, `description`, `createForm`, `paneComponent`. Keep create forms separate from list rendering. Reference: `apps/web/src/components/pane-layout.tsx`.

5. **Pane Component Mapping.** Map router data to pane item types (`NotePaneItem[]`, `RemindPaneItem[]`). Wire `onDelete` handlers to mutations. Keep loading states in route, not pane. Reference: `apps/web/src/routes/note.tsx`, `apps/web/src/routes/remind.tsx`.

6. **Message Parsing Utilities.** Create pure `parseStructuredMessage(message: UIMessage)` functions that extract typed data from parts. Return structured objects with arrays of parsed data types. Reference: `apps/web/src/utils/message-parser.ts`.

7. **Orchestrator Visualization.** Use `eventToUiMessages()` from `@alfred/api/src/ai/normalize` to convert workflow events to UIMessages. Parse and render structured components (Plan, Task, Tool, Code) instead of JSON. Keep JSON fallback for unknown structures.

8. **Settings Components.** Create pure, reusable components for settings (AutonomySlider, PrivacyControls). Wire to preference/privacy routers via callbacks. Keep confirmation flows local to component. Reference: `apps/web/src/components/autonomy-slider.tsx`, `apps/web/src/components/privacy-controls.tsx`.

9. **Voice Integration.** Use `useVoiceCapture` hook from `apps/web/src/hooks/use-voice-capture.ts`. Wire `startRecording`/`stopRecording` to Chat `onVoice` prop. Auto-send transcript to `send()` on completion. Display voice errors separately from chat errors.

10. **Component Composition.** Compose containers from pure components: ChatContainer = Chat + Actions + Controls + Connect. Keep streaming hooks, state management, and error handling in containers. Keep rendering, layout, and display logic in pure components.

## Component Structure

### Chat Rendering Flow
```typescript
// 1. Container wires streaming + renderer
<Chat 
  messages={messages}
  onSend={send}
  renderPart={renderPart}
/>

// 2. Renderer switches on part type
function renderPart(part: UIMessagePart, message: UIMessage): ReactNode | null {
  if (isDataPartNamed(part, "plan")) {
    const data = extractStructuredData(part);
    return <Plan plan={data} />;
  }
  // ... other cases
}

// 3. Chat component renders parts
{structuredParts.length > 0 ? (
  <div className="chat-message__structured">{structuredParts}</div>
) : null}
```

### Pane Layout Pattern
```typescript
// 1. Create pure pane items
const paneItems: NotePaneItem[] = useMemo(
  () => notes.map((note) => ({
    id: note.id,
    title: note.title ?? null,
    content: note.content,
    createdAt: note.createdAt?.toISOString() ?? null,
  })),
  [notes]
);

// 2. Use PaneLayout wrapper
<PaneLayout
  title="Notes"
  description="Add a quick note and keep track of it."
  createForm={<form>...</form>}
  paneComponent={
    isLoading ? <Loading /> : <NotePane items={paneItems} onDelete={handleDelete} />
  }
/>
```

### Settings Component Pattern
```typescript
// 1. Pure component with callbacks
export function AutonomySlider({
  value,
  onChange,
  disabled,
}: AutonomySliderProps) {
  // Pure render with controlled input
}

// 2. Route wires to mutations
const handleAutonomyChange = useCallback((value: AutonomyLevel) => {
  const input: PreferenceSetInput = {
    key: "autonomy",
    value,
    confidence: 1,
  };
  setPreference.mutate(input);
}, [setPreference]);

<AutonomySlider value={currentAutonomy} onChange={handleAutonomyChange} />
```

## File Locations

- **Part renderers**: `apps/web/src/components/chat-render.tsx`
- **Part type guards**: `packages/ui/src/chat/parts.ts`
- **Message parsers**: `apps/web/src/utils/message-parser.ts`
- **Pane layouts**: `apps/web/src/components/pane-layout.tsx`
- **Pane components**: `packages/ui/src/pane/*.tsx`
- **Settings components**: `apps/web/src/components/autonomy-slider.tsx`, `privacy-controls.tsx`
- **Voice hooks**: `apps/web/src/hooks/use-voice-capture.ts`
- **Container integration**: `apps/web/src/components/chat-container.tsx`

## Testing Requirements

- Unit tests for type guard functions
- Unit tests for message parsing utilities
- Component tests for pure components (Plan, Task, Tool, etc.)
- Integration tests for container + hooks
- Visual regression tests for pane layouts
- Accessibility tests for all interactive components

## Performance Guidelines

- Memoize pane item mappings with `useMemo`
- Stabilize callbacks with `useCallback`
- Keep part rendering pure (no side effects)
- Avoid inline object creation in render
- Use virtualization for long message lists
- Batch state updates in voice capture hook

## Accessibility

- All interactive controls have ARIA labels
- Keyboard navigation supported (voice record via button)
- Form validation provides clear error messages
- Loading states announced to screen readers
- Focus management for modals/confirmations

## Examples

### Adding New Data Part Type

```typescript
// 1. Add type guard in packages/ui/src/chat/parts.ts
// (Already generic via isDataPartNamed)

// 2. Add type check in apps/web/src/components/chat-render.tsx
if (isDataPartNamed(part, "diagram")) {
  const data = extractStructuredData(part);
  if (isDiagramData(data)) {
    return <Diagram data={data} />;
  }
}

// 3. Add parser in apps/web/src/utils/message-parser.ts
export type ParsedDiagram = { nodes: Node[]; edges: Edge[] };

function isDiagramData(data: unknown): data is ParsedDiagram {
  // ... type checking
}

// Add to ParsedMessage type and parseStructuredMessage function
```

### Adding New Pane Type

```typescript
// 1. Create pane component in packages/ui/src/pane/timer.tsx
export type TimerPaneItem = { id: string; name: string; duration: number };
export function TimerPane({ items, onDelete }: TimerPaneProps) { /* ... */ }

// 2. Export from packages/ui/src/index.ts
export { TimerPane } from "./pane/timer";

// 3. Create route in apps/web/src/routes/timer.tsx
function TimerRoute() {
  const paneItems: TimerPaneItem[] = /* map router data */;
  return <PaneLayout createForm={form} paneComponent={<TimerPane items={paneItems} />} />;
}
```

### Adding New Settings Component

```typescript
// 1. Create pure component in apps/web/src/components/theme-selector.tsx
export type Theme = "light" | "dark" | "auto";
export function ThemeSelector({ value, onChange }: ThemeSelectorProps) { /* ... */ }

// 2. Wire to preferences route
const currentTheme = (themePreference?.value as Theme) ?? "auto";
const handleThemeChange = (value: Theme) => {
  setPreference.mutate({ key: "theme", value, confidence: 1 });
};
<ThemeSelector value={currentTheme} onChange={handleThemeChange} />
```

## Migration Notes

- Existing JSON display preserved as fallback for unknown structures
- Custom forms kept separate from pane components for flexibility
- Reminder "due now" section remains custom (not in pane) for urgency display
- Voice integration is additive (existing text input unchanged)
- Settings pages maintain backward compatibility with JSON preferences

## Related Rules

- `.ruler/12-component-development.md` - General component development rules
- `.ruler/15-ai-sdk-v6.md` - AI SDK v6 native patterns
- `.ruler/01-naming-conventions.md` - Single-word naming convention
- `.ruler/09-purity-and-performance.md` - Pure functions and performance budgets

