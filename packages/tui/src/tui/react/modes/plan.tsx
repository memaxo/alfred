/**
 * Plan Mode - React Component
 *
 * Interactive workflow planning - describe a task, review the plan, execute.
 * Migrated from packages/tui/src/tui/modes/plan.ts
 */

/** @jsxImportSource @opentui/react */

import type { KeyEvent } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useCallback, useState } from "react";
import { getApiClient } from "../../api/client";

export type PlanModeProps = {
  isOpen: boolean;
  onClose: () => void;
};

type PlanApiTask = { title?: string; description?: string };
type PlanApiPlan = {
  summary?: string;
  tasks?: PlanApiTask[];
  estimatedTime?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parsePlan(plan: unknown): PlanApiPlan | null {
  if (!isRecord(plan)) {
    return null;
  }

  const summary = typeof plan.summary === "string" ? plan.summary : undefined;
  const estimatedTime =
    typeof plan.estimatedTime === "string" ? plan.estimatedTime : undefined;

  const rawTasks = plan.tasks;
  const tasks = Array.isArray(rawTasks)
    ? rawTasks.filter(isRecord).map((t) => ({
        title: typeof t.title === "string" ? t.title : undefined,
        description:
          typeof t.description === "string" ? t.description : undefined,
      }))
    : undefined;

  return { summary, tasks, estimatedTime };
}

type PlanPhase =
  | "input"
  | "generating"
  | "review"
  | "executing"
  | "complete"
  | "error";

type PlanTask = {
  id: string;
  title: string;
  status: "pending" | "running" | "complete" | "error";
  description?: string;
};

type GeneratedPlan = {
  summary: string;
  tasks: PlanTask[];
  estimatedTime?: string;
};

export function PlanMode({ isOpen, onClose }: PlanModeProps) {
  const { width, height } = useTerminalDimensions();
  const [phase, setPhase] = useState<PlanPhase>("input");
  const [inputValue, setInputValue] = useState("");
  const [requirement, setRequirement] = useState("");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const apiClient = getApiClient();

  const generatePlan = useCallback(
    async (req: string) => {
      setPhase("generating");
      setRequirement(req);
      setError(null);

      try {
        const result = await apiClient.startWorkflow(req, "read");

        if (result.error) {
          setPhase("error");
          setError(result.error.message);
          return;
        }

        const planData = parsePlan(result.data?.plan);
        if (planData) {
          setPlan({
            summary: planData.summary ?? req,
            tasks:
              planData.tasks?.map((t, i) => ({
                id: String(i),
                title: t.title ?? `Task ${i + 1}`,
                status: "pending",
                description: t.description,
              })) ?? [],
            estimatedTime: planData.estimatedTime,
          });
        } else {
          setPlan({
            summary: req,
            tasks: [
              {
                id: "1",
                title: "Execute requirement",
                status: "pending",
                description: req,
              },
            ],
          });
        }
        setPhase("review");
        setSelectedTaskIndex(0);
      } catch (err) {
        setPhase("error");
        setError((err as Error).message);
      }
    },
    [apiClient]
  );

  const executePlan = useCallback(async () => {
    if (!plan) {
      return;
    }
    setPhase("executing");

    // Simulate execution
    const updatedTasks = [...plan.tasks];
    for (let i = 0; i < updatedTasks.length; i++) {
      const task = updatedTasks[i];
      if (task) {
        task.status = "running";
        setPlan({ ...plan, tasks: [...updatedTasks] });
        setSelectedTaskIndex(i);
        await new Promise((r) => setTimeout(r, 800));
        task.status = "complete";
        setPlan({ ...plan, tasks: [...updatedTasks] });
      }
    }

    setPhase("complete");
  }, [plan]);

  const handleKeyboard = useCallback(
    (event: KeyEvent) => {
      if (!isOpen) {
        return;
      }

      const alt = (event as { alt?: boolean }).alt ?? false;

      if (event.name === "escape") {
        if (phase === "generating" || phase === "review") {
          setPhase("input");
          return;
        }
        onClose();
        return;
      }

      if (phase === "input") {
        if (event.name === "enter") {
          void generatePlan(inputValue);
          return;
        }
        if (event.name === "backspace") {
          setInputValue((v) => v.slice(0, -1));
          return;
        }
        if (event.name.length === 1 && !event.ctrl && !alt) {
          setInputValue((v) => v + event.name);
          return;
        }
      }

      if (phase === "review") {
        if (event.name === "up" || event.name === "k") {
          setSelectedTaskIndex((i) => Math.max(0, i - 1));
          return;
        }
        if (event.name === "down" || event.name === "j") {
          if (plan) {
            setSelectedTaskIndex((i) => Math.min(plan.tasks.length - 1, i + 1));
          }
          return;
        }
        if (event.name === "enter") {
          void executePlan();
          return;
        }
        if (event.name === "e") {
          setPhase("input");
          return;
        }
      }

      if (
        (phase === "complete" || phase === "error") &&
        event.name === "enter"
      ) {
        setPhase("input");
        setInputValue("");
        setPlan(null);
        return;
      }
    },
    [isOpen, onClose, phase, inputValue, plan, generatePlan, executePlan]
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
        title="ALFRED Planner"
        width={width}
      >
        <scrollbox focused={true}>
          {phase === "input" && (
            <box style={{ padding: 1 }}>
              <text content="" />
              <text
                content=" Describe what you want to accomplish:"
                style={{ fg: "#8A9199" }}
              />
              <text content="" />
              <text
                content={` > ${inputValue}${inputValue ? "▌" : "▌"}`}
                style={{ fg: "#E6E6E6" }}
              />
              <text content="" />
              <text
                content=" Press Enter to generate an execution plan."
                style={{ fg: "#5C6370" }}
              />
            </box>
          )}

          {phase === "generating" && (
            <box style={{ padding: 1 }}>
              <text content="" />
              <text content=" Generating plan..." style={{ fg: "#39BAE6" }} />
              <text content="" />
              <text content={` "${requirement}"`} style={{ fg: "#8A9199" }} />
            </box>
          )}

          {phase === "review" && plan && (
            <box style={{ padding: 1 }}>
              <text content=" Plan Summary:" style={{ attributes: 1 }} />
              <text content={`  ${plan.summary}`} style={{ fg: "#E6E6E6" }} />
              {plan.estimatedTime && (
                <text
                  content={`  Estimated time: ${plan.estimatedTime}`}
                  style={{ fg: "#8A9199" }}
                />
              )}
              <text content="" />
              <text content=" Tasks:" style={{ attributes: 1 }} />
              {plan.tasks.map((task, i) => {
                const isSelected = i === selectedTaskIndex;
                return (
                  <box key={task.id}>
                    <text
                      content={`  ${isSelected ? "▸" : " "} ${i + 1}. ${task.title}`}
                      style={{ fg: isSelected ? "#39BAE6" : "#E6E6E6" }}
                    />
                    {isSelected && task.description && (
                      <text
                        content={`      ${task.description}`}
                        style={{ fg: "#8A9199" }}
                      />
                    )}
                  </box>
                );
              })}
              <text content="" />
              <text
                content=" Press Enter to execute, e to edit, Esc to cancel."
                style={{ fg: "#5C6370" }}
              />
            </box>
          )}

          {phase === "executing" && plan && (
            <box style={{ padding: 1 }}>
              <text content=" Executing plan..." style={{ attributes: 1 }} />
              <text content="" />
              {plan.tasks.map((task) => {
                let icon = "○";
                let color = "#5C6370";
                if (task.status === "running") {
                  icon = "●";
                  color = "#39BAE6";
                } else if (task.status === "complete") {
                  icon = "✓";
                  color = "#98C379";
                } else if (task.status === "error") {
                  icon = "✗";
                  color = "#E06C75";
                }
                return (
                  <text
                    content={` ${icon} ${task.title}`}
                    key={task.id}
                    style={{ fg: color }}
                  />
                );
              })}
            </box>
          )}

          {phase === "complete" && (
            <box style={{ padding: 1 }}>
              <text content="" />
              <text
                content=" ✓ Plan executed successfully!"
                style={{ fg: "#98C379" }}
              />
              <text content="" />
              <text
                content=" Press Enter to create a new plan, Esc to exit."
                style={{ fg: "#5C6370" }}
              />
            </box>
          )}

          {phase === "error" && (
            <box style={{ padding: 1 }}>
              <text content="" />
              <text content={` ✗ Error: ${error}`} style={{ fg: "#E06C75" }} />
              <text content="" />
              <text
                content=" Press Enter to retry, Esc to exit."
                style={{ fg: "#5C6370" }}
              />
            </box>
          )}
        </scrollbox>
      </box>

      {/* Footer */}
      <box
        height={1}
        style={{ backgroundColor: "#39BAE6" }}
        top={height - 1}
        width={width}
      >
        <text
          content={
            phase === "input"
              ? " [Enter] Generate | [Esc] Exit"
              : phase === "review"
                ? " [Enter] Execute | [e] Edit | [Esc] Cancel"
                : " [Enter] Back | [Esc] Exit"
          }
          style={{ fg: "#0A0E14" }}
        />
      </box>
    </box>
  );
}
