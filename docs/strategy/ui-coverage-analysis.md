# UI Coverage Analysis - What We've Covered vs What's Missing

**Date:** 2025-01-27  
**Status:** Comprehensive Analysis  
**Purpose:** Identify gaps between personal assistant UI and orchestrator UI patterns

---

## What We've Covered ✅

### Personal Assistant UI (Complete)

**Patterns:**
- ✅ Voice-first interaction (orb avatar, voice input/output)
- ✅ Progressive disclosure (cards appear on demand)
- ✅ Window management (draggable, resizable windows)
- ✅ Emotional expression (orb states, personality)
- ✅ Command palette (keyboard fallback)
- ✅ Component registry + generative factory
- ✅ State management (Zustand store)
- ✅ Single-page architecture (no traditional routing)

**Components:**
- ✅ OrbAvatar (emotional states)
- ✅ VoiceInteraction (voice input/output)
- ✅ ProgressiveDisclosure (cards, overlays, windows)
- ✅ ContextBar (minimal status bar)
- ✅ CommandPalette (keyboard fallback)

**Use Cases:**
- ✅ Notes (create, view, edit, delete)
- ✅ Reminders (create, view, dismiss)
- ✅ Timers (start, stop, view)
- ✅ Bookmarks (create, view, delete)
- ✅ Voice conversations

---

## What We Haven't Covered ❌

### Orchestrator UI (Missing)

**Critical Missing Patterns:**

#### 1. Streaming Output Visualization ❌
- **Problem:** Codex, Docker, Droid stream stdout/stderr in real-time
- **Current:** No streaming terminal component
- **Needed:** `StreamingTerminal` component with:
  - Real-time log streaming
  - stdout/stderr color coding
  - Auto-scroll toggle
  - Log filtering/search
  - Export functionality

#### 2. Long-Running Operation Progress ❌
- **Problem:** Operations take minutes to hours (Docker builds, Proxmox VM creation)
- **Current:** No progress tracking UI
- **Needed:** `ProgressWindow` component with:
  - Progress bars with time estimates
  - Current step indicators
  - Background mode
  - Cancel controls
  - Completion notifications

#### 3. Resource Monitoring ❌
- **Problem:** Docker containers and Proxmox VMs have resource usage
- **Current:** No resource visualization
- **Needed:** `ResourceMonitor` component with:
  - Real-time CPU/memory/network graphs
  - Status dashboards
  - Health indicators
  - Quick actions (logs, restart, stop)

#### 4. Task Tracking ❌
- **Problem:** Proxmox operations return UPID that need tracking
- **Current:** UPID returned but not tracked in UI
- **Needed:** `TaskTracker` component with:
  - Task status polling
  - Progress indication
  - Wait for completion option
  - Task logs

#### 5. Interactive Terminals ❌
- **Problem:** Codex execution needs terminal-like interface
- **Current:** No interactive terminal component
- **Needed:** `InteractiveTerminal` component with:
  - Command input
  - Output streaming
  - Command history
  - Copy/paste support

#### 6. Error Visualization ❌
- **Problem:** When operations fail, users need detailed error info
- **Current:** Basic error display only
- **Needed:** `ErrorPanel` component with:
  - Stack trace viewer
  - Error context (inputs, outputs)
  - Retry controls
  - Fix suggestions

#### 7. Workflow Timeline Visualization ❌
- **Problem:** Workflows are multi-step with dependencies
- **Current:** Basic plan/task display, no timeline
- **Needed:** `WorkflowTimeline` component with:
  - Phase visualization (Scan → Plan → Act → Report)
  - Task dependency graph
  - Progress per phase/task
  - Expandable task details

#### 8. Artifact Management ❌
- **Problem:** Codex produces artifacts (files), Docker produces images
- **Current:** No artifact browser
- **Needed:** `ArtifactBrowser` component with:
  - Artifact list with metadata
  - Preview (text files)
  - Download functionality
  - Open in editor

---

## Detailed Gap Analysis

### Codex Execution UI

**Current State:**
- Tool executes, returns result after completion
- No streaming output shown
- No progress indication
- No artifact browser

**Needed:**
1. **StreamingTerminal** - Show stdout/stderr in real-time
2. **ProgressWindow** - Show progress for long-running executions
3. **InteractiveTerminal** - Allow command input (if interactive mode)
4. **ArtifactBrowser** - Show artifacts produced
5. **ErrorPanel** - Show detailed errors if execution fails

**Example Flow:**
```
User: "Run codex exec 'deploy to staging'"
↓
ALFRED: Creates StreamingTerminal window
↓
Real-time output streams: stdout/stderr appear as they're generated
↓
ProgressWindow shows: "Building Docker image... 60%"
↓
On completion: ArtifactBrowser shows produced files
↓
If error: ErrorPanel shows detailed error info
```

---

### Docker Management UI

**Current State:**
- Basic tool execution
- No container status dashboard
- No resource monitoring
- No log streaming

**Needed:**
1. **ResourceMonitor** - Show all containers with status, CPU, memory, network
2. **StreamingTerminal** - Show build output, container logs
3. **ProgressWindow** - Show build progress
4. **ErrorPanel** - Show build/deployment errors

**Example Flow:**
```
User: "Show me my Docker containers"
↓
ALFRED: Creates ResourceMonitor window
↓
Shows: Container list with real-time CPU/memory graphs
↓
User: "Build app:latest"
↓
ALFRED: Creates ProgressWindow + StreamingTerminal
↓
Shows: Build progress + streaming output
↓
On completion: Container appears in ResourceMonitor
```

---

### Proxmox Management UI

**Current State:**
- Tool executes, returns UPID
- No task tracking UI
- No VM/LXC status dashboard
- No resource monitoring

**Needed:**
1. **TaskTracker** - Track UPID, show progress
2. **ResourceMonitor** - Show VM/LXC status, resource usage
3. **ProgressWindow** - Show operation progress (create, snapshot)
4. **ErrorPanel** - Show Proxmox API errors

**Example Flow:**
```
User: "Create a new LXC container"
↓
ALFRED: Creates TaskTracker window (tracks UPID)
↓
Shows: "Creating LXC container... 60%"
↓
On completion: Container appears in ResourceMonitor
↓
User: "Show me all VMs"
↓
ALFRED: Creates ResourceMonitor window
↓
Shows: VM list with status, CPU, memory, power state
```

---

### Workflow Execution UI

**Current State:**
- Basic plan/task visualization exists (`Plan`, `Task` components)
- No timeline view
- No phase visualization
- No task dependency graph

**Needed:**
1. **WorkflowTimeline** - Show execution timeline with phases
2. **StreamingTerminal** - Show workflow output (stdout/stderr from tools)
3. **ProgressWindow** - Show overall workflow progress
4. **ErrorPanel** - Show workflow step failures

**Example Flow:**
```
User: "Deploy to production"
↓
ALFRED: Creates WorkflowTimeline window
↓
Shows: Phase 1 (Scan) → Phase 2 (Plan) → Phase 3 (Act) → Phase 4 (Report)
↓
Real-time: Tasks complete, progress updates
↓
StreamingTerminal: Shows tool output from each step
↓
On error: ErrorPanel shows which step failed and why
```

---

## Integration with Generative UI

### How Orchestrator Patterns Fit

**Window Types:**
- **StreamingTerminal:** `window` type (draggable, resizable, persistent)
- **ProgressWindow:** `overlay` type (non-intrusive, auto-dismisses on completion)
- **ResourceMonitor:** `window` type (persistent, session lifecycle)
- **TaskTracker:** `overlay` type (ephemeral, auto-dismisses on completion)
- **WorkflowTimeline:** `window` type (persistent, session lifecycle)
- **InteractiveTerminal:** `window` type (persistent, user-controlled)
- **ErrorPanel:** `modal` type (requires interaction)
- **ArtifactBrowser:** `window` type (persistent, user-controlled)

**Progressive Disclosure:**
- Operations start as **overlays** (non-intrusive progress)
- User can **expand** to full window (detailed view)
- **Background mode** minimizes to notification
- **Completion** triggers notification card

**Voice Integration:**
- ALFRED narrates progress: "Building Docker image... 60% complete"
- Voice commands: "show me the logs", "cancel the build", "minimize that window"
- Proactive: "Your Docker build completed successfully"

**Component Generation:**
- Pre-built components for common cases (DockerStatusCard, ProxmoxVMStatusCard)
- Generative components for novel tool outputs
- Fallback to structured data display

---

## Implementation Priority

### Phase 1: Core Streaming (Week 1) 🔥 CRITICAL
1. **StreamingTerminal** component
2. Real-time output streaming (WebSocket/SSE integration)
3. Log filtering/search

**Why First:** All orchestrator tools stream output. Without this, users can't see what's happening.

### Phase 2: Progress Tracking (Week 2)
1. **ProgressWindow** component
2. Progress event parsing (from tool output)
3. Time estimation

**Why Second:** Long-running operations need progress feedback.

### Phase 3: Resource Monitoring (Week 3)
1. **ResourceMonitor** component
2. Resource polling (Docker, Proxmox APIs)
3. Real-time graphs (CPU, memory, network)

**Why Third:** Users need to monitor infrastructure state.

### Phase 4: Workflow Visualization (Week 4)
1. **WorkflowTimeline** component
2. Task dependency graph
3. Phase progress tracking

**Why Fourth:** Workflows are complex, need visual representation.

### Phase 5: Error & Artifacts (Week 5)
1. **ErrorPanel** component
2. **ArtifactBrowser** component
3. Error context capture

**Why Fifth:** Errors and artifacts are important but less frequent.

---

## Component Registry Expansion

### Pre-Built Components Needed

```typescript
const orchestratorComponentRegistry = {
  // Streaming
  "streaming-terminal": StreamingTerminal,
  "interactive-terminal": InteractiveTerminal,
  
  // Progress
  "progress-window": ProgressWindow,
  "task-tracker": TaskTracker,
  
  // Monitoring
  "resource-monitor": ResourceMonitor,
  "docker-status": DockerStatusCard,
  "proxmox-vm-status": ProxmoxVMStatusCard,
  "proxmox-lxc-status": ProxmoxLXCStatusCard,
  
  // Workflow
  "workflow-timeline": WorkflowTimeline,
  "workflow-phase": WorkflowPhaseCard,
  "workflow-task": WorkflowTaskCard,
  
  // Error & Artifacts
  "error-panel": ErrorPanel,
  "artifact-browser": ArtifactBrowser,
  
  // Git
  "git-status": GitStatusCard,
  "git-log": GitLogCard,
  
  // Codex
  "codex-execution": CodexExecutionWindow,
  "codex-artifacts": CodexArtifactsBrowser,
};
```

---

## Design System Integration

### "Signal in the Void" Styling

All orchestrator components follow the same design system:

**Colors:**
- Void: `oklch(0.05 0 0)` (background)
- Biolum: `oklch(0.99 0 0)` (text, active states)
- Surface: `oklch(0.14 0 0)` (cards, windows)

**Styling:**
- HUD pattern: `bg-void-surface/40 backdrop-blur-xl border-white/10 rounded-3xl`
- Outer glow: `shadow-biolum/20` (no drop shadows)
- Typography: "Inter Tight", tight tracking

**Differences from Assistant UI:**
- More technical (monospace fonts for terminals)
- More data-dense (tables, graphs, lists)
- Less conversational (fewer voice interactions)
- More persistent (windows stay open longer)

---

## Success Metrics

### User Experience
- **Streaming Latency:** <100ms from tool output to UI display
- **Progress Accuracy:** ±5% progress estimation
- **Resource Update:** <5s refresh interval
- **Error Clarity:** User can diagnose 90%+ errors from UI

### Performance
- **Streaming Performance:** Handle 1000+ lines/second
- **Resource Polling:** <100ms per resource
- **Graph Rendering:** 60fps smooth updates

### Reliability
- **Stream Reliability:** 99.9% messages delivered
- **Progress Accuracy:** ±5% estimation error
- **Error Capture:** 100% errors have context

---

## Conclusion

**Coverage Status:**
- ✅ **Personal Assistant UI:** Complete (voice, cards, progressive disclosure)
- ❌ **Orchestrator UI:** Missing (streaming, progress, monitoring, terminals)

**Next Steps:**
1. Implement `StreamingTerminal` component (critical)
2. Implement `ProgressWindow` component
3. Implement `ResourceMonitor` component
4. Integrate with existing window management system
5. Add orchestrator components to component registry

**Key Insight:** Orchestrator UI requires **specialized technical components** that complement but differ from personal assistant UI. Both share the same window management and design system, but orchestrator UI is more data-dense and persistent.

---

## References

- Generative UI Architecture: `docs/strategy/generative-ui-architecture.md`
- Orchestrator UI Patterns: `docs/strategy/orchestrator-ui-patterns.md`
- Design System: `docs/design-system.md`
- Current Components: `apps/web/src/components/`

