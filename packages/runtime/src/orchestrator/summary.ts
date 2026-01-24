import { getOpenAI } from "@alfred/agent/v6";
import { generateText } from "ai";

import type { AgentOutcome } from "./agent.js";
import type { FileChanges } from "./types.js";

/**
 * Generate a concise human-readable summary of the changes made by a wave of agents.
 */
export async function generateWaveSummary(
  outcomes: AgentOutcome[],
  changes: FileChanges
): Promise<string> {
  if (outcomes.length === 0) {
    return "No agents were executed in this wave.";
  }

  const prompt = `Summarize the accomplishments of the following AI agents in a single concise sentence.
Focus on what was changed and why.

Agent Outcomes:
${outcomes
  .map((o) => `- Agent ${o.agentId}: ${o.result?.summary ?? "Completed tasks"}`)
  .join("\n")}

File Changes:
- Modified: ${changes.modified.join(", ") || "None"}
- Created: ${changes.created.join(", ") || "None"}
- Deleted: ${changes.deleted.join(", ") || "None"}

Summary (max 200 characters):`;

  try {
    const { text } = await generateText({
      model: getOpenAI()("gpt-4o-mini") as any, // Use lightweight model for summaries
      prompt,
      maxTokens: 100,
    } as any);

    return text.trim();
  } catch (_error) {
    return outcomes
      .map((o) => o.result?.summary)
      .filter(Boolean)
      .join("; ")
      .slice(0, 200);
  }
}
