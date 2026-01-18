/**
 * Embedding Model Registry
 * Provides a unified interface for managing multiple embedding providers
 * with support for heterogeneous models (text, image, video)
 */

import { EMBEDDING_DIM } from "./dim.js";

/**
 * Capabilities supported by an embedding model
 */
export type EmbeddingCapabilities = {
  text: boolean;
  image: boolean;
  video: boolean;
};

/**
 * Configuration for an embedding model
 */
export type EmbeddingModelConfig = {
  /** Unique model identifier (e.g., "kalm-12b-1024") */
  id: string;
  /** HuggingFace model name */
  name: string;
  /** Output embedding dimensions (after MRL truncation if applicable) */
  dimensions: number;
  /** Supported input modalities */
  capabilities: EmbeddingCapabilities;
  /** Native dimensions before MRL truncation */
  nativeDimensions?: number;
  /** Context length in tokens */
  contextLength?: number;
};

/**
 * Input types for embedding generation
 */
export type EmbeddingInput =
  | { type: "text"; content: string }
  | { type: "image"; url: string; mimeType?: string }
  | { type: "mixed"; text: string; imageUrl: string; mimeType?: string };

/**
 * Result of an embedding operation
 */
export type EmbeddingResult = {
  embedding: number[];
  modelId: string;
  inputType: EmbeddingInput["type"];
};

/**
 * Interface that all embedding providers must implement
 */
export type EmbeddingProvider = {
  /** Model configuration */
  readonly config: EmbeddingModelConfig;

  /**
   * Generate embedding for a single input
   * @param input - Text, image, or mixed input
   * @returns Embedding vector
   */
  embed(input: EmbeddingInput): Promise<number[]>;

  /**
   * Generate embeddings for multiple inputs
   * @param inputs - Array of text, image, or mixed inputs
   * @returns Array of embedding vectors
   */
  embedMany(inputs: EmbeddingInput[]): Promise<number[][]>;

  /**
   * Check if the provider is ready and healthy
   */
  isHealthy(): boolean;

  /**
   * Initialize the provider (load models, start processes, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the provider and release resources
   */
  shutdown(): Promise<void>;
};

/**
 * Registry for managing multiple embedding providers
 *
 * Supports:
 * - Registering multiple providers
 * - Setting a default provider
 * - Retrieving providers by ID
 * - Capability-based provider selection
 */
export class EmbeddingRegistry {
  private readonly providers = new Map<string, EmbeddingProvider>();
  private defaultId: string | null = null;

  /**
   * Register an embedding provider
   * @param provider - Provider instance to register
   */
  register(provider: EmbeddingProvider): void {
    const id = provider.config.id;
    if (this.providers.has(id)) {
      throw new Error(`Provider with ID "${id}" is already registered`);
    }
    this.providers.set(id, provider);
  }

  /**
   * Unregister an embedding provider
   * @param id - Provider ID to unregister
   */
  unregister(id: string): void {
    if (this.defaultId === id) {
      this.defaultId = null;
    }
    this.providers.delete(id);
  }

  /**
   * Set the default provider
   * @param id - Provider ID to set as default
   */
  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider with ID "${id}" is not registered`);
    }
    this.defaultId = id;
  }

  /**
   * Get the default provider ID
   */
  getDefaultId(): string | null {
    return this.defaultId;
  }

  /**
   * Get a provider by ID
   * @param id - Provider ID (optional, defaults to default provider)
   */
  get(id?: string): EmbeddingProvider {
    const targetId = id ?? this.defaultId;
    if (!targetId) {
      throw new Error("No default provider set and no ID specified");
    }

    const provider = this.providers.get(targetId);
    if (!provider) {
      throw new Error(`Provider with ID "${targetId}" not found`);
    }

    return provider;
  }

  /**
   * Get the default provider
   */
  getDefault(): EmbeddingProvider {
    return this.get();
  }

  /**
   * Find a provider that supports the given input type
   * @param inputType - Input type to match
   * @param preferredId - Preferred provider ID (optional)
   */
  findByCapability(
    inputType: EmbeddingInput["type"],
    preferredId?: string
  ): EmbeddingProvider | null {
    // Try preferred provider first
    if (preferredId && this.providers.has(preferredId)) {
      const preferred = this.providers.get(preferredId);
      if (
        preferred &&
        supportsInputType(preferred.config.capabilities, inputType)
      ) {
        return preferred;
      }
    }

    // Try default provider
    if (this.defaultId) {
      const defaultProvider = this.providers.get(this.defaultId);
      if (
        defaultProvider &&
        supportsInputType(defaultProvider.config.capabilities, inputType)
      ) {
        return defaultProvider;
      }
    }

    // Find any provider that supports the input type
    for (const provider of this.providers.values()) {
      if (supportsInputType(provider.config.capabilities, inputType)) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Get all registered providers
   */
  getAll(): Map<string, EmbeddingProvider> {
    return new Map(this.providers);
  }

  /**
   * Get all provider IDs
   */
  getIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * Initialize all registered providers
   */
  async initializeAll(): Promise<void> {
    const promises = Array.from(this.providers.values()).map((p) =>
      p.initialize()
    );
    await Promise.all(promises);
  }

  /**
   * Shutdown all registered providers
   */
  async shutdownAll(): Promise<void> {
    const promises = Array.from(this.providers.values()).map((p) =>
      p.shutdown()
    );
    await Promise.all(promises);
    this.providers.clear();
    this.defaultId = null;
  }
}

/**
 * Check if capabilities support a given input type
 */
function supportsInputType(
  capabilities: EmbeddingCapabilities,
  inputType: EmbeddingInput["type"]
): boolean {
  switch (inputType) {
    case "text":
      return capabilities.text;
    case "image":
      return capabilities.image;
    case "mixed":
      return capabilities.text && capabilities.image;
    default:
      return false;
  }
}

/**
 * Singleton registry instance
 */
let globalRegistry: EmbeddingRegistry | null = null;

/**
 * Get the global embedding registry
 * Creates one if it doesn't exist
 */
export function getRegistry(): EmbeddingRegistry {
  if (!globalRegistry) {
    globalRegistry = new EmbeddingRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (for testing)
 */
export function resetRegistry(): void {
  if (globalRegistry) {
    void globalRegistry.shutdownAll();
  }
  globalRegistry = null;
}

/**
 * Known model IDs for type safety
 */
export const MODEL_IDS = {
  KALM_12B: "kalm-12b-1024",
  QWEN3_VL_2B: "qwen3-vl-2b-1024",
} as const;

export type ModelId = (typeof MODEL_IDS)[keyof typeof MODEL_IDS];

/**
 * Default model configurations
 */
export const MODEL_CONFIGS: Record<ModelId, EmbeddingModelConfig> = {
  [MODEL_IDS.KALM_12B]: {
    id: MODEL_IDS.KALM_12B,
    name: "tencent/KaLM-Embedding-Gemma3-12B-2511",
    dimensions: EMBEDDING_DIM,
    nativeDimensions: 3840,
    capabilities: { text: true, image: false, video: false },
  },
  [MODEL_IDS.QWEN3_VL_2B]: {
    id: MODEL_IDS.QWEN3_VL_2B,
    name: "Qwen/Qwen3-VL-Embedding-2B",
    dimensions: EMBEDDING_DIM,
    nativeDimensions: 2048,
    contextLength: 32_768,
    capabilities: { text: true, image: true, video: true },
  },
};
