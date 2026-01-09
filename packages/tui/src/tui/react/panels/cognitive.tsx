/**
 * Cognitive Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/cognitive/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import type {
  CognitiveState,
  CognitiveTransition,
} from "../../subscriptions/cognitive";
import {
  autonomyColor,
  colors,
  icons,
  phaseColor,
  progressChars,
} from "../../theme";
import { bold, dim, fg } from "../../typography";
import { useCognitiveStore } from "../hooks/stores";

type CognitivePanelProps = {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}

function bar(value: number, width: number): string {
  const w = Math.max(4, Math.min(24, width));
  const v = clamp01(value);
  const filled = Math.round(v * w);
  return (
    progressChars.filled.repeat(filled) +
    progressChars.empty.repeat(Math.max(0, w - filled))
  );
}

function percent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function renderPhaseLine(phase: CognitiveState["phase"]): string {
  const color = phaseColor(phase);
  const label = phase.toUpperCase();
  return `${fg(color)(icons.active)} ${bold(label)}`;
}

function renderAutonomyLines(
  autonomy: CognitiveState["autonomy"],
  width: number
): string[] {
  const level = clamp01(autonomy.level);
  const conf = clamp01(autonomy.confidence);
  const th = clamp01(autonomy.threshold);
  const color = autonomyColor(level);

  const meterWidth = Math.max(10, width - 18);

  return [
    `${bold(dim("Autonomy"))}`,
    `  level  ${fg(color)(bar(level, meterWidth))} ${fg(color)(percent(level))}`,
    `  conf   ${fg(colors.primary)(bar(conf, meterWidth))} ${percent(conf)}`,
    `  thres  ${dim(bar(th, meterWidth))} ${percent(th)}`,
  ];
}

function renderPhysiologyLines(
  physiology: CognitiveState["physiology"],
  width: number
): string[] {
  const meterWidth = Math.max(10, width - 18);
  return [
    `${bold(dim("Physiology"))}`,
    `  energy ${fg(colors.success)(bar(physiology.energy, meterWidth))} ${percent(
      physiology.energy
    )}`,
    `  bored  ${fg(colors.warning)(bar(physiology.boredom, meterWidth))} ${percent(
      physiology.boredom
    )}`,
    `  frust  ${fg(colors.error)(bar(physiology.frustration, meterWidth))} ${percent(
      physiology.frustration
    )}`,
  ];
}

function renderTransitionLines(
  transitions: CognitiveTransition[],
  maxLines: number
): string[] {
  const lines: string[] = [];
  const recent = transitions.slice(-maxLines).reverse();
  for (const t of recent) {
    const from = t.from.toUpperCase();
    const to = t.to.toUpperCase();
    const line = `  ${dim(from)} ${dim(icons.arrow.right)} ${to}`;
    // Avoid truncating ANSI-colored strings (can break escape sequences).
    lines.push(line);
  }
  return lines;
}

export function CognitivePanel({
  width,
  height,
  focused,
  x,
  y,
}: CognitivePanelProps) {
  const store = useCognitiveStore();
  const [state, setState] = useState<CognitiveState | null>(null);
  const [transitions, setTransitions] = useState<CognitiveTransition[]>([]);

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      return;
    }

    const unsub = store.subscribe((newState) => {
      setState(newState);
      setTransitions(store.getHistory());
    });

    return unsub;
  }, [store]);

  const handleKeyboard = useCallback((_event: KeyEvent) => {
    // Cognitive panel has no special key handling yet
    // Vim scrolling is handled by scrollbox
  }, []);

  useKeyboard(handleKeyboard);

  if (!state) {
    return (
      <box
        border
        height={height}
        left={x}
        style={{
          borderColor: borderColor ?? "#FFFFFF",
          borderStyle: "single",
        }}
        title="Cognitive"
        top={y}
        width={width}
      >
        <text content="" />
        <text content={dim("  Awaiting cognitive state...")} />
        <text content="" />
      </box>
    );
  }

  const { phase, physiology, autonomy } = state;

  const contentWidth = Math.max(20, width - 2);
  const timelineLines =
    transitions.length > 0
      ? renderTransitionLines(transitions, Math.max(3, height - 14))
      : [];

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Cognitive"
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        <text content={renderPhaseLine(phase)} />
        <text content="" />

        {renderAutonomyLines(autonomy, contentWidth).map((line, i) => (
          <text content={line} key={`autonomy-${i}`} />
        ))}
        <text content="" />

        {renderPhysiologyLines(physiology, contentWidth).map((line, i) => (
          <text content={line} key={`physiology-${i}`} />
        ))}
        <text content="" />

        {timelineLines.length > 0 && (
          <>
            <text content={bold(dim("Recent Activity"))} />
            {timelineLines.map((line, i) => (
              <text content={line} key={`timeline-${i}`} />
            ))}
          </>
        )}
      </scrollbox>
    </box>
  );
}
