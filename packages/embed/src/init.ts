/**
 * Embedding System Initialization
 * Sets up the embedding registry with providers based on configuration
 */

import { createKalmProvider } from "./providers/kalm.js";
import { createQwenProvider } from "./providers/qwen.js";
import { getRegistry, MODEL_IDS, resetRegistry } from "./registry.js";

export type EmbedInitOptions = {
  /** Default model to use (kalm or qwen). Defaults to qwen for multimodal support */
  defaultModel?: "kalm" | "qwen";
  /** Initialize providers immediately (load models). Defaults to false (lazy init) */
  eager?: boolean;
  /** Logger for status messages */
  logger?: Pick<Console, "info" | "warn" | "error">;
};

let initialized = false;

/**
 * Initialize the embedding system with providers
 * Call this at server startup before using embedding features
 */
export async function initEmbedding(
  options: EmbedInitOptions = {}
): Promise<void> {
  const {
    defaultModel = process.env.EMBED_DEFAULT_MODEL === "kalm" ? "kalm" : "qwen",
    eager = false,
    logger = console,
  } = options;

  if (initialized) {
    logger.warn?.("embed_init_already_initialized");
    return;
  }

  const registry = getRegistry();

  // Create providers
  const kalmProvider = createKalmProvider();
  const qwenProvider = createQwenProvider();

  // Register providers
  registry.register(kalmProvider);
  registry.register(qwenProvider);

  // Set default based on config
  const defaultId =
    defaultModel === "kalm" ? MODEL_IDS.KALM_12B : MODEL_IDS.QWEN3_VL_2B;
  registry.setDefault(defaultId);

  logger.info?.("embed_registry_initialized", {
    defaultModel: defaultId,
    providers: registry.getIds(),
  });

  // Eagerly initialize if requested (loads models into memory)
  if (eager) {
    logger.info?.("embed_eager_init_starting");
    try {
      const defaultProvider = registry.getDefault();
      await defaultProvider.initialize();
      logger.info?.("embed_eager_init_complete", { model: defaultId });
    } catch (error) {
      logger.error?.("embed_eager_init_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  initialized = true;
}

/**
 * Shutdown the embedding system
 * Call this at server shutdown to release resources
 */
export async function shutdownEmbedding(
  logger?: Pick<Console, "info" | "warn" | "error">
): Promise<void> {
  if (!initialized) {
    return;
  }

  try {
    const registry = getRegistry();
    await registry.shutdownAll();
    resetRegistry();
    initialized = false;
    logger?.info?.("embed_shutdown_complete");
  } catch (error) {
    logger?.error?.("embed_shutdown_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if embedding system is initialized
 */
export function isEmbeddingInitialized(): boolean {
  return initialized;
}

/**
 * Get the current default model ID
 */
export function getDefaultModelId(): string | null {
  if (!initialized) {
    return null;
  }
  return getRegistry().getDefaultId();
}
