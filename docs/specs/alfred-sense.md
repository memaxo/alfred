# alfred-sense

Owner: product, apps (web/native), runtime

ALFRED Sense is a core ALFRED feature that turns iPhone into the primary **capture device** and the desktop/web app into the primary **execution surface**, using sensor-backed context to reduce friction, improve routing, and produce explainable “context receipts”.

## Summary

- **One-line**: Capture anything on iOS → it arrives on desktop as an actionable, context-linked item with an explanation of “why”.
- **Core primitives**: `Capture` → `Bundle` → `Receipt` → routed into Inbox / Note / Reminder / Task / Link.
- **Core surfaces**:
  - **iOS**: fastest capture + optional “context evidence” (privacy-gated).
  - **Desktop/Web**: triage, edit, execute, and correct receipts.

## MVP constraints (current implementation)

- **Derived-only media**: server persists derived text (transcript / typed text) plus minimal metadata; raw audio/photo payloads are not stored server-side.
- **Photo/OCR deferred**: `photo` capture is not implemented yet; API returns `photo_capture_not_supported_yet`.
- **Inbox subscription is in-memory**: `inbox.subscribe` is an in-process pubsub (single-instance, non-resumable) until a durable stream is added.

## Scope (clarity)

- **Targets ALFRED itself**: `apps/web`, `apps/native`, `packages/api`, `packages/db`, `packages/runtime`, `packages/history`, `packages/knowledge`.
- **Does NOT target apps ALFRED generates for end users**.

## Problem

- Capture happens in the world (walking, meetings, errands), but execution happens at the desk.
- Current flows force the user to retype/remember context later (“what did I mean?”).
- Sync today mostly means “history exists”, not “attention continues”:
  - The desktop has rich execution UI, but iOS capture is not a first-class input channel.
  - ALFRED can retrieve context, but it cannot reliably explain and accept corrections at the moment of capture.

## Vision / North Star

- **North Star**: In <10 seconds, the user can capture something on phone and see it as a ready-to-execute item on desktop with correct routing and a clear explanation.
- **Design stance**: Sync **attention** and **objects**, not pixels or ephemeral UI state.

## Target user

- Single-user ALFRED operator with multiple devices (desktop + iPhone).
- Work involves projects, writing, coding, planning, and frequent context-switching.

## Core product pillars

### 1) Capture Inbox (phone → desktop execution)

- A unified Inbox where every capture becomes a triageable item with:
  - a payload (voice/text/photo)
  - a structured interpretation (transcript/OCR/entities)
  - suggested routing and next actions
  - receipts explaining evidence and links

### 2) Working Set (top 5 across devices)

- A small, synced “what matters now” list that:
  - drives routing decisions for new captures
  - provides continuity without syncing full desktop layout

### 3) Context Receipts (trust + steering)

- Every non-trivial suggestion must be explainable:
  - “Linked to Project X because …”
  - “Suggested Reminder at 5pm because …”
- The user can approve/deny/correct receipts; ALFRED learns patterns.

## Goals

- **G1: Instant capture-to-execution**: voice/photo/text capture on iOS appears on desktop within seconds.
- **G2: High-quality routing**: most captures auto-route to the correct destination (Inbox → note/reminder/task) with minimal edits.
- **G3: Explainability**: every link/routing decision has a receipt that is understandable and correctable.
- **G4: Minimal cognitive overhead**: the user rarely needs to “remember later what this meant”.
- **G5: Privacy by design**: sensors are used as optional, minimal evidence; no continuous surveillance.

## Non-goals (for v1)

- Syncing the full desktop layout (window geometry, z-index, focus, selection) across devices.
- Collaborative multi-user sessions.
- Persisting and resuming raw streaming transports as a primary feature.
- Continuous ambient recording; “always-on” sensors without explicit user intent.

## Product requirements

### iOS capture (primary input)

- **Capture entrypoints**:
  - quick action / widget / lock screen shortcut (“Capture”)
  - in-app “Capture” button
  - optional NFC taps (“desk”, “fridge”, “car” tags)
- **Capture types (MVP)**:
  - voice note (audio + transcript)
  - photo capture (single/multi) + OCR (deferred)
  - short text capture
- **Capture metadata (MVP, privacy-gated)**:
  - timestamp (always)
  - coarse place identity (opt-in; prefer Wi‑Fi fingerprint label like “home/office” over precise GPS)
  - motion state (walking/driving/still) derived from sensors (on-device)
  - nearby device hints (opt-in Bluetooth: “connected to car”, “headphones”)

### Desktop/web Inbox (primary execution)

- **Inbox window** shows:
  - newest captures, status (new/triaged/converted), confidence indicators
  - suggested destination + suggested next action
  - receipt explanation with “approve/deny/correct”
- **One-tap conversions**:
  - capture → note
  - capture → reminder (time suggestion)
  - capture → task/todo (project assignment)
  - capture → bookmark/link (if OCR/url)
- **Edit loop**:
  - edit transcript/OCR text
  - adjust destination
  - “re-run routing” with updated text

### Working Set

- **Working Set surfaces**:
  - desktop: pinned strip + quick spawn
  - iOS: glanceable list + “set as active”
- **Working Set composition**:
  - active project
  - active conversation/thread
  - 1–2 notes/docs
  - next tasks/reminders
- **Update model**:
  - manual pinning (MVP)
  - assistant proposals (v1) with receipts (“why this should be in working set”)

### Context receipts (universal)

- **Receipt contents**:
  - decision type: route / link / schedule / suggest
  - evidence list (signals and their weights; human-readable)
  - chosen outcome (destination + links)
  - confidence and alternatives
  - correction affordance: “This is actually for …”
- **Receipt UX**:
  - always visible when an auto-link occurs
  - fast corrections (single tap: choose different project/note)

## Sensor leverage model (end goal)

Sensors are inputs to **evidence**, not raw synced streams.

### Supported sensors and intended value

- **Microphone**: rapid capture; optional meeting-mode extraction (explicit start/stop).
- **Camera**: OCR; whiteboards → action items; receipts → expenses; “thing I’m looking at” → link suggestions.
- **Gyro/accelerometer**: motion state (driving/walking/still) to adjust UX and defer heavy steps.
- **Wi‑Fi**: place identity (home/office/client site) without precise location.
- **Bluetooth**:
  - proximity/connection to car/headphones/laptop for context
  - optional “device anchors” for routing (e.g., car → commute reminders)
- **NFC**:
  - physical anchors: desk tag = work mode; fridge tag = groceries; notebook tag = project X
  - tap-to-open: open project/note/workflow on desktop and set Working Set focus
- **Location (coarse-first)**: only when needed; never required for MVP.
- **(Later) UWB / ambient light**: polish, not core value.

### Guardrails (privacy + product)

- No continuous collection by default.
- All sensor evidence is:
  - **event-based** (created at capture time or explicit mode)
  - **minimal** (labels, not raw streams)
  - **explainable** (appears in receipts)

## Data model (product primitives)

### `Capture` (immutable record)

- **Fields**:
  - `id`, `createdAt`, `sourceDevice`, `payloadType` (voice/photo/text)
  - `payloadRef` (blob storage reference; deferred) and derived text refs
  - `status`: new → triaged → converted → archived
  - `evidence`: small set of sensor-derived facts (labels)

### `Bundle` (interpretation)

- transcript/OCR
- entity extraction (people, projects, dates, places, URLs)
- candidate routes + confidence

### `Receipt` (explainable decision)

- decision + evidence + outcome + alternatives + corrections

### `WorkingSet` / `Focus`

- explicit list of top objects + current focus pointer used to route new captures

## Key user flows

### Flow A: voice capture → task

- iOS: tap Capture → speak → optional “tag” (work/home) → send
- Desktop: Inbox item appears with:
  - transcript
  - suggestion: “Task in Project X, due tomorrow”
  - receipt: “Project X because last active + keywords; tomorrow because parsed date”
- User: one-tap “Create task” or correct project → ALFRED learns

### Flow B: photo capture (whiteboard) → notes + tasks

- iOS: capture photo(s) → send
- Desktop: OCR text + detected action lines (“TODO”, checkboxes) → split suggestions
- User: approve split → note created + tasks created with links back to source capture

### Flow C: NFC tap (desk tag) → set focus + quick capture

- iOS: tap desk tag → focus becomes “Work” (Project X) + optional quick capture prompt
- Desktop: Working Set updates + optionally opens the target project/note window

### Flow D: correct receipt → improved future routing

- Desktop: user marks “Wrong project” and selects correct one
- ALFRED records correction signal (place tag + keywords + chosen project)
- Future: similar capture routes correctly with a receipt referencing the learned pattern

## UX requirements

- **Latency**: capture should appear on desktop in seconds (best effort).
- **Low-friction**: minimal taps on phone; triage optimized for keyboard on desktop.
- **Degradation**:
  - if sensors unavailable → still capture payload and route with lower confidence
  - if offline on phone → queue capture and send when online

## Privacy, security, and trust

- **Permissions**: explicit, incremental asks (mic, camera, location, bluetooth, NFC).
- **User controls**:
  - per-sensor toggles
  - “include context evidence” toggle per capture
  - retention controls (auto-delete raw audio/photos after N days, keep derived text)
- **Redaction**:
  - sensitive data detection in transcripts/OCR (basic pass in MVP; expand later)
- **Receipts as trust contract**:
  - the user can always see why ALFRED used a signal
  - the user can revoke/disable a signal category

## Architecture / sync strategy (implementation-facing)

- **Authoritative store**: server-side DB for `Capture/Bundle/Receipt/WorkingSet`.
- **Client state**:
  - Zustand remains for ephemeral UI; it should read from synced objects, not be the sync source.
- **Transport**:
  - normal request/response + subscriptions for inbox updates
  - no requirement for mid-stream resumable transport in MVP
- **APIs (conceptual)**:
  - `capture.create` (upload + metadata)
  - `inbox.list` / `inbox.subscribe`
  - `capture.triage` (convert to note/task/reminder)
  - `receipt.correct`
  - `workingset.get` / `workingset.set` / `workingset.propose`

## Success metrics

- **Time-to-appearance**: p95 capture appears on desktop in <10s (online case).
- **Triage efficiency**: median “capture → done (converted)” <30s on desktop.
- **Routing accuracy**: % captures converted without changing suggested destination.
- **Receipt correction rate**: % suggestions corrected (target decreasing over time).
- **Adoption**: daily captures per active user; weekly retention of capture usage.

## Milestones

### MVP (ship the loop)

- iOS: capture voice/photo/text + send
- Desktop: Inbox window + conversions (note/task/reminder)
- Receipts: basic explanation + correction UI
- Working Set: manual pin + used for routing suggestions

### v1 (make it feel magical)

- NFC anchors (desk/fridge/car) + focus routing
- place identity via Wi‑Fi labels
- better extraction (dates, people, URLs) + stronger receipts
- offline queue for iOS captures

### v2 (sensor depth, not breadth)

- meeting mode (explicit) with action-item extraction
- bluetooth proximity-based suggestions (“car mode”, “headphones mode”)
- richer learning from corrections; personalization of routing

## Risks / failure modes

- **Creepiness risk**: over-collecting sensors harms trust.
  - Mitigation: event-based evidence only; receipts always show signals; easy toggles.
- **Wrong routing fatigue**: too many suggestions reduces value.
  - Mitigation: confidence thresholds; default to Inbox when uncertain; quick correction.
- **Latency**: mobile upload/transcription/OCR slow.
  - Mitigation: progressive updates (capture arrives immediately; bundle/receipt later).
- **Schema sprawl**: too many primitives early.
  - Mitigation: keep primitives minimal and stable (`Capture/Bundle/Receipt/WorkingSet/Focus`).

## Open questions

- What is the canonical destination model: notes/reminders/todos vs a unified “task” type?
- Where should raw media live (DB vs object storage) and what are default retention rules?
- Which signals are allowed in MVP receipts (start conservative: timestamp + manual tags + Working Set)?
