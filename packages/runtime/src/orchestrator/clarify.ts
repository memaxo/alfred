import type { AgentOutcome } from "./agent.js";
import type { ClarificationRequest, OrchestratorContext } from "./types.js";

/**
 * Detect if an agent output contains a request for clarification.
 */
export async function detectClarification(
  outcome: AgentOutcome,
  ctx: OrchestratorContext
): Promise<ClarificationRequest | null> {
  // Check for explicit clarification metadata in agent result
  const result = outcome.result;
  if (!result) return null;

  // Placeholder logic for detecting clarification from summary or notes.
  // In a real scenario, the agent would return a structured field.
  const summary = result.summary.toLowerCase();

  if (
    summary.includes("clarify") ||
    summary.includes("question") ||
    summary.includes("uncertain")
  ) {
    return {
      id: crypto.randomUUID(),
      runId: ctx.runId,
      phaseId: outcome.phaseId ?? "",
      agentId: outcome.agentId,
      question: result.summary,
      required: true,
      timestamp: new Date(),
    };
  }

  // Also check notes for explicit clarification markers
  const clarificationNote = result.notes.find((n) =>
    n.toLowerCase().startsWith("clarification:")
  );
  if (clarificationNote) {
    return {
      id: crypto.randomUUID(),
      runId: ctx.runId,
      phaseId: outcome.phaseId ?? "",
      agentId: outcome.agentId,
      question: clarificationNote.replace(/^clarification:/i, "").trim(),
      required: true,
      timestamp: new Date(),
    };
  }

  return null;
}
