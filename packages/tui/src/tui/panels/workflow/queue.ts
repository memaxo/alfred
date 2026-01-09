import type { Workflow } from "../../subscriptions/workflow";
import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

export function renderQueueItem(
  workflow: Workflow,
  index: number,
  width: number
): string {
  const n = dim(String(index + 1).padStart(2, " "));
  const name = truncate(workflow.name, Math.max(10, width - 10));
  return `  ${n}. ${fg(colors.primary)(name)}`;
}
