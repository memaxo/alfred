# Continuity Layers Architecture

## Overview

ALFRED maintains conversation and workflow continuity across three distinct memory layers, each optimized for different time horizons and access patterns. This architecture enables "infinite chat continuity" without requiring perfect recall of every word forever.

## Three-Layer Memory Model

### Layer 1: Session State (Ephemeral, TTL-based)

**Purpose:** Maintains active session context for real-time interactions.

**Characteristics:**
- In-memory storage with TTL expiration
- Optimized for low-latency access
- Cleared when session ends or expires

**Implementations:**
- **Voice sessions**: `VoiceSessionManager` registry (`packages/voice/src/server/registry.ts`)
  - TTL: `VOICE_WS_INACTIVITY_TIMEOUT_MS` (default: 1 hour)
  - Stores: audio buffers, transcript state, session metadata
- **WebSocket sessions**: `WebrtcSession` registry (`packages/api/src/voice/webrtcsession.ts`)
  - TTL: Connection lifecycle
  - Stores: peer connection state, pending audio chunks
- **Voice workflow context**: Redis/in-memory (`packages/api/src/voice/session-context.ts`)
  - TTL: `WORKFLOW_CONTEXT_TTL_SECONDS` (1 hour)
  - Stores: workflow state for multi-turn voice interactions

**Key concept:** `sessionId` = ephemeral WebSocket/voice session identifier

### Layer 2: Conversation Persistence (DB-backed threads)

**Purpose:** Enables resuming conversations across sessions, devices, and time gaps.

**Characteristics:**
- PostgreSQL-backed storage (`conversations`, `messages` tables)
- Survives session expiration and server restarts
- Queryable by `threadId` and `userId`

**Implementations:**
- **Conversation threads**: `conversationRepo` (`packages/db/src/repo/conversation.ts`)
  - Stores: message history, thread metadata, conversation state
  - Used by: voice assistant (`packages/api/src/voice/assistant.ts`), chat hooks (`apps/web/src/hooks/use-chat-logic.ts`)
- **Message persistence**: All messages persisted to `messages` table
  - Enables: "continue previous conversation" via `threadId` parameter
  - Supports: context window budgeting via `buildHistoryContext`

**Key concept:** `threadId` = persistent conversation thread identifier

### Layer 3: Structured Artifacts (Focus/Attention/Delta)

**Purpose:** Promotes important outcomes and decisions into durable, queryable artifacts.

**Characteristics:**
- PostgreSQL-backed structured data
- Designed for querying "what matters" rather than full transcript
- Survives indefinitely (no TTL)

**Implementations:**
- **Focus sets**: Collections of commitments (`focus_sets`, `focus_commitments` tables)
  - Represents: user's active priorities and WIP limits
  - Used by: Concierge Focus UI, workflow prioritization
- **Attention items**: Queue of decisions/approvals needed (`attention_items` table)
  - Represents: interruptions requiring user input
  - Used by: notification system, voice escalation
- **Delta briefs**: "What changed + what needs review" summaries (`delta_briefs` table)
  - Represents: major changes since last interaction
  - Used by: delta brief UI, morning brief generation

**Key concept:** `workflowRunId` = persistent, event-sourced execution run identifier

## Concept Mapping

| Concept | Layer | Storage | TTL | Purpose |
|---------|-------|---------|-----|---------|
| `sessionId` | Layer 1 | In-memory/Redis | 1 hour | Ephemeral WebSocket/voice session |
| `threadId` | Layer 2 | PostgreSQL | Forever | Persistent conversation thread |
| `workflowRunId` | Layer 3 | PostgreSQL | Forever | Persistent execution run |

## Relationship to Context Types

This document describes **continuity layers** (how ALFRED remembers across time). For agent execution context types (Window/Artifact/Domain/Environmental/Temporal), see [`docs/definitions/context.md`](../definitions/context.md).

**Key distinction:**
- **Continuity layers**: How ALFRED persists and retrieves conversation/workflow state
- **Context types**: What information agents have available during execution

## Usage Patterns

### Voice Resume Flow

1. User receives push notification with `workflowRunId`
2. User taps notification → deep-link opens voice call
3. Voice assistant loads:
   - **Layer 2**: Conversation history via `threadId` parameter
   - **Layer 3**: Attention item and workflow run state via `workflowRunId`
4. Assistant continues conversation with full context

### Long-Running Workflow

1. User starts workflow → creates `workflowRunId`
2. Workflow runs in background:
   - **Layer 1**: Active agent sessions (ephemeral)
   - **Layer 2**: Conversation thread persists messages
   - **Layer 3**: Attention items created on suspend, delta briefs on complete
3. User returns hours later:
   - **Layer 1**: Sessions expired (cleared)
   - **Layer 2**: Full conversation history available
   - **Layer 3**: Delta brief summarizes "what changed"

## Implementation References

- Session management: `packages/voice/src/server/registry.ts`, `packages/api/src/voice/webrtcsession.ts`
- Conversation persistence: `packages/db/src/repo/conversation.ts`, `packages/api/src/voice/assistant.ts`
- Structured artifacts: `packages/db/src/schema/focus.ts`, `packages/api/src/services/concierge.ts`
- Context budgeting: `packages/history/src/history-context.ts` (see [`context-budgeting.md`](./context-budgeting.md))
