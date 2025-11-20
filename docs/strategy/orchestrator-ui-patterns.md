# Orchestrator UI Patterns - Technical Operations

**Date:** 2025-01-27  
**Status:** Missing Patterns Analysis  
**Context:** Codex, Docker, Proxmox, Git, Workflow execution interfaces

---

## Executive Summary

We've focused heavily on **personal assistant UI** (notes, reminders, voice), but ALFRED's **orchestrator capabilities** require fundamentally different UI patterns:

1. **Streaming Output** - Real-time logs, stdout, stderr
2. **Long-Running Operations** - Progress tracking for builds, deployments, VM creation
3. **Resource Monitoring** - CPU, memory, network visualization
4. **Task Tracking** - UPID (Proxmox), container IDs, workflow phases
5. **Interactive Terminals** - Codex execution, Docker exec
6. **Error Visualization** - Stack traces, error details, debugging
7. **Timeline Visualization** - Workflow execution timeline
8. **Multi-Step Progress** - Workflow phases, task dependencies

---

## What We Haven't Covered

### 1. Streaming Output Visualization

**Problem:** Codex, Docker, and Droid tools stream stdout/stderr in real-time. Current UI doesn't show this.

**Capabilities:**
- **Codex:** Streams stdout/stderr, reasoning traces, artifacts
- **Docker:** Streams build output, container logs (follow mode)
- **Droid:** Streams search results, code analysis output

**Missing UI Patterns:**
- Real-time log streaming window
- Terminal-like output display
- Stderr vs stdout differentiation
- Scroll-to-bottom auto-scroll
- Log filtering/search
- Export logs functionality

---

### 2. Long-Running Operation Progress

**Problem:** Operations can take minutes to hours (Docker builds, Proxmox VM creation, Codex execution).

**Capabilities:**
- **Docker Build:** Can take 15+ minutes, streams output
- **Proxmox LXC Create:** Returns UPID, takes minutes
- **Codex Exec:** Can take up to 2 hours (timeout), streams output
- **Workflow Execution:** Multi-step, can take 30+ minutes

**Missing UI Patterns:**
- Progress bars with time estimates
- Operation status windows (persistent, non-intrusive)
- Cancellation controls
- Background operation notifications
- Operation history/queue

---

### 3. Resource Monitoring & Visualization

**Problem:** Docker containers and Proxmox VMs have resource usage (CPU, memory, network) that needs visualization.

**Capabilities:**
- **Docker:** Container status, port mapping, resource usage
- **Proxmox:** VM/LXC status, resource allocation, power state
- **Workflows:** Execution metrics, performance budgets

**Missing UI Patterns:**
- Real-time resource graphs (CPU, memory, network)
- Status dashboards (multiple containers/VMs)
- Health indicators
- Resource alerts
- Historical metrics

---

### 4. Task Tracking & Status

**Problem:** Proxmox operations return UPID (unique task IDs) that need tracking. Docker operations return container IDs.

**Capabilities:**
- **Proxmox:** `task_wait` operation tracks UPID completion
- **Docker:** Container lifecycle tracking
- **Workflows:** Multi-step task tracking

**Missing UI Patterns:**
- Task status windows
- Task queue visualization
- Task dependency graphs
- Task completion notifications
- Task history

---

### 5. Interactive Terminals

**Problem:** Codex execution needs terminal-like interface. Docker exec needs interactive shell.

**Capabilities:**
- **Codex:** Executes commands, streams output, can be interactive
- **Docker:** `exec` operation for interactive container access

**Missing UI Patterns:**
- Terminal window component
- Command input
- Output streaming
- Terminal history
- Copy/paste support

---

### 6. Error Visualization & Debugging

**Problem:** When operations fail, users need detailed error information for debugging.

**Capabilities:**
- **Codex:** Exit codes, error messages, truncated output
- **Docker:** Build failures, container errors, health probe failures
- **Proxmox:** API errors, task failures
- **Workflows:** Step failures, rollback information

**Missing UI Patterns:**
- Error detail panels
- Stack trace viewers
- Error context (what was running, inputs)
- Retry controls
- Error history

---

### 7. Workflow Execution Visualization

**Problem:** Workflows are multi-step with dependencies. Current UI shows basic plan/task, but not execution flow.

**Capabilities:**
- **Workflows:** Plan → Scan → Act → Report phases
- **Tasks:** Dependencies, parallel execution
- **Tools:** Chained execution, output passing

**Missing UI Patterns:**
- Workflow timeline visualization
- Task dependency graph
- Phase progress indicators
- Parallel execution visualization
- Workflow state machine visualization

---

### 8. Artifact Management

**Problem:** Codex produces artifacts (files), Docker produces images, workflows produce outputs.

**Capabilities:**
- **Codex:** Artifacts array with paths and kinds
- **Docker:** Images, containers
- **Workflows:** Output data, state snapshots

**Missing UI Patterns:**
- Artifact browser
- Artifact preview
- Artifact download
- Artifact relationships

---

## Detailed UI Patterns Needed

### Pattern 1: Streaming Terminal Window

**Use Cases:** Codex execution, Docker logs, Droid output

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Codex Execution                                    [─] [□] [×]        ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  $ codex exec "deploy to staging"                              │  ║
║  │                                                                │  ║
║  │  [stdout] Building Docker image...                            │  ║
║  │  [stdout] Step 1/10 : FROM node:20                            │  ║
║  │  [stdout] Step 2/10 : WORKDIR /app                            │  ║
║  │  [stdout] Step 3/10 : COPY package.json .                     │  ║
║  │  [stderr] WARNING: Using buildkit cache                       │  ║
║  │  [stdout] Step 4/10 : RUN npm install                         │  ║
║  │  [stdout] ...                                                  │  ║
║  │                                                                │  ║
║  │  [Auto-scroll: ON] [Filter: All] [Export] [Clear]            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Status: Running | Elapsed: 2m 34s | [Cancel]                      ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Real-time streaming (append-only)
- Color coding (stdout vs stderr)
- Auto-scroll toggle
- Filter/search logs
- Export functionality
- Cancel button (for long-running operations)

---

### Pattern 2: Long-Running Operation Window

**Use Cases:** Docker builds, Proxmox VM creation, Codex execution

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Docker Build: app:latest                        [─] [□] [×]          ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Building Docker image...                                      │  ║
║  │                                                                │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │  Progress: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░ 60%        │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │  Estimated time remaining: 4m 12s                              │  ║
║  │  Elapsed: 6m 28s                                              │  ║
║  │                                                                │  ║
║  │  Current step: Step 6/10 - RUN npm run build                  │  ║
║  │                                                                │  ║
║  │  [View Logs] [Cancel Build] [Minimize]                       │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Status: Running | Started: 14:32 | [Background]                    ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Progress bar with percentage
- Time estimates (elapsed, remaining)
- Current step indicator
- Background mode (minimize, continue in background)
- Cancel controls
- Notification when complete

---

### Pattern 3: Resource Monitoring Dashboard

**Use Cases:** Docker containers, Proxmox VMs

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Docker Containers                              [─] [□] [×]            ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Container  Status  CPU   Memory  Network  Ports             │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ app-1      ● Run   45%   2.1GB   12MB/s  3000→3000     │  │  ║
║  │  │            [CPU: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░]                │  │  ║
║  │  │            [Mem: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]                │  │  ║
║  │  │            [Logs] [Restart] [Stop] [Exec]               │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ app-2      ● Run   12%   512MB   3MB/s   3001→3000     │  │  ║
║  │  │            [CPU: ▓▓▓▓░░░░░░░░░░░░░░░░]                │  │  ║
║  │  │            [Mem: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░]                │  │  ║
║  │  │            [Logs] [Restart] [Stop] [Exec]               │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │  [Refresh] [Auto-refresh: ON] [Export Metrics]                │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Last updated: 14:32:15 | Refresh: 5s                               ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Real-time resource graphs (CPU, memory, network)
- Status indicators (running, stopped, error)
- Port mapping display
- Quick actions (logs, restart, stop, exec)
- Auto-refresh toggle
- Export metrics

---

### Pattern 4: Proxmox Task Tracking

**Use Cases:** VM creation, LXC operations, snapshots

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Proxmox Task: lxc_create (UPID: UPID:pve1:...)    [─] [□] [×]       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Creating LXC container: web-server (VMID: 101)               │  ║
║  │                                                                │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │  Progress: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 80%            │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │  Current step: Downloading template...                        │  ║
║  │  Elapsed: 3m 12s | Estimated: 4m 00s                         │  ║
║  │                                                                │  ║
║  │  [View Task Logs] [Cancel] [Minimize]                        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Status: Running | Node: pve1 | [Wait for completion]             ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- UPID tracking (unique task identifier)
- Progress indication
- Current step display
- Task logs
- Wait for completion option
- Cancel operation

---

### Pattern 5: Workflow Execution Timeline

**Use Cases:** Multi-step workflow visualization

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Workflow: Deploy to Production                    [─] [□] [×]         ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Execution Timeline                                           │  ║
║  │                                                                │  ║
║  │  Phase 1: Scan          [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] ✓ Complete     │  ║
║  │    ├─ Task 1.1: Analyze codebase          [2s] ✓             │  ║
║  │    └─ Task 1.2: Check dependencies        [1s] ✓             │  ║
║  │                                                                │  ║
║  │  Phase 2: Plan          [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] ✓ Complete     │  ║
║  │    ├─ Task 2.1: Generate deployment plan  [3s] ✓             │  ║
║  │    └─ Task 2.2: Validate plan              [1s] ✓             │  ║
║  │                                                                │  ║
║  │  Phase 3: Act           [▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░] ⏳ Running     │  ║
║  │    ├─ Task 3.1: Build Docker image        [45s] ⏳            │  ║
║  │    ├─ Task 3.2: Run tests                 [ ] ⏸ Pending      │  ║
║  │    └─ Task 3.3: Deploy to Proxmox         [ ] ⏸ Pending      │  ║
║  │                                                                │  ║
║  │  Phase 4: Report        [░░░░░░░░░░░░░░░░░░░░] ⏸ Pending      │  ║
║  │                                                                │  ║
║  │  [Expand Task 3.1] [View Logs] [Cancel] [Suspend]            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Status: Running | Elapsed: 51s | Progress: 60%                     ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Phase visualization (Scan → Plan → Act → Report)
- Task dependency graph
- Progress per phase/task
- Expandable task details
- Timeline view (horizontal)
- Suspend/resume controls

---

### Pattern 6: Interactive Terminal

**Use Cases:** Codex execution, Docker exec

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Codex Terminal: /path/to/project              [─] [□] [×]           ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  $ codex exec "run tests"                                      │  ║
║  │  > Running test suite...                                      │  ║
║  │  > ✓ test/api.test.ts                                        │  ║
║  │  > ✓ test/unit.test.ts                                       │  ║
║  │  > ✗ test/integration.test.ts                                 │  ║
║  │  >   Error: Connection timeout                                │  ║
║  │  >                                                            │  ║
║  │  $ [Type command...]  ← Command input                         │  ║
║  │                                                                │  ║
║  │  [Clear] [Export] [Copy Output] [History: ↑↓]                 │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Status: Interactive | CWD: /path/to/project                         ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Command input field
- Output streaming
- Command history (↑↓ navigation)
- Copy/paste support
- Export output
- Clear terminal

---

### Pattern 7: Error Visualization Panel

**Use Cases:** Failed operations, debugging

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Error: Docker Build Failed                          [─] [□] [×]     ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Build failed at Step 6/10: RUN npm install                   │  ║
║  │                                                                │  ║
║  │  Error: npm ERR! code ENOENT                                  │  ║
║  │         npm ERR! syscall open                                 │  ║
║  │         npm ERR! path /app/package.json                        │  ║
║  │         npm ERR! errno -2                                      │  ║
║  │         npm ERR! enoent ENOENT: no such file or directory     │  ║
║  │                                                                │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │  Context:                                                │  ║
║  │  │  - Dockerfile: Step 6                                    │  ║
║  │  │  - Working directory: /app                               │  ║
║  │  │  - Command: RUN npm install                              │  ║
║  │  │  - Exit code: 1                                          │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │  [View Full Logs] [Retry] [Fix Dockerfile] [Dismiss]        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Occurred: 14:32:15 | Operation: docker.build                      ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Error message display
- Stack trace viewer
- Context information (what was running, inputs)
- Retry controls
- Fix suggestions (if available)
- Link to full logs

---

### Pattern 8: Artifact Browser

**Use Cases:** Codex artifacts, deployment outputs

```
╔═══════════════════════════════════════════════════════════════════════╗
║  Codex Artifacts                                       [─] [□] [×]    ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Artifacts produced by execution:                            │  ║
║  │                                                                │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ 📄 Dockerfile                                           │  ║
║  │  │    Path: /project/Dockerfile                            │  ║
║  │  │    Size: 1.2 KB                                         │  ║
║  │  │    [View] [Download] [Copy Path]                        │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ 📄 docker-compose.yml                                   │  ║
║  │  │    Path: /project/docker-compose.yml                    │  ║
║  │  │    Size: 856 B                                          │  ║
║  │  │    [View] [Download] [Copy Path]                        │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │                                                                │  ║
║  │  [Download All] [Open in Editor]                             │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  Execution: codex.exec | Produced: 2 artifacts                      ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Artifact list with metadata
- Preview (for text files)
- Download individual/all
- Copy path
- Open in editor (if local)
- Artifact relationships

---

## Component Specifications

### 1. StreamingTerminal Component

```typescript
interface StreamingTerminalProps {
  title: string;
  output: Array<{
    type: "stdout" | "stderr" | "system";
    content: string;
    timestamp: Date;
  }>;
  autoScroll?: boolean;
  onCancel?: () => void;
  onExport?: () => void;
  onClear?: () => void;
  status?: "running" | "completed" | "error" | "cancelled";
  elapsed?: number; // seconds
}
```

**Features:**
- Real-time output streaming
- Color coding (stdout=white, stderr=red, system=yellow)
- Auto-scroll toggle
- Filter by type
- Search logs
- Export to file
- Copy output

---

### 2. ProgressWindow Component

```typescript
interface ProgressWindowProps {
  title: string;
  operation: string;
  progress: number; // 0-100
  currentStep?: string;
  elapsed: number; // seconds
  estimated?: number; // seconds
  status: "running" | "completed" | "error" | "cancelled";
  onCancel?: () => void;
  onMinimize?: () => void;
  onViewLogs?: () => void;
  backgroundable?: boolean;
}
```

**Features:**
- Progress bar with percentage
- Time estimates
- Current step indicator
- Background mode
- Cancel controls
- Notification on completion

---

### 3. ResourceMonitor Component

```typescript
interface ResourceMonitorProps {
  resources: Array<{
    id: string;
    name: string;
    type: "container" | "vm" | "lxc";
    status: "running" | "stopped" | "error";
    cpu: number; // 0-100
    memory: number; // bytes
    network?: {
      in: number; // bytes/s
      out: number; // bytes/s
    };
    ports?: Array<{ host: number; container: number }>;
  }>;
  autoRefresh?: boolean;
  refreshInterval?: number; // seconds
  onAction?: (id: string, action: "logs" | "restart" | "stop" | "exec") => void;
}
```

**Features:**
- Real-time resource graphs
- Status indicators
- Quick actions
- Auto-refresh toggle
- Export metrics
- Historical view (if available)

---

### 4. TaskTracker Component

```typescript
interface TaskTrackerProps {
  taskId: string; // UPID for Proxmox
  operation: string;
  progress?: number; // 0-100
  currentStep?: string;
  status: "running" | "completed" | "error" | "cancelled";
  elapsed: number;
  estimated?: number;
  onWait?: () => void; // Wait for completion
  onCancel?: () => void;
  onViewLogs?: () => void;
}
```

**Features:**
- Task ID display (UPID)
- Progress tracking
- Wait for completion option
- Task logs
- Cancel operation

---

### 5. WorkflowTimeline Component

```typescript
interface WorkflowTimelineProps {
  workflowId: string;
  phases: Array<{
    id: string;
    name: string;
    status: "pending" | "running" | "completed" | "error";
    progress: number; // 0-100
    tasks: Array<{
      id: string;
      name: string;
      status: "pending" | "running" | "completed" | "error";
      duration?: number; // seconds
      dependencies?: string[]; // task IDs
    }>;
  }>;
  onExpandTask?: (taskId: string) => void;
  onViewLogs?: (taskId: string) => void;
  onCancel?: () => void;
  onSuspend?: () => void;
}
```

**Features:**
- Phase visualization
- Task dependency graph
- Progress per phase/task
- Expandable task details
- Timeline view
- Suspend/resume controls

---

### 6. InteractiveTerminal Component

```typescript
interface InteractiveTerminalProps {
  title: string;
  cwd: string;
  output: Array<{
    type: "stdout" | "stderr" | "command";
    content: string;
    timestamp: Date;
  }>;
  onCommand?: (command: string) => void;
  onClear?: () => void;
  onExport?: () => void;
  history?: string[];
  status: "idle" | "running" | "completed" | "error";
}
```

**Features:**
- Command input
- Output streaming
- Command history (↑↓)
- Copy/paste
- Export output
- Clear terminal

---

### 7. ErrorPanel Component

```typescript
interface ErrorPanelProps {
  error: {
    message: string;
    code?: string;
    stack?: string;
    context?: {
      operation: string;
      inputs?: Record<string, unknown>;
      step?: string;
      exitCode?: number;
    };
  };
  onRetry?: () => void;
  onViewLogs?: () => void;
  onFix?: () => void; // If fix suggestions available
  onDismiss?: () => void;
}
```

**Features:**
- Error message display
- Stack trace viewer (expandable)
- Context information
- Retry controls
- Fix suggestions
- Link to full logs

---

### 8. ArtifactBrowser Component

```typescript
interface ArtifactBrowserProps {
  artifacts: Array<{
    path: string;
    kind: string;
    size?: number; // bytes
    preview?: string; // For text files
  }>;
  onView?: (path: string) => void;
  onDownload?: (path: string) => void;
  onDownloadAll?: () => void;
  onCopyPath?: (path: string) => void;
  onOpenInEditor?: (path: string) => void;
}
```

**Features:**
- Artifact list with metadata
- Preview (text files)
- Download individual/all
- Copy path
- Open in editor

---

## Integration with Generative UI

### How These Patterns Fit

**Window Types:**
- **StreamingTerminal:** `window` type (draggable, resizable)
- **ProgressWindow:** `overlay` type (persistent, non-intrusive)
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

---

## Missing Implementation Details

### 1. Real-Time Streaming

**Current:** Tool results return after completion  
**Needed:** Stream events during execution

**Solution:**
- Use `ToolWriter` interface (already exists in tools)
- Emit streaming events via WebSocket/SSE
- Update UI components in real-time

### 2. Progress Tracking

**Current:** No progress indication for long-running operations  
**Needed:** Progress bars, time estimates

**Solution:**
- Tools emit progress events via `writer.write()`
- Parse progress from stdout (Docker build output)
- Track elapsed time, estimate remaining

### 3. Resource Monitoring

**Current:** No resource usage visualization  
**Needed:** CPU, memory, network graphs

**Solution:**
- Poll Docker/Proxmox APIs for resource usage
- Store metrics in time-series format
- Render graphs using chart library (Tremor?)

### 4. Task Tracking

**Current:** UPID returned but not tracked  
**Needed:** Task status polling, completion detection

**Solution:**
- Poll Proxmox API for task status (UPID)
- Show task window until completion
- Auto-dismiss on completion

### 5. Error Handling

**Current:** Basic error display  
**Needed:** Detailed error panels, debugging tools

**Solution:**
- Capture full error context (stack, inputs, outputs)
- Display in expandable error panel
- Provide retry/fix suggestions

---

## Priority Implementation Order

### Phase 1: Core Streaming (Week 1)
1. **StreamingTerminal** component
2. Real-time output streaming (WebSocket/SSE)
3. Log filtering/search

### Phase 2: Progress Tracking (Week 2)
1. **ProgressWindow** component
2. Progress event parsing
3. Time estimation

### Phase 3: Resource Monitoring (Week 3)
1. **ResourceMonitor** component
2. Resource polling (Docker, Proxmox)
3. Real-time graphs

### Phase 4: Workflow Visualization (Week 4)
1. **WorkflowTimeline** component
2. Task dependency graph
3. Phase progress tracking

### Phase 5: Error & Artifacts (Week 5)
1. **ErrorPanel** component
2. **ArtifactBrowser** component
3. Error context capture

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

The orchestrator UI requires **fundamentally different patterns** than personal assistant UI:

1. **Streaming** - Real-time output visualization
2. **Progress** - Long-running operation tracking
3. **Monitoring** - Resource usage visualization
4. **Tracking** - Task status management
5. **Timeline** - Workflow execution visualization
6. **Terminal** - Interactive command execution
7. **Errors** - Detailed debugging interfaces
8. **Artifacts** - Output management

These patterns complement the generative UI architecture but require **specialized components** for technical operations.

