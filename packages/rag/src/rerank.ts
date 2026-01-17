/**
 * Cohere rerank integration for RAG
 * @deprecated Use @alfred/rerank instead. This module re-exports for backwards compatibility.
 *
 * Note: migrate to AI SDK v6 rerank() when @ai-sdk/cohere adds rerankingModel() support.
 */

import { cohereRerank } from "@alfred/rerank/cohere";

export type RerankTelemetry = {
  onError?: (ctx: {
    query: string;
    model: string;
    docCount: number;
    error: unknown;
  }) => void;
  onSuccess?: (ctx: {
    query: string;
    model: string;
    docCount: number;
    durationMs: number;
  }) => void;
};

export type RerankOptions = {
  query: string;
  documents: Array<{ id: string; text: string }>;
  topN?: number;
  model?: "rerank-v3.5" | "rerank-english-v3.0" | "rerank-multilingual-v3.0";
  telemetry?: RerankTelemetry;
};

export type RerankResult = {
  id: string;
  text: string;
  score: number;
  index: number;
};

/**
 * Reranks documents using Cohere API.
 * @deprecated Use `import { rerank } from "@alfred/rerank"` instead.
 */
export async function rerank({
  query,
  documents,
  topN = 10,
  model = "rerank-v3.5",
  telemetry,
}: RerankOptions): Promise<RerankResult[]> {
  const results = await cohereRerank({
    query,
    documents,
    topN,
    model,
    telemetry: telemetry
      ? {
          onSuccess: (ctx) =>
            telemetry.onSuccess?.({
              query: ctx.query,
              model: ctx.backend,
              docCount: ctx.docCount,
              durationMs: ctx.durationMs,
            }),
          onError: (ctx) =>
            telemetry.onError?.({
              query: ctx.query,
              model: ctx.backend,
              docCount: ctx.docCount,
              error: ctx.error,
            }),
        }
      : undefined,
  });

  // Add text field back for backwards compatibility
  return results.map((result) => {
    const doc = documents[result.index];
    return {
      ...result,
      text: doc?.text ?? "",
    };
  });
}
