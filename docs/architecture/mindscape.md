# Mindscape Architecture

> **Route:** `/` (protected root route, previously `/mindscape`)

## Overview

Mindscape is the spatial canvas UI built on React Flow. It renders windows as draggable nodes with semantic edges connecting related resources. The architecture follows **Reality-Driven UI** - visualization derives strictly from real system state, never from simulation or mock data.

## Store Architecture

State management uses Zustand with four slices in `store/desktop/`:

| Slice | Purpose | Key Actions |
|-------|---------|-------------|
| `windows.ts` | Window CRUD, React Flow nodes | `addWindow`, `removeWindow`, `updateWindow` |
| `viewport.ts` | Focus, zoom, space mode | `setFocusedWindow`, `setViewport` |
| `dock.ts` | Pinned types, spawning | `spawn`, `pin`, `unpin` |
| `persist.ts` | localStorage (<50KB budget) | Auto-persisted via middleware |

**Usage:**
```typescript
import { useDesktopStore } from "@/store/desktop";
const { spawn, windows } = useDesktopStore();
```

## Window Types

12 window types registered in `components/windows/registry.tsx`:

| Tier | Types | Behavior |
|------|-------|----------|
| Primary | chat, droid | Singleton, prominent glow |
| Secondary | workflow, workflowlist, note, reminder, todo | Multi-instance allowed |
| Tertiary | settings, privacy, profile, integrations, timer, bookmark | Singleton, subtle styling |

## Data Persistence

### TanStack DB Collections

Resource data persists via collections in `collections/`:
- `noteCollection` - Notes with optimistic CRUD
- `reminderCollection` - Reminders with fire/delete

Collections use `createOptimisticAction` for instant UI updates with server reconciliation.

### Real-Time Sync

`lib/subscription/manager.ts` provides multiplexed WebSocket:
- Cursor-based resume after disconnect
- Automatic reconnection with exponential backoff
- Hooks: `useGraphSubscription`, `useWorkflowSubscription`

## Performance

### LOD (Level of Detail)

Nodes implement four render states via `useLOD()`:
- **tiny** (<0.3 zoom): Colored dot only
- **small** (0.3-0.5): Icon + label
- **medium** (0.5-0.8): Compact content
- **full** (>0.8): Complete UI

### Edge Degradation

`useVisibleEdges()` filters edges by zoom:
- <0.3: Hide all edges
- 0.3-0.6: Show `context` and `relates_to` only
- >0.6: Show all with labels

### Storage Budget

Layout persistence capped at 50KB. Monitor with `getLayoutStorageSize()` from `lib/desktop/performance.ts`.

## Event-Driven Activations

Visual activity (glowing edges, pulsing nodes) driven by unified event bus:

- **Hook:** `useMindscapeActivations()` (consume)
- **Dispatcher:** `dispatchMindscapeEvent(event)` (produce)

| Event Type | Trigger | Visual Effect |
|------------|---------|---------------|
| `voice-input` | VAD active | Pulse User → VoiceSession |
| `tool-call` | Tool execution | Pulse Chat → ToolNode |
| `rag-retrieval` | Docs retrieved | Pulse KnowledgeNode |
| `workflow-step` | Workflow event | Pulse WorkflowNode |
| `context-cache` | Cache hit | Highlight cached edges |

## UI Patterns

1. **Command Palette** (Ctrl+K): Context-filtered actions based on focused node
2. **Window Spawning**: Dock `spawn(type)` with position offset to prevent overlap
3. **Focus Gravity**: Unfocused nodes blur/scale-down when another is active
4. **Edge Deduplication**: Use `Map<string, Edge>` keyed by ID before `setEdges()`
