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

11. **Performance.** Memoize pane item mappings with `useMemo`. Stabilize callbacks with `useCallback`. Keep part rendering pure. Use virtualization for long message lists.

12. **Accessibility.** All interactive controls have ARIA labels. Support keyboard navigation. Announce loading states to screen readers. Manage focus for modals/confirmations.

