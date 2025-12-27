import { createTokenEstimator } from "./token-utils.js";
import type { ResearchSource } from "./types.js";

const estimator = createTokenEstimator();

/**
 * Estimate tokens for a single research source
 */
export function estimateSourceTokens(source: ResearchSource): number {
  let text = `${source.title}\n${source.summary}`;

  if (source.highlights && source.highlights.length > 0) {
    text += `\n${source.highlights.join("\n")}`;
  }

  if (source.fullText) {
    text += `\n${source.fullText}`;
  }

  // Also count subpages if present
  let subpageTokens = 0;
  if (source.subpages && source.subpages.length > 0) {
    for (const sub of source.subpages) {
      subpageTokens += estimateSourceTokens(sub);
    }
  }

  return estimator.estimate(text) + subpageTokens;
}

/**
 * Estimate tokens for a string
 */
export function estimateTextTokens(text: string): number {
  return estimator.estimate(text);
}

/**
 * Heuristic token count (4 chars per token) as a fallback or for quick checks
 */
export function heuristicTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
