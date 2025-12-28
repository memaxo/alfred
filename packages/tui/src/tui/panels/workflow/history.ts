/**
 * ALFRED TUI Workflow History
 *
 * Shows recently completed and failed workflows.
 */

import type { Workflow, WorkflowStatus } from "../../subscriptions/workflow";
import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

// ─── Time Formatting ─────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) {
    return "just now";
  }
  if (diff < 60_000) {
    return `${Math.floor(diff / 1000)}s ago`;
  }
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }
  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

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

// ─── History Item Rendering ──────────────────────────────────────────────────

export function renderHistoryItem(workflow: Workflow, width: number): string {
  const isSuccess = workflow.status === "completed";
  const icon = isSuccess ? fg(colors.success)("✓") : fg(colors.error)("✗");
  const name = truncate(workflow.name, width - 20);

  const time = workflow.completedAt
    ? formatRelativeTime(workflow.completedAt)
    : "unknown";

  return `${icon} ${name} ${dim(time)}`;
}

export function renderHistoryItemDetailed(
  workflow: Workflow,
  width: number
): string[] {
  const lines: string[] = [];
  const isSuccess = workflow.status === "completed";
  const icon = isSuccess ? fg(colors.success)("✓") : fg(colors.error)("✗");

  // Name line
  lines.push(`${icon} ${truncate(workflow.name, width - 4)}`);

  // Details
  const details: string[] = [];

  if (workflow.startedAt && workflow.completedAt) {
    const duration = formatDuration(workflow.completedAt - workflow.startedAt);
    details.push(`Duration: ${duration}`);
  }

  if (workflow.completedAt) {
    details.push(`Finished: ${formatRelativeTime(workflow.completedAt)}`);
  }

  if (workflow.error) {
    lines.push(`  ${fg(colors.error)(truncate(workflow.error, width - 4))}`);
  }

  if (details.length > 0) {
    lines.push(`  ${dim(details.join(" • "))}`);
  }

  return lines;
}

// ─── History List ────────────────────────────────────────────────────────────

export function renderHistory(
  history: Workflow[],
  width: number,
  maxItems = 5
): string[] {
  const lines: string[] = [];

  if (history.length === 0) {
    lines.push(dim("  No recent workflows"));
    return lines;
  }

  lines.push(dim("  Recent:"));

  // Sort by completion time, most recent first
  const sorted = [...history].sort((a, b) => {
    const timeA = a.completedAt ?? 0;
    const timeB = b.completedAt ?? 0;
    return timeB - timeA;
  });

  const visible = sorted.slice(0, maxItems);

  for (const wf of visible) {
    lines.push(`  ${renderHistoryItem(wf, width - 2)}`);
  }

  if (history.length > maxItems) {
    lines.push(dim(`  ... ${history.length - maxItems} more in history`));
  }

  return lines;
}

// ─── History Statistics ──────────────────────────────────────────────────────

export type HistoryStats = {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  successRate: number;
  avgDuration: number;
};

export function calculateHistoryStats(history: Workflow[]): HistoryStats {
  const completed = history.filter((w) => w.status === "completed").length;
  const failed = history.filter((w) => w.status === "failed").length;
  const cancelled = history.filter((w) => w.status === "cancelled").length;
  const total = history.length;

  const successRate = total > 0 ? completed / total : 0;

  // Calculate average duration
  const durations = history
    .filter((w) => w.startedAt && w.completedAt)
    .map((w) => {
      if (w.completedAt && w.startedAt) {
        return w.completedAt - w.startedAt;
      }
      return 0;
    });

  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  return { total, completed, failed, cancelled, successRate, avgDuration };
}

export function renderHistoryStats(
  history: Workflow[],
  _width: number
): string[] {
  const stats = calculateHistoryStats(history);
  const lines: string[] = [];

  lines.push(dim("  Statistics:"));

  // Success rate
  const rateColor =
    stats.successRate >= 0.9
      ? colors.success
      : stats.successRate >= 0.7
        ? colors.warning
        : colors.error;
  const ratePercent = Math.round(stats.successRate * 100);
  lines.push(`    ${dim("Success rate:")} ${fg(rateColor)(`${ratePercent}%`)}`);

  // Counts
  const counts = [
    `${fg(colors.success)(stats.completed.toString())} completed`,
    `${fg(colors.error)(stats.failed.toString())} failed`,
  ];
  if (stats.cancelled > 0) {
    counts.push(`${fg(colors.muted)(stats.cancelled.toString())} cancelled`);
  }
  lines.push(`    ${dim(counts.join(" • "))}`);

  // Average duration
  if (stats.avgDuration > 0) {
    lines.push(
      `    ${dim("Avg duration:")} ${formatDuration(stats.avgDuration)}`
    );
  }

  return lines;
}

// ─── Grouped History ─────────────────────────────────────────────────────────

export function groupHistoryByStatus(
  history: Workflow[]
): Map<WorkflowStatus, Workflow[]> {
  const groups = new Map<WorkflowStatus, Workflow[]>();

  for (const wf of history) {
    const existing = groups.get(wf.status) ?? [];
    existing.push(wf);
    groups.set(wf.status, existing);
  }

  return groups;
}
