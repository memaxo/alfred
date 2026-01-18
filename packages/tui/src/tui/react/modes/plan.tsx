/**
 * Plan Mode - Interactive Plan Review
 *
 * Displays wave/task tree with keyboard navigation.
 * Allows viewing and executing workflow plans.
 */

/** @jsxImportSource @opentui/react */

import type { SubTask, WavePlan } from "@alfred/pipeline/schemas";
import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useState } from "react";

export type PlanModeProps = {
  isOpen: boolean;
  onClose: () => void;
  onExecute?: (runId: string) => void;
};

type PlanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; runId: string; waves: WavePlan[]; subtasks: SubTask[] }
  | { status: "error"; error: string };

export function PlanMode({ isOpen, onClose, onExecute }: PlanModeProps) {
  const { width, height } = useTerminalDimensions();
  const [plan, _setPlan] = useState<PlanState>({ status: "idle" });
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(0);
  const [expandedWaves, setExpandedWaves] = useState<Set<string>>(new Set());

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      if (event.name === "escape" || event.name === "q") {
        onClose();
        return;
      }

      if (plan.status !== "loaded") {
        return;
      }

      // Navigate waves
      if (event.name === "j" || event.name === "down") {
        setSelectedWaveIndex((prev) =>
          Math.min(prev + 1, plan.waves.length - 1)
        );
        return;
      }

      if (event.name === "k" || event.name === "up") {
        setSelectedWaveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      // Toggle wave expansion
      if (event.name === "return") {
        const wave = plan.waves[selectedWaveIndex];
        if (wave) {
          setExpandedWaves((prev) => {
            const next = new Set(prev);
            if (next.has(wave.id)) {
              next.delete(wave.id);
            } else {
              next.add(wave.id);
            }
            return next;
          });
        }
        return;
      }

      // Execute plan
      if (event.name === "e" || event.name === "x") {
        onExecute?.(plan.runId);
        return;
      }

      // Expand all
      if (event.name === "a") {
        setExpandedWaves(new Set(plan.waves.map((w) => w.id)));
        return;
      }

      // Collapse all
      if (event.name === "c") {
        setExpandedWaves(new Set());
        return;
      }
    },
    [isOpen, plan, selectedWaveIndex, onClose, onExecute]
  );

  useKeyboard(handleKeyboard);

  if (!isOpen) {
    return null;
  }

  return (
    <box
      height={height}
      left={0}
      style={{ backgroundColor: "#0A0E14" }}
      top={0}
      width={width}
    >
      <box
        border
        height={height - 1}
        style={{ borderStyle: "single", borderColor: "#39BAE6" }}
        title="Plan Review"
        width={width}
      >
        <scrollbox focused={true}>
          {plan.status === "idle" && (
            <>
              <text content="" />
              <text
                content=" No plan loaded. Use 'alfred plan' to generate a plan."
                style={{ fg: "#8A9199" }}
              />
              <text content="" />
              <text
                content=" Press Esc/q to return to dashboard."
                style={{ fg: "#39BAE6" }}
              />
            </>
          )}

          {plan.status === "loading" && (
            <>
              <text content="" />
              <text content=" Loading plan..." style={{ fg: "#F07178" }} />
            </>
          )}

          {plan.status === "error" && (
            <>
              <text content="" />
              <text
                content={` Error: ${plan.error}`}
                style={{ fg: "#FF3333" }}
              />
              <text content="" />
              <text
                content=" Press Esc/q to return to dashboard."
                style={{ fg: "#39BAE6" }}
              />
            </>
          )}

          {plan.status === "loaded" && (
            <>
              <text content="" />
              <text
                content={` Run ID: ${plan.runId}`}
                style={{ fg: "#8A9199" }}
              />
              <text
                content={` Waves: ${plan.waves.length} | Subtasks: ${plan.subtasks.length}`}
                style={{ fg: "#8A9199" }}
              />
              <text content="" />

              <text content=" Waves:" style={{ fg: "#39BAE6" }} />
              <text content="" />

              {plan.waves.map((wave, index) => {
                const isSelected = index === selectedWaveIndex;
                const isExpanded = expandedWaves.has(wave.id);
                const prefix = isSelected ? "→ " : "  ";
                const expandIcon = isExpanded ? "▼" : "▶";
                const deps =
                  wave.dependsOn.length > 0
                    ? ` (depends: ${wave.dependsOn.join(", ")})`
                    : "";

                const waveTasks = plan.subtasks.filter((task) =>
                  wave.agents.includes(task.id)
                );

                return (
                  <>
                    <text
                      content={`${prefix}${expandIcon} Wave ${wave.id}: ${wave.agents.length} agents${deps}`}
                      style={{
                        fg: isSelected ? "#FFB454" : "#8A9199",
                      }}
                    />

                    {isExpanded &&
                      waveTasks.map((task) => (
                        <text
                          content={`     - ${task.id}: ${task.title.slice(0, 60)}${task.title.length > 60 ? "..." : ""}`}
                          key={task.id}
                          style={{ fg: "#59C2FF" }}
                        />
                      ))}
                  </>
                );
              })}

              <text content="" />
              <text content=" Controls:" style={{ fg: "#8A9199" }} />
              <text content="  j/↓     Next wave" style={{ fg: "#39BAE6" }} />
              <text
                content="  k/↑     Previous wave"
                style={{ fg: "#39BAE6" }}
              />
              <text content="  Enter   Toggle wave" style={{ fg: "#39BAE6" }} />
              <text content="  a       Expand all" style={{ fg: "#39BAE6" }} />
              <text
                content="  c       Collapse all"
                style={{ fg: "#39BAE6" }}
              />
              <text
                content="  e/x     Execute plan"
                style={{ fg: "#FFB454" }}
              />
              <text content="  Esc/q   Exit" style={{ fg: "#39BAE6" }} />
            </>
          )}
        </scrollbox>
      </box>
    </box>
  );
}
