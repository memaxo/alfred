/**
 * Workflow Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/workflow/index.ts
 */

/** @jsxImportSource @opentui/react */

import { useEffect, useState } from "react";
import { renderActiveWorkflows } from "../../panels/workflow/active";
import { renderHistory } from "../../panels/workflow/history";
import { renderQueue } from "../../panels/workflow/queue";
import type { Workflow } from "../../subscriptions/workflow";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { useStores } from "../hooks/stores";

export type PanelProps = {
  focused: boolean;
  height: number;
  width: number;
  x?: number;
  y?: number;
};

export function WorkflowPanel({
  focused,
  height,
  width,
  x = 0,
  y = 0,
}: PanelProps) {
  const stores = useStores();
  const [active, setActive] = useState<Workflow[]>([]);
  const [pending, setPending] = useState<Workflow[]>([]);
  const [history, setHistory] = useState<Workflow[]>([]);

  useEffect(() => {
    if (!stores.workflow) {
      return;
    }

    const unsub = stores.workflow.subscribe(() => {
      setActive(stores.workflow?.getActive() ?? []);
      setPending(stores.workflow?.getPending() ?? []);
      setHistory(stores.workflow?.getHistory() ?? []);
    });

    return unsub;
  }, [stores.workflow]);

  const borderColor = focused ? "#39BAE6" : "#5C6370";

  const lines: string[] = [];

  // Summary line
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
  lines.push(summaryParts.join(dim(" • ")));
  lines.push("");

  // Active workflows section
  if (active.length > 0) {
    lines.push(bold(dim("Active")));
    const activeLines = renderActiveWorkflows(active, width - 4, 2);
    lines.push(...activeLines);
    lines.push("");
  }

  // Pending workflows section
  if (pending.length > 0) {
    lines.push(bold(dim("Pending")));
    const queueLines = renderQueue(pending, width - 4, 2);
    lines.push(...queueLines);
    lines.push("");
  }

  // History section (if space permits)
  const remainingHeight = height - lines.length - 4;
  if (remainingHeight > 3 && history.length > 0) {
    lines.push(bold(dim("Recent")));
    const historyLines = renderHistory(
      history.slice(0, Math.floor(remainingHeight / 2)),
      width - 4
    );
    lines.push(...historyLines);
  }

  return (
    <box
      border
      height={height}
      style={{ borderColor, borderStyle: "single" }}
      title="Workflows"
      width={width}
      x={x}
      y={y}
    >
      <scrollbox
        focused={focused}
        height={height - 2}
        width={width - 2}
        x={1}
        y={1}
      >
        {lines.map((line, i) => (
          <text content={line} key={i} />
        ))}
      </scrollbox>
    </box>
  );
}
