# Desktop Evolution — Linear Ticket Creation Template

**Purpose:** Template for subagent to create 237 Linear tasks from the Desktop Evolution PRD.  
**Created:** 2026-01-03  
**Source PRD:** `docs/execplans/desktop-evolution-prd.md`

---

## Epic Reference

| Epic ID | Title | Tasks |
|---------|-------|-------|
| `ALF-412` | Phase 0: Type Migration & Architecture Setup | 29 |
| `ALF-413` | Phase 1: Foundation (Shell, Tiling) | 24 |
| `ALF-414` | Phase 2: Core Applications | 31 |
| `ALF-415` | Phase 3: System Applications | 25 |
| `ALF-416` | Phase 4: Knowledge & Integration | 22 |
| `ALF-417` | Phase 5: Orb & Voice | 11 |
| `ALF-418` | Phase 6: Mindscape & Graph Components | 23 |
| `ALF-419` | Phase 7: Polish & Accessibility | 16 |
| `ALF-420` | Phase 8: Intelligence & Learning Apps | 56 |

---

## Ticket Template

### Standard Task Format

```markdown
## Title Format
[Phase.Section] Task Name

## Example
[0.1] Create WindowInstance type without Node<T>
[2.1] Chat app container
[8.3] Policy Viewer - Decision log viewer
```

### Description Template

```markdown
## Summary
[One sentence describing what this task accomplishes]

## Files to Create/Modify
- `path/to/file1.ts`
- `path/to/file2.tsx`

## Implementation Details
[2-3 bullet points of key implementation notes from PRD]

## Acceptance Criteria
- [ ] [Specific testable criterion 1]
- [ ] [Specific testable criterion 2]
- [ ] [Specific testable criterion 3]

## Estimate
[X]h

## References
- PRD Section: [X.Y]
- Related Epic: ALF-XXX
```

---

## Ticket Data by Phase

### Phase 0: Type Migration (ALF-412)

#### Section 0.1: Core Type System Migration

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 0.1.1 | Create WindowInstance type without Node<T> | `store/desktop/types.ts` | 4h | Urgent |
| 0.1.2 | Create Bounds, WindowState, TileZone types | `store/desktop/types.ts` | 2h | Urgent |
| 0.1.3 | Create TilingLayout, TilingConfig types | `store/desktop/tiling.ts` | 2h | Urgent |
| 0.1.4 | Extend WindowType with Phase 8 apps | `store/desktop/types.ts` | 1h | Urgent |
| 0.1.5 | Create Zod schemas for new types | `store/desktop.schemas.ts` | 4h | Urgent |

**Description snippets:**

```yaml
0.1.1:
  summary: "Define new WindowInstance type that uses pure TypeScript instead of extending ReactFlow Node<T>"
  details:
    - Remove dependency on @xyflow/react Node type
    - Add bounds (x, y, width, height), state, zIndex, isFocused
    - Add minSize, maxSize, resizable constraints
    - Add createdAt, lastFocusedAt timestamps
  criteria:
    - WindowInstance type compiles without @xyflow/react import
    - Type includes all fields from desktop-type-migration.md
    - Existing code using WindowInstance shows type errors (expected)

0.1.2:
  summary: "Create geometry and state types for traditional window management"
  details:
    - Bounds: { x, y, width, height } for window positioning
    - WindowState: 'normal' | 'minimized' | 'maximized' | 'fullscreen'
    - TileZone: 10 zone positions (left, right, top, bottom, quadrants, center, full)
  criteria:
    - Types exported from store/desktop/types.ts
    - TileZone covers all 10 positions documented in PRD

0.1.3:
  summary: "Define tiling layout configuration types"
  details:
    - TilingLayout: 7 layout modes (float, split-h, split-v, quad, main-side, stack, columns)
    - TilingConfig: layout, gap, mainRatio, respectMinSize
  criteria:
    - Types support all 6 layout presets mentioned in PRD
    - TilingConfig is validated by corresponding Zod schema

0.1.4:
  summary: "Add 7 new Phase 8 app types to WindowType union"
  details:
    - Add: cortex, learning, policy, tune, plan, metrics, rag
    - Organize by tier in comments
  criteria:
    - WindowType includes all 25+ window types
    - Organized with tier comments (0-4)

0.1.5:
  summary: "Create Zod validation schemas for all new types"
  details:
    - boundsSchema, windowStateSchema, tileZoneSchema
    - windowInstanceSchema, tilingLayoutSchema, tilingConfigSchema
  criteria:
    - All schemas parse valid data without errors
    - Schemas reject invalid data with clear errors
```

#### Section 0.2: Store Architecture Separation

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 0.2.1 | Rewrite WindowSlice without ReactFlow | `store/desktop/windows.ts` | 8h | Urgent |
| 0.2.2 | Create TilingSlice | `store/desktop/tiling.ts` | 6h | Urgent |
| 0.2.3 | Adapt ViewportSlice for desktop mode | `store/desktop/viewport.ts` | 4h | Urgent |
| 0.2.4 | Remove ReactFlow imports from desktop store | `store/desktop/index.ts` | 2h | Urgent |
| 0.2.5 | Create MindscapeSlice (ReactFlow isolated) | `store/mindscape/index.ts` | 6h | Urgent |
| 0.2.6 | Create MindscapeNodeData types | `store/mindscape/types.ts` | 2h | Urgent |

#### Section 0.3: Graph Types Setup

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 0.3.1 | Create shared graph type file | `types/graph.ts` | 4h | Urgent |
| 0.3.2 | Define KnowledgeGraphNode types | `types/graph.ts` | 2h | Urgent |
| 0.3.3 | Define WorkflowGraphNode types | `types/graph.ts` | 2h | Urgent |
| 0.3.4 | Define SpawnTreeNode types | `types/graph.ts` | 2h | Urgent |
| 0.3.5 | Define PlanGraphNode types | `types/graph.ts` | 2h | Urgent |
| 0.3.6 | Define EmbeddingNode types | `types/graph.ts` | 2h | Urgent |

#### Section 0.4: Component Props Migration

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 0.4.1 | Create WindowComponentProps interface | `components/desktop/windows/types.ts` | 2h | Urgent |
| 0.4.2 | Create window component adapter | `components/desktop/windows/adapter.tsx` | 6h | Urgent |
| 0.4.3 | Update existing window imports | Multiple (12 files) | 12h | Urgent |
| 0.4.4 | Remove NodeProps imports from windows | Multiple | 4h | Urgent |

#### Section 0.5: ReactFlow Isolation Directory

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 0.5.1 | Create components/graphs/ directory | Directory structure | 1h | Urgent |
| 0.5.2 | Create graphs/mindscape/ module | `components/graphs/mindscape/` | 2h | Urgent |
| 0.5.3 | Create graphs/knowledge/ module | `components/graphs/knowledge/` | 2h | Urgent |
| 0.5.4 | Create graphs/workflow/ module | `components/graphs/workflow/` | 2h | Urgent |
| 0.5.5 | Create graphs/agents/ module | `components/graphs/agents/` | 2h | Urgent |
| 0.5.6 | Create graphs/plan/ module | `components/graphs/plan/` | 2h | Urgent |
| 0.5.7 | Create graphs/rag/ module | `components/graphs/rag/` | 2h | Urgent |
| 0.5.8 | Add ESLint rule to enforce isolation | `.eslintrc.js` | 2h | Urgent |

---

### Phase 1: Foundation (ALF-413)

#### Section 1.1: Desktop Shell Setup

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 1.1.1 | Create shell component structure | `components/desktop/shell.tsx` | 4h | High |
| 1.1.2 | Implement layer system with z-ordering | `components/desktop/layers/` | 6h | High |
| 1.1.3 | Set up desktop store | `store/desktop/index.ts` | 4h | High |
| 1.1.4 | Configure persistence middleware | `store/desktop/persist.ts` | 4h | High |
| 1.1.5 | Implement global keyboard handler | `hooks/use-global-shortcuts.ts` | 6h | High |

#### Section 1.2: Menu Bar Implementation

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 1.2.1 | Menu bar container | `components/desktop/menubar/menubar.tsx` | 4h | High |
| 1.2.2 | Alfred menu dropdown | `components/desktop/menubar/alfred-menu.tsx` | 3h | High |
| 1.2.3 | App-specific menus | `components/desktop/menubar/app-menu.tsx` | 4h | High |
| 1.2.4 | Status area icons | `components/desktop/menubar/status-area.tsx` | 4h | High |
| 1.2.5 | Clock widget | `components/desktop/menubar/clock.tsx` | 2h | High |

#### Section 1.3: Taskbar Implementation

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 1.3.1 | Taskbar container | `components/desktop/taskbar/taskbar.tsx` | 4h | High |
| 1.3.2 | App launcher button | `components/desktop/taskbar/launch-button.tsx` | 3h | High |
| 1.3.3 | Pinned apps section | `components/desktop/taskbar/pinned-apps.tsx` | 4h | High |
| 1.3.4 | Running apps with previews | `components/desktop/taskbar/running-apps.tsx` | 6h | High |
| 1.3.5 | System tray | `components/desktop/taskbar/system-tray.tsx` | 4h | High |

#### Section 1.4: Tiling Window Manager

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 1.4.1 | Tiling store slice | `store/desktop/tiling.ts` | 8h | High |
| 1.4.2 | Zone calculation engine | `lib/desktop/tiling-engine.ts` | 12h | High |
| 1.4.3 | Layout presets (6 layouts) | `lib/desktop/tiling-layouts.ts` | 8h | High |
| 1.4.4 | Window chrome component | `components/desktop/windows/chrome.tsx` | 8h | High |
| 1.4.5 | Resize handle system | `components/desktop/windows/resize-handle.tsx` | 6h | High |
| 1.4.6 | Focus navigation | `hooks/use-tiling-navigation.ts` | 4h | High |

#### Section 1.5: Window Registry

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 1.5.1 | Window type registry | `components/desktop/apps/registry.ts` | 4h | High |
| 1.5.2 | Window factory function | `lib/desktop/window-factory.ts` | 4h | High |
| 1.5.3 | Default window configs | `config/window-defaults.ts` | 2h | High |

---

### Phase 2: Core Applications (ALF-414)

#### Section 2.1: Chat Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 2.1.1 | Chat app container | `components/desktop/apps/chat/chat-app.tsx` | 4h | High |
| 2.1.2 | Message list with virtualization | `components/desktop/apps/chat/message-list.tsx` | 8h | High |
| 2.1.3 | Input area with attachments | `components/desktop/apps/chat/input-area.tsx` | 6h | High |
| 2.1.4 | Voice indicator component | `components/desktop/apps/chat/voice-indicator.tsx` | 6h | High |
| 2.1.5 | Thread sidebar | `components/desktop/apps/chat/thread-sidebar.tsx` | 4h | High |
| 2.1.6 | Context panel | `components/desktop/apps/chat/context-panel.tsx` | 4h | High |
| 2.1.7 | Agent selector | `components/desktop/apps/chat/agent-selector.tsx` | 4h | High |
| 2.1.8 | Chat store | `store/chat.ts` | 6h | High |
| 2.1.9 | Voice integration hook | `hooks/use-chat-voice.ts` | 8h | High |
| 2.1.10 | Assistant stream hook | `hooks/use-assistant-stream.ts` | 6h | High |

#### Section 2.2: Code Editor Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 2.2.1 | Code app container | `components/desktop/apps/code/code-app.tsx` | 4h | High |
| 2.2.2 | Monaco integration | `components/desktop/apps/code/monaco-editor.tsx` | 8h | High |
| 2.2.3 | Editor tabs | `components/desktop/apps/code/editor-tabs.tsx` | 4h | High |
| 2.2.4 | File tree sidebar | `components/desktop/apps/code/file-tree.tsx` | 6h | High |
| 2.2.5 | AI suggestions overlay | `components/desktop/apps/code/ai-suggestions.tsx` | 8h | High |
| 2.2.6 | Diff viewer | `components/desktop/apps/code/diff-viewer.tsx` | 8h | High |
| 2.2.7 | ALFRED void theme | `lib/monaco/alfred-theme.ts` | 4h | High |
| 2.2.8 | Code store | `store/code.ts` | 6h | High |
| 2.2.9 | FS operations hook | `hooks/use-fs-operations.ts` | 4h | High |

#### Section 2.3: Agent Waves Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 2.3.1 | Agents app container | `components/desktop/apps/agents/agents-app.tsx` | 4h | High |
| 2.3.2 | Wave timeline | `components/desktop/apps/agents/wave-timeline.tsx` | 8h | High |
| 2.3.3 | Agent card component | `components/desktop/apps/agents/agent-card.tsx` | 6h | High |
| 2.3.4 | Spawn tree visualization | `components/desktop/apps/agents/spawn-tree.tsx` | 8h | High |
| 2.3.5 | Execution log panel | `components/desktop/apps/agents/execution-log.tsx` | 6h | High |
| 2.3.6 | Dependency graph | `components/desktop/apps/agents/dependency-graph.tsx` | 8h | High |
| 2.3.7 | Agents store | `store/agents.ts` | 8h | High |
| 2.3.8 | Orchestrator stream hook | `hooks/use-orchestrator-stream.ts` | 8h | High |

#### Section 2.4: Terminal Enhancement

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 2.4.1 | Enhanced terminal container | `components/desktop/apps/terminal/terminal-app.tsx` | 4h | High |
| 2.4.2 | Terminal tabs | `components/desktop/apps/terminal/terminal-tabs.tsx` | 4h | High |
| 2.4.3 | Profile management | `components/desktop/apps/terminal/profiles.tsx` | 4h | High |
| 2.4.4 | XTerm.js integration | `lib/terminal/xterm-config.ts` | 4h | High |

---

### Phase 3: System Applications (ALF-415)

#### Section 3.1: PR Review Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 3.1.1 | PR app container | `components/desktop/apps/pr-review/pr-app.tsx` | 4h | Medium |
| 3.1.2 | PR list with filters | `components/desktop/apps/pr-review/pr-list.tsx` | 6h | Medium |
| 3.1.3 | PR detail panel | `components/desktop/apps/pr-review/pr-detail.tsx` | 4h | Medium |
| 3.1.4 | Diff panel with comments | `components/desktop/apps/pr-review/diff-panel.tsx` | 10h | Medium |
| 3.1.5 | Comment thread component | `components/desktop/apps/pr-review/comment-thread.tsx` | 6h | Medium |
| 3.1.6 | Merge controls with biometric | `components/desktop/apps/pr-review/merge-controls.tsx` | 6h | Medium |
| 3.1.7 | CI status display | `components/desktop/apps/pr-review/ci-status.tsx` | 4h | Medium |
| 3.1.8 | PR review store | `store/pr-review.ts` | 6h | Medium |

#### Section 3.2: Docker Manager Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 3.2.1 | Docker app container | `components/desktop/apps/docker/docker-app.tsx` | 4h | Medium |
| 3.2.2 | Container list | `components/desktop/apps/docker/container-list.tsx` | 6h | Medium |
| 3.2.3 | Container detail panel | `components/desktop/apps/docker/container-detail.tsx` | 4h | Medium |
| 3.2.4 | Logs viewer with search | `components/desktop/apps/docker/logs-viewer.tsx` | 6h | Medium |
| 3.2.5 | Resource charts | `components/desktop/apps/docker/resource-chart.tsx` | 6h | Medium |
| 3.2.6 | Docker store | `store/docker.ts` | 6h | Medium |

#### Section 3.3: Task Manager Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 3.3.1 | Task manager container | `components/desktop/apps/taskmanager/taskmanager-app.tsx` | 4h | Medium |
| 3.3.2 | Process list | `components/desktop/apps/taskmanager/process-list.tsx` | 6h | Medium |
| 3.3.3 | Performance tab | `components/desktop/apps/taskmanager/performance-chart.tsx` | 6h | Medium |
| 3.3.4 | Network tab | `components/desktop/apps/taskmanager/network-tab.tsx` | 4h | Medium |
| 3.3.5 | History tab | `components/desktop/apps/taskmanager/history-tab.tsx` | 4h | Medium |

#### Section 3.4: AgentFS Viewer Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 3.4.1 | AgentFS app container | `components/desktop/apps/agentfs/agentfs-app.tsx` | 4h | Medium |
| 3.4.2 | Workspace list | `components/desktop/apps/agentfs/workspace-list.tsx` | 4h | Medium |
| 3.4.3 | Call timeline | `components/desktop/apps/agentfs/call-timeline.tsx` | 6h | Medium |
| 3.4.4 | File audit panel | `components/desktop/apps/agentfs/file-audit.tsx` | 6h | Medium |
| 3.4.5 | Checkpoint browser | `components/desktop/apps/agentfs/checkpoint-browser.tsx` | 6h | Medium |
| 3.4.6 | KV viewer | `components/desktop/apps/agentfs/kv-viewer.tsx` | 4h | Medium |

---

### Phase 4: Knowledge & Integration (ALF-416)

#### Section 4.1: Knowledge Graph Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 4.1.1 | Knowledge app container | `components/desktop/apps/knowledge/knowledge-app.tsx` | 4h | Medium |
| 4.1.2 | Force-directed graph canvas | `components/desktop/apps/knowledge/graph-canvas.tsx` | 12h | Medium |
| 4.1.3 | Entity detail panel | `components/desktop/apps/knowledge/entity-panel.tsx` | 6h | Medium |
| 4.1.4 | Fact list component | `components/desktop/apps/knowledge/fact-list.tsx` | 4h | Medium |
| 4.1.5 | Relation list component | `components/desktop/apps/knowledge/relation-list.tsx` | 4h | Medium |
| 4.1.6 | Semantic search bar | `components/desktop/apps/knowledge/search-bar.tsx` | 6h | Medium |
| 4.1.7 | Time slider | `components/desktop/apps/knowledge/time-slider.tsx` | 6h | Medium |
| 4.1.8 | Knowledge graph hook | `hooks/use-knowledge-graph.ts` | 8h | Medium |

#### Section 4.2: Linear Integration Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 4.2.1 | Linear app container | `components/desktop/apps/linear/linear-app.tsx` | 4h | Medium |
| 4.2.2 | Issue list with filters | `components/desktop/apps/linear/issue-list.tsx` | 6h | Medium |
| 4.2.3 | Issue detail panel | `components/desktop/apps/linear/issue-detail.tsx` | 6h | Medium |
| 4.2.4 | Project board view | `components/desktop/apps/linear/project-board.tsx` | 8h | Medium |

#### Section 4.3: File Browser Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 4.3.1 | Files app container | `components/desktop/apps/files/files-app.tsx` | 4h | Medium |
| 4.3.2 | Tree sidebar | `components/desktop/apps/files/tree-sidebar.tsx` | 6h | Medium |
| 4.3.3 | File grid/list view | `components/desktop/apps/files/file-grid.tsx` | 6h | Medium |
| 4.3.4 | Breadcrumb navigation | `components/desktop/apps/files/breadcrumbs.tsx` | 3h | Medium |
| 4.3.5 | Quick Look preview | `components/desktop/apps/files/quick-look.tsx` | 6h | Medium |

#### Section 4.4: Workflow Builder Application

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 4.4.1 | Workflow app container | `components/desktop/apps/workflow/workflow-app.tsx` | 4h | Medium |
| 4.4.2 | Node canvas (ReactFlow) | `components/desktop/apps/workflow/node-canvas.tsx` | 10h | Medium |
| 4.4.3 | Node palette sidebar | `components/desktop/apps/workflow/node-palette.tsx` | 6h | Medium |
| 4.4.4 | Execution panel | `components/desktop/apps/workflow/execution-panel.tsx` | 6h | Medium |
| 4.4.5 | Variable inspector | `components/desktop/apps/workflow/variable-inspector.tsx` | 4h | Medium |

---

### Phase 5: Orb & Voice (ALF-417)

#### Section 5.1: Orb Component System

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 5.1.1 | Orb presence container | `components/desktop/orb/orb.tsx` | 8h | Medium |
| 5.1.2 | State animations (5 states) | `components/desktop/orb/animations.ts` | 12h | Medium |
| 5.1.3 | Docked mode rendering | `components/desktop/orb/docked.tsx` | 4h | Medium |
| 5.1.4 | Floating mode with drag | `components/desktop/orb/floating.tsx` | 6h | Medium |
| 5.1.5 | Expanded voice overlay | `components/desktop/orb/expanded.tsx` | 8h | Medium |
| 5.1.6 | Quick actions menu | `components/desktop/orb/quick-actions.tsx` | 4h | Medium |
| 5.1.7 | Orb store | `store/orb.ts` | 4h | Medium |

#### Section 5.2: Voice Enhancement

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 5.2.1 | Voice session store | `store/voice.ts` | 6h | Medium |
| 5.2.2 | Audio device selection | `hooks/use-audio-devices.ts` | 4h | Medium |
| 5.2.3 | Waveform visualization | `components/ui/alfred/waveform.tsx` | 6h | Medium |
| 5.2.4 | Voice settings panel | `components/desktop/apps/settings/voice-section.tsx` | 4h | Medium |

---

### Phase 6: Mindscape & Graphs (ALF-418)

#### Section 6.1: Mindscape Canvas

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 6.1.1 | Mindscape ReactFlow canvas | `components/graphs/mindscape/canvas.tsx` | 8h | Medium |
| 6.1.2 | Entity node component | `components/graphs/mindscape/entity-node.tsx` | 4h | Medium |
| 6.1.3 | Relation edge component | `components/graphs/mindscape/relation-edge.tsx` | 4h | Medium |
| 6.1.4 | Mindscape store integration | `store/mindscape/index.ts` | 6h | Medium |
| 6.1.5 | Mode toggle animation | `components/desktop/layers/mode-transition.tsx` | 8h | Medium |
| 6.1.6 | Mindscape layer wrapper | `components/desktop/layers/mindscape.tsx` | 6h | Medium |

#### Section 6.2: Knowledge Graph Components

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 6.2.1 | Knowledge graph canvas | `components/graphs/knowledge/graph-canvas.tsx` | 6h | Medium |
| 6.2.2 | Entity node types (6 types) | `components/graphs/knowledge/entity-node.tsx` | 6h | Medium |
| 6.2.3 | Fact edge component | `components/graphs/knowledge/fact-edge.tsx` | 4h | Medium |
| 6.2.4 | Integration with Knowledge app | `components/desktop/apps/knowledge/` | 4h | Medium |

#### Section 6.3: Workflow Graph Components

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 6.3.1 | Workflow DAG canvas | `components/graphs/workflow/node-canvas.tsx` | 6h | Medium |
| 6.3.2 | Action node component | `components/graphs/workflow/action-node.tsx` | 4h | Medium |
| 6.3.3 | Condition node component | `components/graphs/workflow/condition-node.tsx` | 4h | Medium |
| 6.3.4 | Flow edge component | `components/graphs/workflow/flow-edge.tsx` | 3h | Medium |
| 6.3.5 | Integration with Workflow app | `components/desktop/apps/workflow/` | 4h | Medium |

#### Section 6.4: Agent Spawn Tree

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 6.4.1 | Spawn tree canvas | `components/graphs/agents/spawn-tree.tsx` | 6h | Medium |
| 6.4.2 | Agent node component | `components/graphs/agents/agent-node.tsx` | 4h | Medium |
| 6.4.3 | Dependency edge component | `components/graphs/agents/dependency-edge.tsx` | 3h | Medium |
| 6.4.4 | Integration with Agents app | `components/desktop/apps/agents/` | 4h | Medium |

#### Section 6.5: Desktop-Mindscape Bridge

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 6.5.1 | Window-to-node projection | `lib/desktop/window-projection.ts` | 8h | Medium |
| 6.5.2 | Desktop icon as concept node | `lib/desktop/icon-node-bridge.ts` | 6h | Medium |
| 6.5.3 | Note-to-concept extraction | `lib/knowledge/note-extraction.ts` | 6h | Medium |
| 6.5.4 | Conversation knowledge spawn | `lib/knowledge/conversation-extraction.ts` | 6h | Medium |

---

### Phase 7: Polish & Accessibility (ALF-419)

#### Section 7.1: Accessibility

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 7.1.1 | Keyboard navigation audit | Multiple | 8h | Low |
| 7.1.2 | Screen reader compatibility | Multiple | 12h | Low |
| 7.1.3 | Focus management system | `lib/accessibility/focus.ts` | 8h | Low |
| 7.1.4 | ARIA labels and roles | Multiple | 8h | Low |
| 7.1.5 | High contrast mode | `styles/high-contrast.css` | 6h | Low |

#### Section 7.2: Performance

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 7.2.1 | Window virtualization | `lib/desktop/virtualization.ts` | 8h | Low |
| 7.2.2 | Lazy loading app bundles | `components/desktop/apps/lazy.ts` | 6h | Low |
| 7.2.3 | State selector optimization | `store/desktop/selectors.ts` | 6h | Low |
| 7.2.4 | Animation performance | Multiple | 8h | Low |
| 7.2.5 | Bundle size audit | Build config | 4h | Low |

#### Section 7.3: Final Polish

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 7.3.1 | Notification center | `components/desktop/notification-center.tsx` | 8h | Low |
| 7.3.2 | Context lens hover | `components/desktop/context-lens.tsx` | 8h | Low |
| 7.3.3 | Workflow trails animation | `components/desktop/workflow-trails.tsx` | 8h | Low |
| 7.3.4 | Living desktop wallpaper | `components/desktop/living-wallpaper.tsx` | 8h | Low |
| 7.3.5 | Time capsule snapshots | `lib/desktop/time-capsule.ts` | 6h | Low |
| 7.3.6 | Focus mode | `components/desktop/focus-mode.tsx` | 6h | Low |

---

### Phase 8: Intelligence Apps (ALF-420)

#### Section 8.1: Cortex Visualizer

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.1.1 | Cortex app container | `components/desktop/apps/cortex/cortex-app.tsx` | 4h | Low |
| 8.1.2 | WebGPU shader preview | `components/desktop/apps/cortex/shader-preview.tsx` | 12h | Low |
| 8.1.3 | Parameter tuner sliders | `components/desktop/apps/cortex/parameter-tuner.tsx` | 6h | Low |
| 8.1.4 | Preset browser | `components/desktop/apps/cortex/preset-browser.tsx` | 4h | Low |
| 8.1.5 | GPU monitor panel | `components/desktop/apps/cortex/gpu-monitor.tsx` | 6h | Low |
| 8.1.6 | Cortex store | `store/cortex.ts` | 6h | Low |
| 8.1.7 | WebGPU engine hook | `hooks/use-cortex-engine.ts` | 8h | Low |

#### Section 8.2: Learning Dashboard

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.2.1 | Learning app container | `components/desktop/apps/learning/learning-app.tsx` | 4h | Low |
| 8.2.2 | Mistake ledger list | `components/desktop/apps/learning/mistake-ledger.tsx` | 6h | Low |
| 8.2.3 | Correction timeline | `components/desktop/apps/learning/correction-timeline.tsx` | 6h | Low |
| 8.2.4 | Accuracy charts | `components/desktop/apps/learning/accuracy-chart.tsx` | 6h | Low |
| 8.2.5 | Improvement insights | `components/desktop/apps/learning/improvement-insights.tsx` | 4h | Low |
| 8.2.6 | Learning store | `store/learning.ts` | 6h | Low |

#### Section 8.3: Policy Viewer

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.3.1 | Policy app container | `components/desktop/apps/policy/policy-app.tsx` | 4h | Low |
| 8.3.2 | Decision log viewer | `components/desktop/apps/policy/decision-log.tsx` | 6h | Low |
| 8.3.3 | Constraint list | `components/desktop/apps/policy/constraint-list.tsx` | 4h | Low |
| 8.3.4 | Autonomy controls | `components/desktop/apps/policy/autonomy-controls.tsx` | 6h | Low |
| 8.3.5 | Rule editor | `components/desktop/apps/policy/rule-editor.tsx` | 8h | Low |
| 8.3.6 | Policy store | `store/policy.ts` | 6h | Low |

#### Section 8.4: Tune Manager

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.4.1 | Tune app container | `components/desktop/apps/tune/tune-app.tsx` | 4h | Low |
| 8.4.2 | Job list with status | `components/desktop/apps/tune/job-list.tsx` | 6h | Low |
| 8.4.3 | Training progress charts | `components/desktop/apps/tune/training-progress.tsx` | 8h | Low |
| 8.4.4 | Dataset browser | `components/desktop/apps/tune/dataset-browser.tsx` | 6h | Low |
| 8.4.5 | Hyperparameter editor | `components/desktop/apps/tune/hyperparameter-editor.tsx` | 6h | Low |
| 8.4.6 | Model comparison | `components/desktop/apps/tune/model-comparison.tsx` | 6h | Low |
| 8.4.7 | Tune store | `store/tune.ts` | 6h | Low |

#### Section 8.5: Plan Editor

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.5.1 | Plan app container | `components/desktop/apps/plan/plan-app.tsx` | 4h | Low |
| 8.5.2 | Visual plan canvas | `components/desktop/apps/plan/plan-canvas.tsx` | 10h | Low |
| 8.5.3 | Intent debugger | `components/desktop/apps/plan/intent-debugger.tsx` | 6h | Low |
| 8.5.4 | Research panel | `components/desktop/apps/plan/research-panel.tsx` | 6h | Low |
| 8.5.5 | Pattern library browser | `components/desktop/apps/plan/pattern-library.tsx` | 4h | Low |
| 8.5.6 | Evaluation metrics | `components/desktop/apps/plan/evaluation-metrics.tsx` | 4h | Low |
| 8.5.7 | Plan store | `store/plan.ts` | 6h | Low |

#### Section 8.6: Metrics Dashboard

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.6.1 | Metrics app container | `components/desktop/apps/metrics/metrics-app.tsx` | 4h | Low |
| 8.6.2 | Metric explorer | `components/desktop/apps/metrics/metric-explorer.tsx` | 6h | Low |
| 8.6.3 | Dashboard builder | `components/desktop/apps/metrics/dashboard-builder.tsx` | 10h | Low |
| 8.6.4 | Alert configuration | `components/desktop/apps/metrics/alert-config.tsx` | 6h | Low |
| 8.6.5 | PromQL query editor | `components/desktop/apps/metrics/query-editor.tsx` | 8h | Low |
| 8.6.6 | Chart panel component | `components/desktop/apps/metrics/chart-panel.tsx` | 6h | Low |
| 8.6.7 | Metrics store | `store/metrics.ts` | 6h | Low |

#### Section 8.7: RAG Explorer

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.7.1 | RAG app container | `components/desktop/apps/rag/rag-app.tsx` | 4h | Low |
| 8.7.2 | Chunk browser | `components/desktop/apps/rag/chunk-browser.tsx` | 6h | Low |
| 8.7.3 | Embedding visualizer | `components/desktop/apps/rag/embedding-visualizer.tsx` | 12h | Low |
| 8.7.4 | Retrieval debugger | `components/desktop/apps/rag/retrieval-debugger.tsx` | 6h | Low |
| 8.7.5 | Rerank tuner | `components/desktop/apps/rag/rerank-tuner.tsx` | 4h | Low |
| 8.7.6 | Similarity explorer | `components/desktop/apps/rag/similarity-explorer.tsx` | 6h | Low |
| 8.7.7 | RAG store | `store/rag.ts` | 6h | Low |

#### Section 8.8: Enhanced Existing Apps

| Task | Title | File(s) | Hours | Priority |
|------|-------|---------|-------|----------|
| 8.8.1 | Chat: History budget panel | `components/desktop/apps/chat/history-budget.tsx` | 4h | Low |
| 8.8.2 | Chat: RAG context display | `components/desktop/apps/chat/rag-context.tsx` | 4h | Low |
| 8.8.3 | Settings: Session management | `components/desktop/apps/settings/sessions-section.tsx` | 6h | Low |
| 8.8.4 | Settings: Token management | `components/desktop/apps/settings/tokens-section.tsx` | 4h | Low |
| 8.8.5 | Settings: Policy preferences | `components/desktop/apps/settings/policy-section.tsx` | 4h | Low |
| 8.8.6 | Terminal: TUI mode toggle | `components/desktop/apps/terminal/tui-mode.tsx` | 4h | Low |
| 8.8.7 | Code: Semantic search | `components/desktop/apps/code/semantic-search.tsx` | 6h | Low |
| 8.8.8 | History store | `store/history.ts` | 4h | Low |
| 8.8.9 | Auth store | `store/auth.ts` | 4h | Low |

---

## Subagent Instructions

### Creation Workflow

1. **Create tickets in phase order** (Phase 0 first, then 1, etc.)
2. **Set parent to corresponding Epic** using the ALF-XXX IDs above
3. **Use priority mapping:**
   - Phase 0: Urgent (1)
   - Phase 1-2: High (2)
   - Phase 3-6: Medium (3)
   - Phase 7-8: Low (4)

### Linear API Call Pattern

```typescript
// For each task, call:
createIssue({
  title: "[X.Y.Z] Task Title",
  description: "...", // Use template above
  team: "Alfred-ops",
  parentId: "ALF-XXX", // Epic ID
  priority: N, // 1-4
  labels: ["desktop-evolution", "phase-X"],
  estimate: N // hours
})
```

### Labels to Create

- `desktop-evolution` — All tickets
- `phase-0` through `phase-8` — Phase grouping
- `type-migration` — Phase 0 specific
- `reactflow-isolation` — Phase 0, 6 specific
- `ui-component` — Most tasks
- `store` — State management tasks
- `hook` — React hook tasks

---

## Summary

| Item | Count |
|------|-------|
| Epics | 9 |
| Sections | 40 |
| Tasks | 237 |
| Total Hours | 1,285h |
