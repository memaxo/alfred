/**
 * ALFRED TUI Active Workflow Display
 *
 * Shows currently executing workflows with progress.
 */

import type {
  Workflow,
  WorkflowStatus,
  WorkflowSubtask,
} from "../../subscriptions/workflow";
import { colors, icons, progressChars } from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";

// ─── Status Configuration ────────────────────────────────────────────────────

type StatusConfig = {
  icon: string;
  color: string;
  label: string;
};

const STATUS_CONFIGS: Record<WorkflowStatus, StatusConfig> = {
  pending: { icon: "○", color: colors.muted, label: "Pending" },
  planning: { icon: "◎", color: colors.primary, label: "Planning" },
  executing: { icon: "●", color: colors.success, label: "Executing" },
  completed: { icon: "✓", color: colors.success, label: "Completed" },
  failed: { icon: "✗", color: colors.error, label: "Failed" },
  cancelled: { icon: "○", color: colors.muted, label: "Cancelled" },
};

// ─── Workflow Rendering ──────────────────────────────────────────────────────

export function renderWorkflowStatus(status: WorkflowStatus): string {
  const config = STATUS_CONFIGS[status];
  return fg(config.color)(`${config.icon} ${config.label}`);
}

export function renderActiveWorkflow(
  workflow: Workflow,
  width: number
): string[] {
  const lines: string[] = [];
  const config = STATUS_CONFIGS[workflow.status];

  // Header: status icon + name
  const statusIcon = fg(config.color)(config.icon);
  const name = bold(truncate(workflow.name, width - 10));
  lines.push(`${statusIcon} ${name}`);

  // Progress bar
  if (workflow.status === "executing" || workflow.status === "planning") {
    const barWidth = Math.min(width - 10, 30);
    const filled = Math.round(workflow.progress * barWidth);
    const empty = barWidth - filled;
    const bar =
      fg(config.color)(progressChars.filled.repeat(filled)) +
      dim(progressChars.empty.repeat(empty));
    const percent = Math.round(workflow.progress * 100);
    lines.push(`  ${bar} ${fg(config.color)(`${percent}%`)}`);
  }

  // Subtasks (if any)
  if (workflow.subtasks && workflow.subtasks.length > 0) {
    lines.push(dim("  Subtasks:"));
    for (const subtask of workflow.subtasks.slice(0, 3)) {
      lines.push(renderSubtask(subtask, width - 4));
    }
    if (workflow.subtasks.length > 3) {
      lines.push(dim(`    ... and ${workflow.subtasks.length - 3} more`));
    }
  }

  // Duration
  if (workflow.startedAt) {
    const duration = formatDuration(Date.now() - workflow.startedAt);
    lines.push(dim(`  Running for ${duration}`));
  }

  return lines;
}

function renderSubtask(subtask: WorkflowSubtask, width: number): string {
  const config = STATUS_CONFIGS[subtask.status];
  const icon = fg(config.color)(config.icon);
  const name = truncate(subtask.name, width - 6);
  return `    ${icon} ${dim(name)}`;
}

// ─── Time Formatting ─────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// ─── Multiple Active Workflows ───────────────────────────────────────────────

export function renderActiveWorkflows(
  workflows: Workflow[],
  width: number,
  maxItems = 3
): string[] {
  const lines: string[] = [];

  if (workflows.length === 0) {
    lines.push(dim("  No active workflows"));
    return lines;
  }

  const active = workflows.filter(
    (w) =>
      w.status === "executing" ||
      w.status === "planning" ||
      w.status === "pending"
  );

  const visibleWorkflows = active.slice(0, maxItems);

  for (let i = 0; i < visibleWorkflows.length; i++) {
    const wf = visibleWorkflows[i];
    if (wf) {
      const wfLines = renderActiveWorkflow(wf, width);
      for (const line of wfLines) {
        lines.push(line);
      }
      if (i < visibleWorkflows.length - 1) {
        lines.push(""); // Spacer between workflows
      }
    }
  }

  if (active.length > maxItems) {
    lines.push(dim(`  ... and ${active.length - maxItems} more active`));
  }

  return lines;
}

// ─── Compact Active Display ──────────────────────────────────────────────────

export function renderActiveCompact(workflows: Workflow[]): string {
  const active = workflows.filter(
    (w) => w.status === "executing" || w.status === "planning"
  );

  if (active.length === 0) {
    return dim("No active workflows");
  }

  const first = active[0];
  if (!first) {
    return dim("No active workflows");
  }
  const config = STATUS_CONFIGS[first.status];
  const progress = Math.round(first.progress * 100);

  let text = `${fg(config.color)(config.icon)} ${first.name} ${fg(config.color)(`${progress}%`)}`;

  if (active.length > 1) {
    text += dim(` +${active.length - 1} more`);
  }

  return text;
}

// ─── Spinner for Active Workflow ─────────────────────────────────────────────

let spinnerIndex = 0;

export function getWorkflowSpinner(): string {
  const frame = icons.spinner[spinnerIndex % icons.spinner.length];
  spinnerIndex++;
  return fg(colors.primary)(frame ?? "⠋");
}

export function resetWorkflowSpinner(): void {
  spinnerIndex = 0;
}
