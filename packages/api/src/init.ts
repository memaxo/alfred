import { getAssistantAgentDefaults } from "@alfred/agent";
import {
  startCompressionWorker,
  stopCompressionWorker,
} from "@alfred/agent/orchestrator/compression-worker";
import { compressionWorkerOverrides } from "@alfred/agent/orchestrator/config";
import {
  startCodexSessionCleanupWorker,
  stopCodexSessionCleanupWorker,
} from "@alfred/agent/orchestrator/codex-session";
import {
  startLearningWorker,
  stopLearningWorker,
} from "@alfred/agent/orchestrator/learning-worker";
import { logger } from "@alfred/logger";
import { resumeInterruptedPlans } from "@alfred/runtime";
import { initializeVoicePools, shutdownVoicePools } from "./voice/pools";
import {
  startVoiceStreamingPrototype,
  stopVoiceStreamingPrototype,
} from "./voice/streaming";

let initialized = false;

/**
 * Initialize all API services
 * - Compression worker (if enabled)
 * - Voice pools (if using local models)
 * - Resume interrupted plans
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

  // Initialize learning worker (if enabled via env)
  if (process.env.ENABLE_LEARNING_WORKER === "1") {
    startLearningWorker();
    logger.info("learning_worker_init", {
      message: "Learning worker started",
    });
  }

  startCodexSessionCleanupWorker();
  logger.info("codex_session_cleanup_worker_started", {
    intervalMs:
      Number.parseInt(
        process.env.CODEX_SESSION_CLEANUP_INTERVAL_MS ?? "",
        10
      ) || undefined,
  });

  // Resume interrupted plans from DB (background)
  resumeInterruptedPlans(getAssistantAgentDefaults().tools).catch((error) => {
    logger.error("resume_plans_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Initialize voice pools (Maya1 or Supertonic)
  const voiceProvider = process.env.VOICE_PROVIDER ?? "maya1";
  if (voiceProvider === "maya1" || voiceProvider === "supertonic") {
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
    stopLearningWorker();
    stopCodexSessionCleanupWorker();
    logger.info("compression_worker_stopped");
  } catch (error) {
    logger.error("compression_worker_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const voiceProvider = process.env.VOICE_PROVIDER ?? "maya1";
  // Shutdown voice pools
  if (voiceProvider === "maya1" || voiceProvider === "supertonic") {
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
