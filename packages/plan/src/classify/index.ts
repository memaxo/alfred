/**
 * Shared classification utilities for LLM-based classification.
 * Uses Cerebras gpt-oss-120b by default for fast inference with structured output.
 *
 * @see .ruler/55-llm-first-classification.md
 */

import { logger } from "@alfred/logger";
import {
  classificationBatchSize,
  classificationConfidence,
  classificationFallbackTotal,
  classificationLatencySeconds,
  classificationTotal,
} from "@alfred/metrics/classification";
import {
  generateObject,
  type FlexibleSchema,
  type InferSchema,
  type LanguageModel,
} from "ai";

/**
 * Whether to use offline heuristic fallbacks instead of LLM classification.
 * Set ALFRED_CLASSIFY_OFFLINE=1 to disable LLM calls.
 */
export const OFFLINE_MODE = process.env.ALFRED_CLASSIFY_OFFLINE === "1";

/**
 * Classification options
 */
export interface ClassifyOptions<T extends FlexibleSchema<unknown>> {
  /** Fallback function to use when OFFLINE_MODE is enabled or LLM call fails */
  fallback?: () => InferSchema<T>;
  /** Override the default classification model */
  model?: LanguageModel;
  /** Model identifier for logging (since LanguageModel doesn't expose modelId) */
  modelKey?: string;
  /** Stable metric type for classification observability */
  metricType?: ClassificationMetricType;
  /** Maximum retries on failure before using fallback */
  maxRetries?: number;
}

export type ClassificationMetricType =
  | "intent"
  | "phase"
  | "path"
  | "relevance"
  | "domain"
  | "other";

/**
 * Classification result with metadata
 */
export interface ClassifyResult<T> {
  result: T;
  source: "llm" | "fallback";
  latencyMs: number;
  model?: string;
}

/**
 * Classify input using LLM with structured output.
 *
 * Uses generateObject for type-safe classification with Zod schemas.
 * Falls back to heuristic function when:
 * - ALFRED_CLASSIFY_OFFLINE=1 is set
 * - LLM call fails and fallback is provided
 *
 * @example
 * ```ts
 * const result = await classify(
 *   z.object({ category: z.enum(["fix", "feat", "refactor"]) }),
 *   "Classify this task: fix the login bug",
 *   { fallback: () => ({ category: "fix" }) }
 * );
 * ```
 */
export async function classify<T extends FlexibleSchema<unknown>>(
  schema: T,
  prompt: string,
  options: ClassifyOptions<T> & { model: LanguageModel }
): Promise<ClassifyResult<InferSchema<T>>>;
export async function classify<T extends FlexibleSchema<unknown>>(
  schema: T,
  prompt: string,
  options?: ClassifyOptions<T>
): Promise<ClassifyResult<InferSchema<T>>>;
export async function classify<T extends FlexibleSchema<unknown>>(
  schema: T,
  prompt: string,
  options: ClassifyOptions<T> = {}
): Promise<ClassifyResult<InferSchema<T>>> {
  const {
    fallback,
    model,
    modelKey,
    metricType = "other",
    maxRetries = 1,
  } = options;
  const start = performance.now();

  // Use fallback in offline mode
  if (OFFLINE_MODE) {
    if (!fallback) {
      throw new Error(
        "classify_offline_no_fallback: ALFRED_CLASSIFY_OFFLINE=1 but no fallback provided"
      );
    }
    classificationFallbackTotal.inc({ type: metricType, reason: "offline" });
    classificationTotal.inc({ type: metricType, outcome: "fallback" });

    const result = fallback();
    return {
      result,
      source: "fallback",
      latencyMs: performance.now() - start,
    };
  }

  // Require model to be passed explicitly (avoid circular dependency with @alfred/agent)
  if (!model) {
    classificationTotal.inc({ type: metricType, outcome: "error" });
    throw new Error(
      "classify_model_required: Must provide model option. Use getClassificationModel() from @alfred/agent/selector"
    );
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await generateObject({
        model: model as Parameters<typeof generateObject>[0]["model"],
        schema,
        prompt,
      });

      const latencyMs = performance.now() - start;

      // Track metrics
      classificationLatencySeconds.observe(
        { type: metricType, model: modelKey || "unknown" },
        latencyMs / 1000
      );
      classificationTotal.inc({ type: metricType, outcome: "success" });

      // Track confidence if present in result
      const result = response.object as InferSchema<T>;
      if (
        typeof result === "object" &&
        result !== null &&
        "confidence" in result
      ) {
        const { confidence } = result as { confidence?: unknown };
        if (typeof confidence === "number") {
          classificationConfidence.observe({ type: metricType }, confidence);
        }
      }

      logger.debug("classify_success", {
        latencyMs: Math.round(latencyMs),
        model: modelKey ?? "unknown",
        attempt,
      });

      return {
        result,
        source: "llm",
        latencyMs,
        model: modelKey,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn("classify_attempt_failed", {
        attempt,
        error: lastError.message,
      });
    }
  }

  // Use fallback if available
  if (fallback) {
    logger.warn("classify_using_fallback", {
      error: lastError?.message,
    });
    classificationFallbackTotal.inc({ type: metricType, reason: "error" });
    classificationTotal.inc({ type: metricType, outcome: "fallback" });
    return {
      result: fallback(),
      source: "fallback",
      latencyMs: performance.now() - start,
    };
  }

  classificationTotal.inc({ type: metricType, outcome: "error" });
  throw lastError ?? new Error("classify_failed: Unknown error");
}

/**
 * Batch classify multiple items efficiently.
 *
 * For classification tasks where multiple items need the same type of classification,
 * this batches them into a single LLM call for efficiency.
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   assignments: z.array(z.object({
 *     index: z.number(),
 *     category: z.enum(["backend", "frontend", "test"])
 *   }))
 * });
 *
 * const result = await classifyBatch(
 *   schema,
 *   items.map((item, i) => `${i}: ${item}`).join("\n"),
 *   "Classify each item...",
 *   { model, modelKey: "cerebras/gpt-oss-120b" }
 * );
 * ```
 */
export async function classifyBatch<T extends FlexibleSchema<unknown>>(
  schema: T,
  itemsDescription: string,
  systemPrompt: string,
  options: ClassifyOptions<T> & { model: LanguageModel }
): Promise<ClassifyResult<InferSchema<T>>> {
  const prompt = `${systemPrompt}\n\n${itemsDescription}`;

  // Track batch size if we can parse it from the items description
  const classifyType = options.metricType ?? "other";
  const itemCount = itemsDescription
    .split("\n")
    .filter((line) => line.trim().match(/^\d+:/)).length;
  if (itemCount > 0) {
    classificationBatchSize.observe({ type: classifyType }, itemCount);
  }

  return await classify(schema, prompt, options);
}

/**
 * Helper to create classification options from a ModelSelection.
 * Use with getClassificationModel() from @alfred/agent/selector.
 */
export function fromModelSelection(selection: {
  model: LanguageModel;
  modelKey: string;
}): { model: LanguageModel; modelKey: string } {
  return {
    model: selection.model,
    modelKey: selection.modelKey,
  };
}

// Re-export path classification utilities
export {
  type ClassifyPathOptions,
  classifyPath,
  classifyPathHeuristic,
  classifyPaths,
  classifyPathsWithMetadata,
  PATH_BUCKETS,
  type PathBucket,
} from "./path.js";
