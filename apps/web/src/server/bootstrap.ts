import { initApiServices, shutdownApiServices } from "@alfred/api/init";
import {
  startPatternLifecycleScheduler,
  stopPatternLifecycleScheduler,
} from "@alfred/api/scheduler/pattern-lifecycle";
import {
  startPreferenceDecayScheduler,
  stopPreferenceDecayScheduler,
} from "@alfred/api/scheduler/preference-decay";
import {
  startPreferenceInferenceScheduler,
  stopPreferenceInferenceScheduler,
} from "@alfred/api/scheduler/preference-inference";
import {
  startProjectLifecycleScheduler,
  stopProjectLifecycleScheduler,
} from "@alfred/api/scheduler/project-lifecycle";
import {
  startReembedScheduler,
  stopReembedScheduler,
} from "@alfred/api/scheduler/reembed";
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "@alfred/api/scheduler/remind";
import { initEmbedding, shutdownEmbedding } from "@alfred/embed";
import { logger } from "@alfred/logger";
import {
  getEmbedDefaultModel,
  getEmbedEagerInit,
  getSchedPatternLifecycle,
  getSchedPreferenceInference,
  getSchedProjectLifecycle,
  getSchedReembed,
  getSchedRemind,
} from "@/lib/env/server-only";

let initialized = false;

/**
 * Initialize all server-side services
 * - Reminder scheduler (if enabled)
 * - API services (compression worker, voice pools)
 *
 * Uses server-only environment utilities to prevent server code leakage
 * into client bundles.
 */
export function initServer() {
  if (initialized) {
    return;
  }

  initialized = true;

  // Initialize reminder scheduler (if enabled)
  // Use server-only utility instead of direct process.env access
  try {
    if (getSchedRemind() === "1") {
      startReminderScheduler({ logger });
      logger.info("assistant_remind_scheduler_init", {
        message: "Scheduler init requested (SCHED_REMIND=1)",
      });
    } else {
      logger.info("assistant_remind_scheduler_disabled", {
        message: "Scheduler disabled (unset SCHED_REMIND)",
      });
    }
  } catch (error) {
    logger.error("assistant_remind_scheduler_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    if (getSchedPreferenceInference() === "1") {
      startPreferenceInferenceScheduler({ logger });
      startPreferenceDecayScheduler({ logger });
      logger.info("preference_scheduler_init", {
        message: "Preference schedulers started",
      });
    } else {
      logger.info("preference_scheduler_disabled", {
        message:
          "Set SCHED_PREFERENCE_INFERENCE=1 to enable preference schedulers",
      });
    }
  } catch (error) {
    logger.error("preference_scheduler_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    if (getSchedProjectLifecycle() === "1") {
      startProjectLifecycleScheduler({ logger });
      logger.info("project_lifecycle_scheduler_init", {
        message: "Scheduler init requested (SCHED_PROJECT_LIFECYCLE=1)",
      });
    } else {
      logger.info("project_lifecycle_scheduler_disabled", {
        message: "Scheduler disabled (unset SCHED_PROJECT_LIFECYCLE)",
      });
    }
  } catch (error) {
    logger.error("project_lifecycle_scheduler_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    if (getSchedPatternLifecycle() === "1") {
      startPatternLifecycleScheduler({ logger });
      logger.info("pattern_lifecycle_scheduler_init", {
        message: "Scheduler init requested (SCHED_PATTERN_LIFECYCLE=1)",
      });
    } else {
      logger.info("pattern_lifecycle_scheduler_disabled", {
        message: "Scheduler disabled (unset SCHED_PATTERN_LIFECYCLE)",
      });
    }
  } catch (error) {
    logger.error("pattern_lifecycle_scheduler_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Initialize embedding system (registry with providers)
  try {
    const defaultModel = getEmbedDefaultModel() === "kalm" ? "kalm" : "qwen";
    const eager = getEmbedEagerInit() === "1";

    void initEmbedding({ defaultModel, eager, logger }).then(() => {
      logger.info("embed_init_complete", {
        defaultModel,
        eager,
      });
    });
  } catch (error) {
    logger.error("embed_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Initialize re-embedding scheduler (if enabled)
  // Used during model migration to re-embed existing content
  try {
    if (getSchedReembed() === "1") {
      startReembedScheduler({ logger });
      logger.info("reembed_scheduler_init", {
        message: "Re-embedding scheduler started (SCHED_REEMBED=1)",
      });
    } else {
      logger.info("reembed_scheduler_disabled", {
        message: "Set SCHED_REEMBED=1 to enable re-embedding scheduler",
      });
    }
  } catch (error) {
    logger.error("reembed_scheduler_init_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Initialize API services (compression worker, voice pools)
  initApiServices();

  // Handle graceful shutdown
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // HMR support (development only)
  if (import.meta.hot) {
    import.meta.hot.on?.("vite:beforeFullReload", () => {
      try {
        stopReminderScheduler();
        stopPreferenceInferenceScheduler();
        stopPreferenceDecayScheduler();
        stopProjectLifecycleScheduler();
        stopPatternLifecycleScheduler();
        stopReembedScheduler();
      } catch (error) {
        logger.error("assistant_remind_scheduler_stop_failed", {
          context: "before_reload",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    import.meta.hot.dispose(() => {
      try {
        stopReminderScheduler();
        stopPreferenceInferenceScheduler();
        stopPreferenceDecayScheduler();
        stopProjectLifecycleScheduler();
        stopPatternLifecycleScheduler();
        stopReembedScheduler();
        void shutdownEmbedding(logger);
      } catch (error) {
        logger.error("assistant_remind_scheduler_stop_failed", {
          context: "on_dispose",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      initialized = false;
    });
  }
}

/**
 * Gracefully shutdown all server-side services
 */
export async function shutdown() {
  if (!initialized) {
    return;
  }

  logger.info("server_shutdown_initiated");

  // Stop reminder scheduler
  try {
    stopReminderScheduler();
    logger.info("reminder_scheduler_stopped");
  } catch (error) {
    logger.error("reminder_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    stopPreferenceInferenceScheduler();
    stopPreferenceDecayScheduler();
    logger.info("preference_schedulers_stopped");
  } catch (error) {
    logger.error("preference_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    stopProjectLifecycleScheduler();
    logger.info("project_lifecycle_scheduler_stopped");
  } catch (error) {
    logger.error("project_lifecycle_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    stopPatternLifecycleScheduler();
    logger.info("pattern_lifecycle_scheduler_stopped");
  } catch (error) {
    logger.error("pattern_lifecycle_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Stop re-embedding scheduler
  try {
    stopReembedScheduler();
    logger.info("reembed_scheduler_stopped");
  } catch (error) {
    logger.error("reembed_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Shutdown embedding system
  try {
    await shutdownEmbedding(logger);
    logger.info("embed_shutdown_complete");
  } catch (error) {
    logger.error("embed_shutdown_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Shutdown API services
  shutdownApiServices();

  initialized = false;
  logger.info("server_shutdown_complete");
}
