import { compressionWorkerOverrides } from "@alfred/agent/orchestrator/config";
import {
  startCompressionWorker,
  stopCompressionWorker,
} from "@alfred/agent/orchestrator/compression-worker";
import { initializeVoicePools, shutdownVoicePools } from "./voice/pools";
import {
  startVoiceStreamingPrototype,
  stopVoiceStreamingPrototype,
} from "./voice/streaming";
import { logger } from "./utils/logger";

let initialized = false;

/**
 * Initialize all API services
 * - Compression worker (if enabled)
 * - Voice pools (if using local models)
 */
export function initApiServices(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  // Initialize compression worker (if enabled)
  const compressionConfig = compressionWorkerOverrides();
  if (compressionConfig.enabled) {
    startCompressionWorker(compressionConfig);
    logger.info("compression_worker_init", {
      message: "Compression worker started",
      intervalMs: compressionConfig.intervalMs,
    });
  } else {
    logger.info("compression_worker_disabled", {
      message: "Compression worker disabled",
    });
  }

  // Initialize voice pools (if using local models)
  if (process.env.VOICE_PROVIDER === "local") {
    initializeVoicePools()
      .then(() => {
        startVoiceStreamingPrototype();
      })
      .catch((error) => {
        logger.error("voice_pools_init_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}

/**
 * Shutdown all API services gracefully
 * - Stop compression worker
 * - Shutdown voice pools
 */
export function shutdownApiServices(): void {
  logger.info("api_services_shutdown_initiated");

  // Stop compression worker
  try {
    stopCompressionWorker();
    logger.info("compression_worker_stopped");
  } catch (error) {
    logger.error("compression_worker_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Shutdown voice pools
  if (process.env.VOICE_PROVIDER === "local") {
    shutdownVoicePools().catch((error) => {
      logger.error("voice_pools_shutdown_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    stopVoiceStreamingPrototype();
  }

  initialized = false;
  logger.info("api_services_shutdown_complete");
}
