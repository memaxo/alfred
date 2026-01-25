/**
 * GenUI Tool Integration
 *
 * Utilities for creating tool results that include generative UI.
 * Tools can return structured data along with a UI schema that
 * describes how to visualize the result.
 */

import type { GenUIToolResult, UIComponent } from "@alfred/type/genui";

/**
 * Create a GenUI tool result with both data and UI schema.
 *
 * @param ui - The UI component schema to render
 * @param data - The underlying data (for serialization/persistence)
 * @returns A GenUIToolResult object
 *
 * @example
 * ```typescript
 * // In a tool handler
 * const result = createGenUIResult(
 *   {
 *     component: "chart",
 *     props: {
 *       title: "Task Progress",
 *       data: [
 *         { x: "Completed", y: 45 },
 *         { x: "In Progress", y: 30 },
 *         { x: "Pending", y: 25 },
 *       ],
 *     },
 *   },
 *   { tasks: [...], summary: {...} }
 * );
 * return result;
 * ```
 */
export function createGenUIResult<T = unknown>(
  ui: UIComponent,
  data: T
): GenUIToolResult<T> {
  return { ui, data };
}

/**
 * Create a chart UI result.
 *
 * @param title - Chart title
 * @param data - Chart data points
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with chart component
 */
export function createChartResult<T = unknown>(
  title: string,
  data: { x: string; y: number }[],
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "chart",
      props: { title, data },
    },
    rawData
  );
}

/**
 * Create a grid UI result.
 *
 * @param children - Array of child component schemas
 * @param cols - Number of columns (default: 2)
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with grid component
 */
export function createGridResult<T = unknown>(
  children: UIComponent[],
  rawData: T,
  cols = 2
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "grid",
      props: { cols },
      children,
    },
    rawData
  );
}

/**
 * Create a list UI result.
 *
 * @param items - Array of list items
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with list component
 */
export function createListResult<T = unknown>(
  items: { id: string; content: string }[],
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "list",
      props: { items: items.map((i) => ({ ...i, content: i.content })) },
    },
    rawData
  );
}

/**
 * Create a terminal UI result.
 *
 * @param title - Terminal title
 * @param lines - Array of terminal lines
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with term component
 */
export function createTermResult<T = unknown>(
  title: string,
  lines: { text: string; type?: "output" | "error" | "input" }[],
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "term",
      props: { title, lines },
    },
    rawData
  );
}

/**
 * Create a code block UI result.
 *
 * @param code - The code content
 * @param language - Programming language (optional)
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with code component
 */
export function createCodeResult<T = unknown>(
  code: string,
  language: string | undefined,
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "code",
      props: { code, language },
    },
    rawData
  );
}

/**
 * Create a loading UI result.
 *
 * @param message - Loading message
 * @returns GenUIToolResult with loading component
 */
export function createLoadingResult(
  message = "Processing..."
): GenUIToolResult<null> {
  return createGenUIResult(
    {
      component: "loading",
      props: { message },
    },
    null
  );
}

/**
 * Create a plan UI result.
 *
 * @param requirement - The plan requirement
 * @param tasks - Array of tasks
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with plan component
 */
export function createPlanResult<T = unknown>(
  requirement: string,
  tasks: {
    id: string;
    title: string;
    status: "pending" | "running" | "completed" | "error";
  }[],
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "plan",
      props: { plan: { requirement, tasks } },
    },
    rawData
  );
}

/**
 * Create a task UI result.
 *
 * @param id - Task ID
 * @param title - Task title
 * @param status - Task status
 * @param progress - Optional progress percentage
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with task component
 */
export function createTaskResult<T = unknown>(
  id: string,
  title: string,
  status: "pending" | "running" | "completed" | "error",
  progress: number | undefined,
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "task",
      props: { id, title, status, progress },
    },
    rawData
  );
}

// ============================================================================
// Orchestrator UI Tool Helpers
// ============================================================================

interface OutputLine {
  type: "stdout" | "stderr" | "system" | "command";
  content: string;
  timestamp?: string;
}

/**
 * Create a streaming terminal result for real-time log output.
 *
 * @param title - Terminal window title
 * @param output - Array of output lines
 * @param status - Current execution status
 * @param elapsed - Elapsed time in seconds
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with streaming-terminal component
 */
export function createTerminalResult<T = unknown>(
  title: string,
  output: OutputLine[],
  status: "running" | "completed" | "error" | "cancelled",
  elapsed: number,
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "streaming-terminal",
      props: { title, output, status, elapsed, autoScroll: true },
    },
    rawData
  );
}

/**
 * Create a progress window result for long-running operations.
 *
 * @param title - Window title
 * @param operation - Operation description
 * @param progress - Progress percentage (0-100)
 * @param status - Current status
 * @param elapsed - Elapsed time in seconds
 * @param rawData - Raw underlying data
 * @param options - Optional current step and estimated time
 * @returns GenUIToolResult with progress-window component
 */
export function createProgressResult<T = unknown>(
  title: string,
  operation: string,
  progress: number,
  status: "running" | "completed" | "error" | "cancelled",
  elapsed: number,
  rawData: T,
  options?: { currentStep?: string; estimated?: number }
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "progress-window",
      props: {
        title,
        operation,
        progress,
        status,
        elapsed,
        ...options,
      },
    },
    rawData
  );
}

interface WorkflowPhase {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  tasks: {
    id: string;
    name: string;
    status: "pending" | "running" | "completed" | "error";
    duration?: number;
  }[];
}

/**
 * Create a workflow timeline result for multi-phase execution.
 *
 * @param workflowId - Workflow identifier
 * @param title - Timeline title
 * @param phases - Array of workflow phases
 * @param elapsed - Total elapsed time in seconds
 * @param rawData - Raw underlying data
 * @returns GenUIToolResult with workflow-timeline component
 */
export function createWorkflowResult<T = unknown>(
  workflowId: string,
  title: string,
  phases: WorkflowPhase[],
  elapsed: number,
  rawData: T
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "workflow-timeline",
      props: { workflowId, title, phases, elapsed },
    },
    rawData
  );
}

/**
 * Create a task tracker result for async task monitoring (UPID, etc.).
 *
 * @param taskId - Task identifier (e.g., Proxmox UPID)
 * @param operation - Operation description
 * @param status - Current status
 * @param elapsed - Elapsed time in seconds
 * @param rawData - Raw underlying data
 * @param options - Optional progress, current step, estimated time
 * @returns GenUIToolResult with task-tracker component
 */
export function createTaskTrackerResult<T = unknown>(
  taskId: string,
  operation: string,
  status: "running" | "completed" | "error" | "cancelled",
  elapsed: number,
  rawData: T,
  options?: { progress?: number; currentStep?: string; estimated?: number }
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "task-tracker",
      props: { taskId, operation, status, elapsed, ...options },
    },
    rawData
  );
}

interface ErrorContext {
  operation: string;
  inputs?: Record<string, unknown>;
  step?: string;
  exitCode?: number;
}

/**
 * Create an error panel result for error visualization.
 *
 * @param message - Error message
 * @param rawData - Raw underlying data
 * @param options - Optional error code, stack trace, and context
 * @returns GenUIToolResult with error-panel component
 */
export function createErrorResult<T = unknown>(
  message: string,
  rawData: T,
  options?: { code?: string; stack?: string; context?: ErrorContext }
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "error-panel",
      props: { message, ...options },
    },
    rawData
  );
}

interface Artifact {
  path: string;
  kind: string;
  size?: number;
  preview?: string;
}

/**
 * Create an artifact browser result for output management.
 *
 * @param artifacts - Array of artifacts
 * @param rawData - Raw underlying data
 * @param options - Optional title and execution ID
 * @returns GenUIToolResult with artifact-browser component
 */
export function createArtifactsResult<T = unknown>(
  artifacts: Artifact[],
  rawData: T,
  options?: { title?: string; executionId?: string }
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "artifact-browser",
      props: { artifacts, ...options },
    },
    rawData
  );
}

interface ResourceInfo {
  id: string;
  name: string;
  type: "container" | "vm" | "lxc";
  status: "running" | "stopped" | "error";
  cpu: number;
  memory: number;
  network?: { in: number; out: number };
  ports?: { host: number; container: number }[];
}

/**
 * Create a resource monitor result for container/VM monitoring.
 *
 * @param resources - Array of resource information
 * @param rawData - Raw underlying data
 * @param options - Optional title, auto-refresh, and refresh interval
 * @returns GenUIToolResult with resource-monitor component
 */
export function createResourceMonitorResult<T = unknown>(
  resources: ResourceInfo[],
  rawData: T,
  options?: { title?: string; autoRefresh?: boolean; refreshInterval?: number }
): GenUIToolResult<T> {
  return createGenUIResult(
    {
      component: "resource-monitor",
      props: { resources, ...options },
    },
    rawData
  );
}
