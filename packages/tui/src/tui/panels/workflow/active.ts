import { colors } from "../../theme";
import { bold, dim, fg, progressBar, truncate } from "../../typography";

export type ActiveWorkflow = {
  runId: string;
  intent: string;
  status: "pending" | "executing" | "completed" | "failed";
  phase?: string;
  progress?: number;
  startedAt?: Date;
};

export function renderWorkflowProgress(
  workflow: ActiveWorkflow,
  width: number
): string[] {
  const barWidth = Math.max(8, Math.min(22, width - 26));
  const p = Math.max(0, Math.min(1, workflow.progress ?? 0));
  const color =
    workflow.status === "failed"
      ? colors.error
      : workflow.status === "completed"
        ? colors.success
        : colors.primary;
  const bar = progressBar(p, barWidth, { color });
  const phase = workflow.phase ? dim(` ${workflow.phase}`) : "";
  const title = truncate(workflow.intent, Math.max(10, width - 10));

  return [
    `${bold("Workflow:")} ${fg(color)(workflow.runId)}${phase}`,
    `  ${title}`,
    `  ${bar} ${dim(`${Math.round(p * 100)}%`)}`,
  ];
}
