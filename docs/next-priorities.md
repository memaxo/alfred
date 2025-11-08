# ALFRED Next Priority Development Goals

Based on analysis of current codebase state, here are the actual next priority development goals.

## Current State Summary

**Completed (~70-80% of Phase 1-5):**
- ✅ Database migrations, schemas, repos
- ✅ Auth (Better Auth + Passkeys + JWT tokens)
- ✅ Policy engine (PDP + PEP middleware)
- ✅ Metrics and health endpoints
- ✅ Orchestrator workflow with droid exec, git, router, ticket tools
- ✅ Personal Assistant core tools (note, remind, timer, book, handoff)
- ✅ Linear webhook handler (signature verification)

**Missing/Incomplete:**
- ❌ RAG implementation (ingest/retrieve)
- ❌ Focus and Web tools for Personal Assistant
- ❌ Linear Agent Activities handling
- ❌ Workflow suspend/resume for biometric obligations
- ❌ UI implementation
- ❌ Speech-to-speech voice interface

## Top Priority Development Goals

### 1. Complete Personal Assistant Tools (High Impact, ~2-3 days)

**Missing tools for MVP:**

- **`packages/agent/assistant/src/tool/focus.ts`** - Focus/drive mode
  - Toggle focus mode with duration
  - Update memory template to reduce verbosity
  - Policy integration for "short responses" during drive mode

- **`packages/agent/assistant/src/tool/web.ts`** - Web fetch for Assistant
  - Small capped fetch for research (different from orchestrator web tool)
  - Read-only by default
  - Size limits for safety

**Impact:** Completes core Personal Assistant functionality for MVP

---

### 2. Implement RAG System (High Impact, ~5-7 days)

**Complete `packages/rag/src/doc.ts`:**

- **`ingest()` function** - Document processing pipeline
  - Chunk content with recursive chunker (already exists)
  - Generate embeddings via OpenAI API
  - Store in pgvector with HNSW index
  
- **`retrieve()` function** - Semantic search
  - Generate query embedding
  - Vector similarity search in pgvector
  - Filter by threshold
  - Optional re-ranking with AI SDK scorers
  
- **`embed()` function** - Embedding generation
  - Call OpenAI `text-embedding-3-small` API
  - Return 1536-dim vector
  - Cache embeddings

- **Integration:**
  - Wire to Assistant memory for semantic recall
  - Enable RAG embeds on note save
  - Add to orchestrator context gathering

**Impact:** Enables semantic memory and context retrieval

---

### 3. Complete Linear Integration (Medium Impact, ~3-4 days)

**Implement Linear Agent Activities:**

- **`packages/agent/src/orchestrator/flow/plan.ts`** - Emit activities during workflow
  - `thought` activity on start (within 10s acknowledgment)
  - `action` activity for tool calls and results
  - `response` activity on completion
  - `error` activity on failures
  
- **Linear client integration:**
  - Set Alfred as delegate on issue
  - Move issue to "started" state
  - Persist runId → sessionId mapping in graph memory
  
- **Webhook handling enhancement:**
  - Currently just publishes to pubsub
  - Need subscriber to handle agent session events
  - Route to workflow execution

**Impact:** Makes Alfred a first-class Linear agent

---

### 4. Workflow Suspend/Resume for Biometric (Medium Impact, ~2-3 days)

**Implement PDP obligation handling:**

- **`packages/agent/src/orchestrator/flow/plan.ts`** - Suspend workflow
  - Check PDP before high-risk actions
  - If `requireBio` obligation → suspend workflow
  - Emit "suspend" event with reason
  
- **Resume endpoint:**
  - `packages/api/src/routers/workflow.ts` - Add `resume` procedure
  - Accept elevated token with biometric claims
  - Resume workflow from suspension point
  
- **UI integration:**
  - Biometric prompt on suspend event
  - Capture passkey assertion
  - Call resume with elevated token

**Impact:** Enables safe high-autonomy operations

---

### 5. UI Implementation (High Impact, ~1-2 weeks)

**Complete web interface:**

- **Chat interface** (`apps/web/src/components/chat.tsx`)
  - Agent switcher (Assistant/Orchestrator)
  - Stream rendering with cache handoff
  - Message history
  
- **Panes** (`apps/web/src/components/pane/`)
  - Notes pane with CRUD
  - Reminders pane with live updates
  
- **Settings pages** (`apps/web/src/routes/settings/`)
  - Profile management
  - Preferences (remember/correct)
  - Privacy controls (forget/export)
  - Autonomy sliders
  
- **Orchestrator integration:**
  - "Send to Orchestrator" CTA
  - Run viewer with progress stream
  - Linear connection UI

**Impact:** Makes system usable for end-user

---

### 6. Speech-to-Speech Voice Interface (High Impact, ~1 week)

**Voice capabilities:**

- **STT** (`packages/api/src/routers/voice.ts`)
  - Faster-Whisper wrapper with shape normalization
  - Turn-based transcription
  
- **TTS** (`packages/api/src/routers/voice.ts`)
  - Piper/Coqui TTS with base64/url streaming
  - Low-latency synthesis
  
- **Drive mode UI**
  - Large controls, short responses
  - Voice-first flow
  - Policy integration for brevity

**Impact:** Enables hands-free interaction, especially useful for mobile/drive mode

---

## Recommended Implementation Order

### Sprint 1: RAG + Assistant Tools (web, focus)
- RAG implementation (#2) - ingest(), retrieve(), embed()
- Personal Assistant tools: web, focus (#1)
- Wire focus mode to memory templates and policy

### Sprint 2: Linear Activities
- Linear Agent Activities emission (#3)
- Webhook subscriber to handle session events
- Delegate and state management

### Sprint 3: Suspend/Resume + UI Start
- Workflow suspend/resume logic (#4)
- Chat interface with agent switcher
- Basic streaming and cache handoff

### Sprint 4: UI Completion + Testing
- Panes (Notes, Reminders)
- Settings pages (Profile, Preferences, Privacy)
- Orchestrator run viewer
- Integration testing

### Sprint 5: Speech-to-Speech
- STT implementation (Faster-Whisper)
- TTS implementation (Piper/Coqui)
- Drive mode UI with voice-first flow
- Policy integration for brevity

---

## Why These Priorities?

1. **RAG** enables semantic memory - foundational for personalization
2. **Personal Assistant tools** complete core MVP functionality
3. **Linear integration** makes Alfred production-ready for SWE workflows
4. **Suspend/resume** enables safe high-autonomy operations
5. **UI** makes everything accessible to end-users
6. **Voice** enables hands-free interaction for mobile/drive scenarios

All of these work together to create a cohesive, production-ready MVP system.
