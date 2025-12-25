import type { Phase } from "./types.js";

/**
 * Assign agent types to phases based on task content
 */
export function assignAgentTypes(phases: Phase[]): Phase[] {
  return phases.map((phase) => {
    // 1. Research phase (contains web search or many research terms)
    const isResearch = phase.tasks.some(
      (t) =>
        t.title.toLowerCase().includes("research") ||
        t.title.toLowerCase().includes("investigate") ||
        t.requirement.toLowerCase().includes("web search")
    );
    if (isResearch) {
      return { ...phase, agentType: "research" };
    }

    // 2. Review phase (final testing or explicit review tasks)
    const isReview = phase.tasks.some(
      (t) =>
        t.title.toLowerCase().includes("review") ||
        t.title.toLowerCase().includes("audit") ||
        t.title.toLowerCase().includes("final check")
    );
    if (isReview) {
      return { ...phase, agentType: "review" };
    }

    // 3. Orchestrator phase (complex grouping or high-level setup)
    if (phase.name.toLowerCase().includes("setup") && phase.tasks.length > 5) {
      return { ...phase, agentType: "orchestrator" };
    }

    // Default: codex
    return { ...phase, agentType: "codex" };
  });
}
