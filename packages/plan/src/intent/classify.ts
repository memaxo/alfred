/**
 * Intent classification for workflow planning.
 *
 * Uses LLM-based classification by default with heuristic fallback.
 * @see .ruler/55-llm-first-classification.md
 */

import type { LanguageModel } from "ai";
import { z } from "zod";

import { classify, OFFLINE_MODE } from "../classify/index.js";
import type { WorkflowIntent } from "./types.js";

/**
 * Intent category type
 */
export const INTENT_CATEGORIES = [
  "fix",
  "feat",
  "refactor",
  "test",
  "docs",
  "chore",
  "misc",
] as const;

export type IntentCategory = (typeof INTENT_CATEGORIES)[number];

/**
 * Schema for intent classification output
 */
const intentClassificationSchema = z.object({
  category: z.enum(INTENT_CATEGORIES),
  confidence: z.number().min(0).max(1),
});

/**
 * Options for intent classification
 */
export type ClassifyIntentOptions = {
  /** Model to use for classification (required unless ALFRED_CLASSIFY_OFFLINE=1) */
  model?: LanguageModel;
  /** Model key for logging */
  modelKey?: string;
};

/**
 * Heuristic fallback for intent classification.
 * Used when ALFRED_CLASSIFY_OFFLINE=1 or when LLM call fails.
 */
function classifyIntentHeuristic(description: string): IntentCategory {
  const lower = description.toLowerCase();

  const patterns: Array<{ category: IntentCategory; regex: RegExp }> = [
    { category: "fix", regex: /\b(fix|bug|issue|error|broken|fail)\b/i },
    {
      category: "feat",
      regex: /\b(add|create|new|implement|feature|support)\b/i,
    },
    { category: "refactor", regex: /\b(refactor|clean|improve|optimize)\b/i },
    { category: "test", regex: /\b(test|spec|unit|integration|e2e)\b/i },
    { category: "docs", regex: /\b(docs?|documentation|readme|comment)\b/i },
    {
      category: "chore",
      regex: /\b(chore|deps?|dependencies|update|build)\b/i,
    },
  ];

  for (const { category, regex } of patterns) {
    if (regex.test(lower)) {
      return category;
    }
  }

  return "misc";
}

/**
 * Classification prompt for intent categorization.
 * Kept minimal to reduce token usage.
 */
function buildIntentPrompt(description: string): string {
  return `Classify this development task intent into exactly one category.

Task: "${description}"

Categories:
- fix: Bug fixes, error corrections, issue resolution
- feat: New features, additions, implementations
- refactor: Code improvement, optimization, cleanup
- test: Testing, specs, test coverage
- docs: Documentation, comments, README updates
- chore: Dependencies, build config, maintenance
- misc: Other tasks that don't fit above

Return the most appropriate category and your confidence (0-1).`;
}

/**
 * Classify intent into broad categories.
 *
 * Uses LLM-based classification by default for semantic understanding.
 * Falls back to regex heuristics when:
 * - ALFRED_CLASSIFY_OFFLINE=1 is set
 * - No model is provided and offline mode is enabled
 * - LLM call fails
 *
 * @param intent - The workflow intent to classify
 * @param options - Classification options including model
 * @returns The intent category (fix, feat, refactor, test, docs, chore, misc)
 */
export async function classifyIntent(
  intent: WorkflowIntent,
  options: ClassifyIntentOptions = {}
): Promise<IntentCategory> {
  const { model, modelKey } = options;
  const description = intent.description;

  // Use heuristic in offline mode or if no model provided
  if (OFFLINE_MODE || !model) {
    return classifyIntentHeuristic(description);
  }

  const result = await classify(
    intentClassificationSchema,
    buildIntentPrompt(description),
    {
      model,
      modelKey,
      metricType: "intent",
      fallback: () => ({
        category: classifyIntentHeuristic(description),
        confidence: 0.5,
      }),
    }
  );

  return result.result.category;
}

/**
 * Classify intent with full result metadata.
 * Includes confidence score and classification source.
 */
export async function classifyIntentWithMetadata(
  intent: WorkflowIntent,
  options: ClassifyIntentOptions = {}
): Promise<{
  category: IntentCategory;
  confidence: number;
  source: "llm" | "fallback";
  latencyMs: number;
}> {
  const { model, modelKey } = options;
  const description = intent.description;

  // Use heuristic in offline mode or if no model provided
  if (OFFLINE_MODE || !model) {
    return {
      category: classifyIntentHeuristic(description),
      confidence: 0.5,
      source: "fallback",
      latencyMs: 0,
    };
  }

  const result = await classify(
    intentClassificationSchema,
    buildIntentPrompt(description),
    {
      model,
      modelKey,
      metricType: "intent",
      fallback: () => ({
        category: classifyIntentHeuristic(description),
        confidence: 0.5,
      }),
    }
  );

  return {
    category: result.result.category,
    confidence: result.result.confidence,
    source: result.source,
    latencyMs: result.latencyMs,
  };
}
