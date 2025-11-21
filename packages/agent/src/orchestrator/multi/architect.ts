import { z } from "zod";

export const architectInputSchema = z.object({
  requirement: z.string(),
  bundleSummary: z.string(),
  runId: z.string(),
});

export type ArchitectInput = z.infer<typeof architectInputSchema>;

export function generateArchitectPrompt(input: ArchitectInput): string {
  return `You are a Senior System Architect.
Your goal is to produce a TECHNICAL SPECIFICATION (ARCHITECTURE.md) for the requested feature.

Request: "${input.requirement}"
Run ID: ${input.runId}

Context Summary:
${input.bundleSummary}

Instructions:
1. Analyze the requirement and the existing codebase context.
2. Define the Database Schema changes (if any).
3. Define the API Contracts (tRPC/REST endpoints, inputs/outputs).
4. Define the Core Interfaces/Types.
5. Identify Security Risks (AuthZ, validation).
6. List Implementation Steps in dependency order.

Output Format:
Return the content of ARCHITECTURE.md.
Use Markdown.
Be specific and technical.
`;
}
