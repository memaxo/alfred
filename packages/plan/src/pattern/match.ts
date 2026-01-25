import type { WorkflowPattern } from "@alfred/db/repo/pattern";

import { patternRepo } from "@alfred/db";
import { embed } from "@alfred/rag";

import type { StructuredPlan } from "../types.js";

export interface MatchOptions {
  minSimilarity?: number;
  maxResults?: number;
  requireStructuralMatch?: boolean;
}

export interface CategorizedPatterns {
  autoSuggest: (WorkflowPattern & { similarity: number })[];
  requireConfirmation: (WorkflowPattern & { similarity: number })[];
  lowConfidence: (WorkflowPattern & { similarity: number })[];
}

/**
 * Match relevant workflow patterns for a new intent.
 */
export async function matchPatterns(
  intent: string,
  projectId?: string,
  options?: MatchOptions
): Promise<(WorkflowPattern & { similarity: number })[]> {
  const minSimilarity = options?.minSimilarity ?? 0.7;
  const maxResults = options?.maxResults ?? 5;

  // 1. Embed intent
  const intentEmbedding = await embed(intent);

  // 2. Query DB for semantic matches (knowledge graph handles sync, but DB has vectors)
  const matches = await patternRepo.searchPatterns(
    intentEmbedding,
    maxResults * 2, // Fetch more for filtering
    minSimilarity,
    projectId
  );

  // 3. Structural validation (heuristic)
  const validated =
    options?.requireStructuralMatch !== false
      ? await validateStructural(matches, intent)
      : matches;

  // 4. Sort and limit
  const results = validated
    .map((m) => ({
      ...m,
      similarity: m.score, // score is similarity from searchPatterns
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);

  // 5. Update lastUsedAt for matched patterns
  if (results.length > 0) {
    void (async () => {
      for (const res of results) {
        await patternRepo.updatePattern(res.id, { lastUsedAt: new Date() });
      }
    })();
  }

  return results;
}

/**
 * Categorize matched patterns based on confidence (similarity * successRate).
 */
export function categorizePatterns(
  patterns: (WorkflowPattern & { similarity: number })[]
): CategorizedPatterns {
  const result: CategorizedPatterns = {
    autoSuggest: [],
    requireConfirmation: [],
    lowConfidence: [],
  };

  for (const pattern of patterns) {
    const successRate = Number.parseFloat(pattern.successRate);
    const confidence = pattern.similarity * successRate;

    if (confidence >= 0.85) {
      result.autoSuggest.push(pattern);
    } else if (confidence >= 0.7) {
      result.requireConfirmation.push(pattern);
    } else {
      result.lowConfidence.push(pattern);
    }
  }

  return result;
}

/**
 * Heuristic structural validation.
 * Checks if the pattern complexity roughly matches intent complexity.
 */
async function validateStructural(
  patterns: (WorkflowPattern & { score: number })[],
  intent: string
): Promise<(WorkflowPattern & { score: number })[]> {
  // Simple complexity estimate: number of lines or words
  const intentWordCount = intent.split(/\s+/).length;

  return patterns.filter((pattern) => {
    const template = pattern.planTemplate as unknown as StructuredPlan;
    const phaseCount = template.phases?.length ?? 0;

    // Heuristic: More complex intents should have more phases
    if (intentWordCount > 20 && phaseCount < 2) {
      return false;
    }
    if (intentWordCount < 5 && phaseCount > 5) {
      return false;
    }

    return true;
  });
}
