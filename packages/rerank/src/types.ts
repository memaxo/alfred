/**
 * Rerank types for multimodal document reranking
 */

/**
 * A document that can be reranked.
 * Supports text, images, and video for multimodal reranking.
 */
export type RerankDocument = {
  /** Unique identifier for the document */
  id: string;
  /** Text content of the document */
  text?: string;
  /** URL or base64 data URI for an image */
  imageUrl?: string;
  /** URL to a video file */
  videoUrl?: string;
};

/**
 * Options for reranking documents
 */
export type RerankOptions = {
  /** The query text to rank documents against */
  query: string;
  /** Optional image URL for multimodal queries */
  queryImageUrl?: string;
  /** Documents to rerank */
  documents: RerankDocument[];
  /** Number of top results to return (default: 10) */
  topN?: number;
  /** Custom instruction for the reranker (Qwen3-VL supports this) */
  instruction?: string;
  /** Telemetry hooks */
  telemetry?: RerankTelemetry;
};

/**
 * Result of reranking a document
 */
export type RerankResult = {
  /** Document ID */
  id: string;
  /** Relevance score (0-1) */
  score: number;
  /** Original index in the input array */
  index: number;
};

/**
 * Telemetry hooks for reranking operations
 */
export type RerankTelemetry = {
  onError?: (ctx: {
    query: string;
    backend: string;
    docCount: number;
    error: unknown;
  }) => void;
  onSuccess?: (ctx: {
    query: string;
    backend: string;
    docCount: number;
    durationMs: number;
  }) => void;
};

/**
 * Available rerank backends
 */
export type RerankBackend = "cohere" | "qwen3vl" | "none";

/**
 * Cohere-specific options (for backwards compatibility)
 */
export type CohereRerankOptions = {
  query: string;
  documents: Array<{ id: string; text: string }>;
  topN?: number;
  model?: "rerank-v3.5" | "rerank-english-v3.0" | "rerank-multilingual-v3.0";
  telemetry?: RerankTelemetry;
};

/**
 * Qwen3-VL server request format
 */
export type Qwen3VLRerankRequest = {
  query: {
    text?: string;
    image?: string | null;
  };
  documents: Array<{
    id: string;
    text?: string;
    image?: string | null;
    video?: string | null;
  }>;
  instruction?: string;
  top_n?: number;
  fps?: number;
  /** Include server-side stage timings in the response */
  debug?: boolean;
  /** Trigger a one-off cProfile capture on the server (written to RERANK_PROFILE_DIR) */
  profile?: boolean;
};

/**
 * Qwen3-VL server response format
 */
export type Qwen3VLRerankResponse = {
  results: Array<{
    id: string;
    score: number;
    index: number;
  }>;
  debug?: {
    total_ms: number;
    build_query_ms: number;
    split_docs_ms: number;
    text_only_ms: number;
    multimodal_ms: number;
    sort_ms: number;
    profile_path?: string;
  };
};

/**
 * Health check response from Qwen3-VL server
 */
export type Qwen3VLHealthResponse = {
  status: "ok" | "error";
  model: string;
  device: string;
  /** Batch size for text-only document processing */
  batch_size?: number;
  /** Whether torch.compile is enabled */
  compiled?: boolean;
  /** Peak memory usage in GB (CUDA only) */
  peak_memory_gb?: number;
  error?: string;
};
