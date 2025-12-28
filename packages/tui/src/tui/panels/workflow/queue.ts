/**
 * ALFRED TUI Workflow Queue
 *
 * Shows pending and queued workflows.
 */

import type { Workflow } from "../../subscriptions/workflow";
import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

// ─── Queue Rendering ─────────────────────────────────────────────────────────

export function renderQueueItem(
  workflow: Workflow,
  index: number,
  width: number
): string {
  const position = dim(`${(index + 1).toString().padStart(2)}.`);
  const name = truncate(workflow.name, width - 10);
  return `${position} ${fg(colors.muted)("○")} ${name}`;
}

export function renderQueue(
  workflows: Workflow[],
  width: number,
  maxItems = 5
): string[] {
  const lines: string[] = [];

  const pending = workflows.filter((w) => w.status === "pending");

  if (pending.length === 0) {
    lines.push(dim("  Queue empty"));
    return lines;
  }

  lines.push(dim("  Queued workflows:"));

  const visible = pending.slice(0, maxItems);
  for (let i = 0; i < visible.length; i++) {
    const wf = visible[i];
    if (wf) {
      lines.push(`  ${renderQueueItem(wf, i, width - 2)}`);
    }
  }

  if (pending.length > maxItems) {
    lines.push(dim(`  ... and ${pending.length - maxItems} more in queue`));
  }

  return lines;
}

// ─── Queue Summary ───────────────────────────────────────────────────────────

export function renderQueueSummary(workflows: Workflow[]): string {
  const pending = workflows.filter((w) => w.status === "pending");

  if (pending.length === 0) {
    return dim("Queue: empty");
  }

  return `${dim("Queue:")} ${fg(colors.primary)(pending.length.toString())} ${dim("pending")}`;
}

// ─── Estimated Wait Time ─────────────────────────────────────────────────────

export function estimateWaitTime(
  position: number,
  avgDurationMs = 30_000
): string {
  const estimatedMs = position * avgDurationMs;

  const seconds = Math.floor(estimatedMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `~${minutes}m`;
  }
  return `~${seconds}s`;
}

export function renderQueueWithEstimates(
  workflows: Workflow[],
  width: number,
  avgDurationMs = 30_000
): string[] {
  const lines: string[] = [];

  const pending = workflows.filter((w) => w.status === "pending");

  if (pending.length === 0) {
    lines.push(dim("  Queue empty"));
    return lines;
  }

  lines.push(dim("  Queued (estimated wait):"));

  const visible = pending.slice(0, 5);
  for (let i = 0; i < visible.length; i++) {
    const wf = visible[i];
    if (wf) {
      const position = dim(`${(i + 1).toString().padStart(2)}.`);
      const name = truncate(wf.name, width - 20);
      const wait = dim(estimateWaitTime(i + 1, avgDurationMs));
      lines.push(`  ${position} ${fg(colors.muted)("○")} ${name} ${wait}`);
    }
  }

  if (pending.length > 5) {
    const totalWait = estimateWaitTime(pending.length, avgDurationMs);
    lines.push(
      dim(`  ... and ${pending.length - 5} more (total wait: ${totalWait})`)
    );
  }

  return lines;
}

// ─── Queue Position ──────────────────────────────────────────────────────────

export function getQueuePosition(
  workflowId: string,
  workflows: Workflow[]
): number | null {
  const pending = workflows.filter((w) => w.status === "pending");
  const index = pending.findIndex((w) => w.id === workflowId);
  return index >= 0 ? index + 1 : null;
}
