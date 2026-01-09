import { logger } from "@alfred/logger";
import type { LearnedPattern } from "./types.js";

/**
 * Lookup learned workflow patterns for the given intent
 */
export async function lookupPatterns(
  intent: string,
  projectId?: string
): Promise<LearnedPattern[]> {
  const trimmed = intent.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const { matchPatterns } = await import("../pattern/match.js");
    const matches = await matchPatterns(trimmed, projectId, {
      maxResults: 5,
      minSimilarity: 0.65,
    });

    return matches.map((pattern) => {
      const rate = Number.parseFloat(pattern.successRate);
      const successRate = Number.isFinite(rate) ? rate : 0;
      const confidence = Math.max(
        0,
        Math.min(1, pattern.similarity * successRate)
      );

      return {
        id: pattern.id,
        name: pattern.trigger,
        confidence,
      };
    });
  } catch (error) {
    logger.debug("internal_research_patterns_lookup_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
