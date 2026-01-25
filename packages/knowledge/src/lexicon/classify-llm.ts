/**
 * LLM-enhanced domain classification.
 *
 * Provides semantic domain classification using lightweight LLM calls.
 * Use for ambiguous text where keyword matching has low confidence.
 *
 * @see .ruler/55-llm-first-classification.md
 */

import { logger } from "@alfred/logger";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import type { DomainResult } from "./domains.js";

/**
 * Standard domains for classification
 */
export const DOMAIN_CATEGORIES = [
  "Coding",
  "Science",
  "Business",
  "Health",
  "Arts",
  "Personal",
  "News",
  "Reference",
] as const;

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

/**
 * Schema for domain classification output
 */
const domainClassificationSchema = z.object({
  domain: z.enum(DOMAIN_CATEGORIES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

/**
 * Options for LLM domain classification
 */
export interface ClassifyDomainLLMOptions {
  /** Model to use for classification */
  model: LanguageModel;
  /** Model key for logging */
  modelKey?: string;
  /** Maximum text length to send (truncate if longer) */
  maxTextLength?: number;
}

/**
 * Build the classification prompt for domain assignment.
 */
function buildDomainPrompt(text: string, maxLength: number): string {
  const truncated =
    text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  return `Classify the primary knowledge domain of this text.

Text: "${truncated}"

Domains:
- Coding: Programming, software development, technical documentation
- Science: Research, scientific concepts, academic content
- Business: Finance, economics, corporate topics, entrepreneurship
- Health: Medical, fitness, wellness, healthcare
- Arts: Music, visual arts, literature, entertainment, creative
- Personal: Relationships, lifestyle, self-improvement, personal notes
- News: Current events, journalism, world affairs
- Reference: Encyclopedic knowledge, how-to guides, factual information

Return the most appropriate domain and your confidence (0-1).`;
}

/**
 * Classify domain using LLM.
 *
 * Use this for ambiguous text where keyword matching has low confidence.
 * This is NOT for hot paths due to latency - use classifyDomain() for sync cases.
 *
 * @param text - Text to classify
 * @param options - Classification options including model
 * @returns Domain result with LLM source
 */
export async function classifyDomainLLM(
  text: string,
  options: ClassifyDomainLLMOptions
): Promise<DomainResult> {
  const { model, modelKey, maxTextLength = 500 } = options;
  const start = performance.now();

  try {
    const response = await generateObject({
      model: model as Parameters<typeof generateObject>[0]["model"],
      schema: domainClassificationSchema,
      prompt: buildDomainPrompt(text, maxTextLength),
    });

    const latencyMs = performance.now() - start;

    logger.debug("classify_domain_llm_success", {
      latencyMs: Math.round(latencyMs),
      model: modelKey ?? "unknown",
      domain: response.object.domain,
      confidence: response.object.confidence,
    });

    return {
      domain: response.object.domain,
      confidence: response.object.confidence,
      source: "learned", // Mark as learned since it's a semantic classification
    };
  } catch (error) {
    const latencyMs = performance.now() - start;

    logger.warn("classify_domain_llm_failed", {
      latencyMs: Math.round(latencyMs),
      error: error instanceof Error ? error.message : String(error),
    });

    // Return a low-confidence fallback
    return {
      domain: "Reference",
      confidence: 0.3,
      source: "static",
    };
  }
}

/**
 * Check if classification result is ambiguous (low confidence).
 * Use to decide whether to call LLM for better classification.
 */
export function isAmbiguousClassification(results: DomainResult[]): boolean {
  if (results.length === 0) {
    return true;
  }

  const top = results[0];
  if (!top) {
    return true;
  }

  // Top result has low confidence
  if (top.confidence < 0.5) {
    return true;
  }

  // Multiple results with similar confidence (no clear winner)
  if (results.length >= 2) {
    const second = results[1];
    if (!second) {
      return false;
    }

    const diff = top.confidence - second.confidence;
    if (diff < 0.2) {
      return true;
    }
  }

  return false;
}

/**
 * Enhance domain classification with LLM for ambiguous cases.
 *
 * This function takes existing static classification results and optionally
 * enhances them with LLM classification if they appear ambiguous.
 *
 * @param text - Original text
 * @param staticResults - Results from static keyword classification
 * @param options - LLM options (if undefined, returns static results unchanged)
 * @returns Enhanced domain results
 */
export async function enhanceDomainClassification(
  text: string,
  staticResults: DomainResult[],
  options?: ClassifyDomainLLMOptions
): Promise<DomainResult[]> {
  // If no model provided or results are not ambiguous, return static
  if (!(options && isAmbiguousClassification(staticResults))) {
    return staticResults;
  }

  // Use LLM for ambiguous cases
  const llmResult = await classifyDomainLLM(text, options);

  // If LLM has high confidence, use it; otherwise merge with static
  if (llmResult.confidence >= 0.7) {
    return [llmResult];
  }

  // Merge: LLM result first if confident, then static
  if (llmResult.confidence > (staticResults[0]?.confidence ?? 0)) {
    return [
      llmResult,
      ...staticResults.filter((r) => r.domain !== llmResult.domain),
    ];
  }

  return staticResults;
}
