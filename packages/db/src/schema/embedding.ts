/**
 * ALFRED Embedding Model Registry Schema
 * Tracks embedding models for heterogeneous embedding support
 */

import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Embedding model registry
 * Tracks available embedding models and their capabilities
 */
export const embeddingModels = pgTable("embedding_models", {
  id: text("id").primaryKey(), // e.g., "kalm-12b-1024", "qwen3-vl-2b-1024"
  name: text("name").notNull(), // HuggingFace model name
  dimensions: integer("dimensions").notNull(), // Output embedding dimensions
  supportsText: boolean("supports_text").notNull().default(true),
  supportsImage: boolean("supports_image").notNull().default(false),
  supportsVideo: boolean("supports_video").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  config: jsonb("config").$type<EmbeddingModelConfig>(), // Model-specific config
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/**
 * Model-specific configuration stored in JSONB
 */
export interface EmbeddingModelConfig {
  /** Whether MRL truncation is applied */
  mrl_truncation?: boolean;
  /** Native dimensions before truncation */
  native_dimensions?: number;
  /** Context length in tokens */
  context_length?: number;
  /** Additional model-specific settings */
  [key: string]: unknown;
}

/**
 * Known embedding model IDs (used for type safety)
 */
export const EMBEDDING_MODEL_IDS = {
  KALM_12B: "kalm-12b-1024",
  QWEN3_VL_2B: "qwen3-vl-2b-1024",
} as const;

export type EmbeddingModelId =
  (typeof EMBEDDING_MODEL_IDS)[keyof typeof EMBEDDING_MODEL_IDS];
