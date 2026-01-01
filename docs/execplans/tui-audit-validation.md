# ExecPlan: TUI Package Audit and Validation

## Purpose
Perform a comprehensive audit and functional validation of the `@alfred/tui` package, fix identified bugs/architectural gaps, and establish a robust functional testing plan.

## Plan
1. **Fix Architectural Gaps & Bugs**
   - [ ] Add `.unref()` to timers in `SubscriptionManager` and `Renderer` to prevent hanging tests.
   - [ ] Implement credential encryption for file fallback in `credentials.ts` using `encryption.ts`.
   - [ ] Optimize `renderer.ts` to reduce flickering if possible.
2. **Audit & Improve Package Integration**
   - [ ] Ensure all domain panels (Cognitive, Voice, etc.) correctly implement `BasePanel` lifecycle hooks.
   - [ ] Update `agentfs` subscription to handle real data if endpoints exist, otherwise document as a known gap.
3. **Functional Testing**
   - [ ] Create `packages/tui/test/tui-e2e.test.ts` to simulate TUI interaction.
   - [ ] Validate MAX_TRANSITIONS safeguards in TUI mode transitions.
4. **Documentation**
   - [ ] Create/Update TUI architecture diagram/document.
   - [ ] Document all approved deletions or significant changes.
5. **Expanded Scope (Phase 2)**
   - [ ] Make non-TTY behavior explicit: default `alfred tui` requires a TTY; `--headless` is required for tests/CI.
   - [ ] Fix quit confirmation flow so cancel resumes rendering and input instead of freezing.
   - [ ] Wire `TuiApp.connectStoresToDashboard()` so domain panels reflect live store updates.
   - [ ] Implement `TuiApp.showHelp()` and validate it via headless E2E.
   - [ ] Implement mode-transition guards (MAX_TRANSITIONS) and add tests for success/escalation/limit hit.
6. **Expanded Scope (Phase 3)**
   - [ ] Replace AgentFS polling with a tRPC stream/subscription and add tests.
   - [ ] Add a minimal perf guard to keep dashboard layout/render under a <16ms average frame budget in headless runs.

## Progress
- [x] Initial audit of core files (`BasePanel`, `SubscriptionManager`, `PackageRegistry`, `Renderer`).
- [x] Identification of timer leaks and credential encryption gaps.
- [x] Fixed timer leaks in `SubscriptionManager`, `Renderer`, `BaseMode`, `Dashboard`, and `IntroSequence`.
- [x] Implemented AES-256-GCM encryption for file fallback in `credentials.ts`.
- [x] Reduced TUI flickering by using `moveCursor(0,0)` instead of `clearScreen()`.
- [x] Fixed panel registration bug in `Dashboard` (explicitly register core panels and handle constructors from registry).
- [x] Added TTY checks to terminal setup and keyboard input to improve test stability.
- [x] Created `packages/tui/test/tui-e2e.test.ts` for functional testing.
- [x] Updated `TuiApp` to respect `ALFRED_TUI_SKIP_INTRO` environment variable.
- [x] Fixed non-TTY infinite loop: `alfred tui` now fails fast unless `--headless` / `ALFRED_TUI_HEADLESS=true` is provided.
- [x] Fixed quit confirmation freeze: dashboard rendering pauses for confirm dialogs and resumes cleanly on cancel.
- [x] Removed temporary stderr debug spam from registry discovery and renderer modules.
- [x] Tightened interval hygiene: added missing `.unref()` calls to render loops and ensured key handlers are cleaned up on stop.
- [x] Updated TUI E2E tests to run with `--headless` and assert against actual mode hints.
- [x] ExecPlan expanded to include Phase 2/3 follow-on work (mode guards, store wiring, help, agentfs stream, perf checks).
- [x] Implemented bounded in-session mode switching (dashboard → chat/debug/plan) and enforced `ALFRED_TUI_MAX_TRANSITIONS` with headless E2E coverage.
- [x] Wired shared `TuiApp` stores into dashboard panels via dependency injection and added a focused unit test.
- [x] Added `HelpMode` and routed `?` / palette Help to it (headless E2E: open help → Esc back).
- [x] Fixed PlanMode key-hint mismatches by implementing `Enter` retry/new-plan behavior for error/complete phases.
- [x] Added an import-safety regression test to ensure TUI entrypoints don’t leak handles (process exits quickly).
- [x] Added shared AgentFS stream DTOs in `@alfred/type` (`agentfs.ts`) for snapshot + stream events/cursor.
- [x] Added `agentfs.snapshot` + `agentfs.stream` procedures to `@alfred/api` with cursor resume + `ALFRED_AGENTFS_MAX_EVENTS` safeguard.
- [x] Added `read:agentfs` scope and enforced it on AgentFS procedures; added router tests for auth/scope/invalid input/stream lifecycle/resume/max-events.

## Surprises & Discoveries
- `agentfs.ts` already implements `.unref()` on its polling timer.
- `credentials.ts` was storing plaintext tokens in `~/.alfred/credentials.json` when OS keychain was unavailable.
- Registry discovery returned placeholder panels that were classes, not instances, causing the TUI to crash.
- The TUI could be launched in non-interactive environments (stdout/stdin not TTY) and would block indefinitely waiting for a quit key.
- Dashboard previously stopped itself before async quit confirmation, leaving the app running but with no active view when quit was cancelled.
- Temporary `writeSync` debug logging in discovery/renderer polluted stderr and confused headless test output.

## Decision Log
- Decided to use `Bun.spawn` with `stdin: "pipe"` for E2E tests to simulate user input.
- Decided to explicitly register core domain panels in `Dashboard.ts` to ensure stability even if other packages return placeholders.
- Added ANSI stripping in E2E tests to reliably verify content.
- Introduced a `--headless` TUI flag (and `ALFRED_TUI_HEADLESS=true`) to support CI/tests while keeping interactive TUI strictly TTY-only by default.
- Standardized quit handling to return a boolean (cancel vs exit) so dashboards/modes can pause/resume safely around confirmations.
- Added a dedicated `read:agentfs` scope for AgentFS telemetry (tool calls / kv / virtual FS) and enforced it via `requireScopes`.
- Implemented AgentFS “streaming” initially as a tRPC subscription with cursor-based resume and an explicit `ALFRED_AGENTFS_MAX_EVENTS` safety cap.

## Outcomes & Retrospective
- The TUI architecture is now more robust and less prone to flickering.
- Security is improved with mandatory encryption for all credential storage paths.
- Functional testing framework established for future regression testing.
- The TUI no longer “hangs forever” when invoked without a TTY; headless mode is explicit and test-friendly.
- Quit confirmation behaves correctly: cancel returns you to the dashboard instead of freezing the session.
- Help is now a first-class TUI mode with stable headless test coverage.
- AgentFS API streaming contract exists (snapshot + stream), but the TUI AgentFS panels are still on mock/polling until Phase 4 wiring is completed.

