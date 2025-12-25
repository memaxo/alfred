import type { AgentOutcome } from "./agent.js";
import { detectFileChanges, getGitDiffSummary } from "./changes.js";
import { generateWaveSummary } from "./summary.js";
import type { AgentHandoff } from "./types.js";

/**
 * Generate a handoff object from one wave to another.
 */
export async function generateHandoff(
  fromWaveId: string,
  toWaveId: string,
  outcomes: AgentOutcome[],
  workspace: string
): Promise<AgentHandoff> {
  // 1. Detect file changes
  const changes = await detectFileChanges(workspace);

  // 2. Get git diff summary
  const gitDiff = await getGitDiffSummary(workspace);

  // 3. Generate human-readable summary
  const summary = await generateWaveSummary(outcomes, changes);

  return {
    fromWaveId,
    toWaveId,
    summary,
    changes,
    gitDiff,
    timestamp: new Date(),
  };
}

/**
 * Format a handoff into a prompt snippet for subsequent agents.
 */
export function formatHandoffPrompt(handoff: AgentHandoff): string {
  return `
PREVIOUS WAVE ACCOMPLISHMENTS (Handoff from ${handoff.fromWaveId}):
Summary: ${handoff.summary}

Files Modified: ${handoff.changes.modified.join(", ") || "None"}
Files Created: ${handoff.changes.created.join(", ") || "None"}
Files Deleted: ${handoff.changes.deleted.join(", ") || "None"}

Git Diff Summary:
${handoff.gitDiff ?? "No diff available."}
`;
}
