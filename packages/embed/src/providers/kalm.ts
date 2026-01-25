/**
 * KaLM-Embedding Provider
 * Text-only embedding provider using KaLM-Embedding-Gemma3-12B-2511
 * Wraps existing EmbedPool for backwards compatibility
 */

import { EmbedPool } from "../pool.js";
import {
  type EmbeddingInput,
  type EmbeddingModelConfig,
  type EmbeddingProvider,
  MODEL_CONFIGS,
  MODEL_IDS,
} from "../registry.js";

/**
 * KaLM embedding provider implementation
 * Uses the existing EmbedPool for backwards compatibility
 */
export class KalmProvider implements EmbeddingProvider {
  readonly config: EmbeddingModelConfig;

  private pool: EmbedPool | null = null;
  private initialized = false;
  private readonly poolSize: number;
  private readonly device: string;

  constructor(options: { poolSize?: number; device?: string } = {}) {
    this.config = MODEL_CONFIGS[MODEL_IDS.KALM_12B];
    this.poolSize =
      options.poolSize ?? (process.env.NODE_ENV === "production" ? 2 : 1);
    this.device = options.device ?? process.env.EMBED_DEVICE ?? "auto";
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.pool = new EmbedPool({
      modelName: this.config.name,
      device: this.device as "cpu" | "rocm" | "mps" | "auto",
      poolSize: this.poolSize,
    });

    await this.pool.initialize();
    this.initialized = true;
  }

  async embed(input: EmbeddingInput): Promise<number[]> {
    const embeddings = await this.embedMany([input]);
    const embedding = embeddings[0];

    if (!embedding) {
      throw new Error("Failed to generate embedding");
    }

    return embedding;
  }

  embedMany(inputs: EmbeddingInput[]): Promise<number[][]> {
    if (!(this.initialized && this.pool)) {
      throw new Error("Provider not initialized - call initialize() first");
    }

    // KaLM only supports text - extract text content
    const texts = inputs.map((input) => {
      switch (input.type) {
        case "text": {
          return input.content;
        }
        case "image": {
          throw new Error(
            "KaLM provider does not support image embeddings. Use Qwen provider instead."
          );
        }
        case "mixed": {
          // For mixed inputs, only use the text portion
          return input.text;
        }
        default: {
          const unknownInput = input as { type: string };
          throw new Error(`Unknown input type: ${unknownInput.type}`);
        }
      }
    });

    return this.pool.embed(texts);
  }

  isHealthy(): boolean {
    if (!(this.initialized && this.pool)) {
      return false;
    }

    const health = this.pool.getHealth();
    return health.some((h) => h.status === "idle" || h.status === "busy");
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.shutdown();
      this.pool = null;
    }
    this.initialized = false;
  }
}

/**
 * Create a KaLM provider instance
 */
export function createKalmProvider(options?: {
  poolSize?: number;
  device?: string;
}): KalmProvider {
  return new KalmProvider(options);
}
