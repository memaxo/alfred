/**
 * Orchestrator UI Components for Generative UI
 *
 * Specialized components for technical operations:
 * - StreamingTerminal: Real-time log streaming
 * - ProgressWindow: Long-running operation tracking
 * - WorkflowTimeline: Workflow execution visualization
 * - TaskTracker: Async task tracking
 * - ErrorPanel: Error visualization
 * - ArtifactBrowser: Output artifact management
 * - ResourceMonitor: Container/VM resource monitoring
 */

import type { ReactNode } from "react";

import { createElement } from "react";

// ============================================================================
// Types
// ============================================================================

export type OutputLine = {
  type: "stdout" | "stderr" | "system" | "command";
  content: string;
  timestamp?: string;
};

export type StreamingTerminalProps = {
  title: string;
  output: OutputLine[];
  autoScroll?: boolean;
  status?: "running" | "completed" | "error" | "cancelled";
  elapsed?: number;
  onCancel?: () => void;
  onExport?: () => void;
  onClear?: () => void;
};

export type ProgressWindowProps = {
  title: string;
  operation: string;
  progress: number;
  currentStep?: string;
  elapsed: number;
  estimated?: number;
  status: "running" | "completed" | "error" | "cancelled";
  onCancel?: () => void;
  onMinimize?: () => void;
  onViewLogs?: () => void;
  backgroundable?: boolean;
};

export type WorkflowPhase = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  tasks: WorkflowTask[];
};

export type WorkflowTask = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  duration?: number;
  dependencies?: string[];
};

export type WorkflowTimelineProps = {
  workflowId: string;
  title?: string;
  phases: WorkflowPhase[];
  elapsed?: number;
  onExpandTask?: (taskId: string) => void;
  onViewLogs?: (taskId: string) => void;
  onCancel?: () => void;
  onSuspend?: () => void;
};

export type TaskTrackerProps = {
  taskId: string;
  operation: string;
  progress?: number;
  currentStep?: string;
  status: "running" | "completed" | "error" | "cancelled";
  elapsed: number;
  estimated?: number;
  onWait?: () => void;
  onCancel?: () => void;
  onViewLogs?: () => void;
};

export type ErrorContext = {
  operation: string;
  inputs?: Record<string, unknown>;
  step?: string;
  exitCode?: number;
};

export type ErrorPanelProps = {
  message: string;
  code?: string;
  stack?: string;
  context?: ErrorContext;
  onRetry?: () => void;
  onViewLogs?: () => void;
  onFix?: () => void;
  onDismiss?: () => void;
};

export type Artifact = {
  path: string;
  kind: string;
  size?: number;
  preview?: string;
};

export type ArtifactBrowserProps = {
  title?: string;
  artifacts: Artifact[];
  executionId?: string;
  onView?: (path: string) => void;
  onDownload?: (path: string) => void;
  onDownloadAll?: () => void;
  onCopyPath?: (path: string) => void;
  onOpenInEditor?: (path: string) => void;
};

export type ResourceInfo = {
  id: string;
  name: string;
  type: "container" | "vm" | "lxc";
  status: "running" | "stopped" | "error";
  cpu: number;
  memory: number;
  network?: { in: number; out: number };
  ports?: Array<{ host: number; container: number }>;
};

export type ResourceMonitorProps = {
  title?: string;
  resources: ResourceInfo[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  onAction?: (id: string, action: "logs" | "restart" | "stop" | "exec") => void;
};

// ============================================================================
// Components
// ============================================================================

const styles = {
  container: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "13px",
    backgroundColor: "#1a1a2e",
    borderRadius: "8px",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "#16213e",
    borderBottom: "1px solid #2d3a5a",
    color: "#e8e8e8",
    fontWeight: 500,
  },
  content: {
    padding: "12px",
  },
  output: {
    maxHeight: "300px",
    overflowY: "auto" as const,
    backgroundColor: "#0f0f23",
    borderRadius: "4px",
    padding: "8px",
  },
  line: {
    margin: "2px 0",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
  },
  stdout: { color: "#e8e8e8" },
  stderr: { color: "#ff6b6b" },
  system: { color: "#ffd93d" },
  command: { color: "#4ecdc4" },
  progress: {
    height: "8px",
    backgroundColor: "#2d3a5a",
    borderRadius: "4px",
    overflow: "hidden",
    margin: "8px 0",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#4ecdc4",
    transition: "width 0.3s ease",
  },
  statusBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
  },
  running: { backgroundColor: "#3498db", color: "white" },
  completed: { backgroundColor: "#2ecc71", color: "white" },
  error: { backgroundColor: "#e74c3c", color: "white" },
  cancelled: { backgroundColor: "#95a5a6", color: "white" },
  pending: { backgroundColor: "#34495e", color: "white" },
  button: {
    padding: "4px 12px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#3498db",
    color: "white",
    cursor: "pointer",
    fontSize: "12px",
    marginLeft: "4px",
  },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "8px",
    color: "#8892a8",
    fontSize: "12px",
  },
  artifact: {
    backgroundColor: "#16213e",
    borderRadius: "4px",
    padding: "8px 12px",
    marginBottom: "8px",
  },
  artifactName: {
    color: "#4ecdc4",
    fontWeight: 500,
  },
  artifactMeta: {
    color: "#8892a8",
    fontSize: "11px",
    marginTop: "4px",
  },
  resource: {
    backgroundColor: "#16213e",
    borderRadius: "4px",
    padding: "12px",
    marginBottom: "8px",
  },
  resourceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  gauge: {
    height: "6px",
    backgroundColor: "#2d3a5a",
    borderRadius: "3px",
    marginTop: "4px",
  },
  phase: {
    marginBottom: "16px",
  },
  task: {
    marginLeft: "16px",
    padding: "4px 0",
    borderLeft: "2px solid #2d3a5a",
    paddingLeft: "12px",
  },
  errorBox: {
    backgroundColor: "#2a0f0f",
    border: "1px solid #e74c3c",
    borderRadius: "4px",
    padding: "12px",
  },
  errorMessage: {
    color: "#ff6b6b",
    marginBottom: "8px",
  },
  errorContext: {
    backgroundColor: "#1a1a2e",
    borderRadius: "4px",
    padding: "8px",
    marginTop: "8px",
    fontSize: "11px",
    color: "#8892a8",
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function StatusBadge({ status }: { status: string }): ReactNode {
  const statusStyle = styles[status as keyof typeof styles] ?? styles.pending;
  return createElement(
    "span",
    { style: { ...styles.statusBadge, ...statusStyle } },
    status
  );
}

/**
 * StreamingTerminal - Real-time log streaming display.
 */
export function StreamingTerminal({
  title,
  output,
  autoScroll = true,
  status = "running",
  elapsed,
}: StreamingTerminalProps): ReactNode {
  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: styles.header },
      createElement("span", null, title),
      createElement(StatusBadge, { status })
    ),
    createElement(
      "div",
      { style: styles.content },
      createElement(
        "div",
        { style: styles.output },
        output.map((line, i) =>
          createElement(
            "div",
            {
              key: i,
              style: {
                ...styles.line,
                ...styles[line.type as keyof typeof styles],
              },
            },
            line.type === "command" ? `$ ${line.content}` : line.content
          )
        )
      ),
      createElement(
        "div",
        { style: styles.meta },
        elapsed !== undefined &&
          createElement("span", null, `Elapsed: ${formatDuration(elapsed)}`),
        autoScroll && createElement("span", null, "Auto-scroll: ON")
      )
    )
  );
}

/**
 * ProgressWindow - Long-running operation progress display.
 */
export function ProgressWindow({
  title,
  operation,
  progress,
  currentStep,
  elapsed,
  estimated,
  status,
}: ProgressWindowProps): ReactNode {
  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: styles.header },
      createElement("span", null, title),
      createElement(StatusBadge, { status })
    ),
    createElement(
      "div",
      { style: styles.content },
      createElement(
        "div",
        { style: { color: "#e8e8e8", marginBottom: "8px" } },
        operation
      ),
      createElement(
        "div",
        { style: styles.progress },
        createElement("div", {
          style: {
            ...styles.progressBar,
            width: `${Math.min(100, progress)}%`,
          },
        })
      ),
      createElement(
        "div",
        { style: { textAlign: "center" as const, color: "#e8e8e8" } },
        `${Math.round(progress)}%`
      ),
      currentStep &&
        createElement(
          "div",
          { style: { color: "#8892a8", marginTop: "8px", fontSize: "12px" } },
          `Current: ${currentStep}`
        ),
      createElement(
        "div",
        { style: styles.meta },
        createElement("span", null, `Elapsed: ${formatDuration(elapsed)}`),
        estimated !== undefined &&
          createElement(
            "span",
            null,
            `Remaining: ~${formatDuration(estimated)}`
          )
      )
    )
  );
}

/**
 * WorkflowTimeline - Workflow execution visualization.
 */
export function WorkflowTimeline({
  title,
  phases,
  elapsed,
}: WorkflowTimelineProps): ReactNode {
  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = phases.reduce(
    (sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length,
    0
  );
  const overallProgress =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: styles.header },
      createElement("span", null, title ?? "Workflow Execution"),
      createElement(
        "span",
        { style: { fontSize: "11px", color: "#8892a8" } },
        `${Math.round(overallProgress)}%`
      )
    ),
    createElement(
      "div",
      { style: styles.content },
      phases.map((phase) =>
        createElement(
          "div",
          { key: phase.id, style: styles.phase },
          createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              },
            },
            createElement(StatusBadge, { status: phase.status }),
            createElement("span", { style: { color: "#e8e8e8" } }, phase.name)
          ),
          createElement(
            "div",
            { style: styles.progress },
            createElement("div", {
              style: { ...styles.progressBar, width: `${phase.progress}%` },
            })
          ),
          phase.tasks.map((task) =>
            createElement(
              "div",
              { key: task.id, style: styles.task },
              createElement(
                "span",
                {
                  style: {
                    color: task.status === "completed" ? "#2ecc71" : "#8892a8",
                  },
                },
                task.status === "completed"
                  ? "✓"
                  : task.status === "running"
                    ? "⏳"
                    : task.status === "error"
                      ? "✗"
                      : "○"
              ),
              " ",
              createElement("span", { style: { color: "#e8e8e8" } }, task.name),
              task.duration !== undefined &&
                createElement(
                  "span",
                  {
                    style: {
                      color: "#8892a8",
                      marginLeft: "8px",
                      fontSize: "11px",
                    },
                  },
                  `[${formatDuration(task.duration)}]`
                )
            )
          )
        )
      ),
      elapsed !== undefined &&
        createElement(
          "div",
          { style: { ...styles.meta, marginTop: "12px" } },
          createElement(
            "span",
            null,
            `Total elapsed: ${formatDuration(elapsed)}`
          )
        )
    )
  );
}

/**
 * TaskTracker - Async task tracking (Proxmox UPID, etc.).
 */
export function TaskTracker({
  taskId,
  operation,
  progress,
  currentStep,
  status,
  elapsed,
  estimated,
}: TaskTrackerProps): ReactNode {
  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: styles.header },
      createElement("span", null, "Task Tracker"),
      createElement(StatusBadge, { status })
    ),
    createElement(
      "div",
      { style: styles.content },
      createElement(
        "div",
        { style: { color: "#8892a8", fontSize: "11px", marginBottom: "8px" } },
        `ID: ${taskId}`
      ),
      createElement(
        "div",
        { style: { color: "#e8e8e8", marginBottom: "8px" } },
        operation
      ),
      progress !== undefined &&
        createElement(
          "div",
          null,
          createElement(
            "div",
            { style: styles.progress },
            createElement("div", {
              style: { ...styles.progressBar, width: `${progress}%` },
            })
          ),
          createElement(
            "div",
            {
              style: {
                textAlign: "center" as const,
                color: "#e8e8e8",
                fontSize: "12px",
              },
            },
            `${Math.round(progress)}%`
          )
        ),
      currentStep &&
        createElement(
          "div",
          { style: { color: "#8892a8", marginTop: "8px", fontSize: "12px" } },
          `Step: ${currentStep}`
        ),
      createElement(
        "div",
        { style: styles.meta },
        createElement("span", null, `Elapsed: ${formatDuration(elapsed)}`),
        estimated !== undefined &&
          createElement("span", null, `ETA: ~${formatDuration(estimated)}`)
      )
    )
  );
}

/**
 * ErrorPanel - Error visualization and debugging.
 */
export function ErrorPanel({
  message,
  code,
  stack,
  context,
}: ErrorPanelProps): ReactNode {
  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: { ...styles.header, backgroundColor: "#4a1515" } },
      createElement("span", null, "Error"),
      code &&
        createElement(
          "span",
          { style: { fontSize: "11px", color: "#ff6b6b" } },
          code
        )
    ),
    createElement(
      "div",
      { style: styles.content },
      createElement(
        "div",
        { style: styles.errorBox },
        createElement("div", { style: styles.errorMessage }, message),
        stack &&
          createElement(
            "pre",
            {
              style: {
                color: "#8892a8",
                fontSize: "11px",
                overflow: "auto",
                maxHeight: "150px",
                margin: 0,
              },
            },
            stack
          )
      ),
      context &&
        createElement(
          "div",
          { style: styles.errorContext },
          createElement("div", null, `Operation: ${context.operation}`),
          context.step && createElement("div", null, `Step: ${context.step}`),
          context.exitCode !== undefined &&
            createElement("div", null, `Exit code: ${context.exitCode}`)
        )
    )
  );
}

/**
 * ArtifactBrowser - Output artifact management.
 */
export function ArtifactBrowser({
  title,
  artifacts,
  executionId,
}: ArtifactBrowserProps): ReactNode {
  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: styles.header },
      createElement("span", null, title ?? "Artifacts"),
      createElement(
        "span",
        { style: { fontSize: "11px", color: "#8892a8" } },
        `${artifacts.length} items`
      )
    ),
    createElement(
      "div",
      { style: styles.content },
      executionId &&
        createElement(
          "div",
          {
            style: { color: "#8892a8", fontSize: "11px", marginBottom: "8px" },
          },
          `Execution: ${executionId}`
        ),
      artifacts.map((artifact, i) =>
        createElement(
          "div",
          { key: i, style: styles.artifact },
          createElement(
            "div",
            { style: styles.artifactName },
            getArtifactIcon(artifact.kind),
            " ",
            artifact.path.split("/").pop()
          ),
          createElement(
            "div",
            { style: styles.artifactMeta },
            artifact.kind,
            artifact.size !== undefined && ` • ${formatBytes(artifact.size)}`
          ),
          artifact.preview &&
            createElement(
              "pre",
              {
                style: {
                  backgroundColor: "#0f0f23",
                  padding: "8px",
                  borderRadius: "4px",
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "#8892a8",
                  overflow: "auto",
                  maxHeight: "100px",
                },
              },
              artifact.preview
            )
        )
      )
    )
  );
}

function getArtifactIcon(kind: string): string {
  const icons: Record<string, string> = {
    dockerfile: "🐳",
    yaml: "📄",
    json: "📋",
    script: "📜",
    config: "⚙️",
    log: "📝",
    binary: "📦",
  };
  return icons[kind.toLowerCase()] ?? "📄";
}

/**
 * ResourceMonitor - Container/VM resource monitoring.
 */
export function ResourceMonitor({
  title,
  resources,
  autoRefresh,
  refreshInterval,
}: ResourceMonitorProps): ReactNode {
  return createElement(
    "div",
    { style: styles.container },
    createElement(
      "div",
      { style: styles.header },
      createElement("span", null, title ?? "Resources"),
      autoRefresh &&
        createElement(
          "span",
          { style: { fontSize: "11px", color: "#8892a8" } },
          `Auto-refresh: ${refreshInterval ?? 5}s`
        )
    ),
    createElement(
      "div",
      { style: styles.content },
      resources.map((resource) =>
        createElement(
          "div",
          { key: resource.id, style: styles.resource },
          createElement(
            "div",
            { style: styles.resourceHeader },
            createElement(
              "div",
              null,
              createElement(
                "span",
                { style: { color: "#e8e8e8", fontWeight: 500 } },
                resource.name
              ),
              createElement(
                "span",
                {
                  style: {
                    color: "#8892a8",
                    marginLeft: "8px",
                    fontSize: "11px",
                  },
                },
                resource.type
              )
            ),
            createElement(StatusBadge, { status: resource.status })
          ),
          createElement(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              },
            },
            createElement(
              "div",
              null,
              createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#8892a8",
                    fontSize: "11px",
                  },
                },
                createElement("span", null, "CPU"),
                createElement("span", null, `${resource.cpu}%`)
              ),
              createElement(
                "div",
                { style: styles.gauge },
                createElement("div", {
                  style: {
                    height: "100%",
                    width: `${resource.cpu}%`,
                    backgroundColor: resource.cpu > 80 ? "#e74c3c" : "#4ecdc4",
                    borderRadius: "3px",
                  },
                })
              )
            ),
            createElement(
              "div",
              null,
              createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    color: "#8892a8",
                    fontSize: "11px",
                  },
                },
                createElement("span", null, "Memory"),
                createElement("span", null, formatBytes(resource.memory))
              ),
              createElement(
                "div",
                { style: styles.gauge },
                createElement("div", {
                  style: {
                    height: "100%",
                    width: `${Math.min(100, (resource.memory / (4 * 1024 * 1024 * 1024)) * 100)}%`,
                    backgroundColor: "#3498db",
                    borderRadius: "3px",
                  },
                })
              )
            )
          ),
          resource.ports &&
            resource.ports.length > 0 &&
            createElement(
              "div",
              {
                style: { marginTop: "8px", color: "#8892a8", fontSize: "11px" },
              },
              "Ports: ",
              resource.ports.map((p) => `${p.host}→${p.container}`).join(", ")
            )
        )
      )
    )
  );
}
