import {
  startReminderScheduler,
  stopReminderScheduler,
} from "@alfred/api/scheduler/remind";
import { logger } from "@alfred/api/utils/logger";

let initialized = false;

export function initServer() {
  if (initialized) {
    return;
  }

  initialized = true;

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

  if (import.meta.hot) {
    import.meta.hot.on?.("vite:beforeFullReload", () => {
      try {
        stopReminderScheduler();
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
