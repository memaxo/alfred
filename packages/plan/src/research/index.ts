import type { WorkflowIntent } from "../intent/types.js";
import type { ResearchOptions, ResearchResult } from "./types.js";

import { aggregateResearch } from "./aggregate.js";
import { gatherExternalResearch } from "./external.js";
import { gatherInternalResearch } from "./internal.js";

export * from "./aggregate.js";
export * from "./codebase.js";
export * from "./conventions.js";
export * from "./dedupe.js";
export * from "./external.js";
export * from "./filter.js";
export * from "./internal.js";
export * from "./patterns.js";
export * from "./prioritize.js";
export * from "./schema.js";
export * from "./score.js";
export * from "./token.js";
export * from "./types.js";

/**
 * High-level research aggregator for workflow planning.
 * Combines external and internal research into a validated ResearchResult.
 */
export async function gatherResearch(
  intent: WorkflowIntent,
  projectId?: string,
  options?: ResearchOptions
): Promise<ResearchResult> {
  // 1. Gather external research (P1-3)
  const external = await gatherExternalResearch(intent, options);

  // 2. Gather internal research (P1-4)
  const internal = await gatherInternalResearch(intent, projectId);

  // 3. Aggregate into unified result (P1-5)
  const result = await aggregateResearch(external, internal, {
    maxTokens: 8000,
    deduplicate: true,
    prioritize: "balanced",
  });

  return result;
}

// Alias gatherFullResearch to gatherResearch for easier transition if needed
export { gatherResearch as gatherFullResearchInternal };
