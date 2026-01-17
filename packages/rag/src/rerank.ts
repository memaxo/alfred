/**
 * Cohere rerank integration for RAG
 * Optional reranking step to improve retrieval quality
 *
 * Note: migrate to AI SDK v6 rerank() when @ai-sdk/cohere adds rerankingModel() support.
 */

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
 * Gated by COHERE_API_KEY env var - returns [] if not configured.
 *
 * Note: Currently uses manual API calls. Will migrate to AI SDK v6 rerank()
 * when @ai-sdk/cohere adds rerankingModel() support.
 */
export async function rerank({
  query,
  documents,
  topN = 10,
  model = "rerank-v3.5",
  telemetry,
}: RerankOptions): Promise<RerankResult[]> {
  const apiKey = process.env.COHERE_API_KEY;
  const docCount = documents.length;

  if (!apiKey) {
    telemetry?.onSuccess?.({
      query,
      model,
      docCount,
      durationMs: 0,
    });
    return [];
  }

  const baseUrl = process.env.COHERE_BASE_URL ?? "https://api.cohere.ai";
  const started = Date.now();

  try {
    const response = await fetch(`${baseUrl}/v1/rerank`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        query,
        documents: documents.map((doc) => doc.text),
        top_n: topN,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const errorBody: unknown = await response
        .json()
        .catch(() => ({}) as unknown);
      const errMsg =
        typeof errorBody === "object" &&
        errorBody !== null &&
        "message" in errorBody
          ? (errorBody as { message?: string }).message
          : undefined;
      throw new Error(
        `cohere_rerank_failed:${response.status}:${errMsg ?? "unknown"}`
      );
    }

    const body = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
      error?: { message?: string };
    };

    if (body.error) {
      throw new Error(`cohere_rerank_error:${body.error.message ?? "unknown"}`);
    }

    const results = body.results ?? [];
    const mapped = results.map((result) => {
      const doc = documents[result.index];
      if (!doc) {
        throw new Error(`cohere_rerank_invalid_index:${result.index}`);
      }
      return {
        id: doc.id,
        text: doc.text,
        score: result.relevance_score,
        index: result.index,
      };
    });

    telemetry?.onSuccess?.({
      query,
      model,
      docCount,
      durationMs: Date.now() - started,
    });

    return mapped;
  } catch (error) {
    telemetry?.onError?.({
      query,
      model,
      docCount,
      error,
    });
    return [];
  }
}
