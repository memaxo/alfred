/**
 * Workflow Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/workflow/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import type { Workflow } from "../../subscriptions/workflow";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";
import { useWorkflowStore } from "../hooks/stores";

type WorkflowPanelProps = {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
};

const STATUS_CONFIGS: Record<
  Workflow["status"],
  { icon: string; color: string; label: string }
> = {
  pending: { icon: "○", color: colors.muted, label: "Pending" },
  planning: { icon: "◎", color: colors.primary, label: "Planning" },
  executing: { icon: "●", color: colors.success, label: "Executing" },
  completed: { icon: "✓", color: colors.success, label: "Completed" },
  failed: { icon: "✗", color: colors.error, label: "Failed" },
  cancelled: { icon: "○", color: colors.muted, label: "Cancelled" },
};

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

function renderWorkflow(
  workflow: Workflow,
  width: number,
  isSelected: boolean
): string[] {
  const config = STATUS_CONFIGS[workflow.status];
  const lines: string[] = [];

  // Header: status icon + name
  const statusIcon = fg(config.color)(config.icon);
  const name = bold(truncate(workflow.name, width - 10));
  const prefix = isSelected ? bold(fg(colors.primary)(">")) : " ";
  lines.push(`${prefix} ${statusIcon} ${name}`);

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
      const subtaskConfig = STATUS_CONFIGS[subtask.status];
      const subtaskIcon = fg(subtaskConfig.color)(subtaskConfig.icon);
      const subtaskName = truncate(subtask.name, width - 6);
      lines.push(`    ${subtaskIcon} ${dim(subtaskName)}`);
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

export function WorkflowPanel({
  width,
  height,
  focused,
  x,
  y,
}: WorkflowPanelProps) {
  const store = useWorkflowStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      return;
    }

    const updateWorkflows = () => {
      // `getActive()` already includes pending; avoid duplication by merging active + history only.
      const all = [...store.getActive(), ...store.getHistory()];
      const unique: Workflow[] = [];
      const seen = new Set<string>();
      for (const wf of all) {
        if (seen.has(wf.id)) {
          continue;
        }
        seen.add(wf.id);
        unique.push(wf);
      }
      setWorkflows(unique);
    };

    const unsub = store.subscribe(() => {
      updateWorkflows();
    });

    updateWorkflows();

    return unsub;
  }, [store]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!focused || workflows.length === 0) {
        return;
      }

      if (event.name === "j" || event.name === "down") {
        setSelectedIndex((i) => Math.min(i + 1, workflows.length - 1));
        return;
      }
      if (event.name === "k" || event.name === "up") {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
    },
    [focused, workflows.length]
  );

  useKeyboard(handleKeyboard);

  // Reset selected index when workflows change
  useEffect(() => {
    if (selectedIndex >= workflows.length) {
      setSelectedIndex(Math.max(0, workflows.length - 1));
    }
  }, [workflows.length, selectedIndex]);

  const active = workflows.filter(
    (w) => w.status === "planning" || w.status === "executing"
  );
  const pending = workflows.filter((w) => w.status === "pending");
  const history = workflows.filter(
    (w) =>
      w.status === "completed" ||
      w.status === "failed" ||
      w.status === "cancelled"
  );

  const selectedId = workflows[selectedIndex]?.id;

  const activeSummary =
    active.length > 0
      ? `${fg(colors.success)(active.length.toString())} active`
      : dim("no active");
  const pendingSummary =
    pending.length > 0
      ? `${fg(colors.primary)(pending.length.toString())} pending`
      : "";
  const historySummary =
    history.length > 0 ? `${dim(history.length.toString())} completed` : "";

  const summaryParts = [activeSummary, pendingSummary, historySummary].filter(
    Boolean
  );

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Workflows"
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        <text content={summaryParts.join(dim(" • "))} />
        <text content="" />

        {active.length > 0 && (
          <>
            <text content={bold(dim("Active"))} />
            {active.slice(0, 3).map((wf, i) => {
              const wfLines = renderWorkflow(wf, width, wf.id === selectedId);
              return wfLines.map((line, j) => (
                <text content={line} key={`${wf.id}-${i}-${j}`} />
              ));
            })}
            {active.length > 3 && (
              <text
                content={dim(`  ... and ${active.length - 3} more active`)}
              />
            )}
            <text content="" />
          </>
        )}

        {pending.length > 0 && (
          <>
            <text content={bold(dim("Queue"))} />
            {pending.slice(0, 3).map((wf, i) => {
              const wfLines = renderWorkflow(wf, width, wf.id === selectedId);
              return wfLines.map((line, j) => (
                <text content={line} key={`${wf.id}-${i}-${j}`} />
              ));
            })}
            {pending.length > 3 && (
              <text
                content={dim(`  ... and ${pending.length - 3} more pending`)}
              />
            )}
            <text content="" />
          </>
        )}

        {history.length > 0 && (
          <>
            <text content={bold(dim("Recent"))} />
            {history.slice(0, 5).map((wf, i) => {
              const wfLines = renderWorkflow(wf, width, wf.id === selectedId);
              return wfLines.map((line, j) => (
                <text content={line} key={`${wf.id}-${i}-${j}`} />
              ));
            })}
            {history.length > 5 && (
              <text
                content={dim(`  ... and ${history.length - 5} more completed`)}
              />
            )}
          </>
        )}

        {active.length === 0 &&
          pending.length === 0 &&
          history.length === 0 && (
            <>
              <text content="" />
              <text content={dim("  No workflows")} />
              <text content={dim("  Use ALFRED to start a workflow")} />
            </>
          )}
      </scrollbox>
    </box>
  );
}
