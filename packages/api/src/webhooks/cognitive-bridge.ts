import { logger } from "@alfred/logger";
import {
  cognitiveBridgeProcessingMs,
  cognitiveBridgeTriggerTotal,
} from "@alfred/metrics/shared";

export type BridgeReminderPayload = {
  type: "reminder";
  id: string;
  title: string;
  when: string;
  description?: string;
  intentType?: string;
  intentData?: unknown;
  status?: "pending" | "completed" | "failed";
};

// biome-ignore lint/suspicious/useAwait: Bridge logic will be async in future
export async function bridgeReminder(
  userId: string,
  payload: BridgeReminderPayload
): Promise<{
  success: boolean;
  error?: string;
  action?: string;
  taskId?: string;
}> {
  const startTime = Date.now();

  try {
    cognitiveBridgeTriggerTotal.inc({
      source: "reminder",
      action: "trigger",
    });

    // TODO: Implement actual cognitive bridge logic
    // This would integrate with the cognitive system to process reminders
    logger.info("cognitive_bridge_reminder", {
      userId,
      reminderId: payload.id,
      title: payload.title,
    });

    cognitiveBridgeProcessingMs.observe(
      { source: "reminder" },
      Date.now() - startTime
    );

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("cognitive_bridge_reminder_failed", {
      userId,
      reminderId: payload.id,
      error: errorMsg,
    });

    cognitiveBridgeProcessingMs.observe(
      { source: "reminder" },
      Date.now() - startTime
    );

    return { success: false, error: errorMsg };
  }
}
