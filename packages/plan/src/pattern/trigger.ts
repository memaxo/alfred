import { generateText } from "ai";

import { getModelId, getOpenAI } from "../ai.js";

/**
 * Extract a short semantic trigger phrase from an intent string.
 */
export async function extractTrigger(intent: string): Promise<string> {
  const result = await generateText({
    model: getOpenAI()(getModelId()),
    prompt: `Extract a short semantic trigger phrase (kebab-case) from this intent: "${intent}"
    
Examples:
- "Add dark mode toggle" → "add-ui-feature"
- "Fix login bug" → "fix-bug"
- "Refactor authentication" → "refactor-feature"
- "Create user profile page" → "create-page"

Trigger:`,
    maxOutputTokens: 20,
  });

  return result.text.trim().toLowerCase();
}
