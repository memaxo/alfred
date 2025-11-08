import { startReminderScheduler, stopReminderScheduler } from "@alfred/api/scheduler/remind";

let initialized = false;

export async function initServer() {
  if (initialized) {
    return;
  }

  initialized = true;

  if (process.env.SCHED_REMIND === "1") {
    startReminderScheduler({ logger: console });
    console.log("[assistant-remind] Scheduler init requested (SCHED_REMIND=1).");
  } else {
    console.log("[assistant-remind] Scheduler disabled (unset SCHED_REMIND).");
  }

  if (import.meta.hot) {
    import.meta.hot.on?.("vite:beforeFullReload", () => {
      try {
        stopReminderScheduler();
      } catch (error) {
        console.error("[assistant-remind] Failed to stop scheduler before reload:", error);
      }
    });

    import.meta.hot.dispose(() => {
      try {
        stopReminderScheduler();
      } catch (error) {
        console.error("[assistant-remind] Failed to stop scheduler on dispose:", error);
      }
      initialized = false;
    });
  }
}
