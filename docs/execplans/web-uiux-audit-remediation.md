# ALFRED Web App UI/UX Audit Remediation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows the ExecPlan format defined in `.agent/PLANS.md`.

## Purpose / Big Picture

This ExecPlan implements all 15 UI/UX gaps identified in the ALFRED Web App Audit Report, plus 3 quick-win improvements. After completion, users will experience:

- **Full keyboard accessibility** throughout the desktop shell, workflow canvas, chat, and notification systems
- **Resilient offline behavior** that preserves work and provides clear recovery paths
- **Performance-optimized animations** that respect user motion preferences and reduce battery drain
- **Consistent screen reader support** with status announcements for streaming, errors, and state changes
- **Clear focus management** with proper trapping in modals/drawers and restoration on close

A novice contributor can execute this plan end-to-end by following the concrete steps in each milestone.

## Progress

- [ ] Milestone 0: Audit validation and test strategy lock-in
  - [ ] Reproduce all high-severity gaps in live UI
  - [ ] Verify Radix Dialog focus behavior in workflow-drawer.tsx
  - [ ] Document testing strategy for chat/orb under VITE_TEST_MODE
  - [ ] Create baseline test files for each milestone
- [ ] Milestone 1: Accessibility blockers (High severity)
  - [ ] Gap 1: Workflow canvas keyboard navigation
  - [x] (2026-02-03) Gap 2: Workflow drawer focus trap (verify/fix)
        Evidence: `apps/web/src/components/shared/workflow-drawer.tsx:142` implements focus trap using `useFocusTrap` hook from accessibility utilities.
  - [x] (2026-02-03) Gap 3: Screen reader announcements for streaming
        Evidence: `apps/web/src/hooks/use-assistant-stream.ts:197,275-286` implements announcements for streaming status changes using `useAnnounce` hook.
  - [ ] Gap 8: Keyboard shortcut discovery (Cmd+/ help)
  - [ ] Gap 11: Notification center keyboard navigation
- [ ] Milestone 2: Resilience and data-loss prevention (High severity)
  - [x] (2026-02-04) Gap 4: Offline chat message queue and retry
        Evidence: `apps/web/src/hooks/use-offline-queue.ts`, `apps/web/src/components/chat-container.tsx`, `apps/web/src/components/windows/chat/chat-window.tsx`, `apps/web/src/components/chat/__tests__/offline-queue.test.tsx`.
  - [x] (2026-02-04) Gap 5: Workflow execution progress persistence
        Evidence: `apps/web/src/components/windows/workflow/workflow-window.tsx` resumes active runs and rehydrates status via `trpc.workflow.get`.
  - [ ] Gap 9: Workflow error recovery guidance
  - [ ] Gap 12: Health degradation prominent UI
- [ ] Milestone 3: Performance and motion optimization (Medium severity)
  - [ ] Gap 6: Orb canvas reduced-motion and visibility pause
  - [ ] Gap 7: Chat window virtualization
  - [ ] Gap 13: Window tiling visual feedback enhancement
- [ ] Milestone 4: Polish and interaction affordances (Low/Medium severity)
  - [ ] Gap 10: Onboarding progress save on skip
  - [ ] Gap 14: Escape-to-cancel for message editing
  - [ ] Gap 15: Voice session error recovery
- [x] Milestone 5: Quick wins implementation
  - [ ] Quick win 1: Escape-to-cancel for message editing (Gap 14)
  - [x] (2026-02-03) Quick win 2: Focus trap for workflow drawer (Gap 2)
        Evidence: `apps/web/src/components/shared/workflow-drawer.tsx:142` uses `useFocusTrap(drawerRef, drawerOpen)` hook; focus trapping is active when drawer is open.
  - [x] (2026-02-03) Quick win 3: Screen reader announcements (Gap 3)
        Evidence: `apps/web/src/hooks/use-assistant-stream.ts:197` imports `useAnnounce`; lines 275-286 announce "Assistant is thinking", errors, and "Response complete" status changes.
- [ ] Final validation and documentation
  - [ ] Run full test suite: `bun --cwd apps/web test`
  - [ ] Run E2E tests: `bun --cwd apps/web test:e2e:auto`
  - [ ] Update ExecPlan with final outcomes

## Surprises & Discoveries

Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation.

- (2026-02-03) Discovery: Focus trap for workflow drawer was already implemented using the existing `useFocusTrap` hook from `@/components/desktop/accessibility/hooks`. Radix Dialog provides some focus management, but the explicit trap ensures focus stays within the drawer.
  Evidence: `apps/web/src/components/shared/workflow-drawer.tsx:142` shows `useFocusTrap(drawerRef, drawerOpen)` call.

- (2026-02-03) Discovery: Screen reader announcements for streaming were already implemented in the `use-assistant-stream` hook. The hook uses `useAnnounce` to announce status transitions ("Assistant is thinking", errors, "Response complete").
  Evidence: `apps/web/src/hooks/use-assistant-stream.ts:197,275-286` shows announcement implementation with `announcePolite` and `announceAssertive` calls.

## Decision Log

Record every decision made while working on the plan.

- Decision: Testing strategy for chat/orb features under VITE_TEST_MODE
  Rationale: VITE_TEST_MODE disables ChatWindow and OrbLayer. We will use React Testing Library (RTL) for unit tests of these components in isolation, and use Playwright for integration tests that validate the surrounding UI (drawers, shell, notifications). For orb performance tests, we will create a dedicated test environment that bypasses VITE_TEST_MODE.
  Date/Author: (To be filled during Milestone 0)

- Decision: Focus trap implementation approach
  Rationale: The workflow drawer uses Radix Dialog which has built-in focus trapping. We will first verify if it is working correctly. If not, we will apply the existing `useFocusTrap` hook from `apps/web/src/components/desktop/accessibility/hooks.ts` rather than introducing a new dependency.
  Date/Author: (To be filled during Milestone 1)

- Decision: Offline message queue storage mechanism
  Rationale: To avoid storage budget issues (50KB limit for desktop state), we will use localStorage for the offline queue with a max size of 10 messages. Messages will be queued with timestamp and retry count, and auto-retry when connectivity returns.
  Date/Author: 2026-02-04 (assistant)

- Decision: Workflow execution persistence strategy
  Rationale: Rather than persisting steps/events to window state (which could exceed storage budget), we will rehydrate by re-subscribing to workflow events when reopening a window with an active runId. The window will store only the runId and current status, not the full event stream.
  Date/Author: 2026-02-04 (assistant)

- Decision: Orb animation pause mechanism
  Rationale: We will use IntersectionObserver to detect when the orb is not visible (scrolled out, tab switched, or overlay hidden) and pause the useFrame loop. We will also respect prefers-reduced-motion by disabling the shader animation entirely when the preference is set.
  Date/Author: (To be filled during Milestone 3)

## Outcomes & Retrospective

(To be completed after all milestones)

## Context and Orientation

### Repository Structure

This ExecPlan targets the ALFRED web application located at `apps/web/`. The web app is a TanStack Start application with React 19, Tailwind v4, and Framer Motion.

### Key Files and Components

**Desktop Shell and Layout:**

- `apps/web/src/components/desktop/shell.tsx` - Main desktop container with layers (orb, windows, mindscape, HUD)
- `apps/web/src/components/desktop/layers/window-layer.tsx` - Renders tiled/floating windows
- `apps/web/src/components/desktop/command-palette.tsx` - Cmd+K command palette
- `apps/web/src/components/desktop/notifications/overlay.tsx` - Notification center overlay

**Accessibility Utilities (EXISTING - use these):**

- `apps/web/src/components/desktop/accessibility/hooks.ts` - Contains `useFocusTrap`, `useAnnounce`, `useReducedMotion`, `useKeyboardNavigation`
- `apps/web/src/lib/accessibility/focus.ts` - Focus trap implementation

**Workflow UX:**

- `apps/web/src/components/shared/workflow-drawer.tsx` - Side drawer for workflow details (uses Radix Dialog)
- `apps/web/src/components/windows/workflow/workflow-canvas.tsx` - ReactFlow canvas for plan visualization
- `apps/web/src/components/windows/workflow/workflow-window.tsx` - Full workflow window

**Chat UX:**

- `apps/web/src/components/chat-container.tsx` - Full-page chat with Virtuoso virtualization
- `apps/web/src/components/windows/chat/chat-window.tsx` - Desktop window chat (NO virtualization currently)
- `apps/web/src/hooks/use-assistant-stream.ts` - Streaming status hook
- `apps/web/src/hooks/use-chat-logic.ts` - Chat logic hook
- `apps/web/src/hooks/use-message-edit.ts` - Message editing hook

**Orb and Visuals:**

- `apps/web/src/components/ui/orb.tsx` - Three.js orb component with continuous animation

**Testing:**

- `apps/web/playwright.config.ts` - E2E test configuration (uses VITE_TEST_MODE=true by default)
- `apps/web/src/tests/` - Test directory

### Design System: Signal in the Void

ALFRED uses a dark "void" aesthetic with bioluminescent accents:

- Background: `--color-void` (oklch(0.05 0 0))
- Text: `--color-biolum` (white), `--color-biolum-dim` (70% white), `--color-biolum-faint` (40% white)
- HUD Pattern: `bg-void-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl`
- No drop shadows - use outer glows or borders only
- Reduced motion must be respected for all animations

### VITE_TEST_MODE Constraint

When `VITE_TEST_MODE=true` (default for Playwright):

- `ChatWindow` renders "Chat disabled in test environment" instead of actual chat
- `OrbLayer` is not rendered at all
- This means chat and orb features cannot be E2E tested in the default test mode
- Strategy: Use RTL for unit tests of these components; use Playwright for surrounding UI

## Plan of Work

### Milestone 0: Audit Validation and Test Strategy Lock-in

Before implementing fixes, validate each gap exists as described and lock in the testing approach.

**Step 1: Reproduce high-severity gaps**

Start the dev server and manually verify each high-severity gap:

```bash
cd /Users/jackmazac/Development/alfred
bun run dev
```

Navigate to `http://localhost:3000` and:

1. **Gap 1 (Workflow canvas keyboard trap):** Open a workflow window, generate a plan, try to navigate nodes with Tab/arrow keys. Document what happens.

2. **Gap 2 (Drawer focus trap):** Open a workflow run drawer, press Tab repeatedly. Check if focus escapes to background. Also verify if Radix Dialog is already trapping focus correctly.

3. **Gap 3 (No SR announcements):** Enable VoiceOver (macOS) or NVDA (Windows), send a chat message, observe if streaming status is announced.

4. **Gap 4 (Offline chat):** Disconnect network, try to send a chat message, observe error behavior.

5. **Gap 5 (Workflow persistence):** Start a workflow, close the window, reopen it, check if progress is preserved.

**Step 2: Document findings**

Update this ExecPlan's "Surprises & Discoveries" section with:

- Which gaps are confirmed
- Any gaps that are already fixed (false positives)
- Any unexpected behaviors

**Step 3: Create baseline test files**

Create empty test files for each milestone:

```bash
touch apps/web/src/components/desktop/accessibility/__tests__/workflow-drawer-a11y.test.tsx
touch apps/web/src/components/windows/workflow/__tests__/workflow-canvas-a11y.test.tsx
touch apps/web/src/components/chat/__tests__/offline-queue.test.tsx
touch apps/web/src/components/ui/__tests__/orb-performance.test.tsx
touch apps/web/src/components/windows/chat/__tests__/chat-window-virtualization.test.tsx
```

### Milestone 1: Accessibility Blockers

**Gap 1: Workflow Canvas Keyboard Navigation**

The workflow canvas uses ReactFlow which is mouse-centric. Add keyboard-accessible alternatives.

Edit `apps/web/src/components/windows/workflow/workflow-canvas.tsx`:

1. Add a "Phases List" toggle button in the top-right panel (next to "Add Phase")
2. When toggled, show a list view of all phases with:
   - Arrow key navigation (roving tabindex pattern)
   - Enter to select/highlight a phase
   - Space to approve/reject (if in approval mode)
   - Escape to close list view
3. Ensure the list view is announced to screen readers

**Gap 2: Workflow Drawer Focus Trap**

The drawer uses Radix Dialog which should trap focus automatically. Verify and enhance if needed.

Edit `apps/web/src/components/shared/workflow-drawer.tsx`:

1. Check if Radix Dialog is already trapping focus (it should be)
2. If focus escapes, wrap the drawer content with `useFocusTrap`:

```tsx
import { useFocusTrap } from "@/components/desktop/accessibility/hooks";

// Inside WorkflowDrawerBody:
const drawerRef = useRef<HTMLDivElement>(null);
useFocusTrap(drawerRef, drawerOpen);
```

3. Ensure focus returns to the trigger element when drawer closes

**Gap 3: Screen Reader Announcements for Streaming**

Add announcements for chat streaming status changes.

Edit `apps/web/src/hooks/use-assistant-stream.ts`:

1. Import `useAnnounce` from accessibility hooks
2. Add announcements for status transitions:
   - "streaming" → "Assistant is thinking"
   - "error" → "Error: [message]"
   - "ready" (from streaming) → "Response complete"

Edit `apps/web/src/components/chat-container.tsx`:

1. Pass announcement messages to the Chat component
2. Ensure status changes trigger announcements

**Gap 8: Keyboard Shortcut Discovery**

Add a keyboard shortcut help modal.

Edit `apps/web/src/components/desktop/command-palette.tsx`:

1. Add a new keyboard shortcut listener for `Cmd+/` (or `Ctrl+/`)
2. Create a help modal that lists all available shortcuts:
   - Cmd+K: Command palette
   - Cmd+/: Shortcut help
   - Escape: Close modal/drawer
   - Arrow keys: Navigate lists
3. Add a menu item in the command palette to open the help modal

**Gap 11: Notification Center Keyboard Navigation**

Add keyboard navigation to the notification overlay.

Edit `apps/web/src/components/desktop/notifications/overlay.tsx`:

1. Import `useFocusTrap` and apply it to the notification panel
2. Add arrow key navigation between notifications
3. Add Enter to activate notification actions
4. Add Delete or D to dismiss a notification
5. Ensure Escape closes the notification center

### Milestone 2: Resilience and Data-Loss Prevention

**Gap 4: Offline Chat Message Queue**

Implement offline message queuing with retry.

Create new file `apps/web/src/hooks/use-offline-queue.ts`:

```typescript
// Hook for queueing messages when offline
// Stores up to 10 messages in localStorage
// Auto-retries when connectivity returns
// Returns: { queueMessage, pendingMessages, retryAll, clearQueue }
```

Edit `apps/web/src/components/chat-container.tsx`:

1. Import and use `useOfflineQueue`
2. When sending a message while offline:
   - Queue the message instead of sending
   - Show "Message queued - will send when online"
3. When connectivity returns:
   - Auto-retry queued messages
   - Show toast: "Sent N queued messages"
4. Add a "Retry" button for failed messages

Edit `apps/web/src/components/windows/chat/chat-window.tsx`:

1. Apply the same offline queue logic
2. Show pending state in the UI

**Gap 5: Workflow Execution Progress Persistence**

Ensure workflow progress is not lost when closing/reopening windows.

Edit `apps/web/src/components/windows/workflow/workflow-window.tsx`:

1. Store `runId` and `runStatus` in window data (already happens via props)
2. On window mount, if there's a `runId` with active status:
   - Re-subscribe to workflow events
   - Fetch current run state from API
   - Restore the execution panel view
3. Do NOT store full event stream in window state (storage budget)

**Gap 9: Workflow Error Recovery Guidance**

Add actionable recovery options for workflow errors.

Edit `apps/web/src/components/workflow-detail-modal.tsx` (or create WorkflowErrorPanel):

1. In the Error tab, add contextual actions based on error type:
   - "Retry with same input" - resubmits the workflow
   - "Edit requirement and retry" - opens edit mode
   - "View logs" - opens logs panel
   - "Report issue" - opens feedback dialog
2. Use clear button labels and icons
3. Add help text explaining what went wrong in plain language

**Gap 12: Health Degradation Prominent UI**

Make critical health failures more visible.

Edit `apps/web/src/routes/_protected.tsx`:

1. When health status transitions to "critical":
   - Show a prominent banner at the top of the screen
   - Use red-tinted HUD styling (consistent with offline mode)
   - Explain which services are affected
   - Provide actions: "Retry connection", "Check settings"

Edit `apps/web/src/components/hud/jarvis-hud.tsx`:

1. Enhance the status indicator to pulse when critical
2. Add tooltip with detailed status on hover

### Milestone 3: Performance and Motion Optimization

**Gap 6: Orb Canvas Performance**

Pause expensive animation when not visible or when reduced motion is preferred.

Edit `apps/web/src/components/ui/orb.tsx`:

1. Add `useReducedMotion` check:
   - If reduced motion is preferred, render a static version or disable shader updates
2. Add IntersectionObserver:
   - When orb is not visible (scrolled out, tab hidden), pause the `useFrame` loop
   - Resume when visible again
3. Add tab visibility check:
   - When `document.hidden` is true, reduce frame rate or pause

```tsx
import { useReducedMotion } from "@/components/desktop/accessibility/hooks";

// In Scene component:
const reducedMotion = useReducedMotion();
const [isVisible, setIsVisible] = useState(true);

useEffect(() => {
  if (reducedMotion) return; // Skip animation setup

  const observer = new IntersectionObserver(
    ([entry]) => setIsVisible(entry.isIntersecting),
    { threshold: 0 }
  );
  // ... observe the canvas container
}, [reducedMotion]);

useFrame((state, delta) => {
  if (reducedMotion || !isVisible || document.hidden) return;
  // ... existing animation code
});
```

**Gap 7: Chat Window Virtualization**

Add virtualization to the desktop chat window.

Edit `apps/web/src/components/windows/chat/chat-window.tsx`:

1. Import `Virtuoso` from `react-virtuoso`
2. Replace the `.map()` rendering with Virtuoso:

```tsx
import { Virtuoso } from "react-virtuoso";

// Replace:
// {messages.map((message) => (...))}

// With:
<Virtuoso
  data={messages}
  itemContent={(index, message) => (
    // ... existing message rendering
  )}
  followOutput="auto"
/>
```

3. Ensure edit mode works with virtualization (may need to temporarily disable virtualization when editing)

**Gap 13: Window Tiling Visual Feedback**

Enhance the snap zone preview during window drag.

Edit `apps/web/src/components/desktop/tiling/zone-preview.tsx` (or create if doesn't exist):

1. Increase the opacity and border width of the preview zone
2. Add a ghost window preview showing the final size/position
3. Add haptic feedback (if supported) or visual pulse when entering a snap zone
4. Use spring animations for the preview appearance

### Milestone 4: Polish and Interaction Affordances

**Gap 10: Onboarding Progress Save on Skip**

Save onboarding progress when user clicks "Skip for now".

Edit `apps/web/src/routes/onboarding.tsx`:

1. When "Skip" is clicked, save current step and preferences to localStorage
2. On onboarding mount, check for saved progress and offer to resume
3. Add "Resume from where you left off" option

**Gap 14: Escape-to-Cancel for Message Editing**

Allow Escape key to cancel message editing.

Edit `apps/web/src/components/chat-container.tsx`:

1. In the edit mode textarea, add `onKeyDown` handler:

```tsx
<Textarea
  onKeyDown={(e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  }}
  // ... other props
/>
```

Edit `apps/web/src/components/windows/chat/chat-window.tsx`:

1. Apply the same Escape-to-cancel logic

**Gap 15: Voice Session Error Recovery**

Add clear recovery options for voice errors.

Edit `apps/web/src/hooks/use-voice-session-web.ts`:

1. Define structured error types with recovery actions
2. Return error type and recovery options from the hook
3. In UI components, display error with action buttons:
   - "Retry connection"
   - "Switch to text mode"
   - "Cancel"

### Milestone 5: Quick Wins Implementation

The three quick wins are subsets of the above milestones. Implement them first for immediate UX improvement:

**Quick Win 1: Escape-to-Cancel (Gap 14)**

- Files: `apps/web/src/components/chat-container.tsx`, `apps/web/src/components/windows/chat/chat-window.tsx`
- Change: Add `onKeyDown` handler for Escape key
- Effort: ~5 lines per file

**Quick Win 2: Focus Trap for Workflow Drawer (Gap 2)**

- Files: `apps/web/src/components/shared/workflow-drawer.tsx`
- Change: Import and use `useFocusTrap` hook
- Effort: ~10 lines

**Quick Win 3: Screen Reader Announcements (Gap 3)**

- Files: `apps/web/src/hooks/use-assistant-stream.ts`
- Change: Import `useAnnounce` and call on status transitions
- Effort: ~15 lines

## Concrete Steps

### Development Environment Setup

```bash
# Ensure you're in the repo root
cd /Users/jackmazac/Development/alfred

# Install dependencies if needed
bun install

# Start the dev server
bun run dev
```

### Running Tests

**Unit tests (RTL):**

```bash
bun --cwd apps/web test
```

**E2E tests (Playwright):**

```bash
bun --cwd apps/web test:e2e:auto
```

**Type checking:**

```bash
bun --cwd apps/web typecheck
```

### Implementation Order

1. Start with Quick Wins (Milestone 5) for immediate value
2. Then Milestone 1 (Accessibility blockers) - highest impact
3. Then Milestone 2 (Resilience) - prevents data loss
4. Then Milestone 3 (Performance) - improves perceived speed
5. Finally Milestone 4 (Polish) - consistency and delight

## Validation and Acceptance

### Acceptance Criteria by Gap

**Gap 1: Workflow Canvas Keyboard Navigation**

- Manual test: Open workflow canvas, press Tab to reach "Show List View" button, press Enter, use arrow keys to navigate phases, press Enter to select
- Screen reader announces phase names when navigating list

**Gap 2: Workflow Drawer Focus Trap**

- Manual test: Open drawer, press Tab repeatedly - focus should cycle within drawer
- Close drawer with Escape - focus should return to trigger button

**Gap 3: Screen Reader Announcements**

- Manual test with VoiceOver/NVDA: Send chat message, hear "Assistant is thinking", then "Response complete"
- Error announcement: "Error: [message]"

**Gap 4: Offline Chat Queue**

- Manual test: Disconnect network, send message, see "Message queued" toast
- Reconnect, see "Sent N queued messages" toast
- Unit test: `apps/web/src/components/chat/__tests__/offline-queue.test.tsx` passes

**Gap 5: Workflow Persistence**

- Manual test: Start workflow, close window, reopen - execution panel shows current state
- No data loss after page refresh

**Gap 6: Orb Performance**

- DevTools Performance tab: CPU usage drops when orb is not visible
- Reduced motion: Animation is disabled when OS preference is set

**Gap 7: Chat Virtualization**

- Manual test: Load 100+ messages, scroll smoothly
- DevTools: DOM node count is constant regardless of message count

**Gap 8: Shortcut Discovery**

- Press Cmd+/, see shortcut help modal
- All shortcuts listed with descriptions

**Gap 9: Workflow Error Recovery**

- Trigger workflow error, see actionable buttons in Error tab
- "Retry" button resubmits workflow

**Gap 10: Onboarding Progress Save**

- Complete 2 onboarding steps, click Skip
- Return to onboarding, see "Resume" option

**Gap 11: Notification Keyboard Nav**

- Open notification center, use arrow keys to navigate
- Press Enter to activate, Delete to dismiss

**Gap 12: Health Degradation UI**

- Stop API server, see prominent red banner
- Banner explains which services are down

**Gap 13: Tiling Feedback**

- Drag window to edge, see prominent snap zone preview
- Ghost window shows final position

**Gap 14: Escape-to-Cancel**

- Edit a message, press Escape, edit mode closes
- Works in both ChatContainer and ChatWindow

**Gap 15: Voice Error Recovery**

- Trigger voice error, see recovery options
- "Retry" and "Switch to text" buttons work

### Test Commands Summary

```bash
# Run all unit tests
bun --cwd apps/web test

# Run tests for specific component
bun --cwd apps/web test workflow-drawer

# Run E2E tests
bun --cwd apps/web test:e2e:auto

# Run E2E with visible browser (for debugging)
PLAYWRIGHT_HEADLESS=0 bun --cwd apps/web test:e2e:auto

# Type check
bun --cwd apps/web typecheck

# Lint
bun --cwd apps/web lint
```

## Idempotence and Recovery

### Safe to Re-run

All steps in this plan are additive and safe to re-run:

- Adding keyboard handlers is idempotent
- Adding hooks doesn't break existing functionality
- New test files don't affect production code

### Rollback Strategy

If a change causes issues:

1. **Focus trap issues:** Remove the `useFocusTrap` hook call, keep the drawer functional without trapping
2. **Offline queue issues:** Disable the queue by returning early from `useOfflineQueue` if `navigator.onLine` is true
3. **Orb performance issues:** Revert to original animation loop, keep reduced motion check

### Git Workflow

Commit after each gap is implemented:

```bash
git add -A
git commit -m "feat(web): implement Gap X - [brief description]"
```

This allows easy bisection if issues arise.

## Artifacts and Notes

### Expected File Changes

**New files to create:**

- `apps/web/src/hooks/use-offline-queue.ts`
- `apps/web/src/components/desktop/accessibility/__tests__/workflow-drawer-a11y.test.tsx`
- `apps/web/src/components/windows/workflow/__tests__/workflow-canvas-a11y.test.tsx`
- `apps/web/src/components/chat/__tests__/offline-queue.test.tsx`
- `apps/web/src/components/ui/__tests__/orb-performance.test.tsx`
- `apps/web/src/components/windows/chat/__tests__/chat-window-virtualization.test.tsx`

**Files to modify:**

- `apps/web/src/components/windows/workflow/workflow-canvas.tsx` (Gap 1)
- `apps/web/src/components/shared/workflow-drawer.tsx` (Gap 2)
- `apps/web/src/hooks/use-assistant-stream.ts` (Gap 3)
- `apps/web/src/components/chat-container.tsx` (Gaps 3, 4, 14)
- `apps/web/src/components/windows/chat/chat-window.tsx` (Gaps 4, 7, 14)
- `apps/web/src/components/desktop/command-palette.tsx` (Gap 8)
- `apps/web/src/components/desktop/notifications/overlay.tsx` (Gap 11)
- `apps/web/src/components/windows/workflow/workflow-window.tsx` (Gap 5)
- `apps/web/src/components/workflow-detail-modal.tsx` (Gap 9)
- `apps/web/src/routes/_protected.tsx` (Gap 12)
- `apps/web/src/components/hud/jarvis-hud.tsx` (Gap 12)
- `apps/web/src/components/ui/orb.tsx` (Gap 6)
- `apps/web/src/components/desktop/tiling/zone-preview.tsx` (Gap 13)
- `apps/web/src/routes/onboarding.tsx` (Gap 10)
- `apps/web/src/hooks/use-voice-session-web.ts` (Gap 15)

### Performance Budgets

- Desktop state persistence: Must stay under 50KB
- Offline queue: Max 10 messages, ~1KB total
- Orb animation: Pause when not visible to save GPU
- Chat virtualization: Render only visible messages + buffer

## Interfaces and Dependencies

### Required Hooks (already exist)

From `apps/web/src/components/desktop/accessibility/hooks.ts`:

- `useFocusTrap(containerRef, isActive, options?)` - Focus trap for modals/drawers
- `useAnnounce()` - Returns `{ announce, announcePolite, announceAssertive }`
- `useReducedMotion()` - Returns boolean for motion preference
- `useKeyboardNavigation()` - Returns boolean for keyboard vs mouse detection

### Required Libraries (already installed)

- `react-virtuoso` - Virtualization for chat lists
- `framer-motion` / `motion` - Animations
- `@react-three/fiber` - Orb rendering
- `@radix-ui/react-dialog` - Drawer/dialog base (has built-in focus trap)

### Type Definitions

No new types needed - use existing:

- `UIMessage` from `@alfred/type/stream`
- `WindowType` from `@/store/desktop/types.new`
- `DesktopAction` from `@/config/desktop-actions`

### External Dependencies

None - all changes are within `apps/web` using existing dependencies.
