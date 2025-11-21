import { initApiServices, shutdownApiServices } from "@alfred/api/init";
import {
  startPreferenceDecayScheduler,
  stopPreferenceDecayScheduler,
} from "@alfred/api/scheduler/preference-decay";
import {
  startPreferenceInferenceScheduler,
  stopPreferenceInferenceScheduler,
} from "@alfred/api/scheduler/preference-inference";
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "@alfred/api/scheduler/remind";
import { logger } from "@alfred/logger";

let initialized = false;

/**
 * Initialize all server-side services
 * - Reminder scheduler (if enabled)
 * - API services (compression worker, voice pools)
 */
export function initServer() {
  if (initialized) {
    return;
  }

  initialized = true;

  // Initialize reminder scheduler (if enabled)
  if (process.env.SCHED_REMIND === "1") {
    startReminderScheduler({ logger });
    logger.info("assistant_remind_scheduler_init", {
      message: "Scheduler init requested (SCHED_REMIND=1)",
    });
  } else {
    logger.info("assistant_remind_scheduler_disabled", {
      message: "Scheduler disabled (unset SCHED_REMIND)",
    });
  }

  if (process.env.SCHED_PREFERENCE_INFERENCE === "1") {
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
export function shutdown() {
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

  // Shutdown API services
  shutdownApiServices();

  initialized = false;
  logger.info("server_shutdown_complete");
}
