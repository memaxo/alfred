/**
 * Voice Panel - React Component
 *
 * Migrated from packages/tui/src/tui/panels/voice/index.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useCallback, useEffect, useState } from "react";
import type { VoiceState } from "../../subscriptions/voice";
import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";
import { useVoiceStore } from "../hooks/stores";

type VoicePanelProps = {
  width: number;
  height: number;
  focused: boolean;
  x?: number;
  y?: number;
};

function getPipelineStatusDisplay(status: VoiceState["status"]): {
  icon: string;
  label: string;
  color: string;
} {
  switch (status) {
    case "offline":
      return { icon: "○", label: "Offline", color: colors.error };
    case "initializing":
      return { icon: "◎", label: "Initializing", color: colors.warning };
    case "standby":
      return { icon: "●", label: "Standby", color: colors.muted };
    case "listening":
      return { icon: "◉", label: "Listening", color: colors.primary };
    case "processing":
      return { icon: "◉", label: "Processing", color: colors.warning };
    case "speaking":
      return { icon: "●", label: "Speaking", color: colors.success };
  }
}

function bar(value: number, width: number): string {
  const w = Math.max(6, Math.min(24, width));
  const v = Math.max(0, Math.min(1, value));
  const filled = Math.round(v * w);
  return (
    progressChars.filled.repeat(filled) +
    progressChars.empty.repeat(Math.max(0, w - filled))
  );
}

function renderPoolLine(pool: VoiceState["sttPool"], width: number): string[] {
  const util = pool.maxWorkers > 0 ? pool.workers / pool.maxWorkers : 0;
  const meter = bar(util, Math.max(10, width - 22));
  return [
    `${bold(pool.name)}  ${pool.workers}/${pool.maxWorkers}  ${dim(meter)}`,
    dim(`  q=${pool.queueDepth}  processing=${pool.processing}`),
  ];
}

export function VoicePanel({ width, height, focused, x, y }: VoicePanelProps) {
  const store = useVoiceStore();
  const [state, setState] = useState<VoiceState | null>(null);

  const borderColor = focused ? "cyan" : undefined;

  useEffect(() => {
    if (!store) {
      return;
    }

    const unsub = store.subscribe((newState) => {
      setState(newState);
    });

    return unsub;
  }, [store]);

  const handleKeyboard = useCallback((_event: KeyEvent) => {
    // Voice panel has no special key handling
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
        title="Voice"
        top={y}
        width={width}
      >
        <text content={dim("  Loading voice status...")} />
      </box>
    );
  }

  const { status, sttPool, ttsPool, latency, activeSessions } = state;
  const statusDisplay = getPipelineStatusDisplay(status);
  const statusLine = `${fg(statusDisplay.color)(statusDisplay.icon)} ${bold(statusDisplay.label)}`;

  const lines: string[] = [];
  lines.push(statusLine);
  lines.push("");

  // Pools
  lines.push(bold(dim("Worker Pools")));
  lines.push(...renderPoolLine(sttPool, width));
  lines.push("");
  lines.push(...renderPoolLine(ttsPool, width));
  lines.push("");

  // Latency
  lines.push(bold(dim("Latency")));
  lines.push(
    `  STT  p50 ${Math.round(latency.sttP50)}ms  p99 ${Math.round(
      latency.sttP99
    )}ms`
  );
  lines.push(
    `  TTS  p50 ${Math.round(latency.ttsP50)}ms  p99 ${Math.round(
      latency.ttsP99
    )}ms`
  );
  lines.push("");

  // Sessions
  if (height > lines.length + 3 && activeSessions > 0) {
    lines.push(bold(dim("Sessions")));
    lines.push(`  active ${activeSessions}`);
  }

  return (
    <box
      border
      height={height}
      left={x}
      style={{
        borderColor: borderColor ?? "#FFFFFF",
        borderStyle: "single",
      }}
      title="Voice"
      top={y}
      width={width}
    >
      <scrollbox focused={focused}>
        {lines.map((line, i) => (
          <text content={line} key={i} />
        ))}
      </scrollbox>
    </box>
  );
}
