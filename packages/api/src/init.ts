import { getAssistantAgentDefaults } from "@alfred/agent";
import {
  startCodexSessionCleanupWorker,
  stopCodexSessionCleanupWorker,
} from "@alfred/agent/orchestrator/codex-session";
import {
  startCompressionWorker,
  stopCompressionWorker,
} from "@alfred/agent/orchestrator/compression-worker";
import { compressionWorkerOverrides } from "@alfred/agent/orchestrator/config";
import {
  startLearningWorker,
  stopLearningWorker,
} from "@alfred/agent/orchestrator/learning-worker";
import { flushPreviewCleanupBacklog } from "@alfred/agent/orchestrator/tool/worktree";
import { rehydrateSuspendedRuns } from "@alfred/agent/workflow/session-recovery";
import { logger } from "@alfred/logger";
import { resumeInterruptedPlans } from "@alfred/runtime";
import { initializeVoicePools, shutdownVoicePools } from "./voice/pools";
import {
  startVoiceStreamingPrototype,
  stopVoiceStreamingPrototype,
} from "./voice/streaming";

let initialized = false;
let worktreeCleanupInterval: ReturnType<typeof setInterval> | null = null;

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

  rehydrateSuspendedRuns().catch((error) => {
    logger.error("workflow_rehydrate_start_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const cleanupIntervalMs =
    Number.parseInt(
      process.env.WORKTREE_PREVIEW_CLEANUP_INTERVAL_MS ?? "",
      10
    ) || 5 * 60 * 1000;
  const cleanupRoot =
    process.env.WORKTREE_PREVIEW_CLEANUP_ROOT ?? process.cwd();

  flushPreviewCleanupBacklog(cleanupRoot)
    .then((count) => {
      if (count > 0) {
        logger.info("worktree_preview_cleanup_startup", { cleaned: count });
      }
    })
    .catch((error) => {
      logger.warn("worktree_preview_cleanup_startup_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

  worktreeCleanupInterval = setInterval(() => {
    flushPreviewCleanupBacklog(cleanupRoot)
      .then((count) => {
        if (count > 0) {
          logger.info("worktree_preview_cleanup_interval", {
            cleaned: count,
          });
        }
      })
      .catch((error) => {
        logger.warn("worktree_preview_cleanup_interval_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, cleanupIntervalMs);
  logger.info("worktree_preview_cleanup_interval_started", {
    cleanupIntervalMs,
    cleanupRoot,
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

  if (worktreeCleanupInterval) {
    clearInterval(worktreeCleanupInterval);
    worktreeCleanupInterval = null;
    logger.info("worktree_preview_cleanup_interval_stopped");
  }

  initialized = false;
  logger.info("api_services_shutdown_complete");
}
