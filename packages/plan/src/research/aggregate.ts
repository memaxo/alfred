import { logger } from "@alfred/logger";
import { deduplicateSources } from "./dedupe.js";
import { prioritizeSources, type PriorityMode } from "./prioritize.js";
import { researchResultSchema } from "./schema.js";
import type { ResearchResult } from "./types.js";

/**
 * Combine external and internal research into a unified ResearchResult
 * with token management, deduplication, and validation.
 */
export async function aggregateResearch(
  external: ResearchResult["external"],
  internal: ResearchResult["internal"],
  options?: {
    maxTokens?: number;
    deduplicate?: boolean;
    prioritize?: PriorityMode;
  }
): Promise<ResearchResult> {
  const startTime = Date.now();
  const maxTokens = options?.maxTokens ?? 8000;
  const doDedupe = options?.deduplicate ?? true;
  const priorityMode = options?.prioritize ?? "balanced";

  // 1. Deduplicate if requested
  let processedExt = external;
  let processedInt = internal;
  
  if (doDedupe) {
    const deduped = deduplicateSources(external, internal);
    processedExt = deduped.external;
    processedInt = deduped.internal;
  }

  // 2. Prioritize and enforce token limits
  const prioritized = prioritizeSources(
    processedExt,
    processedInt,
    maxTokens,
    priorityMode
  );

  // 3. Final validation and metadata
  const result: ResearchResult = {
    external: prioritized.external,
    internal: prioritized.internal,
    metadata: {
      totalSources: prioritized.external.length + prioritized.internal.existingCode.length,
      tokenCount: prioritized.totalTokens,
      researchDurationMs: Date.now() - startTime,
    },
  };

  try {
    return validateResearchResult(result);
  } catch (error) {
    logger.error("research_validation_failed", {
      error: error instanceof Error ? error.message : String(error),
      result,
    });
    // Return potentially invalid result as fallback, or rethrow?
    // Given the criticality, let's rethrow for now to catch schema issues early.
    throw error;
  }
}

/**
 * Validate ResearchResult against Zod schema
 */
export function validateResearchResult(result: unknown): ResearchResult {
  return researchResultSchema.parse(result);
}
