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
import {
  startIdleLoopScheduler,
  stopIdleLoopScheduler,
} from "./scheduler/idle-loop";
import { isDbAvailable, isUvAvailable } from "./utils/service-availability";
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
 *
 * All services are initialized with graceful degradation - if DB or UV
 * is unavailable, the service is skipped with a warning instead of crashing.
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

  // FIX: Only start DB-dependent workers if DB is available
  // Check DB availability before starting DB-dependent services
  isDbAvailable()
    .then((dbOk) => {
      if (!dbOk) {
        logger.warn("db_unavailable_skipping_services", {
          message:
            "Database unavailable - skipping codex cleanup, plan resume, and workflow rehydration. Start database with 'bun run db:start' and restart.",
        });
        return;
      }

      // Start codex session cleanup worker
      startCodexSessionCleanupWorker();
      logger.info("codex_session_cleanup_worker_started", {
        intervalMs:
          Number.parseInt(
            process.env.CODEX_SESSION_CLEANUP_INTERVAL_MS ?? "",
            10
          ) || undefined,
      });

      // Resume interrupted plans from DB (background)
      {
        const tools = getAssistantAgentDefaults().tools ?? {};
        resumeInterruptedPlans(tools).catch((error) => {
          logger.error("resume_interrupted_plans_error", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      rehydrateSuspendedRuns().catch((error) => {
        logger.error("workflow_rehydrate_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Start idle loop scheduler (if enabled via IDLE_LOOP_ENABLED=1)
      startIdleLoopScheduler();
    })
    .catch((error) => {
      logger.warn("db_availability_check_error", {
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
  }, cleanupIntervalMs).unref();
  logger.info("worktree_preview_cleanup_interval_started", {
    cleanupIntervalMs,
    cleanupRoot,
  });

  // FIX: Check UV availability before initializing voice pools
  // Initialize voice pools (Maya1 or Supertonic)
  const voiceProvider = process.env.VOICE_PROVIDER ?? "maya1";
  if (voiceProvider === "maya1" || voiceProvider === "supertonic") {
    // Check if UV is available before trying to initialize voice pools
    if (isUvAvailable()) {
      initializeVoicePools()
        .then(() => {
          startVoiceStreamingPrototype();
        })
        .catch((error) => {
          logger.error("voice_pools_init_failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } else {
      logger.warn("voice_pools_skipped_uv_missing", {
        message:
          "UV package manager not found - skipping voice pool initialization. Install UV with: curl -LsSf https://astral.sh/uv/install.sh | sh",
      });
    }
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
    stopIdleLoopScheduler();
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
