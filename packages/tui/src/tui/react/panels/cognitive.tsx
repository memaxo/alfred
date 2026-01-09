/**
 * Cognitive Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/cognitive/index.ts
 */

/** @jsxImportSource @opentui/react */

import { useEffect, useState } from "react";
import {
  renderAutonomyGauge,
  renderThresholdComparison,
} from "../../panels/cognitive/autonomy";
import { renderHistory, renderTimeline } from "../../panels/cognitive/history";
import { renderPhaseIndicator } from "../../panels/cognitive/phase";
import {
  renderPhysiology,
  renderPhysiologyStatus,
} from "../../panels/cognitive/physiology";
import type { CognitiveState } from "../../subscriptions/cognitive";
import { bold, dim } from "../../typography";
import { useStores } from "../hooks/stores";

export type PanelProps = {
  focused: boolean;
  height: number;
  width: number;
  x?: number;
  y?: number;
};

export function CognitivePanel({
  focused,
  height,
  width,
  x = 0,
  y = 0,
}: PanelProps) {
  const stores = useStores();
  const [state, setState] = useState<CognitiveState | null>(null);
  const [transitions, setTransitions] = useState<any[]>([]);

  useEffect(() => {
    if (!stores.cognitive) {
      return;
    }

    const unsub = stores.cognitive.subscribe((newState) => {
      setState(newState);
      setTransitions(stores.cognitive?.getHistory() ?? []);
    });

    return unsub;
  }, [stores.cognitive]);

  const borderColor = focused ? "#39BAE6" : "#5C6370";

  if (!state) {
    return (
      <box
        border
        height={height}
        style={{ borderColor, borderStyle: "single" }}
        title="Cognitive"
        width={width}
        x={x}
        y={y}
      >
        <text content={dim("  Awaiting cognitive state...")} />
      </box>
    );
  }

  const { phase, physiology, autonomy } = state;
  const lines: string[] = [];

  // Section 1: Current Phase
  lines.push(renderPhaseIndicator(phase, width - 4));
  lines.push("");

  // Section 2: Autonomy
  const autonomyLines = renderAutonomyGauge(autonomy, width - 4);
  lines.push(...autonomyLines);
  lines.push(renderThresholdComparison(autonomy.level, autonomy.threshold));
  lines.push("");

  // Section 3: Physiology
  lines.push(bold(dim("Physiology")));
  const physiologyLines = renderPhysiology(physiology, width - 4);
  lines.push(...physiologyLines);
  lines.push(renderPhysiologyStatus(physiology));
  lines.push("");

  // Section 4: Timeline
  if (transitions.length > 0) {
    lines.push(bold(dim("Recent Activity")));
    const timelineLines = renderTimeline(transitions, phase, width - 4);
    lines.push(...timelineLines);
    lines.push("");

    const remainingHeight = height - lines.length - 4;
    if (remainingHeight > 3) {
      const historyLines = renderHistory(
        transitions,
        remainingHeight - 1,
        width - 4
      );
      lines.push(...historyLines);
    }
  }

  return (
    <box
      border
      height={height}
      style={{ borderColor, borderStyle: "single" }}
      title="Cognitive"
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
