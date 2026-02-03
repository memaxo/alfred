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

import { getApiClient } from "../../api/client";
import {
  autonomyColor,
  colors,
  icons,
  phaseColor,
  progressChars,
} from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";
import { useCognitiveStore, useSelectionStore } from "../hooks/stores";

interface CognitivePanelProps {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
}

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
  const recent = transitions.slice(-maxLines).toReversed();
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
  const selection = useSelectionStore();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [systemState, setSystemState] = useState<CognitiveState | null>(null);
  const [systemTransitions, setSystemTransitions] = useState<
    CognitiveTransition[]
  >([]);
  const [runState, setRunState] = useState<CognitiveState | null>(null);
  const [runTransitions, setRunTransitions] = useState<CognitiveTransition[]>(
    []
  );
  const [runError, setRunError] = useState<string | null>(null);

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      return;
    }

    const unsub = store.subscribe((newState) => {
      setSystemState(newState);
      setSystemTransitions(store.getHistory());
    });

    return unsub;
  }, [store]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    const unsub = selection.subscribe((s) => {
      setSelectedRunId(s.runId);
    });
    return unsub;
  }, [selection]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunState(null);
      setRunTransitions([]);
      setRunError(null);
      return;
    }

    let alive = true;
    const client = getApiClient();

    const parsePhase = (raw: unknown): CognitiveState["phase"] => {
      return raw === "idle" ||
        raw === "capturing" ||
        raw === "thinking" ||
        raw === "deciding" ||
        raw === "executing" ||
        raw === "reflecting"
        ? raw
        : "idle";
    };

    const parseNum = (raw: unknown, fallback: number): number => {
      return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
    };

    const tick = async () => {
      const res = await client.getCognitiveState(selectedRunId);
      if (!alive) {
        return;
      }
      if (res.error || !res.data) {
        setRunError(res.error?.message ?? "cognitive_state_fetch_failed");
        return;
      }

      const phase = parsePhase(res.data.phase);
      const stateObj = res.data.state as unknown as {
        physiology?: Record<string, unknown>;
      };
      const physiology = stateObj.physiology ?? {};
      const autonomyObj = res.data.autonomy as unknown as Record<
        string,
        unknown
      >;

      const next: CognitiveState = {
        autonomy: {
          confidence: parseNum(
            autonomyObj.confidence,
            parseNum(autonomyObj.level, 0.5)
          ),
          level: parseNum(autonomyObj.level, 0.5),
          threshold: parseNum(autonomyObj.threshold, 0.5),
        },
        phase,
        physiology: {
          boredom: parseNum(physiology.boredom, 0),
          energy: parseNum(physiology.energy, 0.5),
          frustration: parseNum(physiology.frustration, 0),
        },
        timestamp: typeof res.data.ts === "number" ? res.data.ts : Date.now(),
      };

      setRunError(null);
      setRunState((prev) => {
        if (prev && prev.phase !== next.phase) {
          setRunTransitions((hist) => {
            const updated: CognitiveTransition[] = [
              ...hist,
              { from: prev.phase, to: next.phase, timestamp: next.timestamp },
            ];
            return updated.length > 20 ? updated.slice(-20) : updated;
          });
        }
        return next;
      });
    };

    void tick();
    const t = setInterval(() => {
      void tick();
    }, 2000);
    (t as unknown as { unref?: () => void }).unref?.();

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [selectedRunId]);

  const handleKeyboard = useCallback((_event: KeyEvent) => {
    // Cognitive panel has no special key handling yet
    // Vim scrolling is handled by scrollbox
  }, []);

  useKeyboard(handleKeyboard);

  const usingRun = selectedRunId !== null;
  const state = usingRun ? runState : systemState;
  const transitions = usingRun ? runTransitions : systemTransitions;
  const title = usingRun
    ? `Cognitive: ${truncate(selectedRunId ?? "", 12)}`
    : "Cognitive";

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
        title={title}
        top={y}
        width={width}
      >
        <text content="" />
        <text
          content={dim(
            usingRun
              ? "  Select a workflow and run [r] prepare to start AgentFS + cognitive."
              : "  Awaiting cognitive state..."
          )}
        />
        {usingRun && runError && (
          <text content={fg(colors.error)(`  ${runError}`)} />
        )}
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
      title={title}
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        {usingRun && runError && (
          <>
            <text content={fg(colors.error)(`✗ ${runError}`)} />
            <text content="" />
          </>
        )}
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
