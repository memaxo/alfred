import type { WorkflowIntent } from "./types.js";

/**
 * clarifyIntent: Update an intent with a user's clarification response
 */
export function clarifyIntent(
  intent: WorkflowIntent,
  questionId: string,
  response: string
): WorkflowIntent {
  // Update description or metadata based on response
  // For now, we append the response to the description
  return {
    ...intent,
    description: `${intent.description} (Clarification: ${response})`,
    // Remove the answered question
    ambiguity: intent.ambiguity ? {
      ...intent.ambiguity,
      questions: intent.ambiguity.questions.filter((q) => q.id !== questionId),
    } : undefined,
  };
}
