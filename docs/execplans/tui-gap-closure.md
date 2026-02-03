# TUI Gap Closure ExecPlan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` defines the requirements for ExecPlans in this repository.

## Purpose / Big Picture

After this change, ALFRED's terminal user interface (TUI) will be demonstrably more complete and usable. Users will be able to:

1. **View tool calls and AgentFS state** in the dashboard (currently missing panels)
2. **Execute plans directly from Plan mode** (currently the execute button does nothing)
3. **See tool results in chat** (currently only "Calling X..." appears, not the result)
4. **Have their model preference persist** across TUI sessions (currently resets every time)
5. **Use the TUI against remote servers** by setting an environment variable (currently hardcoded to localhost)
6. **Use the TUI on narrow terminals** without broken layouts (currently hardcoded 2-column)

A novice can verify success by launching the TUI and observing these capabilities work.

## Progress

- [ ] Milestone 1: Wire ToolCalls Panel to Dashboard (P0)
- [ ] Milestone 2: Add AgentFS Panel and Store Integration (P0)
- [ ] Milestone 3: Implement Plan Mode Execute Hook (P0)
- [ ] Milestone 4: Add Model Preference Persistence (P1)
- [ ] Milestone 5: Surface Tool Results in Chat (P1)
- [ ] Milestone 6: Configurable API Base URL (P1)
- [ ] Milestone 7: Responsive Layout for Narrow Terminals (P1)
- [ ] Milestone 8: Add Vim Motion Navigation (gg/G) (P1)
- [ ] Milestone 9: Connect Debug Mode to Real Metrics (P2)
- [ ] Milestone 10: Update Help Mode Content (P2)
- [ ] Milestone 11: Add Workflow Event Streaming (P2)
- [ ] Milestone 12: Extend Test Coverage (P2)
- [ ] Milestone 13: Update Documentation (P3)

## Surprises & Discoveries

_(To be populated as work proceeds)_

## Decision Log

_(To be populated as work proceeds)_

## Outcomes & Retrospective

_(To be populated at completion)_

## Context and Orientation

### How the TUI Works

The ALFRED TUI is a terminal application built with OpenTUI React. Here is how the pieces fit together:

**Entry Point**: When you run `alfred tui` in your terminal, the command is handled by `packages/tui/src/cli/index.ts`. This file routes subcommands like `chat`, `plan`, `debug`, or the default dashboard. It also handles the `--headless` flag for testing.

**TUI Runtime**: The main TUI logic lives in `packages/tui/src/tui/index.ts`. This file creates a `TuiApp` class that:

1. Sets up terminal state (unless headless)
2. Creates data stores for each domain (cognitive, workflow, voice, metrics, focus)
3. Starts subscriptions to fetch live data from the API
4. Launches the React-based UI

**React Dashboard**: The visual interface is built with React components in `packages/tui/src/tui/react/`. The main layout is in `dashboard.tsx`, which renders six panels in a 2-column grid:

- Left column: Focus, Cognitive, Workflow
- Right column: Metrics, Voice, Knowledge

Each panel is a React component that receives data from stores via React context.

**Stores and Subscriptions**: Data flows from the API through subscriptions to stores. Stores are defined in `packages/tui/src/tui/subscriptions/` (e.g., `workflow.ts`, `cognitive.ts`). The React hooks in `packages/tui/src/tui/react/hooks/stores.ts` let panels access this data.

**Modes**: Full-screen modes (Chat, Plan, Debug, Help) overlay the dashboard. They are rendered as React components in `packages/tui/src/tui/react/modes/`.

**Key Files to Know**:

- `packages/tui/src/cli/index.ts` - CLI routing
- `packages/tui/src/tui/index.ts` - TUI runtime and store setup
- `packages/tui/src/tui/react/dashboard.tsx` - Main dashboard layout
- `packages/tui/src/tui/react/panels/` - Panel components
- `packages/tui/src/tui/react/modes/` - Full-screen modes
- `packages/tui/src/tui/subscriptions/` - Data stores and API subscriptions
- `packages/tui/src/tui/api/client.ts` - API client
- `packages/tui/src/tui/api/sse.ts` - Chat streaming

### Current Gaps

1. **ToolCallsPanel exists but is not rendered**: The component is exported from `packages/tui/src/tui/react/panels/index.tsx` but never added to the dashboard layout.

2. **AgentFS subscription exists but no UI**: `packages/tui/src/tui/subscriptions/agentfs.ts` provides tool calls, file entries, and KV store data, but there's no React panel for it and no store hook.

3. **Plan mode execute doesn't work**: The `PlanMode` component accepts an `onExecute` prop, but `dashboard.tsx` doesn't pass one.

4. **Chat model doesn't persist**: The selected model resets to the first one on every session.

5. **Tool results not shown in chat**: Only "Calling X..." appears, not the actual result.

6. **API base URL hardcoded**: Both `client.ts` and `sse.ts` hardcode `http://localhost:3000`.

7. **Layout not responsive**: The dashboard always uses 2 columns regardless of terminal width.

8. **Missing vim motions**: Docs claim `gg`/`G` work but they don't.

## Plan of Work

### Milestone 1: Wire ToolCalls Panel to Dashboard

**Goal**: Users can see the ToolCalls panel in the dashboard and navigate to it.

**What to change**:

1. **Add ToolCalls to panel list**: In `packages/tui/src/tui/react/dashboard.tsx`, add `"toolcalls"` to the `PANELS` array and `PanelId` type.

2. **Add AgentFS to stores**: In `packages/tui/src/tui/react/hooks/stores.ts`, add `agentfs: AgentFSSubscription` to `TuiStores` interface and create `useAgentFSStore()` hook.

3. **Create AgentFS store in TuiApp**: In `packages/tui/src/tui/index.ts`, import `createAgentFSSubscription` from `subscriptions/agentfs`, create it in the constructor, and pass it to `connectStoresToDashboard()`.

4. **Render ToolCallsPanel**: In `packages/tui/src/tui/react/dashboard.tsx`, import `ToolCallsPanel` and render it. Since we now have 7 panels, adjust the layout. Options:
   - Add it as a 7th panel with 1-7 navigation
   - Replace an existing panel (not recommended)
   - Make it a toggleable panel

   Decision: Add as 7th panel, adjust layout to handle odd numbers gracefully.

5. **Connect to data**: Pass the agentfs store to `ToolCallsPanel` via the stores context.

**User-visible proof**: Launch TUI, press `7` or navigate with Tab to see "ToolCalls" panel showing recent tool calls.

**Test updates**: Add to `packages/tui/test/tui-e2e.test.ts` an assertion that "ToolCalls" appears in dashboard output.

---

### Milestone 2: Add AgentFS Panel and Store Integration

**Goal**: Users can browse AgentFS workspace and KV store from the TUI.

**What to change**:

1. **Create AgentFS panel**: New file `packages/tui/src/tui/react/panels/agentfs.tsx` with:
   - Directory browser showing entries from AgentFS subscription
   - KV store viewer
   - Keyboard navigation (up/down to browse, Enter to expand/collapse)

2. **Export from panels index**: Add export to `packages/tui/src/tui/react/panels/index.tsx`.

3. **Add to dashboard**: Include in `PANELS` array. Consider making this an 8th panel or integrating with ToolCalls.

4. **Wire subscription**: In `packages/tui/src/tui/index.ts`, set up the AgentFS subscription to connect to the current workflow's runId when available.

**User-visible proof**: Run a workflow, open AgentFS panel, see workspace files and KV entries updating in real-time.

**Test updates**: Add test for AgentFS panel rendering.

---

### Milestone 3: Implement Plan Mode Execute Hook

**Goal**: Pressing `e` or `x` in Plan mode actually executes the plan.

**What to change**:

1. **Add execute handler in dashboard**: In `packages/tui/src/tui/react/dashboard.tsx`, create an `onExecute` callback that:
   - Calls the workflow execute tRPC endpoint
   - Shows a confirmation or status message
   - Returns to dashboard or stays in plan mode based on result

2. **Pass to PlanMode**: Add `onExecute={handleExecute}` prop to `<PlanMode />` component.

3. **Handle execution in PlanMode**: Ensure `packages/tui/src/tui/react/modes/plan.tsx` properly calls `onExecute` with the runId.

**User-visible proof**: Load a plan in Plan mode (Ctrl+P), press `e`, see execution start, workflow appears in Workflow panel.

**Test updates**: Add test simulating `e` key in plan mode and verifying execute API is called.

---

### Milestone 4: Add Model Preference Persistence

**Goal**: Selected chat model persists across TUI sessions.

**What to change**:

1. **Extend history module**: In `packages/tui/src/tui/api/history.ts`, add:
   - `ChatPreferences` interface with `selectedModelId: string`
   - `saveChatPreferences(prefs: ChatPreferences)` function
   - `loadChatPreferences(): Promise<ChatPreferences>` function
   - Store in `~/.alfred/tui/chat_prefs.json`

2. **Load preference in chat mode**: In `packages/tui/src/tui/react/modes/chat.tsx`, in the `useEffect` that loads history, also load preferences and set `selectedModel` if valid.

3. **Save on change**: In `chat.tsx`, when model is selected via ModelPicker, save preference.

**User-visible proof**: Open chat, select MLX model, exit chat, reopen chat—same model is selected.

**Test updates**: Add test verifying preference file is created and loaded.

---

### Milestone 5: Surface Tool Results in Chat

**Goal**: Tool execution results appear in the chat conversation.

**What to change**:

1. **Handle tool-result in chat**: In `packages/tui/src/tui/react/modes/chat.tsx`, in the `sendMessage` function's stream handling, add a case for `tool-call-result` that appends a formatted message showing the result.

2. **Format results nicely**: Show tool name, success/failure status, and truncated result content.

**User-visible proof**: Ask ALFRED to "list files", see "Calling list_files..." then see the actual file list in the chat.

**Test updates**: Mock tool result in test and verify it appears in output.

---

### Milestone 6: Configurable API Base URL

**Goal**: Users can point TUI at non-local ALFRED servers.

**What to change**:

1. **Read env var in ApiClient**: In `packages/tui/src/tui/api/client.ts`, change constructor to read `process.env.ALFRED_API_BASE_URL` or default to `http://localhost:3000`.

2. **Read env var in SSE**: In `packages/tui/src/tui/api/sse.ts`, use same env var in `streamAssistant` function.

3. **Document the variable**: Add to help text and documentation.

**User-visible proof**: Run `ALFRED_API_BASE_URL=https://alfred.example.com alfred tui`, see it connect to remote server.

**Test updates**: Add test with custom base URL env var.

---

### Milestone 7: Responsive Layout for Narrow Terminals

**Goal**: TUI is usable on terminals narrower than 80 columns.

**What to change**:

1. **Detect terminal width**: In `packages/tui/src/tui/react/dashboard.tsx`, use `useTerminalDimensions()` to get width.

2. **Implement layout modes**:
   - Width < 80: Single panel, full screen (Focus mode)
   - Width 80-120: Two panels side by side (Split mode)
   - Width > 120: Multi-panel grid (Dashboard mode)

3. **Add layout toggle**: Add keybinding (e.g., `f` or `Space`) to toggle between layout modes manually.

4. **Adjust panel rendering**: Each panel should adapt its content based on available width.

**User-visible proof**: Resize terminal to 60 columns, see single panel view with clean layout.

**Test updates**: Add tests verifying layout changes at width thresholds.

---

### Milestone 8: Add Vim Motion Navigation

**Goal**: Power users can use `gg` and `G` for navigation in scrollable panels.

**What to change**:

1. **Add to scrollbox or panels**: Implement in individual panels or create a shared hook.

2. **Handle key sequences**: `gg` means go to top, `G` means go to bottom. This requires tracking key sequence state.

3. **Apply to all scrollable panels**: Focus, Knowledge, Workflow, ToolCalls, AgentFS panels.

**User-visible proof**: In Knowledge panel with many entities, press `G` to jump to bottom, `gg` to jump to top.

**Test updates**: Add tests for vim motion keys.

---

### Milestone 9: Connect Debug Mode to Real Metrics

**Goal**: Debug mode shows actual metrics instead of random data.

**What to change**:

1. **Use metrics store**: In `packages/tui/src/tui/react/modes/debug.tsx`, import `useMetricsStore` and use real data.

2. **Remove mock generation**: Delete the `Math.random()` calls.

**User-visible proof**: Open debug mode, see actual request rates and latencies from the metrics subscription.

---

### Milestone 10: Update Help Mode Content

**Goal**: Help mode shows all available keyboard shortcuts accurately.

**What to change**:

1. **Audit all shortcuts**: Review every panel and mode for their keybindings.

2. **Update help content**: In `packages/tui/src/tui/react/modes/help.tsx`, create comprehensive help text.

3. **Dynamic help**: Consider making help context-aware (show different help based on current mode).

**User-visible proof**: Press `?` in any mode, see accurate list of all available keys.

---

### Milestone 11: Add Workflow Event Streaming

**Goal**: Workflow detail view updates in real-time as events occur.

**What to change**:

1. **Subscribe to events**: In `packages/tui/src/tui/react/panels/workflow.tsx`, when in detail view, subscribe to workflow events stream.

2. **Update state**: Append new events to the displayed list as they arrive.

3. **Handle cleanup**: Unsubscribe when leaving detail view.

**User-visible proof**: Open workflow detail, trigger new activity, see events appear without refreshing.

---

### Milestone 12: Extend Test Coverage

**Goal**: All new functionality has test coverage.

**What to change**:

1. **Update E2E tests**: Extend `packages/tui/test/tui-e2e.test.ts` with:
   - ToolCalls panel presence
   - Plan execute wiring
   - Base URL env var
   - Model persistence
   - Layout responsiveness

2. **Add unit tests**: Create tests for:
   - AgentFS panel rendering
   - Chat tool result display
   - Vim motion handling

**User-visible proof**: Run `bun -C packages/tui test`, all tests pass.

---

### Milestone 13: Update Documentation

**Goal**: Documentation matches implementation.

**What to change**:

1. **Update tui-architecture.md**: In `docs/architecture/tui-architecture.md`:
   - Update panel list to include ToolCalls and AgentFS
   - Update layout section to describe responsive behavior
   - Update keybindings to match actual implementation
   - Update environment variables section

2. **Add new env vars**: Document `ALFRED_API_BASE_URL`.

3. **Update migration status**: React renderer is now the only path (no feature flag needed).

**User-visible proof**: Documentation accurately describes what users can do in the TUI.

## Concrete Steps

### Prerequisites

Ensure you have the repository checked out and dependencies installed:

    cd /path/to/alfred
    bun install

### Running Tests

The TUI test command is:

    bun -C packages/tui test

Or from repo root:

    bun test packages/tui

### Headless Testing

To test without a TTY:

    ALFRED_TUI_HEADLESS=true ALFRED_TUI_HEADLESS_MS=1000 bun packages/tui/src/bin/alfred.ts tui

### Development Workflow

For each milestone:

1. Make the code changes
2. Run typecheck: `bun -C packages/tui run typecheck`
3. Run tests: `bun -C packages/tui test`
4. Manual verification: Launch TUI and verify behavior
5. Update this ExecPlan's Progress section
6. Commit with clear message referencing milestone

## Validation and Acceptance

### Acceptance Criteria

A novice can verify success by:

1. **ToolCalls Panel**: Launch `alfred tui`, press `7`, see ToolCalls panel with tool call history

2. **Plan Execute**: Run `alfred tui plan`, load a plan, press `e`, see workflow start

3. **Model Persistence**: In chat mode, select MLX model, exit, re-enter, model still selected

4. **Tool Results**: In chat, ask for file listing, see actual file list in conversation

5. **Remote Server**: Run `ALFRED_API_BASE_URL=https://remote.com alfred tui`, see connection to remote

6. **Narrow Terminal**: Resize to 60 columns, see clean single-panel layout

7. **Vim Motions**: In scrollable panel, press `G` then `gg`, see navigation work

8. **Tests Pass**: Run `bun -C packages/tui test`, see all tests pass

### Test Commands

    # Run all TUI tests
    bun -C packages/tui test

    # Run with coverage
    bun -C packages/tui test --coverage

    # Run specific test file
    bun -C packages/tui test test/tui-e2e.test.ts

### Expected Test Output

All tests should pass with output like:

    TUI E2E
      ✓ Dashboard launches and displays core sections
      ✓ Debug mode launches and shows hints
      ✓ Chat mode launches
      ✓ Help opens and returns to dashboard
      ✓ Can switch dashboard -> debug -> dashboard
      ✓ MAX_TRANSITIONS exits with error
      ✓ ToolCalls panel is present
      ✓ Plan mode execute triggers workflow
      ✓ Model preference persists across sessions
      ✓ Base URL env var is respected

## Idempotence and Recovery

### Safe Reruns

All milestones are designed to be additive. Running a milestone twice should:

- Skip already-completed work (idempotent checks)
- Or overwrite with same content (no drift)

### Recovery from Partial Failure

If a milestone fails partway:

1. Check the Progress section to see what was completed
2. Revert any partial changes: `git checkout -- <files>`
3. Re-run the milestone from the beginning

### Validation at Each Step

Each milestone includes its own validation. Do not proceed to next milestone until current one passes:

- Typecheck passes
- Tests pass
- Manual verification succeeds

## Artifacts and Notes

### Files That Will Be Modified

- `packages/tui/src/tui/react/dashboard.tsx` - Add panels, layout, execute handler
- `packages/tui/src/tui/react/hooks/stores.ts` - Add AgentFS store
- `packages/tui/src/tui/index.ts` - Create AgentFS subscription
- `packages/tui/src/tui/react/panels/index.tsx` - Export new panels
- `packages/tui/src/tui/react/panels/agentfs.tsx` - New AgentFS panel
- `packages/tui/src/tui/api/history.ts` - Add preference persistence
- `packages/tui/src/tui/api/client.ts` - Configurable base URL
- `packages/tui/src/tui/api/sse.ts` - Configurable base URL
- `packages/tui/src/tui/react/modes/chat.tsx` - Tool results, model persistence
- `packages/tui/src/tui/react/modes/plan.tsx` - Execute wiring (minor)
- `packages/tui/src/tui/react/modes/debug.tsx` - Real metrics
- `packages/tui/src/tui/react/modes/help.tsx` - Updated content
- `packages/tui/src/tui/react/panels/workflow.tsx` - Event streaming
- `packages/tui/src/tui/react/panels/knowledge.tsx` - Vim motions
- `packages/tui/src/tui/react/panels/focus.tsx` - Vim motions
- `packages/tui/test/tui-e2e.test.ts` - New tests
- `docs/architecture/tui-architecture.md` - Documentation updates

### Files That May Be Created

- `packages/tui/src/tui/react/panels/agentfs.tsx` - New panel
- `packages/tui/test/panels/` - New test directory for panel tests

## Interfaces and Dependencies

### New Types

In `packages/tui/src/tui/react/hooks/stores.ts`:

    export interface TuiStores {
      cognitive: CognitiveStateStore;
      workflow: WorkflowStore;
      voice: VoiceStore;
      metrics: MetricsStore;
      focus: FocusStore;
      agentfs: AgentFSSubscription;  // NEW
    }

In `packages/tui/src/tui/api/history.ts`:

    export interface ChatPreferences {
      selectedModelId: string;
    }

### Environment Variables

- `ALFRED_API_BASE_URL` - Base URL for API calls (default: `http://localhost:3000`)
- `ALFRED_TUI_HEADLESS` - Run without TTY for testing
- `ALFRED_TUI_HEADLESS_MS` - How long to run in headless mode
- `ALFRED_TUI_MOCK` - Force mock data mode

### External Dependencies

No new external dependencies required. All changes use existing:

- OpenTUI React for UI
- React for state management
- Existing tRPC client for API calls

## Non-Goals

To keep scope manageable, this ExecPlan explicitly does NOT include:

1. **New server endpoints** - All changes are client-side only
2. **Full terminal automation** - Tests remain headless smoke tests, not full UI automation
3. **Legacy renderer support** - Only React renderer is supported (legacy BasePanel code remains but is not enhanced)
4. **Mobile/responsive web** - Only terminal responsiveness, not browser/mobile
5. **Voice integration in TUI** - Voice panel exists but voice control from TUI is out of scope
6. **Plugin system** - No third-party panel support
7. **Deletion of legacy code** - Old BasePanel implementations remain; cleanup is future work

## Notes for Implementers

### Code Style

- Use existing patterns in the codebase
- Follow the one-word naming convention for files
- Use `.hot.ts` suffix for performance-critical files
- Keep functions under 50 lines where possible

### Testing

- Prefer in-process tests over spawned processes where possible
- Use `ALFRED_TUI_HEADLESS=true` for automated tests
- Mock API calls in unit tests
- Use real API in E2E tests where feasible

### Documentation

- Update this ExecPlan as you go
- Record all decisions in Decision Log
- Note any surprises in Surprises & Discoveries
- Update Progress section with timestamps

### Communication

If you encounter blockers:

1. Record the issue in Surprises & Discoveries
2. Make a decision and record it in Decision Log
3. If the decision significantly changes scope, note it here

---

_This ExecPlan was created to close all TUI functionality gaps identified in the Gap Analysis. It is a living document and should be updated as work proceeds._
