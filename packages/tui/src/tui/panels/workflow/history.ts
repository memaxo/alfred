import type { Workflow } from "../../subscriptions/workflow";
import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

export function renderHistoryItem(workflow: Workflow, width: number): string {
  const icon =
    workflow.status === "completed"
      ? fg(colors.success)("✓")
      : workflow.status === "failed"
        ? fg(colors.error)("✗")
        : dim("•");

  const name = truncate(workflow.name, Math.max(10, width - 16));
  const time = workflow.completedAt
    ? dim(
        new Date(workflow.completedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    : "";
  const err = workflow.error
    ? dim(` ${truncate(workflow.error, Math.max(6, width - 20))}`)
    : "";
  return `  ${icon} ${fg(colors.primary)(name)} ${time}${err}`;
}
