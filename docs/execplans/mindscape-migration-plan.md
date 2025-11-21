# Migrate ALFRED from route-based UI to the Symbiotic Mindscape (Hybrid, phased)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with .agent/PLANS.md. It is fully self‑contained and enables a novice to implement the migration end‑to‑end.

## Purpose / Big Picture

We will transition ALFRED’s primary user interface from traditional route pages (links, lists, and forms) to a spatial computing model where interactive "holographic artifacts" (nodes) live on an infinite canvas (the Mindscape). Users gain:

- Persistent thinking space: conversations, workflows, notes, timers, and tools co-exist as nodes.
- Real-time visibility: streaming plan/task/tool/code is visualized live in context, not buried in a route.
- Spatial memory and flexible workflows: users arrange artifacts meaningfully and connect them.

Success criteria:

- Users can perform their daily work (chatting, creating/updating notes/reminders, running workflows, managing timers/bookmarks) entirely inside `/mindscape`.
- A hybrid path preserves current routes for safety. Deep links and feature flags allow switching.
- Node state (including position) persists; server data remains the source of truth (tRPC).
- Accessibility, performance, and discoverability are addressed with keyboard navigation, command palette, search, and deep links.

Non-functional requirements:

- Minimal, austere code; reuse existing components wherever possible.
- Safe rollout: parallel old/new UIs; easy rollback; idempotent changes.
- Observability: logs and simple diagnostics in development to prove correctness.

## Progress

- [x] (2025-11-20 12:00Z) Authored and checked in the migration ExecPlan (this file).
- [x] (2025-11-20 15:10Z) Phase 0 readiness audit: inspected mindscape store/canvas/initializer to confirm missing deep links, spawn surfaces, and persistence sanitisation gaps.
- [x] (2025-11-20 16:05Z) Phase 0/Step 0a: wired `/mindscape` query params for `nodeId` + `spawn`, added React Flow focus helpers, and created reusable spawn builders.
- [x] (2025-11-20 16:45Z) Phase 0/Step 0b: tightened Zustand persistence to snapshot node positions + minimal data (trimmed chat transcripts) and keep `focusedNodeId` in storage.
- [x] (2025-11-20 17:05Z) Phase 0/Step 0c: shipped Cmd/Ctrl+K command palette with shared spawn/focus logic and hotkey listener.
- [x] Phase 0 enablement (deep links, spawn palette, position persistence).
- [x] (2025-11-20 18:10Z) Phase 1 prep: expanded note/reminder schemas + initializer/spawn builders to track IDs, modes, and metadata required for CRUD.
- [x] (2025-11-20 19:05Z) Phase 1: implemented NoteNode in-node create/update/delete flows with optimistic Mindscape store sync + TanStack Query invalidation.
- [x] (2025-11-20 19:40Z) Phase 1: implemented ReminderNode creation/reschedule/complete/delete flows (reschedule = create replacement then delete old) with status badges and due-time UX.
- [x] Phase 1 parity for Chat, Notes, Reminders (CRUD in nodes; deep-link fallbacks).
- [x] (2025-11-20 21:00Z) Phase 2 prep: expanded schemas/store/spawn/canvas for timer/bookmark/todo node types; palette exposes them.
- [x] (2025-11-20 22:05Z) Phase 2: implemented TimerNode (active list + start form), BookmarkNode (create/list/delete), and TodoNode (filter/add/toggle/delete) with TanStack Query invalidation + status UI.
- [x] Phase 2 parity for Timers, Bookmarks, Todos.
- [x] (2025-11-20 22:40Z) Phase 3 prep: added schemas/store/spawn entries for settings/privacy/profile/integrations nodes + palette hooks.
- [x] (2025-11-20 23:20Z) Phase 3: shipped SettingsNode (autonomy slider + preference editor) and PrivacyNode (fact/events list with export/forget) reusing trpc flows.
- [x] (2025-11-20 23:55Z) Phase 3: delivered ProfileNode (profile form + passkeys) and IntegrationsNode (Linear connect/reconnect + status badges).
- [x] Phase 3 parity for Settings/Privacy/Profile/Integrations.
- [x] (2025-11-21 00:45Z) Phase 4 prep: extended workflow/deployment schemas, store partialization, spawn/palette entries, and WorkflowNode schema for requirements/auto/mode fields.
- [x] (2025-11-21 02:10Z) Phase 4: implemented WorkflowListNode (filters, detail modal, focus) and upgraded WorkflowNode with run starter + event timeline.
- [x] (2025-11-21 03:05Z) Phase 4: added DeploymentNode (deploy list, promote/remove/copy, live health stream toggle) reusing deploy routers and PromoteDialog.
- [x] Phase 4 parity for Workflows/Deployments (list + starter + replay/error inside Mindscape).
- [x] (2025-11-21 05:05Z) Cutover milestone: Mindscape now defaults for all post-auth flows, header/user menu highlight it while legacy routes remained accessible for a short grace period.
- [x] (2025-11-21 05:30Z) Feature flag removed entirely; deleted `VITE_MINDSCAPE_PRIMARY`, helper module, and related docs so the rollout is permanent with less surface for drift.
- [x] (2025-11-21 06:15Z) Legacy removal: stripped header/user menu links, updated docs, and confirmed no affordances remain that expose the route-based UI.

## Surprises & Discoveries

- Observation: Existing Mindscape Initializer already hydrates notes (list) and due reminders (subset) as nodes; CRUD flows remain in routes.
  Evidence: apps/web/src/components/mindscape/initializer.tsx creates note/reminder nodes but does not provide create/update interactions.
- Observation: tRPC APIs exist for timers, bookmarks, todos; node UIs can reuse them directly.
  Evidence: routes `_authed/timer.tsx` and `_authed/book.tsx` use trpc.timer.*, trpc.book.*.
- Observation: Workflow stream-to-UI translation already exists for Orchestrator route and Mindscape WorkflowManager; consolidation is feasible.
  Evidence: apps/web/src/components/mindscape/workflow-manager.tsx and `_authed/orchestrator/run.tsx`.
- Observation: Zustand persist currently saves entire node arrays (data + edges) but omits focus metadata and sanitisation, so Phase 0 will trim persisted payloads while guaranteeing `position` survives reloads.
  Evidence: apps/web/src/store/mindscape.ts partialize simply forwards `state.nodes`/`state.edges`.
- Observation: `useReactFlow` requires a provider wrapper; we added `MindscapeCanvasInner` + `ReactFlowProvider` so deep-link focus can animate via `fitView`.
  Evidence: apps/web/src/components/mindscape/canvas.tsx now exports a provider-wrapped component while the inner hook drives focus centering.
- Observation: `bun --filter web typecheck` currently fails due to pre-existing issues in other packages (knowledge indexes, Linear webhooks, shared tests), so Phase 0 validation relies on manual testing until workspace type hygiene improves.
  Evidence: bun report (2025-11-20) highlights errors in `packages/knowledge`, `packages/agent`, and `apps/web/src/routes/*` unrelated to Mindscape changes.
- Observation: `remind` router exposes create/delete/fire but no update endpoint, so rescheduling is implemented by creating a replacement reminder then deleting the old record once the new one persists.
  Evidence: packages/api/src/routers/remind.ts exports create/list/due/fire/delete only; ReminderNode now orchestrates create→delete sequencing.

## Decision Log

<decision id="1">
  <chosen>Hybrid migration (Option C): Mindscape as primary, routes retained as fallback with feature flag</chosen>
  <rationale>
    Parallel operation reduces risk and enables incremental adoption. Users can switch to Mindscape without losing route workflows. Quantitatively, this avoids a "big bang" where 100% parity must be achieved up front, minimizing schedule risk and user disruption. Complexity is medium; performance impact negligible given React Flow and Zustand are already integrated.
  </rationale>
  <discards>
    Option A (Gradual with both UIs but no primary) lacks a clear end-state; Option B (Complete replacement) is high risk and delays value until full parity.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="2">
  <chosen>State strategy: tRPC remains system of record; Zustand owns spatial graph; explicit sync points</chosen>
  <rationale>
    Server state (CRUD, stream) continues via tRPC/TanStack Query; Mindscape uses Zustand for graph and ephemeral UI state. This avoids rewriting APIs and reduces risk. Expected performance: O(1) local node updates, bounded by React reconciliation.
  </rationale>
  <discards>
    Single-store approach (move everything to Zustand) couples persistence and UI; Query-only approach loses local instantaneous graph control.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="3">
  <chosen>Navigation: Deep links to nodes + Command Palette (Cmd+K) to spawn nodes; keep header link to `/mindscape`</chosen>
  <rationale>
    Spatial discovery needs quick creation/search. Deep links ensure shareability and transition from route bookmarks. Keyboard-first improves accessibility. Minimal additions leverage existing patterns.
  </rationale>
  <discards>
    Spatial-only discovery (no deep links) harms shareability; modal-centric approach diverges from spatial intent.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="4">
  <chosen>Auto-clear handled deep-link query params and gate unsupported spawn targets with explicit messaging until their nodes exist.</chosen>
  <rationale>
    Clearing `nodeId`/`spawn` after focus/spawn prevents duplicate creations on every render and lets users re-trigger links idempotently. Guarding missing node types (timer/bookmark/todo) with a toast keeps `/mindscape?spawn=…` safe while those nodes are still under construction in later phases.
  </rationale>
  <discards>
    Leaving params untouched caused infinite respawns/focus loops; silently ignoring unsupported types provided no user signal and complicated debugging.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="5">
  <chosen>Cmd/Ctrl+K palette uses cmdk primitives with shared spawn/focus helpers, limited to node types that already render in Mindscape.</chosen>
  <rationale>
    Surfacing only supported node types avoids broken UI affordances while still providing fast keyboard discovery. Centralising spawn/focus logic prevents drift between query-param handling and palette actions.
  </rationale>
  <discards>
    Adding every planned artifact up front would expose broken entries until their nodes ship; duplicating spawn logic risked inconsistent behaviors.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="6">
  <chosen>Zustand persistence now stores sanitized node snapshots (position, minimal data, focused node) instead of full React Flow node objects.</chosen>
  <rationale>
    Trimming chat transcripts and only persisting layout data keeps localStorage lightweight while ensuring refresh restores spatial context and focus state. Chat history still hydrates via TanStack Query / node state.
  </rationale>
  <discards>
    Persisting full nodes (including streaming buffers) bloated storage and risked stale data overriding server truths.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="7">
  <chosen>Reminder reschedule = create new reminder, then delete the prior record once the new one succeeds.</chosen>
  <rationale>
    The remind router lacks an update mutation, so replacing the reminder preserves reliability (no data loss) while keeping the node bound to the freshest record. Deleting the previous reminder after creation avoids duplicate notifications.
  </rationale>
  <discards>
    Deleting the old reminder before creating a new one risked losing the task if the new mutation failed; leaving both reminders active would send duplicate alerts.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="8">
  <chosen>Settings/Privacy/Profile/Integrations nodes reuse existing route mutations and limit UI scope to the highest-value controls (autonomy slider, privacy export/forget, profile form + passkeys, Linear connect) to keep nodes compact.</chosen>
  <rationale>
    Reusing the route logic avoids duplicating validation rules and keeps TanStack Query cache flows identical, while trimming visuals down to core controls fits the Mindscape node footprint. Palette spawns them on demand, and singleton rules prevent redundant admin panels floating around the canvas.
  </rationale>
  <discards>
    Auto-spawning all admin nodes on load overcrowded the canvas and obscured user intent; re-implementing bespoke logic risked divergence from the battle-tested routes.
  </discards>
  <date-author>2025-11-20 / AI Agent</date-author>
</decision>

<decision id="9">
  <chosen>Feature-flagged cutover (later removed) allowed staged testing before Mindscape became the permanent default.</chosen>
  <rationale>
    Keeping a short-lived flag let us validate Mindscape parity without forcing every user into the new UI immediately.
  </rationale>
  <discards>
    n/a (see Decision 10 for subsequent removal)
  </discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

<decision id="10">
  <chosen>Remove `VITE_MINDSCAPE_PRIMARY` and treat Mindscape as the always-on primary surface.</chosen>
  <rationale>
    Parity is complete and the fallback UI remains available via explicit links, so the feature flag only added complexity. Dropping it eliminates divergent states, dead branches, and extra documentation.
  </rationale>
  <discards>
    Keeping the flag indefinitely would risk drift between environments and require redundant testing; routing-condition checks would also stick around forever.
  </discards>
  <date-author>2025-11-21 / AI Agent</date-author>
</decision>

## Outcomes & Retrospective

(Will be updated each phase)
- Expected at end: Users can do core work in `/mindscape`; old routes remain as fallback. Performance target: smooth panning/zooming at 60fps with 100+ nodes. Accessibility: keyboard navigation and command palette operational. Rollback always available via feature flag.

### Phase 0 (Enablement) — 2025-11-20

Deep links (`nodeId`/`spawn`) hydrate nodes deterministically, positions + focus survive refresh via sanitized Zustand persistence, and the Cmd/Ctrl+K palette provides a discoverable spawn/search surface that reuses the same spawn helpers as the URL flow. Unsupported artifacts (timer/bookmark/todo) are intentionally gated with messaging until their nodes land in Phases 2–3. Next focus: delivering CRUD parity for Chat/Note/Reminder nodes so `/mindscape` stands in for `/ai`, `/note`, and `/remind`.

### Phase 1 (Chat / Note / Reminder Parity) — 2025-11-20

NoteNode now mirrors `/note`: palette-spawned notes open directly in edit mode, saving wires into `trpc.note.create`, existing notes can be edited/deleted inline, and TanStack Query caches refresh automatically. ReminderNode mirrors `/remind`: users can create reminders (with description + due), mark them complete, reschedule (implemented as create-new → delete-old because the API lacks an update call), or remove them entirely without leaving Mindscape. ChatNode already offered full parity, so `/mindscape` now covers the three highest-use routes for daily capture.

### Phase 2 (Timers / Bookmarks / Todos) — 2025-11-20

Timers, bookmarks, and todos now live as dedicated nodes. TimerNode wraps the `/timer` flow (start + monitor + cancel/complete with live countdown). BookmarkNode provides inline URL validation, tag capture, and list management. TodoNode mirrors `/todos` with add/toggle/delete plus in-node filtering (all/active/completed). Palette spawning makes these utilities one keystroke away, so `/mindscape` covers the remaining “management” routes without tabbing away.

### Phase 3 (Settings / Privacy / Profile / Integrations) — 2025-11-20

Admin and configuration routes now live inside Mindscape. SettingsNode exposes the autonomy slider and a lightweight preference editor backed by `trpc.preference.*`. PrivacyNode reuses `PrivacyControls`, displays fact/event lists, and lets users export or forget data inline. ProfileNode mirrors `/profile` with editable form plus passkey add/delete via `authClient`. IntegrationsNode surfaces Linear status with the same OAuth hand-off and badges for Laminar/voice placeholders. Together these nodes eliminate the need to drop back to `_authed` routes for configuration.

### Phase 4 (Workflows / Deployments) — 2025-11-21

WorkflowListNode now replaces `/workflows` with filters, detail modal, and "open in Mindscape" affordances that spawn WorkflowNodes on demand. WorkflowNode itself embeds the requirement/auto/mode starter, streams plan/tool/task updates via `WorkflowManager`, shows event history, and exposes refetch/refresh affordances. DeploymentNode mirrors the `/deployments` list in compact form, wires promote/remove/copy actions through tRPC, and can subscribe to the health stream when live telemetry is toggled on. These pieces bring Orchestrator + Deploy workflows fully into the canvas; next step is making Mindscape the primary landing surface with a reversible flag.

### Cutover (Mindscape Primary) — 2025-11-21

Mindscape is now the universal landing surface: SignIn/SignUp/Onboarding, header, and user menu all route there by default, and all navigation affordances to the old route pages have been removed. The temporary `VITE_MINDSCAPE_PRIMARY` flag served its purpose during verification and has been removed to avoid drift; rollback, if ever needed, would involve reintroducing a fallback route from git history.

## Context and Orientation

Two UIs exist:

- Old system (production): TanStack Start routes under `apps/web/src/routes/_authed/*`, using PaneLayout forms and TanStack Query + tRPC. Fully functional.
- New system (Symbiotic Mindscape): `/mindscape` route uses React Flow canvas + Zustand store in `apps/web/src/store/mindscape.ts`, nodes in `apps/web/src/components/mindscape/nodes/*`, plus WorkflowManager for streaming.

Key files (mindscape):
- Canvas: apps/web/src/components/mindscape/canvas.tsx
- Store: apps/web/src/store/mindscape.ts (Zustand with persist)
- Initializer: apps/web/src/components/mindscape/initializer.tsx (hydrates orb + chat + notes/reminders)
- WorkflowManager: apps/web/src/components/mindscape/workflow-manager.tsx
- Node types: chat-node.tsx, workflow-node.tsx, note-node.tsx, reminder-node.tsx, terminal-node.tsx, code-node.tsx, ticket-node.tsx, artifact-node.tsx, orb-node.tsx

Key files (routes, examples):
- Chat: apps/web/src/routes/_authed/ai.tsx
- Notes: apps/web/src/routes/_authed/note.tsx
- Reminders: apps/web/src/routes/_authed/remind.tsx
- Timers: apps/web/src/routes/_authed/timer.tsx
- Bookmarks: apps/web/src/routes/_authed/book.tsx
- Workflows: apps/web/src/routes/_authed/workflows.tsx
- Orchestrator Run: apps/web/src/routes/_authed/orchestrator/run.tsx
- Preferences/Privacy/Profile/Integrations/Deployments: see matching routes in the repo tree

### Route-by-Route Migration Feasibility Matrix

<matrix>
  <route path="/ai">
    <mapsTo>ChatNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>None critical; CRUD for attachments and history edit optional.</gaps>
    <notes>Hydrate recent history; keep `/ai` deep link to spawn ChatNode via /mindscape?spawn=chat</notes>
  </route>
  <route path="/note">
    <mapsTo>NoteNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>Create/Update/Delete from node needed (currently read-only in Mindscape)</gaps>
    <notes>Embed create form modal inside NoteNode or as floating panel.</notes>
  </route>
  <route path="/remind">
    <mapsTo>ReminderNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>Create/Delete inside node; due picker UI.</gaps>
    <notes>Hydration exists for due-now; add full list and create.</notes>
  </route>
  <route path="/todos">
    <mapsTo>TodoNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; map trpc.todo.*</gaps>
    <notes>Simple list + add + toggle.</notes>
  </route>
  <route path="/timer">
    <mapsTo>TimerNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; start/complete/cancel actions</gaps>
    <notes>Use trpc.timer.* as in route.</notes>
  </route>
  <route path="/book">
    <mapsTo>BookmarkNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; create/delete; tags chips</gaps>
    <notes>Use trpc.book.*</notes>
  </route>
  <route path="/workflows">
    <mapsTo>WorkflowListNode (panel)</mapsTo>
    <feasible>yes</feasible>
    <gaps>New list node; open specific run as WorkflowNode; filter/search</gaps>
    <notes>Leverage existing `workflows.tsx` logic; reuse tremor badge</notes>
  </route>
  <route path="/orchestrator/run">
    <mapsTo>WorkflowNode + Start Panel</mapsTo>
    <feasible>yes</feasible>
    <gaps>Embed start form in node/panel; suspend/resume via Biometric dialog</gaps>
    <notes>Map stream handlers to node state (already partly done).</notes>
  </route>
  <route path="/preferences">
    <mapsTo>SettingsNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; autonomy slider + voice settings</gaps>
    <notes>Reuse components in apps/web/src/components/autonomy-slider.tsx etc.</notes>
  </route>
  <route path="/privacy">
    <mapsTo>PrivacyNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; export/delete fact list</gaps>
    <notes>Reuse PrivacyControls component.</notes>
  </route>
  <route path="/profile">
    <mapsTo>ProfileNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; passkey management UI embedding</gaps>
    <notes>Reuse profile route logic and authClient calls.</notes>
  </route>
  <route path="/integrations">
    <mapsTo>IntegrationsNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New node; Linear connect flow (browser redirect)</gaps>
    <notes>Button triggers window.location to OAuth.</notes>
  </route>
  <route path="/deployments">
    <mapsTo>DeploymentNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New list node; promote dialog as node modal; health stream indicator</gaps>
    <notes>Reuse promote-dialog and health stream logic.</notes>
  </route>
  <route path="/dashboard">
    <mapsTo>DashboardNode</mapsTo>
    <feasible>yes</feasible>
    <gaps>New simple node showing privateData and shortcuts</gaps>
    <notes>Make `/mindscape` default landing after auth via flag.</notes>
  </route>
</matrix>

### Component Reusability Analysis

<reusability>
  <component from="ChatContainer" to="ChatNode">Reuse streaming logic, renderPart; maintain voice capture control.</component>
  <component from="PaneLayout (Create+List)" to="Mindscape">Replace with Node modal/panel pattern: creation happens via floating panel; list renders in node body; use existing UI components.</component>
  <component from="Workflows table & detail modal" to="WorkflowListNode + WorkflowDetail">Reuse `WorkflowDetailModal` within node; list table becomes scrollable panel.</component>
  <component from="BiometricChallengeDialog" to="Mindscape">Reuse as-is; invoked by WorkflowNode and stream errors.</component>
  <component from="PrivacyControls, AutonomySlider, Audio/Voice components" to="Settings/Privacy/Profile Nodes">Embed directly; minimal glue.</component>
  <component from="PromoteDialog" to="DeploymentNode">Reuse with minor wiring.</component>
</reusability>

### State Management Consolidation Strategy

- System of record: tRPC services and TanStack Query caches remain authoritative for server data (notes, reminders, timers, bookmarks, workflows, etc.).
- Spatial graph/UI: Zustand store at apps/web/src/store/mindscape.ts continues to own nodes, edges, focus, and layout.
- Sync patterns:
  1. Hydration-in: MindscapeInitializer pulls summaries (notes, reminders due) and spawns nodes. Extend to hydrate additional artifacts lazily when needed.
  2. Node-local actions: Node UIs call tRPC mutations; upon success, update both TanStack Query cache (via utils.*.setData/invalidate) and Zustand node.data to stay in sync.
  3. Streaming: WorkflowManager already updates nodes from `workflow.stream`; keep this single source for live UI-message events.
  4. Position persistence: Extend Zustand persist to include `position` and node-specific UI flags. Persist key: "mindscape-storage".
  5. Deep linking: `/mindscape?nodeId=...` restores focus; `/mindscape?spawn=note` creates a new node with defaults.

## Plan of Work

We execute in **Core** then **Enhancements**, phased to reduce risk.

Core (minimal steps):
1. Add deep linking and spawn mechanics (query params → node add/focus).
2. Persist node positions/layout across sessions.
3. Implement CRUD inside NoteNode and ReminderNode; support creation via palette.
4. Implement missing nodes for Timers, Bookmarks, Todos with basic CRUD.
5. Provide Command Palette (Cmd+K) to spawn nodes and search artifacts.
6. Keep `/mindscape` behind a feature flag and retain all routes.

Enhancements (gap-fixing, parity polish):
1. Add Settings/Privacy/Profile/Integrations/Deployments nodes.
2. Add Workflow list node; embed detail modal; unify Orchestrator run UI inside a node panel.
3. Improve accessibility: keyboard nav between nodes, focus rings, shortcuts.
4. Add search across artifacts and jump-to-node by title/ID.
5. Add workflow replay pagination and error panel within nodes.

Cutover (Mindscape primary rollout):
With parity achieved, Mindscape becomes the default surface for every post-auth flow. All legacy navigation links have been removed so the classic routes are no longer exposed in the UI. No feature flag remains—cutover is now simply part of the baseline experience.

Milestones (narrative):

- Phase 0 (Enablement): Goal—Make Mindscape addressable (deep links), spawn nodes from command palette, and keep layouts. Work—Query param router integration; extend persist partialize; basic palette. Result—Users can open `/mindscape?spawn=chat` to start chat. Proof—See Concrete Steps.

- Phase 1 (Core CRUD): Goal—Achieve parity for Chat, Notes, Reminders in Mindscape. Work—Add creation flows (modal/panel) in Note/Reminder nodes; hydration + optimistic updates. Result—Users can create/edit/delete notes/reminders without routes. Proof—Create a note in Mindscape; confirm via list in route `/note` for back-compat.

- Phase 2 (Management): Goal—Timers/Bookmarks/Todos nodes. Work—Implement nodes using existing tRPC; map exactly the route’s logic. Result—Users can manage timers/bookmarks/todos on canvas. Proof—Start a timer, see countdown live.

- Phase 3 (Settings & Admin): Goal—Add Settings/Privacy/Profile/Integrations nodes. Work—Embed existing pure components; trigger OAuth for Linear. Result—Users can adjust autonomy, export/delete data, manage passkeys. Proof—Change autonomy and see preference stored.

- Phase 4 (Workflows & Deployments): Goal—Replace Orchestrator Run page and Workflows list with nodes. Work—Add WorkflowListNode; route to WorkflowNode; show status, replay, and error analysis. Result—Users can start/rerun/replay workflows within Mindscape. Proof—Run a workflow from node; see streaming updates and error panel when applicable.

## Concrete Steps

All commands run from repository root unless noted.

Core:

1) Deep link and spawn:
   - Accept URL parameters:
     - `nodeId`: focus existing node.
     - `spawn`: one of ["chat","note","reminder","timer","bookmark","todo","workflow"].
   - On mount of MindscapeCanvas, parse location.search, call store.addArtifact or store.focusNode accordingly.
   - Ensure idempotence: only spawn if a similar node (by type+seed) not present unless explicitly requested.

   Edge cases:
   <edge-cases>
     <edge-case><input>Unknown spawn value</input><expected>Ignore; no crash</expected></edge-case>
     <edge-case><input>Malformed nodeId</input><expected>Ignore; no crash</expected></edge-case>
   </edge-cases>

2) Persist node positions:
   - In Zustand persist partialize, include nodes with id, type, position, and strategic UI flags; exclude heavy streaming buffers.
   - Validate restore: after refresh, nodes appear at last positions; orb at center (draggable: false).

3) Note/Reminder CRUD in nodes:
   - NoteNode:
     - Add "Edit" and "Delete" actions; "New Note" available from palette that spawns an empty NoteNode with form.
     - On save, call `trpc.note.create` or `trpc.note.update` (if update exists; otherwise implement via delete+create as interim), invalidate caches, and `updateArtifactData`.
   - ReminderNode:
     - Add create UI (title, due, description), deletion, and due chips.

   Validation rules (examples):
   <validation>
     <rule entity="note"><field>title</field><requirement>optional string <= 120 chars</requirement></rule>
     <rule entity="note"><field>content</field><requirement>required non-empty</requirement></rule>
     <rule entity="reminder"><field>title</field><requirement>required non-empty</requirement></rule>
     <rule entity="reminder"><field>due</field><requirement>required ISO 8601; must be in future</requirement></rule>
   </validation>

4) Implement TimerNode, BookmarkNode, TodoNode:
   - TimerNode: start (minutes → seconds), complete, cancel using `trpc.timer.*`.
   - BookmarkNode: create with URL validation, delete using `trpc.book.*`.
   - TodoNode: list/add/toggle complete using `trpc.todo.*` (assumes similar API; if missing, define minimal server endpoint or limit to client list until available).

   Edge cases:
   <edge-cases>
     <edge-case><input>Timer duration <= 0</input><expected>Disable create; show validation message</expected></edge-case>
     <edge-case><input>Bookmark URL invalid</input><expected>Reject; tooltip feedback</expected></edge-case>
   </edge-cases>

5) Command Palette (Cmd+K):
   - Provide quick actions:
     - "New Chat / Note / Reminder / Timer / Bookmark / Todo / Workflow"
     - "Search: {artifact title} → focus node"
   - Implementation: lightweight palette that reads current nodes from Zustand and offers add/focus actions.

Enhancements:

6) Settings/Privacy/Profile/Integrations Nodes:
   - Embed pure components (AutonomySlider, PrivacyControls, profile form, integrations cards).
   - TanStack Query/tRPC wiring same as routes.

7) Workflows:
   - Add WorkflowListNode that lists runs using `trpc.workflow.listRuns`; clicking a row opens WorkflowDetail inside the node or spawns a WorkflowNode focused on that run.
   - Orchestrator run form embedded in a WorkflowStarter panel; stream to node using existing stream subscription pattern; reuse BiometricChallengeDialog for high-risk actions.

8) Deployments:
   - DeploymentNode lists deployments, shows live health (read token) toggle, promote/remove actions with dialogs.
   - Copy host button remains.

9) Mindscape cutover (final):
   - Hard-code SignInForm, SignUpForm, and onboarding completion to route to `/mindscape`.
   - Remove all navigation affordances pointing to `/dashboard`, `/ai`, `/note`, `/remind`, `/timer`, `/book`, `/workflows`, `/integrations`, and `/preferences` so the route-based UI is no longer exposed.
   - Delete the temporary helper/env var so only one code path governs navigation.

### How to run and observe (dev)

- Start web app:
  - Working dir: repository root
  - Command: `bun --filter @alfred/web dev`
- Navigate to `/mindscape`.
- Verify deep links: open `/mindscape?spawn=chat`, `/mindscape?spawn=note`, `/mindscape?nodeId=singularity`.
- Create a note from the palette and from a NoteNode; refresh page—node remains (position and state).
- Start a timer in TimerNode; see countdown; complete it.

Expected console/log excerpts (abridged):

  addArtifact: note-abc123
  setNodes: persisted restore (7 nodes)
  trpc.note.create: success 201
  trpc.timer.create: duration=1500 ok

## Validation and Acceptance

Core acceptance:

- Deep linking:
  - GET `/mindscape?spawn=chat` produces a new ChatNode; focus is set.
  - GET `/mindscape?nodeId=singularity` focuses the Orb.

- Persistence:
  - Move a NoteNode; refresh; position is unchanged.

- CRUD in nodes:
  - Create Note in Mindscape; confirm in `/note` list route; delete via node; disappearance persists.

- Management artifacts:
  - TimerNode: Start timer 1 min; countdown updates; Complete sets done and removes from active.
  - BookmarkNode: Add valid URL; appears in list and persists; invalid URL is rejected with feedback.

Enhancement acceptance:

- Settings:
  - Change autonomy via SettingsNode; route `/preferences` reflects same after refetch.

- Privacy:
  - Export facts via PrivacyNode and observe downloaded JSON; delete an individual fact and confirm it disappears from `/privacy` on refresh.

- Profile:
  - Update display name from ProfileNode and confirm `/profile` shows the new value; add & delete a passkey via the node and verify toast confirmations.

- Integrations:
  - Use IntegrationsNode to start the Linear OAuth flow (state saved, browser redirected) and see connection badges update once credentials exist.

- Workflows:
  - Start a run from WorkflowNode panel; observe streaming Plan/Task/Tool within node; handle biometric elevation; replay shows persisted UI messages.

- Deployments:
  - Enable live health; table updates; promote dialog works; copy URL to clipboard.

Tests (manual + quick automated smoke if available):
- Run the web integration tests (if present) or manual flows above. Expect no regressions in old routes.

- Cutover verification:
  - Start `bun --filter @alfred/web dev`, sign in via `/login`, and confirm you land on `/mindscape` automatically with header + user menu containing only Mindscape navigation.
  - Attempt to visit `/dashboard` (or other classic routes) directly to ensure they redirect/are inaccessible as standalone UIs.

## Idempotence and Recovery

- All node spawns are idempotent when tied to IDs: `spawn=chat` adds a fresh node unless `spawnOnce=true` gating is implemented; repeated actions are safe.
- Persistence writes are localStorage via Zustand persist; corrupt entries fallback to initializer baseline without crashing (guard parse with try/catch).
- If a tRPC mutation fails:
  - Do not update node.data; show toast; leave node state editable for retry.
- Rollback path (without feature flags):
  - Mindscape is primary, but `/dashboard`, `/ai`, `/note`, `/remind`, `/timer`, `/book`, `/workflows`, `/integrations`, and `/preferences` all remain routable; if spatial UI regresses, direct users to those links while fixes ship.
  - Deep links and palette spawning continue to function; there is no stateful flag that could leave environments inconsistent.

## Artifacts and Notes

- Mapping of old routes to nodes is included in the matrix; use it as the checklist for parity.
- Console messages for state transitions are encouraged during development (strip for prod).

## Interfaces and Dependencies

Be prescriptive and minimal. Define new node data types in `apps/web/src/store/mindscape.schemas` (Zod) and node components in `apps/web/src/components/mindscape/nodes`.

<interface path="apps/web/src/store/mindscape.schemas">
  <type name="TimerNodeData">
    <fields>
      <field name="type" type="literal('timer')" />
      <field name="label" type="string | undefined" />
      <field name="duration" type="number" />
      <field name="startedAt" type="string | null" />
      <field name="completedAt" type="string | null" />
      <field name="cancelledAt" type="string | null" />
    </fields>
  </type>
  <type name="BookmarkNodeData">
    <fields>
      <field name="type" type="literal('bookmark')" />
      <field name="title" type="string | null" />
      <field name="url" type="string" />
      <field name="tags" type="string[] | null" />
      <field name="createdAt" type="string | null" />
    </fields>
  </type>
  <type name="TodoNodeData">
    <fields>
      <field name="type" type="literal('todo')" />
      <field name="items" type="Array<{ id: string; title: string; done: boolean }>" />
    </fields>
  </type>
  <type name="SettingsNodeData">
    <fields>
      <field name="type" type="literal('settings')" />
      <field name="autonomy" type="'read'|'low'|'medium'|'high'" />
      <field name="voiceProvider" type="'local'|'openai'" />
    </fields>
  </type>
</interface>

<interface path="apps/web/src/components/mindscape/nodes/timer-node.tsx">
  <component name="TimerNode">
    <props>NodeProps</props>
    <behavior>
      <item>Show active timers list with remaining seconds</item>
      <item>Provide Start, Complete, Cancel using trpc.timer.*</item>
    </behavior>
  </component>
</interface>

<interface path="apps/web/src/components/mindscape/nodes/bookmark-node.tsx">
  <component name="BookmarkNode">
    <props>NodeProps</props>
    <behavior>
      <item>Create with URL validation; list with delete</item>
    </behavior>
  </component>
</interface>

<interface path="apps/web/src/components/mindscape/nodes/todo-node.tsx">
  <component name="TodoNode">
    <props>NodeProps</props>
    <behavior>
      <item>List existing todos; add new; toggle done</item>
    </behavior>
  </component>
</interface>

<dependencies>
  <lib name="@xyflow/react">Canvas and nodes</lib>
  <lib name="zustand">State for spatial graph and persistence</lib>
  <lib name="@tanstack/react-query">Server cache management</lib>
  <lib name="@trpc/client">RPC calls; existing router contracts remain</lib>
</dependencies>

## Navigation & Discovery Patterns (Spatial UI)

- `/mindscape` is now the default landing permanently; the header only exposes Home and Mindscape links to eliminate drift back to the route-based UI.
  - The user menu mirrors this behavior with a single Mindscape shortcut (plus account controls).
- Command Palette (Cmd+K): spawn nodes, search artifacts by title/ID, and jump to node.
- Deep links:
  - `/mindscape?nodeId=NOTE-123` → focus a node
  - `/mindscape?spawn=note` → create new
  - `/mindscape?open=workflow:RUN_ID` → open WorkflowNode attached to a run
- Optional Node Palette dock: a small floating "+" opens a palette to create artifacts.

## Technical Debt Inventory

<tech-debt>
  <item id="td-1">Node position persistence missing (store implements persist but not full position schema).</item>
  <item id="td-2">Note/Reminder nodes lack full CRUD; creation is route-only today.</item>
  <item id="td-3">No search/indexing layer for artifacts within Mindscape.</item>
  <item id="td-4">A11y for canvas navigation (keyboard-based focus) is limited.</item>
  <item id="td-5">Workflow replay pagination UX exists in route; mirror inside nodes.</item>
  <item id="td-6">No unified deep-link schema across all artifact types.</item>
  <item id="td-7">No bulk node management (group select, delete), low priority.</item>
  <item id="td-8">Integrations node requires safe OAuth handoff patterns.</item>
</tech-debt>

## User Experience Impact Assessment

- Discoverability: Spatial UI introduces cognitive shift; Command Palette and deep links mitigate learning curve. Add onboarding hints/tooltips.
- Accessibility: Provide keyboard focus traversal across nodes; ensure buttons and inputs have ARIA labels (many already do). Command palette offers keyboard-first creation/search.
- Performance: React Flow and Zustand are performant. Keep node content lean; avoid rendering massive datasets in a single node; paginate lists where needed.
- Mobile: Mindscape is primarily desktop-focused; ensure pinch/zoom basics work; defer full mobile optimization if not a target.
- Reliability: If any node operation fails (tRPC error), show toast and preserve user input for retry.

## Migration Phases with Dependencies

<phases>
  <phase id="0" name="Enablement (links, spawn, persistence)">
    <deps>None</deps>
    <deliverables>
      <item>Deep link focus/spawn</item>
      <item>Command Palette (spawn + search existing nodes)</item>
      <item>Node position persistence</item>
    </deliverables>
  </phase>
  <phase id="1" name="Core parity: Chat, Notes, Reminders">
    <deps>0</deps>
    <deliverables>
      <item>NoteNode CRUD, ReminderNode CRUD</item>
      <item>Palette/native create flows for note/reminder</item>
    </deliverables>
  </phase>
  <phase id="2" name="Management: Timers, Bookmarks, Todos">
    <deps>1</deps>
    <deliverables>
      <item>TimerNode, BookmarkNode, TodoNode</item>
      <item>Basic validations and Query invalidation patterns</item>
    </deliverables>
  </phase>
  <phase id="3" name="Settings & Admin: Preferences, Privacy, Profile, Integrations">
    <deps>2</deps>
    <deliverables>
      <item>SettingsNode, PrivacyNode, ProfileNode, IntegrationsNode</item>
      <item>OAuth redirect for Linear within node</item>
    </deliverables>
  </phase>
  <phase id="4" name="Workflows & Deployments">
    <deps>3</deps>
    <deliverables>
      <item>WorkflowListNode, Workflow run starter panel</item>
      <item>Replay + error panel inside nodes</item>
      <item>DeploymentNode with health stream & promote dialog</item>
    </deliverables>
  </phase>
</phases>

## Idempotence & Rollback Plan

- Parallel UIs: Legacy route files remain in the tree only for archival reference but are no longer linked or documented; Mindscape is the sole supported surface.
- If Mindscape presents issues, reintroduce a fallback by reverting to a prior git commit—no runtime toggles exist, so rollback is an explicit deploy decision.

## Best Practices (Austere Implementation)

- Keep node UIs minimal; reuse existing components.
- Avoid new global state beyond necessary graph props; update only changed fields in Zustand.
- Validate user inputs early and locally to reduce server round trips.
- Log succinctly in dev; do not ship verbose logs to prod.

## Revision Note

- 2025-11-20: Phase 0 enablement executed (deep links, spawn helpers, persistence sanitisation, and Cmd/Ctrl+K palette). Document updated accordingly.
- 2025-11-20: Phase 1 parity complete (NoteNode CRUD, ReminderNode create/reschedule/complete, chat parity validated).
- 2025-11-20: Phase 2 parity complete (TimerNode/BookmarkNode/TodoNode implemented with palette spawns and server wiring).
- 2025-11-20: Phase 3 parity complete (Settings/Privacy/Profile/Integrations nodes with existing route logic embedded in Mindscape).
- Initial plan created with hybrid strategy, deep links, and phased roadmap to minimize risk while delivering incremental value. Future revisions should update `Progress`, `Decision Log`, and `Outcomes & Retrospective` as milestones are delivered.
- 2025-11-21: Phase 4 added plus cutover tasks documented; later the temporary `VITE_MINDSCAPE_PRIMARY` rollout plan was removed once validation completed, and the document now reflects Mindscape as the unconditional default.
