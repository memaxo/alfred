/**
 * Cohere rerank integration for RAG
 * Optional reranking step to improve retrieval quality
 *
 * TODO: Migrate to AI SDK v6 rerank() when @ai-sdk/cohere adds rerankingModel() support
 */
/**
 * Reranks documents using Cohere API.
 * Gated by COHERE_API_KEY env var - returns original order if not configured.
 *
 * Note: Currently uses manual API calls. Will migrate to AI SDK v6 rerank()
 * when @ai-sdk/cohere adds rerankingModel() support.
 */
export async function rerank({
  query,
  documents,
  topN = 10,
  model = "rerank-v3.5",
}) {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    // Return original order if Cohere not configured
    return documents.slice(0, topN).map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1.0 - index * 0.01,
      index,
    }));
  }
  const baseUrl = process.env.COHERE_BASE_URL ?? "https://api.cohere.ai";
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
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(
        `cohere_rerank_failed:${response.status}:${errorBody.message ?? "unknown"}`
      );
    }
    const body = await response.json();
    if (body.error) {
      throw new Error(`cohere_rerank_error:${body.error.message ?? "unknown"}`);
    }
    const results = body.results ?? [];
    return results.map((result) => {
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
  } catch (error) {
    // Fallback on error - return original order
    console.error("Reranking failed:", error);
    return documents.slice(0, topN).map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1.0 - index * 0.01,
      index,
    }));
  }
}
//# sourceMappingURL=rerank.js.map
