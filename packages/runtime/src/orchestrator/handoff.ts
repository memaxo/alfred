import {
  type DecisionRecord,
  type StructuredHandoff,
  type ToolAvoidance,
} from "@alfred/type";

import { type AgentOutcome } from "./agent.js";
import { detectFileChanges, getGitDiffSummary } from "./changes.js";
import { generateWaveSummary } from "./summary.js";
import { type AgentHandoff } from "./types.js";

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
    changes,
    fromWaveId,
    gitDiff,
    summary,
    timestamp: new Date(),
    toWaveId,
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

// ─────────────────────────────────────────────────────────────────────────────
// Structured Handoff (Enrichment System)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract decisions from agent outcomes.
 * Decisions are stored in outcome metadata by agents using the decision tool.
 */
function extractDecisions(outcomes: AgentOutcome[]): DecisionRecord[] {
  const decisions: DecisionRecord[] = [];

  for (const outcome of outcomes) {
    // Check for decisions in result notes
    if (outcome.result?.notes) {
      for (const note of outcome.result.notes) {
        if (note.startsWith("DECISION:")) {
          const parts = note.replace("DECISION:", "").split("|");
          if (parts.length >= 2) {
            decisions.push({
              confidence: "medium",
              decision: parts[0]?.trim() ?? "",
              rationale: parts[1]?.trim() ?? "",
            });
          }
        }
      }
    }
  }

  return decisions;
}

/**
 * Extract tools to avoid from failure contexts.
 */
function extractToolsToAvoid(outcomes: AgentOutcome[]): ToolAvoidance[] {
  const toolsToAvoid: ToolAvoidance[] = [];
  const seen = new Set<string>();

  for (const outcome of outcomes) {
    if (outcome.failureContext) {
      for (const err of outcome.failureContext.toolErrors) {
        if (err.count >= 2 && !seen.has(err.tool)) {
          seen.add(err.tool);
          toolsToAvoid.push({
            reason: `Failed ${err.count} times: ${err.error.slice(0, 100)}`,
            tool: err.tool,
          });
        }
      }
    }
  }

  return toolsToAvoid;
}

/**
 * Extract blockers from failed/stuck outcomes.
 */
function extractBlockers(outcomes: AgentOutcome[]): string[] {
  const blockers: string[] = [];

  for (const outcome of outcomes) {
    if (outcome.status !== "success") {
      const taskId = outcome.agentId.split(":").pop() ?? outcome.agentId;
      if (outcome.escalation) {
        blockers.push(`Task ${taskId}: ${outcome.escalation}`);
      } else if (outcome.stuck) {
        blockers.push(`Task ${taskId}: Agent stuck (loop or stall detected)`);
      } else if (outcome.failureContext?.stuckReason) {
        blockers.push(`Task ${taskId}: ${outcome.failureContext.stuckReason}`);
      } else {
        blockers.push(`Task ${taskId}: Failed with status ${outcome.status}`);
      }
    }
  }

  return blockers;
}

/**
 * Build a structured handoff with rich context for downstream agents.
 *
 * This enhanced handoff includes:
 * - File changes (modified, created, deleted)
 * - Decisions made during execution
 * - Tools that should be avoided
 * - Known blockers from failed tasks
 */
export async function buildStructuredHandoff(
  fromWaveId: string,
  _toWaveId: string,
  outcomes: AgentOutcome[],
  workspace: string
): Promise<StructuredHandoff> {
  const changes = await detectFileChanges(workspace);
  const summary = await generateWaveSummary(outcomes, changes);

  const decisions = extractDecisions(outcomes);
  const toolsAvoided = extractToolsToAvoid(outcomes);
  const blockers = extractBlockers(outcomes);

  const fromTaskIds = outcomes.map((o) => {
    const parts = o.agentId.split(":");
    return parts.length > 1 ? (parts.at(-1) ?? o.agentId) : o.agentId;
  });

  return {
    summary,
    fromWaveId,
    fromTaskIds,
    filesModified: changes.modified,
    filesCreated: changes.created,
    filesDeleted: changes.deleted,
    decisions,
    toolsAvoided,
    openQuestions: [], // TODO: Extract from agent outputs if they surface questions
    blockers,
    ts: Date.now(),
  };
}

/**
 * Format structured handoff as a prompt snippet.
 */
export function formatStructuredHandoffPrompt(
  handoff: StructuredHandoff
): string {
  const sections: string[] = [
    `PREVIOUS WAVE ACCOMPLISHMENTS (Handoff from ${handoff.fromWaveId}):`,
    `Summary: ${handoff.summary}`,
    "",
    `Files Modified: ${handoff.filesModified.join(", ") || "None"}`,
    `Files Created: ${handoff.filesCreated.join(", ") || "None"}`,
    `Files Deleted: ${handoff.filesDeleted.join(", ") || "None"}`,
  ];

  if (handoff.decisions.length > 0) {
    sections.push("");
    sections.push("Decisions Made:");
    for (const d of handoff.decisions) {
      sections.push(`  - ${d.decision}: ${d.rationale}`);
    }
  }

  if (handoff.toolsAvoided.length > 0) {
    sections.push("");
    sections.push("Tools to Avoid:");
    for (const t of handoff.toolsAvoided) {
      sections.push(`  - ${t.tool}: ${t.reason}`);
    }
  }

  if (handoff.blockers.length > 0) {
    sections.push("");
    sections.push("Known Blockers:");
    for (const b of handoff.blockers) {
      sections.push(`  - ${b}`);
    }
  }

  return sections.join("\n");
}
