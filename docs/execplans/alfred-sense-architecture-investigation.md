# ALFRED Sense Architecture Investigation Report

**Date**: 2025-01-27  
**Investigator**: Architecture exploration agent  
**Status**: Read-only investigation, implementation-ready

## Executive Summary

This report maps integration points and architecture boundaries for implementing ALFRED Sense (Capture Inbox + Working Set + Context Receipts + iOS sensor evidence) while strictly adhering to ALFRED's architecture rules, particularly `.ruler/47-system-architecture.md` and `.ruler/48-pipeline-boundaries.md`.

**Key Finding**: ALFRED already has foundational primitives (context receipts, cache handoff, desktop state management, native voice capture) that can be extended. The Sense system should be implemented as a **dedicated domain package** (`packages/sense`) with clear boundaries to avoid coupling violations.

---

## Findings (by Domain Primitive)

### Capture

**Existing Code Matches:**
- ✅ **Native iOS voice capture**: `apps/native/lib/voice/capture.ts` - `ExpoCapture` class with `start()`/`stop()` methods
- ✅ **Native iOS voice session**: `apps/native/lib/voice/session.ts` - `useVoiceSessionNative` hook with streaming support
- ✅ **Web voice capture**: `apps/web/src/hooks/use-voice-capture.ts` - Web-based capture utilities
- ✅ **Native permissions**: `apps/native/app.json` - Microphone, camera permissions configured
- ✅ **Photo capture infrastructure**: Native app has camera permissions; no explicit photo capture utility found yet

**Gaps:**
- ❌ No unified capture API/router (`capture.create`, `capture.list`)
- ❌ No capture entity schema in DB (`captures` table)
- ❌ No blob storage integration for audio/photo payloads
- ❌ No sensor evidence collection (motion, place, NFC, Bluetooth)
- ❌ No capture-to-inbox routing logic

**Integration Points:**
- `apps/native/lib/voice/capture.ts` → extend for photo capture
- `apps/native/lib/voice/session.ts` → add capture metadata (evidence) collection
- New: `packages/db/src/schema/capture.ts` (schema)
- New: `packages/db/src/repo/capture.ts` (repos)
- New: `packages/api/src/routers/capture.ts` (API)

---

### Bundle

**Existing Code Matches:**
- ✅ **Context bundle type**: `packages/type/src/plan.ts` - `ContextBundle` type with `files`, `estimatedTokens`
- ✅ **Pipeline context stage**: `packages/pipeline/src/stages/context.ts` - `ContextStage` builds bundles with receipts
- ✅ **Transcript/OCR infrastructure**: Voice transcription exists via `packages/api/src/voice/assistant.ts`
- ✅ **Entity extraction**: No explicit entity extraction found, but `@alfred/plan` has intent parsing

**Gaps:**
- ❌ No `Bundle` entity schema (transcript/OCR/entities stored separately)
- ❌ No bundle-to-capture linking
- ❌ No route candidate generation logic
- ❌ No OCR pipeline (photo → text)

**Integration Points:**
- `packages/pipeline/src/stages/context.ts` → extract bundle-building logic for reuse
- New: `packages/sense/src/bundle.ts` - Pure bundle transformation functions
- New: `packages/db/src/schema/bundle.ts` (schema)
- New: `packages/db/src/repo/bundle.ts` (repos)

---

### Receipt

**Existing Code Matches:**
- ✅ **SearchReceipt type**: `packages/type/src/plan.ts` - `SearchReceipt` with `code`, `web`, `created`, `summary`
- ✅ **Context receipts in desktop**: `apps/web/src/store/desktop/context.ts` - `ContextCacheEntry` with `receipt?: SearchReceipt`
- ✅ **Cache handoff events**: `packages/type/src/plan.ts` - `data-cache-handoff` event type with receipts
- ✅ **Receipt recording**: `apps/web/src/store/desktop/context.ts` - `recordContextReceipt()` function
- ✅ **Receipt display**: `apps/web/src/hooks/use-focused-context.ts` - Reads receipts from context cache
- ✅ **Pipeline receipt emission**: `packages/agent/src/orchestrator/flow/context.ts` - `emitCacheHandoffEvent()` emits receipts

**Gaps:**
- ❌ No `Receipt` entity schema (receipts are ephemeral in Zustand, not persisted)
- ❌ No receipt correction API (`receipt.correct`)
- ❌ No receipt-to-capture linking
- ❌ No evidence scoring/weighting logic
- ❌ No receipt learning from corrections

**Integration Points:**
- `packages/type/src/plan.ts` → extend `SearchReceipt` for Sense-specific fields (evidence, corrections)
- `apps/web/src/store/desktop/context.ts` → extend for capture receipts (not just window context)
- New: `packages/db/src/schema/receipt.ts` (schema)
- New: `packages/db/src/repo/receipt.ts` (repos)
- New: `packages/api/src/routers/receipt.ts` (API)

---

### WorkingSet/Focus

**Existing Code Matches:**
- ✅ **Desktop focus state**: `apps/web/src/store/desktop/viewport.new.ts` - `focusedWindowId` state
- ✅ **Desktop pinned apps**: `apps/web/src/store/desktop/types.new.ts` - `pinnedApps: string[]`
- ✅ **Project linking**: `packages/db/src/schema/assistant.ts` - Tasks/notes/events have `projectId` foreign key
- ✅ **Active project context**: `packages/api/src/routers/assistant.ts` - `projectId` parameter in generate calls

**Gaps:**
- ❌ No `WorkingSet` entity schema (no synced "top objects" list)
- ❌ No working set API (`workingset.get`, `workingset.set`, `workingset.propose`)
- ❌ No focus pointer (current active project/conversation/note)
- ❌ No working set-to-routing integration
- ❌ No cross-device sync for working set

**Integration Points:**
- `apps/web/src/store/desktop/types.new.ts` → extend for working set (or move to DB-backed)
- New: `packages/db/src/schema/workingset.ts` (schema)
- New: `packages/db/src/repo/workingset.ts` (repos)
- New: `packages/api/src/routers/workingset.ts` (API)
- New: `apps/web/src/components/apps/inbox/` (Inbox window)
- New: `apps/web/src/components/apps/workingset/` (Working Set panel)

---

## Current Architecture Map (DB → Repo → API → App)

### Database Layer (`packages/db`)

**Existing Schemas:**
- `schema/assistant.ts`: `tasks`, `notes`, `events`, `reminders` (lines 29-85)
- `schema/conversation.ts`: `conversations`, `messages` (lines 6-31)
- `schema/workflow.ts`: `workflowRuns`, `workflowEvents` (lines 30-216)
- `schema/project.ts`: `projects` table (referenced by assistant entities)

**Patterns:**
- UUID primary keys (`uuid().defaultRandom().primaryKey()`)
- User-scoped (`userId: text("user_id").notNull()`)
- Project linking (`projectId: uuid("project_id").references(...)`)
- JSONB metadata (`metadata: jsonb("metadata").$type<Record<string, unknown>>()`)
- Timestamps (`created`, `updated` with `defaultNow()`)

**Missing for Sense:**
- `captures` table
- `bundles` table
- `receipts` table
- `workingset` table
- `capture_evidence` table (sensor data)

---

### Repository Layer (`packages/db/src/repo`)

**Existing Repos:**
- `repo/assistant.ts`: CRUD for tasks, notes, events, reminders
- `repo/workflow.ts`: Workflow run/event persistence
- `repo/graph/write.ts`: Knowledge graph operations

**Patterns:**
- Synchronous helpers for simple queries (`.ruler/45-infrastructure-standardization.md` rule 10)
- User-scoped queries (`eq(tasks.userId, userId)`)
- Type-safe Drizzle queries with inferred types

**Missing for Sense:**
- `repo/capture.ts`
- `repo/bundle.ts`
- `repo/receipt.ts`
- `repo/workingset.ts`

---

### API Layer (`packages/api/src/routers`)

**Existing Routers:**
- `routers/assistant.ts`: `generate`, `escalate` procedures (lines 77-229)
- `routers/workflow.ts`: `start`, `subscribe`, `resume` with `observable()` streaming (lines 131-925)
- `routers/remind.ts`: Reminder CRUD
- `routers/todo.ts`: Todo CRUD

**Patterns:**
- tRPC routers with `authedProcedure`
- Rate limiting (`use(rateLimit)`)
- Policy checks (`use(requirePolicy(...))`)
- Streaming subscriptions (`observable()` from `@trpc/server/observable`)
- Input validation with Zod schemas

**Missing for Sense:**
- `routers/capture.ts`: `create`, `list`, `get`, `triage`
- `routers/receipt.ts`: `correct`, `get`
- `routers/workingset.ts`: `get`, `set`, `propose`
- `routers/inbox.ts`: `list`, `subscribe` (real-time inbox updates)

---

### App Layer (`apps/web`, `apps/native`)

**Web (`apps/web`):**
- **Desktop state**: `src/store/desktop/` - Zustand slices (windows, context, cache, knowledge)
- **Context receipts**: `src/store/desktop/context.ts` - `ContextCacheEntry` with receipts
- **Focus context**: `src/hooks/use-focused-context.ts` - Reads context cache, fetches RAG
- **Window registry**: `src/components/desktop/windows/registry.tsx` - Window type registry
- **Collections**: `src/collections/` - TanStack Query collections for notes, reminders, todos

**Native (`apps/native`):**
- **Voice capture**: `lib/voice/capture.ts` - `ExpoCapture` class
- **Voice session**: `lib/voice/session.ts` - `useVoiceSessionNative` hook
- **Screens**: `app/(drawer)/(tabs)/` - Notes, reminders, todos screens
- **Permissions**: `app.json` - Microphone, camera permissions

**Missing for Sense:**
- `apps/web/src/components/apps/inbox/` - Inbox window component
- `apps/web/src/components/apps/workingset/` - Working Set panel
- `apps/web/src/hooks/use-capture.ts` - Capture subscription hook
- `apps/native/app/(drawer)/(tabs)/capture.tsx` - Capture screen
- `apps/native/lib/sensors/` - Sensor evidence collection

---

## Proposed Sense Architecture Contract

### Responsibility (Single Sentence)

**Sense orchestrates capture-to-execution flows by ingesting iOS sensor-backed captures, generating explainable routing receipts, and syncing a working set of top objects across devices.**

---

### Scope Boundaries

**IN SCOPE:**
- Capture ingestion (voice/photo/text) with sensor evidence
- Bundle generation (transcript/OCR/entities) and route candidate scoring
- Receipt generation (explainable routing decisions) and correction learning
- Working Set management (synced top objects) and focus pointer
- Inbox triage UI (desktop) and capture entrypoints (iOS)
- Cross-device sync (capture → inbox, working set updates)

**OUT OF SCOPE:**
- Full desktop layout sync (window geometry, z-index) - belongs to desktop store
- Agent execution details (codex, opencode) - belongs to `@alfred/agent`
- Workflow orchestration - belongs to `@alfred/pipeline`
- Knowledge graph operations - belongs to `@alfred/knowledge`
- Conversation persistence - belongs to `@alfred/db/repo/conversation`
- Raw sensor streams (only event-based evidence labels)

---

### State Model + Storage Ownership

**Persistent State (DB):**
- `captures` table: Immutable capture records with payload refs, evidence, status
- `bundles` table: Transcript/OCR/entities linked to captures
- `receipts` table: Routing decisions with evidence, corrections, learning signals
- `workingset` table: Synced top objects (project/conversation/note IDs) with focus pointer

**Ephemeral State (Zustand/React):**
- Desktop Inbox UI state (filter, sort, selection) - `apps/web/src/store/desktop/inbox.ts`
- Working Set UI state (pinned items, focus indicator) - `apps/web/src/store/desktop/workingset.ts`
- Native capture UI state (recording, photo preview) - `apps/native/lib/capture/state.ts`

**Boundary Rule**: Zustand stores UI state only; DB is source of truth for captures/bundles/receipts/working set.

---

### Extension Model

**Events/Observers (Not Callbacks):**

Sense emits events via pipeline-style observers:
- `capture:created` - New capture ingested
- `bundle:generated` - Bundle created from capture
- `receipt:generated` - Receipt created with routing decision
- `receipt:corrected` - User corrected a receipt
- `workingset:updated` - Working set changed

**Observer Pattern:**
- `packages/sense/src/observers/persistence.ts` - Persists captures/bundles/receipts to DB
- `packages/sense/src/observers/inbox.ts` - Emits inbox update events for UI subscriptions
- `packages/sense/src/observers/learning.ts` - Learns from receipt corrections

**No Callbacks**: Sense domain functions return data; observers handle side effects (persistence, UI updates, learning).

---

### APIs Crossing Boundaries

**Domain Package (`packages/sense`):**
- `sense/capture.ts`: `createCapture()`, `ingestEvidence()`, `getCapture()`
- `sense/bundle.ts`: `generateBundle()`, `extractEntities()`, `scoreRoutes()`
- `sense/receipt.ts`: `generateReceipt()`, `correctReceipt()`, `learnFromCorrection()`
- `sense/workingset.ts`: `getWorkingSet()`, `updateWorkingSet()`, `proposeItems()`

**API Routers (`packages/api/src/routers`):**
- `capture.create`: Validates input, calls `sense/capture.createCapture()`, persists via observer
- `capture.list`: Queries DB via repo, returns captures
- `capture.triage`: Validates conversion, calls `sense/bundle.scoreRoutes()`, creates note/task/reminder
- `receipt.correct`: Validates correction, calls `sense/receipt.correctReceipt()`, triggers learning observer
- `workingset.get`: Queries DB via repo, returns working set
- `workingset.set`: Validates input, calls `sense/workingset.updateWorkingSet()`, persists via observer
- `inbox.subscribe`: tRPC `observable()` stream of inbox updates (new captures, bundle updates)

**Boundary Enforcement:**
- Routers never call DB repos directly; they call Sense domain functions
- Sense domain functions never import `@alfred/db`; they return data, observers persist
- Observers import `@alfred/db` and handle persistence
- Apps never import `@alfred/db`; they use tRPC routers only

---

### Why This Follows `.ruler/47-system-architecture.md`

1. **Single-sentence responsibility**: Sense orchestrates capture-to-execution flows (no "and").
2. **Explicit boundaries**: DB → repo → API → app layering; Sense domain package owns pure transformations.
3. **Extension model**: Events/observers, not callbacks (rule 16).
4. **State management**: Explicit types, observable transitions (rules 13-15).
5. **No god objects**: Capture/Bundle/Receipt/WorkingSet are separate domains.
6. **One-hop rule**: Routers call Sense domain; Sense domain returns data; observers persist (rule 6).

---

## Integration Touch Points (File List)

### Database Layer (`packages/db`)

**New Files:**
- `src/schema/capture.ts` - `captures` table schema
  - Fields: `id`, `userId`, `sourceDevice`, `payloadType`, `payloadRef`, `status`, `evidence` (JSONB), `created`, `updated`
  - Indexes: `captures_user_status_idx`, `captures_user_created_idx`
- `src/schema/bundle.ts` - `bundles` table schema
  - Fields: `id`, `captureId` (FK), `transcript`, `ocrText`, `entities` (JSONB), `routeCandidates` (JSONB), `created`
  - Index: `bundles_capture_id_idx`
- `src/schema/receipt.ts` - `receipts` table schema
  - Fields: `id`, `captureId` (FK), `bundleId` (FK), `decisionType`, `evidence` (JSONB), `outcome` (JSONB), `confidence`, `corrections` (JSONB), `created`, `updated`
  - Indexes: `receipts_capture_id_idx`, `receipts_decision_type_idx`
- `src/schema/workingset.ts` - `workingset` table schema
  - Fields: `id`, `userId`, `items` (JSONB array of object refs), `focusPointer` (JSONB), `updated`
  - Index: `workingset_user_id_idx` (unique)

**New Repos:**
- `src/repo/capture.ts` - `createCapture()`, `getCapture()`, `listCaptures()`, `updateCaptureStatus()`
- `src/repo/bundle.ts` - `createBundle()`, `getBundleByCaptureId()`, `updateBundle()`
- `src/repo/receipt.ts` - `createReceipt()`, `getReceiptByCaptureId()`, `updateReceipt()`, `getCorrections()`
- `src/repo/workingset.ts` - `getWorkingSet()`, `updateWorkingSet()`, `setFocusPointer()`

**Migration:**
- `src/migrations/NNNN_capture.sql` - Create capture/bundle/receipt/workingset tables

---

### Domain Package (`packages/sense`) - **NEW PACKAGE**

**Why New Package:**
- Sense exceeds 500 LOC and spans 3+ files (requires architecture contract per `.ruler/47-system-architecture.md`)
- Sense has distinct responsibility (capture-to-execution flows) separate from existing packages
- Sense needs pure transformation functions (bundle generation, receipt scoring) that are import-safe

**Structure:**
```
packages/sense/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Barrel exports
│   ├── capture.ts                  # createCapture(), ingestEvidence()
│   ├── bundle.ts                   # generateBundle(), extractEntities(), scoreRoutes()
│   ├── receipt.ts                  # generateReceipt(), correctReceipt(), learnFromCorrection()
│   ├── workingset.ts               # getWorkingSet(), updateWorkingSet(), proposeItems()
│   ├── types.ts                    # Sense-specific types (Capture, Bundle, Receipt, WorkingSet)
│   ├── observers/
│   │   ├── persistence.ts          # Persists captures/bundles/receipts to DB
│   │   ├── inbox.ts                # Emits inbox update events
│   │   └── learning.ts             # Learns from receipt corrections
│   └── __tests__/
│       ├── capture.test.ts
│       ├── bundle.test.ts
│       ├── receipt.test.ts
│       └── workingset.test.ts
```

**Key Functions:**
- `capture.ts`: `createCapture(payload, evidence) => Capture`, `ingestEvidence(captureId, evidence) => void`
- `bundle.ts`: `generateBundle(captureId, payload) => Bundle`, `extractEntities(text) => Entity[]`, `scoreRoutes(bundle, workingSet) => RouteCandidate[]`
- `receipt.ts`: `generateReceipt(bundleId, routeCandidates) => Receipt`, `correctReceipt(receiptId, correction) => void`, `learnFromCorrection(correction) => void`
- `workingset.ts`: `getWorkingSet(userId) => WorkingSet`, `updateWorkingSet(userId, items) => void`, `proposeItems(userId, candidates) => Proposal[]`

**Boundary Rules:**
- No imports from `@alfred/db` (pure functions only)
- No imports from `@alfred/api` (domain logic only)
- No imports from `apps/*` (package-level only)
- Observers import `@alfred/db` and handle persistence

---

### API Layer (`packages/api`)

**New Routers:**
- `src/routers/capture.ts` - `create`, `list`, `get`, `triage` procedures
  - `create`: Accepts payload (base64 audio/photo or text), evidence (JSONB), calls `sense/capture.createCapture()`
  - `list`: Queries `repo/capture.listCaptures()`, filters by status, returns captures
  - `get`: Queries `repo/capture.getCapture()`, returns capture with bundle/receipt
  - `triage`: Accepts captureId, destination (note/task/reminder), calls `sense/bundle.scoreRoutes()`, creates entity
- `src/routers/receipt.ts` - `get`, `correct` procedures
  - `get`: Queries `repo/receipt.getReceiptByCaptureId()`, returns receipt
  - `correct`: Accepts receiptId, correction (JSONB), calls `sense/receipt.correctReceipt()`, triggers learning observer
- `src/routers/workingset.ts` - `get`, `set`, `propose` procedures
  - `get`: Queries `repo/workingset.getWorkingSet()`, returns working set
  - `set`: Accepts items (JSONB array), calls `sense/workingset.updateWorkingSet()`, persists via observer
  - `propose`: Accepts candidates, calls `sense/workingset.proposeItems()`, returns proposals with receipts
- `src/routers/inbox.ts` - `list`, `subscribe` procedures
  - `list`: Queries `repo/capture.listCaptures()` with status filter, returns inbox items
  - `subscribe`: tRPC `observable()` stream of inbox updates (new captures, bundle updates, receipt updates)

**Router Registration:**
- `src/routers/index.ts` - Add `capture`, `receipt`, `workingset`, `inbox` routers to main router

---

### Web App (`apps/web`)

**New Components:**
- `src/components/apps/inbox/index.tsx` - Inbox window component
  - Lists captures with status (new/triaged/converted)
  - Shows bundle (transcript/OCR), receipt (routing explanation), one-tap conversions
  - Uses `trpc.capture.list.useQuery()`, `trpc.inbox.subscribe.useSubscription()`
- `src/components/apps/inbox/capture-item.tsx` - Individual capture item
  - Displays payload preview, bundle text, receipt explanation, conversion buttons
- `src/components/apps/inbox/receipt-panel.tsx` - Receipt display and correction UI
  - Shows evidence list, confidence, alternatives, correction affordance
- `src/components/apps/workingset/index.tsx` - Working Set panel component
  - Shows pinned items (project/conversation/note), focus pointer, quick spawn
  - Uses `trpc.workingset.get.useQuery()`, `trpc.workingset.set.useMutation()`
- `src/components/apps/workingset/item.tsx` - Working Set item component
  - Displays item preview, pin/unpin, focus indicator

**New Hooks:**
- `src/hooks/use-capture.ts` - Capture subscription hook
  - Wraps `trpc.inbox.subscribe.useSubscription()`, returns capture updates
- `src/hooks/use-workingset.ts` - Working Set hook
  - Wraps `trpc.workingset.get.useQuery()`, `trpc.workingset.set.useMutation()`

**Store Extensions:**
- `src/store/desktop/inbox.ts` - Inbox UI state slice (filter, sort, selection)
- `src/store/desktop/workingset.ts` - Working Set UI state slice (pinned items, focus indicator)

**Window Registry:**
- `src/components/desktop/windows/registry.tsx` - Add `inbox` and `workingset` window types

---

### Native App (`apps/native`)

**New Screens:**
- `app/(drawer)/(tabs)/capture.tsx` - Capture screen
  - Voice/photo/text capture buttons, evidence toggle, send button
  - Uses `ExpoCapture` from `lib/voice/capture.ts`, extends for photo capture
- `app/(drawer)/(tabs)/inbox.tsx` - Inbox screen (optional, MVP may skip)
  - Lists captures, shows status, allows triage

**New Libraries:**
- `lib/capture/photo.ts` - Photo capture utility (extends `ExpoCapture` pattern)
  - `ExpoPhotoCapture` class with `capturePhoto()`, `captureMultiple()` methods
- `lib/sensors/evidence.ts` - Sensor evidence collection
  - `collectEvidence()` - Gathers motion state, place identity, device hints
  - `collectPlaceEvidence()` - Wi‑Fi fingerprint → place label
  - `collectMotionEvidence()` - Gyro/accelerometer → motion state
  - `collectDeviceEvidence()` - Bluetooth → device hints
- `lib/sensors/nfc.ts` - NFC tag reading (v1)
  - `readNFCTag()` - Reads NFC tag, returns tag ID and label

**Hooks:**
- `hooks/use-capture.ts` - Capture hook for native
  - Wraps `ExpoCapture`, `ExpoPhotoCapture`, `collectEvidence()`, calls `trpc.capture.create.mutate()`

**Permissions:**
- `app.json` - Add NFC, Bluetooth, location permissions (opt-in)

---

## Recommended Minimal MVP Wiring

### Phase 1: Capture → Inbox (Core Loop)

**Goal**: Prove capture-to-inbox flow works end-to-end.

**Implementation Order:**
1. **DB Schema** (`packages/db`):
   - Create `captures` table (minimal: id, userId, payloadType, payloadRef, status, created)
   - Create `bundles` table (minimal: id, captureId, transcript, created)
   - Migration: `NNNN_capture_mvp.sql`

2. **Domain Package** (`packages/sense`):
   - `src/capture.ts`: `createCapture()` - Creates capture record (no evidence yet)
   - `src/bundle.ts`: `generateBundle()` - Generates transcript from audio (or OCR from photo)
   - Observer: `src/observers/persistence.ts` - Persists captures/bundles to DB

3. **API Router** (`packages/api`):
   - `src/routers/capture.ts`: `create` - Accepts payload, calls `sense/capture.createCapture()`
   - `src/routers/inbox.ts`: `list` - Queries `repo/capture.listCaptures()` with status filter

4. **Web App** (`apps/web`):
   - `src/components/apps/inbox/index.tsx` - Simple list of captures
   - `src/components/apps/inbox/capture-item.tsx` - Shows capture payload, bundle transcript
   - Window registry: Add `inbox` window type

5. **Native App** (`apps/native`):
   - `app/(drawer)/(tabs)/capture.tsx` - Voice capture button, calls `trpc.capture.create.mutate()`
   - `hooks/use-capture.ts` - Wraps `ExpoCapture`, uploads audio, calls API

**Test**: Voice capture on iOS → appears in desktop Inbox within 10 seconds.

---

### Phase 2: Receipt + Conversion

**Goal**: Add routing receipts and one-tap conversions.

**Implementation Order:**
1. **DB Schema** (`packages/db`):
   - Create `receipts` table (minimal: id, captureId, decisionType, outcome, confidence, created)
   - Migration: `NNNN_receipt_mvp.sql`

2. **Domain Package** (`packages/sense`):
   - `src/bundle.ts`: `scoreRoutes()` - Scores route candidates (note/task/reminder) based on bundle text
   - `src/receipt.ts`: `generateReceipt()` - Generates receipt with routing decision
   - Observer: `src/observers/persistence.ts` - Persists receipts to DB

3. **API Router** (`packages/api`):
   - `src/routers/capture.ts`: `triage` - Accepts captureId, destination, creates note/task/reminder
   - `src/routers/receipt.ts`: `get` - Returns receipt for capture

4. **Web App** (`apps/web`):
   - `src/components/apps/inbox/receipt-panel.tsx` - Shows receipt explanation
   - `src/components/apps/inbox/capture-item.tsx` - Add conversion buttons (note/task/reminder)

**Test**: Capture → receipt shows "Suggested Note because keywords X, Y" → one-tap conversion works.

---

### Phase 3: Working Set + Routing

**Goal**: Use working set to improve routing accuracy.

**Implementation Order:**
1. **DB Schema** (`packages/db`):
   - Create `workingset` table (minimal: id, userId, items, updated)
   - Migration: `NNNN_workingset_mvp.sql`

2. **Domain Package** (`packages/sense`):
   - `src/workingset.ts`: `getWorkingSet()`, `updateWorkingSet()` - Working set CRUD
   - `src/bundle.ts`: `scoreRoutes()` - Uses working set to boost route candidates

3. **API Router** (`packages/api`):
   - `src/routers/workingset.ts`: `get`, `set` - Working set CRUD

4. **Web App** (`apps/web`):
   - `src/components/apps/workingset/index.tsx` - Working Set panel with pinned items
   - `src/components/apps/inbox/capture-item.tsx` - Uses working set in routing (via API)

**Test**: Pin project X → capture mentions project X → routes to project X with receipt explanation.

---

### Phase 4: Receipt Correction + Learning

**Goal**: Allow users to correct receipts and learn from corrections.

**Implementation Order:**
1. **Domain Package** (`packages/sense`):
   - `src/receipt.ts`: `correctReceipt()` - Records correction
   - `src/receipt.ts`: `learnFromCorrection()` - Learns patterns from corrections
   - Observer: `src/observers/learning.ts` - Applies learning to future routing

2. **API Router** (`packages/api`):
   - `src/routers/receipt.ts`: `correct` - Accepts receiptId, correction, calls `sense/receipt.correctReceipt()`

3. **Web App** (`apps/web`):
   - `src/components/apps/inbox/receipt-panel.tsx` - Add correction UI (dropdown to select different project/note)

**Test**: Correct receipt → future similar captures route correctly with receipt referencing learned pattern.

---

## Risks + Tests

### Risks

1. **Import Boundary Violations**
   - **Risk**: Sense domain package imports `@alfred/db` directly
   - **Mitigation**: Enforce pure functions in `packages/sense/src/*.ts`; only observers import DB
   - **Test**: `packages/sense/src/*.ts` files must not import `@alfred/db` (grep check)

2. **God Module Growth**
   - **Risk**: `packages/sense/src/capture.ts` accumulates bundle/receipt logic
   - **Mitigation**: Enforce single-sentence responsibility per file; extract when >200 lines
   - **Test**: File size check (<200 lines per domain file)

3. **Data Model Pitfalls**
   - **Risk**: Blob storage refs break (payloadRef points to non-existent blob)
   - **Mitigation**: Validate blob existence before creating capture; handle missing blobs gracefully
   - **Test**: Integration test: create capture with invalid payloadRef → returns error

4. **Privacy Toggles**
   - **Risk**: Sensor evidence collected without user consent
   - **Mitigation**: Explicit permission checks in native app; evidence collection gated behind toggles
   - **Test**: E2E test: disable sensor permissions → capture still works without evidence

5. **Receipt Learning Overfitting**
   - **Risk**: Learning from corrections causes routing to overfit to user's past corrections
   - **Mitigation**: Limit learning signal weight; require multiple corrections before applying pattern
   - **Test**: Unit test: single correction → routing unchanged; 3+ corrections → routing updated

6. **Working Set Sync Conflicts**
   - **Risk**: Desktop and iOS update working set simultaneously → conflicts
   - **Mitigation**: Last-write-wins with timestamp; or use CRDT for working set items
   - **Test**: Integration test: concurrent updates → one wins, no data loss

7. **Inbox Subscription Performance**
   - **Risk**: `inbox.subscribe` emits too many events → UI lag
   - **Mitigation**: Debounce events; batch updates; limit subscription to last 50 captures
   - **Test**: Performance test: 100 captures → subscription handles without lag

---

### Test Coverage Requirements

**Unit Tests (`packages/sense/src/__tests__`):**
- `capture.test.ts`: `createCapture()` creates capture with payload ref, `ingestEvidence()` adds evidence
- `bundle.test.ts`: `generateBundle()` creates bundle from capture, `scoreRoutes()` returns candidates sorted by confidence
- `receipt.test.ts`: `generateReceipt()` creates receipt with evidence, `correctReceipt()` records correction, `learnFromCorrection()` updates patterns
- `workingset.test.ts`: `getWorkingSet()` returns working set, `updateWorkingSet()` updates items, `proposeItems()` returns proposals

**Integration Tests (`packages/api/test`):**
- `capture.router.test.ts`: `capture.create` creates capture, `capture.list` returns captures, `capture.triage` creates note/task/reminder
- `receipt.router.test.ts`: `receipt.get` returns receipt, `receipt.correct` records correction
- `workingset.router.test.ts`: `workingset.get` returns working set, `workingset.set` updates working set
- `inbox.router.test.ts`: `inbox.subscribe` emits capture updates

**E2E Tests (`apps/web/.tests`, `apps/native/e2e`):**
- `capture-to-inbox.e2e.spec.ts`: Voice capture on iOS → appears in desktop Inbox
- `receipt-correction.e2e.spec.ts`: Correct receipt → future routing uses correction
- `workingset-sync.e2e.spec.ts`: Update working set on desktop → syncs to iOS

**Boundary Tests (`packages/sense/test`):**
- `boundaries.test.ts`: Sense domain functions don't import `@alfred/db`, `@alfred/api`, `apps/*`
- `observers.test.ts`: Observers import `@alfred/db` and persist correctly

---

## Conclusion

ALFRED Sense can be implemented as a **dedicated domain package** (`packages/sense`) with clear boundaries:
- **DB layer**: New schemas/repos for captures, bundles, receipts, working set
- **Domain layer**: Pure transformation functions in `packages/sense`
- **API layer**: Thin routers that call domain functions and persist via observers
- **App layer**: Inbox/Working Set UI components and native capture screens

The architecture follows `.ruler/47-system-architecture.md` (single responsibility, explicit boundaries, events/observers) and `.ruler/48-pipeline-boundaries.md` (domain logic in packages, persistence via observers).

**Next Steps:**
1. Create architecture contract document (this report)
2. Implement Phase 1 MVP (Capture → Inbox)
3. Add tests (unit, integration, E2E, boundary)
4. Iterate on Phases 2-4 based on user feedback
