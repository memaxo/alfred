# TUI Architecture

**Owner**: infra  
**Status**: Implemented (Phase 2-3)  
**Last Updated**: 2025-12-28

## Purpose

Document the terminal user interface architecture, panel system, and integration patterns for ALFRED's TUI package.

## Overview

The TUI provides real-time observability and control over ALFRED's cognitive systems, workflows, and metrics through a terminal interface. Built on OpenTUI for rendering and tRPC for data subscriptions.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                         TUI Package                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Renderer   │  │    Theme     │  │  Typography  │      │
│  │  (OpenTUI)   │  │   System     │  │   Helpers    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Layout    │  │    Input     │  │    Intro     │      │
│  │    Engine    │  │   Handler    │  │  Sequence    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Panel System (BasePanel)               │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  Header │ Status │ Shortcuts │ Domain Panels       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Subscription Management (tRPC)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  Dashboard   │  │     Focus    │                        │
│  │     View     │  │     View     │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Renderer (`src/tui/renderer.ts`)

Initializes OpenTUI's CLI renderer and manages terminal state.

```typescript
export function setupTerminal(): void;
export function cleanupTerminal(): void;
export function getCurrentSize(): TerminalSize;
export function hideCursor(): void;
export function showCursor(): void;
```

### 2. Theme System (`src/tui/theme.ts`)

Dark theme only with specific color palette optimized for terminal display.

```typescript
export const colors = {
  bg: "#0A0E14",
  bgAlt: "#1A1F29",
  text: "#E6E6E6",
  textMuted: "#8A9199",
  primary: "#39BAE6",
  success: "#98C379",
  warning: "#E5C07B",
  error: "#E06C75",
  muted: "#5C6370",
};
```

### 3. Panel System (`src/tui/panels/base.ts`)

Abstract base class for all TUI panels:

```typescript
export abstract class BasePanel {
  abstract id: string;
  abstract label: string;
  
  abstract render(ctx: RenderContext): Renderable;
  abstract subscribe(): Unsubscriber;
  
  init?(): void;
  onFocus?(): void;
  onBlur?(): void;
  onResize?(width: number, height: number): void;
  handleKey?(event: KeyEvent): boolean;
}
```

### 4. Domain Panels

Each major ALFRED domain has a dedicated panel module:

| Domain | Files | Purpose |
|--------|-------|---------|
| **Cognitive** | `phase.ts`, `autonomy.ts`, `physiology.ts`, `history.ts` | Real-time cognitive state visualization |
| **Workflow** | `active.ts`, `queue.ts`, `history.ts`, `controls.ts` | Workflow execution monitoring |
| **Metrics** | `sparklines.ts`, `latency.ts`, `throughput.ts` | Performance metrics display |
| **Voice** | `pools.ts`, `sessions.ts`, `latency.ts` | Voice pipeline status |
| **Knowledge** | `stats.ts`, `search.ts`, `recent.ts` | Knowledge graph overview |

### 5. Subscription Management (`src/tui/subscriptions/`)

Manages tRPC subscription lifecycle:

```typescript
export interface SubscriptionManager {
  addSubscription(id: string, config: SubscriptionConfig): void;
  removeSubscription(id: string): void;
  pausePolling(): void;
  resumePolling(): void;
  cleanup(): void;
}
```

Each domain gets:
- **Store**: `create<Domain>Store()` - Local state cache
- **Setup**: `setup<Domain>Subscription()` - Subscription configuration

## Layout System

Supports three modes based on terminal width:

| Mode | Width | Description |
|------|-------|-------------|
| **Focus** | < 80 cols | Single panel, full screen |
| **Split** | 80-120 cols | Two panels side-by-side |
| **Dashboard** | > 120 cols | Multi-panel grid layout |

Layout engine in `src/tui/layout/engine.ts` implements flexbox-like sizing.

## Input Handling

Standard keybindings:

| Key | Action | Context |
|-----|--------|---------|
| `q` | Quit | Global |
| `ESC` | Back/Cancel | Modal, focus |
| `Tab` | Next panel | Navigation |
| `Shift+Tab` | Previous panel | Navigation |
| `Enter` | Confirm | Input, selection |
| `?` | Help | Global |
| `/` | Search | Panels |
| `:` | Command mode | Global |
| `j/k` | Up/Down | Vim mode |

Vim motions (`j`, `k`, `gg`, `G`) supported in scrollable panels.

## API Integration

TUI-specific query endpoints added to existing routers:

```typescript
// packages/api/src/routers/cognitive.ts
cognitive: {
  state: query({ streamId: string }) → CognitiveState
}

// packages/api/src/routers/knowledge.ts
knowledge: {
  stats: query({ resource?: string }) → KnowledgeStats
}
```

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Panel render | < 16ms | ✅ |
| Full dashboard | < 100ms | ✅ |
| Subscription update | < 50ms | ✅ |
| Intro sequence | < 3s | ✅ |

## File Structure

```
packages/tui/src/tui/
├── renderer.ts              # OpenTUI initialization
├── theme.ts                 # Color palette
├── typography.ts            # Text styling helpers
├── layout/
│   ├── engine.ts           # Layout calculation
│   ├── split.ts            # Split containers
│   └── adaptive.ts         # Responsive layout
├── input/
│   ├── keys.ts             # Keyboard handler
│   ├── navigation.ts       # Focus management
│   ├── commands.ts         # Command palette
│   └── vim.ts              # Vim motions
├── intro/
│   ├── logo.ts             # ASCII art
│   ├── checks.ts           # System checks
│   ├── greeting.ts         # Greeting message
│   └── sequence.ts         # Animation
├── panels/
│   ├── base.ts             # BasePanel class
│   ├── header.ts           # Top bar
│   ├── status.ts           # Status bar
│   ├── shortcuts.ts        # Shortcut hints
│   ├── cognitive/          # Cognitive domain
│   ├── workflow/           # Workflow domain
│   ├── metrics/            # Metrics domain
│   ├── voice/              # Voice domain
│   └── knowledge/          # Knowledge domain
├── subscriptions/
│   ├── manager.ts          # Subscription lifecycle
│   ├── cognitive.ts        # Cognitive store
│   ├── workflow.ts         # Workflow store
│   ├── voice.ts            # Voice store
│   └── metrics.ts          # Metrics store
├── views/
│   ├── dashboard.ts        # Main dashboard
│   └── focus.ts            # Focus mode
└── index.ts                # TUI launcher
```

## Common Patterns

### Creating a New Panel

1. Create folder `src/tui/panels/<domain>/`
2. Create `index.ts` extending `BasePanel`
3. Add sub-component files for distinct visualizations
4. Create store in `src/tui/subscriptions/<domain>.ts`
5. Export from `src/tui/panels/index.ts` (explicit exports)

### Adding API Support

1. Add query/subscription to existing router
2. Return properly typed data (no `any`)
3. Keep response payload small (TUI polls frequently)
4. Use pagination for lists (default limit: 20)

### Mock Data Pattern

```typescript
export function createMock<Domain>Data(): <Domain>State {
  return {
    // Realistic mock values for development
  };
}
```

Mock data allows panel development without backend.

## Testing Strategy

- **Unit tests**: Panel render logic, stores, helpers
- **Integration tests**: Subscription management, API endpoints
- **Manual tests**: Terminal rendering, keyboard navigation

No automated E2E tests for TUI (terminal automation unreliable).

## Future Enhancements

1. **Debugger integration**: Step through cognitive transitions, inspect state
2. **Interactive planning**: Multi-step workflow builder
3. **Live chat mode**: Terminal chat interface
4. **Plugin system**: Third-party panels

## Related Documentation

- [TUI Package Ideation](../execplans/tui-package-ideation.md) - Full implementation plan
- [OpenTUI Documentation](https://opentui.org) - Rendering library docs
- [tRPC Subscriptions](https://trpc.io/docs/subscriptions) - Real-time data

## Maintenance Notes

- Keep panels lean (< 300 lines per file)
- Extract shared visualizations to helpers
- Use sparklines for trends (ASCII charts)
- Test on 80-column terminals (common SSH default)
