# Voice Workflow Bridge

**Date:** January 2026  
**Owner:** Voice / Workflow teams

The Voice Workflow Bridge enables voice-initiated feature development. Users can describe what they want to build via voice, receive a spoken plan summary, approve or reject with voice commands, and track execution status through voice queries.

## Overview

```
Voice Input → Intent Classification → Plan Generation → Voice Summary → Approval → Execution
```

When enabled, the voice assistant classifies incoming speech to determine if it's:
- **Workflow intent**: User wants to build, fix, or modify something
- **Approval intent**: User is approving or rejecting a plan
- **Status query**: User is asking about workflow progress
- **Conversational**: General conversation (handled by standard assistant)

## Configuration

Voice workflow is **enabled by default**. Configure all settings in:

**Settings > Voice > Workflow Planning**

### Preference Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `domain.voice.workflow_enabled` | boolean | `true` | Enable/disable voice workflow |
| `domain.voice.workflow_verbosity` | `"brief" \| "standard" \| "detailed"` | `"standard"` | Plan summary detail level |
| `domain.voice.workflow_auto_approve` | `"off" \| "small" \| "medium" \| "all"` | `"off"` | Auto-approve threshold |
| `domain.voice.workflow_notifications` | `"voice" \| "sound" \| "silent"` | `"voice"` | Completion notification type |
| `domain.voice.workflow_updates` | `"request" \| "25percent" \| "phase" \| "continuous"` | `"request"` | Progress update frequency |
| `domain.voice.workflow_timeout` | number (minutes) | `5` | Approval timeout (0 = none) |
| `domain.voice.workflow_learning` | boolean | `true` | Learn patterns from workflows |

### Verbosity Levels

- **Brief**: Phase count and task count only. Minimal voice output.
- **Standard**: Phase names with task counts. Default experience.
- **Detailed**: Full phase descriptions and duration estimates.

### Auto-Approve

Automatically approve plans based on size:

- **Off**: Always require manual approval
- **Small**: Auto-approve single-phase plans with ≤3 tasks
- **Medium**: Auto-approve plans with ≤2 phases and ≤6 tasks
- **All**: Auto-approve all generated plans

### Completion Notifications

How to notify when a workflow completes:

- **Voice**: Synthesize a TTS announcement
- **Sound**: Play a notification sound only
- **Silent**: No notification

### Progress Updates

When to proactively provide status updates:

- **On Request**: Only when you ask "what's the status?"
- **Milestones (25%)**: At 25%, 50%, 75% completion
- **Per Phase**: After each phase completes
- **Continuous**: After each task completes

### Approval Timeout

Plans awaiting approval will auto-reject after this many minutes. Set to 0 to disable timeout.

## Voice Commands

### Starting a Workflow

Natural language requests that indicate development intent are routed to the workflow pipeline:

```
"Build a dark mode feature"
"Create an API endpoint for user registration"
"Fix the bug in the authentication flow"
"Add tests for the payment module"
"Refactor the database queries to use connection pooling"
```

### Approving or Rejecting Plans

After ALFRED presents a plan, the user can approve or reject:

**Approval phrases:**
- "Yes", "Approve", "Go ahead"
- "Proceed", "Do it", "Execute"
- "Sounds good", "Looks good", "That's fine"

**Rejection phrases:**
- "No", "Reject", "Cancel"
- "Stop", "Abort", "Nevermind"
- "Scratch that", "Not now"

### Status Queries

While a workflow is executing:

```
"What's the status?"
"How's the progress?"
"Is it done?"
"How far along are we?"
```

## Example Interaction

```
User: "Build a dark mode feature for the settings page"

ALFRED: "I've created a plan with 3 phases and 7 total tasks. 
         Phase 1: Create theme context with 2 tasks. 
         Phase 2: Update components with 3 tasks. 
         Phase 3: Add persistence with 2 tasks.
         This will run 4 agents in 2 waves. Estimated time: about 5 minutes.
         Say 'approve' to proceed or 'reject' to cancel."

User: "Approve"

ALFRED: "Plan approved. Agents are now executing. I'll let you know when 
         they're done, or ask for status updates anytime."

[Later...]

User: "What's the status?"

ALFRED: "5 of 7 tasks completed. That's 71% done."

[When complete...]

User: "Status"

ALFRED: "Done! Completed 7 tasks in 4 minutes."
```

## Hybrid Approval

Plans can be approved either:
1. **Via voice**: Say "approve" or similar
2. **Via web UI**: Click the approve button in the workflow interface

The voice session stores the `runId` and `planId` so both approval methods work with the same plan.

## Technical Details

### Intent Classification

Uses LLM-first classification via `@alfred/plan/classify` with keyword fallback:

```typescript
type VoiceIntentResult =
  | { type: "workflow"; confidence: number; requirement: string }
  | { type: "approval"; action: "approve" | "reject" }
  | { type: "status_query"; runId?: string }
  | { type: "conversational" };
```

Classification considers session context. If a plan is awaiting approval, approval/rejection keywords are prioritized.

### State Machine

The voice workflow tracks state across utterances:

```
idle → planning → awaiting_approval → executing → completed
                         ↓
                      rejected
```

State is stored in Redis (with in-memory fallback) using key `voice:workflow:{userId}`.

### Plan-to-Speech

Structured plans are converted to natural language optimized for TTS:

- Phase count and total task count
- Per-phase summaries (up to 5 phases)
- Agent and wave counts
- Duration estimates
- Approval prompt

### Files

| File | Purpose |
|------|---------|
| `packages/api/src/voice/intent.ts` | Intent classification |
| `packages/api/src/voice/workflow-state.ts` | State machine types |
| `packages/api/src/voice/plan-speech.ts` | Plan-to-speech conversion |
| `packages/api/src/voice/workflow-handler.ts` | Intent handlers, auto-approve logic |
| `packages/api/src/voice/session-context.ts` | Session storage, timeout handling |
| `packages/api/src/voice/preferences.ts` | Preference types and loader |
| `packages/api/src/voice/notifier.ts` | WebSocket notifications |
| `packages/api/src/voice/assistant.ts` | Entry point with routing |

## Limitations

- Multi-intent requests use only the first detected intent
- Status estimates are approximate during execution
- Visual completion summary is handled separately by the web UI

## See Also

- [Voice API](./voice.md) - Core voice endpoints
- [Speech-to-Speech](./s2s.md) - STT → LLM → TTS flow
- [Voice Streaming](./streaming.md) - Real-time transport
