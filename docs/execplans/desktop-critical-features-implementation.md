# ALFRED Desktop Critical Features Implementation

This ExecPlan implements all critical missing desktop features to elevate ALFRED to a world-class personal AI ecosystem. The work transforms ALFRED from a capable web-based window manager into a truly professional desktop environment rivaling native experiences.

**Status:** Active  
**Owner:** Desktop Architecture + UI/UX  
**Created:** 2026-01-28  
**Reference:** `.agent/PLANS.md` for ExecPlan format requirements

**Mission:** Perfection first, completeness second, visual polish third. Every line of code adheres to ALFRED `AGENTS.md` standards.

---

## Purpose / Big Picture

After this implementation, ALFRED users will experience a complete desktop transformation. Users can organize work across multiple virtual workspaces, immerse themselves in fullscreen applications, drag content seamlessly between windows, and manage their environment with keyboard precision matching professional tiling window managers. The desktop will feel native—responsive, predictable, and powerful.

Key user-visible outcomes:

- Switch between 6 virtual workspaces with ⌘1-6, each maintaining independent window sets
- Enter true fullscreen (⌘⌃F) that hides all chrome for immersive focus
- Drag files from Files app directly into Code editor windows
- Resize tiled windows with keyboard (⌘⌃H/J/K/L) like i3/Sway
- Preview live window contents when hovering taskbar icons
- Define rules that auto-tile Terminal windows but float Settings dialogs

---

## Progress

**REVISED PRIORITIES (Based on Browser Reality):**

### Implementation Status

**Completed:**

- ✅ Window state type definitions (including `fullscreen` in type union)
- ✅ Basic window CRUD operations (`openWindow`, `closeWindow`, `updateWindow`)
- ✅ Window state transitions (`minimizeWindow`, `maximizeWindow`, `restoreWindow`)
- ✅ Keyboard shortcuts infrastructure (⌘K, ⌘W, ⌘H, ⌘M, ⌘Tab)
- ✅ Z-index layer architecture
- ✅ Desktop area calculation (excludes menubar/taskbar)

**In Progress:**

- None

**Planned (Not Started):**

- ⏳ Virtual workspaces (Milestone 1)
- ⏳ Fullscreen mode implementation (Milestone 2)
- ⏳ Drag & drop (Milestone 3)
- ⏳ Window rules engine (Milestone 4)
- ⏳ Advanced tiling keyboard control (Milestone 5)
- ⏳ System-wide search (Milestone 7)

### Phase 1: Core Experience (Essential + Realistic)

- [x] Milestone 1: Virtual Workspaces Foundation (Completed 2026-01-29) - **PRIORITY 1**
  - [x] Workspace types and store slice (`workspaces.ts`)
  - [x] Workspace switcher UI component (`workspace-switcher.tsx`)
  - [x] Keyboard shortcuts (⌘1-6, ⌘⌃→/←, ⌘⌃Shift+arrows)
  - [x] Window-to-workspace assignment persistence (migration v4)
  - [x] Visual workspace indicator in menubar (centered)
  - [x] Window filtering by workspace in WindowLayer
  - [x] Auto-assign new windows to active workspace
- [ ] Milestone 2: True Fullscreen Mode (Estimated: 4 hours) - **PRIORITY 2**
  - [ ] Fullscreen window state implementation
  - [ ] Shell chrome hiding (menubar/taskbar/orb)
  - [ ] Fullscreen toggle (⌘⌃F, double-click titlebar)
  - [ ] Exit fullscreen (ESC, ⌘⌃F, move mouse to top)

### Phase 2: Productivity Power-User Features

- [ ] Milestone 3: Inter-Window Drag & Drop (Estimated: 12 hours) - **PRIORITY 3**
  - [ ] HTML5 Drag and Drop API integration
  - [ ] Drag data transfer protocol
  - [ ] File drag from Files to Code/Terminal
  - [ ] Text/image drag between apps
  - [ ] Visual drag preview/ghost
- [ ] Milestone 7: System-Wide Search (Estimated: 10 hours) - **PRIORITY 4**
  - [ ] Search index architecture
  - [ ] File content indexing
  - [ ] Knowledge graph integration
  - [ ] Spotlight-style search UI (⌘Space)

### Phase 3: Advanced Window Management

- [ ] Milestone 4: Window Rules Engine (Estimated: 6 hours) - **PRIORITY 5**
  - [ ] Rule schema and parser
  - [ ] Auto-tile/auto-float by window type
  - [ ] Auto-assign to workspace rules
  - [ ] Persistent position memory per app
- [ ] Milestone 5: Advanced Tiling Keyboard Control (Estimated: 6 hours) - **PRIORITY 6**
  - [ ] Resize mode activation (⌘⌃R)
  - [ ] Directional resize (H/J/K/L)
  - [ ] Window swapping (⌘⌃S + direction)
  - [ ] Master ratio adjustment (⌘⌃+/-)

### Phase 4: Deferred/Pending Validation

- [ ] Milestone 6: Live Window Previews (Estimated: 8 hours) - **DEFERRED**
  - **Rationale:** Requires html2canvas or DOM-to-canvas conversion. Performance concerns with 30+ apps. True thumbnails not possible without native compositor access.
  - **Alternative:** Enhanced tooltips with window state info (title, app type, modified status)
- [ ] Milestone 8: Multi-Monitor Support (Estimated: 4 hours) - **DEFERRED/RESCOPED**
  - **Rationale:** Browser security model makes true multi-monitor impossible. Cannot enumerate displays or move windows between them.
  - **What we CAN do:** Basic DPI detection and UI scale adaptation when user manually moves browser window
  - **Recommendation:** Skip entirely until ALFRED has an Electron or Tauri wrapper

---

## Surprises & Discoveries

- **Observation:** Zustand slice unit testing requires full store setup
  **Evidence:** Initial attempt to test `createWorkspaceSlice` in isolation failed because slice methods rely on `set` and `get` from Zustand's store context. Mock state approach doesn't properly integrate with slice closures.
  **Resolution:** Integration tests with actual store creation are more reliable than unit tests for Zustand slices. Manual validation and E2E tests provide better coverage.
  **Date:** 2026-01-29

- **Observation:** Workspace switcher centered positioning works best
  **Evidence:** Centered absolute positioning (`left-1/2 -translate-x-1/2`) provides consistent placement regardless of left/right content width in menubar.
  **Date:** 2026-01-29

---

## Decision Log

- **Decision:** Defer Milestone 8 (Multi-Monitor) and significantly reduce scope
  **Rationale:** Browser security model prevents true multi-monitor window management. Cannot enumerate displays, cannot move windows between monitors programmatically, cannot create windows on specific displays. The Screen API (`window.screen`) only provides information about the current screen. Attempting full multi-monitor support in a webapp is overengineering against impossible constraints.
  **Date/Author:** 2026-01-29 / Agent

- **Decision:** Maintain Milestone 1 (Virtual Workspaces) as top priority
  **Rationale:** Virtual workspaces are ENTIRELY realistic in a webapp. They are pure UI state with no browser limitations. ALFRED needs this to compete with native desktop workflows. Users expect spaces/workspaces in modern productivity tools (Notion, Figma, Linear all have variations). This is NOT overengineering—it is essential for organizing 30+ app types.
  **Date/Author:** 2026-01-29 / Agent

- **Decision:** Defer Milestone 6 (Live Window Previews) pending performance validation
  **Rationale:** True window thumbnails require html2canvas or similar, which has performance costs and limitations (WebGL content, iframes). macOS/Windows previews work because they have compositor access. Browser-based "previews" would be full DOM screenshots—expensive and potentially janky. Taskbar tooltips showing app name/state is sufficient for MVP.
  **Date/Author:** 2026-01-29 / Agent

- **Decision:** Reorder milestones by value/realism ratio
  **Rationale:** Virtual Workspaces (1) and Fullscreen (2) are foundational and 100% realistic. Drag & Drop (3) and Search (7) provide massive value and are mature web APIs. Window Rules (4) and Tiling Keyboard (5) are nice-to-have for power users. Previews (6) and Multi-Monitor (8) face browser limitations that make them poor investments at this stage.
  **Date/Author:** 2026-01-29 / Agent

- **Decision:** Implement 6 fixed workspaces with per-workspace tiling config
  **Rationale:** Fixed workspace count (like macOS) simplifies UI and mental model. Per-workspace tiling config allows different layouts per context (e.g., coding workspace with split-h, communication workspace with float). Centered workspace switcher in menubar provides visual balance.
  **Implementation:** `workspaces.ts` slice with `switchWorkspace`, `nextWorkspace`, `previousWorkspace`, `moveWindowToWorkspace` actions. WindowLayer filters by active workspace. Windows auto-assigned to active workspace on creation.
  **Date/Author:** 2026-01-29 / Agent

---

## Outcomes & Retrospective

_(To be completed at final milestone)_

---

## Context and Orientation

### Repository Structure

The ALFRED desktop implementation lives primarily in:

```
apps/web/src/
├── components/desktop/          # Shell components (NO ReactFlow)
│   ├── shell.tsx               # Main orchestrator
│   ├── layers/                 # Z-ordered layers
│   │   ├── window-layer.tsx    # DOM window rendering
│   │   ├── mindscape-layer.tsx # ReactFlow canvas (isolated)
│   │   ├── orb-layer.tsx       # Voice orb
│   │   ├── widget-layer.tsx    # Pinned widgets
│   │   └── desktop-icons.tsx   # Desktop shortcuts
│   ├── windows/                # Window components
│   │   ├── chrome.tsx          # Window frame (titlebar, controls)
│   │   ├── registry.tsx        # Window type registry
│   │   ├── types.ts            # Window component interfaces
│   │   └── resize-handles.tsx  # 8-directional resize
│   ├── tiling/                 # Tiling window manager
│   │   ├── utils.ts            # Zone detection
│   │   └── zone-preview.tsx    # Drag preview overlay
│   ├── taskbar/                # Bottom dock
│   ├── menubar/                # Top menu bar
│   └── command-palette.tsx     # Quick launcher
│
├── store/desktop/              # State management
│   ├── index.ts                # Store exports
│   ├── types.new.ts            # Core types (WindowInstance, etc.)
│   ├── windows.new.ts          # Window CRUD operations
│   ├── tiling.ts               # Tiling layout engine
│   ├── viewport.new.ts         # Viewport/focus state
│   ├── taskbar.ts              # Dock pins
│   ├── icons.ts                # Desktop icons
│   └── persist.ts              # LocalStorage persistence
│
└── components/apps/            # Application implementations
    ├── chat/                   # AI conversation
    ├── code/                   # Monaco editor
    ├── files/                  # File browser
    └── [30+ other apps]/
```

### Key Types

Current window state (from `store/desktop/types.new.ts`):

```typescript
type WindowInstance = {
  id: string;
  type: WindowType;
  data: WindowData;
  bounds: Bounds; // { x, y, width, height }
  state: WindowState; // 'normal' | 'minimized' | 'maximized' | 'fullscreen'
  isTiled: boolean;
  tileZone?: TileZone;
  zIndex: number;
  isFocused: boolean;
  minSize: { width: number; height: number };
  maxSize?: { width: number; height: number };
  resizable: boolean;
  createdAt: number;
  lastFocusedAt: number;
};

type WindowState = "normal" | "minimized" | "maximized" | "fullscreen";
```

**Implementation Status:** `fullscreen` is defined in the type union but **NOT YET IMPLEMENTED**. Milestone 2 will add:

- `fullscreenWindow()` and `exitFullscreen()` methods in `windows.new.ts`
- `fullscreenWindowId` state tracking in store
- Fullscreen state handling in `chrome.tsx` (currently only `maximizeWindow`/`restoreWindow` exist)
- ⌘⌃F keyboard shortcut in `use-keyboard-shortcuts.ts`
- Chrome hiding logic in `shell.tsx` (menubar/taskbar/orb)
- Fullscreen window filtering and z-index elevation in `window-layer.tsx`

### Z-Index Architecture

From `components/desktop/shell.tsx`:

```typescript
const Z_INDEX = {
  BACKGROUND: 0,
  MINDSCAPE: 50,
  WINDOWS_MIN: 100,
  WINDOWS_MAX: 500,
  ORB: 900,
  MENU_BAR: 1000,
  TASKBAR: 1000,
  OVERLAY: 2000,
};
```

---

## Browser Reality Check

**What is Actually Possible in Chrome/Web Platform:**

✅ **Realistic:**

- Virtual workspaces (pure UI state, no browser limitations)
- Fullscreen API (`document.documentElement.requestFullscreen()`)
- HTML5 Drag & Drop API
- Keyboard shortcuts (with standard browser limitations)
- Canvas-based "previews" (html2canvas or similar)
- LocalStorage/IndexedDB persistence
- Screen DPI detection (`window.devicePixelRatio`)

❌ **NOT Realistic (Browser Security Model):**

- **Multi-monitor window management:** Cannot enumerate displays, cannot move browser window to another monitor programmatically, cannot create windows on specific displays
- **True window thumbnails:** Cannot capture other windows' contents (privacy restriction)
- **Global keyboard shortcuts:** Cannot register system-wide hotkeys
- **System integration:** No access to native window management, Mission Control, Exposé

**TanStack Start Context:**
TanStack Start is a meta-framework that compiles to web standards. All browser limitations apply. We are building a web app that runs in Chrome, not an Electron app with native APIs.

**Revised Priority:**

1. Virtual Workspaces (#1) - ESSENTIAL, completely realistic
2. Fullscreen (#2) - ESSENTIAL, browser API exists
3. Drag & Drop (#3) - HIGH VALUE, HTML5 API mature
4. Search (#7) - HIGH VALUE, entirely feasible
5. Window Rules (#4) - MEDIUM, pure state management
6. Tiling Keyboard (#5) - MEDIUM, shortcuts work within browser focus
7. Previews (#6) - DEFERRED - requires html2canvas, performance concerns
8. Multi-Monitor (#8) - DEFERRED - only basic DPI detection possible

---

## Plan of Work

### Milestone 1: Virtual Workspaces Foundation

**Scope:** Implement multiple virtual workspaces that users can switch between, each maintaining its own set of windows and tiling layout.

**User Outcome:** Users press ⌘1 through ⌘6 to switch between workspaces. Each workspace remembers its windows independently. The menubar shows the current workspace number.

**Technical Design:**

We introduce a `WorkspaceSlice` to the desktop store. A workspace contains an ID (1-6), a label (optional), an array of window IDs assigned to that workspace, and the tiling configuration for that workspace. The `WindowInstance` type gains a `workspaceId` field.

**Current State:** `WindowLayer` currently only filters minimized windows (`w.state !== "minimized"`). After workspace implementation, it will also filter by active workspace: `.filter((w) => w.workspaceId === activeWorkspaceId)`.

**Files to Create:**

1. `apps/web/src/store/desktop/workspaces.ts` - The workspace slice factory

```typescript
export interface Workspace {
  id: number;
  label?: string;
  windowIds: string[];
  tilingConfig: TilingConfig;
}

export interface WorkspaceSlice {
  workspaces: Workspace[];
  activeWorkspaceId: number;
  switchWorkspace: (id: number) => void;
  moveWindowToWorkspace: (windowId: string, workspaceId: number) => void;
}
```

2. `apps/web/src/components/desktop/workspace-switcher.tsx` - Visual workspace indicator showing 1-6 buttons with active state

**Files to Modify:**

3. `apps/web/src/store/desktop/types.new.ts` - Add `workspaceId?: number` to `WindowInstance` type (not `WindowData`)
4. `apps/web/src/store/desktop/index.ts` - Export workspace slice and add to DesktopState
5. `apps/web/src/components/desktop/shell.tsx` - Filter WindowLayer by active workspace
6. `apps/web/src/components/desktop/menubar/index.tsx` - Insert WorkspaceSwitcher component
7. `apps/web/src/components/desktop/hooks/use-keyboard-shortcuts.ts` - Add ⌘1-6 and ⌘⌃arrow shortcuts
8. `apps/web/src/store/desktop/persist.ts` - Add workspace state to persistence

**Validation:**

1. Start dev server: `bun run dev`
2. Open 3 different windows in workspace 1
3. Press ⌘2 - windows disappear, menubar shows "2" active
4. Press ⌘1 - original windows reappear
5. Refresh page - verify workspaces persisted

---

### Milestone 2: True Fullscreen Mode

**Scope:** Implement proper fullscreen mode that hides all shell chrome (menubar, taskbar, orb) and dedicates the entire screen to the focused window.

**User Outcome:** Users press ⌘⌃F to enter fullscreen. The window fills the entire viewport, hiding all chrome. Moving mouse to top reveals menubar temporarily. ESC exits fullscreen.

**Technical Design:**

Fullscreen uses the existing `"fullscreen"` value in `WindowState` union (already defined in types). When a window enters fullscreen:

1. Window bounds expand to full viewport (0, 0, innerWidth, innerHeight)
2. Store tracks `fullscreenWindowId` state (null when no window is fullscreen)
3. Shell chrome components (`shell.tsx`) check `fullscreenWindowId` and hide menubar/taskbar/orb when non-null
4. Fullscreen window z-index elevates to overlay level (2000) to cover everything
5. Mouse tracking at top edge reveals menubar temporarily (optional enhancement)
6. `WindowLayer` filters fullscreen windows and renders them above all other windows

**Files to Modify:**

1. `apps/web/src/store/desktop/windows.new.ts` - Add fullscreen methods to `WindowSlice`:

   ```typescript
   fullscreenWindow: (windowId: string) => void;
   exitFullscreen: () => void;
   fullscreenWindowId: string | null;  // Add to slice state
   ```

   Implementation should:
   - Set window state to `"fullscreen"`
   - Expand bounds to full viewport
   - Store previous bounds for restore
   - Set `fullscreenWindowId` in store

2. `apps/web/src/store/desktop/viewport.new.ts` - Add `fullscreenWindowId` to `ViewportSlice` (or keep in `WindowSlice` - TBD)

3. `apps/web/src/components/desktop/windows/chrome.tsx` - Handle fullscreen state:
   - Check `window.state === "fullscreen"` to hide chrome controls
   - Add double-click titlebar handler for fullscreen toggle
   - Style fullscreen windows appropriately

4. `apps/web/src/components/desktop/shell.tsx` - Hide chrome when fullscreen:
   - Read `fullscreenWindowId` from store
   - Conditionally hide `<MenuBar>`, `<Taskbar>`, and `<OrbLayer>` when `fullscreenWindowId !== null`

5. `apps/web/src/components/desktop/layers/window-layer.tsx` - Elevate fullscreen window z-index:
   - Filter fullscreen windows separately
   - Render fullscreen windows with `zIndex: Z_INDEX.OVERLAY` (2000)
   - Ensure fullscreen window covers all other layers

6. `apps/web/src/components/desktop/hooks/use-keyboard-shortcuts.ts` - Add ⌘⌃F toggle:
   - Detect `Meta+Control+F` or `Cmd+Ctrl+F`
   - Toggle fullscreen on focused window
   - Add ESC handler to exit fullscreen

**Validation:**

1. Open any window
2. Press ⌘⌃F - window expands to full screen, chrome disappears
3. Move mouse to top - menubar slides down temporarily
4. Press ESC - returns to previous state

---

### Milestone 3: Inter-Window Drag and Drop

**Scope:** Enable dragging content (files, text, images) between application windows using HTML5 Drag and Drop API.

**User Outcome:** Users can drag a file from the Files app and drop it into the Code editor. Visual feedback shows during drag. Drop zones highlight when hovering.

**Technical Design:**

ALFRED implements a drag-drop protocol with MIME types:

- `application/alfred-file`: File paths with metadata
- `application/alfred-text`: Plain text content
- `application/alfred-window-id`: Source window reference

**Files to Create:**

1. `apps/web/src/lib/drag-drop/context.tsx` - DragDropContext provider
2. `apps/web/src/lib/drag-drop/types.ts` - Drag data types
3. `apps/web/src/lib/drag-drop/use-drag.ts` - Hook for initiating drags
4. `apps/web/src/lib/drag-drop/use-drop.ts` - Hook for receiving drops
5. `apps/web/src/components/desktop/drag-overlay.tsx` - Visual drag preview

**Files to Modify:**

6. `apps/web/src/components/apps/files/file-grid.tsx` - Make files draggable
7. `apps/web/src/components/apps/code/index.tsx` - Accept file drops
8. `apps/web/src/components/desktop/shell.tsx` - Add DragDropProvider
9. `apps/web/src/components/desktop/window-layer.tsx` - Track drag state

---

### Milestone 7: System-Wide Search (Moved Up in Priority)

**Scope:** Implement Spotlight-style search that finds files, apps, knowledge graph entities, and commands.

**User Outcome:** Press ⌘Space to open search. Type to find anything instantly. Results grouped by category with keyboard navigation.

**Files to Create:**

1. `apps/web/src/lib/search/index.ts` - Search engine using Fuse.js
2. `apps/web/src/lib/search/types.ts` - Search result types
3. `apps/web/src/components/desktop/spotlight-search.tsx` - Main search UI
4. `apps/web/src/components/desktop/search/result-item.tsx`
5. `apps/web/src/components/desktop/search/result-group.tsx`

**Files to Modify:**

6. `apps/web/src/components/desktop/hooks/use-keyboard-shortcuts.ts` - Add ⌘Space
7. `apps/web/src/components/desktop/shell.tsx` - Add SpotlightSearch component

---

## Validation and Acceptance

### Overall Acceptance Criteria

After all milestones complete:

1. **Virtual Workspaces:**
   - Run `bun test apps/web/src/store/desktop/__tests__/workspaces.test.ts` - expect 100% pass
   - Manually verify 6 workspaces with independent window sets

2. **Fullscreen:**
   - Press ⌘⌃F in any window - verify chrome hides completely
   - Verify ESC exits fullscreen

3. **Drag & Drop:**
   - Drag file from Files to Code - file opens
   - Visual feedback visible during drag

4. **Search:**
   - ⌘Space opens search
   - Finds files, apps, knowledge

### Test Commands

```bash
# Run all desktop tests
bun test apps/web/src/components/desktop/__tests__/
bun test apps/web/src/store/desktop/__tests__/

# Type check
bun run typecheck

# Lint
bun run lint
```

## Idempotence and Recovery

Each milestone can be developed independently. The store slices are additive - new fields default safely. If a milestone needs rollback, remove the slice from `DesktopState` type and remove UI components.

---

**Change Log:**

- 2026-01-28: Initial comprehensive ExecPlan created
- 2026-01-29: Revised priorities based on browser reality. Deferred Milestones 6 and 8. Reordered by value/realism ratio. Added Browser Reality Check section.
- 2026-01-29: Added Implementation Status section. Clarified fullscreen implementation gap. Fixed WindowLayer filtering description. Expanded Milestone 2 technical details.
