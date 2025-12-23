# Desktop UI Paradigm: Comprehensive Design Document

> **Status:** Ready for Execution  
> **Owner:** Frontend Architecture  
> **Created:** 2025-12-23  
> **Last Updated:** 2025-12-23  
> **Revision:** 2.1 (Execution-Ready)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Philosophy](#2-vision--philosophy)
3. [Current State Analysis](#3-current-state-analysis)
4. [Core Concepts & Ontology](#4-core-concepts--ontology)
5. [Source-of-Truth Matrix](#5-source-of-truth-matrix) ← **NEW**
6. [Architecture Design](#6-architecture-design)
7. [Type System](#7-type-system)
8. [State Management](#8-state-management)
9. [Data Layer & TanStack DB](#9-data-layer--tanstack-db) ← **NEW**
10. [Subscription Protocol Contract](#10-subscription-protocol-contract) ← **NEW**
11. [Component Architecture](#11-component-architecture)
12. [Performance Patterns](#12-performance-patterns) ← **NEW**
13. [UI/UX Specifications](#13-uiux-specifications)
14. [File Structure](#14-file-structure)
15. [Code Removal Manifest](#15-code-removal-manifest)
16. [Migration Strategy](#16-migration-strategy)
17. [Open Questions & Decisions](#17-open-questions--decisions)
18. [Research Areas](#18-research-areas)
19. [Implementation Phases](#19-implementation-phases)
20. [Testing Strategy](#201-testing-strategy) ← **NEW**
21. [Success Criteria](#22-success-criteria)
22. [Progress](#progress) ← **NEW**
23. [Surprises & Discoveries](#surprises--discoveries) ← **NEW**
24. [Decision Log](#decision-log) ← **NEW**
25. [Outcomes & Retrospective](#outcomes--retrospective) ← **NEW**

---

## 1. Executive Summary

### 1.1 Problem Statement

The current frontend (`apps/web/src`) suffers from:
- **Dual Entry Points:** A WebGPU landing page (`/`) and a protected Mindscape route (`/mindscape`) with overlapping concerns.
- **Dead Code:** WebGPU engine, disabled physics worker, legacy voice stubs, polling initializers.
- **Fragmented Architecture:** 22 node types with inconsistent patterns, no shared window abstraction.
- **Dual Authority Problem:** localStorage/Zustand and backend Postgres compete as sources of truth, causing sync echo, stale caches, and migration pain.

### 1.2 Proposed Solution

Transform the frontend into a **Spatial Operating System** where:
- Nodes are **Window Instances** referencing optional **Resources** (not "Apps" containing "Entities").
- A unified **Desktop** metaphor provides window management, docking, and layout.
- React Flow serves as the rendering substrate with a clean component hierarchy.
- **Layout-first local storage** (positions, sizes, focus) with **backend-first domain resources** (notes, workflows, reminders).
- TanStack DB collections for domain resource management with optimistic mutations.

### 1.3 Key Architectural Decisions (Post-Review)

| Decision | Before | After | Rationale |
|----------|--------|-------|-----------|
| Ontology | App vs Entity | Window Instance vs Resource | Clearer separation; one resource can have multiple windows |
| Local-First Scope | Everything | Layout only | Avoids dual-authority; backend is truth for domain data |
| Data Layer | Zustand only | Zustand (layout) + TanStack DB (resources) | Purpose-built sync; optimistic updates |
| Subscription Model | N subscriptions per node | One WS, multiplexed streams | Scalable; cursor-based resume |

### 1.4 Key Outcomes

| Metric | Current | Target |
|--------|---------|--------|
| Entry Points | 2 (`/`, `/mindscape`) | 1 (`/` → Desktop) |
| Node Types | 22 (inconsistent) | 12 (categorized) |
| Dead Code Lines | ~2,500 | 0 |
| Time to Interactive | ~3.5s (WebGPU init) | <1s |
| Max Supported Nodes | ~50 (before lag) | 200+ |
| localStorage Size | Unbounded | <50KB (layout only) |

---

## 2. Vision & Philosophy

### 2.1 The Desktop Metaphor

The interface is a **spatial operating system** inspired by:
- **macOS Stage Manager:** Windows cluster and declutter automatically.
- **n8n Workflow Editor:** Nodes on an infinite canvas with connection handles.
- **i3/Hyprland Tiling:** Keyboard-driven window management.
- **Obsidian Canvas:** Freeform knowledge graphs with cards.

### 2.2 Core Principles

1. **Window Instance ↔ Resource:** A window is presentation + layout state with an optional pointer to a resource. Resources persist independently.
2. **Canvas is Workspace:** The React Flow viewport is the "desktop" where windows live.
3. **Edges are Relationships:** Connections between windows represent data flow, semantic relationships, or structural containment.
4. **Layout-First, Not Everything-First:** Only layout state (positions, sizes, focus, dock pins) lives locally. Domain resources are backend-first with optimistic UI.
5. **Progressive Disclosure:** Nodes scale their complexity via Level of Detail (LOD) based on zoom.
6. **Single WebSocket, Multiplexed Streams:** One connection per client with cursor-based resume tokens.

### 2.3 Non-Goals

- **Multi-user collaboration** (out of scope for MVP).
- **Mobile-first design** (desktop browser is primary target).
- **Arbitrary third-party node plugins** (extension system is future work).

---

## 3. Current State Analysis

### 3.1 File Inventory

```
apps/web/src/
├── routes/
│   ├── index.tsx              # Landing page (WebGPU Orb) → DELETE
│   ├── _protected.tsx         # Auth guard → KEEP
│   ├── _protected/
│   │   └── mindscape.tsx      # React Flow canvas → KEEP, MOVE to index
├── components/mindscape/
│   ├── canvas.tsx             # Main canvas component → KEEP, REFACTOR
│   ├── initializer.tsx        # Polling data loader → DELETE
│   ├── monitor.tsx            # Workflow subscription manager → KEEP
│   ├── registry.tsx           # Node type registry → KEEP, SIMPLIFY
│   ├── spawn.ts               # Node factory → KEEP, REFACTOR
│   ├── nodes/                 # 22 node components → CONSOLIDATE to 12
│   ├── panels/                # Header, Filter, Stats → DELETE or CONVERT to nodes
├── hooks/
│   ├── use-voice-session-web.ts  # Legacy voice → DELETE, REWRITE
│   ├── use-physics-worker.ts     # Disabled physics → DELETE
│   ├── use-mindscape-*.ts        # Various hooks → AUDIT & CONSOLIDATE
├── store/
│   ├── mindscape.ts           # Main store → KEEP, RENAME to desktop.ts
│   ├── mindscape/             # Store slices → KEEP
│   ├── mindscape.schemas.ts   # Zod schemas → KEEP
├── lib/mindscape/
│   ├── gpu/                   # WebGPU engine → DELETE ENTIRE FOLDER
│   ├── initial-frame.server.ts  # Server data loader → REFACTOR
```

### 3.2 Current Node Types (22)

| Category | Types | Notes |
|----------|-------|-------|
| **Core Apps** | `chat`, `terminal`, `droid` | Singleton, always available |
| **Data Entities** | `note`, `reminder`, `ticket`, `todo`, `bookmark`, `timer` | Multi-instance, persisted |
| **Workflow** | `workflow`, `workflowlist` | Execution state tracking |
| **System** | `settings`, `privacy`, `profile`, `integrations`, `deployment` | Singleton, config-focused |
| **Knowledge** | `knowledge`, `concept` | Graph-derived, read-only |
| **Legacy** | `orb`, `artifact`, `code` | Vestigial, DELETE |

### 3.3 Identified Dead Code

| File/Folder | Lines | Reason for Removal |
|-------------|-------|---------------------|
| `lib/mindscape/gpu/*` | ~800 | WebGPU engine unused in React Flow paradigm |
| `routes/index.tsx` (WebGPU logic) | ~200 | Landing page replaced by direct Desktop route |
| `hooks/use-physics-worker.ts` | 144 | Always disabled (`active: false`) |
| `hooks/use-voice-session-web.ts` (legacy stubs) | ~80 | Empty async functions |
| `components/mindscape/initializer.tsx` | 542 | Replaced by subscription-based sync |
| `components/mindscape/panels/*` | ~200 | Convert to nodes or remove |

**Total Removal Target:** ~1,966 lines

### 3.4 tRPC Coverage Map

| Frontend Hook/Component | Backend Procedure | Transport | Status |
|-------------------------|-------------------|-----------|--------|
| `MindscapeInitializer` | `graph.getEdges` | Query (Poll 5s) | ❌ REMOVE |
| `MindscapeInitializer` | `graph.watchEdges` | Subscription | ✅ KEEP |
| `MindscapeInitializer` | `graph.runQuery` | Query (Poll 15s) | ❌ REFACTOR |
| `NoteNode` | `note.create/update/delete` | Mutation | ✅ KEEP |
| `ReminderNode` | `remind.create/snooze` | Mutation | ✅ KEEP |
| `WorkflowManager` | `workflow.stream` | SSE | ✅ KEEP |
| `TerminalNode` | `terminal.*` | Subscription | ✅ KEEP |
| `useVoiceSessionWeb` | `voice.sttTranscribe` | Mutation | ❌ REWRITE |
| `useVoiceSessionWeb` | `voice.stream` | Subscription | ✅ WIRE UP |

---

## 4. Core Concepts & Ontology

### 4.1 Entity Definitions

> **Key Change (Post-Review):** We use "Window Instance" and "Resource" instead of "App" and "Entity" to reduce conceptual drift.

#### 4.1.1 Window Instance (Node)

A **Window Instance** is:
- Layout + presentation state (position, size, focus, view mode, draft state).
- An optional pointer to a **Resource** (`resourceId`).
- Independent of persistence—ephemeral UI like command palette or transient tools have no resource.

**Properties:**
- `id`: Unique window identifier (React Flow node ID)
- `position`: `{ x, y }` on canvas
- `size`: `{ width, height }` (optional, defaults per type)
- `resourceRef`: `{ type, id }` (optional, links to backend resource)
- `viewMode`: `"compact" | "full" | "maximized"`
- `draft`: Local unsaved state (edit buffer, scrollback cap)

**Examples:** 
- Chat window (no resourceId, messages are child resources)
- Note window (resourceRef: `{ type: "note", id: "abc123" }`)
- Terminal window (no resourceId, ephemeral PTY session)

#### 4.1.2 Resource

A **Resource** is:
- A persisted domain object in the backend (Postgres).
- Independent of any window—can have zero, one, or many window instances.
- Has a unique ID, schema, and lifecycle.

**Properties:**
- `id`: Postgres UUID
- `type`: `"note" | "reminder" | "workflow_run" | "thread" | ...`
- `data`: Type-specific payload
- `createdAt`, `updatedAt`: Timestamps

**Examples:** 
- A note (`id: "abc123"`, `type: "note"`)
- A workflow run (`id: "xyz789"`, `type: "workflow_run"`)
- A thread with messages (`id: "thread1"`, `type: "thread"`)

#### 4.1.3 The "Note is Both" Problem (Solved)

> A note can have **multiple windows** referencing the **same resource**.

| Window Instance | Resource |
|-----------------|----------|
| Note window (edit mode, position A) | → `note:abc123` |
| Note window (view mode, position B) | → `note:abc123` |
| Note window (draft, unsaved) | → (no resourceId yet) |

#### 4.1.4 Edge

An **Edge** is a connection that:
- Links two windows visually on the canvas.
- May be persisted to the backend graph (`memoryEdges`).
- Has a `kind` discriminant and metadata.

**Semantic Edge Kinds:**
| Kind | Direction | Semantics | Persisted? |
|------|-----------|-----------|------------|
| `relates_to` | Bidirectional | General association | Yes |
| `blocks` | Directed | A blocks B | Yes |
| `depends_on` | Directed | A requires B | Yes |
| `data_flow` | Directed | Output of A feeds B | Visual only |
| `explains` | Directed | A provides context for B | Yes |

**Structural Edge Kinds (NEW):**
| Kind | Direction | Semantics | Persisted? |
|------|-----------|-----------|------------|
| `contains` | Directed | A contains B (grouping) | Yes |
| `member_of` | Directed | A is member of B (cluster) | Yes |
| `part_of` | Directed | A is part of B (composition) | Yes |

**Edge Metadata (NEW):**
```typescript
type EdgeMetadata = {
  source: "user" | "assistant" | "import" | "inference";
  confidence?: number;        // 0-1 for inferred edges
  createdAt: string;
  updatedAt?: string;
  scope?: string;             // "runtime:<runId>" for temporary reasoning edges
};
```

#### 4.1.5 Desktop

The **Desktop** is:
- The root container component wrapping React Flow.
- Manages global layout state (viewport, focused window, active edges).
- Renders the Dock and Command Palette.
- Does NOT own resource state (that lives in TanStack DB collections).

#### 4.1.6 Dock

The **Dock** is:
- A fixed UI panel for spawning windows.
- Contains icons for pinned/favorite window types.
- Shows running/active window indicators.

### 4.2 Window Type Taxonomy (Proposed 12 Types)

| Type | Category | Singleton? | Persisted? | Description |
|------|----------|------------|------------|-------------|
| `chat` | Core App | Yes | Partial (messages) | AI conversation interface |
| `terminal` | Core App | Yes | No | PTY shell session |
| `droid` | Core App | Yes | Yes (runId) | Autonomous agent executor |
| `note` | Data Entity | No | Yes | Text note with tags |
| `reminder` | Data Entity | No | Yes | Time-based reminder |
| `todo` | Data Entity | Yes | Yes | Checklist manager |
| `workflow` | Execution | No | Yes | Workflow run instance |
| `settings` | System | Yes | Yes (prefs) | Autonomy, voice, etc. |
| `integrations` | System | Yes | Yes | Linear, GitHub connections |
| `knowledge` | Graph | No | Read-only | RAG/graph-derived fact |
| `concept` | Graph | No | Read-only | Entity/concept from extraction |
| `workflowlist` | View | Yes | No | Filterable list of runs |

**Removed Types:** `orb`, `artifact`, `code`, `ticket`, `timer`, `bookmark`, `privacy`, `profile`, `deployment`

**Rationale:**
- `orb`: Vestigial from WebGPU era. Remove entirely.
- `artifact`, `code`: Unused generic types. Remove.
- `ticket`: Fold into `knowledge` or `concept` (Linear issues are entities).
- `timer`, `bookmark`: Low value, can be features within `note` or separate app later.
- `privacy`, `profile`: Fold into `settings` tabs.
- `deployment`: Move to `integrations` or future DevOps panel.

### 4.3 Resource Types

| Type | Postgres Table | Collection | Description |
|------|---------------|------------|-------------|
| `note` | `note` | `noteCollection` | Text note with tags |
| `reminder` | `reminder` | `reminderCollection` | Time-based reminder |
| `thread` | `thread` + `message` | `threadCollection` | Chat thread with messages |
| `workflow_run` | `workflow_runs` | `workflowCollection` | Workflow execution |
| `preference` | `user_preferences` | (settings window) | User preferences |
| `integration` | `user_integrations` | (integrations window) | OAuth connections |

---

## 5. Source-of-Truth Matrix

> **Critical Section:** This matrix defines where each piece of data lives and how it syncs.

### 5.1 State Ownership

| Data Type | Source of Truth | Local Cache | Sync Strategy |
|-----------|-----------------|-------------|---------------|
| **Layout State** | | | |
| Window positions | Zustand | localStorage | None (UI-only) |
| Window sizes | Zustand | localStorage | None (UI-only) |
| Focused window | Zustand | Memory only | None |
| Dock pins | Zustand | localStorage | None |
| Viewport (pan/zoom) | Zustand | localStorage | None |
| **Domain Resources** | | | |
| Note content | Postgres | TanStack DB Collection | Optimistic mutation |
| Reminder data | Postgres | TanStack DB Collection | Optimistic mutation |
| Chat messages | Postgres | TanStack DB Collection | tRPC subscription |
| Workflow runs | Postgres | TanStack DB Collection | tRPC subscription |
| Workflow events | Postgres | (streamed, not cached) | SSE stream |
| Graph edges | Postgres | TanStack DB Collection | tRPC subscription |
| **Ephemeral State** | | | |
| Terminal scrollback | Memory | Window-local | None (ephemeral) |
| Draft (unsaved edits) | Window-local | Memory | Explicit save |
| Command palette state | Memory | None | None |

### 5.2 Why This Split?

**The Dual-Authority Problem (Avoided):**
```
❌ BEFORE: Local-first for everything
   User edits note → Zustand updates → localStorage saves → tRPC mutation → 
   Subscription receives "same" update → Re-applies to Zustand → Echo/duplicate

✅ AFTER: Layout-first, Backend-first for resources
   User edits note → TanStack DB collection → Optimistic UI → tRPC mutation →
   Server confirms → Collection reconciles (no echo, txid-based idempotency)
```

**Benefits:**
1. **No echo/duplication** — TanStack DB handles optimistic reconciliation with transaction IDs
2. **No localStorage limits** — Only ~50KB of layout state persisted locally
3. **No schema migration pain** — Layout schema is simple and stable
4. **No blocking serialization** — Large payloads never touch localStorage
5. **Clear ownership** — Each piece of data has exactly one authority

### 5.3 localStorage Budget

| Category | Max Size | Contents |
|----------|----------|----------|
| Layout state | 30KB | Window positions, sizes, viewport |
| Dock config | 1KB | Pinned types, order |
| UI preferences | 5KB | Theme, shortcuts, view modes |
| **Total** | **<50KB** | Well under 5MB browser limit |

---

## 6. Architecture Design

### 6.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Browser (Desktop)                              │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                       Desktop Component                             │  │
│  │  ┌─────────────┐  ┌─────────────────────────────────────────────┐  │  │
│  │  │    Dock     │  │            Canvas (React Flow)               │  │  │
│  │  │  [Chat]     │  │  ┌────────┐  ┌────────┐  ┌────────────┐    │  │  │
│  │  │  [Terminal] │  │  │  Chat  │──│  Note  │──│  Workflow  │    │  │  │
│  │  │  [Note]     │  │  │ Window │  │ Window │  │   Window   │    │  │  │
│  │  │  [Workflow] │  │  └────────┘  └────────┘  └────────────┘    │  │  │
│  │  └─────────────┘  │       ▲           │             │           │  │  │
│  │                   │       └───────────┴─────────────┘           │  │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │  │
│  │  │               Command Palette (⌘+K)                        │ │  │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐  │
│  │   Zustand Store (Layout)   │  │   TanStack DB (Domain Resources)   │  │
│  │  ├── windowInstances[]     │  │  ├── noteCollection               │  │
│  │  ├── edges[] (visual only) │  │  ├── reminderCollection           │  │
│  │  ├── focusedWindowId       │  │  ├── threadCollection             │  │
│  │  ├── viewport { x, y, z }  │  │  ├── workflowCollection           │  │
│  │  └── dockPins[]            │  │  └── edgeCollection               │  │
│  │  [Persisted: localStorage] │  │  [Synced: tRPC mutations/queries] │  │
│  └────────────────────────────┘  └────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  tRPC Client (Single WebSocket, Multiplexed)                             │
│  ├── Queries: note.list, remind.due, workflow.list                       │
│  ├── Mutations: note.create, graph.connect, workflow.start               │
│  └── Subscriptions: graph.stream, terminal.events, voice.stream          │
├──────────────────────────────────────────────────────────────────────────┤
│                          Backend (tRPC Routers)                          │
│                          Postgres (Source of Truth)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Component Hierarchy

```
<DesktopRoute>                         # Route: /_protected (now index)
  <Desktop>                            # Root container
    <QueryClientProvider>              # TanStack Query
      <TanStackDBProvider>             # TanStack DB collections
        <ReactFlowProvider>
          <Canvas>                     # React Flow wrapper
            <ReactFlow>
              <Background />
              <Controls />
              <MiniMap />
              {windows.map(w => <WindowFrame {...w} />)}
              {edges.map(e => <LivingEdge {...e} />)}
            </ReactFlow>
            <Dock />                   # Fixed panel
            <CommandPalette />         # Modal overlay
          </Canvas>
        </ReactFlowProvider>
      </TanStackDBProvider>
    </QueryClientProvider>
  </Desktop>
</DesktopRoute>
```

### 6.3 Data Flow Diagram (Revised)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USER ACTION                                   │
└─────────────────────────────────────────────────────────────────────────┘
                    │                               │
         ┌──────────┴───────────┐       ┌──────────┴───────────┐
         │   LAYOUT ACTION      │       │   RESOURCE ACTION    │
         │ (drag, resize, focus)│       │ (create, edit, delete)│
         └──────────┬───────────┘       └──────────┬───────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────────┐
│      Zustand Store            │   │      TanStack DB Collection       │
│   (immediate, no network)     │   │   (optimistic, txid-based)        │
│                               │   │                                   │
│   • Update position/size      │   │   1. Apply optimistic mutation    │
│   • Update focusedWindowId    │   │   2. Call tRPC mutation           │
│   • Persist to localStorage   │   │   3. Reconcile on server confirm  │
└───────────────────────────────┘   └───────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────────┐
                                    │         tRPC Mutation             │
                                    │   (HTTP POST with txid)           │
                                    └───────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────────┐
                                    │      Backend (Postgres)           │
                                    │   (source of truth)               │
                                    └───────────────────────────────────┘
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │   Subscription Broadcast      │
                                    │   (cursor-based, idempotent)  │
                                    └───────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────────────┐
                                    │   TanStack DB Collection          │
                                    │   (reconcile, no echo due to txid)│
                                    └───────────────────────────────────┘
```

**Key Difference from Before:**
- Layout actions NEVER touch the network
- Resource actions use TanStack DB's transaction ID to prevent echo
- Subscriptions use cursor-based resume (see Section 10)

---

## 7. Type System

### 7.1 Core Types (Revised)

```typescript
// apps/web/src/store/desktop.types.ts

import type { Node, Edge } from "@xyflow/react";

/** Window Instance - layout + presentation state */
export type WindowInstance = Node<WindowData>;

/** Window data - what the window knows (NOT the resource) */
export type WindowData = {
  type: WindowType;
  label?: string;
  resourceRef?: ResourceRef;     // Optional pointer to backend resource
  viewMode: "compact" | "full" | "maximized";
  draft?: unknown;               // Local unsaved state (type varies)
};

/** Reference to a backend resource */
export type ResourceRef = {
  type: ResourceType;
  id: string;                    // Postgres UUID
};

/** All window types */
export type WindowType =
  | "chat"
  | "terminal"
  | "droid"
  | "note"
  | "reminder"
  | "todo"
  | "workflow"
  | "workflowlist"
  | "settings"
  | "integrations"
  | "knowledge"
  | "concept";

/** All resource types */
export type ResourceType =
  | "note"
  | "reminder"
  | "thread"
  | "workflow_run"
  | "preference"
  | "integration";

/** Edge with metadata */
export type DesktopEdge = Edge<EdgeData>;

export type EdgeData = {
  kind: EdgeKind;
  metadata?: EdgeMetadata;
  fromResourceId?: string;
  toResourceId?: string;
};

export type EdgeKind =
  // Semantic
  | "relates_to"
  | "blocks"
  | "depends_on"
  | "data_flow"
  | "explains"
  // Structural
  | "contains"
  | "member_of"
  | "part_of";

export type EdgeMetadata = {
  source: "user" | "assistant" | "import" | "inference";
  confidence?: number;
  createdAt: string;
  updatedAt?: string;
  scope?: string;  // "runtime:<runId>" for temporary edges
};

/** Window lifecycle states */
export type WindowState = "spawning" | "active" | "background" | "closing";
```

### 7.2 Window Data Schemas (Layout Only)

```typescript
// apps/web/src/store/desktop.schemas.ts
// NOTE: These schemas are for WINDOW state, not resource data

import { z } from "zod";

const resourceRefSchema = z.object({
  type: z.enum(["note", "reminder", "thread", "workflow_run", "preference", "integration"]),
  id: z.string().uuid(),
});

const baseWindowDataSchema = z.object({
  type: z.string(),
  label: z.string().optional(),
  resourceRef: resourceRefSchema.optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
});

export const chatWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("chat"),
  threadId: z.string().uuid().optional(),  // resourceRef.id alias for convenience
});

export const noteWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("note"),
  draft: z.object({
    title: z.string().optional(),
    content: z.string().optional(),
  }).optional(),  // Local unsaved edits
});

export const terminalWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("terminal"),
  sessionId: z.string().optional(),  // Ephemeral PTY session
});

// ... (other window schemas follow same pattern)
```

### 7.3 Resource Schemas (TanStack DB Collections)

```typescript
// apps/web/src/collections/schemas.ts
// NOTE: These schemas are for RESOURCES, not windows

import { z } from "zod";

export const noteResourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reminderResourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  dueAt: z.string(),
  recurring: z.boolean(),
  completed: z.boolean(),
  createdAt: z.string(),
});

export const threadResourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  messages: z.array(uiMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ... (other resource schemas)
```

### 7.4 Window Type Registry

```typescript
// apps/web/src/components/windows/registry.ts

export const windowRegistry = {
  chat: { component: ChatWindow, singleton: true, icon: MessageSquare },
  terminal: { component: TerminalWindow, singleton: true, icon: TerminalSquare },
  note: { component: NoteWindow, singleton: false, icon: FileText },
  reminder: { component: ReminderWindow, singleton: false, icon: Bell },
  workflow: { component: WorkflowWindow, singleton: false, icon: GitBranch },
  // ...
} as const;

export type WindowType = keyof typeof windowRegistry;
```

---

## 8. State Management

### 8.1 Two-Store Architecture

> **Key Change:** We split state into two stores with different responsibilities.

| Store | Purpose | Persistence | Sync |
|-------|---------|-------------|------|
| **Zustand** | Layout state | localStorage | None (UI-only) |
| **TanStack DB** | Domain resources | In-memory cache | tRPC mutations |

### 8.2 Zustand Store (Layout Only)

```typescript
// apps/web/src/store/desktop.ts
// NOTE: This store ONLY manages layout, not resource data

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useDesktopStore = create<DesktopState>()(
  persist(
    (...a) => ({
      ...createWindowSlice(...a),    // windows (nodes), visual edges
      ...createViewportSlice(...a),  // zoom, pan, focused
      ...createDockSlice(...a),      // pinned types, spawn
    }),
    {
      name: "desktop-layout-v1",
      version: 1,
      partialize: (state) => ({
        // ONLY persist layout-relevant data
        windows: state.windows.map(sanitizeWindowForPersist),
        edges: state.edges.filter(e => !e.data?.scope), // Exclude runtime edges
        focusedWindowId: state.focusedWindowId,
        viewport: state.viewport,
        dockPins: state.dockPins,
      }),
    }
  )
);

function sanitizeWindowForPersist(window: WindowInstance): WindowInstance {
  return {
    ...window,
    data: {
      type: window.data.type,
      label: window.data.label,
      resourceRef: window.data.resourceRef,
      viewMode: window.data.viewMode,
      // EXCLUDE draft state - it's transient
    },
  };
}
```

### 8.3 Slice Definitions (Revised)

#### Window Slice (Layout Only)

```typescript
type WindowSlice = {
  windows: WindowInstance[];
  edges: DesktopEdge[];           // Visual edges only
  
  // Layout mutations (no network)
  addWindow: (window: WindowInstance) => void;
  removeWindow: (windowId: string) => void;
  updateWindowPosition: (windowId: string, position: Position) => void;
  updateWindowSize: (windowId: string, size: Size) => void;
  updateWindowViewMode: (windowId: string, mode: ViewMode) => void;
  
  // Draft state (local, not persisted)
  setWindowDraft: (windowId: string, draft: unknown) => void;
  clearWindowDraft: (windowId: string) => void;
  
  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
};
```

#### Viewport Slice

```typescript
type ViewportSlice = {
  focusedWindowId: string | null;
  viewport: { x: number; y: number; zoom: number };
  
  focusWindow: (windowId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  fitView: (windowIds?: string[]) => void;
};
```

#### Dock Slice

```typescript
type DockSlice = {
  dockPins: WindowType[];
  
  pinType: (type: WindowType) => void;
  unpinType: (type: WindowType) => void;
  spawnWindow: (type: WindowType, resourceRef?: ResourceRef, position?: Position) => string;
};
```

### 8.4 What NOT to Store in Zustand

| Data | Why NOT Zustand | Where Instead |
|------|-----------------|---------------|
| Note content | Large, changes frequently | TanStack DB `noteCollection` |
| Chat messages | Can be very large | TanStack DB `threadCollection` |
| Workflow events | Streamed, transient | SSE stream (not cached) |
| Graph edges (persisted) | Backend is truth | TanStack DB `edgeCollection` |
| User preferences | Backend sync needed | TanStack DB or direct tRPC |

---

## 9. Data Layer & TanStack DB

> **Status:** TanStack DB is in **beta** (v0.x). API is stabilizing but may have breaking changes.

### 9.1 Why TanStack DB?

TanStack DB solves the **dual-authority problem** identified in the AI review:

| Problem | Zustand-Only Solution | TanStack DB Solution |
|---------|----------------------|---------------------|
| Echo/duplication | Manual dedup logic | Transaction IDs (txid) auto-reconcile |
| Optimistic updates | Custom rollback code | Built-in optimistic state with `isPersisted.promise` |
| Schema validation | Manual Zod checks | Any Standard Schema (Zod, Valibot, etc.) |
| Query derivation | Manual selectors | `useLiveQuery` with SQL-like query builder |
| Rollback on error | Manual context passing | Automatic rollback via `SchemaValidationError`, `DuplicateKeyError` |

### 9.2 Package Architecture

TanStack DB is modular with different collection types:

```bash
# Core packages (required)
npm install @tanstack/react-db

# Collection adapters (choose based on backend)
npm install @tanstack/query-db-collection    # For TanStack Query integration
# OR
npm install @tanstack/electric-db-collection # For ElectricSQL real-time sync
```

**Available Collection Types:**

| Collection | Use Case | Real-time Sync |
|------------|----------|----------------|
| `queryCollectionOptions` | TanStack Query integration (our choice) | Polling or manual |
| `electricCollectionOptions` | ElectricSQL real-time sync | Yes (txid matching) |
| `localStorageCollectionOptions` | Browser localStorage | No |
| `localOnlyCollectionOptions` | In-memory only | No |

**Our Choice:** `queryCollectionOptions` with tRPC because:
1. Already using TanStack Query via tRPC
2. Can add real-time via tRPC subscriptions
3. No ElectricSQL infrastructure needed

### 9.3 Collection Architecture (Corrected)

```typescript
// apps/web/src/collections/note.ts

import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { QueryClient } from "@tanstack/react-query";
import { noteResourceSchema } from "./schemas";
import { trpc } from "@/utils/trpc";

// Shared QueryClient instance
const queryClient = new QueryClient();

export const noteCollection = createCollection(
  queryCollectionOptions({
    id: "notes",                              // Unique collection ID
    queryKey: ["notes"],                      // TanStack Query cache key
    queryClient,                              // Shared QueryClient
    getKey: (note) => note.id,                // How to identify items
    schema: noteResourceSchema,               // Zod schema for validation
    
    queryFn: async () => {
      // Fetch initial data via tRPC
      const notes = await trpc.note.list.query();
      return notes;
    },
    
    // Called BEFORE insert - persist to backend
    onInsert: async ({ transaction }) => {
      const newNote = transaction.mutations[0].modified;
      const result = await trpc.note.create.mutate({
        title: newNote.title,
        content: newNote.content,
        tags: newNote.tags,
      });
      // Return refetch: false to skip automatic refetch
      // (we'll update via subscription instead)
      return { refetch: false };
    },
    
    // Called BEFORE update
    onUpdate: async ({ transaction }) => {
      const { original, changes } = transaction.mutations[0];
      await trpc.note.update.mutate({
        id: original.id,
        ...changes,
      });
      return { refetch: false };
    },
    
    // Called BEFORE delete
    onDelete: async ({ transaction }) => {
      const { original } = transaction.mutations[0];
      await trpc.note.delete.mutate({ id: original.id });
      return { refetch: false };
    },
  })
);
```

### 9.4 useLiveQuery API (Corrected)

```tsx
// apps/web/src/components/windows/note/note-window.tsx

import { useLiveQuery } from "@tanstack/react-db";
import { noteCollection } from "@/collections/note";

export function NoteWindow({ id, data }: WindowProps<NoteWindowData>) {
  const { resourceRef } = data;
  
  // Live query - automatically updates when collection changes
  // Returns { data, collection, isReady, status, isError, isLoading }
  const { data: note, isLoading, isError } = useLiveQuery((q) =>
    q
      .from({ note: noteCollection })
      .where(({ note }) => note.id === resourceRef?.id)
      .select(({ note }) => note)
  );
  
  // Access the first result (query returns array)
  const noteData = note?.[0];
  
  // Optimistic insert - applies immediately, persists async
  const handleCreate = async (newNote: Omit<NoteResource, "id">) => {
    try {
      const tx = await noteCollection.insert({
        id: crypto.randomUUID(),
        ...newNote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      
      // Optional: wait for persistence to complete
      await tx.isPersisted.promise;
      
      // Update window to reference new resource
      useDesktopStore.getState().updateWindow(id, {
        resourceRef: { type: "note", id: tx.key },
      });
    } catch (error) {
      if (error instanceof SchemaValidationError) {
        toast.error(`Validation: ${error.issues[0]?.message}`);
      } else if (error instanceof DuplicateKeyError) {
        toast.error("Note already exists");
      } else {
        toast.error("Failed to create note");
      }
    }
  };
  
  // Optimistic update with draft function
  const handleUpdate = (noteId: string, changes: Partial<NoteResource>) => {
    noteCollection.update(noteId, (draft) => {
      Object.assign(draft, changes);
      draft.updatedAt = new Date().toISOString();
    });
  };
  
  // Delete
  const handleDelete = (noteId: string) => {
    noteCollection.delete({ id: noteId });
  };
  
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState />;
  
  return (
    <WindowFrame id={id} title={noteData?.title || "Untitled"}>
      <NoteEditor
        note={noteData}
        onSave={handleUpdate}
        onDelete={handleDelete}
      />
    </WindowFrame>
  );
}
```

### 9.5 createOptimisticAction for Multi-Collection Mutations

For actions that mutate multiple collections transactionally:

```typescript
// apps/web/src/collections/actions.ts

import { createOptimisticAction } from "@tanstack/react-db";
import { noteCollection } from "./note";
import { edgeCollection } from "./edge";

// Create a note and link it to another node in one action
export const createLinkedNote = createOptimisticAction({
  // Runs immediately (optimistic)
  onMutate: ({ title, linkedToId }) => {
    const noteId = crypto.randomUUID();
    
    // Insert note optimistically
    noteCollection.insert({
      id: noteId,
      title,
      content: "",
      createdAt: new Date().toISOString(),
    });
    
    // Insert edge optimistically
    edgeCollection.insert({
      id: crypto.randomUUID(),
      source: linkedToId,
      target: noteId,
      kind: "relates_to",
    });
    
    return { noteId }; // Context for mutationFn
  },
  
  // Runs async (persist to backend)
  mutationFn: async ({ title, linkedToId }, context) => {
    // Backend creates both in transaction
    const result = await trpc.note.createLinked.mutate({
      title,
      linkedToId,
    });
    // Return result for reconciliation
    return result;
  },
});

// Usage in component:
const handleCreateLinked = () => {
  createLinkedNote({ title: "New Note", linkedToId: selectedNodeId });
};
```

### 9.6 Subscription Integration (Corrected)

```typescript
// apps/web/src/hooks/use-collection-sync.ts

import { noteCollection } from "@/collections/note";
import { edgeCollection } from "@/collections/edge";

export function useCollectionSync() {
  // Subscribe to note changes
  trpc.note.onUpdate.useSubscription(undefined, {
    onData: (event) => {
      switch (event.type) {
        case "created":
          // Collection may already have this via optimistic insert
          // Insert is idempotent by key
          noteCollection.insert(event.note);
          break;
        case "updated":
          noteCollection.update(event.note.id, () => event.note);
          break;
        case "deleted":
          noteCollection.delete({ id: event.noteId });
          break;
      }
    },
  });

  // Subscribe to edge changes
  trpc.graph.onEdgeChange.useSubscription(undefined, {
    onData: (event) => {
      switch (event.type) {
        case "created":
          edgeCollection.insert(event.edge);
          break;
        case "deleted":
          edgeCollection.delete({ id: event.edgeId });
          break;
      }
    },
  });
}
```

### 9.7 Multiple Reactive Views from One Collection

```tsx
// One collection, three reactive views
function WorkflowDashboard() {
  // All workflows
  const { data: allWorkflows } = useLiveQuery((q) =>
    q.from({ wf: workflowCollection })
  );
  
  // Only running
  const { data: running } = useLiveQuery((q) =>
    q
      .from({ wf: workflowCollection })
      .where(({ wf }) => wf.status === "running")
  );
  
  // Only failed (last 24h)
  const { data: failed } = useLiveQuery((q) =>
    q
      .from({ wf: workflowCollection })
      .where(({ wf }) => 
        wf.status === "failed" && 
        new Date(wf.updatedAt) > new Date(Date.now() - 86400000)
      )
  );
  
  // All three update automatically when collection changes
}
```

### 9.8 Error Handling Best Practices

```typescript
import { 
  SchemaValidationError, 
  DuplicateKeyError 
} from "@tanstack/react-db";

async function safeInsert(data: NoteInput) {
  try {
    const tx = await noteCollection.insert(data);
    await tx.isPersisted.promise;
    return { success: true, id: tx.key };
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      // Validation failed - show field-level errors
      return { 
        success: false, 
        errors: error.issues.map(i => ({ field: i.path, message: i.message }))
      };
    }
    if (error instanceof DuplicateKeyError) {
      // Duplicate ID - retry with new ID
      return safeInsert({ ...data, id: crypto.randomUUID() });
    }
    // Unknown error
    throw error;
  }
}
```

### 9.9 Migration Path (Updated)

| Phase | Action | Effort |
|-------|--------|--------|
| 1 | Install `@tanstack/react-db` and `@tanstack/query-db-collection` | 10 min |
| 2 | Create `collections/` folder with `note.ts` | 1 hour |
| 3 | Add `noteResourceSchema` with Zod | 30 min |
| 4 | Migrate `NoteWindow` to use `useLiveQuery` | 2 hours |
| 5 | Test optimistic updates and rollback | 1 hour |
| 6 | Remove note data from Zustand store | 30 min |
| 7 | Repeat for reminder, thread, workflow, edge | 4 hours |
| 8 | Add `useCollectionSync` for real-time updates | 2 hours |
| 9 | Verify localStorage size is <50KB | 30 min |

**Total estimated effort:** ~12 hours

### 9.10 TanStack DB Considerations & Limitations

**Beta Status:**
- TanStack DB is v0.x (beta) as of December 2025
- API may have breaking changes
- Monitor changelog before upgrading

**When to Use queryCollectionOptions (Our Choice):**
- Already using TanStack Query
- Backend is tRPC/REST (not ElectricSQL)
- Manual control over sync timing
- Polling or subscription-based updates

**When to Use electricCollectionOptions Instead:**
- Using ElectricSQL for real-time Postgres sync
- Need automatic txid matching
- High-frequency updates (100+ per second)

**Important Caveats:**
1. **No automatic refetch by default** — `onInsert`/`onUpdate`/`onDelete` return `{ refetch: false }` to skip
2. **Optimistic state is temporary** — Cleared on next sync or error
3. **Schema required for validation** — Without schema, any data is accepted
4. **QueryClient must be shared** — Pass same instance to all collections

---

## 10. Subscription Protocol Contract

### 10.1 Why This Matters

> "Without a subscription protocol contract, subscription-over-polling becomes fragile at scale even with one user." — AI Review

### 10.2 Protocol Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Cursor-based resume** | Every event includes `cursor` (monotonic sequence) |
| **Idempotent merge** | Events keyed by `id`; re-applying same event is no-op |
| **Snapshot vs delta** | On reconnect: delta if cursor valid, snapshot if stale |
| **Backpressure** | Server coalesces bursts (max 10 events/100ms) |
| **Ordering guarantee** | Events ordered by `seq`; client buffers out-of-order |

### 10.3 Event Schema

```typescript
// packages/type/src/subscription.ts

export type SubscriptionEvent<T> = {
  type: "delta" | "snapshot";
  cursor: string;        // Monotonic, resumable
  seq: number;           // For ordering
  timestamp: string;     // ISO-8601
  payload: T;
};

export type GraphEvent = SubscriptionEvent<
  | { action: "edge_created"; edge: EdgeResource }
  | { action: "edge_deleted"; edgeId: string }
  | { action: "edge_updated"; edge: Partial<EdgeResource> & { id: string } }
>;

export type WorkflowEvent = SubscriptionEvent<
  | { action: "run_started"; run: WorkflowRun }
  | { action: "run_completed"; runId: string; status: "completed" | "failed" }
  | { action: "event"; runId: string; event: WorkflowStepEvent }
>;
```

### 10.4 Reconnection Flow

```
Client                          Server
  │                               │
  │──── Subscribe(cursor=X) ────▶│
  │                               │
  │◀─── Delta(cursor=X+1) ───────│  (if cursor valid)
  │◀─── Delta(cursor=X+2) ───────│
  │                               │
  │        [disconnect]           │
  │                               │
  │──── Subscribe(cursor=X+2) ──▶│
  │                               │
  │◀─── Delta(cursor=X+3) ───────│  (cursor still valid)
  │                               │
  │        [long disconnect]      │
  │                               │
  │──── Subscribe(cursor=X+3) ──▶│
  │                               │
  │◀─── Snapshot(cursor=Y) ──────│  (cursor expired, full refresh)
```

### 10.5 Backend Implementation Notes

```typescript
// packages/api/src/routers/graph.ts

export const graphRouter = router({
  stream: protectedProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .subscription(async function* ({ input, ctx }) {
      const { cursor } = input;
      
      // Check if cursor is still valid
      const cursorAge = await getCursorAge(cursor);
      if (!cursor || cursorAge > MAX_CURSOR_AGE_MS) {
        // Send full snapshot
        const edges = await ctx.db.query.memoryEdges.findMany();
        const newCursor = generateCursor();
        yield {
          type: "snapshot",
          cursor: newCursor,
          seq: 0,
          timestamp: new Date().toISOString(),
          payload: { edges },
        };
      }
      
      // Stream deltas
      for await (const event of subscribeToEdgeChanges(cursor)) {
        yield {
          type: "delta",
          cursor: event.cursor,
          seq: event.seq,
          timestamp: event.timestamp,
          payload: event,
        };
      }
    }),
});
```

### 10.6 Single WebSocket, Multiplexed Streams

Instead of N subscriptions per node type, use ONE WebSocket with stream multiplexing:

```typescript
// apps/web/src/lib/subscription-manager.ts

export const subscriptionManager = {
  streams: new Map<string, Subscription>(),
  
  subscribe(streamId: string, handler: (event: any) => void) {
    // Reuse existing connection, add stream
    if (!this.ws) {
      this.ws = createWebSocket();
    }
    this.ws.send({ type: "subscribe", streamId });
    this.streams.set(streamId, { handler });
  },
  
  unsubscribe(streamId: string) {
    this.ws?.send({ type: "unsubscribe", streamId });
    this.streams.delete(streamId);
  },
};
```

---

## 11. Component Architecture

### 11.1 WindowFrame Wrapper

> **Renamed from AppWindow:** Emphasizes it's a frame for windows, not an "app".

All windows share a common chrome:

```tsx
// apps/web/src/components/windows/shared/window-frame.tsx

type WindowFrameProps = {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  width?: number;
  height?: number;
  resizable?: boolean;
  closable?: boolean;
  modes?: ("compact" | "full" | "maximized")[];
};

export function WindowFrame({
  id,
  title,
  icon,
  children,
  actions,
  footer,
  width = 400,
  height,
  resizable = true,
  closable = true,
  modes = ["compact", "full"],
}: WindowFrameProps) {
  const { isFocused, isDimmed } = useWindowFocus(id);
  const lod = useLOD();
  const removeWindow = useDesktopStore((s) => s.removeWindow);
  const viewMode = useDesktopStore((s) => 
    s.windows.find(w => w.id === id)?.data.viewMode ?? "full"
  );
  const setViewMode = useDesktopStore((s) => s.updateWindowViewMode);
  
  // LOD 0: Tiny (zoomed out far)
  if (lod === "tiny") {
    return <TinyDot color={getWindowColor(title)} />;
  }
  
  // LOD 1: Small (zoomed out)
  if (lod === "small") {
    return <SmallCard icon={icon} label={title} />;
  }
  
  // LOD 2+: Full window
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border bg-void-surface/40 backdrop-blur-xl",
        "transition-all duration-200",
        isFocused && "ring-2 ring-biolum",
        isDimmed && "opacity-20 blur-sm scale-95"
      )}
      style={{ width, height }}
    >
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 drag-handle">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-biolum tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* View Mode Toggle */}
          {modes.length > 1 && (
            <ViewModeToggle 
              current={viewMode} 
              modes={modes}
              onChange={(mode) => setViewMode(id, mode)} 
            />
          )}
          {actions}
          {closable && (
            <button 
              onClick={() => removeWindow(id)}
              className="hover:text-red-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto">{children}</div>
      
      {/* Footer */}
      {footer && (
        <div className="border-t border-white/10 px-4 py-2 text-xs text-biolum-dim">
          {footer}
        </div>
      )}
      
      {/* Resize Handle */}
      {resizable && <ResizeHandle />}
    </div>
  );
}
```

### 11.2 Window Component Pattern

Each window follows this structure (NOTE: uses TanStack DB, not Zustand for resource data):

```tsx
// apps/web/src/components/windows/note/note-window.tsx

export function NoteWindow({ id, data }: WindowProps<NoteWindowData>) {
  // 1. Layout hooks (always called)
  const lod = useLOD();
  useWindowFocus(id);
  
  // 2. Resource data from TanStack DB (NOT Zustand)
  const { data: note, isLoading } = useLiveQuery((q) =>
    q.from({ note: noteCollection })
      .where(({ note }) => eq(note.id, data.resourceRef?.id))
      .select(({ note }) => note)
      .first()
  );
  
  // 3. Local draft state (window-specific, not persisted)
  const draft = useDesktopStore((s) => 
    s.windows.find(w => w.id === id)?.data.draft
  );
  const setDraft = useDesktopStore((s) => s.setWindowDraft);
  
  // 4. Optimistic save via collection
  const handleSave = () => {
    if (note?.id) {
      noteCollection.update({ id: note.id, ...draft });
    } else {
      noteCollection.insert({ ...draft, id: crypto.randomUUID() });
    }
    setDraft(id, null);
  };
  
  // 5. LOD early returns
  if (lod === "tiny") return <TinyDot color="yellow" />;
  if (lod === "small") return <SmallCard label={note?.title || "Note"} />;
  
  // 6. Full render
  return (
    <WindowFrame id={id} title={note?.title || "Untitled Note"} icon={<FileText />}>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <NoteEditor 
          value={draft ?? note} 
          onChange={(v) => setDraft(id, v)}
          onSave={handleSave}
        />
      )}
    </WindowFrame>
  );
}
```

### 11.3 Dock Component

```tsx
// apps/web/src/components/desktop/dock.tsx

export function Dock() {
  const { dockPins, spawnWindow } = useDesktopStore(
    useShallow((s) => ({
      dockPins: s.dockPins,
      spawnWindow: s.spawnWindow,
    }))
  );
  
  // Derive running windows from layout store
  const runningTypes = useDesktopStore((s) => 
    new Set(s.windows.map(w => w.data.type))
  );
  
  return (
    <Panel position="bottom-center">
      <div className="flex gap-2 rounded-full bg-void-surface/80 p-2 backdrop-blur">
        {dockPins.map((type) => (
          <DockIcon
            key={type}
            type={type}
            isRunning={runningTypes.has(type)}
            onClick={() => spawnWindow(type)}
          />
        ))}
      </div>
    </Panel>
  );
}
```

### 11.4 WindowFrame Presentation Modes

> **AI Feedback:** "Make presentation modes first-class: windowed / frameless / fullscreen / docked"

```typescript
type PresentationMode = 
  | "windowed"      // Standard window chrome
  | "frameless"     // Content only (terminal maximized)
  | "fullscreen"    // Portal overlay, exits canvas
  | "docked";       // Snapped to canvas edge

// Usage in terminal:
<WindowFrame 
  modes={["windowed", "frameless", "fullscreen"]}
  // ...
/>
```

### 11.5 Keep WindowFrame Thin

> **AI Warning:** "WindowFrame becomes a 'god wrapper' that owns behaviors apps should control"

**WindowFrame SHOULD handle:**
- Focus/dimming rules
- Resize/drag affordances
- LOD switching
- Title bar chrome
- View mode toggle

**WindowFrame should NOT handle:**
- Resource CRUD (that's the window's job)
- Network calls (collection handles this)
- Keyboard shortcuts (registered globally)
- Custom toolbars (passed as `actions` prop)

---

## 12. Performance Patterns

> **AI Feedback:** "LOD is necessary, not sufficient. What will still kill you at 500 nodes: edge rendering, state update fan-out, and re-render storms from array churn."

### 12.1 State Normalization

**Problem:** Arrays cause O(n) re-renders when any item changes.

**Solution:** Store windows and edges as Maps, derive arrays only for React Flow.

```typescript
// apps/web/src/store/desktop.ts

type NormalizedState = {
  windowsById: Map<string, WindowInstance>;
  edgesById: Map<string, DesktopEdge>;
};

// Derived arrays (memoized)
const selectWindowsArray = (state: DesktopState) =>
  Array.from(state.windowsById.values());

const selectEdgesArray = (state: DesktopState) =>
  Array.from(state.edgesById.values());

// In component:
const windows = useDesktopStore(selectWindowsArray, shallow);
```

### 12.2 Per-Window Subscriptions

**Problem:** Changing one window re-renders all 500 siblings.

**Solution:** Each window component selects only its own data.

```typescript
// In NoteWindow:
const windowData = useDesktopStore(
  useCallback((s) => s.windowsById.get(id)?.data, [id]),
  shallow
);

// NOT this (causes all windows to re-render):
const allWindows = useDesktopStore((s) => s.windows);
const myWindow = allWindows.find(w => w.id === id);
```

### 12.3 Edge Degradation

**Problem:** Edges are often the real performance cliff (1000+ SVG paths).

**Solution:** Hide or aggregate edges when zoomed out.

```typescript
// apps/web/src/components/desktop/canvas.tsx

function Canvas() {
  const zoom = useViewport().zoom;
  const edges = useDesktopStore(selectEdgesArray);
  
  // Hide edges when zoomed out
  const visibleEdges = useMemo(() => {
    if (zoom < 0.3) return []; // No edges at tiny LOD
    if (zoom < 0.6) {
      // Aggregate: show only "important" edges
      return edges.filter(e => e.data?.kind === "blocks" || e.data?.kind === "depends_on");
    }
    return edges;
  }, [edges, zoom]);
  
  return <ReactFlow edges={visibleEdges} /* ... */ />;
}
```

### 12.4 Viewport Culling

**Problem:** React Flow renders all nodes, even those off-screen.

**Solution:** Ensure `onlyRenderVisibleElements` is enabled (default in v12).

```tsx
<ReactFlow
  nodes={windows}
  edges={visibleEdges}
  onlyRenderVisibleElements={true}  // Default in v12
  nodeExtent={[[-10000, -10000], [10000, 10000]]}  // Bound the canvas
/>
```

### 12.5 Worker Offloading

**Problem:** Layout/physics computations block main thread.

**Solution:** Run Dagre layout in a Web Worker.

```typescript
// apps/web/src/workers/layout.worker.ts
import Dagre from "@dagrejs/dagre";

self.onmessage = (e: MessageEvent<LayoutInput>) => {
  const { nodes, edges, direction } = e.data;
  const result = runDagreLayout(nodes, edges, direction);
  self.postMessage(result);
};

// In component:
const layoutWorker = useMemo(() => new Worker(
  new URL("../workers/layout.worker.ts", import.meta.url)
), []);

const runLayout = useCallback((nodes, edges) => {
  layoutWorker.postMessage({ nodes, edges, direction: "TB" });
}, [layoutWorker]);

useEffect(() => {
  layoutWorker.onmessage = (e) => setNodes(e.data.nodes);
}, [layoutWorker]);
```

### 12.6 Performance Budgets

| Operation | Budget | Measurement |
|-----------|--------|-------------|
| Add window | <10ms | `performance.now()` |
| Update window position | <5ms | React DevTools Profiler |
| Zoom/pan frame | <16ms | FPS counter |
| Full layout (50 nodes) | <100ms | Worker postMessage round-trip |
| Edge render (100 edges) | <16ms | React DevTools |
| Collection query | <5ms | TanStack DB devtools |

### 12.7 Scale Testing

| Nodes | Expected FPS | Actions |
|-------|--------------|---------|
| 50 | 60 | Baseline |
| 100 | 60 | Verify LOD kicks in |
| 200 | 60 | Verify edge degradation |
| 500 | 30-60 | Acceptable degradation |
| 1000 | 30 | Investigate further optimizations |

**Testing script:**
```bash
# Generate test data
bun run scripts/generate-test-nodes.ts --count=500

# Profile
bun run dev
# Open Chrome DevTools > Performance > Record
# Zoom in/out, pan, create/delete windows
```

---

## 13. UI/UX Specifications

### 13.1 Design System (Signal in the Void)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-void` | `oklch(0.05 0 0)` | Background |
| `--color-void-surface` | `oklch(0.14 0 0)` | Card/window bg |
| `--color-biolum` | `oklch(0.99 0 0)` | Primary text |
| `--color-biolum-dim` | `oklch(0.70 0 0)` | Secondary text |
| `--color-biolum-faint` | `oklch(0.40 0 0)` | Disabled/hint |
| `--radius-3xl` | `24px` | Window corners |
| `--ease-fluid` | `cubic-bezier(0.25, 0.4, 0.25, 1)` | Transitions |

### 13.2 Level of Detail (LOD)

| Zoom Level | LOD | Rendering |
|------------|-----|-----------|
| < 0.3 | `tiny` | 8px colored dot |
| 0.3 - 0.6 | `small` | Icon + label badge |
| 0.6 - 1.0 | `medium` | Compact card |
| > 1.0 | `full` | Full window |

### 13.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘+K` | Open command palette |
| `⌘+N` | New note window |
| `⌘+T` | New terminal window |
| `⌘+Enter` | Send message (in chat) |
| `Space` (hold) | Push-to-talk |
| `Escape` | Unfocus current window / close palette |
| `Delete` / `Backspace` | Close focused window |
| `⌘+W` | Close focused window |
| `⌘+1-9` | Focus dock item N |

### 13.4 Window Management

- **Dragging:** Standard React Flow drag behavior.
- **Resizing:** Bottom-right handle, snaps to 50px grid.
- **Focusing:** Click to focus, dim all other nodes.
- **Closing:** X button or Delete key.
- **Spawning:** Dock click or Command Palette spawns at viewport center.

---

## 14. File Structure

### 14.1 Proposed Structure (Revised)

```
apps/web/src/
├── routes/
│   ├── __root.tsx                    # Root layout
│   ├── _protected.tsx                # Auth guard
│   ├── _protected/
│   │   ├── index.tsx                 # Desktop route (was mindscape.tsx)
│   │   └── workflow.$runId.tsx       # Workflow detail route
│   ├── login.tsx                     # Login page
│   └── api/                          # API routes
│
├── collections/                      # NEW: TanStack DB collections
│   ├── index.ts                      # Export all collections
│   ├── schemas.ts                    # Resource Zod schemas
│   ├── note.ts                       # noteCollection
│   ├── reminder.ts                   # reminderCollection
│   ├── thread.ts                     # threadCollection (chat)
│   ├── workflow.ts                   # workflowCollection
│   └── edge.ts                       # edgeCollection
│
├── components/
│   ├── desktop/                      # Desktop-level components
│   │   ├── desktop.tsx               # Root desktop container
│   │   ├── canvas.tsx                # React Flow wrapper
│   │   ├── dock.tsx                  # Window launcher dock
│   │   ├── command-palette.tsx       # ⌘+K palette
│   │   └── living-edge.tsx           # Edge component
│   │
│   ├── windows/                      # Window components (was mindscape/nodes/)
│   │   ├── shared/
│   │   │   ├── window-frame.tsx      # Shared window chrome (was app-window)
│   │   │   ├── lod.tsx               # LOD hooks
│   │   │   ├── error-boundary.tsx    # Window error boundary
│   │   │   ├── resize-handle.tsx     # Window resize handle
│   │   │   └── view-mode-toggle.tsx  # Compact/full/maximized toggle
│   │   ├── chat/
│   │   │   └── chat-window.tsx       # (was chat-node.tsx)
│   │   ├── terminal/
│   │   │   └── terminal-window.tsx   # (was terminal-node.tsx)
│   │   ├── note/
│   │   │   └── note-window.tsx       # (was note-node.tsx)
│   │   ├── reminder/
│   │   │   └── reminder-window.tsx   # (was reminder-node.tsx)
│   │   ├── workflow/
│   │   │   ├── workflow-window.tsx   # (was workflow-node.tsx)
│   │   │   └── workflow-list-window.tsx
│   │   ├── droid/
│   │   │   └── droid-window.tsx      # (was droid-node.tsx)
│   │   ├── knowledge/
│   │   │   ├── knowledge-window.tsx  # (was knowledge-node.tsx)
│   │   │   └── concept-window.tsx    # (was concept-node.tsx)
│   │   ├── settings/
│   │   │   └── settings-window.tsx   # Absorbs privacy/profile
│   │   ├── integrations/
│   │   │   └── integrations-window.tsx
│   │   ├── todo/
│   │   │   └── todo-window.tsx
│   │   └── registry.ts               # Window type registry
│   │
│   ├── ui/                           # Shadcn primitives
│   └── ai-elements/                  # AI chat components
│
├── store/
│   ├── desktop.ts                    # Main store (LAYOUT ONLY)
│   ├── desktop/
│   │   ├── windows.ts                # Window slice (was graph.ts)
│   │   ├── viewport.ts               # Viewport slice
│   │   ├── dock.ts                   # Dock slice
│   │   ├── persist.ts                # Persistence config (<50KB layout)
│   │   └── types.ts                  # State types
│   └── desktop.schemas.ts            # Window data Zod schemas
│
├── hooks/
│   ├── use-graph-subscription.ts     # Graph edge subscription
│   ├── use-window-spawn.ts           # Window spawning logic
│   ├── use-voice.ts                  # WebSocket-only voice
│   ├── use-chat-logic.ts             # Chat orchestration
│   ├── use-window-focus.ts           # Focus/dimming state
│   └── use-lod.ts                    # Level of detail hook
│
├── workers/                          # NEW: Web Workers
│   └── layout.worker.ts              # Dagre layout offloading
│
├── lib/
│   ├── layout.ts                     # Dagre layout
│   ├── subscription-manager.ts       # Single WS, multiplexed streams
│   ├── utils.ts                      # cn() helper
│   └── env/                          # Environment utils
│
└── utils/
    ├── trpc.ts                       # tRPC client
    └── voice-stream.ts               # Voice WebSocket URL
```

### 14.2 Deletion Manifest

See Section 15 for detailed removal manifest.

---

## 15. Code Removal Manifest

### 15.1 Files to Delete Completely

| File | Lines | Reason |
|------|-------|--------|
| `routes/index.tsx` | 237 | WebGPU landing page replaced |
| `lib/mindscape/gpu/engine.ts` | ~400 | WebGPU engine unused |
| `lib/mindscape/gpu/*.ts` | ~400 | Supporting WebGPU files |
| `components/mindscape/initializer.tsx` | 542 | Polling replaced by subscription |
| `components/mindscape/detail-panel.tsx` | 526 | Context-lens pattern removed |
| `hooks/use-physics-worker.ts` | 144 | Always disabled |

### 15.2 Files to Refactor

| File | Changes |
|------|---------|
| `components/mindscape/canvas.tsx` | Move to `components/desktop/canvas.tsx`, remove initializer imports |
| `store/mindscape.ts` | Rename to `store/desktop.ts` |
| `hooks/use-voice-session-web.ts` | Rewrite to use only WebSocket protocol |

### 15.3 Dead Code Patterns to Remove

```typescript
// Remove all instances of:

// 1. Legacy voice stubs
start: async () => {},
stopAndTranscribe: async () => {},
speechToSpeech: async () => {},

// 2. Disabled physics
usePhysicsWorker({ ..., active: false });

// 3. window.location.assign (use navigate() instead)
window.location.assign(`/workflow/${runId}`);

// 4. Test mode early returns in components
if (import.meta.env.VITE_TEST_MODE === "true") {
  return <TestModeComponent />;
}
```

---

## 16. Migration Strategy

### 16.1 Phase 0: Preparation (1 day)

1. Create feature branch: `feat/desktop-ui-paradigm`.
2. Document current test coverage.
3. Backup existing store schema version.

### 16.2 Phase 1: Store & Types (1 day)

1. Rename `mindscape.*` files to `desktop.*`.
2. Update imports across codebase.
3. Remove unused node types from schema.
4. Run type checker, fix errors.

### 16.3 Phase 2: TanStack DB Integration (2 days)

> **NEW PHASE:** Install and configure TanStack DB

1. Install `@tanstack/react-db` and `@tanstack/query-db-collection`.
2. Create `collections/` folder with note, reminder, thread, workflow, edge collections.
3. Create resource schemas in `collections/schemas.ts` using Zod.
4. Wire collections to tRPC mutations via `onInsert`/`onUpdate`/`onDelete`.

### 16.4 Phase 3: Component Restructure (2 days)

1. Create `components/desktop/` folder.
2. Create `WindowFrame` wrapper component.
3. Move and rename node components to `windows/`.
4. Create `registry.ts` with reduced window types.
5. Update windows to use `useLiveQuery` instead of Zustand for resource data.

### 16.5 Phase 4: Route Consolidation (1 day)

1. Move mindscape route to protected index.
2. Delete WebGPU landing page.
3. Update auth guard to redirect to `/`.
4. Update all navigation links.

### 16.6 Phase 5: Data Layer Cleanup (2 days)

1. Delete `MindscapeInitializer`.
2. Implement subscription protocol with cursor-based resume.
3. Rewrite voice hook for WebSocket-only.
4. Remove all polling logic.
5. Verify localStorage size is <50KB.

### 16.7 Phase 6: Performance & Polish (2 days)

1. Implement state normalization (Map-based).
2. Add edge degradation at low zoom.
3. Create layout Web Worker.
4. Performance profiling (target: 200 nodes @ 60fps).
5. Update tests and documentation.

---

## 17. Open Questions & Decisions

### 17.1 Decided (Updated Post-Review)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Ontology naming | Window Instance ↔ Resource | AI recommended; clearer than App/Entity |
| State ownership | Layout-first (local), Backend-first (resources) | Avoids dual-authority; AI identified as biggest risk |
| Data layer | Zustand (layout) + TanStack DB (resources) | Purpose-built sync; transaction IDs prevent echo |
| Local storage scope | Layout only (<50KB) | AI warned about size limits, blocking serialization |
| Window frame | Shared `WindowFrame` (thin) | AI: keep it dumb, modes are first-class |
| Physics Engine | Remove | Unused, adds complexity |
| Subscription model | Single WS, multiplexed, cursor-based | AI recommended; scalable |
| Edge metadata | Add source, confidence, scope | AI: needed for provenance and debugging |
| Structural edges | Add contains/member_of/part_of | AI: needed for grouping and scale |

### 17.2 Decided (UX & Behavior)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Dock Location | Bottom | macOS style; consistent with spatial metaphor; leaves sides free for future panels |
| Window Resizing | Snap to 50px grid | Prevents visual chaos; easier alignment; improves layout predictability |
| Tiling Mode | Optional via ⌥+drag | Power users can tile; default is freeform; avoids forced constraints |
| Multi-window per resource | Yes | One note can have multiple views (edit, preview); matches desktop OS behavior |
| Edge kind extensibility | Fixed enum | Simplicity for MVP; avoid plugin complexity; can extend enum later if needed |

### 17.3 Decided Against (AI Guidance)

| Rejected Option | Why |
|-----------------|-----|
| Local-first for everything | Dual authority problem; sync echo; localStorage limits |
| Storing messages in Zustand | Too large; blocks serialization; schema migration pain |
| N subscriptions per node | Doesn't scale; connection overhead |
| Unifying Window/Resource | Forces persistence semantics on ephemeral UI |

### 17.4 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation | Recovery |
|------|------------|--------|------------|----------|
| **TanStack DB Beta Breaking Changes** | Medium | High | Pin version, monitor changelog, avoid undocumented APIs | Git revert to pre-TanStack DB commit |
| **Performance Regression** | Low | High | Add performance budget tests in Phase 5; profile before each merge | Git revert specific optimization commits |
| **Backend Subscription Changes** | Medium | Medium | Design cursor protocol first (Section 10); implement backend in parallel | Git revert subscription changes |
| **localStorage Corruption** | Low | Medium | Version schema (`desktop-layout-v1`); add migration logic | Clear localStorage, reinitialize from backend |
| **React Flow Version Incompatibility** | Low | Low | Already on v12.9.3; avoid bleeding-edge features | Pin version, defer upgrades |

**Recovery Strategy:**

All recovery is via `git revert` to the last known good commit. No feature flags, no dual implementations.

1. **Phase 1-2 Recovery:** `git revert` to pre-rename commits.
2. **Phase 3-4 Recovery:** `git revert` route and WebGPU deletion commits.
3. **Phase 5 Recovery:** `git revert` specific performance optimization commits.

**Go/No-Go Criteria:**

- Phase 1 → Phase 2: All tests pass, no type errors
- Phase 2 → Phase 3: Notes CRUD works via TanStack DB in isolation
- Phase 3 → Phase 4: Desktop route loads <1s, all windows spawn correctly
- Phase 4 → Phase 5: Subscriptions resume after disconnect, no data loss
- Phase 5 → Production: 200 nodes @ 60fps verified, localStorage <50KB

---

## 18. React Flow Integration & Compatibility

> **Key Finding:** React Flow **IS** the Desktop UI. The paradigms are not competing—they are synergistic.

### 18.1 How React Flow and Desktop UI Relate

```
┌────────────────────────────────────────────────────────────────────┐
│                        Desktop UI Paradigm                          │
│    (Spatial OS metaphor, Window/Resource split, data management)    │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   React Flow = Rendering Substrate                                  │
│   ├── Node = Window Instance (visual representation)                │
│   ├── Edge = Relationship (visual connection)                       │
│   ├── Viewport = Desktop (pan/zoom workspace)                       │
│   ├── MiniMap = Task overview                                       │
│   └── Controls = Navigation                                         │
│                                                                     │
│   Desktop UI additions (on top of React Flow):                      │
│   ├── WindowFrame = Custom node chrome wrapper                      │
│   ├── Dock = Node spawner (not a React Flow concept)                │
│   ├── Command Palette = Quick actions                               │
│   ├── LOD (Level of Detail) = Zoom-based rendering                  │
│   ├── TanStack DB = Domain resource management                      │
│   └── Subscription Protocol = Real-time sync                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**React Flow provides:**
- Canvas rendering, pan/zoom, viewport management
- Node/edge change handling (`onNodesChange`, `onEdgesChange`)
- Connection management (`onConnect`)
- MiniMap, Controls, Background
- Internal state via `useStore`

**Desktop UI provides:**
- Window/Resource ontology (separation of concerns)
- External state management (Zustand for layout, TanStack DB for resources)
- Custom node rendering with WindowFrame wrapper
- Level of Detail based on zoom
- Backend integration and real-time sync
- Dock, Command Palette, and other UI chrome

### 18.2 Current ALFRED React Flow Integration

**Already Implemented:**
```typescript
// apps/web/src/components/mindscape/canvas.tsx
- ReactFlowProvider for context
- useReactFlow() for imperative actions (fitView, setViewport)
- Custom nodeTypes with error boundaries
- Custom edgeTypes (LivingEdge)
- Background, Controls, MiniMap components
- Zustand store integration via useMindscapeStore

// apps/web/src/lib/mindscape/lod.ts
- useLOD() hook using React Flow's useStore
- Zoom-based LOD levels: tiny/small/medium/full
- useNodeFocus() for focus/dim state

// apps/web/src/store/mindscape/graph.ts
- applyNodeChanges/applyEdgeChanges for state updates
- addEdge for connection handling
- Zustand slice pattern for graph state
```

**Needs Migration:**
| Current | Desktop UI Target | Change Required |
|---------|------------------|-----------------|
| `useMindscapeStore` | `useDesktopStore` | Rename, split layout/resource |
| `nodes` array | `windowsById` Map | Normalize for perf |
| Node `data` contains resources | `resourceRef` pointer | Separate resource from layout |
| Polling initializer | Subscription protocol | Delete initializer |

### 18.3 React Flow + Zustand Best Practices (from Research)

#### Pattern 1: External Store with Selectors
```typescript
// ✅ CORRECT: Use selector to minimize re-renders
const focusedNodeId = useDesktopStore((s) => s.focusedNodeId);

// ❌ WRONG: Returns new object on every render
const { nodes, edges } = useDesktopStore();
```

#### Pattern 2: Per-Node State Selection
```typescript
// ✅ CORRECT: Each node selects only its own data
function NoteWindow({ id }) {
  const windowData = useDesktopStore(
    useCallback((s) => s.windowsById.get(id)?.data, [id]),
    shallow
  );
  // ...
}

// ❌ WRONG: Causes all windows to re-render
function NoteWindow({ id }) {
  const allWindows = useDesktopStore((s) => s.windows);
  const myWindow = allWindows.find(w => w.id === id);
}
```

#### Pattern 3: Memoized Selectors with Reselect
```typescript
// apps/web/src/store/desktop/selectors.ts
import { createSelector } from 'reselect';

const selectWindowsById = (state: DesktopState) => state.windowsById;
const selectEdgesById = (state: DesktopState) => state.edgesById;

// Memoized array derivation
export const selectWindowsArray = createSelector(
  [selectWindowsById],
  (windowsById) => Array.from(windowsById.values())
);

export const selectEdgesArray = createSelector(
  [selectEdgesById],
  (edgesById) => Array.from(edgesById.values())
);

// Usage:
const windows = useDesktopStore(selectWindowsArray);
```

#### Pattern 4: React Flow Internal State Access
```typescript
// Access React Flow's internal state (zoom, viewport)
import { useStore } from "@xyflow/react";

function ZoomDisplay() {
  const zoom = useStore((state) => state.transform[2]);
  return <span>Zoom: {zoom.toFixed(2)}</span>;
}
```

### 18.4 Performance Patterns (React Flow Specific)

#### LOD Implementation (Already Done)
```typescript
// apps/web/src/lib/mindscape/lod.ts
export function useLOD(): LODLevel {
  return useStore((state) => {
    const zoom = state.transform[2];
    if (zoom < 0.2) return "tiny";
    if (zoom < 0.5) return "small";
    if (zoom < 0.8) return "medium";
    return "full";
  });
}
```

#### Edge Degradation (From Research)
```typescript
// Hide edges at low zoom for performance
function Canvas() {
  const zoom = useStore((s) => s.transform[2]);
  const edges = useDesktopStore(selectEdgesArray);
  
  const visibleEdges = useMemo(() => {
    if (zoom < 0.3) return [];  // No edges at tiny LOD
    if (zoom < 0.6) {
      // Show only critical edges
      return edges.filter(e => 
        e.data?.kind === "blocks" || e.data?.kind === "depends_on"
      );
    }
    return edges;
  }, [edges, zoom]);
  
  return <ReactFlow edges={visibleEdges} /* ... */ />;
}
```

#### Memoized Node Components
```typescript
// apps/web/src/components/windows/note/note-window.tsx
import { memo } from "react";

export const NoteWindow = memo(function NoteWindow({ id, data }) {
  // Component implementation
});

// In registry:
export const windowTypes = {
  note: NoteWindow,  // Already memoized
};
```

#### Web Worker Layout (From Research)
```typescript
// apps/web/src/workers/layout.worker.ts
import Dagre from "@dagrejs/dagre";

interface LayoutRequest {
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  direction: "TB" | "LR";
}

self.addEventListener("message", (e: MessageEvent<LayoutRequest>) => {
  const { nodes, edges, direction } = e.data;
  const layout = runDagreLayout(nodes, edges, direction);
  self.postMessage({ layout });
});

// In component:
const layoutWorker = useMemo(() => new Worker(
  new URL("../workers/layout.worker.ts", import.meta.url)
), []);
```

### 18.5 React Flow Features to Leverage

| Feature | Current Usage | Desktop UI Usage |
|---------|---------------|------------------|
| `onNodesChange` | ✅ Connected to Zustand | Same (layout-only) |
| `onEdgesChange` | ✅ Connected to Zustand | Same (visual edges) |
| `onConnect` | ✅ Via `useEdgePersistence` | Same (persist to backend) |
| `fitView` | ✅ For focus/center | Same |
| `MiniMap` | ✅ Enabled | Same |
| `Controls` | ✅ Enabled | Same |
| `Background` | ✅ Dots pattern | Same |
| `nodeTypes` | ✅ 22 types registered | Reduce to 12 |
| `edgeTypes` | ✅ LivingEdge | Same + degradation |
| Node `hidden` | ⚠️ Not used | Use for LOD tiny |
| Node `extent` | ⚠️ Not used | Consider for bounds |
| `onlyRenderVisibleElements` | ⚠️ Not explicit | Enable (default v12) |

### 18.6 Compatibility Verdict

| Aspect | Compatible? | Notes |
|--------|-------------|-------|
| Node rendering | ✅ Yes | WindowFrame is just a custom node component |
| Edge rendering | ✅ Yes | LivingEdge already works |
| State management | ✅ Yes | Zustand + React Flow is documented pattern |
| LOD | ✅ Yes | Already implemented via `useLOD()` |
| Performance | ✅ Yes | Follows recommended patterns |
| TanStack DB | ✅ Yes | Collections are separate from React Flow |
| Subscriptions | ✅ Yes | Update collections, React Flow re-renders |

**Conclusion:** React Flow is the **foundation** of the Desktop UI, not a competing paradigm. The Desktop UI document describes:
1. **What** nodes represent (Window Instances vs Resources)
2. **How** state is managed (Zustand for layout, TanStack DB for resources)
3. **Performance** optimizations (LOD, edge degradation, normalization)

React Flow handles the **rendering mechanics**. Desktop UI handles the **semantic layer**.

---

## 19. Research Areas

### 19.1 External Projects to Study

| Project | What to Learn | Priority |
|---------|---------------|----------|
| n8n | Node connections, execution state, canvas UX | High |
| Excalidraw | Document vs app state separation; local-first patterns | High |
| Linear | Keyboard-driven workflows | Medium |
| Obsidian Canvas | Freeform cards, link handling | Medium |
| Figma | Real-time sync machinery (but don't over-engineer) | Low |

### 18.2 TanStack DB Deep Dive (Researched)

| Topic | Finding |
|-------|---------|
| tRPC integration | ✅ Yes - `queryCollectionOptions` wraps any async `queryFn`, including tRPC |
| Subscription support | ✅ Yes - Collections expose `insert`, `update`, `delete` methods callable from subscription handlers |
| Bundle size | TBD - Measure after integration |
| Maturity | **Beta (v0.x)** - API stabilizing, may have breaking changes |
| Schema validation | ✅ Any Standard Schema (Zod, Valibot) works |
| Transaction matching | ✅ Via `txid` return or `awaitMatch` utility |
| Error handling | ✅ `SchemaValidationError`, `DuplicateKeyError` for rollback |

**Key API Patterns Learned:**
- `transaction.mutations[0].modified` - New item data
- `transaction.mutations[0].original` - Original item (for updates/deletes)
- `transaction.mutations[0].changes` - Only changed fields (for updates)
- `tx.isPersisted.promise` - Wait for backend confirmation
- `createOptimisticAction` - Multi-collection transactional mutations

### 18.3 React Flow (Xyflow) Deep Dive & Compatibility Analysis

**Research Date:** 2025-01-27  
**Current Version:** v12.9.3 (ALFRED) → Latest: v12.10.0  
**Package:** `@xyflow/react` (renamed from `reactflow` in v12)

#### 18.3.1 Current ALFRED Integration

**Existing Usage:**
- ✅ React Flow v12.9.3 already integrated in `apps/web/src/components/mindscape/canvas.tsx`
- ✅ Custom nodes (22 types) implemented as React components
- ✅ Custom edges (`LivingEdge`) with smooth step paths
- ✅ Zustand store integration (`useMindscapeStore`)
- ✅ Controlled flow pattern (`onNodesChange`, `onEdgesChange`, `onConnect`)
- ✅ Viewport management (`useReactFlow`, `fitView`)
- ✅ Performance optimizations (`onlyRenderVisibleElements` default in v12)

**Key Files:**
- `apps/web/src/components/mindscape/canvas.tsx` - Main React Flow wrapper
- `apps/web/src/store/mindscape/graph.ts` - Store integration with `applyNodeChanges`, `applyEdgeChanges`
- `apps/web/src/components/mindscape/registry.tsx` - Node type registry
- `apps/web/src/components/mindscape/living-edge.tsx` - Custom edge component

#### 18.3.2 Desktop UI Paradigm Compatibility

| Desktop UI Requirement | React Flow Support | Status | Notes |
|------------------------|-------------------|--------|-------|
| **Window Positioning** | ✅ Native | Compatible | Nodes have `position: { x, y }` - perfect for windows |
| **Window Dragging** | ✅ Native | Compatible | Built-in drag via `draggable` prop |
| **Window Resizing** | ✅ Via `NodeResizer` | Compatible | `@xyflow/react` provides `<NodeResizer />` component |
| **Window Focus** | ⚠️ Selection-based | Needs custom | React Flow uses selection, not focus. Need custom `focusedWindowId` state |
| **Window Minimize/Maximize** | ❌ Not native | Custom needed | Use `viewMode` in node data + conditional rendering |
| **Dock (Fixed Panel)** | ✅ Via `Panel` | Compatible | `<Panel position="bottom-center">` for dock |
| **Command Palette** | ❌ Not native | Custom needed | Build as overlay modal (already exists in ALFRED) |
| **Edge Connections** | ✅ Native | Compatible | Edges represent relationships perfectly |
| **LOD (Level of Detail)** | ⚠️ Manual | Custom needed | Use `useViewport()` hook + conditional rendering (already implemented) |
| **Viewport Pan/Zoom** | ✅ Native | Compatible | Built-in with `panOnDrag`, `zoomOnScroll` |
| **Performance (200+ nodes)** | ✅ Optimized | Compatible | v12 has `onlyRenderVisibleElements` default, viewport culling |

#### 18.3.3 Key React Flow v12 Features for Desktop UI

**1. Custom Nodes (Window Instances)**
```typescript
// React Flow nodes ARE windows - perfect match
type WindowInstance = Node<WindowData>;

// Custom node component = Window component
export function NoteWindow({ id, data, position }: NodeProps<NoteWindowData>) {
  return (
    <WindowFrame id={id} title={data.title}>
      <NoteEditor content={data.content} />
    </WindowFrame>
  );
}
```

**2. Node Resizing (Window Resize)**
```typescript
import { NodeResizer } from '@xyflow/react';

<WindowFrame>
  <NodeResizer 
    minWidth={200} 
    minHeight={150}
    handleStyle={{ border: '1px solid white/10' }}
  />
  {/* Window content */}
</WindowFrame>
```

**3. Viewport Management**
```typescript
const reactFlow = useReactFlow();

// Focus window = fit view to node
reactFlow.fitView({ 
  nodes: [{ id: windowId }],
  padding: { top: '50px', bottom: '50px', left: '50px', right: '50px' },
  duration: 400
});
```

**4. Performance Optimizations**
- ✅ `onlyRenderVisibleElements={true}` (default in v12)
- ✅ Viewport culling (nodes outside viewport not rendered)
- ✅ Memoized node components prevent unnecessary re-renders
- ✅ Edge degradation via conditional rendering based on zoom

**5. Panel Components (Dock)**
```typescript
import { Panel } from '@xyflow/react';

<Panel position="bottom-center">
  <Dock dockPins={dockPins} onSpawn={spawnWindow} />
</Panel>
```

#### 18.3.4 Compatibility Assessment

**✅ FULLY COMPATIBLE:**
- Window positioning and dragging
- Edge connections (relationships)
- Viewport pan/zoom
- Custom node rendering (windows)
- Performance at scale (200+ nodes)

**⚠️ REQUIRES CUSTOM IMPLEMENTATION:**
- Window focus system (React Flow uses selection, not focus)
- Window minimize/maximize (use `viewMode` state + conditional rendering)
- LOD system (already implemented in ALFRED via `useLOD()` hook)
- Command palette (already exists as overlay)

**❌ NOT PROVIDED (Build Custom):**
- Dock component (use `Panel` + custom UI)
- Window chrome (title bar, close button) - build in `WindowFrame`
- Window state management (Zustand + React Flow controlled flow)

#### 18.3.5 React Flow vs Desktop UI: Balance Strategy

**React Flow's Role:**
- **Rendering substrate** - Provides canvas, viewport, node/edge rendering
- **Interaction layer** - Handles drag, pan, zoom, selection
- **State synchronization** - Controlled flow pattern with Zustand

**Desktop UI's Role:**
- **Window abstraction** - `WindowFrame` component wraps React Flow nodes
- **Window management** - Focus, minimize, maximize, dock logic
- **Desktop metaphors** - Dock, command palette, window chrome
- **State ownership** - Layout (Zustand) + Resources (TanStack DB)

**Architecture Pattern:**
```
React Flow (Infrastructure)
  ↓
WindowFrame (Abstraction Layer)
  ↓
Window Components (Business Logic)
  ↓
TanStack DB Collections (Data Layer)
```

**Key Insight:** React Flow is the **canvas engine**, not the desktop OS. Desktop UI patterns live **above** React Flow, using it as a rendering substrate.

#### 18.3.6 Potential Conflicts & Solutions

| Conflict | Solution |
|----------|----------|
| **React Flow selection vs Desktop focus** | Use separate `focusedWindowId` in Zustand. React Flow selection for multi-select, focus for single window highlight |
| **Node dragging vs Window dragging** | Same thing! React Flow handles dragging natively. Window chrome (title bar) is drag handle |
| **Edge handles vs Window connections** | Edges represent relationships. Hide handles for non-connectable windows (settings, terminal) |
| **Viewport zoom vs LOD** | Use `useViewport().zoom` to drive LOD. React Flow handles zoom, LOD handles rendering complexity |
| **Panel positioning vs Dock** | Use `Panel` component for dock positioning. Custom styling for desktop aesthetic |

#### 18.3.7 Migration Considerations

**From Mindscape to Desktop UI:**
1. ✅ React Flow already integrated - no migration needed
2. ✅ Custom nodes already exist - rename to "windows"
3. ✅ Zustand store pattern compatible - split layout vs resources
4. ⚠️ Add `WindowFrame` abstraction layer
5. ⚠️ Implement focus system (separate from selection)
6. ⚠️ Add window management (minimize, maximize, dock)

**Breaking Changes (v12.9.3 → v12.10.0):**
- None expected (patch version)
- Monitor changelog for future major versions

#### 18.3.8 Performance Benchmarks (React Flow v12)

| Metric | React Flow v12 | ALFRED Target | Status |
|--------|---------------|---------------|--------|
| Nodes before lag | 500+ (with optimizations) | 200+ | ✅ Exceeds target |
| Edge rendering | 1000+ edges (with degradation) | 500+ | ✅ Exceeds target |
| Viewport culling | Automatic (v12 default) | Required | ✅ Native support |
| Re-render optimization | Memoized nodes | Required | ✅ Built-in |

**Performance Tips:**
- Use `React.memo` on window components
- Implement edge degradation at zoom < 0.3
- Use `onlyRenderVisibleElements={true}` (default)
- Normalize state (Map-based) to prevent array churn

#### 18.3.9 Recommendations

**✅ PROCEED WITH REACT FLOW:**
1. React Flow is **perfect** for Desktop UI rendering substrate
2. Already integrated and working in ALFRED
3. No conflicts with Desktop UI patterns
4. Performance exceeds requirements
5. Custom nodes = Windows is natural mapping

**⚠️ IMPLEMENTATION NOTES:**
1. Build `WindowFrame` as abstraction layer above React Flow nodes
2. Use React Flow for rendering, Desktop UI for window management
3. Separate focus (Zustand) from selection (React Flow)
4. Leverage `Panel` for dock, custom overlay for command palette
5. Use `NodeResizer` for window resizing

**📚 Documentation References:**
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [React Flow Performance](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow Node Resizer](https://reactflow.dev/api-reference/components/node-resizer)
- [React Flow Panel](https://reactflow.dev/api-reference/components/panel)
- [React Flow v12 Migration](https://reactflow.dev/learn/troubleshooting/migrate-to-v12)

### 18.4 Subscription Protocol

### 18.4 Subscription Protocol

| Topic | Goal |
|-------|------|
| Cursor-based resume | Implement snapshot vs delta logic |
| Backpressure handling | Coalesce bursts on server |
| Multiplexing | Single WS with stream IDs |
| Idempotency | Transaction ID reconciliation |

---

## 20. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Establish new file structure and types without breaking existing functionality.

- [ ] Rename store files (`mindscape` → `desktop`)
- [ ] Split store into layout-only (no resource data)
- [ ] Create `WindowFrame` wrapper component
- [ ] Move node components to `windows/` folder
- [ ] Create simplified `registry.ts`
- [ ] Update all imports

**Deliverable:** App compiles and runs with new file structure, layout-only Zustand.

### Phase 2: TanStack DB Integration (Week 2)

**Goal:** Backend-first resource management with optimistic UI.

- [ ] Install `@tanstack/react-db` and `@tanstack/query-db-collection`
- [ ] Create shared `QueryClient` instance for collections
- [ ] Create `noteCollection` with tRPC integration (`queryCollectionOptions`)
- [ ] Create `reminderCollection`
- [ ] Create `threadCollection` (chat)
- [ ] Create `edgeCollection`
- [ ] Migrate `NoteWindow` to use `useLiveQuery`
- [ ] Add `SchemaValidationError`/`DuplicateKeyError` handling

**Deliverable:** Notes CRUD via TanStack DB collection with optimistic updates.

### Phase 3: Route Consolidation (Week 3)

**Goal:** Single entry point, no WebGPU.

- [ ] Delete WebGPU engine and landing page
- [ ] Move `/mindscape` to `/` (protected index)
- [ ] Create `Dock` component
- [ ] Create `Desktop` root component
- [ ] Wire up command palette
- [ ] Migrate remaining windows to collections

**Deliverable:** App loads directly to Desktop canvas with TanStack DB.

### Phase 4: Subscription Protocol (Week 4)

**Goal:** Cursor-based real-time sync, no polling.

- [ ] Implement cursor-based subscription protocol
- [ ] Add snapshot vs delta logic
- [ ] Create `subscriptionManager` for single WS
- [ ] Wire collections to subscription updates
- [ ] Delete `MindscapeInitializer`
- [ ] Verify localStorage size <50KB

**Deliverable:** Real-time graph updates via cursor-based subscription.

### Phase 5: Performance & Polish (Week 5)

**Goal:** Scale to 200+ nodes at 60fps.

- [ ] Implement state normalization (Map-based store)
- [ ] Add edge degradation at low zoom
- [ ] Create layout Web Worker
- [ ] Implement per-window subscriptions
- [ ] Performance profiling (200 nodes target)
- [ ] Update tests and documentation

**Deliverable:** Production-ready Desktop UI.

---

## 20.1 Testing Strategy

### Unit Tests

| Component | Test Focus | Location |
|-----------|------------|----------|
| `useDesktopStore` | Slice actions, persistence serialization | `apps/web/src/store/__tests__/desktop.test.ts` |
| `WindowFrame` | Rendering, LOD transitions, focus/dim states | `apps/web/src/components/windows/shared/__tests__/` |
| Collections | Insert/update/delete, optimistic rollback, schema validation | `apps/web/src/collections/__tests__/` |
| `useLOD` | Zoom thresholds, state transitions | `apps/web/src/hooks/__tests__/use-lod.test.ts` |

### Integration Tests

| Scenario | Test Focus | Location |
|----------|------------|----------|
| Note CRUD via collection | TanStack DB → tRPC → Backend round-trip | `apps/web/src/collections/__tests__/note.integration.test.ts` |
| Subscription reconnect | Cursor resume, snapshot fallback | `packages/api/test/routers/graph.test.ts` |
| Window spawn from Dock | Store update → React Flow node creation | `apps/web/src/components/desktop/__tests__/dock.integration.test.ts` |

### E2E Tests (Playwright)

| Flow | Test Focus | Location |
|------|------------|----------|
| Desktop load | Auth → Route → Canvas renders <1s | `tests/e2e/desktop-load.spec.ts` |
| Note creation | Dock click → Window spawns → Type → Save → Persist | `tests/e2e/note-crud.spec.ts` |
| 200 node scale | Spawn 200 windows → Pan/zoom → FPS >30 | `tests/e2e/scale.spec.ts` |
| Subscription recovery | Disconnect WS → Reconnect → State intact | `tests/e2e/subscription-recovery.spec.ts` |

### Performance Tests

| Test | Metric | Threshold | Tool |
|------|--------|-----------|------|
| Window spawn | Time to render | <10ms | `performance.now()` |
| 100 node pan | Frame time | <16ms (60fps) | Chrome DevTools |
| Collection query | Query latency | <5ms | TanStack DB devtools |
| localStorage size | Total bytes | <50KB | `JSON.stringify().length` |

### Test Execution by Phase

| Phase | Required Tests | Go/No-Go |
|-------|---------------|----------|
| Phase 1 | Unit: store slices, type checks pass | All green |
| Phase 2 | Unit: collections; Integration: note CRUD | Notes persist correctly |
| Phase 3 | E2E: desktop load, dock spawn | Route loads <1s |
| Phase 4 | Integration: subscription reconnect | Cursor resume works |
| Phase 5 | E2E: scale test; Performance: all metrics | 200 nodes @ 60fps |

---

## 22. Success Criteria

### 22.1 Functional Requirements

- [ ] Single route (`/`) loads authenticated Desktop
- [ ] Dock displays and spawns all window types
- [ ] Command palette (⌘+K) works
- [ ] Notes can be created, edited, deleted (via TanStack DB)
- [ ] Workflow runs stream events in real-time
- [ ] Terminal sessions work
- [ ] Voice input works via WebSocket
- [ ] Edges persist to backend via collection

### 22.2 Non-Functional Requirements

| Metric | Target |
|--------|--------|
| Time to Interactive | < 1s |
| Bundle Size (main) | < 500KB gzipped |
| Nodes before lag | 200+ @ 60fps |
| Memory usage (100 nodes) | < 150MB |
| Lighthouse Performance | > 85 |
| localStorage size | < 50KB |
| Subscription reconnect | < 1s with cursor resume |

### 22.3 Architecture Requirements

- [ ] Zustand only stores layout state (no resource data)
- [ ] TanStack DB collections for all persisted resources
- [ ] Single WebSocket with multiplexed streams
- [ ] Cursor-based subscription protocol with idempotent merge
- [ ] No dual-authority (Zustand + backend competing)
- [ ] Edge degradation at zoom < 0.3

### 22.4 Code Quality

- [ ] No `// TODO` comments in production code
- [ ] No `console.log` statements
- [ ] No `window.location.assign` (use `navigate()`)
- [ ] No empty async stubs
- [ ] 100% TypeScript strict compliance
- [ ] All Zod schemas have runtime validation
- [ ] Per-window subscriptions (no array churn re-renders)

---

## Appendix A: Glossary (Updated)

| Term | Definition |
|------|------------|
| **Window Instance** | A React Flow node representing UI + layout state; may reference a Resource |
| **Resource** | A backend-persisted domain object (note, reminder, thread, workflow run) |
| **Canvas** | The React Flow viewport |
| **Desktop** | The root container component |
| **Dock** | The window launcher panel |
| **Edge** | A visual/data connection between windows |
| **LOD** | Level of Detail (zoom-based rendering) |
| **WindowFrame** | Shared window chrome wrapper component |
| **Collection** | TanStack DB collection for domain resources |
| **Cursor** | Monotonic sequence for subscription resume |
| **txid** | Transaction ID for optimistic reconciliation |

## Appendix B: Key Changes from v1.0

| Section | Change | Rationale |
|---------|--------|-----------|
| Ontology | App → Window Instance, Entity → Resource | AI: clearer abstraction |
| State | Local-first everything → Layout-first only | AI: avoids dual-authority |
| Data Layer | Zustand only → Zustand + TanStack DB | AI: purpose-built sync |
| Subscriptions | N per node → Single WS, multiplexed | AI: scalable |
| localStorage | Unbounded → <50KB budget | AI: avoid limits/blocking |
| Edges | 5 kinds → 8 kinds + metadata | AI: structural + provenance |

## Appendix C: Related Documents

**Internal:**
- `.ruler/26-design-system.md` - Signal in the Void design tokens
- `.ruler/12-component-development.md` - React component patterns
- `.ruler/13-streaming-patterns.md` - tRPC streaming patterns
- `.ruler/15-ai-sdk-v6.md` - AI SDK streaming patterns
- `docs/alfred-prd.md` - Product requirements

**TanStack DB Official Documentation:**
- [Overview](https://tanstack.com/db/latest/docs) - Core concepts and architecture
- [Quick Start](https://tanstack.com/db/latest/docs/quick-start) - Installation and basic usage
- [Query Collection](https://tanstack.com/db/latest/docs/collections/query-collection) - TanStack Query integration
- [useLiveQuery](https://tanstack.com/db/latest/docs/framework/react/reference/functions/useLiveQuery) - React hook API
- [Mutations Guide](https://tanstack.com/db/latest/docs/guides/mutations) - Optimistic updates
- [Error Handling](https://tanstack.com/db/latest/docs/guides/error-handling) - SchemaValidationError, DuplicateKeyError
- [Electric Collection](https://tanstack.com/db/latest/docs/collections/electric-collection) - Real-time sync (if we migrate)

## Appendix D: AI Review Summary

**Reviewer:** Genius-level AI (2025-12-23)

**Biggest Mistake Identified:**
> Making "local-first" mean the same store owns both UI state *and* domain data while also introducing real-time backend subscriptions. That produces *two authorities* and you'll spend months chasing sync echo, stale caches, and migration bugs.

**6-Month Regret Warning:**
> Persisting large/denormalized node `data` (messages, note bodies, workflow payloads) to `localStorage`/Zustand. It will hit size limits, blocking serialization, and schema-migration pain faster than you expect.

**Key Missing Items (Now Added):**
1. Source-of-Truth Matrix (Section 5)
2. Subscription Protocol Contract (Section 10)
3. Performance Patterns (Section 12)

---

## Progress

> Track completed items as implementation proceeds.

| Date | Phase | Item | Status | Notes |
|------|-------|------|--------|-------|
| 2025-12-23 | 0 | ExecPlan v2.0 complete | ✅ | Post AI review, ready for execution |
| 2025-12-23 | 1 | Create store/desktop/ structure | ✅ | New types, windows, viewport, dock, persist slices |
| 2025-12-23 | 1 | Create store/desktop.ts | ✅ | Layout-only Zustand store with persistence |
| 2025-12-23 | 1 | Create store/desktop.schemas.ts | ✅ | 12 window types (reduced from 21) |
| 2025-12-23 | 1 | Create WindowFrame | ✅ | Shared window chrome with tier styling |
| 2025-12-23 | 1 | Create components/windows/ | ✅ | Shared: lod, focus, error-boundary, lod-views |
| 2025-12-23 | 1 | Create registry.ts (12 types) | ✅ | References existing nodes, wraps with error boundary |
| 2025-12-23 | 1 | Create components/desktop/ | ✅ | Desktop, Canvas, Dock components |
| 2025-12-23 | 1 | Typecheck passes | ✅ | New desktop code compiles cleanly |
| 2025-12-23 | 1 | Lint passes | ✅ | Biome check with all safe fixes applied |
| 2025-12-23 | 1 | Build passes | ✅ | `bun run build` succeeds |
| 2025-12-23 | 1 | Layout functions generic | ✅ | `layout.ts`, `layout-semantic.ts` now work with any node data type |
| 2025-12-23 | 1 | Compatibility layer | ✅ | `store/compat.ts` provides mindscape-compatible aliases for desktop store |
| | 1 | Migrate individual components | ⬜ | Node-by-node migration as part of Phase 3 route consolidation |
| | 2 | Install TanStack DB | ⬜ | |
| | 2 | Create noteCollection | ⬜ | |
| | 2 | Migrate NoteWindow | ⬜ | |
| | 3 | Delete WebGPU | ⬜ | |
| | 3 | Route consolidation | ⬜ | |
| | 4 | Subscription protocol | ⬜ | |
| | 5 | Performance optimization | ⬜ | |

---

## Surprises & Discoveries

> Document unexpected findings during implementation.

| Date | Phase | Discovery | Impact | Resolution |
|------|-------|-----------|--------|------------|
| 2025-12-23 | 1 | Existing nodes depend heavily on `useMindscapeStore` | Medium | Created parallel desktop store; registry references existing nodes for now |
| 2025-12-23 | 1 | Layout functions typed to `ArtifactData` | Low | Fixed: made functions generic with `NodeData` type constraint |
| 2025-12-23 | 1 | Pre-existing type errors in packages/api metrics | None | Unrelated to desktop; noted but not blocking |
| 2025-12-23 | 1 | Node components tightly coupled to mindscape | Medium | Created compat layer; full migration deferred to Phase 3 |

---

## Decision Log

> Consolidate all decisions with rationale and date.

| Date | Decision | Rationale | Made By |
|------|----------|-----------|---------|
| 2025-12-23 | Window Instance ↔ Resource ontology | AI recommended; clearer separation than App/Entity | AI Review |
| 2025-12-23 | Layout-first (local), Backend-first (resources) | Avoids dual-authority problem; biggest risk identified by AI | AI Review |
| 2025-12-23 | Zustand (layout) + TanStack DB (resources) | Purpose-built sync; transaction IDs prevent echo | AI Review |
| 2025-12-23 | localStorage <50KB budget | Avoid size limits, blocking serialization, schema migration pain | AI Review |
| 2025-12-23 | Single WS, multiplexed, cursor-based subscriptions | Scalable; N subscriptions per node doesn't scale | AI Review |
| 2025-12-23 | Dock at bottom | macOS style; consistent with spatial metaphor | UX Decision |
| 2025-12-23 | Snap to 50px grid | Prevents visual chaos; easier alignment | UX Decision |
| 2025-12-23 | Tiling optional via ⌥+drag | Power users can tile; default is freeform | UX Decision |
| 2025-12-23 | Multi-window per resource: Yes | Matches desktop OS behavior | UX Decision |
| 2025-12-23 | Fixed enum for edge kinds | Simplicity for MVP; can extend later | Architecture |
| 2025-12-23 | TanStack DB beta risk accepted | Pin version; git revert if breaking changes | Risk Mitigation |
| 2025-12-23 | No feature flags | Immediate removal of dead code; git revert for recovery | ALFRED Principle |

---

## Outcomes & Retrospective

> To be completed post-implementation.

### Outcomes

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Entry Points | 1 (`/`) | | ⬜ |
| Node Types | 12 | | ⬜ |
| Dead Code Lines Removed | ~1,966 | | ⬜ |
| Time to Interactive | <1s | | ⬜ |
| Max Nodes @ 60fps | 200+ | | ⬜ |
| localStorage Size | <50KB | | ⬜ |

### Retrospective

**What went well:**
- (To be filled)

**What could be improved:**
- (To be filled)

**Lessons learned:**
- (To be filled)

---

**Document End**
