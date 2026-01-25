/**
 * Reliability scoring logic for external research sources
 */

import type { LanguageModel } from "ai";

import { z } from "zod";

import { classify } from "../classify/index.js";
import { detectFrameworkVersion } from "./filter.js";

const DOMAIN_AUTHORITY: Record<string, number> = {
  "react.dev": 1,
  "nextjs.org": 1,
  "tanstack.com": 1,
  "github.com": 0.9,
  "stackoverflow.com": 0.7,
  "medium.com": 0.5,
  "dev.to": 0.5,
};

/**
 * Calculate reliability score (0.0-1.0) for a source
 */
export function calculateReliability(params: {
  url: string;
  publishedDate?: Date;
  content: string;
  projectFrameworks?: Record<string, string>; // e.g., { "react": "18.2" }
}): number {
  let score = 0.5; // Base score for unknown blogs/sites

  const url = new URL(params.url);

  // 1. HTTPS requirement
  if (url.protocol !== "https:") {
    return 0;
  }

  // 2. Domain authority
  for (const [domain, authority] of Object.entries(DOMAIN_AUTHORITY)) {
    if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) {
      score = authority;
      break;
    }
  }

  // 3. Freshness (decay after 1 year)
  if (params.publishedDate) {
    const ageInYears =
      (Date.now() - params.publishedDate.getTime()) /
      (1000 * 60 * 60 * 24 * 365);
    if (ageInYears < 1) {
      // Keep score (1.0 factor)
    } else if (ageInYears > 3) {
      score *= 0.6; // Decay to 60%
    } else {
      // Linear decay between 1 and 3 years: 1.0 to 0.6
      const factor = 1 - (ageInYears - 1) * 0.2;
      score *= factor;
    }
  }

  // 4. Framework version match (optional boost)
  if (params.projectFrameworks) {
    const detected = detectFrameworkVersion(params.content);
    if (detected) {
      for (const [name, version] of Object.entries(params.projectFrameworks)) {
        if (detected.toLowerCase().includes(name.toLowerCase())) {
          if (detected.includes(version)) {
            score += 0.2; // Exact match boost
          } else {
            const major = version.split(".")[0];
            if (detected.includes(` ${major}.`)) {
              score += 0.1; // Major version match boost
            }
          }
        }
      }
    }
  }

  return Math.min(Math.max(score, 0), 1);
}

/**
 * Schema for relevance scoring output
 */
const relevanceSchema = z.object({
  relevance: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

/**
 * Options for relevance calculation
 */
export interface CalculateRelevanceOptions {
  /** Model to use for semantic relevance (optional) */
  model?: LanguageModel;
  /** Model key for logging */
  modelKey?: string;
  /** Maximum text length to send (truncate if longer) */
  maxContentLength?: number;
}

/**
 * Build the relevance scoring prompt.
 */
function buildRelevancePrompt(
  source: { title: string; summary: string; content?: string },
  intentDescription: string,
  maxContentLength: number
): string {
  const content = source.content ?? "";
  const truncatedContent =
    content.length > maxContentLength
      ? `${content.slice(0, maxContentLength)}...`
      : content;

  return `Rate how relevant this source is to the user's intent (0.0-1.0).

Intent: "${intentDescription}"

Source:
Title: ${source.title}
Summary: ${source.summary}
${truncatedContent ? `Content: ${truncatedContent}` : ""}

Return a relevance score (0.0 = not relevant, 1.0 = highly relevant).`;
}

/**
 * Heuristic fallback for relevance calculation.
 * Uses keyword matching (original implementation).
 */
function calculateRelevanceHeuristic(
  source: { title: string; summary: string; content?: string },
  intentDescription: string
): number {
  const query = intentDescription.toLowerCase();
  const title = source.title.toLowerCase();
  const summary = source.summary.toLowerCase();
  const content = (source.content ?? "").toLowerCase();

  let matches = 0;
  const terms = query.split(/\s+/).filter((t) => t.length > 3);

  if (terms.length === 0) {
    return 0.5;
  }

  for (const term of terms) {
    if (title.includes(term)) {
      matches += 2; // Title matches count double
    }
    if (summary.includes(term)) {
      matches += 1;
    }
    if (content.includes(term)) {
      matches += 0.5;
    }
  }

  const maxPossible = terms.length * 3.5;
  return Math.min(matches / maxPossible + 0.2, 1); // Bias slightly upwards
}

/**
 * Calculate semantic relevance score (0.0-1.0) between source and intent.
 *
 * This is the synchronous version using keyword matching for backward compatibility.
 * For better semantic understanding with LLM, use `calculateRelevanceWithLLM()`.
 *
 * @see .ruler/55-llm-first-classification.md
 */
export function calculateRelevance(
  source: { title: string; summary: string; content?: string },
  intentDescription: string
): number {
  return calculateRelevanceHeuristic(source, intentDescription);
}

/**
 * Calculate semantic relevance score using LLM (async).
 *
 * Uses LLM-based semantic scoring for better understanding.
 * Falls back to keyword matching when:
 * - ALFRED_CLASSIFY_OFFLINE=1 is set
 * - No model is provided
 * - LLM call fails
 */
export async function calculateRelevanceWithLLM(
  source: { title: string; summary: string; content?: string },
  intentDescription: string,
  options: CalculateRelevanceOptions & { model: LanguageModel }
): Promise<number> {
  const { model, modelKey, maxContentLength = 500 } = options;

  try {
    const result = await classify(
      relevanceSchema,
      buildRelevancePrompt(source, intentDescription, maxContentLength),
      {
        model,
        modelKey,
        metricType: "relevance",
        fallback: () => ({
          relevance: calculateRelevanceHeuristic(source, intentDescription),
        }),
      }
    );

    return result.result.relevance;
  } catch {
    // Fall back to heuristic on error
    return calculateRelevanceHeuristic(source, intentDescription);
  }
}

/**
 * @deprecated Use calculateRelevance() for sync or calculateRelevanceWithLLM() for async LLM-based scoring
 */
export function calculateRelevanceSync(
  source: { title: string; summary: string; content?: string },
  intentDescription: string
): number {
  return calculateRelevanceHeuristic(source, intentDescription);
}
