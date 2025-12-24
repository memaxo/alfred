import type { WorkflowIntent } from "./types.js";

/**
 * classifyIntent: Classify intent into broad categories
 */
export async function classifyIntent(intent: WorkflowIntent): Promise<string> {
  const description = intent.description.toLowerCase();
  if (description.includes("fix") || description.includes("bug")) {
    return "fix";
  }
  if (
    description.includes("add") ||
    description.includes("create") ||
    description.includes("new")
  ) {
    return "feat";
  }
  if (description.includes("refactor")) {
    return "refactor";
  }
  if (description.includes("test")) {
    return "test";
  }
  return "misc";
}
