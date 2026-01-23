/**
 * Focus Panel - React Component
 *
 * Concierge Focus board (commitments + attention) for the TUI dashboard.
 */

/** @jsxImportSource @opentui/react */

import { useEffect, useState } from "react";
import { colors } from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";
import { useFocusStore } from "../hooks/stores";

type FocusPanelProps = {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
};

type FocusRow = {
  id: string;
  title: string;
  meta?: string;
};

function toTitle(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "Untitled";
}

export function FocusPanel({ width, height, focused, x, y }: FocusPanelProps) {
  const store = useFocusStore();
  const [lines, setLines] = useState<FocusRow[]>([]);

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      setLines([{ id: "missing", title: dim("Focus store unavailable") }]);
      return;
    }

    const render = () => {
      const state = store.getState();
      if (!state) {
        setLines([{ id: "empty", title: dim("No focus data") }]);
        return;
      }

      const rows: FocusRow[] = [];
      if (state.focusSet) {
        const title = state.focusSet.title ?? "Active Focus";
        rows.push({
          id: "focusset",
          title: bold(truncate(title, width - 4)),
          meta: dim(`wip ${state.focusSet.wipLimit}`),
        });
      } else {
        rows.push({
          id: "nofocus",
          title: dim("No active focus set"),
        });
      }

      rows.push({ id: "spacer-1", title: "" });

      rows.push({ id: "commitments-header", title: bold(dim("Commitments")) });
      if (state.commitments.length === 0) {
        rows.push({ id: "commitments-empty", title: dim("  none") });
      } else {
        for (const c of state.commitments.slice(0, 4)) {
          const lane =
            c.lane === "spotlight"
              ? fg(colors.primary)("S")
              : c.lane === "maintenance"
                ? fg(colors.muted)("M")
                : dim("B");
          rows.push({
            id: c.id,
            title: `  ${lane} ${truncate(toTitle(c.title), width - 6)}`,
            meta: dim(`${c.status}`),
          });
        }
      }

      rows.push({ id: "spacer-2", title: "" });
      rows.push({ id: "attention-header", title: bold(dim("Attention")) });
      if (state.attention.length === 0) {
        rows.push({ id: "attention-empty", title: dim("  none") });
      } else {
        for (const a of state.attention.slice(0, 4)) {
          const urgency =
            a.urgency === "critical" || a.urgency === "high"
              ? fg(colors.error)("!")
              : fg(colors.muted)("-");
          rows.push({
            id: a.id,
            title: `  ${urgency} ${truncate(toTitle(a.title ?? a.kind), width - 6)}`,
          });
        }
      }

      setLines(rows);
    };

    const unsub = store.subscribe(() => {
      render();
    });

    render();
    return unsub;
  }, [store, width]);

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Focus"
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        {lines.map((row) => (
          <text
            content={
              row.meta ? `${row.title}${dim(" • ")}${row.meta}` : row.title
            }
            key={row.id}
          />
        ))}
      </scrollbox>
    </box>
  );
}
