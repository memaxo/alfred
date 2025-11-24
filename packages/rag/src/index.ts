export { EMBEDDING_DIM } from "@alfred/embed";
export type { CodeFile } from "./code";
export {
  type Chunk,
  chunk,
  type EmbeddingProvider,
  embed,
  embedMany,
  ingest,
  retrieve,
  setEmbeddingProvider,
} from "./doc";
export {
  type RerankOptions,
  type RerankResult,
  type RerankTelemetry,
  rerank,
} from "./rerank";
