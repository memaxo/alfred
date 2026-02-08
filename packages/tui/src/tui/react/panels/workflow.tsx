/**
 * Workflow Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/workflow/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";

import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  Workflow,
  WorkflowEvent as WorkflowStoreEvent,
} from "../../subscriptions/workflow";

import { getApiClient } from "../../api/client";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";
import {
  useAgentFSStore,
  useSelectionStore,
  useWorkflowStore,
} from "../hooks/stores";
import { createVimMotionState, handleVimMotion } from "../vim";

type StageName = Parameters<
  ReturnType<typeof getApiClient>["phaseStep"]
>[0]["untilStage"];

const STAGES: readonly StageName[] = [
  "init",
  "context",
  "plan",
  "schedule",
  "execute",
  "review",
  "learn",
  "summarize",
] as const;

const isSuspendedStatus = (status: string): status is "suspended" =>
  status === "suspended";

function parseStage(value: string | null | undefined): StageName | null {
  if (!value) {
    return null;
  }
  return STAGES.includes(value as StageName) ? (value as StageName) : null;
}

async function resolveToolAuthz(): Promise<string | null> {
  const normalize = (value: string | null | undefined): string | null => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return trimmed.startsWith("Bearer ") ? trimmed : `Bearer ${trimmed}`;
  };

  const env = normalize(process.env.ALFRED_TOOL_AUTHZ);
  if (env) {
    return env;
  }
  try {
    const { loadCredentials } = await import("../../../cli/credentials");
    const creds = await loadCredentials();
    const token = creds?.toolAuthz?.token;
    return normalize(token);
  } catch {
    return null;
  }
}

interface WorkflowPanelProps {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
}

interface WorkflowEventEntry {
  id: string;
  eventType: string;
  eventData: unknown;
  timestamp: string;
}

const STATUS_CONFIGS: Record<
  Workflow["status"] | "suspended",
  { icon: string; color: string; label: string }
> = {
  cancelled: { icon: "○", color: colors.muted, label: "Cancelled" },
  completed: { icon: "✓", color: colors.success, label: "Completed" },
  executing: { icon: "●", color: colors.success, label: "Executing" },
  failed: { icon: "✗", color: colors.error, label: "Failed" },
  pending: { icon: "○", color: colors.muted, label: "Pending" },
  planning: { icon: "◎", color: colors.primary, label: "Planning" },
  suspended: { icon: "⏸", color: colors.warning, label: "Suspended" },
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
  const config = STATUS_CONFIGS[workflow.status] || STATUS_CONFIGS.pending;
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
      const subtaskConfig =
        STATUS_CONFIGS[subtask.status] || STATUS_CONFIGS.pending;
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
  const agentfs = useAgentFSStore();
  const selection = useSelectionStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedEvents, setSelectedEvents] = useState<WorkflowEventEntry[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{
    kind: "idle" | "working" | "ok" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const vimStateRef = useRef(createVimMotionState());

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      return;
    }

    const updateWorkflows = (event?: WorkflowStoreEvent) => {
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

      const current = workflows[selectedIndex];
      if (!event || viewMode !== "detail" || !current) {
        return;
      }
      if (event.workflow.id !== current.id) {
        return;
      }

      const eventId = `${event.workflow.id}-${event.type}-${event.timestamp}`;
      setSelectedEvents((prev) => {
        if (prev.some((entry) => entry.id === eventId)) {
          return prev;
        }
        const next: WorkflowEventEntry = {
          eventData: event.workflow,
          eventType: event.type,
          id: eventId,
          timestamp: new Date(event.timestamp).toISOString(),
        };
        return [...prev, next].slice(-200);
      });
    };

    const unsub = store.subscribe((_items, event) => {
      updateWorkflows(event);
    });

    updateWorkflows();

    return unsub;
  }, [store, viewMode, workflows, selectedIndex]);

  useEffect(() => {
    const wf = workflows[selectedIndex];
    selection?.setRunId(wf?.id ?? null);
  }, [selection, workflows, selectedIndex]);

  const loadWorkflowDetail = useCallback(async (runId: string) => {
    setLoading(true);
    const client = getApiClient();
    const result = await client.getWorkflowEvents(runId);
    if (result.data) {
      setSelectedEvents(result.data.events);
      setViewMode("detail");
    }
    setLoading(false);
  }, []);

  const handleKeyboard = useCallback(
    async (event: KeyEvent) => {
      if (!focused || workflows.length === 0) {
        return;
      }

      const workflow = workflows[selectedIndex];
      if (!workflow) {
        return;
      }

      // Detail view controls
      if (viewMode === "detail") {
        if (event.name === "escape" || event.name === "q") {
          vimStateRef.current.pendingG = false;
          setViewMode("list");
          return;
        }
        return;
      }

      const motion = handleVimMotion(event, vimStateRef.current);
      if (motion === "top") {
        setSelectedIndex(0);
        return;
      }
      if (motion === "bottom") {
        setSelectedIndex(workflows.length - 1);
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

      if (event.name === "enter" || event.name === "d") {
        loadWorkflowDetail(workflow.id);
        return;
      }

      // Actions
      const client = getApiClient();
      if (event.name === "r") {
        setAction({ kind: "working", message: "Preparing AgentFS..." });
        const authz = await resolveToolAuthz();
        if (!authz) {
          setAction({
            kind: "error",
            message:
              "No tool authz found. Run `alfred token issue ...` or set ALFRED_TOOL_AUTHZ.",
          });
          return;
        }

        const prepared = await client.phasePrepare({
          authz,
          runId: workflow.id,
        });
        if (prepared.error || !prepared.data) {
          setAction({
            kind: "error",
            message: prepared.error?.message ?? "prepare_failed",
          });
          return;
        }

        agentfs?.connect(prepared.data.runId, prepared.data.dbPath);
        setAction({
          kind: "ok",
          message: `AgentFS ready (${truncate(prepared.data.containerName, 24)})`,
        });
        return;
      }

      if (event.name === "n") {
        setAction({ kind: "working", message: "Stepping to next stage..." });
        const status = await client.phaseStatus(workflow.id);
        const next = status.data ? parseStage(status.data.nextStage) : null;
        if (!next) {
          setAction({
            kind: "error",
            message: status.error?.message ?? "no_next_stage",
          });
          return;
        }

        const authz = await resolveToolAuthz();
        if (next === "execute" && !authz) {
          setAction({
            kind: "error",
            message:
              "No tool authz found. Run `alfred token issue ...` or set ALFRED_TOOL_AUTHZ.",
          });
          return;
        }

        const stepped = await client.phaseStep({
          authz: authz ?? undefined,
          runId: workflow.id,
          untilStage: next,
        });
        if (stepped.error || !stepped.data) {
          setAction({
            kind: "error",
            message: stepped.error?.message ?? "step_failed",
          });
          return;
        }

        setAction({
          kind: "ok",
          message: `Stepped → ${stepped.data.untilStage} (${stepped.data.durationMs}ms)`,
        });
        return;
      }

      if (event.name === "e") {
        setAction({ kind: "working", message: "Stepping until execute..." });
        const authz = await resolveToolAuthz();
        if (!authz) {
          setAction({
            kind: "error",
            message:
              "No tool authz found. Run `alfred token issue ...` or set ALFRED_TOOL_AUTHZ.",
          });
          return;
        }
        const stepped = await client.phaseStep({
          authz,
          runId: workflow.id,
          untilStage: "execute",
        });
        if (stepped.error || !stepped.data) {
          setAction({
            kind: "error",
            message: stepped.error?.message ?? "step_execute_failed",
          });
          return;
        }

        setAction({
          kind: "ok",
          message: `Stepped → ${stepped.data.untilStage} (${stepped.data.durationMs}ms)`,
        });
        return;
      }

      if (event.name === "p" || event.name === " ") {
        if (workflow.status === "executing") {
          await client.suspendWorkflow(workflow.id);
        } else if (isSuspendedStatus(workflow.status)) {
          await client.resumeWorkflow(workflow.id);
        }
        return;
      }

      if (event.name === "c" || event.name === "x") {
        await client.cancelWorkflow(workflow.id);
        return;
      }
    },
    [agentfs, focused, workflows, selectedIndex, viewMode, loadWorkflowDetail]
  );

  useKeyboard(handleKeyboard);

  // Reset selected index when workflows change
  useEffect(() => {
    if (selectedIndex >= workflows.length) {
      setSelectedIndex(Math.max(0, workflows.length - 1));
    }
  }, [workflows.length, selectedIndex]);

  const selectedWorkflow = workflows[selectedIndex];
  if (viewMode === "detail" && selectedWorkflow) {
    const wf = selectedWorkflow;
    return (
      <box
        border
        height={height}
        left={x}
        style={{
          borderColor: borderColor ?? "#FFFFFF",
          borderStyle: "single",
        }}
        title={`Workflow: ${truncate(wf.name, 20)}`}
        top={y}
        width={width}
      >
        <scrollbox focused={focused}>
          <text content={bold(fg(colors.primary)(wf.name))} />
          <text content={`${dim("Status:")} ${wf.status}`} />
          <text content="" />

          <text content={bold(dim("Recent Events"))} />
          {loading && <text content={dim("  Loading events...")} />}
          {!loading && selectedEvents.length === 0 && (
            <text content={dim("  No events recorded")} />
          )}
          {!loading &&
            selectedEvents.map((e) => (
              <text
                key={e.id}
                content={`  ${dim(new Date(e.timestamp).toLocaleTimeString())} ${fg(colors.primary)(e.eventType)}`}
              />
            ))}

          <text content="" />
          <text content={dim("  Press [q] or [Esc] to return")} />
        </scrollbox>
      </box>
    );
  }

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

        {!viewMode && workflows.length > 0 && (
          <>
            <text content="" />
            <text
              content={dim(
                "  [↑↓]nav [gg/G]jump [Enter]details [n]next [r]prepare [e]exec [p]ause [c]ancel"
              )}
            />
          </>
        )}
        {workflows.length > 0 && viewMode === "list" && (
          <>
            <text content="" />
            <text
              content={dim(
                "  [↑↓]nav [gg/G]jump [Enter]details [n]next [r]prepare [e]exec [p]ause [c]ancel"
              )}
            />
          </>
        )}
        {action.kind !== "idle" && action.message.length > 0 && (
          <>
            <text content="" />
            <text
              content={
                action.kind === "error"
                  ? fg(colors.error)(`✗ ${action.message}`)
                  : action.kind === "ok"
                    ? fg(colors.success)(`✓ ${action.message}`)
                    : dim(`… ${action.message}`)
              }
            />
          </>
        )}
      </scrollbox>
    </box>
  );
}
