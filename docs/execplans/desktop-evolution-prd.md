# ALFRED Desktop Evolution — Comprehensive Product Requirements Document

**Owner:** UI/UX + Frontend Architecture  
**Status:** Planning  
**Created:** 2026-01-03  
**Target:** Q1 2026

**Companion Documents:**

- [`desktop-type-migration.md`](./desktop-type-migration.md) — Type system migration from ReactFlow to hybrid architecture

---

## Executive Summary

ALFRED Desktop Evolution transforms the current ReactFlow-based spatial canvas into a **revolutionary desktop operating environment** that serves as Jack's primary interface for AI-augmented software development, knowledge management, and autonomous agent orchestration. The desktop combines a Wayland-inspired tiling window manager with a JARVIS-aesthetic dark void theme, integrating every ALFRED backend capability into a cohesive, voice-first experience.

### Vision Statement

_"The last desktop you'll ever need — where every thought becomes action, every agent is visible, and every piece of knowledge is a tap away."_

### Core User Journey

Jack wakes up, opens ALFRED Desktop, and speaks: _"Alfred, show me what the agents accomplished overnight."_ The Orb pulses, the Agent Waves panel materializes showing 12 completed PRs across 3 projects, the Knowledge Graph updates with 47 new facts learned, and a gentle notification indicates 2 PRs await his review. Jack swipes to the Monaco editor, reviews the diffs inline, approves with voice command, and watches the deployment pipeline flow through the Docker Management panel in real-time.

---

## Part I: Architecture Overview

### 1.1 System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ALFRED Desktop Shell                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Menu Bar Layer (z: 1000)                     │   │
│  │  [◉ Alfred] [App Menus] [───────────] [Status] [Orb Mini] [12:34]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │                      Tiling Window Layer (z: 100-500)                │   │
│  │                                                                      │   │
│  │   ┌──────────────────────┐  ┌──────────────────────────────────┐   │   │
│  │   │    Chat Window       │  │       Monaco Code Editor          │   │   │
│  │   │    (Focused)         │  │       with AI Completions         │   │   │
│  │   │                      │  │                                    │   │   │
│  │   │                      │  ├──────────────────────────────────┤   │   │
│  │   │                      │  │       Agent Waves Viewer          │   │   │
│  │   │                      │  │       (Wave 3 of 5 active)        │   │   │
│  │   └──────────────────────┘  └──────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Mindscape Layer (z: 50, toggle)                 │   │
│  │         [ReactFlow infinite canvas with knowledge nodes]             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          Orb Layer (z: 900)                          │   │
│  │                     [Floating AI Presence Indicator]                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Taskbar Layer (z: 1000)                       │   │
│  │  [⚙] [Chat] [Code] [Agents] [PR] [Docker] [Graph] [···] [Tray] [🕐] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       Overlay Layer (z: 2000)                        │
│  │          [Command Palette] [Notifications] [Modals]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Package Dependencies

```
apps/web (Desktop Shell)
├── @alfred/api          → tRPC client for all backend calls
├── @alfred/type         → Shared type definitions
├── @alfred/ui           → Shared UI primitives
├── @alfred/protocol     → Agent Client Protocol SDK
├── @alfred/cognitive    → Cognitive state types
├── @alfred/knowledge    → Knowledge graph types
└── External
    ├── @xyflow/react    → ReactFlow (ISOLATED: Mindscape + graph apps only)
    ├── @monaco-editor/react → Code editor
    ├── @tanstack/react-query → Server state
    ├── @electric-sql/pglite → TanStack DB local store
    ├── xterm.js         → Terminal emulator
    └── zustand          → Client state management
```

**ReactFlow Isolation Boundary:**

```
@xyflow/react imports ALLOWED in:
├── components/graphs/mindscape/    → Mindscape infinite canvas
├── components/graphs/knowledge/    → Knowledge Graph app
├── components/graphs/workflow/     → Workflow Builder app
├── components/graphs/agents/       → Agent spawn tree
├── components/graphs/plan/         → Plan dependency graph
├── components/graphs/rag/          → Embedding visualization
└── store/mindscape/                → Mindscape-specific state

@xyflow/react imports FORBIDDEN in:
├── components/desktop/             → Desktop shell, windows, tiling
├── store/desktop/                  → Desktop state management
└── components/desktop/apps/*/      → App containers (use graph/ for RF)
```

### 1.3 Backend Integration Map

| Desktop App            | Primary Router(s)                 | Secondary Integrations    | Package Dependencies             |
| ---------------------- | --------------------------------- | ------------------------- | -------------------------------- |
| Chat                   | `assistant`, `voice`              | `cognitive`, `knowledge`  | `@alfred/history`, `@alfred/rag` |
| Code Editor            | `fs`, `codex`                     | `agentfs`, `droid`        | `@alfred/embed`                  |
| Agent Waves            | `orchestrator`, `droid`           | `workflow`, `plan`        | `@alfred/runtime`                |
| PR Review              | `workflow`, `linear`              | `deploy`, `codex`         | `@alfred/policy`                 |
| Docker Manager         | `deploy`, `agentfs`               | `admin`                   | `@alfred/metrics`                |
| Knowledge Graph        | `graph`, `knowledge`              | `cognitive`               | `@alfred/embed`                  |
| AgentFS Viewer         | `agentfs`                         | `droid`, `codex`          | —                                |
| Terminal               | `terminal`                        | `fs`                      | `@alfred/tui`                    |
| Task Manager           | `admin`, `workflow`               | `droid`, `codex`          | `@alfred/metrics`                |
| Settings               | `profile`, `preference`, `visual` | `privacy`, `token`        | `@alfred/auth`                   |
| **Cortex Visualizer**  | `visual`                          | `cognitive`               | `@alfred/cortex`                 |
| **Learning Dashboard** | `cognitive`                       | `knowledge`               | `@alfred/learning`               |
| **Policy Viewer**      | `admin`                           | `cognitive`               | `@alfred/policy`                 |
| **Tune Manager**       | `tune`                            | `eval`                    | `@alfred/tune`                   |
| **Plan Editor**        | `plan`                            | `workflow`, `codexIntent` | `@alfred/plan`                   |
| **Metrics Dashboard**  | `admin`                           | —                         | `@alfred/metrics`                |
| **RAG Explorer**       | `graph`                           | `knowledge`               | `@alfred/rag`, `@alfred/embed`   |

### 1.4 Package Coverage Matrix

All 26 ALFRED packages mapped to desktop UI surfaces:

| Package             | UI Surface                                   | Coverage Level |
| ------------------- | -------------------------------------------- | -------------- |
| `@alfred/agent`     | Agent Waves, AgentFS Viewer                  | ✅ Full        |
| `@alfred/api`       | All apps (tRPC client)                       | ✅ Full        |
| `@alfred/auth`      | Settings → Sessions, Biometric Dialogs       | ✅ Full        |
| `@alfred/codex`     | Code Editor, Agent Waves                     | ✅ Full        |
| `@alfred/cognitive` | Orb, Status Area, Learning Dashboard         | ✅ Full        |
| `@alfred/cortex`    | Cortex Visualizer, Orb Animations, Wallpaper | ✅ Full        |
| `@alfred/db`        | All apps (via routers)                       | ✅ Full        |
| `@alfred/embed`     | RAG Explorer, Knowledge Graph                | ✅ Full        |
| `@alfred/graph`     | Knowledge Graph, RAG Explorer                | ✅ Full        |
| `@alfred/history`   | Chat → History Panel                         | ✅ Full        |
| `@alfred/knowledge` | Knowledge Graph, Chat Context                | ✅ Full        |
| `@alfred/learning`  | Learning Dashboard                           | ✅ Full        |
| `@alfred/logger`    | Task Manager Logs                            | ✅ Internal    |
| `@alfred/metrics`   | Metrics Dashboard, Task Manager              | ✅ Full        |
| `@alfred/plan`      | Plan Editor, Workflow Builder                | ✅ Full        |
| `@alfred/policy`    | Policy Viewer, Permission Dialogs            | ✅ Full        |
| `@alfred/protocol`  | Agent Selector, ACP Sessions                 | ✅ Full        |
| `@alfred/rag`       | RAG Explorer, Chat Context                   | ✅ Full        |
| `@alfred/runtime`   | Agent Waves, Workflow Builder                | ✅ Full        |
| `@alfred/test-kit`  | —                                            | ✅ Internal    |
| `@alfred/tsconfig`  | —                                            | ✅ Internal    |
| `@alfred/tui`       | Terminal TUI Mode                            | ✅ Full        |
| `@alfred/tune`      | Tune Manager                                 | ✅ Full        |
| `@alfred/type`      | All apps (type definitions)                  | ✅ Full        |
| `@alfred/ui`        | All apps (UI primitives)                     | ✅ Full        |
| `@alfred/voice`     | Chat Voice, Orb                              | ✅ Full        |

### 1.5 Architectural Decision: Hybrid ReactFlow Strategy

**Decision:** Adopt a **hybrid architecture** that isolates ReactFlow to visualization-specific modules while using traditional DOM-based window management for the desktop shell.

#### Context

The current implementation uses ReactFlow as the primary window manager:

```
CURRENT: Windows ARE ReactFlow Nodes
──────────────────────────────────────
type WindowInstance = Node<WindowData>;    // Extends ReactFlow Node
type DesktopEdge = Edge<EdgeData>;         // Extends ReactFlow Edge

ReactFlow
├── nodes={windows}         // Windows as nodes
├── edges={visibleEdges}    // Edges connect windows
├── onNodesChange           // Window position/selection
└── nodeTypes={windowTypes} // Chat, Terminal, etc.
```

This creates tight coupling between window management and ReactFlow's infinite canvas paradigm, which conflicts with the PRD's Wayland-inspired tiling window manager.

#### Decision

Separate concerns:

```
NEW: Hybrid Architecture
──────────────────────────────────────

Desktop Shell (Pure DOM/CSS)
├── WindowLayer          → Traditional window management
│   ├── TilingEngine     → CSS Grid/Flexbox zones
│   ├── WindowChrome     → Title bar, resize handles
│   └── Z-index stacking → Focus management
│
└── MindscapeLayer       → ReactFlow (isolated)
    ├── nodes={entities} → Knowledge nodes only
    ├── edges={relations}→ Semantic edges
    └── Infinite canvas  → Pan/zoom for exploration

App-Specific Graphs (ReactFlow, isolated per app)
├── Knowledge App → KnowledgeGraphNode[]
├── Workflow App  → WorkflowGraphNode[]
├── Agents App    → SpawnTreeNode[]
├── Plan App      → PlanGraphNode[]
└── RAG App       → EmbeddingNode[] (projection)
```

#### Rationale

| Concern                   | ReactFlow                | Traditional DOM          | Winner    |
| ------------------------- | ------------------------ | ------------------------ | --------- |
| Tiling window management  | ❌ Not designed for it   | ✅ Native support        | DOM       |
| Window z-ordering         | ⚠️ Workaround needed     | ✅ Native CSS            | DOM       |
| Window minimize/maximize  | ❌ Not supported         | ✅ Trivial               | DOM       |
| Resize handles            | ⚠️ Custom implementation | ✅ Native/CSS            | DOM       |
| Infinite canvas panning   | ✅ Core feature          | ❌ Complex to build      | ReactFlow |
| Node-based visualization  | ✅ Core feature          | ❌ Complex to build      | ReactFlow |
| Edge connections          | ✅ Built-in              | ❌ Manual SVG            | ReactFlow |
| Performance (1000+ nodes) | ✅ Virtualized           | ⚠️ Manual virtualization | ReactFlow |

#### Implementation Impact

**Type System:** See [`desktop-type-migration.md`](./desktop-type-migration.md) for complete type migration.

**Store Architecture:**

```typescript
// Desktop Store (NO ReactFlow dependency)
type DesktopState = WindowSlice &
  TilingSlice &
  ViewportSlice &
  TaskbarSlice &
  CacheSlice &
  ContextSlice;

// Mindscape Store (ReactFlow isolated)
type MindscapeState = MindscapeSlice; // import { Node, Edge } from "@xyflow/react"

// App Graph Stores (ReactFlow isolated per app)
type KnowledgeGraphState = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};
```

**Component Architecture:**

```
apps/web/src/components/
├── desktop/                    # NO ReactFlow imports
│   ├── shell.tsx
│   ├── layers/
│   │   ├── window-layer.tsx    # Traditional DOM windows
│   │   └── mindscape-layer.tsx # ReactFlow wrapper (lazy loaded)
│   ├── tiling/
│   │   └── manager.tsx         # CSS Grid zones
│   └── windows/
│       └── chrome.tsx          # Window frame (DOM)
│
└── graphs/                     # ReactFlow components (isolated)
    ├── mindscape/
    │   └── canvas.tsx          # ReactFlow for Mindscape
    ├── knowledge/
    │   └── graph-canvas.tsx    # ReactFlow for Knowledge app
    ├── workflow/
    │   └── node-canvas.tsx     # ReactFlow for Workflow app
    └── agents/
        └── spawn-tree.tsx      # ReactFlow for agent visualization
```

#### Migration Strategy

1. **Phase 1:** Create new type system (no ReactFlow in `WindowInstance`)
2. **Phase 2:** Build tiling engine with CSS Grid
3. **Phase 3:** Migrate window components to new props interface
4. **Phase 4:** Isolate ReactFlow to `mindscape/` and `graphs/` modules
5. **Phase 5:** Remove ReactFlow imports from desktop store

---

## Part II: Component Architecture

### 2.1 Shell Components

#### AlfredDesktopShell

Primary container orchestrating all desktop layers.

**File:** `apps/web/src/components/desktop/shell.tsx`

**Responsibilities:**

- Initialize desktop state from persisted storage
- Manage layer visibility and z-ordering
- Handle global keyboard shortcuts
- Coordinate window manager with tiling engine
- Bridge voice commands to window actions

**Props Interface:**

```
AlfredDesktopShellProps {
  initialLayout?: PersistedDesktopLayout
  userId: string
  onReady?: () => void
}
```

**State Dependencies:**

- `useDesktopStore()` — Primary desktop state
- `useTilingStore()` — Tiling layout state
- `useOrbStore()` — Orb presence state
- `useCognitiveStore()` — Cognitive feedback state

---

#### MenuBar

macOS-inspired top menu bar with Alfred branding.

**File:** `apps/web/src/components/desktop/menubar/menubar.tsx`

**Child Components:**

- `AlfredMenu` — Apple menu equivalent (About, Preferences, Quit)
- `AppMenu` — Context-sensitive menus for focused app
- `StatusArea` — System status icons
- `OrbMini` — Minimized Orb presence
- `ClockWidget` — Time display with calendar popover

**Props Interface:**

```
MenuBarProps {
  focusedWindow: WindowInstance | null
  cognitiveState: CognitivePhase
  agentCount: number
  notifications: Notification[]
}
```

---

#### Taskbar

Windows 11-inspired bottom taskbar with app launchers and system tray.

**File:** `apps/web/src/components/desktop/taskbar/taskbar.tsx`

**Child Components:**

- `LaunchButton` — Alfred logo, opens app drawer
- `PinnedApps` — User-pinned application shortcuts
- `RunningApps` — Active window indicators with previews
- `SystemTray` — Background service indicators
- `ClockTray` — Time with notification center toggle

**Props Interface:**

```
TaskbarProps {
  pinnedApps: WindowType[]
  runningWindows: WindowInstance[]
  systemServices: SystemService[]
  onLaunch: (type: WindowType) => void
  onFocus: (windowId: string) => void
}
```

---

### 2.2 Window Management

#### TilingWindowManager

Wayland-inspired tiling window manager supporting multiple layouts.

**File:** `apps/web/src/components/desktop/tiling/manager.tsx`

**Tiling Layouts:**

- `monocle` — Single fullscreen window
- `split-h` — Horizontal 50/50 split
- `split-v` — Vertical 50/50 split
- `thirds` — Three-column layout
- `quad` — Four-quadrant layout
- `master-stack` — Large master with stacked secondaries
- `floating` — Traditional floating windows

**Key Functions:**

```
TilingWindowManager {
  // Layout management
  setLayout(layout: TilingLayout): void
  cycleLayout(): void

  // Window operations
  tileWindow(windowId: string, zone: TileZone): void
  swapWindows(windowA: string, windowB: string): void
  focusDirection(direction: 'left' | 'right' | 'up' | 'down'): void

  // Zone management
  resizeZone(zoneId: string, delta: { width?: number, height?: number }): void
  splitZone(zoneId: string, direction: 'h' | 'v'): void
  mergeZones(zoneA: string, zoneB: string): void
}
```

---

#### WindowChrome

Unified window decoration with JARVIS-aesthetic styling.

**File:** `apps/web/src/components/desktop/windows/chrome.tsx`

**Visual Structure:**

```
┌─────────────────────────────────────────────────────────┐
│ ● ● ●  │ [Icon] Window Title          │ [−] [□] [×]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    Content Area                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
                                                        ↖ resize
```

**Props Interface:**

```
WindowChromeProps {
  id: string
  title: string
  icon: ReactNode
  type: WindowType
  children: ReactNode

  // Control visibility
  closable: boolean
  minimizable: boolean
  maximizable: boolean
  resizable: boolean

  // State
  isFocused: boolean
  isMaximized: boolean
  isTiled: boolean
  tileZone?: TileZone

  // Constraints
  minSize: { width: number, height: number }
  maxSize?: { width: number, height: number }

  // Callbacks
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
  onDragStart: (e: DragEvent) => void
  onResize: (size: Size) => void
}
```

---

### 2.3 Desktop Apps Hierarchy

```
apps/web/src/components/desktop/apps/
├── index.ts                    # App registry and exports
│
│ ══════════════════════════════════════════════════════════════
│ TIER 0: CORE EXPERIENCE (Ship First)
│ ══════════════════════════════════════════════════════════════
│
├── chat/                       # AI Conversation (@alfred/voice, @alfred/history)
│   ├── chat-app.tsx
│   ├── message-list.tsx
│   ├── input-area.tsx
│   ├── voice-indicator.tsx
│   ├── context-panel.tsx
│   ├── history-budget.tsx      # NEW: @alfred/history budget visualization
│   └── rag-context.tsx         # NEW: @alfred/rag context display
├── code/                       # Monaco Code Editor (@alfred/codex, @alfred/embed)
│   ├── code-app.tsx
│   ├── editor-tabs.tsx
│   ├── file-tree.tsx
│   ├── ai-suggestions.tsx
│   ├── diff-viewer.tsx
│   ├── minimap.tsx
│   └── semantic-search.tsx     # NEW: @alfred/embed semantic code search
├── agents/                     # Agent Waves Viewer (@alfred/runtime, @alfred/plan)
│   ├── agents-app.tsx
│   ├── wave-timeline.tsx
│   ├── agent-card.tsx
│   ├── spawn-tree.tsx
│   ├── execution-log.tsx
│   └── plan-preview.tsx        # NEW: @alfred/plan inline preview
├── terminal/                   # Enhanced Terminal (@alfred/tui)
│   ├── terminal-app.tsx
│   ├── terminal-tabs.tsx
│   ├── terminal-instance.tsx
│   ├── profiles.tsx
│   └── tui-mode.tsx            # NEW: @alfred/tui widget integration
│
│ ══════════════════════════════════════════════════════════════
│ TIER 1: SYSTEM & OPERATIONS
│ ══════════════════════════════════════════════════════════════
│
├── taskmanager/                # System Task Manager (@alfred/metrics)
│   ├── taskmanager-app.tsx
│   ├── process-list.tsx
│   ├── performance-chart.tsx
│   ├── network-tab.tsx
│   ├── history-tab.tsx
│   └── metrics-summary.tsx     # NEW: @alfred/metrics integration
├── docker/                     # Docker Container Manager
│   ├── docker-app.tsx
│   ├── container-list.tsx
│   ├── container-detail.tsx
│   ├── logs-viewer.tsx
│   └── resource-chart.tsx
├── pr-review/                  # Pull Request Review (@alfred/policy)
│   ├── pr-app.tsx
│   ├── pr-list.tsx
│   ├── diff-panel.tsx
│   ├── comment-thread.tsx
│   ├── merge-controls.tsx
│   └── policy-gate.tsx         # NEW: @alfred/policy approval status
├── agentfs/                    # AgentFS Call History
│   ├── agentfs-app.tsx
│   ├── call-timeline.tsx
│   ├── file-audit.tsx
│   ├── checkpoint-browser.tsx
│   └── kv-viewer.tsx
├── files/                      # File Browser
│   ├── files-app.tsx
│   ├── tree-sidebar.tsx
│   ├── file-grid.tsx
│   ├── breadcrumbs.tsx
│   └── quick-look.tsx
│
│ ══════════════════════════════════════════════════════════════
│ TIER 2: INTELLIGENCE & LEARNING (NEW APPS)
│ ══════════════════════════════════════════════════════════════
│
├── cortex/                     # NEW: GPU Visualization (@alfred/cortex)
│   ├── cortex-app.tsx
│   ├── shader-preview.tsx
│   ├── parameter-tuner.tsx
│   ├── preset-browser.tsx
│   └── gpu-monitor.tsx
├── learning/                   # NEW: Self-Supervision Dashboard (@alfred/learning)
│   ├── learning-app.tsx
│   ├── mistake-ledger.tsx
│   ├── correction-timeline.tsx
│   ├── accuracy-chart.tsx
│   └── improvement-insights.tsx
├── policy/                     # NEW: Policy Decision Viewer (@alfred/policy)
│   ├── policy-app.tsx
│   ├── decision-log.tsx
│   ├── constraint-list.tsx
│   ├── autonomy-controls.tsx
│   └── rule-editor.tsx
├── tune/                       # NEW: Fine-Tuning Manager (@alfred/tune)
│   ├── tune-app.tsx
│   ├── job-list.tsx
│   ├── training-progress.tsx
│   ├── dataset-browser.tsx
│   ├── hyperparameter-editor.tsx
│   └── model-comparison.tsx
├── plan/                       # NEW: Plan Editor (@alfred/plan)
│   ├── plan-app.tsx
│   ├── plan-canvas.tsx
│   ├── intent-debugger.tsx
│   ├── research-panel.tsx
│   ├── pattern-library.tsx
│   └── evaluation-metrics.tsx
├── metrics/                    # NEW: Prometheus Metrics Dashboard (@alfred/metrics)
│   ├── metrics-app.tsx
│   ├── metric-explorer.tsx
│   ├── dashboard-builder.tsx
│   ├── alert-config.tsx
│   └── query-editor.tsx
├── rag/                        # NEW: RAG Debug Explorer (@alfred/rag, @alfred/embed)
│   ├── rag-app.tsx
│   ├── chunk-browser.tsx
│   ├── embedding-visualizer.tsx
│   ├── retrieval-debugger.tsx
│   ├── rerank-tuner.tsx
│   └── similarity-explorer.tsx
│
│ ══════════════════════════════════════════════════════════════
│ TIER 3: KNOWLEDGE & EXPLORATION
│ ══════════════════════════════════════════════════════════════
│
├── knowledge/                  # Knowledge Graph Explorer
│   ├── knowledge-app.tsx
│   ├── graph-canvas.tsx
│   ├── entity-panel.tsx
│   ├── fact-list.tsx
│   └── search-bar.tsx
├── workflow/                   # Workflow Builder
│   ├── workflow-app.tsx
│   ├── node-canvas.tsx
│   ├── node-palette.tsx
│   ├── execution-panel.tsx
│   └── variable-inspector.tsx
├── linear/                     # Linear Integration
│   ├── linear-app.tsx
│   ├── issue-list.tsx
│   ├── issue-detail.tsx
│   └── project-board.tsx
│
│ ══════════════════════════════════════════════════════════════
│ TIER 4: PRODUCTIVITY & SETTINGS
│ ══════════════════════════════════════════════════════════════
│
├── settings/                   # Settings Panel (@alfred/auth, @alfred/policy)
│   ├── settings-app.tsx
│   ├── profile-section.tsx
│   ├── privacy-section.tsx
│   ├── visual-section.tsx
│   ├── integrations-section.tsx
│   ├── agents-section.tsx
│   ├── sessions-section.tsx    # NEW: @alfred/auth session management
│   ├── tokens-section.tsx      # NEW: @alfred/auth token management
│   └── policy-section.tsx      # NEW: @alfred/policy user preferences
├── notes/                      # Note Editor
│   ├── notes-app.tsx
│   ├── note-list.tsx
│   ├── rich-editor.tsx
│   └── tags-panel.tsx
├── reminders/                  # Reminder Manager
│   ├── reminders-app.tsx
│   ├── reminder-list.tsx
│   ├── schedule-picker.tsx
│   └── recurrence-config.tsx
└── todos/                      # Todo Lists
    ├── todos-app.tsx
    ├── todo-list.tsx
    ├── todo-item.tsx
    └── filters.tsx
```

---

## Part III: Desktop Application Specifications

### 3.1 Chat Application — Voice-First AI Conversation

**Primary Purpose:** Jack's main interface for conversing with ALFRED via voice or text, with full context awareness and knowledge integration.

#### Component Structure

**ChatApp** — `apps/web/src/components/desktop/apps/chat/chat-app.tsx`

```
ChatAppProps {
  initialThreadId?: string
  contextRefs?: ResourceRef[]
  voiceEnabled?: boolean
}
```

**Key Child Components:**

| Component          | File                    | Purpose                                            |
| ------------------ | ----------------------- | -------------------------------------------------- |
| `MessageList`      | `message-list.tsx`      | Virtualized message history with streaming support |
| `InputArea`        | `input-area.tsx`        | Text input with voice toggle and attachments       |
| `VoiceIndicator`   | `voice-indicator.tsx`   | Real-time voice waveform visualization             |
| `ContextPanel`     | `context-panel.tsx`     | Collapsible panel showing active context           |
| `ThreadSidebar`    | `thread-sidebar.tsx`    | Previous conversation threads                      |
| `KnowledgePreview` | `knowledge-preview.tsx` | Inline knowledge node previews                     |

**State Management:**

```
useChatAppStore {
  // Thread state
  activeThreadId: string | null
  messages: UIMessage[]
  isStreaming: boolean

  // Voice state
  voiceMode: 'idle' | 'listening' | 'processing' | 'speaking'
  audioLevel: number
  transcript: string

  // Context state
  contextRefs: ResourceRef[]
  ragResults: RagDocEntry[]

  // Actions
  sendMessage(content: string): Promise<void>
  startVoice(): void
  stopVoice(): void
  attachContext(ref: ResourceRef): void
  selectThread(threadId: string): void
}
```

**Backend Integration:**

| Router      | Procedures          | Usage                             |
| ----------- | ------------------- | --------------------------------- |
| `assistant` | `stream`            | Primary message streaming         |
| `voice`     | `stt`, `tts`, `s2s` | Voice transcription and synthesis |
| `cognitive` | `state`, `feedback` | Cognitive state display           |
| `knowledge` | `search`            | Context-aware knowledge retrieval |
| `graph`     | `query`             | Knowledge graph lookups           |

**Voice-to-Voice Flow:**

```
1. Jack clicks mic or says "Alfred"
   → VoiceIndicator transitions to 'listening'
   → voice.stt stream opens

2. Speech detected
   → Real-time transcript appears in InputArea
   → Waveform animates in VoiceIndicator

3. Speech ends (VAD or manual)
   → voice.stt closes
   → Final transcript sent to assistant.stream

4. ALFRED responds
   → MessageList streams response
   → voice.tts synthesizes audio
   → VoiceIndicator shows 'speaking'
   → Orb animates talking state

5. Response complete
   → VoiceIndicator returns to 'idle'
   → Optional: auto-listen for follow-up
```

---

### 3.2 Monaco Code Editor — AI-Augmented Development

**Primary Purpose:** Full-featured code editor with AI inline completions, integrated with AgentFS for agent-modified files and Codex for execution.

#### Component Structure

**CodeApp** — `apps/web/src/components/desktop/apps/code/code-app.tsx`

```
CodeAppProps {
  initialFile?: FilePath
  projectRoot?: string
  agentContext?: AgentContext
}
```

**Key Child Components:**

| Component       | File                 | Purpose                                  |
| --------------- | -------------------- | ---------------------------------------- |
| `EditorTabs`    | `editor-tabs.tsx`    | Multi-file tab bar with dirty indicators |
| `MonacoEditor`  | `monaco-editor.tsx`  | Core Monaco instance with ALFRED theme   |
| `FileTree`      | `file-tree.tsx`      | Project file navigator                   |
| `AISuggestions` | `ai-suggestions.tsx` | Inline completion overlay                |
| `DiffViewer`    | `diff-viewer.tsx`    | Side-by-side and inline diff modes       |
| `SymbolOutline` | `symbol-outline.tsx` | Function/class outline panel             |
| `GitGutter`     | `git-gutter.tsx`     | Line-level git status                    |

**Monaco Configuration:**

```
MonacoConfig {
  theme: 'alfred-void'
  fontFamily: 'JetBrains Mono, monospace'
  fontSize: 14
  lineHeight: 1.6
  minimap: { enabled: true, scale: 1 }
  wordWrap: 'on'
  formatOnSave: true

  // AI Features
  inlineSuggest: { enabled: true }
  suggestOnTriggerCharacters: true

  // ALFRED-specific
  agentEditHighlight: true
  knowledgeHover: true
  contextAwareness: true
}
```

**AI Completion Integration:**

```
useAICompletions {
  // State
  suggestions: CompletionSuggestion[]
  isLoading: boolean
  confidenceThreshold: number

  // Methods
  triggerCompletion(position: Position): Promise<void>
  acceptSuggestion(index: number): void
  dismissSuggestion(): void

  // Configuration
  setModel(model: string): void
  setContext(files: string[]): void
}
```

**Backend Integration:**

| Router    | Procedures                          | Usage                 |
| --------- | ----------------------------------- | --------------------- |
| `fs`      | `read`, `write`, `list`             | File operations       |
| `codex`   | `stream`, `sessions`                | AI code generation    |
| `agentfs` | `workspace.read`, `workspace.write` | Agent workspace files |
| `droid`   | `stream`                            | Agent-driven edits    |

---

### 3.3 Agent Waves Viewer — Autonomous Execution Visualization

**Primary Purpose:** Real-time visualization of orchestrated agent spawns showing execution waves, dependencies, and progress for autonomous code development projects.

#### Component Structure

**AgentsApp** — `apps/web/src/components/desktop/apps/agents/agents-app.tsx`

```
AgentsAppProps {
  runId?: string
  projectId?: string
  autoRefresh?: boolean
}
```

**Key Child Components:**

| Component         | File                   | Purpose                                |
| ----------------- | ---------------------- | -------------------------------------- |
| `WaveTimeline`    | `wave-timeline.tsx`    | Horizontal timeline of execution waves |
| `AgentCard`       | `agent-card.tsx`       | Individual agent status card           |
| `SpawnTree`       | `spawn-tree.tsx`       | Hierarchical spawn visualization       |
| `ExecutionLog`    | `execution-log.tsx`    | Scrollable log of agent actions        |
| `DependencyGraph` | `dependency-graph.tsx` | Visual dep graph between subtasks      |
| `ResourceUsage`   | `resource-usage.tsx`   | CPU/memory/API usage meters            |

**Wave Visualization Model:**

```
Wave {
  id: string
  number: number
  status: 'pending' | 'active' | 'completed' | 'failed'
  startedAt?: Timestamp
  completedAt?: Timestamp

  agents: AgentInstance[]
  dependencies: WaveDependency[]

  metrics: {
    totalAgents: number
    completedAgents: number
    failedAgents: number
    avgDurationMs: number
  }
}

AgentInstance {
  id: string
  type: 'codex' | 'droid' | 'claude' | 'roo'
  subtaskId: string
  subtaskTitle: string
  status: AgentStatus

  spawned: Timestamp
  completed?: Timestamp

  toolCalls: ToolCallSummary[]
  filesModified: string[]
  linesChanged: number

  error?: AgentError
}
```

**Backend Integration:**

| Router         | Procedures                | Usage                            |
| -------------- | ------------------------- | -------------------------------- |
| `orchestrator` | `run`, `stream`, `events` | Orchestration execution          |
| `droid`        | `stream`                  | Individual agent streams         |
| `codex`        | `sessions`                | Codex CLI agent sessions         |
| `workflow`     | `events`                  | Workflow event stream            |
| `plan`         | `generate`, `status`      | ExecPlan generation and tracking |

**Real-time Event Streaming:**

```
useAgentWavesStream(runId: string) {
  // Subscriptions
  orchestratorEvents: EventSource → OrchestratorEvent[]
  agentUpdates: Map<string, AgentUpdate>

  // Derived state
  waves: Wave[]
  activeWave: Wave | null
  completedWaves: Wave[]

  // Actions
  pauseExecution(): Promise<void>
  resumeExecution(): Promise<void>
  cancelAgent(agentId: string): Promise<void>
  retrySubtask(subtaskId: string): Promise<void>
}
```

---

### 3.4 PR Review Application — Code Review Interface

**Primary Purpose:** Review pull requests generated by autonomous agents, view diffs, add comments, and approve/merge with biometric authentication.

#### Component Structure

**PRApp** — `apps/web/src/components/desktop/apps/pr-review/pr-app.tsx`

```
PRAppProps {
  initialPRId?: string
  repository?: string
  filterState?: PRFilterState
}
```

**Key Child Components:**

| Component         | File                   | Purpose                                    |
| ----------------- | ---------------------- | ------------------------------------------ |
| `PRList`          | `pr-list.tsx`          | Filterable list of PRs                     |
| `PRDetail`        | `pr-detail.tsx`        | Full PR information panel                  |
| `DiffPanel`       | `diff-panel.tsx`       | File-by-file diff viewer                   |
| `CommentThread`   | `comment-thread.tsx`   | Inline comment threads                     |
| `MergeControls`   | `merge-controls.tsx`   | Merge/squash/rebase buttons with biometric |
| `CIStatus`        | `ci-status.tsx`        | CI/CD pipeline status                      |
| `ReviewChecklist` | `review-checklist.tsx` | AI-generated review checklist              |

**PR Data Model:**

```
PullRequest {
  id: string
  number: number
  title: string
  description: string

  author: {
    type: 'human' | 'agent'
    id: string
    name: string
    avatar?: string
  }

  repository: Repository
  sourceBranch: string
  targetBranch: string

  status: 'open' | 'merged' | 'closed'
  reviewStatus: 'pending' | 'approved' | 'changes_requested'

  diff: DiffSummary
  comments: Comment[]
  reviews: Review[]
  ciChecks: CICheck[]

  createdAt: Timestamp
  updatedAt: Timestamp

  // ALFRED-specific
  orchestratorRunId?: string
  subtaskIds?: string[]
  linearIssueId?: string
}
```

**Backend Integration:**

| Router     | Procedures           | Usage                      |
| ---------- | -------------------- | -------------------------- |
| `workflow` | `events`             | PR creation events         |
| `linear`   | `updateIssue`        | Link PRs to Linear issues  |
| `deploy`   | `preview`, `promote` | Deployment from PR         |
| `codex`    | `sessions`           | View agent that created PR |
| `agentfs`  | `audit`              | File change history        |

---

### 3.5 Docker Container Manager — Container Orchestration

**Primary Purpose:** Manage AgentFS Docker containers, view logs, resource usage, and control container lifecycle for agent workspaces.

#### Component Structure

**DockerApp** — `apps/web/src/components/desktop/apps/docker/docker-app.tsx`

```
DockerAppProps {
  filterRunning?: boolean
  agentRunId?: string
}
```

**Key Child Components:**

| Component          | File                    | Purpose                            |
| ------------------ | ----------------------- | ---------------------------------- |
| `ContainerList`    | `container-list.tsx`    | List of all containers with status |
| `ContainerDetail`  | `container-detail.tsx`  | Full container information         |
| `LogsViewer`       | `logs-viewer.tsx`       | Real-time log streaming            |
| `ResourceChart`    | `resource-chart.tsx`    | CPU/memory/network graphs          |
| `VolumeManager`    | `volume-manager.tsx`    | Volume mount management            |
| `NetworkInspector` | `network-inspector.tsx` | Container network view             |

**Container Model:**

```
Container {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'paused' | 'created'

  // AgentFS metadata
  agentFsWorkspaceId?: string
  orchestratorRunId?: string
  agentType?: 'codex' | 'droid'

  // Resources
  cpu: { usage: number, limit: number }
  memory: { usage: number, limit: number }
  network: { rx: number, tx: number }

  // Mounts
  volumes: VolumeMount[]

  // Lifecycle
  createdAt: Timestamp
  startedAt?: Timestamp
  finishedAt?: Timestamp
  exitCode?: number

  // Ports
  ports: PortMapping[]
}
```

**Backend Integration:**

| Router    | Procedures        | Usage                        |
| --------- | ----------------- | ---------------------------- |
| `deploy`  | `health`, `probe` | Container health checks      |
| `agentfs` | `workspace.list`  | AgentFS workspace containers |
| `admin`   | `perfStats`       | Resource statistics          |

---

### 3.6 Knowledge Graph Explorer — Hypergraph Visualization

**Primary Purpose:** Interactive exploration of ALFRED's knowledge memory hypergraph, viewing entities, facts, relations, and temporal evolution.

#### Component Structure

**KnowledgeApp** — `apps/web/src/components/desktop/apps/knowledge/knowledge-app.tsx`

```
KnowledgeAppProps {
  initialQuery?: string
  focusEntityId?: string
  timeRange?: TimeRange
}
```

**Key Child Components:**

| Component      | File                | Purpose                            |
| -------------- | ------------------- | ---------------------------------- |
| `GraphCanvas`  | `graph-canvas.tsx`  | Force-directed graph visualization |
| `EntityPanel`  | `entity-panel.tsx`  | Selected entity details            |
| `FactList`     | `fact-list.tsx`     | Facts associated with entity       |
| `RelationList` | `relation-list.tsx` | Entity relationships               |
| `SearchBar`    | `search-bar.tsx`    | Semantic and keyword search        |
| `TimeSlider`   | `time-slider.tsx`   | Temporal navigation                |
| `InsightPanel` | `insight-panel.tsx` | AI-generated insights              |

**Knowledge Data Model:**

```
KnowledgeEntity {
  id: string
  type: EntityType
  name: string
  aliases: string[]

  facts: KnowledgeFact[]
  relations: KnowledgeRelation[]

  confidence: number
  source: 'conversation' | 'extraction' | 'inference'

  createdAt: Timestamp
  updatedAt: Timestamp

  // Visualization
  position?: { x: number, y: number }
  cluster?: string
}

KnowledgeFact {
  id: string
  subject: string
  predicate: string
  object: string

  confidence: number
  temporal?: TemporalScope

  sources: FactSource[]
  contradictions?: Contradiction[]
}

KnowledgeRelation {
  id: string
  type: RelationType
  sourceId: string
  targetId: string

  strength: number
  bidirectional: boolean

  metadata?: Record<string, unknown>
}
```

**Backend Integration:**

| Router      | Procedures                     | Usage                |
| ----------- | ------------------------------ | -------------------- |
| `graph`     | `query`, `connect`, `watch`    | Graph operations     |
| `knowledge` | `extract`, `search`, `explain` | Knowledge extraction |
| `cognitive` | `state`                        | Cognitive context    |

---

### 3.7 AgentFS Call History Viewer — Audit Trail

**Primary Purpose:** View complete audit trail of AgentFS operations, file changes, checkpoints, and KV store modifications.

#### Component Structure

**AgentFSApp** — `apps/web/src/components/desktop/apps/agentfs/agentfs-app.tsx`

```
AgentFSAppProps {
  workspaceId?: string
  filterAgentId?: string
  timeRange?: TimeRange
}
```

**Key Child Components:**

| Component           | File                     | Purpose                          |
| ------------------- | ------------------------ | -------------------------------- |
| `WorkspaceList`     | `workspace-list.tsx`     | List of AgentFS workspaces       |
| `CallTimeline`      | `call-timeline.tsx`      | Chronological operation timeline |
| `FileAudit`         | `file-audit.tsx`         | File-level change history        |
| `CheckpointBrowser` | `checkpoint-browser.tsx` | Browse and restore checkpoints   |
| `KVViewer`          | `kv-viewer.tsx`          | Key-value store browser          |
| `OperationDetail`   | `operation-detail.tsx`   | Full operation details           |

**AgentFS Data Model:**

```
AgentFSWorkspace {
  id: string
  runId: string
  containerId: string
  containerName: string

  status: 'active' | 'suspended' | 'completed' | 'failed'

  // Stats
  totalOperations: number
  filesModified: number
  checkpointCount: number

  createdAt: Timestamp
  lastActivityAt: Timestamp
}

AgentFSOperation {
  id: string
  workspaceId: string
  agentId: string

  type: 'read' | 'write' | 'delete' | 'exec' | 'checkpoint' | 'kv'
  path?: string

  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string

  durationMs: number
  timestamp: Timestamp
}
```

**Backend Integration:**

| Router    | Procedures             | Usage                   |
| --------- | ---------------------- | ----------------------- |
| `agentfs` | `workspace.*`, `audit` | All AgentFS operations  |
| `droid`   | `stream`               | Link to agent execution |
| `codex`   | `sessions`             | Link to Codex sessions  |

---

### 3.8 Cortex Visualizer — GPU-Accelerated Rendering (`@alfred/cortex`)

**Primary Purpose:** Configure and preview WebGPU shader-based visualizations for the Orb, living wallpaper, and knowledge graph rendering. Direct interface to the cortex GPU acceleration layer.

#### Component Structure

**CortexApp** — `apps/web/src/components/desktop/apps/cortex/cortex-app.tsx`

```
CortexAppProps {
  initialPreset?: string
  previewMode?: 'orb' | 'wallpaper' | 'graph' | 'custom'
}
```

**Key Child Components:**

| Component        | File                  | Purpose                                |
| ---------------- | --------------------- | -------------------------------------- |
| `ShaderPreview`  | `shader-preview.tsx`  | Live WebGPU shader rendering canvas    |
| `ParameterTuner` | `parameter-tuner.tsx` | Real-time shader parameter sliders     |
| `PresetBrowser`  | `preset-browser.tsx`  | Browse and apply visualization presets |
| `GPUMonitor`     | `gpu-monitor.tsx`     | GPU utilization and memory metrics     |
| `ShaderEditor`   | `shader-editor.tsx`   | WGSL shader code editor (advanced)     |
| `ExportPanel`    | `export-panel.tsx`    | Export presets as shareable configs    |

**Cortex Data Model:**

```
CortexPreset {
  id: string
  name: string
  category: 'orb' | 'wallpaper' | 'graph' | 'particle' | 'neural'

  shader: {
    vertex: string      // WGSL vertex shader
    fragment: string    // WGSL fragment shader
    compute?: string    // WGSL compute shader (optional)
  }

  parameters: ShaderParameter[]

  metadata: {
    author: string
    createdAt: Timestamp
    gpuRequirements: GPURequirements
  }
}

ShaderParameter {
  name: string
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'color' | 'texture'
  default: number | number[]
  min?: number
  max?: number
  step?: number
  label: string
}
```

**Backend Integration:**

| Router      | Procedures                                   | Usage                                |
| ----------- | -------------------------------------------- | ------------------------------------ |
| `visual`    | `config.get`, `presets.list`, `presets.save` | Preset management                    |
| `cognitive` | `state`                                      | Cognitive state for adaptive visuals |

**GPU Integration:**

```
useCortexEngine() {
  // WebGPU state
  device: GPUDevice | null
  adapter: GPUAdapter | null
  isSupported: boolean

  // Rendering
  renderFrame(preset: CortexPreset, params: Record<string, unknown>): void
  setParameter(name: string, value: unknown): void

  // Performance
  gpuMetrics: { utilization: number, memory: number, fps: number }

  // Presets
  loadPreset(presetId: string): Promise<void>
  savePreset(preset: CortexPreset): Promise<void>
}
```

---

### 3.9 Learning Dashboard — Self-Supervision Insights (`@alfred/learning`)

**Primary Purpose:** Visualize ALFRED's learning progress, mistake ledger, self-corrections, and continuous improvement metrics over time.

#### Component Structure

**LearningApp** — `apps/web/src/components/desktop/apps/learning/learning-app.tsx`

```
LearningAppProps {
  timeRange?: TimeRange
  focusCategory?: LearningCategory
}
```

**Key Child Components:**

| Component             | File                       | Purpose                                      |
| --------------------- | -------------------------- | -------------------------------------------- |
| `MistakeLedger`       | `mistake-ledger.tsx`       | Chronological list of errors and corrections |
| `CorrectionTimeline`  | `correction-timeline.tsx`  | Visual timeline of self-corrections          |
| `AccuracyChart`       | `accuracy-chart.tsx`       | Accuracy trends over time by category        |
| `ImprovementInsights` | `improvement-insights.tsx` | AI-generated insights on learning patterns   |
| `CategoryBreakdown`   | `category-breakdown.tsx`   | Error distribution by task category          |
| `LearningGoals`       | `learning-goals.tsx`       | Track progress toward improvement goals      |

**Learning Data Model:**

```
MistakeEntry {
  id: string
  timestamp: Timestamp

  category: LearningCategory
  severity: 'minor' | 'moderate' | 'critical'

  context: {
    taskType: string
    agentId?: string
    runId?: string
    input: string
    expectedOutput: string
    actualOutput: string
  }

  correction: {
    correctedAt: Timestamp
    correctedOutput: string
    correctionSource: 'user' | 'self' | 'supervisor'
    lessonLearned: string
  }

  recurrence: {
    count: number
    lastOccurrence: Timestamp
    resolved: boolean
  }
}

LearningMetrics {
  period: TimeRange

  accuracy: {
    overall: number
    byCategory: Record<LearningCategory, number>
    trend: number  // positive = improving
  }

  mistakes: {
    total: number
    corrected: number
    recurring: number
  }

  improvements: {
    categoriesImproved: string[]
    newCapabilities: string[]
    regressions: string[]
  }
}

LearningCategory = 'code_generation' | 'planning' | 'tool_use' | 'reasoning' | 'knowledge' | 'communication'
```

**Backend Integration:**

| Router      | Procedures                         | Usage               |
| ----------- | ---------------------------------- | ------------------- |
| `cognitive` | `feedback.list`, `feedback.submit` | Feedback management |
| `knowledge` | `extract`                          | Learning extraction |

**Note:** `@alfred/learning` package provides `mistake_ledger` and `self_supervision` - router integration pending.

---

### 3.10 Policy Viewer — Autonomy & Constraints (`@alfred/policy`)

**Primary Purpose:** View and manage ALFRED's policy decisions, autonomy constraints, permission history, and approval workflows.

#### Component Structure

**PolicyApp** — `apps/web/src/components/desktop/apps/policy/policy-app.tsx`

```
PolicyAppProps {
  filterScope?: PolicyScope
  showHistory?: boolean
}
```

**Key Child Components:**

| Component          | File                    | Purpose                          |
| ------------------ | ----------------------- | -------------------------------- |
| `DecisionLog`      | `decision-log.tsx`      | Audit trail of policy decisions  |
| `ConstraintList`   | `constraint-list.tsx`   | Active autonomy constraints      |
| `AutonomyControls` | `autonomy-controls.tsx` | Adjust autonomy levels           |
| `RuleEditor`       | `rule-editor.tsx`       | Edit/create policy rules (admin) |
| `ApprovalQueue`    | `approval-queue.tsx`    | Pending approval requests        |
| `ScopeViewer`      | `scope-viewer.tsx`      | OAuth scope breakdown            |

**Policy Data Model:**

```
PolicyDecision {
  id: string
  timestamp: Timestamp

  request: {
    action: PolicyAction
    resource: string
    scope: PolicyScope
    agentId?: string
    context: Record<string, unknown>
  }

  decision: {
    outcome: 'allow' | 'deny' | 'escalate'
    reason: string
    rule: string
    confidence: number
  }

  escalation?: {
    escalatedTo: 'user' | 'supervisor'
    resolvedAt?: Timestamp
    resolution?: 'approved' | 'denied'
  }
}

AutonomyConstraint {
  id: string
  name: string
  description: string

  scope: PolicyScope
  level: 'read' | 'low' | 'medium' | 'high'

  conditions: ConstraintCondition[]

  enabled: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

PolicyScope = 'filesystem' | 'network' | 'shell' | 'database' | 'external_api' | 'deployment'
PolicyAction = 'read' | 'write' | 'delete' | 'execute' | 'deploy' | 'approve'
```

**Backend Integration:**

| Router      | Procedures                     | Usage             |
| ----------- | ------------------------------ | ----------------- |
| `admin`     | `policy.list`, `policy.update` | Policy management |
| `cognitive` | `autonomy.get`, `autonomy.set` | Autonomy levels   |

**Note:** Maps to `@alfred/policy` package's PDP (Policy Decision Point) engine.

---

### 3.11 Tune Manager — Fine-Tuning Dashboard (`@alfred/tune`)

**Primary Purpose:** Manage MLX fine-tuning jobs, monitor training progress, browse datasets, and compare model performance.

#### Component Structure

**TuneApp** — `apps/web/src/components/desktop/apps/tune/tune-app.tsx`

```
TuneAppProps {
  initialJobId?: string
  filterStatus?: JobStatus
}
```

**Key Child Components:**

| Component              | File                        | Purpose                              |
| ---------------------- | --------------------------- | ------------------------------------ |
| `JobList`              | `job-list.tsx`              | List of fine-tuning jobs with status |
| `TrainingProgress`     | `training-progress.tsx`     | Real-time loss/accuracy charts       |
| `DatasetBrowser`       | `dataset-browser.tsx`       | Browse and preview training datasets |
| `HyperparameterEditor` | `hyperparameter-editor.tsx` | Configure training hyperparameters   |
| `ModelComparison`      | `model-comparison.tsx`      | Compare base vs fine-tuned models    |
| `CheckpointManager`    | `checkpoint-manager.tsx`    | Manage training checkpoints          |

**Tune Data Model:**

```
TuneJob {
  id: string
  name: string
  status: JobStatus

  config: {
    baseModel: string
    dataset: string
    epochs: number
    batchSize: number
    learningRate: number
    loraRank?: number
    loraAlpha?: number
  }

  progress: {
    currentEpoch: number
    currentStep: number
    totalSteps: number
    loss: number
    accuracy?: number
    eta?: number  // seconds remaining
  }

  metrics: {
    trainingLoss: number[]
    validationLoss: number[]
    accuracy: number[]
  }

  checkpoints: TuneCheckpoint[]

  createdAt: Timestamp
  startedAt?: Timestamp
  completedAt?: Timestamp

  error?: string
}

TuneDataset {
  id: string
  name: string
  description: string

  stats: {
    samples: number
    avgTokens: number
    categories: string[]
  }

  preview: DatasetSample[]
}

JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
```

**Backend Integration:**

| Router | Procedures                                   | Usage            |
| ------ | -------------------------------------------- | ---------------- |
| `tune` | `start`, `pause`, `resume`, `cancel`, `list` | Job management   |
| `eval` | `run`, `scores`                              | Model evaluation |

---

### 3.12 Plan Editor — Visual Planning (`@alfred/plan`)

**Primary Purpose:** Create, edit, and debug execution plans with visual canvas, intent classification, research integration, and pattern library.

#### Component Structure

**PlanApp** — `apps/web/src/components/desktop/apps/plan/plan-app.tsx`

```
PlanAppProps {
  initialPlanId?: string
  mode?: 'edit' | 'debug' | 'research'
}
```

**Key Child Components:**

| Component           | File                     | Purpose                            |
| ------------------- | ------------------------ | ---------------------------------- |
| `PlanCanvas`        | `plan-canvas.tsx`        | Visual plan builder with drag-drop |
| `IntentDebugger`    | `intent-debugger.tsx`    | Test intent classification         |
| `ResearchPanel`     | `research-panel.tsx`     | Integrated research results        |
| `PatternLibrary`    | `pattern-library.tsx`    | Reusable plan patterns             |
| `EvaluationMetrics` | `evaluation-metrics.tsx` | Plan quality metrics               |
| `DependencyGraph`   | `dependency-graph.tsx`   | Task dependency visualization      |

**Plan Data Model:**

```
Plan {
  id: string
  name: string
  description: string

  goal: string
  constraints: string[]

  tasks: PlanTask[]
  dependencies: TaskDependency[]

  research: {
    queries: ResearchQuery[]
    results: ResearchResult[]
  }

  evaluation: {
    feasibility: number
    complexity: number
    estimatedDuration: number
    confidence: number
  }

  status: 'draft' | 'validated' | 'executing' | 'completed'

  createdAt: Timestamp
  updatedAt: Timestamp
}

PlanTask {
  id: string
  title: string
  description: string

  type: 'code' | 'research' | 'review' | 'deploy' | 'test'
  priority: 'critical' | 'high' | 'medium' | 'low'

  assignee?: 'codex' | 'droid' | 'claude' | 'human'

  inputs: string[]
  outputs: string[]

  estimatedMinutes: number
}

IntentClassification {
  input: string
  intent: string
  confidence: number

  entities: ExtractedEntity[]
  suggestedPlan?: Plan
}
```

**Backend Integration:**

| Router        | Procedures                     | Usage                    |
| ------------- | ------------------------------ | ------------------------ |
| `plan`        | `generate`, `validate`, `save` | Plan CRUD                |
| `codexIntent` | `classify`, `suggest`          | Intent classification    |
| `workflow`    | `create`                       | Convert plan to workflow |

---

### 3.13 Metrics Dashboard — Prometheus Explorer (`@alfred/metrics`)

**Primary Purpose:** Full Prometheus metrics dashboard for monitoring ALFRED's performance, resource usage, and operational health.

#### Component Structure

**MetricsApp** — `apps/web/src/components/desktop/apps/metrics/metrics-app.tsx`

```
MetricsAppProps {
  initialDashboard?: string
  timeRange?: TimeRange
}
```

**Key Child Components:**

| Component          | File                    | Purpose                    |
| ------------------ | ----------------------- | -------------------------- |
| `MetricExplorer`   | `metric-explorer.tsx`   | Browse available metrics   |
| `DashboardBuilder` | `dashboard-builder.tsx` | Create custom dashboards   |
| `AlertConfig`      | `alert-config.tsx`      | Configure metric alerts    |
| `QueryEditor`      | `query-editor.tsx`      | PromQL query interface     |
| `ChartPanel`       | `chart-panel.tsx`       | Configurable metric charts |
| `HealthOverview`   | `health-overview.tsx`   | System health summary      |

**Metrics Data Model:**

```
MetricDefinition {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  help: string
  labels: string[]

  category: MetricCategory
}

Dashboard {
  id: string
  name: string
  description: string

  panels: DashboardPanel[]

  variables: DashboardVariable[]

  refreshInterval: number
  timeRange: TimeRange

  createdAt: Timestamp
  updatedAt: Timestamp
}

DashboardPanel {
  id: string
  title: string
  type: 'graph' | 'stat' | 'table' | 'gauge' | 'heatmap'

  query: string  // PromQL

  position: { x: number, y: number, w: number, h: number }

  options: Record<string, unknown>
}

MetricCategory = 'cognitive' | 'agent' | 'voice' | 'api' | 'db' | 'system'
```

**Backend Integration:**

| Router  | Procedures                | Usage            |
| ------- | ------------------------- | ---------------- |
| `admin` | `perfStats`, `voiceStats` | Aggregated stats |

**Direct Integration:** Prometheus metrics scraped from `/api/metrics` endpoint.

---

### 3.14 RAG Explorer — Retrieval Debug Interface (`@alfred/rag`, `@alfred/embed`)

**Primary Purpose:** Debug and tune RAG retrieval, visualize embeddings, inspect chunk relevance, and optimize reranking.

#### Component Structure

**RAGApp** — `apps/web/src/components/desktop/apps/rag/rag-app.tsx`

```
RAGAppProps {
  initialQuery?: string
  collection?: string
}
```

**Key Child Components:**

| Component             | File                       | Purpose                          |
| --------------------- | -------------------------- | -------------------------------- |
| `ChunkBrowser`        | `chunk-browser.tsx`        | Browse indexed document chunks   |
| `EmbeddingVisualizer` | `embedding-visualizer.tsx` | t-SNE/UMAP embedding projection  |
| `RetrievalDebugger`   | `retrieval-debugger.tsx`   | Test queries and inspect results |
| `RerankTuner`         | `rerank-tuner.tsx`         | Tune reranking parameters        |
| `SimilarityExplorer`  | `similarity-explorer.tsx`  | Explore semantic similarities    |
| `IndexStats`          | `index-stats.tsx`          | Vector index statistics          |

**RAG Data Model:**

```
RAGChunk {
  id: string
  documentId: string

  content: string
  metadata: {
    source: string
    page?: number
    section?: string
    tokens: number
  }

  embedding?: number[]  // For visualization

  createdAt: Timestamp
}

RetrievalResult {
  query: string

  results: Array<{
    chunk: RAGChunk
    score: number
    rerankScore?: number
  }>

  metadata: {
    totalChunks: number
    searchTimeMs: number
    rerankTimeMs?: number
    embeddingModel: string
    rerankModel?: string
  }
}

EmbeddingProjection {
  method: 'tsne' | 'umap' | 'pca'
  dimensions: 2 | 3

  points: Array<{
    id: string
    position: number[]
    label?: string
    cluster?: number
  }>

  clusters?: Array<{
    id: number
    centroid: number[]
    label: string
    count: number
  }>
}
```

**Backend Integration:**

| Router      | Procedures        | Usage           |
| ----------- | ----------------- | --------------- |
| `graph`     | `query`, `search` | Vector search   |
| `knowledge` | `search`          | Semantic search |

**Package Integration:**

- `@alfred/rag`: `doc.ts`, `code.ts`, `rerank.ts`
- `@alfred/embed`: Embedding generation

---

## Part IV: State Management Architecture

### 4.1 Zustand Store Hierarchy

```
stores/
├── desktop/
│   ├── index.ts              # Combined desktop store
│   ├── types.ts              # Store type definitions
│   ├── windows.ts            # Window management slice
│   ├── tiling.ts             # Tiling layout slice
│   ├── viewport.ts           # Viewport/focus slice
│   ├── dock.ts               # Taskbar/dock slice
│   ├── context.ts            # Context/feedback slice
│   ├── cache.ts              # RAG cache slice
│   ├── knowledge.ts          # Knowledge graph slice
│   └── persist.ts            # Persistence middleware
│
│ ══════════════════════════════════════════════════════════════
│ CORE EXPERIENCE STORES
│ ══════════════════════════════════════════════════════════════
│
├── orb.ts                    # Orb presence state
├── voice.ts                  # Voice session state
├── cognitive.ts              # Cognitive feedback state
├── agents.ts                 # Agent execution state
├── pr-review.ts              # PR review state
├── docker.ts                 # Docker management state
├── code.ts                   # Code editor state
├── preferences.ts            # User preferences state
│
│ ══════════════════════════════════════════════════════════════
│ NEW: INTELLIGENCE & LEARNING STORES
│ ══════════════════════════════════════════════════════════════
│
├── cortex.ts                 # NEW: GPU visualization state (@alfred/cortex)
├── learning.ts               # NEW: Self-supervision state (@alfred/learning)
├── policy.ts                 # NEW: Policy/autonomy state (@alfred/policy)
├── tune.ts                   # NEW: Fine-tuning jobs state (@alfred/tune)
├── plan.ts                   # NEW: Plan editor state (@alfred/plan)
├── metrics.ts                # NEW: Prometheus metrics state (@alfred/metrics)
├── rag.ts                    # NEW: RAG debug state (@alfred/rag)
│
│ ══════════════════════════════════════════════════════════════
│ ENHANCED: EXISTING STORES WITH NEW SLICES
│ ══════════════════════════════════════════════════════════════
│
├── history.ts                # NEW: Message history budget (@alfred/history)
├── auth.ts                   # NEW: Session management (@alfred/auth)
└── embed.ts                  # NEW: Embedding state (@alfred/embed)
```

### 4.2 Desktop Store — Primary UI State (NO ReactFlow)

**File:** `apps/web/src/store/desktop/index.ts`

```
// NEW: No ReactFlow dependency — KnowledgeSlice moved to MindscapeStore
DesktopStore = WindowSlice & TilingSlice & ViewportSlice & TaskbarSlice & ContextSlice & CacheSlice
```

**Separate Store for ReactFlow:**

```
// ISOLATED: ReactFlow-specific state
MindscapeStore = MindscapeSlice  // See store/mindscape/
```

#### WindowSlice — Window Instance Management (Traditional DOM)

**File:** `apps/web/src/store/desktop/windows.ts`

```
WindowSlice {
  // State (NO ReactFlow Node<T> — pure TypeScript)
  windows: WindowInstance[]
  zIndexCounter: number

  // Window CRUD
  openWindow(type: WindowType, data?: Partial<WindowData>, bounds?: Partial<Bounds>): string
  closeWindow(windowId: string): void
  updateWindow(windowId: string, updates: Partial<WindowInstance>): void
  updateWindowData(windowId: string, data: Partial<WindowData>): void

  // Focus management (replaces ReactFlow selection)
  focusWindow(windowId: string): void
  blurWindow(windowId: string): void
  bringToFront(windowId: string): void
  sendToBack(windowId: string): void

  // State transitions
  minimizeWindow(windowId: string): void
  maximizeWindow(windowId: string): void
  restoreWindow(windowId: string): void
  toggleMaximize(windowId: string): void

  // Geometry (traditional window positioning)
  moveWindow(windowId: string, position: { x: number; y: number }): void
  resizeWindow(windowId: string, size: { width: number; height: number }): void
  setBounds(windowId: string, bounds: Bounds): void

  // Batch operations
  closeAllWindows(): void
  minimizeAllWindows(): void
  cascadeWindows(): void

  // Query
  getWindowById(windowId: string): WindowInstance | undefined
  getWindowsByType(type: WindowType): WindowInstance[]
  getFocusedWindow(): WindowInstance | undefined
}

// NEW: WindowInstance is pure TypeScript (no Node<T> extension)
WindowInstance {
  id: string
  type: WindowType
  data: WindowData

  bounds: Bounds         // { x, y, width, height }
  state: WindowState     // 'normal' | 'minimized' | 'maximized' | 'fullscreen'

  isTiled: boolean
  tileZone?: TileZone

  zIndex: number
  isFocused: boolean

  minSize: { width: number; height: number }
  maxSize?: { width: number; height: number }
  resizable: boolean

  createdAt: number
  lastFocusedAt: number
}
```

#### TilingSlice — Tiling Window Manager State

**File:** `apps/web/src/store/desktop/tiling.ts`

```
TilingSlice {
  // State
  layout: TilingLayout
  zones: TileZone[]
  windowZoneMap: Map<string, string>
  gapSize: number

  // Layout operations
  setLayout(layout: TilingLayout): void
  cycleLayout(): void

  // Zone operations
  createZone(zone: TileZone): void
  updateZone(zoneId: string, updates: Partial<TileZone>): void
  removeZone(zoneId: string): void
  splitZone(zoneId: string, direction: 'h' | 'v'): void
  mergeZones(zoneA: string, zoneB: string): void

  // Window-zone binding
  assignWindowToZone(windowId: string, zoneId: string): void
  unassignWindow(windowId: string): void
  swapWindowZones(windowA: string, windowB: string): void

  // Focus navigation
  focusZoneDirection(direction: 'left' | 'right' | 'up' | 'down'): string | null

  // Computed
  getZoneBounds(zoneId: string): Bounds
  getWindowBounds(windowId: string): Bounds | null
}

TilingLayout = 'monocle' | 'split-h' | 'split-v' | 'thirds' | 'quad' | 'master-stack' | 'floating'

TileZone {
  id: string
  parentId?: string
  direction?: 'h' | 'v'
  ratio: number
  children?: string[]
  bounds: Bounds
}

Bounds {
  x: number
  y: number
  width: number
  height: number
}
```

#### ViewportSlice — Focus and Viewport State

**File:** `apps/web/src/store/desktop/viewport.ts`

```
ViewportSlice {
  // State
  focusedWindowId: string | null
  viewport: Viewport
  isSpaceMode: boolean
  isMindscapeMode: boolean

  // Focus management
  focusWindow(windowId: string | null): void
  focusNext(): void
  focusPrevious(): void

  // Viewport
  setViewport(viewport: Viewport): void
  panTo(x: number, y: number): void
  zoomTo(zoom: number): void
  fitToWindow(windowId: string): void

  // Mode toggles
  setSpaceMode(isSpaceMode: boolean): void
  toggleMindscape(): void
}
```

#### DockSlice — Taskbar State

**File:** `apps/web/src/store/desktop/dock.ts`

```
DockSlice {
  // State
  dockPins: WindowType[]
  recentApps: WindowType[]
  systemTrayItems: SystemTrayItem[]

  // Pin management
  pinType(type: WindowType): void
  unpinType(type: WindowType): void
  reorderPins(fromIndex: number, toIndex: number): void

  // App launching
  spawnWindow(type: WindowType, resourceRef?: ResourceRef, position?: Position): string

  // System tray
  addTrayItem(item: SystemTrayItem): void
  removeTrayItem(itemId: string): void
  updateTrayItem(itemId: string, updates: Partial<SystemTrayItem>): void
}
```

### 4.3 Mindscape Store — ReactFlow Isolated (SEPARATE STORE)

**File:** `apps/web/src/store/mindscape/index.ts`

> ⚠️ **ISOLATION BOUNDARY:** This is the ONLY desktop store that imports `@xyflow/react`.

```
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, Viewport } from "@xyflow/react";

MindscapeSlice {
  // State (ReactFlow types)
  nodes: MindscapeNode[]              // Node<MindscapeNodeData>
  edges: MindscapeEdge[]              // Edge<EdgeData>
  viewport: Viewport                  // { x, y, zoom }
  selectedNodeIds: string[]

  // ReactFlow callbacks (ONLY place these exist)
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect

  // Node CRUD
  addNode(node: MindscapeNode): void
  removeNode(nodeId: string): void
  updateNode(nodeId: string, data: Partial<MindscapeNodeData>): void

  // Edge CRUD
  addEdge(edge: MindscapeEdge): void
  removeEdge(edgeId: string): void

  // Selection
  selectNode(nodeId: string): void
  selectNodes(nodeIds: string[]): void
  clearSelection(): void

  // Viewport
  setViewport(viewport: Viewport): void
  fitView(): void
  panTo(x: number, y: number): void
  zoomTo(zoom: number): void

  // Layout
  autoLayout(): void

  // Integration with Desktop
  spawnFromWindow(windowId: string): void    // Create node from desktop window
  openInDesktop(nodeId: string): void        // Open window for node
}

MindscapeNodeData {
  entityId: string
  entityType: 'person' | 'place' | 'concept' | 'event' | 'fact'
  label: string
  confidence: number
  archived: boolean
  hgHash?: string
}
```

**Usage Pattern:**

```typescript
// Desktop components: Import from desktop store (no RF)
import { useDesktopStore } from "@/store/desktop";

// Mindscape layer ONLY: Import from mindscape store (RF isolated)
import { useMindscapeStore } from "@/store/mindscape";
```

### 4.4 Orb Store — AI Presence State

**File:** `apps/web/src/store/orb.ts`

```
OrbStore {
  // Presence state
  mode: OrbMode
  state: OrbState
  position: OrbPosition

  // Animation state
  intensity: number
  pulseRate: number
  colorShift: number

  // Voice overlay
  isVoiceOverlayVisible: boolean
  voiceWaveform: Float32Array

  // Mode control
  setMode(mode: OrbMode): void
  dock(): void
  float(): void
  expand(): void
  hide(): void

  // State transitions
  setIdle(): void
  setListening(): void
  setThinking(): void
  setTalking(): void
  setActive(): void

  // Position (floating mode)
  setPosition(position: OrbPosition): void

  // Voice overlay
  showVoiceOverlay(): void
  hideVoiceOverlay(): void
  updateWaveform(waveform: Float32Array): void
}

OrbMode = 'docked' | 'floating' | 'expanded' | 'hidden'
OrbState = 'idle' | 'listening' | 'thinking' | 'talking' | 'active'
OrbPosition = { x: number, y: number }
```

### 4.4 Voice Store — Voice Session State

**File:** `apps/web/src/store/voice.ts`

```
VoiceStore {
  // Session state
  sessionId: string | null
  isActive: boolean
  mode: VoiceMode

  // Audio state
  inputDevice: MediaDeviceInfo | null
  outputDevice: MediaDeviceInfo | null
  inputLevel: number
  outputLevel: number

  // STT state
  isListening: boolean
  transcript: string
  interimTranscript: string
  confidence: number

  // TTS state
  isSpeaking: boolean
  currentUtterance: string
  utteranceQueue: string[]

  // Configuration
  voiceModel: string
  sttModel: string
  ttsVoice: string
  vadSensitivity: number

  // Session management
  startSession(): Promise<void>
  endSession(): Promise<void>

  // Recording control
  startListening(): void
  stopListening(): void
  cancelListening(): void

  // Playback control
  speak(text: string): Promise<void>
  stopSpeaking(): void
  pauseSpeaking(): void
  resumeSpeaking(): void

  // Device selection
  setInputDevice(device: MediaDeviceInfo): void
  setOutputDevice(device: MediaDeviceInfo): void

  // Configuration
  setVoiceModel(model: string): void
  setSttModel(model: string): void
  setTtsVoice(voice: string): void
}

VoiceMode = 'push-to-talk' | 'voice-activity' | 'continuous'
```

### 4.5 Cognitive Store — Cognitive Feedback State

**File:** `apps/web/src/store/cognitive.ts`

```
CognitiveStore {
  // Core state
  phase: CognitivePhase
  autonomy: Autonomy
  confidence: CognitiveConfidence

  // Focus state
  focusState: FocusState
  focusDuration: number

  // Physiology (cognitive load model)
  physiology: PhysiologyState
  cognitiveLoad: number

  // Feedback history
  feedbackHistory: FeedbackEntry[]
  pendingFeedback: FeedbackEntry | null

  // State updates
  updatePhase(phase: CognitivePhase): void
  updateAutonomy(autonomy: Autonomy): void
  updateConfidence(confidence: CognitiveConfidence): void

  // Focus management
  startFocus(note?: string): void
  endFocus(): void

  // Feedback
  addFeedback(feedback: FeedbackEntry): void
  acknowledgeFeedback(feedbackId: string): void

  // Subscriptions
  subscribeToState(): () => void
}

CognitivePhase = 'idle' | 'capture' | 'synthesis' | 'execution' | 'reflection'

PhysiologyState {
  energy: number
  stress: number
  arousal: number
  valence: number
}
```

### 4.6 Agents Store — Agent Execution State

**File:** `apps/web/src/store/agents.ts`

```
AgentsStore {
  // Active runs
  activeRuns: Map<string, OrchestratorRun>
  selectedRunId: string | null

  // Wave state
  waves: Map<string, Wave[]>
  activeAgents: Map<string, AgentInstance>

  // Event streams
  eventBuffers: Map<string, OrchestratorEvent[]>

  // Run management
  selectRun(runId: string): void
  startRun(config: RunConfig): Promise<string>
  pauseRun(runId: string): Promise<void>
  resumeRun(runId: string): Promise<void>
  cancelRun(runId: string): Promise<void>

  // Agent control
  pauseAgent(agentId: string): Promise<void>
  resumeAgent(agentId: string): Promise<void>
  cancelAgent(agentId: string): Promise<void>
  retrySubtask(subtaskId: string): Promise<void>

  // Event handling
  handleEvent(runId: string, event: OrchestratorEvent): void
  clearEvents(runId: string): void

  // Subscriptions
  subscribeToRun(runId: string): () => void
}

OrchestratorRun {
  id: string
  status: RunStatus
  config: RunConfig

  execPlan: ExecPlan
  currentWave: number
  totalWaves: number

  agents: AgentInstance[]
  completedSubtasks: string[]
  failedSubtasks: string[]

  startedAt: Timestamp
  estimatedCompletionAt?: Timestamp
  completedAt?: Timestamp

  metrics: RunMetrics
}

RunStatus = 'pending' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed' | 'cancelled'
```

### 4.7 Docker Store — Container Management State

**File:** `apps/web/src/store/docker.ts`

```
DockerStore {
  // Container state
  containers: Map<string, Container>
  selectedContainerId: string | null

  // Filtering
  filter: ContainerFilter
  sortBy: ContainerSortField
  sortDirection: 'asc' | 'desc'

  // Real-time updates
  resourceMetrics: Map<string, ResourceMetrics>
  logStreams: Map<string, string[]>

  // Container CRUD
  refreshContainers(): Promise<void>
  selectContainer(containerId: string): void

  // Container control
  startContainer(containerId: string): Promise<void>
  stopContainer(containerId: string): Promise<void>
  restartContainer(containerId: string): Promise<void>
  removeContainer(containerId: string): Promise<void>

  // Logs
  streamLogs(containerId: string): () => void
  clearLogs(containerId: string): void

  // Filtering
  setFilter(filter: ContainerFilter): void
  setSortBy(field: ContainerSortField): void
  toggleSortDirection(): void
}

ContainerFilter {
  status?: ContainerStatus[]
  agentType?: ('codex' | 'droid')[]
  runId?: string
  search?: string
}
```

### 4.8 PR Review Store — Pull Request State

**File:** `apps/web/src/store/pr-review.ts`

```
PRReviewStore {
  // PR list state
  pullRequests: Map<string, PullRequest>
  selectedPRId: string | null

  // Filtering
  filter: PRFilter
  sortBy: PRSortField

  // Review state
  pendingComments: Map<string, DraftComment[]>
  reviewDecision: ReviewDecision | null

  // Diff state
  expandedFiles: Set<string>
  viewMode: DiffViewMode

  // PR list operations
  refreshPRs(): Promise<void>
  selectPR(prId: string): void

  // Review operations
  addComment(prId: string, comment: DraftComment): void
  editComment(commentId: string, content: string): void
  deleteComment(commentId: string): void

  submitReview(prId: string, decision: ReviewDecision): Promise<void>

  // Merge operations
  mergePR(prId: string, method: MergeMethod): Promise<void>
  closePR(prId: string): Promise<void>

  // Diff operations
  expandFile(path: string): void
  collapseFile(path: string): void
  setViewMode(mode: DiffViewMode): void
}

PRFilter {
  status?: ('open' | 'merged' | 'closed')[]
  author?: string
  repository?: string
  agentCreated?: boolean
  hasConflicts?: boolean
}

DiffViewMode = 'split' | 'unified'
MergeMethod = 'merge' | 'squash' | 'rebase'
```

### 4.9 Cortex Store — GPU Visualization State (`@alfred/cortex`)

**File:** `apps/web/src/store/cortex.ts`

```
CortexStore {
  // WebGPU state
  isSupported: boolean
  device: GPUDevice | null
  adapter: GPUAdapter | null

  // Active preset
  currentPreset: CortexPreset | null
  parameters: Map<string, unknown>

  // Preview state
  previewMode: 'orb' | 'wallpaper' | 'graph' | 'custom'
  isPreviewActive: boolean

  // Performance
  gpuMetrics: {
    utilization: number
    memoryUsed: number
    memoryTotal: number
    fps: number
  }

  // Presets
  presets: CortexPreset[]
  favorites: string[]

  // Actions
  initializeGPU(): Promise<boolean>
  loadPreset(presetId: string): Promise<void>
  setParameter(name: string, value: unknown): void
  setPreviewMode(mode: PreviewMode): void
  startPreview(): void
  stopPreview(): void
  savePreset(preset: CortexPreset): Promise<void>
  exportPreset(presetId: string): string  // JSON
}
```

### 4.10 Learning Store — Self-Supervision State (`@alfred/learning`)

**File:** `apps/web/src/store/learning.ts`

```
LearningStore {
  // Mistake ledger
  mistakes: MistakeEntry[]
  selectedMistakeId: string | null

  // Filters
  filter: {
    category?: LearningCategory
    severity?: Severity
    resolved?: boolean
    timeRange?: TimeRange
  }

  // Metrics
  metrics: LearningMetrics | null
  metricsLoading: boolean

  // Actions
  fetchMistakes(): Promise<void>
  selectMistake(id: string): void
  markResolved(id: string): Promise<void>
  addCorrection(id: string, correction: Correction): Promise<void>

  // Metrics
  fetchMetrics(timeRange: TimeRange): Promise<void>

  // Subscriptions
  subscribeToNewMistakes(): () => void
}

LearningCategory = 'code_generation' | 'planning' | 'tool_use' | 'reasoning' | 'knowledge' | 'communication'
```

### 4.11 Policy Store — Autonomy & Constraints State (`@alfred/policy`)

**File:** `apps/web/src/store/policy.ts`

```
PolicyStore {
  // Decisions
  decisions: PolicyDecision[]
  selectedDecisionId: string | null

  // Constraints
  constraints: AutonomyConstraint[]

  // Autonomy levels
  autonomyLevels: Map<PolicyScope, AutonomyLevel>

  // Pending approvals
  pendingApprovals: PolicyDecision[]

  // Filters
  filter: {
    scope?: PolicyScope
    outcome?: 'allow' | 'deny' | 'escalate'
    timeRange?: TimeRange
  }

  // Actions
  fetchDecisions(): Promise<void>
  selectDecision(id: string): void

  // Constraints
  updateConstraint(id: string, updates: Partial<AutonomyConstraint>): Promise<void>
  toggleConstraint(id: string): Promise<void>

  // Autonomy
  setAutonomyLevel(scope: PolicyScope, level: AutonomyLevel): Promise<void>

  // Approvals
  approve(decisionId: string): Promise<void>
  deny(decisionId: string): Promise<void>
}

AutonomyLevel = 'read' | 'low' | 'medium' | 'high'
```

### 4.12 Tune Store — Fine-Tuning State (`@alfred/tune`)

**File:** `apps/web/src/store/tune.ts`

```
TuneStore {
  // Jobs
  jobs: TuneJob[]
  selectedJobId: string | null

  // Datasets
  datasets: TuneDataset[]

  // Active job progress (streamed)
  activeProgress: Map<string, TuneProgress>

  // Filters
  filter: {
    status?: JobStatus
    baseModel?: string
  }

  // Actions
  fetchJobs(): Promise<void>
  selectJob(id: string): void

  // Job control
  startJob(config: TuneConfig): Promise<string>
  pauseJob(id: string): Promise<void>
  resumeJob(id: string): Promise<void>
  cancelJob(id: string): Promise<void>

  // Datasets
  fetchDatasets(): Promise<void>
  previewDataset(id: string): Promise<DatasetSample[]>

  // Checkpoints
  loadCheckpoint(jobId: string, checkpointId: string): Promise<void>

  // Subscriptions
  subscribeToProgress(jobId: string): () => void
}
```

### 4.13 Plan Store — Plan Editor State (`@alfred/plan`)

**File:** `apps/web/src/store/plan.ts`

```
PlanStore {
  // Plans
  plans: Plan[]
  activePlanId: string | null

  // Editor state
  editorMode: 'edit' | 'debug' | 'research'
  selectedTaskId: string | null

  // Intent debugging
  intentInput: string
  intentResult: IntentClassification | null

  // Research
  researchQueries: ResearchQuery[]
  researchResults: ResearchResult[]

  // Pattern library
  patterns: PlanPattern[]

  // Actions
  fetchPlans(): Promise<void>
  selectPlan(id: string): void
  createPlan(goal: string): Promise<string>
  updatePlan(id: string, updates: Partial<Plan>): Promise<void>
  deletePlan(id: string): Promise<void>

  // Tasks
  addTask(planId: string, task: PlanTask): void
  updateTask(taskId: string, updates: Partial<PlanTask>): void
  removeTask(taskId: string): void
  reorderTasks(planId: string, taskIds: string[]): void

  // Intent
  classifyIntent(input: string): Promise<IntentClassification>

  // Research
  executeResearch(query: string): Promise<ResearchResult[]>

  // Validation
  validatePlan(id: string): Promise<PlanValidation>

  // Convert to workflow
  convertToWorkflow(planId: string): Promise<string>
}
```

### 4.14 Metrics Store — Prometheus Dashboard State (`@alfred/metrics`)

**File:** `apps/web/src/store/metrics.ts`

```
MetricsStore {
  // Dashboards
  dashboards: Dashboard[]
  activeDashboardId: string | null

  // Metric definitions
  metricDefinitions: MetricDefinition[]

  // Query results
  queryResults: Map<string, MetricQueryResult>

  // Time range
  timeRange: TimeRange
  refreshInterval: number

  // Alerts
  alerts: MetricAlert[]

  // Actions
  fetchDashboards(): Promise<void>
  selectDashboard(id: string): void
  createDashboard(dashboard: Dashboard): Promise<string>
  updateDashboard(id: string, updates: Partial<Dashboard>): Promise<void>
  deleteDashboard(id: string): Promise<void>

  // Queries
  executeQuery(query: string): Promise<MetricQueryResult>
  refreshPanel(panelId: string): Promise<void>

  // Time range
  setTimeRange(range: TimeRange): void
  setRefreshInterval(seconds: number): void

  // Auto-refresh
  startAutoRefresh(): void
  stopAutoRefresh(): void
}
```

### 4.15 RAG Store — Retrieval Debug State (`@alfred/rag`, `@alfred/embed`)

**File:** `apps/web/src/store/rag.ts`

```
RAGStore {
  // Chunks
  chunks: RAGChunk[]
  selectedChunkId: string | null

  // Query state
  query: string
  results: RetrievalResult | null
  isSearching: boolean

  // Embedding visualization
  projection: EmbeddingProjection | null
  projectionMethod: 'tsne' | 'umap' | 'pca'

  // Reranking
  rerankModel: string
  rerankEnabled: boolean

  // Index stats
  indexStats: {
    totalChunks: number
    totalDocuments: number
    embeddingDimension: number
    indexSize: number
  } | null

  // Actions
  fetchChunks(filter?: ChunkFilter): Promise<void>
  selectChunk(id: string): void

  // Search
  search(query: string): Promise<RetrievalResult>
  clearResults(): void

  // Visualization
  generateProjection(method: ProjectionMethod): Promise<void>

  // Reranking
  setRerankModel(model: string): void
  toggleReranking(): void

  // Stats
  fetchIndexStats(): Promise<void>
}
```

### 4.16 History Store — Message Budget State (`@alfred/history`)

**File:** `apps/web/src/store/history.ts`

```
HistoryStore {
  // Budget state
  budget: {
    maxTokens: number
    usedTokens: number
    messageCount: number
    maxMessages: number
  }

  // Pruning
  prunedMessages: number
  lastPruneAt: Timestamp | null

  // Configuration
  budgetStrategy: 'fifo' | 'importance' | 'hybrid'
  importanceThreshold: number

  // Actions
  fetchBudget(threadId: string): Promise<void>

  // Configuration
  setBudgetStrategy(strategy: BudgetStrategy): void
  setImportanceThreshold(threshold: number): void

  // Manual pruning
  pruneThread(threadId: string): Promise<void>

  // Budget visualization
  getBudgetBreakdown(threadId: string): Promise<BudgetBreakdown>
}
```

### 4.17 Auth Store — Session Management State (`@alfred/auth`)

**File:** `apps/web/src/store/auth.ts`

```
AuthStore {
  // Sessions
  activeSessions: AuthSession[]
  currentSessionId: string | null

  // Tokens
  apiTokens: APIToken[]

  // OAuth connections
  oauthConnections: OAuthConnection[]

  // Actions
  fetchSessions(): Promise<void>
  revokeSession(sessionId: string): Promise<void>
  revokeAllOtherSessions(): Promise<void>

  // Tokens
  fetchTokens(): Promise<void>
  createToken(name: string, scopes: string[]): Promise<APIToken>
  revokeToken(tokenId: string): Promise<void>

  // OAuth
  fetchOAuthConnections(): Promise<void>
  disconnectOAuth(provider: string): Promise<void>
  initiateOAuth(provider: string): Promise<void>
}

AuthSession {
  id: string
  createdAt: Timestamp
  lastActiveAt: Timestamp
  userAgent: string
  ipAddress: string
  isCurrent: boolean
}
```

---

## Part V: TanStack DB Integration

### 5.1 Local-First Architecture

ALFRED Desktop uses TanStack DB with PGlite for local-first data persistence, enabling offline capability and instant UI updates with background sync to the server.

**File:** `apps/web/src/db/client.ts`

```
LocalDBClient {
  // Instance
  db: PGlite

  // Initialization
  initialize(): Promise<void>
  migrate(): Promise<void>

  // Sync
  startSync(): void
  stopSync(): void
  forcePush(): Promise<void>
  forcePull(): Promise<void>

  // Status
  syncStatus: SyncStatus
  lastSyncAt: Timestamp | null
  pendingChanges: number
}

SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'
```

### 5.2 Local Schema Definitions

**File:** `apps/web/src/db/schema.ts`

```
// Conversation history (local cache)
conversations {
  id: string (primary key)
  threadId: string
  messages: UIMessage[] (jsonb)
  createdAt: timestamp
  updatedAt: timestamp
  syncedAt: timestamp | null
}

// Desktop layout persistence
desktopLayouts {
  id: string (primary key)
  name: string
  windows: WindowInstance[] (jsonb)
  tiling: TilingState (jsonb)
  viewport: Viewport (jsonb)
  isDefault: boolean
  createdAt: timestamp
  updatedAt: timestamp
}

// Knowledge graph cache
knowledgeCache {
  id: string (primary key)
  entityId: string
  entityData: KnowledgeEntity (jsonb)
  relations: string[] (array)
  fetchedAt: timestamp
  expiresAt: timestamp
}

// AgentFS operation cache
agentfsOps {
  id: string (primary key)
  workspaceId: string
  operation: AgentFSOperation (jsonb)
  timestamp: timestamp
  synced: boolean
}

// Draft content (notes, comments, etc.)
drafts {
  id: string (primary key)
  type: string
  parentId: string | null
  content: unknown (jsonb)
  createdAt: timestamp
  updatedAt: timestamp
}

// User preferences (local override)
localPreferences {
  key: string (primary key)
  value: unknown (jsonb)
  updatedAt: timestamp
}
```

### 5.3 TanStack Query Integration

**File:** `apps/web/src/lib/api/queries.ts`

```
// Conversation queries with local-first
useConversation(threadId: string) {
  queryKey: ['conversation', threadId]
  queryFn: async () => {
    // Try local first
    const local = await localDb.conversations.get(threadId)
    if (local && !isStale(local)) return local

    // Fetch from server
    const remote = await trpc.assistant.history.query({ threadId })
    await localDb.conversations.upsert(remote)
    return remote
  }
  staleTime: 5 * 60 * 1000
}

// Knowledge graph with optimistic updates
useKnowledgeEntity(entityId: string) {
  queryKey: ['knowledge', 'entity', entityId]
  queryFn: async () => {
    const cached = await localDb.knowledgeCache.get(entityId)
    if (cached && !isExpired(cached)) return cached.entityData

    const entity = await trpc.knowledge.entity.query({ id: entityId })
    await localDb.knowledgeCache.upsert({
      id: entityId,
      entityId,
      entityData: entity,
      fetchedAt: now(),
      expiresAt: addMinutes(now(), 15)
    })
    return entity
  }
}

// AgentFS operations with infinite scroll
useAgentFSOps(workspaceId: string) {
  queryKey: ['agentfs', 'ops', workspaceId]
  queryFn: async ({ pageParam }) => {
    return trpc.agentfs.audit.query({
      workspaceId,
      cursor: pageParam,
      limit: 50
    })
  }
  getNextPageParam: (lastPage) => lastPage.nextCursor
  initialPageParam: undefined
}

// Desktop layout persistence
useSaveLayout() {
  mutationFn: async (layout: DesktopLayout) => {
    await localDb.desktopLayouts.upsert(layout)
    // Background sync to server (non-blocking)
    trpc.profile.saveLayout.mutate(layout).catch(console.error)
  }
}
```

---

## Part VI: Zod Schemas & Type Definitions

### 6.1 Window System Schemas

**File:** `apps/web/src/store/desktop.schemas.ts`

```
windowTypeSchema = z.enum([
  // Tier 0: Core Experience
  'chat',
  'terminal',
  'code',
  'agents',

  // Tier 1: System & Operations
  'taskmanager',
  'docker',
  'pr-review',
  'agentfs',
  'files',

  // Tier 2: Intelligence & Learning (NEW)
  'cortex',       // @alfred/cortex
  'learning',     // @alfred/learning
  'policy',       // @alfred/policy
  'tune',         // @alfred/tune
  'plan',         // @alfred/plan
  'metrics',      // @alfred/metrics
  'rag',          // @alfred/rag + @alfred/embed

  // Tier 3: Knowledge & Exploration
  'knowledge',
  'workflow',
  'linear',
  'concept',

  // Tier 4: Productivity & Settings
  'settings',
  'notes',
  'reminders',
  'todos'
])

resourceTypeSchema = z.enum([
  'note',
  'reminder',
  'thread',
  'workflow_run',
  'preference',
  'integration',
  'knowledge',
  'concept',
  'pr',
  'container',
  'agent',
  'file'
])

viewModeSchema = z.enum(['compact', 'full', 'maximized', 'tiled'])

resourceRefSchema = z.object({
  type: resourceTypeSchema,
  id: z.string()
})

windowDataSchema = z.object({
  type: windowTypeSchema,
  label: z.string().optional(),
  resourceRef: resourceRefSchema.optional(),
  viewMode: viewModeSchema,
  draft: z.unknown().optional()
}).passthrough()

windowInstanceSchema = z.object({
  id: z.string(),
  type: z.literal('window'),
  position: z.object({ x: z.number(), y: z.number() }),
  data: windowDataSchema,
  measured: z.object({
    width: z.number().optional(),
    height: z.number().optional()
  }).optional()
})
```

### 6.2 Tiling System Schemas

**File:** `apps/web/src/store/desktop/tiling.schemas.ts`

```
tilingLayoutSchema = z.enum([
  'monocle',
  'split-h',
  'split-v',
  'thirds',
  'quad',
  'master-stack',
  'floating'
])

boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

tileZoneSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  direction: z.enum(['h', 'v']).optional(),
  ratio: z.number().min(0).max(1),
  children: z.array(z.string()).optional(),
  bounds: boundsSchema
})

tilingStateSchema = z.object({
  layout: tilingLayoutSchema,
  zones: z.array(tileZoneSchema),
  windowZoneMap: z.record(z.string(), z.string()),
  gapSize: z.number().default(8)
})
```

### 6.3 Agent System Schemas

**File:** `apps/web/src/types/agents.schemas.ts`

```
agentTypeSchema = z.enum(['codex', 'droid', 'claude', 'roo', 'cursor'])

agentStatusSchema = z.enum([
  'pending',
  'spawning',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled'
])

toolCallSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  durationMs: z.number().optional()
})

agentInstanceSchema = z.object({
  id: z.string(),
  type: agentTypeSchema,
  subtaskId: z.string(),
  subtaskTitle: z.string(),
  status: agentStatusSchema,

  spawned: z.string(),
  completed: z.string().optional(),

  toolCalls: z.array(toolCallSummarySchema),
  filesModified: z.array(z.string()),
  linesChanged: z.number(),

  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional()
  }).optional()
})

waveSchema = z.object({
  id: z.string(),
  number: z.number(),
  status: z.enum(['pending', 'active', 'completed', 'failed']),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),

  agents: z.array(agentInstanceSchema),
  dependencies: z.array(z.object({
    fromWave: z.number(),
    toWave: z.number(),
    reason: z.string()
  })),

  metrics: z.object({
    totalAgents: z.number(),
    completedAgents: z.number(),
    failedAgents: z.number(),
    avgDurationMs: z.number()
  })
})

orchestratorRunSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'planning', 'executing', 'paused', 'completed', 'failed', 'cancelled']),

  config: z.object({
    projectId: z.string(),
    issueId: z.string().optional(),
    description: z.string(),
    maxWaves: z.number().default(10),
    maxAgentsPerWave: z.number().default(5)
  }),

  execPlan: z.unknown(), // Full ExecPlan schema
  currentWave: z.number(),
  totalWaves: z.number(),

  startedAt: z.string(),
  estimatedCompletionAt: z.string().optional(),
  completedAt: z.string().optional()
})
```

### 6.4 PR Review Schemas

**File:** `apps/web/src/types/pr-review.schemas.ts`

```
diffHunkSchema = z.object({
  oldStart: z.number(),
  oldLines: z.number(),
  newStart: z.number(),
  newLines: z.number(),
  content: z.string()
})

fileDiffSchema = z.object({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed']),
  oldPath: z.string().optional(),
  additions: z.number(),
  deletions: z.number(),
  hunks: z.array(diffHunkSchema)
})

commentSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  body: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional()
})

reviewSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  decision: z.enum(['approved', 'changes_requested', 'commented']),
  body: z.string().optional(),
  createdAt: z.string()
})

ciCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'skipped']),
  url: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
})

pullRequestSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string(),

  author: z.object({
    type: z.enum(['human', 'agent']),
    id: z.string(),
    name: z.string(),
    avatar: z.string().optional()
  }),

  repository: z.object({
    id: z.string(),
    name: z.string(),
    owner: z.string(),
    url: z.string()
  }),

  sourceBranch: z.string(),
  targetBranch: z.string(),

  status: z.enum(['open', 'merged', 'closed']),
  reviewStatus: z.enum(['pending', 'approved', 'changes_requested']),
  isDraft: z.boolean(),
  hasConflicts: z.boolean(),

  diff: z.object({
    files: z.array(fileDiffSchema),
    totalAdditions: z.number(),
    totalDeletions: z.number(),
    changedFiles: z.number()
  }),

  comments: z.array(commentSchema),
  reviews: z.array(reviewSchema),
  ciChecks: z.array(ciCheckSchema),

  createdAt: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string().optional(),

  // ALFRED metadata
  orchestratorRunId: z.string().optional(),
  subtaskIds: z.array(z.string()).optional(),
  linearIssueId: z.string().optional()
})
```

### 6.5 Cortex Schemas (`@alfred/cortex`)

**File:** `apps/web/src/types/cortex.schemas.ts`

```
shaderParameterSchema = z.object({
  name: z.string(),
  type: z.enum(['float', 'vec2', 'vec3', 'vec4', 'color', 'texture']),
  default: z.union([z.number(), z.array(z.number())]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  label: z.string()
})

cortexPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['orb', 'wallpaper', 'graph', 'particle', 'neural']),

  shader: z.object({
    vertex: z.string(),
    fragment: z.string(),
    compute: z.string().optional()
  }),

  parameters: z.array(shaderParameterSchema),

  metadata: z.object({
    author: z.string(),
    createdAt: z.string(),
    gpuRequirements: z.object({
      minMemory: z.number(),
      features: z.array(z.string())
    })
  })
})
```

### 6.6 Learning Schemas (`@alfred/learning`)

**File:** `apps/web/src/types/learning.schemas.ts`

```
learningCategorySchema = z.enum([
  'code_generation',
  'planning',
  'tool_use',
  'reasoning',
  'knowledge',
  'communication'
])

mistakeEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),

  category: learningCategorySchema,
  severity: z.enum(['minor', 'moderate', 'critical']),

  context: z.object({
    taskType: z.string(),
    agentId: z.string().optional(),
    runId: z.string().optional(),
    input: z.string(),
    expectedOutput: z.string(),
    actualOutput: z.string()
  }),

  correction: z.object({
    correctedAt: z.string(),
    correctedOutput: z.string(),
    correctionSource: z.enum(['user', 'self', 'supervisor']),
    lessonLearned: z.string()
  }).optional(),

  recurrence: z.object({
    count: z.number(),
    lastOccurrence: z.string(),
    resolved: z.boolean()
  })
})

learningMetricsSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),

  accuracy: z.object({
    overall: z.number(),
    byCategory: z.record(learningCategorySchema, z.number()),
    trend: z.number()
  }),

  mistakes: z.object({
    total: z.number(),
    corrected: z.number(),
    recurring: z.number()
  }),

  improvements: z.object({
    categoriesImproved: z.array(z.string()),
    newCapabilities: z.array(z.string()),
    regressions: z.array(z.string())
  })
})
```

### 6.7 Policy Schemas (`@alfred/policy`)

**File:** `apps/web/src/types/policy.schemas.ts`

```
policyScopeSchema = z.enum([
  'filesystem',
  'network',
  'shell',
  'database',
  'external_api',
  'deployment'
])

policyActionSchema = z.enum([
  'read',
  'write',
  'delete',
  'execute',
  'deploy',
  'approve'
])

autonomyLevelSchema = z.enum(['read', 'low', 'medium', 'high'])

policyDecisionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),

  request: z.object({
    action: policyActionSchema,
    resource: z.string(),
    scope: policyScopeSchema,
    agentId: z.string().optional(),
    context: z.record(z.unknown())
  }),

  decision: z.object({
    outcome: z.enum(['allow', 'deny', 'escalate']),
    reason: z.string(),
    rule: z.string(),
    confidence: z.number()
  }),

  escalation: z.object({
    escalatedTo: z.enum(['user', 'supervisor']),
    resolvedAt: z.string().optional(),
    resolution: z.enum(['approved', 'denied']).optional()
  }).optional()
})

autonomyConstraintSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  scope: policyScopeSchema,
  level: autonomyLevelSchema,

  conditions: z.array(z.object({
    type: z.string(),
    value: z.unknown()
  })),

  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})
```

### 6.8 Tune Schemas (`@alfred/tune`)

**File:** `apps/web/src/types/tune.schemas.ts`

```
jobStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled'
])

tuneJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: jobStatusSchema,

  config: z.object({
    baseModel: z.string(),
    dataset: z.string(),
    epochs: z.number(),
    batchSize: z.number(),
    learningRate: z.number(),
    loraRank: z.number().optional(),
    loraAlpha: z.number().optional()
  }),

  progress: z.object({
    currentEpoch: z.number(),
    currentStep: z.number(),
    totalSteps: z.number(),
    loss: z.number(),
    accuracy: z.number().optional(),
    eta: z.number().optional()
  }),

  metrics: z.object({
    trainingLoss: z.array(z.number()),
    validationLoss: z.array(z.number()),
    accuracy: z.array(z.number())
  }),

  checkpoints: z.array(z.object({
    id: z.string(),
    step: z.number(),
    loss: z.number(),
    createdAt: z.string()
  })),

  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),

  error: z.string().optional()
})

tuneDatasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  stats: z.object({
    samples: z.number(),
    avgTokens: z.number(),
    categories: z.array(z.string())
  }),

  preview: z.array(z.object({
    input: z.string(),
    output: z.string()
  }))
})
```

### 6.9 Plan Schemas (`@alfred/plan`)

**File:** `apps/web/src/types/plan.schemas.ts`

```
planTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),

  type: z.enum(['code', 'research', 'review', 'deploy', 'test']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),

  assignee: z.enum(['codex', 'droid', 'claude', 'human']).optional(),

  inputs: z.array(z.string()),
  outputs: z.array(z.string()),

  estimatedMinutes: z.number()
})

planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  goal: z.string(),
  constraints: z.array(z.string()),

  tasks: z.array(planTaskSchema),
  dependencies: z.array(z.object({
    from: z.string(),
    to: z.string()
  })),

  research: z.object({
    queries: z.array(z.string()),
    results: z.array(z.object({
      query: z.string(),
      findings: z.array(z.string())
    }))
  }),

  evaluation: z.object({
    feasibility: z.number(),
    complexity: z.number(),
    estimatedDuration: z.number(),
    confidence: z.number()
  }),

  status: z.enum(['draft', 'validated', 'executing', 'completed']),

  createdAt: z.string(),
  updatedAt: z.string()
})

intentClassificationSchema = z.object({
  input: z.string(),
  intent: z.string(),
  confidence: z.number(),

  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
    confidence: z.number()
  })),

  suggestedPlan: planSchema.optional()
})
```

### 6.10 Metrics Schemas (`@alfred/metrics`)

**File:** `apps/web/src/types/metrics.schemas.ts`

```
metricCategorySchema = z.enum([
  'cognitive',
  'agent',
  'voice',
  'api',
  'db',
  'system'
])

metricDefinitionSchema = z.object({
  name: z.string(),
  type: z.enum(['counter', 'gauge', 'histogram', 'summary']),
  help: z.string(),
  labels: z.array(z.string()),
  category: metricCategorySchema
})

dashboardPanelSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['graph', 'stat', 'table', 'gauge', 'heatmap']),
  query: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }),
  options: z.record(z.unknown())
})

dashboardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),

  panels: z.array(dashboardPanelSchema),
  variables: z.array(z.object({
    name: z.string(),
    query: z.string(),
    current: z.string()
  })),

  refreshInterval: z.number(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }),

  createdAt: z.string(),
  updatedAt: z.string()
})
```

### 6.11 RAG Schemas (`@alfred/rag`, `@alfred/embed`)

**File:** `apps/web/src/types/rag.schemas.ts`

```
ragChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),

  content: z.string(),
  metadata: z.object({
    source: z.string(),
    page: z.number().optional(),
    section: z.string().optional(),
    tokens: z.number()
  }),

  embedding: z.array(z.number()).optional(),

  createdAt: z.string()
})

retrievalResultSchema = z.object({
  query: z.string(),

  results: z.array(z.object({
    chunk: ragChunkSchema,
    score: z.number(),
    rerankScore: z.number().optional()
  })),

  metadata: z.object({
    totalChunks: z.number(),
    searchTimeMs: z.number(),
    rerankTimeMs: z.number().optional(),
    embeddingModel: z.string(),
    rerankModel: z.string().optional()
  })
})

embeddingProjectionSchema = z.object({
  method: z.enum(['tsne', 'umap', 'pca']),
  dimensions: z.enum([2, 3]),

  points: z.array(z.object({
    id: z.string(),
    position: z.array(z.number()),
    label: z.string().optional(),
    cluster: z.number().optional()
  })),

  clusters: z.array(z.object({
    id: z.number(),
    centroid: z.array(z.number()),
    label: z.string(),
    count: z.number()
  })).optional()
})
```

---

## Part VII: UI/UX Design System

### 7.1 Design Philosophy — "Functional JARVIS"

The aesthetic remains Iron Man HUD-inspired (void black, bioluminescent accents, holographic effects), but **every element must serve a productive purpose**. No decorative-only features.

**Core Design Principles:**

1. **Void Black Foundation** — Background is pure black (#000000) with subtle noise texture
2. **Bioluminescent Accents** — Cyan (#00D4FF), magenta (#FF00FF), amber (#FFB800) for status
3. **Glass Morphism** — Frosted glass panels with 10-20% opacity backgrounds
4. **Kinetic Typography** — Text that responds to state (breathing, pulsing, glowing)
5. **Spatial Audio Cues** — Distinct sounds for each action category
6. **Micro-interactions** — Every action has visual and haptic feedback

### 7.2 Color System

```
// Primary Palette
void-black:    #000000  // Primary background
void-dark:     #0A0A0A  // Elevated surfaces
void-medium:   #1A1A1A  // Cards, panels
void-light:    #2A2A2A  // Borders, dividers

// Accent Palette
accent-cyan:   #00D4FF  // Primary actions, links, focus
accent-blue:   #0066FF  // Secondary actions
accent-purple: #8B5CF6  // Agent/AI indicators
accent-magenta:#FF00FF  // Highlights, alerts
accent-amber:  #FFB800  // Warnings, attention

// Semantic Palette
success:       #00FF88  // Completed, success states
warning:       #FFB800  // Warnings, pending
error:         #FF4444  // Errors, failures
info:          #00D4FF  // Information

// Text Palette
text-primary:  #FFFFFF  // Primary text (100% white)
text-secondary:#B3B3B3  // Secondary text (70% white)
text-tertiary: #666666  // Disabled, hint text (40% white)
text-accent:   #00D4FF  // Links, interactive text

// Orb States
orb-idle:      #00D4FF → #0066FF (gradient, slow pulse)
orb-listening: #FF00FF → #8B5CF6 (gradient, active pulse)
orb-thinking:  #FFB800 → #FF6600 (gradient, swirl)
orb-talking:   #00FF88 → #00D4FF (gradient, waves)
orb-active:    #FF4444 → #FF00FF (gradient, high energy)
```

### 7.3 Typography System

```
// Font Stack
font-primary:  'Inter Variable', system-ui, sans-serif
font-mono:     'JetBrains Mono', 'Fira Code', monospace
font-display:  'Space Grotesk', sans-serif  // Headlines

// Scale (based on 1rem = 16px)
text-xs:       0.75rem / 1rem      // 12px, line-height 16px
text-sm:       0.875rem / 1.25rem  // 14px, line-height 20px
text-base:     1rem / 1.5rem       // 16px, line-height 24px
text-lg:       1.125rem / 1.75rem  // 18px, line-height 28px
text-xl:       1.25rem / 1.75rem   // 20px, line-height 28px
text-2xl:      1.5rem / 2rem       // 24px, line-height 32px
text-3xl:      1.875rem / 2.25rem  // 30px, line-height 36px
text-4xl:      2.25rem / 2.5rem    // 36px, line-height 40px

// Weights
font-normal:   400
font-medium:   500
font-semibold: 600
font-bold:     700
```

### 7.4 Component Library Extensions

**File:** `apps/web/src/components/ui/alfred/`

```
alfred-ui/
├── button.tsx           # JARVIS-styled buttons with glow effects
├── input.tsx            # Holographic input fields
├── card.tsx             # Glass-morphic cards
├── panel.tsx            # Frosted glass panels
├── badge.tsx            # Status badges with pulse
├── tooltip.tsx          # Floating tooltips
├── dropdown.tsx         # Animated dropdowns
├── tabs.tsx             # Segmented tabs with slide
├── progress.tsx         # Circular and linear progress
├── avatar.tsx           # User/agent avatars with ring
├── notification.tsx     # Toast notifications
├── dialog.tsx           # Modal dialogs
├── command.tsx          # Command palette styling
├── orb.tsx              # Orb component with all states
├── waveform.tsx         # Voice waveform visualizer
├── graph-node.tsx       # Knowledge graph nodes
├── graph-edge.tsx       # Knowledge graph edges
├── timeline.tsx         # Horizontal timeline
├── code-block.tsx       # Syntax-highlighted code
└── diff.tsx             # Diff viewer components
```

### 7.5 Wireframes — Desktop Shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ MENU BAR                                                     h: 32px       │
│ ┌──────┬──────────────────────────────────┬───────────────────────────────┐│
│ │ [◉]  │ File  Edit  View  Window  Help   │  ⚡ 3  🔔 2  ◐ idle  12:34 PM ││
│ └──────┴──────────────────────────────────┴───────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────────┤
│ WINDOW LAYER                                                                │
│                                                                             │
│   ┌─────────────────────────────────┐  ┌─────────────────────────────────┐ │
│   │ ● ● ●  │ ALFRED Chat            │  │ ● ● ●  │ Code Editor            │ │
│   ├─────────────────────────────────┤  ├─────────────────────────────────┤ │
│   │                                 │  │ ┌─────┐ ┌─────────────────────┐ │ │
│   │  ◐  How can I help you today?  │  │ │Files│ │ src/                │ │ │
│   │                                 │  │ ├─────┤ │   components/       │ │ │
│   │  ┌───────────────────────────┐  │  │ │> src│ │   hooks/            │ │ │
│   │  │ I need to implement...    │  │  │ │  pkg│ │   store/            │ │ │
│   │  └───────────────────────────┘  │  │ └─────┘ └─────────────────────┘ │ │
│   │                                 │  │ ┌─────────────────────────────┐ │ │
│   │  ◐  I'll help you with that.   │  │ │ 1  import React from 'react'│ │ │
│   │     Let me analyze the code... │  │ │ 2  import { useStore } from │ │ │
│   │                                 │  │ │ 3                          │ │ │
│   │                                 │  │ │ 4  export function App() { │ │ │
│   │                                 │  │ │ 5    const [state] = useSt │ │ │
│   ├─────────────────────────────────┤  │ └─────────────────────────────┘ │ │
│   │ [🎤]  Type or speak to ALFRED  │  │ [main.tsx] [store.ts] [+]       │ │
│   └─────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ ● ● ●  │ Agent Waves - Run #1842                                     │ │
│   ├───────────────────────────────────────────────────────────────────────┤ │
│   │  Wave 1 ────●────  Wave 2 ────◐────  Wave 3 ────○────  Wave 4 ───○── │ │
│   │                                                                       │ │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│   │  │ Codex   │ │ Codex   │ │ Droid   │ │ Claude  │ │ Pending │        │ │
│   │  │ ✓ Done  │ │ ✓ Done  │ │ ⟳ Run   │ │ ⟳ Run   │ │ ○ Wait  │        │ │
│   │  │ auth.ts │ │ api.ts  │ │ tests   │ │ docs    │ │ review  │        │ │
│   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ORB LAYER (floating)                          ┌─────┐                       │
│                                               │ ◐   │  Orb (draggable)     │
│                                               │ ≋≋≋ │                       │
│                                               └─────┘                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ TASKBAR                                                         h: 48px    │
│ ┌───┬───────────────────────────────────────────────────────────────┬─────┐│
│ │[◉]│ [💬] [📝] [🤖] [📊] [🐳] [🕸️] [📁] [⚙️]  │ ··· │  │ [🔔] 12:34 ││
│ └───┴───────────────────────────────────────────────────────────────┴─────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.6 Wireframes — Tiling Layouts

**Monocle Layout (Single Window)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         ┌───────────────────────────────────────────┐       │
│                         │                                           │       │
│                         │                                           │       │
│                         │              FOCUSED WINDOW               │       │
│                         │              (100% viewport)              │       │
│                         │                                           │       │
│                         │                                           │       │
│                         └───────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Split Horizontal Layout**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────┐  ┌──────────────────────────────┐         │
│ │                              │  │                              │         │
│ │                              │  │                              │         │
│ │         LEFT WINDOW          │  │         RIGHT WINDOW         │         │
│ │           (50%)              │  │           (50%)              │         │
│ │                              │  │                              │         │
│ │                              │  │                              │         │
│ └──────────────────────────────┘  └──────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Master-Stack Layout**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────┐  ┌────────────────────┐        │
│ │                                         │  │    STACK 1 (25%)   │        │
│ │                                         │  └────────────────────┘        │
│ │              MASTER WINDOW              │  ┌────────────────────┐        │
│ │                 (60%)                   │  │    STACK 2 (25%)   │        │
│ │                                         │  └────────────────────┘        │
│ │                                         │  ┌────────────────────┐        │
│ │                                         │  │    STACK 3 (25%)   │        │
│ └─────────────────────────────────────────┘  └────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Quad Layout**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────┐  ┌──────────────────────┐                         │
│ │                      │  │                      │                         │
│ │     TOP LEFT (25%)   │  │    TOP RIGHT (25%)   │                         │
│ │                      │  │                      │                         │
│ └──────────────────────┘  └──────────────────────┘                         │
│ ┌──────────────────────┐  ┌──────────────────────┐                         │
│ │                      │  │                      │                         │
│ │   BOTTOM LEFT (25%)  │  │  BOTTOM RIGHT (25%)  │                         │
│ │                      │  │                      │                         │
│ └──────────────────────┘  └──────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.7 Wireframes — Chat Application

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  │ 💬 ALFRED Chat                            │ [📎] [⚙️] [─] [□] [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────┐                                                               │
│ │ Threads   │  ┌───────────────────────────────────────────────────────┐   │
│ ├───────────┤  │                                                       │   │
│ │ ● Today   │  │   ◐  Good morning, Sir. I've completed the overnight  │   │
│ │   └ Auth  │  │      analysis of the codebase. 12 agents executed     │   │
│ │   └ API   │  │      successfully, producing 3 PRs for your review.   │   │
│ │ ○ Yesterday│  │                                                       │   │
│ │   └ Tests │  │   ┌─────────────────────────────────────────────────┐ │   │
│ │ ○ Last wk │  │   │ Show me the PRs and what the agents changed     │ │   │
│ └───────────┘  │   └─────────────────────────────────────────────────┘ │   │
│                │                                                       │   │
│                │   ◐  Certainly. Here are the three pull requests:     │   │
│                │                                                       │   │
│                │   ┌─────────────────────────────────────────────────┐ │   │
│                │   │ PR #142: Implement OAuth 2.0 flow               │ │   │
│                │   │ ├─ Author: Codex Agent                          │ │   │
│                │   │ ├─ +342 / -18 across 5 files                    │ │   │
│                │   │ └─ [View Diff] [Approve] [Request Changes]      │ │   │
│                │   └─────────────────────────────────────────────────┘ │   │
│                │   ┌─────────────────────────────────────────────────┐ │   │
│                │   │ PR #143: Add unit tests for auth module         │ │   │
│                │   │ ├─ Author: Droid Agent                          │ │   │
│                │   │ ├─ +567 / -0 across 3 files                     │ │   │
│                │   │ └─ [View Diff] [Approve] [Request Changes]      │ │   │
│                │   └─────────────────────────────────────────────────┘ │   │
│                └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Context: [auth.ts ×] [oauth.ts ×] [PR #142 ×]                     [+ Add]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐    │
│ │ 🎤 │  Approve PR 142 and merge it...                      │ [Send] │    │
│ └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.8 Wireframes — Agent Waves Viewer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  │ 🤖 Agent Waves - Run #1842: "Implement OAuth"  │ [⏸] [⏹] [↻]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Timeline ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  Wave 1 ━━━━●━━━━  Wave 2 ━━━━●━━━━  Wave 3 ━━━━◐━━━━  Wave 4 ━━━━○━━━━   │
│  [2 agents]        [3 agents]        [2 agents]        [pending]           │
│  ✓ Complete        ✓ Complete        ⟳ Running         ○ Waiting           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ACTIVE WAVE: Wave 3                                             2/2 agents │
│                                                                             │
│  ┌───────────────────────────────────┐  ┌───────────────────────────────┐  │
│  │ 🔷 Codex Agent #7                  │  │ 🔶 Droid Agent #8             │  │
│  │ ┌─────────────────────────────────┐│  │ ┌─────────────────────────────┐│ │
│  │ │ Subtask: Write OAuth middleware ││  │ │ Subtask: Integration tests  ││ │
│  │ │ Status:  ⟳ Running (2m 34s)     ││  │ │ Status:  ⟳ Running (1m 12s) ││ │
│  │ │ Progress: ████████░░ 78%        ││  │ │ Progress: ████░░░░░░ 42%    ││ │
│  │ └─────────────────────────────────┘│  │ └─────────────────────────────┘│ │
│  │                                    │  │                                │ │
│  │ Recent Actions:                    │  │ Recent Actions:                │ │
│  │ ├─ ✓ Read auth/config.ts           │  │ ├─ ✓ Read auth/oauth.ts        │ │
│  │ ├─ ✓ Write auth/middleware.ts      │  │ ├─ ✓ Create tests/oauth.test.ts│ │
│  │ ├─ ⟳ Analyzing dependencies...     │  │ ├─ ⟳ Running test suite...     │ │
│  │ └─ ○ Pending: Update exports       │  │ └─ ○ Pending: Fix assertions   │ │
│  │                                    │  │                                │ │
│  │ Files Modified: 3                  │  │ Files Modified: 2              │ │
│  │ Lines Changed: +124 / -8           │  │ Lines Changed: +89 / -0        │ │
│  └────────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ EXECUTION LOG                                                    [Filter ▼]│
│ ┌─────────────────────────────────────────────────────────────────────────┐│
│ │ 12:34:56  [Codex#7]  tool_call: file_read("auth/config.ts")            ││
│ │ 12:34:58  [Codex#7]  tool_result: 234 bytes read                       ││
│ │ 12:35:02  [Codex#7]  tool_call: file_write("auth/middleware.ts", ...)  ││
│ │ 12:35:04  [Droid#8]  spawned for subtask: "Integration tests"          ││
│ │ 12:35:06  [Droid#8]  tool_call: file_read("auth/oauth.ts")             ││
│ │ 12:35:08  [Droid#8]  tool_call: file_create("tests/oauth.test.ts", ...)││
│ │ 12:35:12  [Codex#7]  thinking: "Need to analyze import dependencies"   ││
│ │ 12:35:15  [Droid#8]  tool_call: shell_exec("bun test tests/oauth...")  ││
│ └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.9 Wireframes — Knowledge Graph Explorer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  │ 🕸️ Knowledge Graph                        │ [🔍] [⚙️] [─] [□] [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────────────────┐   │
│ │  🔍 Search knowledge...                                     [Semantic]│   │
│ └───────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            ┌───────────┐                                    │
│                            │  Project  │                                    │
│                            │  ALFRED   │                                    │
│                            └─────┬─────┘                                    │
│                     ┌───────────┼───────────┐                               │
│                     ▼           ▼           ▼                               │
│               ┌─────────┐ ┌─────────┐ ┌─────────┐                          │
│               │  Auth   │ │   API   │ │   UI    │                          │
│               │ Module  │ │ Module  │ │ Module  │                          │
│               └────┬────┘ └────┬────┘ └────┬────┘                          │
│                    │           │           │                                │
│               ┌────┴────┐ ┌────┴────┐ ┌────┴────┐                          │
│               ▼         ▼ ▼         ▼ ▼         ▼                          │
│          ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                       │
│          │ OAuth  │ │ tRPC   │ │ Zustand│ │ React  │                       │
│          │ 2.0    │ │ Router │ │ Store  │ │ Comps  │                       │
│          └────────┘ └────────┘ └────────┘ └────────┘                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ SELECTED ENTITY: Auth Module                                    [📌] [🔗]  │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ Type: Module  │  Confidence: 0.94  │  Created: 2026-01-02            │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│ Facts:                                                                      │
│ ├─ Uses Better Auth for authentication                                     │
│ ├─ Supports biometric verification via Ed25519 tokens                      │
│ ├─ Implements OAuth 2.0 flow for third-party integrations                  │
│ └─ [+12 more facts]                                                        │
│                                                                             │
│ Relations:                                                                  │
│ ├─ depends_on → Better Auth (npm package)                                  │
│ ├─ implements → OAuth 2.0 Specification                                    │
│ ├─ part_of → ALFRED Monorepo                                               │
│ └─ [+5 more relations]                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part VIII: Agent Client Protocol Integration

### 8.1 ACP Architecture Overview

ALFRED Desktop supports multiple AI agents (Claude Code, Codex CLI, Roo, Cursor) via the Agent Client Protocol, providing a unified interface for agent interactions.

**File:** `apps/web/src/lib/acp/client.ts`

```
ACPClientManager {
  // Active sessions
  sessions: Map<string, ACPSession>

  // Agent registry
  availableAgents: AgentDefinition[]

  // Session management
  createSession(agentType: AgentType, config: SessionConfig): Promise<ACPSession>
  getSession(sessionId: string): ACPSession | null
  closeSession(sessionId: string): Promise<void>
  closeAllSessions(): Promise<void>

  // Agent discovery
  discoverAgents(): Promise<AgentDefinition[]>
  getAgentCapabilities(agentType: AgentType): AgentCapabilities

  // Permission handling
  handlePermissionRequest(request: PermissionRequest): Promise<PermissionOutcome>
}

ACPSession {
  id: string
  agentType: AgentType
  status: SessionStatus
  mode: SessionMode

  // Connection
  connection: ClientSideConnection

  // Message handling
  sendPrompt(prompt: string): Promise<void>
  streamResponse(): AsyncIterator<ContentChunk>

  // Tool handling
  onToolCall(callback: (call: ToolCall) => void): void
  onToolResult(callback: (result: ToolCallUpdate) => void): void

  // Terminal handling
  createTerminal(): Promise<TerminalHandle>
  getTerminal(id: string): TerminalHandle | null

  // Session control
  setMode(mode: SessionMode): Promise<void>
  cancel(): void
  resume(): Promise<void>
}
```

### 8.2 Supported Agents

| Agent       | Type     | Capabilities                        | Integration Method             |
| ----------- | -------- | ----------------------------------- | ------------------------------ |
| Claude Code | `claude` | Full ACP, file ops, shell, thinking | Native ACP over stdio          |
| Codex CLI   | `codex`  | File ops, shell, code generation    | ACP wrapper over existing tool |
| Roo         | `roo`    | Architecture, planning, code review | ACP over HTTP                  |
| Cursor      | `cursor` | Code completion, editing, chat      | ACP over stdio                 |
| Droid       | `droid`  | General purpose agent               | Internal ALFRED implementation |

### 8.3 Agent Selection UI

**File:** `apps/web/src/components/desktop/apps/chat/agent-selector.tsx`

```
AgentSelectorProps {
  currentAgent: AgentType
  onSelectAgent: (agent: AgentType) => void
  sessionStatus?: SessionStatus
}
```

**Wireframe:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Select Agent                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   🔷     │  │   🟠     │  │   🟣     │  │   ⚫     │       │
│  │ Claude   │  │ Codex    │  │  Roo     │  │ Cursor   │       │
│  │  Code    │  │  CLI     │  │          │  │          │       │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤       │
│  │ ● Active │  │ ○ Ready  │  │ ○ Ready  │  │ ○ Ready  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  Capabilities:                                                  │
│  ├─ [✓] File Operations                                        │
│  ├─ [✓] Shell Execution                                        │
│  ├─ [✓] Code Generation                                        │
│  ├─ [✓] Extended Thinking                                      │
│  └─ [✓] Tool Use                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Permission Request Dialog

**File:** `apps/web/src/components/desktop/dialogs/permission-dialog.tsx`

```
PermissionDialogProps {
  request: PermissionRequest
  onResponse: (outcome: PermissionOutcome) => void
}
```

**Wireframe:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Permission Request                                     [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Agent "Codex CLI" requests permission to:                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📝 Write to file                                        │   │
│  │  /src/components/auth/oauth-handler.ts                   │   │
│  │                                                          │   │
│  │  Changes:                                                │   │
│  │  +42 lines, -8 lines                                     │   │
│  │  [Preview Changes]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ [Allow Once]    │  │ [Allow Always]  │                      │
│  └─────────────────┘  └─────────────────┘                      │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ [Deny Once]     │  │ [Deny Always]   │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
│  ☑ Remember for this session                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part IX: Backend Integration Specifications

### 9.1 Router Integration Matrix

| Desktop App      | Router         | Procedures Used                                      | Real-time?         | Caching |
| ---------------- | -------------- | ---------------------------------------------------- | ------------------ | ------- |
| **Chat**         | `assistant`    | `stream`, `history.list`, `history.get`              | Yes (SSE)          | Local   |
|                  | `voice`        | `stt.stream`, `tts.stream`, `s2s.stream`             | Yes (WebSocket)    | No      |
|                  | `cognitive`    | `state.get`, `feedback.submit`                       | Yes (subscription) | Local   |
| **Code Editor**  | `fs`           | `read`, `write`, `list`, `stat`                      | No                 | Local   |
|                  | `codex`        | `stream`, `sessions.list`, `sessions.get`            | Yes (SSE)          | No      |
| **Agents**       | `orchestrator` | `run.start`, `run.stream`, `run.pause`, `run.cancel` | Yes (SSE)          | No      |
|                  | `droid`        | `stream`, `resume`, `cancel`                         | Yes (SSE)          | No      |
|                  | `workflow`     | `events.subscribe`, `list`                           | Yes (subscription) | Local   |
|                  | `plan`         | `generate`, `validate`, `status`                     | No                 | Local   |
| **PR Review**    | `workflow`     | `events.subscribe`                                   | Yes                | Local   |
|                  | `linear`       | `issues.list`, `issues.update`                       | No                 | Local   |
|                  | `deploy`       | `preview.create`, `promote`, `health`                | Yes (SSE)          | No      |
| **Docker**       | `deploy`       | `containers.list`, `containers.logs`, `health`       | Yes (SSE)          | No      |
|                  | `agentfs`      | `workspace.list`                                     | No                 | Local   |
|                  | `admin`        | `perfStats`                                          | Yes (interval)     | No      |
| **Knowledge**    | `graph`        | `query`, `connect`, `watch`                          | Yes (subscription) | Local   |
|                  | `knowledge`    | `extract`, `search`, `explain`                       | No                 | Local   |
| **AgentFS**      | `agentfs`      | `workspace.*`, `audit`, `checkpoint.*`, `kv.*`       | No                 | Local   |
| **Terminal**     | `terminal`     | `create`, `write`, `resize`, `close`                 | Yes (WebSocket)    | No      |
| **Task Manager** | `admin`        | `voiceStats`, `perfStats`, `restart`                 | Yes (interval)     | No      |
|                  | `workflow`     | `list`, `events`                                     | Yes                | Local   |
| **Settings**     | `profile`      | `get`, `update`                                      | No                 | Local   |
|                  | `preference`   | `get`, `set`, `feedback`                             | No                 | Local   |
|                  | `visual`       | `config.get`, `presets.list`                         | No                 | Local   |
|                  | `privacy`      | `facts.list`, `facts.delete`, `export`               | No                 | No      |

### 9.2 tRPC Client Configuration

**File:** `apps/web/src/lib/api/trpc.ts`

```
TRPCClientConfig {
  // Connection
  url: string
  wsUrl: string

  // Authentication
  getAuthHeaders: () => Promise<Record<string, string>>

  // Error handling
  onError: (error: TRPCError) => void

  // Retry configuration
  retry: {
    retryOnConnectionError: true
    maxRetries: 3
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
  }

  // SSE configuration
  sse: {
    reconnect: true
    reconnectInterval: 1000
    maxReconnectAttempts: 10
  }
}
```

### 9.3 Real-time Event Streaming

**File:** `apps/web/src/lib/api/streams.ts`

```
// Orchestrator event stream
useOrchestratorStream(runId: string) {
  endpoint: `/api/orchestrator/stream?runId=${runId}`
  eventTypes: [
    'wave.started',
    'wave.completed',
    'agent.spawned',
    'agent.progress',
    'agent.completed',
    'agent.failed',
    'subtask.completed',
    'run.completed',
    'run.failed'
  ]

  onEvent: (event: OrchestratorEvent) => void
  onError: (error: Error) => void
  onReconnect: () => void
}

// Assistant chat stream
useAssistantStream(threadId: string) {
  endpoint: `/api/assistant/stream`
  method: POST
  body: { threadId, messages }

  eventTypes: [
    'text-delta',
    'tool-call',
    'tool-result',
    'reasoning',
    'step-start',
    'finish'
  ]

  onDelta: (delta: ContentDelta) => void
  onToolCall: (call: ToolCall) => void
  onComplete: (message: UIMessage) => void
}

// Voice S2S stream
useVoiceStream(sessionId: string) {
  endpoint: `ws://.../voice/s2s`

  send: (audioChunk: ArrayBuffer) => void

  onTranscript: (text: string, isFinal: boolean) => void
  onSpeech: (audioChunk: ArrayBuffer) => void
  onStateChange: (state: VoiceState) => void
}

// Container logs stream
useContainerLogsStream(containerId: string) {
  endpoint: `/api/deploy/logs?containerId=${containerId}`

  onLog: (line: LogLine) => void
  onError: (error: Error) => void
}
```

### 9.4 Cognitive State Subscription

**File:** `apps/web/src/hooks/use-cognitive-subscription.ts`

```
useCognitiveSubscription() {
  // Subscribe to cognitive state updates
  subscription: trpc.cognitive.state.subscribe()

  // Derived state
  phase: CognitivePhase
  autonomy: Autonomy
  confidence: CognitiveConfidence
  physiology: PhysiologyState

  // UI indicators
  orbState: OrbState
  statusColor: string
  statusLabel: string

  // Feedback
  submitFeedback: (feedback: FeedbackInput) => Promise<void>
}
```

### 9.5 Knowledge Graph Queries

**File:** `apps/web/src/hooks/use-knowledge-graph.ts`

```
useKnowledgeGraph(options: KnowledgeGraphOptions) {
  // Query state
  entities: KnowledgeEntity[]
  relations: KnowledgeRelation[]
  isLoading: boolean

  // Query operations
  search: (query: string) => Promise<void>
  expandEntity: (entityId: string) => Promise<void>
  getRelated: (entityId: string, depth: number) => Promise<void>

  // Real-time updates
  subscribeToChanges: () => () => void

  // Graph operations
  createRelation: (source: string, target: string, type: RelationType) => Promise<void>
  deleteRelation: (relationId: string) => Promise<void>
  updateEntity: (entityId: string, updates: Partial<KnowledgeEntity>) => Promise<void>
}

KnowledgeGraphOptions {
  initialQuery?: string
  entityTypes?: EntityType[]
  maxDepth?: number
  includeInferred?: boolean
}
```

---

## Part X: Keyboard Shortcuts & Navigation

### 10.1 Global Shortcuts

| Shortcut | Action                           | Context |
| -------- | -------------------------------- | ------- |
| `⌘K`     | Open Command Palette             | Global  |
| `⌘Space` | Open Spotlight Search            | Global  |
| `⌘M`     | Toggle Mindscape Mode            | Global  |
| `⌘N`     | New Window (type based on focus) | Global  |
| `⌘W`     | Close Focused Window             | Global  |
| `⌘Q`     | Quit ALFRED                      | Global  |
| `⌘,`     | Open Settings                    | Global  |
| `⌘.`     | Toggle Orb Visibility            | Global  |
| `⌘\``    | Cycle Tiling Layout              | Global  |
| `⌘Tab`   | Switch Windows                   | Global  |
| `⌘⇧Tab`  | Switch Windows (Reverse)         | Global  |
| `⌘1-9`   | Focus Window by Position         | Global  |
| `⌘Enter` | Maximize/Restore Window          | Global  |
| `⌘↑↓←→`  | Focus Window in Direction        | Tiling  |
| `⌘⇧↑↓←→` | Swap Window in Direction         | Tiling  |
| `⌘⌥↑↓←→` | Resize Zone in Direction         | Tiling  |

### 10.2 Chat App Shortcuts

| Shortcut | Action                 |
| -------- | ---------------------- |
| `⌘Enter` | Send Message           |
| `⌘⇧V`    | Toggle Voice Mode      |
| `Escape` | Cancel Voice Recording |
| `⌘⇧N`    | New Thread             |
| `⌘⇧A`    | Attach Context         |
| `⌘P`     | Open Thread Picker     |

### 10.3 Code Editor Shortcuts

| Shortcut | Action                      |
| -------- | --------------------------- |
| `⌘S`     | Save File                   |
| `⌘⇧P`    | Editor Command Palette      |
| `⌘⇧F`    | Find in Files               |
| `⌘G`     | Go to Line                  |
| `⌘D`     | Add Selection to Next Match |
| `⌘⇧K`    | Delete Line                 |
| `⌘/`     | Toggle Comment              |
| `⌘⇧I`    | Trigger AI Completion       |
| `Tab`    | Accept AI Suggestion        |
| `Escape` | Dismiss AI Suggestion       |

### 10.4 Agent Waves Shortcuts

| Shortcut | Action               |
| -------- | -------------------- |
| `Space`  | Pause/Resume Run     |
| `Escape` | Cancel Run           |
| `⌘R`     | Retry Failed Subtask |
| `⌘L`     | Toggle Log Panel     |
| `⌘F`     | Filter Agents        |
| `←→`     | Navigate Waves       |
| `↑↓`     | Select Agent         |

---

## Part XI: Implementation Phases

### Phase 0: Type Migration & Architecture Setup (Week 0-1) — PREREQUISITE

**Goal:** Migrate type system from ReactFlow-coupled to hybrid architecture. This phase MUST complete before any other work begins.

> ⚠️ **BLOCKING:** All subsequent phases depend on this work. See [`desktop-type-migration.md`](./desktop-type-migration.md) for full specification.

#### 0.1 Core Type System Migration

| Task                                             | File(s)                    | Estimated Hours |
| ------------------------------------------------ | -------------------------- | --------------- |
| Create new `WindowInstance` type (no `Node<T>`)  | `store/desktop/types.ts`   | 4h              |
| Create `Bounds`, `WindowState`, `TileZone` types | `store/desktop/types.ts`   | 2h              |
| Create `TilingLayout`, `TilingConfig` types      | `store/desktop/tiling.ts`  | 2h              |
| Extend `WindowType` with Phase 8 apps            | `store/desktop/types.ts`   | 1h              |
| Create Zod schemas for new types                 | `store/desktop.schemas.ts` | 4h              |

#### 0.2 Store Architecture Separation

| Task                                         | File(s)                     | Estimated Hours |
| -------------------------------------------- | --------------------------- | --------------- |
| Rewrite `WindowSlice` without ReactFlow      | `store/desktop/windows.ts`  | 8h              |
| Create `TilingSlice`                         | `store/desktop/tiling.ts`   | 6h              |
| Adapt `ViewportSlice` for desktop mode       | `store/desktop/viewport.ts` | 4h              |
| Remove ReactFlow imports from desktop store  | `store/desktop/index.ts`    | 2h              |
| Create `MindscapeSlice` (ReactFlow isolated) | `store/mindscape/index.ts`  | 6h              |
| Create `MindscapeNodeData` types             | `store/mindscape/types.ts`  | 2h              |

#### 0.3 Graph Types Setup

| Task                              | File(s)          | Estimated Hours |
| --------------------------------- | ---------------- | --------------- |
| Create shared graph type file     | `types/graph.ts` | 4h              |
| Define `KnowledgeGraphNode` types | `types/graph.ts` | 2h              |
| Define `WorkflowGraphNode` types  | `types/graph.ts` | 2h              |
| Define `SpawnTreeNode` types      | `types/graph.ts` | 2h              |
| Define `PlanGraphNode` types      | `types/graph.ts` | 2h              |
| Define `EmbeddingNode` types      | `types/graph.ts` | 2h              |

#### 0.4 Component Props Migration

| Task                                              | File(s)                                  | Estimated Hours |
| ------------------------------------------------- | ---------------------------------------- | --------------- |
| Create `WindowComponentProps` interface           | `components/desktop/windows/types.ts`    | 2h              |
| Create window component adapter (bridge old→new)  | `components/desktop/windows/adapter.tsx` | 6h              |
| Update existing window imports for new props      | Multiple (12 windows)                    | 12h             |
| Remove `NodeProps` imports from window components | Multiple                                 | 4h              |

#### 0.5 ReactFlow Isolation Directory Structure

| Task                                  | File(s)                        | Estimated Hours |
| ------------------------------------- | ------------------------------ | --------------- |
| Create `components/graphs/` directory | Directory structure            | 1h              |
| Create `graphs/mindscape/` module     | `components/graphs/mindscape/` | 2h              |
| Create `graphs/knowledge/` module     | `components/graphs/knowledge/` | 2h              |
| Create `graphs/workflow/` module      | `components/graphs/workflow/`  | 2h              |
| Create `graphs/agents/` module        | `components/graphs/agents/`    | 2h              |
| Create `graphs/plan/` module          | `components/graphs/plan/`      | 2h              |
| Create `graphs/rag/` module           | `components/graphs/rag/`       | 2h              |
| Add ESLint rule to enforce isolation  | `.eslintrc.js`                 | 2h              |

**Phase 0 Total: ~96 hours (2.5 weeks at 40h/week)**

---

### Phase 1: Foundation (Weeks 2-4)

**Goal:** Establish desktop shell infrastructure and tiling window manager.

**Prerequisites:** Phase 0 complete (type system migrated)

#### 1.1 Desktop Shell Setup

| Task                                   | File(s)                         | Estimated Hours |
| -------------------------------------- | ------------------------------- | --------------- |
| Create shell component structure       | `components/desktop/shell.tsx`  | 4h              |
| Implement layer system with z-ordering | `components/desktop/layers/`    | 6h              |
| Set up desktop store (using new types) | `store/desktop/index.ts`        | 4h              |
| Configure persistence middleware       | `store/desktop/persist.ts`      | 4h              |
| Implement global keyboard handler      | `hooks/use-global-shortcuts.ts` | 6h              |

#### 1.2 Menu Bar Implementation

| Task                 | File(s)                                      | Estimated Hours |
| -------------------- | -------------------------------------------- | --------------- |
| Menu bar container   | `components/desktop/menubar/menubar.tsx`     | 4h              |
| Alfred menu dropdown | `components/desktop/menubar/alfred-menu.tsx` | 3h              |
| App-specific menus   | `components/desktop/menubar/app-menu.tsx`    | 4h              |
| Status area icons    | `components/desktop/menubar/status-area.tsx` | 4h              |
| Clock widget         | `components/desktop/menubar/clock.tsx`       | 2h              |

#### 1.3 Taskbar Implementation

| Task                       | File(s)                                        | Estimated Hours |
| -------------------------- | ---------------------------------------------- | --------------- |
| Taskbar container          | `components/desktop/taskbar/taskbar.tsx`       | 4h              |
| App launcher button        | `components/desktop/taskbar/launch-button.tsx` | 3h              |
| Pinned apps section        | `components/desktop/taskbar/pinned-apps.tsx`   | 4h              |
| Running apps with previews | `components/desktop/taskbar/running-apps.tsx`  | 6h              |
| System tray                | `components/desktop/taskbar/system-tray.tsx`   | 4h              |

#### 1.4 Tiling Window Manager

| Task                       | File(s)                                        | Estimated Hours |
| -------------------------- | ---------------------------------------------- | --------------- |
| Tiling store slice         | `store/desktop/tiling.ts`                      | 8h              |
| Zone calculation engine    | `lib/desktop/tiling-engine.ts`                 | 12h             |
| Layout presets (6 layouts) | `lib/desktop/tiling-layouts.ts`                | 8h              |
| Window chrome component    | `components/desktop/windows/chrome.tsx`        | 8h              |
| Resize handle system       | `components/desktop/windows/resize-handle.tsx` | 6h              |
| Focus navigation           | `hooks/use-tiling-navigation.ts`               | 4h              |

#### 1.5 Window Registry

| Task                    | File(s)                               | Estimated Hours |
| ----------------------- | ------------------------------------- | --------------- |
| Window type registry    | `components/desktop/apps/registry.ts` | 4h              |
| Window factory function | `lib/desktop/window-factory.ts`       | 4h              |
| Default window configs  | `config/window-defaults.ts`           | 2h              |

**Phase 1 Total: ~118 hours (3 weeks at 40h/week)**

---

### Phase 2: Core Applications (Weeks 3-5)

**Goal:** Implement primary productivity applications with full backend integration.

#### 2.1 Chat Application

| Task                             | File(s)                                            | Estimated Hours |
| -------------------------------- | -------------------------------------------------- | --------------- |
| Chat app container               | `components/desktop/apps/chat/chat-app.tsx`        | 4h              |
| Message list with virtualization | `components/desktop/apps/chat/message-list.tsx`    | 8h              |
| Input area with attachments      | `components/desktop/apps/chat/input-area.tsx`      | 6h              |
| Voice indicator component        | `components/desktop/apps/chat/voice-indicator.tsx` | 6h              |
| Thread sidebar                   | `components/desktop/apps/chat/thread-sidebar.tsx`  | 4h              |
| Context panel                    | `components/desktop/apps/chat/context-panel.tsx`   | 4h              |
| Agent selector                   | `components/desktop/apps/chat/agent-selector.tsx`  | 4h              |
| Chat store                       | `store/chat.ts`                                    | 6h              |
| Voice integration hook           | `hooks/use-chat-voice.ts`                          | 8h              |
| Assistant stream hook            | `hooks/use-assistant-stream.ts`                    | 6h              |

#### 2.2 Code Editor Application

| Task                   | File(s)                                           | Estimated Hours |
| ---------------------- | ------------------------------------------------- | --------------- |
| Code app container     | `components/desktop/apps/code/code-app.tsx`       | 4h              |
| Monaco integration     | `components/desktop/apps/code/monaco-editor.tsx`  | 8h              |
| Editor tabs            | `components/desktop/apps/code/editor-tabs.tsx`    | 4h              |
| File tree sidebar      | `components/desktop/apps/code/file-tree.tsx`      | 6h              |
| AI suggestions overlay | `components/desktop/apps/code/ai-suggestions.tsx` | 8h              |
| Diff viewer            | `components/desktop/apps/code/diff-viewer.tsx`    | 8h              |
| ALFRED void theme      | `lib/monaco/alfred-theme.ts`                      | 4h              |
| Code store             | `store/code.ts`                                   | 6h              |
| FS operations hook     | `hooks/use-fs-operations.ts`                      | 4h              |

#### 2.3 Agent Waves Application

| Task                     | File(s)                                               | Estimated Hours |
| ------------------------ | ----------------------------------------------------- | --------------- |
| Agents app container     | `components/desktop/apps/agents/agents-app.tsx`       | 4h              |
| Wave timeline            | `components/desktop/apps/agents/wave-timeline.tsx`    | 8h              |
| Agent card component     | `components/desktop/apps/agents/agent-card.tsx`       | 6h              |
| Spawn tree visualization | `components/desktop/apps/agents/spawn-tree.tsx`       | 8h              |
| Execution log panel      | `components/desktop/apps/agents/execution-log.tsx`    | 6h              |
| Dependency graph         | `components/desktop/apps/agents/dependency-graph.tsx` | 8h              |
| Agents store             | `store/agents.ts`                                     | 8h              |
| Orchestrator stream hook | `hooks/use-orchestrator-stream.ts`                    | 8h              |

#### 2.4 Terminal Application Enhancement

| Task                             | File(s)                                              | Estimated Hours |
| -------------------------------- | ---------------------------------------------------- | --------------- |
| Enhanced terminal container      | `components/desktop/apps/terminal/terminal-app.tsx`  | 4h              |
| Terminal tabs                    | `components/desktop/apps/terminal/terminal-tabs.tsx` | 4h              |
| Profile management               | `components/desktop/apps/terminal/profiles.tsx`      | 4h              |
| XTerm.js integration enhancement | `lib/terminal/xterm-config.ts`                       | 4h              |

**Phase 2 Total: ~182 hours (4.5 weeks at 40h/week)**

---

### Phase 3: System Applications (Weeks 6-7)

**Goal:** Implement system monitoring and management applications.

#### 3.1 PR Review Application

| Task                          | File(s)                                                | Estimated Hours |
| ----------------------------- | ------------------------------------------------------ | --------------- |
| PR app container              | `components/desktop/apps/pr-review/pr-app.tsx`         | 4h              |
| PR list with filters          | `components/desktop/apps/pr-review/pr-list.tsx`        | 6h              |
| PR detail panel               | `components/desktop/apps/pr-review/pr-detail.tsx`      | 4h              |
| Diff panel with comments      | `components/desktop/apps/pr-review/diff-panel.tsx`     | 10h             |
| Comment thread component      | `components/desktop/apps/pr-review/comment-thread.tsx` | 6h              |
| Merge controls with biometric | `components/desktop/apps/pr-review/merge-controls.tsx` | 6h              |
| CI status display             | `components/desktop/apps/pr-review/ci-status.tsx`      | 4h              |
| PR review store               | `store/pr-review.ts`                                   | 6h              |

#### 3.2 Docker Manager Application

| Task                    | File(s)                                               | Estimated Hours |
| ----------------------- | ----------------------------------------------------- | --------------- |
| Docker app container    | `components/desktop/apps/docker/docker-app.tsx`       | 4h              |
| Container list          | `components/desktop/apps/docker/container-list.tsx`   | 6h              |
| Container detail panel  | `components/desktop/apps/docker/container-detail.tsx` | 4h              |
| Logs viewer with search | `components/desktop/apps/docker/logs-viewer.tsx`      | 6h              |
| Resource charts         | `components/desktop/apps/docker/resource-chart.tsx`   | 6h              |
| Docker store            | `store/docker.ts`                                     | 6h              |

#### 3.3 Task Manager Application

| Task                   | File(s)                                                     | Estimated Hours |
| ---------------------- | ----------------------------------------------------------- | --------------- |
| Task manager container | `components/desktop/apps/taskmanager/taskmanager-app.tsx`   | 4h              |
| Process list           | `components/desktop/apps/taskmanager/process-list.tsx`      | 6h              |
| Performance tab        | `components/desktop/apps/taskmanager/performance-chart.tsx` | 6h              |
| Network tab            | `components/desktop/apps/taskmanager/network-tab.tsx`       | 4h              |
| History tab            | `components/desktop/apps/taskmanager/history-tab.tsx`       | 4h              |

#### 3.4 AgentFS Viewer Application

| Task                  | File(s)                                                  | Estimated Hours |
| --------------------- | -------------------------------------------------------- | --------------- |
| AgentFS app container | `components/desktop/apps/agentfs/agentfs-app.tsx`        | 4h              |
| Workspace list        | `components/desktop/apps/agentfs/workspace-list.tsx`     | 4h              |
| Call timeline         | `components/desktop/apps/agentfs/call-timeline.tsx`      | 6h              |
| File audit panel      | `components/desktop/apps/agentfs/file-audit.tsx`         | 6h              |
| Checkpoint browser    | `components/desktop/apps/agentfs/checkpoint-browser.tsx` | 6h              |
| KV viewer             | `components/desktop/apps/agentfs/kv-viewer.tsx`          | 4h              |

**Phase 3 Total: ~136 hours (3.5 weeks at 40h/week)**

---

### Phase 4: Knowledge & Integration (Weeks 8-9)

**Goal:** Implement knowledge graph and third-party integrations.

#### 4.1 Knowledge Graph Application

| Task                         | File(s)                                               | Estimated Hours |
| ---------------------------- | ----------------------------------------------------- | --------------- |
| Knowledge app container      | `components/desktop/apps/knowledge/knowledge-app.tsx` | 4h              |
| Force-directed graph canvas  | `components/desktop/apps/knowledge/graph-canvas.tsx`  | 12h             |
| Entity detail panel          | `components/desktop/apps/knowledge/entity-panel.tsx`  | 6h              |
| Fact list component          | `components/desktop/apps/knowledge/fact-list.tsx`     | 4h              |
| Relation list component      | `components/desktop/apps/knowledge/relation-list.tsx` | 4h              |
| Semantic search bar          | `components/desktop/apps/knowledge/search-bar.tsx`    | 6h              |
| Time slider for temporal nav | `components/desktop/apps/knowledge/time-slider.tsx`   | 6h              |
| Knowledge graph hook         | `hooks/use-knowledge-graph.ts`                        | 8h              |

#### 4.2 Linear Integration Application

| Task                    | File(s)                                            | Estimated Hours |
| ----------------------- | -------------------------------------------------- | --------------- |
| Linear app container    | `components/desktop/apps/linear/linear-app.tsx`    | 4h              |
| Issue list with filters | `components/desktop/apps/linear/issue-list.tsx`    | 6h              |
| Issue detail panel      | `components/desktop/apps/linear/issue-detail.tsx`  | 6h              |
| Project board view      | `components/desktop/apps/linear/project-board.tsx` | 8h              |

#### 4.3 File Browser Application

| Task                  | File(s)                                          | Estimated Hours |
| --------------------- | ------------------------------------------------ | --------------- |
| Files app container   | `components/desktop/apps/files/files-app.tsx`    | 4h              |
| Tree sidebar          | `components/desktop/apps/files/tree-sidebar.tsx` | 6h              |
| File grid/list view   | `components/desktop/apps/files/file-grid.tsx`    | 6h              |
| Breadcrumb navigation | `components/desktop/apps/files/breadcrumbs.tsx`  | 3h              |
| Quick Look preview    | `components/desktop/apps/files/quick-look.tsx`   | 6h              |

#### 4.4 Workflow Builder Application

| Task                    | File(s)                                                   | Estimated Hours |
| ----------------------- | --------------------------------------------------------- | --------------- |
| Workflow app container  | `components/desktop/apps/workflow/workflow-app.tsx`       | 4h              |
| Node canvas (ReactFlow) | `components/desktop/apps/workflow/node-canvas.tsx`        | 10h             |
| Node palette sidebar    | `components/desktop/apps/workflow/node-palette.tsx`       | 6h              |
| Execution panel         | `components/desktop/apps/workflow/execution-panel.tsx`    | 6h              |
| Variable inspector      | `components/desktop/apps/workflow/variable-inspector.tsx` | 4h              |

**Phase 4 Total: ~133 hours (3.5 weeks at 40h/week)**

---

### Phase 5: Orb & Voice Enhancement (Week 10)

**Goal:** Polish Orb presence and voice interactions.

#### 5.1 Orb Component System

| Task                        | File(s)                                    | Estimated Hours |
| --------------------------- | ------------------------------------------ | --------------- |
| Orb presence container      | `components/desktop/orb/orb.tsx`           | 8h              |
| State animations (5 states) | `components/desktop/orb/animations.ts`     | 12h             |
| Docked mode rendering       | `components/desktop/orb/docked.tsx`        | 4h              |
| Floating mode with drag     | `components/desktop/orb/floating.tsx`      | 6h              |
| Expanded voice overlay      | `components/desktop/orb/expanded.tsx`      | 8h              |
| Quick actions menu          | `components/desktop/orb/quick-actions.tsx` | 4h              |
| Orb store                   | `store/orb.ts`                             | 4h              |

#### 5.2 Voice Enhancement

| Task                   | File(s)                                              | Estimated Hours |
| ---------------------- | ---------------------------------------------------- | --------------- |
| Voice session store    | `store/voice.ts`                                     | 6h              |
| Audio device selection | `hooks/use-audio-devices.ts`                         | 4h              |
| Waveform visualization | `components/ui/alfred/waveform.tsx`                  | 6h              |
| Voice settings panel   | `components/desktop/apps/settings/voice-section.tsx` | 4h              |

**Phase 5 Total: ~66 hours (1.5 weeks at 40h/week)**

---

### Phase 6: Mindscape & Graph Components (Weeks 12-13)

**Goal:** Build ReactFlow-based graph visualizations in the isolated `graphs/` directory.

> ⚠️ **ISOLATION:** All ReactFlow imports ONLY in `components/graphs/` and `store/mindscape/`

#### 6.1 Mindscape Canvas (ReactFlow)

| Task                        | File(s)                                         | Estimated Hours |
| --------------------------- | ----------------------------------------------- | --------------- |
| Mindscape ReactFlow canvas  | `components/graphs/mindscape/canvas.tsx`        | 8h              |
| Entity node component       | `components/graphs/mindscape/entity-node.tsx`   | 4h              |
| Relation edge component     | `components/graphs/mindscape/relation-edge.tsx` | 4h              |
| Mindscape store integration | `store/mindscape/index.ts`                      | 6h              |
| Mode toggle animation       | `components/desktop/layers/mode-transition.tsx` | 8h              |
| Mindscape layer wrapper     | `components/desktop/layers/mindscape.tsx`       | 6h              |

#### 6.2 Knowledge Graph Components (ReactFlow)

| Task                           | File(s)                                        | Estimated Hours |
| ------------------------------ | ---------------------------------------------- | --------------- |
| Knowledge graph canvas         | `components/graphs/knowledge/graph-canvas.tsx` | 6h              |
| Entity node types (6 types)    | `components/graphs/knowledge/entity-node.tsx`  | 6h              |
| Fact edge component            | `components/graphs/knowledge/fact-edge.tsx`    | 4h              |
| Integration with Knowledge app | `components/desktop/apps/knowledge/`           | 4h              |

#### 6.3 Workflow Graph Components (ReactFlow)

| Task                          | File(s)                                         | Estimated Hours |
| ----------------------------- | ----------------------------------------------- | --------------- |
| Workflow DAG canvas           | `components/graphs/workflow/node-canvas.tsx`    | 6h              |
| Action node component         | `components/graphs/workflow/action-node.tsx`    | 4h              |
| Condition node component      | `components/graphs/workflow/condition-node.tsx` | 4h              |
| Flow edge component           | `components/graphs/workflow/flow-edge.tsx`      | 3h              |
| Integration with Workflow app | `components/desktop/apps/workflow/`             | 4h              |

#### 6.4 Agent Spawn Tree (ReactFlow)

| Task                        | File(s)                                        | Estimated Hours |
| --------------------------- | ---------------------------------------------- | --------------- |
| Spawn tree canvas           | `components/graphs/agents/spawn-tree.tsx`      | 6h              |
| Agent node component        | `components/graphs/agents/agent-node.tsx`      | 4h              |
| Dependency edge component   | `components/graphs/agents/dependency-edge.tsx` | 3h              |
| Integration with Agents app | `components/desktop/apps/agents/`              | 4h              |

#### 6.5 Desktop-Mindscape Bridge

| Task                         | File(s)                                    | Estimated Hours |
| ---------------------------- | ------------------------------------------ | --------------- |
| Window-to-node projection    | `lib/desktop/window-projection.ts`         | 8h              |
| Desktop icon as concept node | `lib/desktop/icon-node-bridge.ts`          | 6h              |
| Note-to-concept extraction   | `lib/knowledge/note-extraction.ts`         | 6h              |
| Conversation knowledge spawn | `lib/knowledge/conversation-extraction.ts` | 6h              |

**Phase 6 Total: ~120 hours (3 weeks at 40h/week)**

---

### Phase 7: Polish & Accessibility (Weeks 12-13)

**Goal:** Final polish, performance optimization, and accessibility compliance.

#### 7.1 Accessibility

| Task                        | File(s)                      | Estimated Hours |
| --------------------------- | ---------------------------- | --------------- |
| Keyboard navigation audit   | Multiple                     | 8h              |
| Screen reader compatibility | Multiple                     | 12h             |
| Focus management system     | `lib/accessibility/focus.ts` | 8h              |
| ARIA labels and roles       | Multiple                     | 8h              |
| High contrast mode          | `styles/high-contrast.css`   | 6h              |

#### 7.2 Performance

| Task                        | File(s)                           | Estimated Hours |
| --------------------------- | --------------------------------- | --------------- |
| Window virtualization       | `lib/desktop/virtualization.ts`   | 8h              |
| Lazy loading app bundles    | `components/desktop/apps/lazy.ts` | 6h              |
| State selector optimization | `store/desktop/selectors.ts`      | 6h              |
| Animation performance       | Multiple                          | 8h              |
| Bundle size audit           | Build config                      | 4h              |

#### 7.3 Final Polish

| Task                      | File(s)                                      | Estimated Hours |
| ------------------------- | -------------------------------------------- | --------------- |
| Notification center       | `components/desktop/notification-center.tsx` | 8h              |
| Context lens hover        | `components/desktop/context-lens.tsx`        | 8h              |
| Workflow trails animation | `components/desktop/workflow-trails.tsx`     | 8h              |
| Living desktop wallpaper  | `components/desktop/living-wallpaper.tsx`    | 8h              |
| Time capsule snapshots    | `lib/desktop/time-capsule.ts`                | 6h              |
| Focus mode                | `components/desktop/focus-mode.tsx`          | 6h              |

**Phase 7 Total: ~108 hours (2.5 weeks at 40h/week)**

---

### Phase 8: Intelligence & Learning Apps (Weeks 14-16) — NEW

**Goal:** Implement the 7 new intelligence, learning, and debugging applications covering all remaining ALFRED packages.

#### 8.1 Cortex Visualizer (`@alfred/cortex`)

| Task                    | File(s)                                              | Estimated Hours |
| ----------------------- | ---------------------------------------------------- | --------------- |
| Cortex app container    | `components/desktop/apps/cortex/cortex-app.tsx`      | 4h              |
| WebGPU shader preview   | `components/desktop/apps/cortex/shader-preview.tsx`  | 12h             |
| Parameter tuner sliders | `components/desktop/apps/cortex/parameter-tuner.tsx` | 6h              |
| Preset browser          | `components/desktop/apps/cortex/preset-browser.tsx`  | 4h              |
| GPU monitor panel       | `components/desktop/apps/cortex/gpu-monitor.tsx`     | 6h              |
| Cortex store            | `store/cortex.ts`                                    | 6h              |
| WebGPU engine hook      | `hooks/use-cortex-engine.ts`                         | 8h              |

#### 8.2 Learning Dashboard (`@alfred/learning`)

| Task                   | File(s)                                                     | Estimated Hours |
| ---------------------- | ----------------------------------------------------------- | --------------- |
| Learning app container | `components/desktop/apps/learning/learning-app.tsx`         | 4h              |
| Mistake ledger list    | `components/desktop/apps/learning/mistake-ledger.tsx`       | 6h              |
| Correction timeline    | `components/desktop/apps/learning/correction-timeline.tsx`  | 6h              |
| Accuracy charts        | `components/desktop/apps/learning/accuracy-chart.tsx`       | 6h              |
| Improvement insights   | `components/desktop/apps/learning/improvement-insights.tsx` | 4h              |
| Learning store         | `store/learning.ts`                                         | 6h              |

#### 8.3 Policy Viewer (`@alfred/policy`)

| Task                 | File(s)                                                | Estimated Hours |
| -------------------- | ------------------------------------------------------ | --------------- |
| Policy app container | `components/desktop/apps/policy/policy-app.tsx`        | 4h              |
| Decision log viewer  | `components/desktop/apps/policy/decision-log.tsx`      | 6h              |
| Constraint list      | `components/desktop/apps/policy/constraint-list.tsx`   | 4h              |
| Autonomy controls    | `components/desktop/apps/policy/autonomy-controls.tsx` | 6h              |
| Rule editor (admin)  | `components/desktop/apps/policy/rule-editor.tsx`       | 8h              |
| Policy store         | `store/policy.ts`                                      | 6h              |

#### 8.4 Tune Manager (`@alfred/tune`)

| Task                     | File(s)                                                  | Estimated Hours |
| ------------------------ | -------------------------------------------------------- | --------------- |
| Tune app container       | `components/desktop/apps/tune/tune-app.tsx`              | 4h              |
| Job list with status     | `components/desktop/apps/tune/job-list.tsx`              | 6h              |
| Training progress charts | `components/desktop/apps/tune/training-progress.tsx`     | 8h              |
| Dataset browser          | `components/desktop/apps/tune/dataset-browser.tsx`       | 6h              |
| Hyperparameter editor    | `components/desktop/apps/tune/hyperparameter-editor.tsx` | 6h              |
| Model comparison         | `components/desktop/apps/tune/model-comparison.tsx`      | 6h              |
| Tune store               | `store/tune.ts`                                          | 6h              |

#### 8.5 Plan Editor (`@alfred/plan`)

| Task                    | File(s)                                               | Estimated Hours |
| ----------------------- | ----------------------------------------------------- | --------------- |
| Plan app container      | `components/desktop/apps/plan/plan-app.tsx`           | 4h              |
| Visual plan canvas      | `components/desktop/apps/plan/plan-canvas.tsx`        | 10h             |
| Intent debugger         | `components/desktop/apps/plan/intent-debugger.tsx`    | 6h              |
| Research panel          | `components/desktop/apps/plan/research-panel.tsx`     | 6h              |
| Pattern library browser | `components/desktop/apps/plan/pattern-library.tsx`    | 4h              |
| Evaluation metrics      | `components/desktop/apps/plan/evaluation-metrics.tsx` | 4h              |
| Plan store              | `store/plan.ts`                                       | 6h              |

#### 8.6 Metrics Dashboard (`@alfred/metrics`)

| Task                  | File(s)                                                 | Estimated Hours |
| --------------------- | ------------------------------------------------------- | --------------- |
| Metrics app container | `components/desktop/apps/metrics/metrics-app.tsx`       | 4h              |
| Metric explorer       | `components/desktop/apps/metrics/metric-explorer.tsx`   | 6h              |
| Dashboard builder     | `components/desktop/apps/metrics/dashboard-builder.tsx` | 10h             |
| Alert configuration   | `components/desktop/apps/metrics/alert-config.tsx`      | 6h              |
| PromQL query editor   | `components/desktop/apps/metrics/query-editor.tsx`      | 8h              |
| Chart panel component | `components/desktop/apps/metrics/chart-panel.tsx`       | 6h              |
| Metrics store         | `store/metrics.ts`                                      | 6h              |

#### 8.7 RAG Explorer (`@alfred/rag`, `@alfred/embed`)

| Task                              | File(s)                                                | Estimated Hours |
| --------------------------------- | ------------------------------------------------------ | --------------- |
| RAG app container                 | `components/desktop/apps/rag/rag-app.tsx`              | 4h              |
| Chunk browser                     | `components/desktop/apps/rag/chunk-browser.tsx`        | 6h              |
| Embedding visualizer (t-SNE/UMAP) | `components/desktop/apps/rag/embedding-visualizer.tsx` | 12h             |
| Retrieval debugger                | `components/desktop/apps/rag/retrieval-debugger.tsx`   | 6h              |
| Rerank tuner                      | `components/desktop/apps/rag/rerank-tuner.tsx`         | 4h              |
| Similarity explorer               | `components/desktop/apps/rag/similarity-explorer.tsx`  | 6h              |
| RAG store                         | `store/rag.ts`                                         | 6h              |

#### 8.8 Enhanced Existing Apps with Package Integration

| Task                         | File(s)                                                 | Estimated Hours |
| ---------------------------- | ------------------------------------------------------- | --------------- |
| Chat: History budget panel   | `components/desktop/apps/chat/history-budget.tsx`       | 4h              |
| Chat: RAG context display    | `components/desktop/apps/chat/rag-context.tsx`          | 4h              |
| Settings: Session management | `components/desktop/apps/settings/sessions-section.tsx` | 6h              |
| Settings: Token management   | `components/desktop/apps/settings/tokens-section.tsx`   | 4h              |
| Settings: Policy preferences | `components/desktop/apps/settings/policy-section.tsx`   | 4h              |
| Terminal: TUI mode toggle    | `components/desktop/apps/terminal/tui-mode.tsx`         | 4h              |
| Code: Semantic search        | `components/desktop/apps/code/semantic-search.tsx`      | 6h              |
| History store                | `store/history.ts`                                      | 4h              |
| Auth store                   | `store/auth.ts`                                         | 4h              |

**Phase 8 Total: ~326 hours (8 weeks at 40h/week)**

---

### Phase Summary (Updated with Phase 0)

| Phase       | Focus                                    | Duration      | Hours      | Dependency   |
| ----------- | ---------------------------------------- | ------------- | ---------- | ------------ |
| **Phase 0** | **Type Migration & Architecture**        | **Weeks 0-1** | **96h**    | **BLOCKING** |
| Phase 1     | Foundation (Shell, Tiling)               | Weeks 2-4     | 118h       | Phase 0      |
| Phase 2     | Core Apps (Chat, Code, Agents, Terminal) | Weeks 5-7     | 182h       | Phase 1      |
| Phase 3     | System Apps (PR, Docker, Task, AgentFS)  | Weeks 8-9     | 136h       | Phase 1      |
| Phase 4     | Knowledge & Integration                  | Weeks 10-11   | 133h       | Phase 1      |
| Phase 5     | Orb & Voice                              | Week 12       | 66h        | Phase 2      |
| Phase 6     | Mindscape & Graph Components (RF)        | Weeks 13-15   | 120h       | Phase 0, 4   |
| Phase 7     | Polish & Accessibility                   | Weeks 16-17   | 108h       | All          |
| Phase 8     | Intelligence & Learning Apps             | Weeks 18-20   | 326h       | Phase 1, 6   |
| **Total**   |                                          | **20 weeks**  | **1,285h** |

#### Critical Path

```
Phase 0 (Type Migration)
    │
    ├──► Phase 1 (Foundation)
    │        │
    │        ├──► Phase 2 (Core Apps) ──► Phase 5 (Orb/Voice)
    │        │
    │        ├──► Phase 3 (System Apps)
    │        │
    │        └──► Phase 4 (Knowledge) ──► Phase 6 (Mindscape/Graphs)
    │                                          │
    │                                          └──► Phase 8 (Intelligence Apps)
    │
    └──────────────────────────────────────────────► Phase 7 (Polish)
```

#### Phase 0 Risks

| Risk                                        | Impact | Mitigation                                   |
| ------------------------------------------- | ------ | -------------------------------------------- |
| Type migration breaks existing windows      | High   | Create adapter layer, migrate incrementally  |
| ReactFlow removal causes runtime errors     | High   | Comprehensive test coverage before migration |
| Store separation introduces state sync bugs | Medium | Thorough integration testing                 |
| ESLint isolation rule slows development     | Low    | Clear documentation, pre-commit hooks        |

---

## Part XII: File-by-File Breakdown Summary

### New Files Count

| Category                       | New Files | Lines (Estimated) |
| ------------------------------ | --------- | ----------------- |
| **Phase 0: Type Migration**    | **12**    | **2,400**         |
| **Phase 0: Graph Types**       | **7**     | **800**           |
| **Phase 0: Store Separation**  | **4**     | **600**           |
| Desktop Shell                  | 15        | 2,500             |
| Window Manager                 | 12        | 2,800             |
| Desktop Apps (Original)        | 85        | 15,000            |
| Desktop Apps (Phase 8)         | 49        | 8,500             |
| **Graph Components (Phase 6)** | **24**    | **4,000**         |
| Stores (Original)              | 12        | 3,000             |
| Stores (Phase 8)               | 9         | 2,000             |
| **Mindscape Store (Phase 0)**  | **3**     | **500**           |
| Hooks                          | 22        | 2,800             |
| Types/Schemas (Original)       | 8         | 1,500             |
| Types/Schemas (Phase 8)        | 7         | 1,400             |
| Utilities                      | 15        | 2,000             |
| UI Components                  | 25        | 4,000             |
| **Total**                      | **309**   | **54,800**        |

### New Apps Added in Phase 8

| App                | Package(s)                                       | Files  | Lines     |
| ------------------ | ------------------------------------------------ | ------ | --------- |
| Cortex Visualizer  | `@alfred/cortex`                                 | 7      | 1,200     |
| Learning Dashboard | `@alfred/learning`                               | 6      | 1,000     |
| Policy Viewer      | `@alfred/policy`                                 | 6      | 1,100     |
| Tune Manager       | `@alfred/tune`                                   | 7      | 1,300     |
| Plan Editor        | `@alfred/plan`                                   | 7      | 1,200     |
| Metrics Dashboard  | `@alfred/metrics`                                | 7      | 1,400     |
| RAG Explorer       | `@alfred/rag`, `@alfred/embed`                   | 7      | 1,300     |
| Enhanced Existing  | `@alfred/history`, `@alfred/auth`, `@alfred/tui` | 8      | 1,000     |
| **Total Phase 8**  |                                                  | **55** | **9,500** |

### Complete File Manifest

```
apps/web/src/
├── components/
│   ├── desktop/
│   │   ├── shell.tsx
│   │   ├── layers/
│   │   │   ├── index.ts
│   │   │   ├── menu-bar.tsx
│   │   │   ├── window-layer.tsx
│   │   │   ├── mindscape-layer.tsx
│   │   │   ├── orb-layer.tsx
│   │   │   ├── overlay-layer.tsx
│   │   │   └── mode-transition.tsx
│   │   ├── menubar/
│   │   │   ├── index.ts
│   │   │   ├── menubar.tsx
│   │   │   ├── alfred-menu.tsx
│   │   │   ├── app-menu.tsx
│   │   │   ├── status-area.tsx
│   │   │   ├── orb-mini.tsx
│   │   │   └── clock.tsx
│   │   ├── taskbar/
│   │   │   ├── index.ts
│   │   │   ├── taskbar.tsx
│   │   │   ├── launch-button.tsx
│   │   │   ├── pinned-apps.tsx
│   │   │   ├── running-apps.tsx
│   │   │   └── system-tray.tsx
│   │   ├── windows/
│   │   │   ├── index.ts
│   │   │   ├── chrome.tsx
│   │   │   ├── resize-handle.tsx
│   │   │   └── window-preview.tsx
│   │   ├── tiling/
│   │   │   ├── index.ts
│   │   │   ├── manager.tsx
│   │   │   ├── zone.tsx
│   │   │   └── zone-indicator.tsx
│   │   ├── orb/
│   │   │   ├── index.ts
│   │   │   ├── orb.tsx
│   │   │   ├── docked.tsx
│   │   │   ├── floating.tsx
│   │   │   ├── expanded.tsx
│   │   │   ├── animations.ts
│   │   │   └── quick-actions.tsx
│   │   ├── apps/
│   │   │   ├── index.ts
│   │   │   ├── registry.ts
│   │   │   ├── chat/
│   │   │   │   ├── index.ts
│   │   │   │   ├── chat-app.tsx
│   │   │   │   ├── message-list.tsx
│   │   │   │   ├── input-area.tsx
│   │   │   │   ├── voice-indicator.tsx
│   │   │   │   ├── thread-sidebar.tsx
│   │   │   │   ├── context-panel.tsx
│   │   │   │   └── agent-selector.tsx
│   │   │   ├── code/
│   │   │   │   ├── index.ts
│   │   │   │   ├── code-app.tsx
│   │   │   │   ├── monaco-editor.tsx
│   │   │   │   ├── editor-tabs.tsx
│   │   │   │   ├── file-tree.tsx
│   │   │   │   ├── ai-suggestions.tsx
│   │   │   │   ├── diff-viewer.tsx
│   │   │   │   └── symbol-outline.tsx
│   │   │   ├── agents/
│   │   │   │   ├── index.ts
│   │   │   │   ├── agents-app.tsx
│   │   │   │   ├── wave-timeline.tsx
│   │   │   │   ├── agent-card.tsx
│   │   │   │   ├── spawn-tree.tsx
│   │   │   │   ├── execution-log.tsx
│   │   │   │   ├── dependency-graph.tsx
│   │   │   │   └── resource-usage.tsx
│   │   │   ├── pr-review/
│   │   │   │   ├── index.ts
│   │   │   │   ├── pr-app.tsx
│   │   │   │   ├── pr-list.tsx
│   │   │   │   ├── pr-detail.tsx
│   │   │   │   ├── diff-panel.tsx
│   │   │   │   ├── comment-thread.tsx
│   │   │   │   ├── merge-controls.tsx
│   │   │   │   └── ci-status.tsx
│   │   │   ├── docker/
│   │   │   │   ├── index.ts
│   │   │   │   ├── docker-app.tsx
│   │   │   │   ├── container-list.tsx
│   │   │   │   ├── container-detail.tsx
│   │   │   │   ├── logs-viewer.tsx
│   │   │   │   └── resource-chart.tsx
│   │   │   ├── knowledge/
│   │   │   │   ├── index.ts
│   │   │   │   ├── knowledge-app.tsx
│   │   │   │   ├── graph-canvas.tsx
│   │   │   │   ├── entity-panel.tsx
│   │   │   │   ├── fact-list.tsx
│   │   │   │   ├── relation-list.tsx
│   │   │   │   ├── search-bar.tsx
│   │   │   │   └── time-slider.tsx
│   │   │   ├── agentfs/
│   │   │   │   ├── index.ts
│   │   │   │   ├── agentfs-app.tsx
│   │   │   │   ├── workspace-list.tsx
│   │   │   │   ├── call-timeline.tsx
│   │   │   │   ├── file-audit.tsx
│   │   │   │   ├── checkpoint-browser.tsx
│   │   │   │   └── kv-viewer.tsx
│   │   │   ├── taskmanager/
│   │   │   │   ├── index.ts
│   │   │   │   ├── taskmanager-app.tsx
│   │   │   │   ├── process-list.tsx
│   │   │   │   ├── performance-chart.tsx
│   │   │   │   ├── network-tab.tsx
│   │   │   │   └── history-tab.tsx
│   │   │   ├── workflow/
│   │   │   │   ├── index.ts
│   │   │   │   ├── workflow-app.tsx
│   │   │   │   ├── node-canvas.tsx
│   │   │   │   ├── node-palette.tsx
│   │   │   │   ├── execution-panel.tsx
│   │   │   │   └── variable-inspector.tsx
│   │   │   ├── files/
│   │   │   │   ├── index.ts
│   │   │   │   ├── files-app.tsx
│   │   │   │   ├── tree-sidebar.tsx
│   │   │   │   ├── file-grid.tsx
│   │   │   │   ├── breadcrumbs.tsx
│   │   │   │   └── quick-look.tsx
│   │   │   ├── terminal/
│   │   │   │   ├── index.ts
│   │   │   │   ├── terminal-app.tsx
│   │   │   │   ├── terminal-tabs.tsx
│   │   │   │   └── profiles.tsx
│   │   │   ├── settings/
│   │   │   │   ├── index.ts
│   │   │   │   ├── settings-app.tsx
│   │   │   │   ├── profile-section.tsx
│   │   │   │   ├── privacy-section.tsx
│   │   │   │   ├── visual-section.tsx
│   │   │   │   ├── voice-section.tsx
│   │   │   │   ├── integrations-section.tsx
│   │   │   │   └── agents-section.tsx
│   │   │   ├── linear/
│   │   │   │   ├── index.ts
│   │   │   │   ├── linear-app.tsx
│   │   │   │   ├── issue-list.tsx
│   │   │   │   ├── issue-detail.tsx
│   │   │   │   └── project-board.tsx
│   │   │   ├── notes/
│   │   │   │   ├── index.ts
│   │   │   │   ├── notes-app.tsx
│   │   │   │   ├── note-list.tsx
│   │   │   │   ├── rich-editor.tsx
│   │   │   │   └── tags-panel.tsx
│   │   │   ├── reminders/
│   │   │   │   ├── index.ts
│   │   │   │   ├── reminders-app.tsx
│   │   │   │   ├── reminder-list.tsx
│   │   │   │   ├── schedule-picker.tsx
│   │   │   │   └── recurrence-config.tsx
│   │   │   ├── todos/
│   │   │       ├── index.ts
│   │   │       ├── todos-app.tsx
│   │   │       ├── todo-list.tsx
│   │   │       ├── todo-item.tsx
│   │   │       └── filters.tsx
│   │   │   │
│   │   │   │ ════════════════════════════════════════════════
│   │   │   │ PHASE 8: INTELLIGENCE & LEARNING APPS (NEW)
│   │   │   │ ════════════════════════════════════════════════
│   │   │   │
│   │   │   ├── cortex/                 # @alfred/cortex
│   │   │   │   ├── index.ts
│   │   │   │   ├── cortex-app.tsx
│   │   │   │   ├── shader-preview.tsx
│   │   │   │   ├── parameter-tuner.tsx
│   │   │   │   ├── preset-browser.tsx
│   │   │   │   └── gpu-monitor.tsx
│   │   │   ├── learning/               # @alfred/learning
│   │   │   │   ├── index.ts
│   │   │   │   ├── learning-app.tsx
│   │   │   │   ├── mistake-ledger.tsx
│   │   │   │   ├── correction-timeline.tsx
│   │   │   │   ├── accuracy-chart.tsx
│   │   │   │   └── improvement-insights.tsx
│   │   │   ├── policy/                 # @alfred/policy
│   │   │   │   ├── index.ts
│   │   │   │   ├── policy-app.tsx
│   │   │   │   ├── decision-log.tsx
│   │   │   │   ├── constraint-list.tsx
│   │   │   │   ├── autonomy-controls.tsx
│   │   │   │   └── rule-editor.tsx
│   │   │   ├── tune/                   # @alfred/tune
│   │   │   │   ├── index.ts
│   │   │   │   ├── tune-app.tsx
│   │   │   │   ├── job-list.tsx
│   │   │   │   ├── training-progress.tsx
│   │   │   │   ├── dataset-browser.tsx
│   │   │   │   ├── hyperparameter-editor.tsx
│   │   │   │   └── model-comparison.tsx
│   │   │   ├── plan/                   # @alfred/plan
│   │   │   │   ├── index.ts
│   │   │   │   ├── plan-app.tsx
│   │   │   │   ├── plan-canvas.tsx
│   │   │   │   ├── intent-debugger.tsx
│   │   │   │   ├── research-panel.tsx
│   │   │   │   ├── pattern-library.tsx
│   │   │   │   └── evaluation-metrics.tsx
│   │   │   ├── metrics/                # @alfred/metrics
│   │   │   │   ├── index.ts
│   │   │   │   ├── metrics-app.tsx
│   │   │   │   ├── metric-explorer.tsx
│   │   │   │   ├── dashboard-builder.tsx
│   │   │   │   ├── alert-config.tsx
│   │   │   │   ├── query-editor.tsx
│   │   │   │   └── chart-panel.tsx
│   │   │   └── rag/                    # @alfred/rag, @alfred/embed
│   │   │       ├── index.ts
│   │   │       ├── rag-app.tsx
│   │   │       ├── chunk-browser.tsx
│   │   │       ├── embedding-visualizer.tsx
│   │   │       ├── retrieval-debugger.tsx
│   │   │       ├── rerank-tuner.tsx
│   │   │       └── similarity-explorer.tsx
│   │   ├── dialogs/
│   │   │   ├── permission-dialog.tsx
│   │   │   └── biometric-dialog.tsx
│   │   ├── notification-center.tsx
│   │   ├── context-lens.tsx
│   │   ├── workflow-trails.tsx
│   │   ├── living-wallpaper.tsx
│   │   └── focus-mode.tsx
│   │
│   │ ════════════════════════════════════════════════════════════════
│   │ REACTFLOW ISOLATION: graphs/ directory (ONLY RF imports here)
│   │ ════════════════════════════════════════════════════════════════
│   │
│   ├── graphs/                       # ReactFlow components (isolated)
│   │   ├── mindscape/                # Mindscape infinite canvas
│   │   │   ├── index.ts
│   │   │   ├── canvas.tsx            # ReactFlow wrapper
│   │   │   ├── entity-node.tsx       # Custom node type
│   │   │   └── relation-edge.tsx     # Custom edge type
│   │   ├── knowledge/                # Knowledge Graph app graph
│   │   │   ├── index.ts
│   │   │   ├── graph-canvas.tsx
│   │   │   ├── entity-node.tsx
│   │   │   └── fact-edge.tsx
│   │   ├── workflow/                 # Workflow Builder DAG
│   │   │   ├── index.ts
│   │   │   ├── node-canvas.tsx
│   │   │   ├── action-node.tsx
│   │   │   ├── condition-node.tsx
│   │   │   └── flow-edge.tsx
│   │   ├── agents/                   # Agent spawn tree
│   │   │   ├── index.ts
│   │   │   ├── spawn-tree.tsx
│   │   │   ├── agent-node.tsx
│   │   │   └── dependency-edge.tsx
│   │   ├── plan/                     # Plan dependency graph
│   │   │   ├── index.ts
│   │   │   ├── plan-graph.tsx
│   │   │   └── task-node.tsx
│   │   └── rag/                      # Embedding visualization
│   │       ├── index.ts
│   │       ├── projection-canvas.tsx
│   │       └── embedding-point.tsx
│   │
│   └── ui/
│       └── alfred/
│           ├── button.tsx
│           ├── input.tsx
│           ├── card.tsx
│           ├── panel.tsx
│           ├── badge.tsx
│           ├── tooltip.tsx
│           ├── dropdown.tsx
│           ├── tabs.tsx
│           ├── progress.tsx
│           ├── avatar.tsx
│           ├── notification.tsx
│           ├── dialog.tsx
│           ├── command.tsx
│           ├── orb.tsx
│           ├── waveform.tsx
│           ├── graph-node.tsx
│           ├── graph-edge.tsx
│           ├── timeline.tsx
│           ├── code-block.tsx
│           └── diff.tsx
├── store/
│   ├── desktop/                      # NO ReactFlow imports
│   │   ├── index.ts
│   │   ├── types.ts                  # WindowInstance (pure TS, no Node<T>)
│   │   ├── windows.ts
│   │   ├── tiling.ts
│   │   ├── viewport.ts
│   │   ├── dock.ts
│   │   ├── context.ts
│   │   ├── cache.ts
│   │   ├── persist.ts
│   │   └── selectors.ts
│   │
│   │ ════════════ REACTFLOW ISOLATION ════════════
│   │
│   ├── mindscape/                    # ReactFlow-specific store (ISOLATED)
│   │   ├── index.ts                  # import { Node, Edge } from '@xyflow/react'
│   │   ├── types.ts                  # MindscapeNode, MindscapeEdge
│   │   └── selectors.ts
│   │
│   │ ════════════ CORE EXPERIENCE ════════════
│   │
│   ├── orb.ts
│   ├── voice.ts
│   ├── cognitive.ts
│   ├── agents.ts
│   ├── pr-review.ts
│   ├── docker.ts
│   ├── code.ts
│   ├── preferences.ts
│   │
│   │ ════════════ PHASE 8: NEW STORES ════════════
│   │
│   ├── cortex.ts               # @alfred/cortex GPU state
│   ├── learning.ts             # @alfred/learning self-supervision
│   ├── policy.ts               # @alfred/policy autonomy state
│   ├── tune.ts                 # @alfred/tune fine-tuning jobs
│   ├── plan.ts                 # @alfred/plan editor state
│   ├── metrics.ts              # @alfred/metrics dashboards
│   ├── rag.ts                  # @alfred/rag debug state
│   ├── history.ts              # @alfred/history budget state
│   └── auth.ts                 # @alfred/auth sessions
├── hooks/
│   ├── use-global-shortcuts.ts
│   ├── use-tiling-navigation.ts
│   ├── use-chat-voice.ts
│   ├── use-assistant-stream.ts
│   ├── use-orchestrator-stream.ts
│   ├── use-cognitive-subscription.ts
│   ├── use-knowledge-graph.ts
│   ├── use-fs-operations.ts
│   ├── use-container-logs.ts
│   ├── use-audio-devices.ts
│   ├── use-ai-completions.ts
│   │
│   │ ════════════ PHASE 8: NEW HOOKS ════════════
│   │
│   ├── use-cortex-engine.ts    # WebGPU integration
│   ├── use-learning-metrics.ts # Learning data hook
│   └── use-rag-search.ts       # RAG query hook
├── lib/
│   ├── desktop/
│   │   ├── tiling-engine.ts
│   │   ├── tiling-layouts.ts
│   │   ├── window-factory.ts
│   │   ├── window-projection.ts
│   │   ├── icon-node-bridge.ts
│   │   ├── virtualization.ts
│   │   └── time-capsule.ts
│   ├── acp/
│   │   ├── client.ts
│   │   └── session.ts
│   ├── monaco/
│   │   └── alfred-theme.ts
│   ├── knowledge/
│   │   ├── note-extraction.ts
│   │   ├── conversation-extraction.ts
│   │   └── workflow-visualization.ts
│   └── accessibility/
│       └── focus.ts
├── types/
│   ├── desktop.ts
│   ├── agents.schemas.ts
│   ├── pr-review.schemas.ts
│   ├── docker.schemas.ts
│   │
│   │ ════════════ PHASE 8: NEW SCHEMAS ════════════
│   │
│   ├── cortex.schemas.ts       # @alfred/cortex
│   ├── learning.schemas.ts     # @alfred/learning
│   ├── policy.schemas.ts       # @alfred/policy
│   ├── tune.schemas.ts         # @alfred/tune
│   ├── plan.schemas.ts         # @alfred/plan
│   ├── metrics.schemas.ts      # @alfred/metrics
│   └── rag.schemas.ts          # @alfred/rag
├── config/
│   └── window-defaults.ts
└── db/
    ├── client.ts
    └── schema.ts
```

---

## Part XIII: Success Metrics & Acceptance Criteria

### 13.1 Performance Metrics

| Metric                             | Target  | Measurement     |
| ---------------------------------- | ------- | --------------- |
| Time to Interactive                | < 2s    | Lighthouse      |
| Window Open Latency                | < 100ms | Performance API |
| Tiling Layout Switch               | < 50ms  | Performance API |
| Voice Recognition Start            | < 200ms | Custom metric   |
| Message Stream First Byte          | < 500ms | Network timing  |
| Agent Wave Update                  | < 100ms | Custom metric   |
| Knowledge Graph Render (100 nodes) | < 500ms | Performance API |
| Memory Usage (10 windows)          | < 500MB | DevTools        |

### 13.2 Accessibility Compliance

| Standard            | Requirement                         |
| ------------------- | ----------------------------------- |
| WCAG 2.1 AA         | Full compliance                     |
| Keyboard Navigation | All features accessible             |
| Screen Reader       | VoiceOver/NVDA tested               |
| Color Contrast      | 4.5:1 minimum                       |
| Focus Indicators    | Visible on all interactive elements |
| Motion              | Respects prefers-reduced-motion     |

### 13.3 User Experience Criteria

| Criterion                   | Acceptance                             |
| --------------------------- | -------------------------------------- |
| Voice-to-Voice Conversation | Complete flow works end-to-end         |
| Agent Waves Visualization   | Real-time updates within 1s            |
| PR Review Flow              | View, comment, merge workflow complete |
| Knowledge Graph Navigation  | Semantic search returns in < 2s        |
| Tiling Window Management    | All 7 layouts functional               |
| Desktop Persistence         | State restored on reload               |
| Orb States                  | All 5 states animate correctly         |

---

## Part XIV: Risks & Mitigations

| Risk                              | Impact | Likelihood | Mitigation                         |
| --------------------------------- | ------ | ---------- | ---------------------------------- |
| Monaco bundle size                | High   | Medium     | Lazy load, code splitting          |
| ReactFlow performance at scale    | High   | Medium     | Virtualization, LOD                |
| Voice latency on slow connections | Medium | High       | Local VAD, streaming chunks        |
| Tiling edge cases                 | Medium | Medium     | Extensive layout testing           |
| ACP compatibility across agents   | High   | Medium     | Adapter pattern, fallbacks         |
| Local-first sync conflicts        | Medium | Low        | CRDT consideration, manual resolve |
| Accessibility regression          | High   | Medium     | Automated a11y testing in CI       |

---

## Part XV: Progress Tracking

### Phase Completion Status

| Phase                | Status      | Start | End | Notes |
| -------------------- | ----------- | ----- | --- | ----- |
| Phase 1: Foundation  | Not Started | -     | -   | -     |
| Phase 2: Core Apps   | Not Started | -     | -   | -     |
| Phase 3: System Apps | Not Started | -     | -   | -     |
| Phase 4: Knowledge   | Not Started | -     | -   | -     |
| Phase 5: Orb & Voice | Not Started | -     | -   | -     |
| Phase 6: Mindscape   | Not Started | -     | -   | -     |
| Phase 7: Polish      | Not Started | -     | -   | -     |

### Surprises & Discoveries

_Document unexpected findings during implementation._

### Decision Log

| Date       | Decision                                   | Rationale                                     |
| ---------- | ------------------------------------------ | --------------------------------------------- |
| 2026-01-03 | Wayland-inspired tiling over floating-only | Better productivity, keyboard-driven workflow |
| 2026-01-03 | PGlite for local-first                     | Offline capability, instant UI                |
| 2026-01-03 | Separate stores per app domain             | Better code organization, tree shaking        |
| 2026-01-03 | ACP as agent abstraction layer             | Future-proof multi-agent support              |

---

## Part XVI: Outcomes & Retrospective

_To be completed after implementation._
