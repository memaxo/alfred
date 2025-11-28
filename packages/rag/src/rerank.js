 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }/**
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
  telemetry,
}) {
  const apiKey = process.env.COHERE_API_KEY;
  const docCount = documents.length;
  const fallback = () =>
    documents.slice(0, topN).map((doc, index) => ({
      id: doc.id,
      text: doc.text,
      score: 1.0 - index * 0.01,
      index,
    }));

  if (!apiKey) {
    _optionalChain([telemetry, 'optionalAccess', _ => _.onSuccess, 'optionalCall', _2 => _2({
      query,
      model,
      docCount,
      durationMs: 0,
    })]);
    return fallback();
  }

  const baseUrl = _nullishCoalesce(process.env.COHERE_BASE_URL, () => ( "https://api.cohere.ai"));
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
      const errorBody = await response
        .json()
        .catch(() => ({}) );
      const errMsg =
        typeof errorBody === "object" &&
        errorBody !== null &&
        "message" in errorBody
          ? (errorBody ).message
          : undefined;
      throw new Error(
        `cohere_rerank_failed:${response.status}:${_nullishCoalesce(errMsg, () => ( "unknown"))}`
      );
    }

    const body = (await response.json()) 


;

    if (body.error) {
      throw new Error(`cohere_rerank_error:${_nullishCoalesce(body.error.message, () => ( "unknown"))}`);
    }

    const results = _nullishCoalesce(body.results, () => ( []));
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

    _optionalChain([telemetry, 'optionalAccess', _3 => _3.onSuccess, 'optionalCall', _4 => _4({
      query,
      model,
      docCount,
      durationMs: Date.now() - started,
    })]);

    return mapped;
  } catch (error) {
    _optionalChain([telemetry, 'optionalAccess', _5 => _5.onError, 'optionalCall', _6 => _6({
      query,
      model,
      docCount,
      error,
    })]);
    return fallback();
  }
}
