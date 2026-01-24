import type { ResearchResult, ResearchSource } from "./types.js";

import { estimateSourceTokens, estimateTextTokens } from "./token.js";

export type PriorityMode = "external" | "internal" | "balanced";

/**
 * Balance and prioritize research sources based on mode and token budget
 */
export function prioritizeSources(
  external: ResearchSource[],
  internal: ResearchResult["internal"],
  maxTokens: number,
  mode: PriorityMode = "balanced"
): {
  external: ResearchSource[];
  internal: ResearchResult["internal"];
  totalTokens: number;
} {
  const ratios = {
    balanced: { external: 0.6, internal: 0.4 },
    external: { external: 0.8, internal: 0.2 },
    internal: { external: 0.2, internal: 0.8 },
  };

  const { external: extRatio } = ratios[mode];
  const extBudget = Math.floor(maxTokens * extRatio);
  const intBudget = maxTokens - extBudget;

  let currentExtTokens = 0;
  let currentIntTokens = 0;

  // 1. Prioritize external sources by relevance and reliability
  const selectedExternal: ResearchSource[] = [];
  const sortedExternal = [...external].sort((a, b) => {
    const scoreA = a.relevanceScore * 0.7 + a.reliability * 0.3;
    const scoreB = b.relevanceScore * 0.7 + b.reliability * 0.3;
    return scoreB - scoreA;
  });

  for (const source of sortedExternal) {
    const tokens = estimateSourceTokens(source);
    if (currentExtTokens + tokens <= extBudget) {
      selectedExternal.push(source);
      currentExtTokens += tokens;
    } else if (currentExtTokens < extBudget) {
      // Potentially truncate if it's the last one?
      // For now, let's just skip if it doesn't fit the sub-budget
      // The ticket says "Truncate last source if needed" - we'll handle that in aggregation
      break;
    }
  }

  // 2. Prioritize internal sources
  // We need to estimate tokens for internal items
  // Patterns and conventions are small. Code paths are also small.
  const selectedCode: string[] = [];
  const selectedPatterns: ResearchResult["internal"]["patterns"] = [];
  const selectedConventions: ResearchResult["internal"]["conventions"] = [];

  // Patterns first (high value)
  for (const p of internal.patterns) {
    const tokens = estimateTextTokens(p.name);
    if (currentIntTokens + tokens <= intBudget) {
      selectedPatterns.push(p);
      currentIntTokens += tokens;
    }
  }

  // Conventions next
  for (const c of internal.conventions) {
    const tokens = estimateTextTokens(c.description);
    if (currentIntTokens + tokens <= intBudget) {
      selectedConventions.push(c);
      currentIntTokens += tokens;
    }
  }

  // Code paths last
  for (const path of internal.existingCode) {
    const tokens = estimateTextTokens(path);
    if (currentIntTokens + tokens <= intBudget) {
      selectedCode.push(path);
      currentIntTokens += tokens;
    }
  }

  // 3. If there is remaining budget in one category, fill it with the other
  const remainingBudget = maxTokens - (currentExtTokens + currentIntTokens);
  if (remainingBudget > 0) {
    // Fill with more external if available
    for (const source of sortedExternal) {
      if (selectedExternal.includes(source)) {
        continue;
      }
      const tokens = estimateSourceTokens(source);
      if (currentExtTokens + currentIntTokens + tokens <= maxTokens) {
        selectedExternal.push(source);
        currentExtTokens += tokens;
      }
    }

    // Fill with more internal if available
    for (const path of internal.existingCode) {
      if (selectedCode.includes(path)) {
        continue;
      }
      const tokens = estimateTextTokens(path);
      if (currentExtTokens + currentIntTokens + tokens <= maxTokens) {
        selectedCode.push(path);
        currentIntTokens += tokens;
      }
    }
  }

  return {
    external: selectedExternal,
    internal: {
      existingCode: selectedCode,
      patterns: selectedPatterns,
      conventions: selectedConventions,
    },
    totalTokens: currentExtTokens + currentIntTokens,
  };
}
