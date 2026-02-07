import { logger } from "@alfred/logger";
import { startDefaultMetrics } from "@alfred/metrics/default";

import { initMetricsHooks } from "./metrics";
import {
  isDbAvailable,
  isDbConnectionError,
  isUvAvailable,
} from "./utils/service-availability";
import { initializeVoicePools, shutdownVoicePools } from "./voice/pools";
import {
  startVoiceStreamingPrototype,
  stopVoiceStreamingPrototype,
} from "./voice/streaming";

let initialized = false;
let worktreeCleanupInterval: ReturnType<typeof setInterval> | null = null;

let stopCompressionWorkerFn: (() => void) | null = null;
let stopLearningWorkerFn: (() => void) | null = null;
let stopCodexSessionCleanupWorkerFn: (() => void) | null = null;
let stopEnrichCleanupSchedulerFn: (() => void) | null = null;

function isViteModuleRunnerClosed(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Vite module runner has been closed")
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

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

  // Start Prometheus default metrics collection only in long-lived service mode.
  // Avoid import-time timers that keep short scripts from exiting (e.g. router import checks).
  startDefaultMetrics();
  initMetricsHooks();

  // Initialize compression worker (if enabled)
  void (async () => {
    const { compressionWorkerOverrides } =
      await import("@alfred/agent/orchestrator/config");
    const { startCompressionWorker, stopCompressionWorker } =
      await import("@alfred/agent/orchestrator/compression-worker");
    stopCompressionWorkerFn = stopCompressionWorker;
    const compressionConfig = compressionWorkerOverrides();
    if (compressionConfig.enabled) {
      startCompressionWorker(compressionConfig);
      logger.info("compression_worker_init", {
        intervalMs: compressionConfig.intervalMs,
        message: "Compression worker started",
      });
    } else {
      logger.info("compression_worker_disabled", {
        message: "Compression worker disabled",
      });
    }
  })().catch((error) => {
    if (isViteModuleRunnerClosed(error)) {
      return;
    }
    logger.error("compression_worker_init_failed", {
      error: toErrorMessage(error),
    });
  });

  // Initialize learning worker (maintenance only: decay, pruning, backfill)
  if (process.env.ENABLE_LEARNING_WORKER === "1") {
    void (async () => {
      const { startLearningWorker, stopLearningWorker } =
        await import("@alfred/agent/orchestrator/learning-worker");
      stopLearningWorkerFn = stopLearningWorker;
      startLearningWorker();
      logger.info("learning_worker_init", {
        message: "Learning worker started (maintenance only)",
      });
    })().catch((error) => {
      if (isViteModuleRunnerClosed(error)) {
        return;
      }
      logger.error("learning_worker_init_failed", {
        error: toErrorMessage(error),
      });
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

      const enableDbRecovery =
        process.env.ENABLE_DB_RECOVERY === "1" ||
        process.env.NODE_ENV === "production";
      if (!enableDbRecovery) {
        logger.info("db_recovery_disabled", {
          message:
            "DB recovery workers disabled by default in dev. Set ENABLE_DB_RECOVERY=1 to enable codex cleanup, plan resume, and workflow rehydration.",
        });
        return;
      }

      // Start codex session cleanup worker
      void (async () => {
        const {
          startCodexSessionCleanupWorker,
          stopCodexSessionCleanupWorker,
        } = await import("@alfred/agent/orchestrator/codex-session");
        stopCodexSessionCleanupWorkerFn = stopCodexSessionCleanupWorker;
        startCodexSessionCleanupWorker();
        logger.info("codex_session_cleanup_worker_started", {
          intervalMs:
            Number.parseInt(
              process.env.CODEX_SESSION_CLEANUP_INTERVAL_MS ?? "",
              10
            ) || undefined,
        });
      })().catch((error) => {
        if (isViteModuleRunnerClosed(error)) {
          return;
        }
        logger.error("codex_session_cleanup_worker_failed", {
          error: toErrorMessage(error),
        });
      });

      // Start enrichment retention cleanup (gated by SCHED_ENRICH_CLEANUP=1)
      void (async () => {
        const { startEnrichCleanupScheduler, stopEnrichCleanupScheduler } =
          await import("./scheduler/enrich");
        stopEnrichCleanupSchedulerFn = stopEnrichCleanupScheduler;
        startEnrichCleanupScheduler({ logger });
      })().catch((error) => {
        if (isViteModuleRunnerClosed(error)) {
          return;
        }
        logger.error("enrich_cleanup_scheduler_init_failed", {
          error: toErrorMessage(error),
        });
      });
      void (async () => {
        const [{ getAssistantAgentDefaults }, { resumeInterruptedPlans }] =
          await Promise.all([
            import("@alfred/agent/agents"),
            import("@alfred/runtime/loops/resume"),
          ]);
        const tools = getAssistantAgentDefaults().tools ?? {};
        resumeInterruptedPlans(tools).catch((error) => {
          if (isViteModuleRunnerClosed(error)) {
            return;
          }
          const msg = error instanceof Error ? error.message : String(error);
          if (isDbConnectionError(error)) {
            logger.warn("resume_interrupted_plans_db_unavailable", {
              error: msg,
            });
          } else {
            logger.error("resume_interrupted_plans_error", { error: msg });
          }
        });
      })().catch((error) => {
        if (isViteModuleRunnerClosed(error)) {
          return;
        }
        logger.error("resume_interrupted_plans_init_failed", {
          error: toErrorMessage(error),
        });
      });

      void (async () => {
        const { failOrphanedRunningRuns, rehydrateSuspendedRuns } =
          await import("@alfred/agent/workflow/session-recovery");
        rehydrateSuspendedRuns().catch((error) => {
          if (isViteModuleRunnerClosed(error)) {
            return;
          }
          const msg = error instanceof Error ? error.message : String(error);
          if (isDbConnectionError(error)) {
            logger.warn("workflow_rehydrate_db_unavailable", { error: msg });
          } else {
            logger.error("workflow_rehydrate_failed", { error: msg });
          }
        });
        failOrphanedRunningRuns().catch((error) => {
          if (isViteModuleRunnerClosed(error)) {
            return;
          }
          const msg = error instanceof Error ? error.message : String(error);
          if (isDbConnectionError(error)) {
            logger.warn("workflow_running_recovery_db_unavailable", {
              error: msg,
            });
          } else {
            logger.error("workflow_running_recovery_failed", { error: msg });
          }
        });
      })().catch((error) => {
        if (isViteModuleRunnerClosed(error)) {
          return;
        }
        logger.error("workflow_recovery_init_failed", {
          error: toErrorMessage(error),
        });
      });
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

  void (async () => {
    const { flushPreviewCleanupBacklog } =
      await import("@alfred/agent/orchestrator/tool/worktree");
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
  })().catch((error) => {
    if (isViteModuleRunnerClosed(error)) {
      return;
    }
    logger.warn("worktree_preview_cleanup_startup_import_failed", {
      error: toErrorMessage(error),
    });
  });

  worktreeCleanupInterval = setInterval(() => {
    void (async () => {
      const { flushPreviewCleanupBacklog } =
        await import("@alfred/agent/orchestrator/tool/worktree");
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
    })().catch((error) => {
      if (isViteModuleRunnerClosed(error)) {
        return;
      }
      logger.warn("worktree_preview_cleanup_interval_import_failed", {
        error: toErrorMessage(error),
      });
    });
  }, cleanupIntervalMs).unref();
  logger.info("worktree_preview_cleanup_interval_started", {
    cleanupIntervalMs,
    cleanupRoot,
  });

  // FIX: Check UV availability before initializing voice pools.
  // Default to remote voice in test to avoid local Python pool startup.
  const defaultVoiceProvider =
    process.env.NODE_ENV === "test" || process.env.VITE_TEST_MODE === "true"
      ? "openai"
      : "maya1";
  const voiceProvider = (
    process.env.VOICE_PROVIDER ?? defaultVoiceProvider
  ).toLowerCase();
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

  try {
    stopCompressionWorkerFn?.();
    if (stopCompressionWorkerFn) {
      logger.info("compression_worker_stopped");
    }
  } catch (error) {
    logger.warn("compression_worker_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    stopLearningWorkerFn?.();
    if (stopLearningWorkerFn) {
      logger.info("learning_worker_stopped");
    }
  } catch (error) {
    logger.warn("learning_worker_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    stopCodexSessionCleanupWorkerFn?.();
    if (stopCodexSessionCleanupWorkerFn) {
      logger.info("codex_session_cleanup_worker_stopped");
    }
  } catch (error) {
    logger.warn("codex_session_cleanup_worker_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    stopEnrichCleanupSchedulerFn?.();
    if (stopEnrichCleanupSchedulerFn) {
      logger.info("enrich_cleanup_scheduler_stopped");
    }
  } catch (error) {
    logger.warn("enrich_cleanup_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const voiceProvider = process.env.VOICE_PROVIDER ?? "openai";
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

  stopCompressionWorkerFn = null;
  stopLearningWorkerFn = null;
  stopCodexSessionCleanupWorkerFn = null;
  stopEnrichCleanupSchedulerFn = null;

  initialized = false;
  logger.info("api_services_shutdown_complete");
}
