import { z } from "zod";

export const criticInputSchema = z.object({
  requirement: z.string(),
  architecture: z.string(),
  plan: z.string(), // The ExecPlan content
});

export type CriticInput = z.infer<typeof criticInputSchema>;

export function generateCriticPrompt(input: CriticInput): string {
  return `You are a Senior Code Reviewer and Critic.
Your goal is to REVIEW the proposed Implementation Plan against the Architecture and Requirement.

Requirement: "${input.requirement}"

Architecture:
${input.architecture}

Proposed Plan:
${input.plan}

Instructions:
1. Verify the Plan covers all requirements from the Architecture.
2. Check for logical ordering (e.g. DB before API).
3. Identify any dangerous operations (deletion without backup, broad permissions).
4. Check for vague steps ("Implement logic") vs concrete steps ("Create file X with function Y").

Output Format:
Return a JSON object:
{
  "status": "approved" | "rejected",
  "feedback": "Specific actionable feedback...",
  "score": number (0-100)
}
`;
}
