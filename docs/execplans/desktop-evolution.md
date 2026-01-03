# ALFRED Desktop Evolution Plan

**Owner:** UI/UX  
**Status:** Planning  
**Created:** 2026-01-02

---

## Purpose

Transform ALFRED's current spatial canvas into a usable **desktop environment** that balances the JARVIS aesthetic with real productivity. The goal is a desktop-like experience with windows, icons, task management, and integrated AI visualization—while preserving the infinite canvas for Mindscape knowledge exploration.

---

## Design Philosophy

**"Functional JARVIS"** — The aesthetic remains Iron Man HUD-inspired (void black, bioluminescent accents, holographic effects), but every element must serve a productive purpose. No decorative-only features.

### Core Principles

1. **Desktop Metaphor First**: Users should feel at home—windows, icons, taskbar, familiar interactions
2. **Mindscape as Canvas**: The infinite canvas becomes the "desktop surface" where knowledge lives
3. **AI Always Present**: The Orb is Alfred's visual presence, always accessible
4. **Progressive Disclosure**: Simple by default, powerful when needed

---

## Architecture Evolution

### Current State (ReactFlow-based)

```
Desktop
├── DesktopCanvas (ReactFlow infinite canvas)
│   ├── WindowNodes (12 types as ReactFlow nodes)
│   ├── Edges (knowledge connections)
│   ├── MiniMap
│   └── Controls
├── Dock (bottom-center)
├── CommandPalette (⌘K)
└── StorageMonitor
```

### Target State (Layered Desktop)

```
AlfredDesktop
├── DesktopLayer (static)
│   ├── MenuBar (top)
│   │   ├── AlfredMenu (Apple menu equivalent)
│   │   ├── AppMenus (context-sensitive)
│   │   ├── StatusArea (right: clock, cognitive status, notifications)
│   │   └── OrbMini (Alfred presence indicator)
│   ├── Desktop (center - icon grid + wallpaper)
│   │   ├── DesktopIcons (pinned apps, files, shortcuts)
│   │   └── SelectionBox (drag to select)
│   └── Taskbar (bottom)
│       ├── LaunchButton (Alfred logo)
│       ├── PinnedApps
│       ├── RunningApps (with preview on hover)
│       ├── SystemTray
│       └── Clock
│
├── WindowLayer (floating windows)
│   ├── WindowManager
│   │   ├── Window chrome (title bar, traffic lights, resize handles)
│   │   ├── Window snapping
│   │   ├── Minimize to taskbar
│   │   └── Maximize/fullscreen
│   └── WindowStack (z-order management)
│
├── MindscapeLayer (infinite canvas - toggled)
│   ├── ReactFlow canvas (existing)
│   ├── Knowledge nodes
│   ├── Concept edges
│   └── Navigation controls
│
├── OrbLayer (always on top)
│   ├── OrbPresence (floating, draggable)
│   ├── VoiceOverlay (when speaking/listening)
│   └── QuickActions (context menu)
│
└── OverlayLayer (modals, notifications)
    ├── NotificationCenter (slide-in panel)
    ├── CommandPalette (⌘K)
    ├── Spotlight (⌘Space)
    └── TaskManager (⌘Opt+Esc)
```

---

## Key Desktop Applications

### Tier 1: Core Apps (Ship First)

| App | Window Type | Description | Priority |
|-----|------------|-------------|----------|
| **Alfred Chat** | `chat` | Primary AI conversation interface with Orb integration | P0 |
| **Terminal** | `terminal` | XTerm.js shell (exists, enhance) | P0 |
| **Code Editor** | `code` | Monaco-based editor with AI assist | P0 |
| **Workflow Builder** | `workflow-builder` | n8n-style visual workflow editor | P0 |
| **Task Manager** | `taskmanager` | Running agents, workflows, system resources | P0 |
| **File Browser** | `files` | Project file navigation with tree view | P0 |

### Tier 2: Productivity Apps

| App | Window Type | Description | Priority |
|-----|------------|-------------|----------|
| **Notes** | `note` | Rich text editor (exists, enhance) | P1 |
| **Knowledge Graph** | `knowledge` | Mindscape exploration view | P1 |
| **Agent Viewer** | `agent` | Agent state, logs, tool history | P1 |
| **Settings** | `settings` | App preferences (exists) | P1 |
| **Integrations** | `integrations` | Third-party connections (exists) | P1 |

### Tier 3: Specialized Apps

| App | Window Type | Description | Priority |
|-----|------------|-------------|----------|
| **Reminders** | `reminder` | Scheduled reminders (exists) | P2 |
| **Todos** | `todo` | Task lists (exists) | P2 |
| **Calendar** | `calendar` | Schedule visualization | P2 |
| **Bookmarks** | `bookmark` | Saved links with preview | P2 |
| **Concept Map** | `concept` | Focused knowledge exploration | P2 |

---

## New Components Specification

### 1. MenuBar

```tsx
// apps/web/src/components/desktop/menubar.tsx

type MenuBarProps = {
  activeApp: WindowType | null;
};

// Structure:
// [Alfred Logo] [App Menus...] [spacer] [Status Icons] [Orb Mini] [Clock]

// Alfred Menu (click logo):
// - About Alfred
// - Preferences...
// - ---
// - Hide Alfred
// - Hide Others
// - Show All
// - ---
// - Quit Alfred

// Status Icons:
// - Cognitive state (idle/thinking/acting)
// - Network status
// - Agent count badge
// - Notification bell
```

### 2. Taskbar

```tsx
// apps/web/src/components/desktop/taskbar.tsx

type TaskbarProps = {
  pinnedApps: WindowType[];
  runningWindows: WindowInstance[];
  onLaunch: (type: WindowType) => void;
};

// Features:
// - Left: Launch button (Alfred logo - opens app drawer)
// - Center: Pinned apps + running apps with dot indicators
// - Right: System tray, clock
// - Hover preview: Live window thumbnail
// - Click running: Focus window
// - Right-click: Context menu (close, pin, etc.)
```

### 3. Window Chrome

```tsx
// apps/web/src/components/windows/shared/window-chrome.tsx

type WindowChromeProps = {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  
  // Window controls
  closable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  resizable?: boolean;
  
  // State
  isMaximized?: boolean;
  isMinimized?: boolean;
  isFocused?: boolean;
  
  // Size constraints
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

// Visual structure:
// ┌─────────────────────────────────────┐
// │ ● ● ●  │  Title      │   Actions   │  <- Title bar
// ├────────────────────────────────────-┤
// │                                     │
// │           Content Area              │
// │                                     │
// └─────────────────────────────────────┘
//                                    ↖ Resize handle

// Traffic lights (left):
// - Red (close) - hover shows ×
// - Yellow (minimize) - hover shows −
// - Green (maximize) - hover shows ↔
```

### 4. Code Editor App

```tsx
// apps/web/src/components/windows/code/code-window.tsx

import { Editor } from "@monaco-editor/react";

type CodeWindowProps = {
  file?: { path: string; content: string };
  language?: string;
  onSave?: (content: string) => void;
};

// Features:
// - Monaco editor with void theme
// - File tabs
// - AI inline completions (via Copilot-style overlay)
// - Command palette (⌘⇧P)
// - Diff view mode
// - Minimap
// - Git gutter
```

### 5. Workflow Builder App

```tsx
// apps/web/src/components/windows/workflow-builder/workflow-builder-window.tsx

// n8n-style features:
// - Node palette (sidebar)
// - Canvas with grid snap
// - Node types:
//   - Triggers (webhook, schedule, event)
//   - Actions (AI tasks, tool calls, API requests)
//   - Logic (conditions, loops, switches)
//   - Agents (spawn agent node)
// - Edge animations showing data flow
// - Execution mode (run, pause, step)
// - Debug panel (event log, variable inspector)

type WorkflowBuilderProps = {
  workflow?: Workflow;
  onSave?: (workflow: Workflow) => void;
  onExecute?: () => void;
};
```

### 6. Task Manager App

```tsx
// apps/web/src/components/windows/taskmanager/taskmanager-window.tsx

// Tabs:
// 1. Processes - Running agents, workflows
// 2. Performance - CPU, memory, API calls/min
// 3. Network - Active connections, bandwidth
// 4. History - Recent executions

type ProcessRow = {
  id: string;
  name: string;
  type: "agent" | "workflow" | "job";
  status: "running" | "suspended" | "completed" | "failed";
  cpu: number;
  memory: number;
  started: Date;
  actions: ("pause" | "resume" | "cancel")[];
};
```

### 7. File Browser App

```tsx
// apps/web/src/components/windows/files/files-window.tsx

// Features:
// - Tree view sidebar (folders)
// - File list (list/grid view)
// - Breadcrumb navigation
// - Search
// - File actions (open, rename, delete, duplicate)
// - Drag-drop to desktop icons
// - Quick Look preview (spacebar)

type FileItem = {
  name: string;
  path: string;
  type: "file" | "directory";
  modified: Date;
  size?: number;
};
```

### 8. Desktop Icons

```tsx
// apps/web/src/components/desktop/desktop-icons.tsx

type DesktopIcon = {
  id: string;
  label: string;
  icon: ReactNode;
  position: { x: number; y: number };
  type: "app" | "file" | "folder" | "shortcut";
  action: () => void;
};

// Features:
// - Grid snap
// - Drag to reposition
// - Double-click to open
// - Right-click context menu
// - Selection (click, shift-click, drag box)
// - Auto-arrange option
```

---

## Mindscape Integration

### Concept: Two Modes

1. **Desktop Mode** (default): Traditional windowed desktop with icons, taskbar, menubar
2. **Mindscape Mode** (toggle): Full canvas view for knowledge exploration

### Toggle Mechanism

```tsx
// ⌘M or dedicated button to toggle
// Transition: Desktop fades out, canvas zooms in (or vice versa)

// In Mindscape mode:
// - Menubar stays visible (modified for canvas controls)
// - Orb stays visible
// - Windows can be "projected" onto canvas as nodes
// - Desktop icons appear as concept nodes
```

### Knowledge Integration

- **Notes** automatically create concept nodes in Mindscape
- **Conversations** can spawn knowledge extraction
- **Workflows** visualize as connected node graphs
- **Edges** show relationships between any entities

### Mindscape Entry Points

1. **Mindscape Button** in taskbar
2. **⌘M** keyboard shortcut
3. **"Visualize" action** on any window
4. **Knowledge Graph app** opens mini-mindscape
5. **Pinch-to-zoom out** on desktop (experimental)

---

## The Orb

### Presence Modes

1. **Docked** (default): Small orb in menubar status area
2. **Floating**: Draggable orb anywhere on screen
3. **Expanded**: Large central orb for voice interaction
4. **Hidden**: Completely hidden (⌘H)

### Orb States (existing, enhanced)

- `idle`: Gentle breathing animation
- `listening`: Pulsing input visualization, microphone active
- `thinking`: Processing swirl, color shift to cooler tones
- `talking`: Output visualization, speech in progress
- `active`: Workflow executing, high energy

### Orb Interactions

```tsx
// Click: Toggle expanded/docked
// Double-click: Start voice conversation
// Right-click: Quick actions menu
// Drag: Reposition (in floating mode)
// Hover: Show status tooltip

// Quick Actions:
// - Start conversation
// - Toggle Mindscape
// - Open Task Manager
// - Pause all agents
// - View notifications
```

---

## Creative Alfred-Aligned Ideas

### 1. **Living Desktop**

Desktop wallpaper subtly responds to Alfred's state:
- Idle: Gentle void with occasional particle drift
- Active: Subtle energy patterns emanating from Orb
- Thinking: Faint neural network visualization
- Error: Red glow pulses at edges

### 2. **Context Lens**

When hovering over any window for 2 seconds, a "lens" appears showing:
- Related knowledge nodes
- Recent activity
- AI-suggested actions
- Quick facts

### 3. **Ghost Windows**

Background agents show as semi-transparent "ghost" windows:
- 20% opacity
- Show activity without interrupting
- Click to focus/solidify
- Grouped in corner by default

### 4. **Workflow Trails**

When a workflow runs:
- Glowing paths appear between affected windows
- Data packets animate along paths
- Completed steps leave fading trails

### 5. **Cognitive Load Indicator**

Subtle visual system showing Alfred's "cognitive load":
- Background noise density increases with load
- Orb intensity reflects processing
- Menubar status shows capacity

### 6. **Time Capsules**

Snapshot current desktop state:
- All window positions
- Current content
- Mindscape view
- Restore later for context switching

### 7. **Focus Mode**

⌘F activates distraction-free mode:
- Single window fills screen
- All other windows minimize
- Notifications pause
- Subtle vignette effect

---

## Deprecated/Removed Concepts

| Concept | Reason | Replacement |
|---------|--------|-------------|
| `droid` window | Confusing distinction from chat | Merged into Agent Viewer |
| `workflowlist` window | Redundant with Task Manager | Task Manager "Workflows" tab |
| Edge-based window connections | Too complex for desktop mode | Reserved for Mindscape only |
| LOD (Level of Detail) for windows | Desktop uses fixed sizes | Mindscape retains LOD |
| Window tiers (primary/secondary/tertiary) | Over-engineered | Simple z-order based on focus |

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

1. [ ] **Window Chrome** - Proper title bar, traffic lights, resize handles
2. [ ] **Taskbar** - Replace dock with full taskbar
3. [ ] **MenuBar** - Basic structure with Alfred menu and clock
4. [ ] **Desktop Icons** - Grid system, drag, double-click
5. [ ] **Window Manager** - Z-order, focus, minimize/maximize

### Phase 2: Core Apps (Week 3-4)

1. [ ] **Code Editor** - Monaco integration
2. [ ] **File Browser** - Tree + list view
3. [ ] **Task Manager** - Process list, basic stats
4. [ ] **Enhance Chat** - Orb integration, better layout

### Phase 3: Workflow & Agents (Week 5-6)

1. [ ] **Workflow Builder** - n8n-style canvas
2. [ ] **Agent Viewer** - State, logs, tools
3. [ ] **Workflow Trails** - Visual execution paths

### Phase 4: Mindscape Integration (Week 7-8)

1. [ ] **Mode Toggle** - Desktop ↔ Mindscape
2. [ ] **Knowledge Window** - Mini-mindscape view
3. [ ] **Concept extraction** - Auto-create from content
4. [ ] **Edge visualization** - Mindscape-only connections

### Phase 5: Polish (Week 9-10)

1. [ ] **Orb refinement** - All modes, interactions
2. [ ] **Context Lens** - Hover intelligence
3. [ ] **Notifications** - Proper notification center
4. [ ] **Performance** - Virtualization, lazy loading
5. [ ] **Accessibility** - Full keyboard nav, screen reader

---

## Progress

*To be updated as implementation proceeds.*

---

## Surprises & Discoveries

*Document unexpected findings during implementation.*

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-02 | Keep ReactFlow for Mindscape only | Desktop mode needs traditional window management |
| 2026-01-02 | Taskbar over Dock | More familiar, supports window previews |
| 2026-01-02 | Deprecate window tiers | Unnecessary complexity for desktop metaphor |
| 2026-01-02 | Monaco for code editor | Already a dependency, best-in-class |

---

## Outcomes & Retrospective

*To be completed after implementation.*
