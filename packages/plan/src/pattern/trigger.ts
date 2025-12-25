import { generateText } from "ai";
import { getOpenAI, getModelId } from "@alfred/agent/v6";

/**
 * Extract a short semantic trigger phrase from an intent string.
 */
export async function extractTrigger(intent: string): Promise<string> {
  const result = await generateText({
    model: getOpenAI()(getModelId()) as any,
    prompt: `Extract a short semantic trigger phrase (kebab-case) from this intent: "${intent}"
    
Examples:
- "Add dark mode toggle" → "add-ui-feature"
- "Fix login bug" → "fix-bug"
- "Refactor authentication" → "refactor-feature"
- "Create user profile page" → "create-page"

Trigger:`,
    maxTokens: 20,
  });

  return result.text.trim().toLowerCase();
}
