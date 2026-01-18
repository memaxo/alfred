/**
 * Backend resolver for reranking
 * Automatically selects the appropriate reranking backend based on environment
 */

import type { RerankBackend, RerankOptions, RerankResult } from "./types.js";

/**
 * Resolve which rerank backend to use based on environment variables.
 *
 * Priority:
 * 1. Explicit RERANK_BACKEND env var
 * 2. COHERE_API_KEY presence -> cohere
 * 3. QWEN3VL_RERANK_URL presence -> qwen3vl
 * 4. None configured -> "none" (skip reranking)
 */
export function resolveBackend(): RerankBackend {
  const explicit = process.env.RERANK_BACKEND;

  if (explicit === "qwen3vl") {
    return "qwen3vl";
  }
  if (explicit === "cohere") {
    return "cohere";
  }
  if (explicit === "none") {
    return "none";
  }

  // Auto-detect based on available credentials/URLs
  if (process.env.COHERE_API_KEY) {
    return "cohere";
  }
  if (process.env.QWEN3VL_RERANK_URL) {
    return "qwen3vl";
  }

  return "none";
}

/**
 * Rerank documents using the configured backend.
 *
 * Fail-open semantics: returns empty array if no backend configured
 * or if the backend fails.
 */
export async function rerank(opts: RerankOptions): Promise<RerankResult[]> {
  const backend = resolveBackend();
  const started = Date.now();

  switch (backend) {
    case "cohere": {
      const { cohereRerank } = await import("./cohere.js");
      return cohereRerank({
        query: opts.query,
        documents: opts.documents.map((doc) => ({
          id: doc.id,
          text: doc.text ?? "",
        })),
        topN: opts.topN,
        telemetry: opts.telemetry
          ? {
              onSuccess: (ctx) =>
                opts.telemetry?.onSuccess?.({
                  ...ctx,
                  backend: "cohere",
                }),
              onError: (ctx) =>
                opts.telemetry?.onError?.({
                  ...ctx,
                  backend: "cohere",
                }),
            }
          : undefined,
      });
    }

    case "qwen3vl": {
      const { qwen3vlRerank } = await import("./client.js");
      return qwen3vlRerank(opts);
    }

    default: {
      // No backend configured - return empty (fail-open)
      opts.telemetry?.onSuccess?.({
        query: opts.query,
        backend: "none",
        docCount: opts.documents.length,
        durationMs: Date.now() - started,
      });
      return [];
    }
  }
}

/**
 * Check if reranking is available (any backend configured)
 */
export function isRerankAvailable(): boolean {
  return resolveBackend() !== "none";
}

/**
 * Get the currently configured backend name
 */
export function getRerankBackend(): RerankBackend {
  return resolveBackend();
}
