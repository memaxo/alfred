/**
 * @alfred/rerank - Multimodal document reranking
 *
 * Provides a unified interface for reranking documents using either:
 * - Cohere API (text-only, SaaS)
 * - Qwen3-VL-Reranker (multimodal, self-hosted)
 *
 * Fail-open semantics: returns empty array if no backend configured.
 */

export { checkHealth, isQwen3VLAvailable, qwen3vlRerank } from "./client.js";

export { cohereRerank } from "./cohere.js";
export {
  getRerankBackend,
  isRerankAvailable,
  rerank,
  resolveBackend,
} from "./resolve.js";

export type {
  CohereRerankOptions,
  Qwen3VLHealthResponse,
  Qwen3VLRerankRequest,
  Qwen3VLRerankResponse,
  RerankBackend,
  RerankDocument,
  RerankOptions,
  RerankResult,
  RerankTelemetry,
} from "./types.js";
