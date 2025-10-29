import { mastra } from "@alfred/agent";
import { appRouter } from "@alfred/api";
import { subscribeLinearAgentActivity } from "@alfred/api/subscribers/linear";
import { startReminderScheduler, stopReminderScheduler } from "@alfred/api/scheduler/remind";
import { RuntimeContext } from "@mastra/core/runtime-context";

let initialized = false;
let unsubscribeLinear: (() => void) | null = null;

function createWorkflowCaller() {
  return appRouter.createCaller({
    session: {
      user: {
        id: "system",
        roles: ["system"],
        scopes: ["linear.write", "workflow.plan"],
        email: "system@alfred.local",
        name: "Linear Subscriber",
      },
    } as any,
    runtime: {
      requestId: `linear-subscriber-${Date.now()}`,
      receivedAt: new Date(),
      method: "SUBSCRIBE",
      url: "linear:pubsub",
      ip: null,
      forwardedFor: [],
      userAgent: "linear-subscriber",
      referer: null,
    },
    runtimeContext: new RuntimeContext([]),
    policy: {
      obligations: [],
    },
  });
}

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

  if (!unsubscribeLinear) {
    try {
      unsubscribeLinear = subscribeLinearAgentActivity({
        pubsub: mastra.pubsub,
        createCaller: () => createWorkflowCaller(),
      });
      console.log("[assistant-linear] Subscriber registered for agent activity.");
    } catch (error) {
      console.error("[assistant-linear] Failed to register subscriber:", error);
    }
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
      if (unsubscribeLinear) {
        try {
          unsubscribeLinear();
        } catch (error) {
          console.error("[assistant-linear] Failed to unsubscribe during dispose:", error);
        }
        unsubscribeLinear = null;
      }
      initialized = false;
    });
  }
}
