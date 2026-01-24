import { type Event } from "@alfred/cognitive/state";
import { timestamp } from "@alfred/cognitive/state";
import { logger } from "@alfred/logger";
import {
  cognitiveBridgeProcessingMs,
  cognitiveBridgeTriggerTotal,
} from "@alfred/metrics/shared";
import { RuntimeContext } from "@alfred/type/runtime-context";

export interface BridgeReminderPayload {
  type: "reminder";
  id: string;
  title: string;
  when: string;
  description?: string;
  intentType?: string;
  intentData?: unknown;
  status?: "pending" | "completed" | "failed";
}

// oxlint-disable useAwait: Bridge logic will be async in future
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
      action: "trigger",
      source: "reminder",
    });

    const contentParts = [
      `Reminder: ${payload.title}`,
      `When: ${payload.when}`,
      payload.description ? `Notes: ${payload.description}` : null,
      payload.intentType ? `Intent: ${payload.intentType}` : null,
    ].filter((p): p is string => typeof p === "string" && p.length > 0);

    const event: Event = {
      _: "input",
      content: contentParts.join("\n"),
      source: "system",
      ts: timestamp(Date.now()),
    };

    // Bridge into the cognitive event stream (best-effort).
    // This intentionally avoids executing effects here; the reminder scheduler is a
    // persistence boundary, not an agent runtime.
    const { runCognitiveLoop } = await import("@alfred/runtime/cognitive");
    const runtimeCtx = new RuntimeContext([
      ["userId", userId],
      ["source", "reminder"],
      ["reminderId", payload.id],
    ]);
    await runCognitiveLoop(runtimeCtx, "default", event);

    logger.info("cognitive_bridge_reminder", {
      reminderId: payload.id,
      title: payload.title,
      userId,
    });

    cognitiveBridgeProcessingMs.observe(
      { source: "reminder" },
      Date.now() - startTime
    );

    return {
      action: "cognitive.append",
      success: true,
      taskId: payload.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("cognitive_bridge_reminder_failed", {
      error: errorMsg,
      reminderId: payload.id,
      userId,
    });

    cognitiveBridgeProcessingMs.observe(
      { source: "reminder" },
      Date.now() - startTime
    );

    return { error: errorMsg, success: false };
  }
}
