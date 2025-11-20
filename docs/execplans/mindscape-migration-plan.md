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
- [ ] Phase 1 parity for Chat, Notes, Reminders (CRUD in nodes; deep-link fallbacks).
- [ ] Phase 2 parity for Timers, Bookmarks, Todos.
- [ ] Phase 3 parity for Settings/Privacy/Profile/Integrations.
- [ ] Phase 4 parity for Workflows/Orchestrator/Deployments; replay and error UX.
- [ ] Cutover milestone: make `/mindscape` the default post-auth landing via feature flag.
- [ ] Decommission plan for old routes (retain fallback behind flag).

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

## Outcomes & Retrospective

(Will be updated each phase)
- Expected at end: Users can do core work in `/mindscape`; old routes remain as fallback. Performance target: smooth panning/zooming at 60fps with 100+ nodes. Accessibility: keyboard navigation and command palette operational. Rollback always available via feature flag.

### Phase 0 (Enablement) — 2025-11-20

Deep links (`nodeId`/`spawn`) hydrate nodes deterministically, positions + focus survive refresh via sanitized Zustand persistence, and the Cmd/Ctrl+K palette provides a discoverable spawn/search surface that reuses the same spawn helpers as the URL flow. Unsupported artifacts (timer/bookmark/todo) are intentionally gated with messaging until their nodes land in Phases 2–3. Next focus: delivering CRUD parity for Chat/Note/Reminder nodes so `/mindscape` stands in for `/ai`, `/note`, and `/remind`.

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

### How to run and observe (dev)

- Start web app:
  - Working dir: repository root
  - Command: `pnpm --filter @alfred/web dev` (or the project’s dev command)
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

- Workflows:
  - Start a run from WorkflowNode panel; observe streaming Plan/Task/Tool within node; handle biometric elevation; replay shows persisted UI messages.

- Deployments:
  - Enable live health; table updates; promote dialog works; copy URL to clipboard.

Tests (manual + quick automated smoke if available):
- Run the web integration tests (if present) or manual flows above. Expect no regressions in old routes.

## Idempotence and Recovery

- All node spawns are idempotent when tied to IDs: `spawn=chat` adds a fresh node unless `spawnOnce=true` gating is implemented; repeated actions are safe.
- Persistence writes are localStorage via Zustand persist; corrupt entries fallback to initializer baseline without crashing (guard parse with try/catch).
- If a tRPC mutation fails:
  - Do not update node.data; show toast; leave node state editable for retry.
- Feature flag allows instant rollback to route-first UX:
  - Set `VITE_MINDscape_PRIMARY=false` to keep legacy routes as default.
  - Deep links continue to function but header default remains `/dashboard`.

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

- `/mindscape` link stays in header; feature flag can make it the default landing for authenticated users.
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

- Parallel UIs: Old routes remain functionally intact throughout. Feature flag toggles the default landing.
- If Mindscape feature creates issues, disable `VITE_MINDSCAPE_PRIMARY` (or equivalent) and continue using routes; deep links remain opt-in.

## Best Practices (Austere Implementation)

- Keep node UIs minimal; reuse existing components.
- Avoid new global state beyond necessary graph props; update only changed fields in Zustand.
- Validate user inputs early and locally to reduce server round trips.
- Log succinctly in dev; do not ship verbose logs to prod.

## Revision Note

- 2025-11-20: Phase 0 enablement executed (deep links, spawn helpers, persistence sanitisation, and Cmd/Ctrl+K palette). Document updated accordingly.
- Initial plan created with hybrid strategy, deep links, and phased roadmap to minimize risk while delivering incremental value. Future revisions should update `Progress`, `Decision Log`, and `Outcomes & Retrospective` as milestones are delivered.
