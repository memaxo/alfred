export { EMBEDDING_DIM } from "@alfred/embed";
export type { CodeFile } from "./code";
export {
  type Chunk,
  chunk,
  type EmbeddingProvider,
  embed,
  embedMany,
  embedManyMultimodal,
  getCurrentModelId,
  type IngestOptions,
  ingest,
  ingestWithOptions,
  type RetrieveOptions,
  retrieve,
  retrieveWithOptions,
  setEmbeddingProvider,
} from "./doc";
export {
  canUseDirectly,
  type EvaluatorAction,
  type EvaluatorDocument,
  type EvaluatorResult,
  type EvaluatorThresholds,
  evaluateRetrieval,
  evaluateWithModel,
  shouldTriggerFallback,
} from "./evaluator";
export {
  type RerankOptions,
  type RerankResult,
  type RerankTelemetry,
  rerank,
} from "./rerank";
