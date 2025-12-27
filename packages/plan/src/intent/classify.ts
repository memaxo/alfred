import type { WorkflowIntent } from "./types.js";

/**
 * classifyIntent: Classify intent into broad categories using regex patterns
 */
export async function classifyIntent(intent: WorkflowIntent): Promise<string> {
  await Promise.resolve(); // satisfy lint for async
  const description = intent.description.toLowerCase();

  const patterns = [
    { category: "fix", regex: /\b(fix|bug|issue|error|broken|fail)\b/i },
    {
      category: "feat",
      regex: /\b(add|create|new|implement|feature|support)\b/i,
    },
    { category: "refactor", regex: /\b(refactor|clean|improve|optimize)\b/i },
    { category: "test", regex: /\b(test|spec|unit|integration|e2e)\b/i },
    { category: "docs", regex: /\b(docs?|documentation|readme|comment)\b/i },
    {
      category: "chore",
      regex: /\b(chore|deps?|dependencies|update|build)\b/i,
    },
  ];

  for (const { category, regex } of patterns) {
    if (regex.test(description)) {
      return category;
    }
  }

  return "misc";
}
