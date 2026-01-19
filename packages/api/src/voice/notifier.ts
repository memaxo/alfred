/**
 * Voice workflow notifier for WebSocket-based notifications.
 *
 * Subscribes to workflow events and pushes notifications to clients
 * based on user preferences (voice, sound, silent).
 */

import { logger } from "@alfred/logger";
import type { StructuredPlan } from "@alfred/plan";
import { planCompletionSummary, planStatusSummary } from "./plan-speech.js";
import { getVoicePools } from "./pools.js";
import {
  getVoiceWorkflowPreferences,
  type VoiceWorkflowNotifications,
  type VoiceWorkflowUpdates,
} from "./preferences.js";

/**
 * Notification event types
 */
export type VoiceWorkflowNotificationEvent =
  | {
      type: "completion";
      runId: string;
      success: boolean;
      message: string;
      notificationMode: VoiceWorkflowNotifications;
      audioBase64?: string;
      mimeType?: string;
    }
  | {
      type: "progress";
      runId: string;
      completedTasks: number;
      totalTasks: number;
      percentage: number;
      message: string;
      notificationMode: VoiceWorkflowNotifications;
      audioBase64?: string;
      mimeType?: string;
    }
  | {
      type: "phase_complete";
      runId: string;
      phaseName: string;
      phaseIndex: number;
      totalPhases: number;
      message: string;
      notificationMode: VoiceWorkflowNotifications;
      audioBase64?: string;
      mimeType?: string;
    };

/**
 * Subscriber callback type
 */
export type NotificationSubscriber = (
  event: VoiceWorkflowNotificationEvent
) => void;

/**
 * Registry of active notification subscribers per user
 */
const subscribers = new Map<string, Set<NotificationSubscriber>>();

/**
 * Subscribe to voice workflow notifications for a user.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  callback: NotificationSubscriber
): () => void {
  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }
  subscribers.get(userId)?.add(callback);

  logger.debug("voice_notification_subscribed", { userId });

  return () => {
    subscribers.get(userId)?.delete(callback);
    if (subscribers.get(userId)?.size === 0) {
      subscribers.delete(userId);
    }
    logger.debug("voice_notification_unsubscribed", { userId });
  };
}

/**
 * Notify a user of workflow completion.
 */
export async function notifyCompletion(
  userId: string,
  runId: string,
  plan: StructuredPlan,
  success: boolean,
  durationMs: number
): Promise<void> {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers || userSubscribers.size === 0) {
    logger.debug("voice_notification_no_subscribers", { userId, runId });
    return;
  }

  const prefs = await getVoiceWorkflowPreferences(userId);

  // Skip notification if silent
  if (prefs.notifications === "silent") {
    return;
  }

  const message = planCompletionSummary(plan, success, durationMs);

  const event: VoiceWorkflowNotificationEvent = {
    type: "completion",
    runId,
    success,
    message,
    notificationMode: prefs.notifications,
  };

  // Synthesize TTS if voice mode
  if (prefs.notifications === "voice") {
    try {
      const audio = await synthesizeNotification(message);
      if (audio) {
        event.audioBase64 = audio.audioBase64;
        event.mimeType = audio.mimeType;
      }
    } catch (error) {
      logger.warn("voice_notification_tts_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Emit to all subscribers
  for (const callback of userSubscribers) {
    try {
      callback(event);
    } catch (error) {
      logger.error("voice_notification_callback_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Notify a user of workflow progress.
 */
export async function notifyProgress(
  userId: string,
  runId: string,
  plan: StructuredPlan,
  completedTasks: number,
  totalTasks: number
): Promise<void> {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers || userSubscribers.size === 0) {
    return;
  }

  const prefs = await getVoiceWorkflowPreferences(userId);

  // Check if we should notify based on update preference
  const percentage = Math.round((completedTasks / totalTasks) * 100);
  if (
    !shouldNotifyProgress(prefs.updates, percentage, completedTasks, totalTasks)
  ) {
    return;
  }

  // Skip if silent
  if (prefs.notifications === "silent") {
    return;
  }

  const message = planStatusSummary(plan, completedTasks, totalTasks);

  const event: VoiceWorkflowNotificationEvent = {
    type: "progress",
    runId,
    completedTasks,
    totalTasks,
    percentage,
    message,
    notificationMode: prefs.notifications,
  };

  // Synthesize TTS if voice mode
  if (prefs.notifications === "voice") {
    try {
      const audio = await synthesizeNotification(message);
      if (audio) {
        event.audioBase64 = audio.audioBase64;
        event.mimeType = audio.mimeType;
      }
    } catch (error) {
      logger.warn("voice_notification_tts_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Emit to all subscribers
  for (const callback of userSubscribers) {
    try {
      callback(event);
    } catch (error) {
      logger.error("voice_notification_callback_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Notify a user of phase completion.
 */
export async function notifyPhaseComplete(
  userId: string,
  runId: string,
  phaseName: string,
  phaseIndex: number,
  totalPhases: number
): Promise<void> {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers || userSubscribers.size === 0) {
    return;
  }

  const prefs = await getVoiceWorkflowPreferences(userId);

  // Only notify if phase updates are enabled
  if (prefs.updates !== "phase" && prefs.updates !== "continuous") {
    return;
  }

  // Skip if silent
  if (prefs.notifications === "silent") {
    return;
  }

  const message = `Phase ${phaseIndex + 1} of ${totalPhases} complete: ${phaseName}.`;

  const event: VoiceWorkflowNotificationEvent = {
    type: "phase_complete",
    runId,
    phaseName,
    phaseIndex,
    totalPhases,
    message,
    notificationMode: prefs.notifications,
  };

  // Synthesize TTS if voice mode
  if (prefs.notifications === "voice") {
    try {
      const audio = await synthesizeNotification(message);
      if (audio) {
        event.audioBase64 = audio.audioBase64;
        event.mimeType = audio.mimeType;
      }
    } catch (error) {
      logger.warn("voice_notification_tts_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Emit to all subscribers
  for (const callback of userSubscribers) {
    try {
      callback(event);
    } catch (error) {
      logger.error("voice_notification_callback_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Determine if progress notification should be sent based on update preference.
 */
function shouldNotifyProgress(
  updatePref: VoiceWorkflowUpdates,
  percentage: number,
  _completedTasks: number,
  _totalTasks: number
): boolean {
  switch (updatePref) {
    case "request":
      // Never proactively notify
      return false;

    case "25percent":
      // Notify at 25%, 50%, 75% milestones
      return percentage === 25 || percentage === 50 || percentage === 75;

    case "phase":
      // Phase notifications handled separately
      return false;

    case "continuous":
      // Notify on every task (but not too frequently)
      return true;

    default:
      return false;
  }
}

/**
 * Synthesize TTS for notification message.
 * Returns null if TTS is not available.
 */
async function synthesizeNotification(
  message: string
): Promise<{ audioBase64: string; mimeType: string } | null> {
  try {
    const { synthesizeLocal } = await import("@alfred/voice/services/tts");
    const { ttsPool } = getVoicePools();
    const result = await synthesizeLocal(ttsPool, {
      text: message,
      voice: "en_US-lessac-medium", // Default notification voice
      format: "mp3",
      model: "piper",
    });
    return {
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
    };
  } catch {
    // TTS not available, return null
    return null;
  }
}

/**
 * Get count of active subscribers for a user.
 */
export function getSubscriberCount(userId: string): number {
  return subscribers.get(userId)?.size ?? 0;
}

/**
 * Clear all subscribers (for testing).
 */
export function clearAllSubscribers(): void {
  subscribers.clear();
}
