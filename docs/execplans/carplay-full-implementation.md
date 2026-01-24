# ExecPlan: ALFRED CarPlay Full Implementation

## Purpose

Implement the complete ALFRED CarPlay experience as specified in `docs/carplay-design/ALFRED-CarPlay-Experience-Documentation.md`. Transform ALFRED from a basic CarPlay presence into a full voice-first coding agent orchestrator interface with escalation handling, workflow monitoring, PR approvals, and NowPlaying status streaming.

## Current State

Basic CarPlay integration exists with:

- `lib/carplay/templates.ts` - Basic templates (Grid, List, Information, Voice, Alert)
- `lib/carplay/controller.ts` - Simple controller with connection handling
- `lib/carplay/audio.ts` - Audio session management
- Native iOS Scene delegates (CarScene, PhoneScene)
- CarPlay icons and entitlements configured

## Target State

Full implementation per design documentation:

- Dashboard widget for glanceable agent status
- Multi-agent grid with real-time state updates
- Decision queue with priority sorting
- PR summary and approval flow
- NowPlaying template for workflow status streaming
- Voice commands for agent control
- ExecPlan review and approval
- TTS with proper scripts and audio cues
- WebSocket-based state synchronization
- Offline mode with command queuing

---

## Plan

### Phase 1: State Management & API Layer (Foundation)

**1.1 Workflow State Types**

- Create `lib/carplay/types.ts` with:
  - `WorkflowState` interface (id, name, status, progress, currentTask, etc.)
  - `Escalation` interface (id, workflowId, question, options, priority, createdAt)
  - `PullRequest` interface (id, title, filesChanged, linesAdded, linesRemoved, tests, coverage, buildStatus)
  - `ExecPlan` interface (id, title, steps, estimatedTime, riskLevel)
  - `CarPlayEvent` union type for all events

**1.2 State Store**

- Create `lib/carplay/store.ts`:
  - Zustand store for CarPlay state
  - `workflows: Map<string, WorkflowState>`
  - `escalations: Escalation[]`
  - `pullRequests: PullRequest[]`
  - `pendingPlans: ExecPlan[]`
  - `connectionStatus: 'connected' | 'disconnected' | 'offline'`
  - Actions: updateWorkflow, addEscalation, resolveEscalation, etc.

**1.3 WebSocket Sync**

- Create `lib/carplay/sync.ts`:
  - WebSocket connection to backend `/stream`
  - Event handlers for workflow.updated, escalation.created, pr.ready, plan.ready
  - Auto-reconnect with exponential backoff
  - Fallback polling every 30s when WebSocket unavailable

**1.4 API Client**

- Create `lib/carplay/api.ts`:
  - `pauseWorkflow(id)`, `resumeWorkflow(id)`, `cancelWorkflow(id)`
  - `resolveEscalation(id, decision)`, `deferEscalation(id)`
  - `approvePR(id)`, `requestChanges(id, comment)`, `deferPR(id)`
  - `approvePlan(id)`, `modifyPlan(id, changes)`, `cancelPlan(id)`

### Phase 2: Template System Upgrade

**2.1 Dashboard Scene**

- Create `lib/carplay/scenes/dashboard.ts`:
  - `CarPlayDashboard.create()` configuration
  - Shortcut buttons: "Talk to Alfred" + contextual action
  - Widget component showing top workflow status
  - 30-second background refresh
  - State-based icon (running/blocked/complete)

**2.2 Multi-Agent Grid Template**

- Update `lib/carplay/templates.ts`:
  - `createAgentGridTemplate()` - shows up to 8 workflows
  - State-based icons per workflow
  - Tap handler → workflow detail
  - "View all" overflow item if >8 workflows

**2.3 Decision Queue Template**

- Add `createDecisionQueueTemplate()`:
  - Priority-sorted list (Critical → High → Normal)
  - List items with priority icon, title, context, time
  - Tap handler → decision detail
  - Empty state: "All caught up"

**2.4 PR List Template**

- Add `createPRListTemplate()`:
  - List of PRs ready for review
  - Shows title, files changed, test status
  - Tap handler → PR summary

**2.5 NowPlaying Template**

- Create `lib/carplay/nowplaying.ts`:
  - `NowPlayingTemplate` configuration
  - Album art: Orb images for each state
  - Transport controls: Previous (replay), Pause, Next (current status)
  - Progress bar showing workflow completion
  - Integration with MPNowPlayingInfoCenter

**2.6 TabBar Root Template**

- Add `createTabBarTemplate()`:
  - 4 tabs: Status, Decisions, PRs, Voice
  - Badge counts for Decisions and PRs
  - Tab selection handler

### Phase 3: Voice System Integration (REVISED - Wire to Existing)

**CRITICAL**: ALFRED already has a complete voice system. CarPlay must wire to existing infrastructure, NOT create new implementations.

**Existing Voice Infrastructure:**

- `apps/native/lib/voice/session.ts` - `useVoiceSessionNative` hook (1400+ lines)
- `apps/native/lib/voice/play.ts` - `playBase64()` TTS playback
- `apps/native/lib/voice/queue.ts` - Offline queue with retry
- `packages/api/src/voice/plan-speech.ts` - Plan/escalation/PR speech generators
- `packages/api/src/voice/intent.ts` - LLM-first intent classification
- `packages/api/src/voice/workflow-handler.ts` - Workflow intent handlers
- `packages/api/src/routers/voice.ts` - tRPC voice routers (STT, TTS, S2S, WebRTC)

**3.1 CarPlay Voice Bridge**

- Create `lib/carplay/voice/bridge.ts`:
  - Initialize `useVoiceSessionNative` with CarPlay surface
  - Configure for CarPlay context (background audio, WebRTC preferred)
  - Expose: `startListening()`, `stopListening()`, `speak(text)`, `speakToSpeech()`
  - Wire `stream.transcript` to CarPlay voice template
  - Wire `stream.assistantText` to response display
  - Handle `stream.status` for UI state transitions

**3.2 Intent Classification Bridge**

- Create `lib/carplay/voice/intent.ts`:
  - Import `classifyVoiceIntent` from `@alfred/api/voice/intent` (via tRPC)
  - Wrap with CarPlay-specific context (current screen, pending decisions)
  - Map intent results to CarPlay actions:
    - `workflow` → `handleWorkflowIntent` (create new workflow)
    - `approval` → `handleApprovalIntent` (approve/reject pending)
    - `status_query` → `handleStatusQuery` (speak status)
    - `conversational` → pass to assistant

**3.3 Speech Generator Bridge**

- Create `lib/carplay/voice/speech.ts`:
  - Import speech generators from `@alfred/api/voice/plan-speech`:
    - `planToSpeech()` - Plan summaries
    - `planStatusSummary()` - Progress updates
    - `planCompletionSummary()` - Completion announcements
    - `clarificationToSpeech()` - Questions
  - Create CarPlay-specific wrappers for orchestrator data:
    - `speakEscalation(escalation)` → format using existing `Escalation` type
    - `speakPRSummary(pr)` → format PR for voice
    - `speakWorkflowStatus(workflows)` → format status response
    - `speakDecisionQueue(escalations, reviewCount)` → queue summary

**3.4 Workflow Handler Integration**

- Create `lib/carplay/voice/handlers.ts`:
  - Wire to existing handlers via tRPC:
    - `voice.speechToSpeech` - Full STT→LLM→TTS pipeline
    - `handleWorkflowIntent` - Create workflows from voice
    - `handleApprovalIntent` - Approve/reject pending plans
    - `handleStatusQuery` - Get workflow status
  - CarPlay-specific action handlers:
    - `handleEscalationDecision(id, action)` - Resolve escalations
    - `handlePRDecision(id, action)` - Approve/defer PRs
    - `handleWorkflowControl(id, action)` - Pause/resume/cancel

**3.5 Audio Cues (Minimal)**

- Create `lib/carplay/voice/cues.ts`:
  - Use existing `playBase64()` for audio playback
  - Simple cue types: listening, confirmed, error
  - Source from bundled assets or generate via TTS

### Phase 4: Controller Integration

**4.1 Controller Upgrade**

- Refactor `lib/carplay/controller.ts`:
  - Subscribe to state store
  - Template refresh batching (5-second debounce)
  - Alert queue with priority handling
  - NowPlaying session management
  - Voice command routing

**4.2 Escalation Flow**

- Implement full escalation flow:
  - Push notification → Alert presentation
  - TTS announcement with options
  - Voice/tap response handling
  - API call to resolve
  - Confirmation TTS

**4.3 PR Approval Flow**

- Implement PR review flow:
  - PR ready notification
  - Summary template with metrics
  - Approve → merge → deployment notification
  - Request changes → voice input → submit

**4.4 Plan Approval Flow**

- Implement plan review flow:
  - Plan ready notification
  - Summary with steps and estimates
  - Approve → workflow starts → NowPlaying
  - Modify → voice input for scope changes

### Phase 5: NowPlaying Integration

**5.1 MPNowPlayingInfoCenter Setup**

- Create `lib/carplay/nowplaying/info.ts`:
  - Configure Now Playing metadata
  - Album art updates by state
  - Progress bar updates
  - Elapsed/remaining time

**5.2 Remote Command Targets**

- Create `lib/carplay/nowplaying/commands.ts`:
  - `.pauseCommand` → pause TTS updates
  - `.playCommand` → resume TTS updates
  - `.nextTrackCommand` → speak current status
  - `.previousTrackCommand` → replay last update

**5.3 Status Streaming**

- Implement streaming updates:
  - Task completion → TTS announcement
  - Phase transition → TTS announcement
  - Error/warning → TTS announcement
  - Batching at punctuation boundaries

### Phase 6: Offline Mode

**6.1 Offline Detection**

- Monitor network state via NetInfo
- Transition to offline mode when disconnected
- Show "Last updated: [time]" indicator

**6.2 Command Queue**

- Create `lib/carplay/offline/queue.ts`:
  - Queue voice commands when offline
  - Store in AsyncStorage
  - Execute on reconnect

**6.3 Offline UI**

- Show cached workflow states
- Disable actions that require connectivity
  - Display "Offline" indicator in templates

### Phase 7: Assets & Polish

**7.1 CarPlay Icons**

- Create state icons (80×80 @3x):
  - `orb-running.png`
  - `orb-thinking.png`
  - `orb-blocked.png`
  - `orb-complete.png`
  - `orb-failed.png`
  - `orb-paused.png`

**7.2 NowPlaying Album Art**

- Create album art (600×600):
  - Same states as icons, larger format
  - ALFRED branding subtle

**7.3 Audio Cue Files**

- Create/source audio cues:
  - `listening.m4a` - soft rising tone
  - `confirmed.m4a` - double tap
  - `escalation.m4a` - gentle chime
  - `error.m4a` - low double-tone
  - `complete.m4a` - ascending triad

### Phase 8: Testing & Documentation

**8.1 Unit Tests**

- Test state store actions
- Test voice command parser
- Test TTS script generation
- Test API client

**8.2 Integration Tests**

- Test escalation flow end-to-end
- Test PR approval flow
- Test NowPlaying controls

**8.3 CarPlay Simulator Testing**

- Test all templates render correctly
- Test voice commands recognized
- Test transport controls work
- Test offline mode transitions

**8.4 Documentation**

- Update `lib/carplay/index.ts` exports
- Add JSDoc to all public functions
- Create `docs/carplay-usage.md` quick start

---

## Progress

- [x] Phase 1: State Management & API Layer
  - [x] 1.1 Workflow State Types - `lib/carplay/types.ts`
  - [x] 1.2 State Store - `lib/carplay/store.ts` (Zustand)
  - [x] 1.3 WebSocket Sync - `lib/carplay/sync.ts` (polling fallback)
  - [x] 1.4 API Client - `lib/carplay/api.ts`
- [x] Phase 2: Template System Upgrade (partial)
  - [x] 2.1 Dashboard Scene - `lib/carplay/scenes/dashboard.ts`
  - [x] 2.2 Multi-Agent Grid Template - `createAgentGridTemplate()`
  - [x] 2.3 Decision Queue Template - `createDecisionQueueTemplate()`
  - [x] 2.4 PR List Template - `createPRListTemplate()`
  - [ ] 2.5 NowPlaying Template
  - [x] 2.6 TabBar Root Template - in dashboard.ts
- [x] Phase 3: Voice System Integration (Wire to Existing)
  - [x] 3.1 CarPlay Voice Bridge - `lib/carplay/voice/bridge.ts` (useCarPlayVoice hook)
  - [x] 3.2 Intent Classification Bridge - `lib/carplay/voice/intent.ts` (classifyCarPlayIntent)
  - [x] 3.3 Speech Generator Bridge - `lib/carplay/voice/speech.ts` (wrappers for orchestrator data)
  - [x] 3.4 Workflow Handler Integration - `lib/carplay/voice/handlers.ts` (with TODO stubs for APIs)
  - [x] 3.5 Audio Cues - `lib/carplay/voice/cues.ts` (haptic feedback via expo-haptics)
- [x] Phase 4: Controller Integration
  - [x] 4.1 Controller Upgrade - Refactored to use voice bridge, store, sync
  - [x] 4.2 Escalation Flow - showEscalationDetail, handleEscalationAction
  - [x] 4.3 PR Approval Flow - showPRDetail, handlePRAction
  - [x] 4.4 Plan Approval Flow - showPlanApproval, handlePlanAction
- [x] Phase 5: NowPlaying Integration
  - [x] 5.1 NowPlayingTemplate setup with info tracking
  - [x] 5.2 Remote command handlers (play/pause/next/previous)
  - [ ] 5.3 Status Streaming
- [x] Phase 6: Offline Mode
  - [x] 6.1 Offline command queue (reuses existing sync/queue.ts)
  - [x] 6.2 Optimistic actions in store (offlineCommands array)
  - [x] 6.3 Queue sync on reconnect (processPendingCommands)
- [ ] Phase 7: Assets & Polish
  - [ ] 7.1 CarPlay Icons
  - [ ] 7.2 NowPlaying Album Art
  - [ ] 7.3 Audio Cue Files
- [ ] Phase 8: Testing & Documentation
  - [ ] 8.1 Unit Tests
  - [ ] 8.2 Integration Tests
  - [ ] 8.3 CarPlay Simulator Testing
  - [ ] 8.4 Documentation

---

## Surprises & Discoveries

(To be filled during implementation)

---

## Decision Log

| Date       | Decision                                      | Rationale                                                                                       |
| ---------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2026-01-24 | Use TabBar as root (4 tabs)                   | Better organization than single grid for orchestrator use case                                  |
| 2026-01-24 | Zustand for state                             | Already used in app, simpler than Redux for this scope                                          |
| 2026-01-24 | WebSocket primary, polling fallback           | Real-time updates critical for escalations                                                      |
| 2026-01-24 | Wire to existing voice system                 | ALFRED has complete STT/TTS/intent/workflow-handler infrastructure - no reimplementation needed |
| 2026-01-24 | Use `useVoiceSessionNative` for CarPlay voice | Already handles WebRTC/WS transport, streaming, playback queue, mute/unmute                     |
| 2026-01-24 | Use `plan-speech.ts` for announcements        | Existing speech generators with verbosity, honorifics, pluralization                            |

---

## Outcomes & Retrospective

(To be filled after completion)

---

## File Structure

```
apps/native/lib/carplay/
├── index.ts                    # Public exports
├── types.ts                    # TypeScript interfaces
├── store.ts                    # Zustand state store
├── sync.ts                     # WebSocket synchronization
├── api.ts                      # API client functions
├── controller.ts               # Main CarPlay controller (refactored)
├── templates.ts                # Template factories (extended)
├── audio.ts                    # Audio session management (existing)
├── scenes/
│   └── dashboard.ts            # Dashboard scene configuration
├── nowplaying/
│   ├── index.ts                # NowPlaying template
│   ├── info.ts                 # MPNowPlayingInfoCenter
│   └── commands.ts             # Remote command handlers
└── voice/
    ├── bridge.ts               # useVoiceSessionNative integration
    ├── intent.ts               # Intent classification bridge (via tRPC)
    ├── speech.ts               # Speech generator wrappers
    ├── handlers.ts             # Workflow/escalation/PR handlers
    └── cues.ts                 # Audio cue playback

apps/native/assets/carplay/
├── orb-running.png
├── orb-thinking.png
├── orb-blocked.png
├── orb-complete.png
├── orb-failed.png
├── orb-paused.png
├── album-running.png
├── album-thinking.png
├── album-blocked.png
├── album-complete.png
└── audio/
    ├── listening.m4a
    ├── confirmed.m4a
    ├── escalation.m4a
    ├── error.m4a
    └── complete.m4a
```

## Estimated Effort

| Phase                      | Effort  | Priority |
| -------------------------- | ------- | -------- | -------------------------------------- |
| Phase 1: State Management  | 4 hours | P0       | ✅ DONE                                |
| Phase 2: Templates         | 6 hours | P0       | ✅ DONE (except NowPlaying)            |
| Phase 3: Voice Integration | 3 hours | P0       | (wiring to existing - reduced from 5h) |
| Phase 4: Controller        | 4 hours | P0       |
| Phase 5: NowPlaying        | 3 hours | P1       |
| Phase 6: Offline           | 1 hour  | P2       | (existing queue.ts can be reused)      |
| Phase 7: Assets            | 2 hours | P1       |
| Phase 8: Testing           | 4 hours | P1       |

**Total: ~27 hours** (reduced due to voice system reuse)
**Remaining: ~17 hours**

## Dependencies

- `react-native-carplay` (installed)
- `zustand` (already in project)
- `@react-native-community/netinfo` (for offline detection)
- Backend WebSocket endpoint at `/stream`
- Backend API endpoints for workflows, escalations, PRs, plans
