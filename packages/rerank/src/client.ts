/**
 * Qwen3-VL Reranker HTTP client
 * Communicates with the self-hosted Qwen3-VL reranker server
 */

import type {
  Qwen3VLHealthResponse,
  Qwen3VLRerankRequest,
  Qwen3VLRerankResponse,
  RerankOptions,
  RerankResult,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

/**
 * Get the Qwen3-VL reranker server URL from environment
 */
function getServerUrl(): string {
  const url = process.env.QWEN3VL_RERANK_URL;
  if (!url) {
    throw new Error("QWEN3VL_RERANK_URL environment variable not set");
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Rerank documents using the Qwen3-VL server.
 *
 * Fail-open semantics: returns empty array on any error.
 */
export async function qwen3vlRerank(
  opts: RerankOptions
): Promise<RerankResult[]> {
  const started = Date.now();
  const docCount = opts.documents.length;

  let serverUrl: string;
  try {
    serverUrl = getServerUrl();
  } catch {
    // No URL configured - fail open
    opts.telemetry?.onSuccess?.({
      query: opts.query,
      backend: "qwen3vl",
      docCount,
      durationMs: 0,
    });
    return [];
  }

  const timeoutMs =
    Number(process.env.QWEN3VL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const retryCount =
    Number(process.env.QWEN3VL_RETRY_COUNT) || DEFAULT_RETRY_COUNT;
  const retryDelayMs =
    Number(process.env.QWEN3VL_RETRY_DELAY_MS) || DEFAULT_RETRY_DELAY_MS;

  // Build request
  const request: Qwen3VLRerankRequest = {
    query: {
      text: opts.query,
      image: opts.queryImageUrl ?? null,
    },
    documents: opts.documents.map((doc) => ({
      id: doc.id,
      text: doc.text,
      image: doc.imageUrl ?? null,
      video: doc.videoUrl ?? null,
    })),
    instruction: opts.instruction,
    top_n: opts.topN ?? 10,
    debug: process.env.QWEN3VL_DEBUG === "1" ? true : undefined,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${serverUrl}/rerank`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
        },
        timeoutMs
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `qwen3vl_rerank_failed:${response.status}:${errorBody.slice(0, 200)}`
        );
      }

      const body = (await response.json()) as Qwen3VLRerankResponse;

      const results: RerankResult[] = body.results.map((item) => ({
        id: item.id,
        score: item.score,
        index: item.index,
      }));

      opts.telemetry?.onSuccess?.({
        query: opts.query,
        backend: "qwen3vl",
        docCount,
        durationMs: Date.now() - started,
      });

      return results;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt < retryCount) {
        const isRetryable =
          error instanceof Error &&
          (error.name === "AbortError" ||
            error.message.includes("fetch failed") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("503") ||
            error.message.includes("502"));

        if (isRetryable) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
      }

      break;
    }
  }

  // All retries failed - fail open
  opts.telemetry?.onError?.({
    query: opts.query,
    backend: "qwen3vl",
    docCount,
    error: lastError,
  });

  return [];
}

/**
 * Check health of the Qwen3-VL server
 */
export async function checkHealth(): Promise<Qwen3VLHealthResponse> {
  let serverUrl: string;
  try {
    serverUrl = getServerUrl();
  } catch {
    return {
      status: "error",
      model: "unknown",
      device: "unknown",
      error: "QWEN3VL_RERANK_URL not configured",
    };
  }

  try {
    const response = await fetchWithTimeout(
      `${serverUrl}/health`,
      { method: "GET" },
      5000
    );

    if (!response.ok) {
      return {
        status: "error",
        model: "unknown",
        device: "unknown",
        error: `HTTP ${response.status}`,
      };
    }

    return (await response.json()) as Qwen3VLHealthResponse;
  } catch (error) {
    return {
      status: "error",
      model: "unknown",
      device: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if the Qwen3-VL server is available and healthy
 */
export async function isQwen3VLAvailable(): Promise<boolean> {
  const health = await checkHealth();
  return health.status === "ok";
}
