import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import { PATTERN_ANCHORS } from "../ontology";

export type ReasoningPattern = "causal" | "decision" | "alternative";

const anchorByPattern = new Map<
  ReasoningPattern,
  (typeof PATTERN_ANCHORS)[number]
>(
  PATTERN_ANCHORS.map((anchor) => [anchor.pattern, anchor]) as [
    ReasoningPattern,
    (typeof PATTERN_ANCHORS)[number],
  ][]
);

const centroidCache = new Map<ReasoningPattern, Promise<number[]>>();

export async function getPatternCentroid(
  pattern: ReasoningPattern
): Promise<number[]> {
  if (!centroidCache.has(pattern)) {
    const anchor = anchorByPattern.get(pattern);
    if (!anchor) {
      throw new Error(`Unknown reasoning pattern: ${pattern}`);
    }

    centroidCache.set(
      pattern,
      embedMany([anchor.description])
        .then((vectors) => {
          const vector = vectors[0];
          if (!vector) {
            throw new Error(`Failed to embed pattern anchor ${anchor.label}`);
          }
          return vector;
        })
        .catch((error) => {
          centroidCache.delete(pattern);
          throw error;
        })
    );
  }

  return centroidCache.get(pattern)!;
}

export async function embedTextSamples(
  texts: string[]
): Promise<number[][]> {
  const sanitized = texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  if (!sanitized.length) {
    return [];
  }

  try {
    const vectors = await embedMany(sanitized);
    return vectors.filter((vector): vector is number[] => Array.isArray(vector));
  } catch (error) {
    logger.warn("knowledge_reasoning_embed_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export const scoreToConfidence = (score: number): number => {
  const normalized = (score + 1) / 2;
  return Math.min(0.98, Math.max(0.4, Number(normalized.toFixed(3))));
};
