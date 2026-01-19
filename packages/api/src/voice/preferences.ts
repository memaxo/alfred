/**
 * Voice workflow preference types and loader.
 *
 * Centralizes all voice workflow settings for consistent access
 * across the voice pipeline.
 */

import * as userRepo from "@alfred/db/repo/user";
import { logger } from "@alfred/logger";

/**
 * Preference keys for voice workflow settings.
 */
export const VOICE_WORKFLOW_KEYS = {
  enabled: "domain.voice.workflow_enabled",
  verbosity: "domain.voice.workflow_verbosity",
  autoApprove: "domain.voice.workflow_auto_approve",
  notifications: "domain.voice.workflow_notifications",
  updates: "domain.voice.workflow_updates",
  timeout: "domain.voice.workflow_timeout",
  learning: "domain.voice.workflow_learning",
} as const;

/**
 * Plan summary verbosity levels.
 * - brief: Phase count + task count only
 * - standard: Phase names + task counts (default)
 * - detailed: Phase descriptions + duration estimates
 */
export type VoiceWorkflowVerbosity = "brief" | "standard" | "detailed";

/**
 * Auto-approval threshold.
 * - off: Always require manual approval
 * - small: Auto-approve single-phase plans with ≤3 tasks
 * - medium: Auto-approve ≤2 phases with ≤6 tasks
 * - all: Auto-approve all plans
 */
export type VoiceWorkflowAutoApprove = "off" | "small" | "medium" | "all";

/**
 * Completion notification type.
 * - voice: Synthesize TTS announcement
 * - sound: Play notification sound only
 * - silent: No notification
 */
export type VoiceWorkflowNotifications = "voice" | "silent" | "sound";

/**
 * Proactive status update frequency.
 * - request: Only when user asks
 * - 25percent: At 25%, 50%, 75% completion
 * - phase: After each phase completes
 * - continuous: After each task
 */
export type VoiceWorkflowUpdates =
  | "request"
  | "25percent"
  | "phase"
  | "continuous";

/**
 * All voice workflow preferences.
 */
export type VoiceWorkflowPreferences = {
  /** Whether voice workflow is enabled */
  enabled: boolean;
  /** Plan summary verbosity */
  verbosity: VoiceWorkflowVerbosity;
  /** Auto-approval threshold */
  autoApprove: VoiceWorkflowAutoApprove;
  /** Completion notification type */
  notifications: VoiceWorkflowNotifications;
  /** Proactive status update frequency */
  updates: VoiceWorkflowUpdates;
  /** Approval timeout in minutes (0 = no timeout) */
  timeout: number;
  /** Whether to learn patterns from successful workflows */
  learning: boolean;
};

/**
 * Default preference values.
 */
export const VOICE_WORKFLOW_DEFAULTS: VoiceWorkflowPreferences = {
  enabled: true,
  verbosity: "standard",
  autoApprove: "off",
  notifications: "voice",
  updates: "request",
  timeout: 5,
  learning: true,
};

/**
 * Load voice workflow preferences for a user.
 * Returns defaults for any unset preferences.
 */
export async function getVoiceWorkflowPreferences(
  userId: string
): Promise<VoiceWorkflowPreferences> {
  try {
    const preferences = (await userRepo.getPreferences(
      userId
    )) as unknown as Array<{ key: string; value: unknown }>;

    const getValue = <T>(key: string, defaultValue: T): T => {
      const entry = preferences.find((pref) => pref.key === key);
      if (!entry) {
        return defaultValue;
      }
      return entry.value as T;
    };

    return {
      enabled: parseBoolean(
        getValue(VOICE_WORKFLOW_KEYS.enabled, VOICE_WORKFLOW_DEFAULTS.enabled)
      ),
      verbosity: parseVerbosity(
        getValue(
          VOICE_WORKFLOW_KEYS.verbosity,
          VOICE_WORKFLOW_DEFAULTS.verbosity
        )
      ),
      autoApprove: parseAutoApprove(
        getValue(
          VOICE_WORKFLOW_KEYS.autoApprove,
          VOICE_WORKFLOW_DEFAULTS.autoApprove
        )
      ),
      notifications: parseNotifications(
        getValue(
          VOICE_WORKFLOW_KEYS.notifications,
          VOICE_WORKFLOW_DEFAULTS.notifications
        )
      ),
      updates: parseUpdates(
        getValue(VOICE_WORKFLOW_KEYS.updates, VOICE_WORKFLOW_DEFAULTS.updates)
      ),
      timeout: parseNumber(
        getValue(VOICE_WORKFLOW_KEYS.timeout, VOICE_WORKFLOW_DEFAULTS.timeout),
        VOICE_WORKFLOW_DEFAULTS.timeout
      ),
      learning: parseBoolean(
        getValue(VOICE_WORKFLOW_KEYS.learning, VOICE_WORKFLOW_DEFAULTS.learning)
      ),
    };
  } catch (error) {
    logger.warn("voice_preferences_load_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return VOICE_WORKFLOW_DEFAULTS;
  }
}

/**
 * Parse a boolean value from various formats.
 */
function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return true; // Default to true
}

/**
 * Parse and validate verbosity level.
 */
function parseVerbosity(value: unknown): VoiceWorkflowVerbosity {
  const valid: VoiceWorkflowVerbosity[] = ["brief", "standard", "detailed"];
  if (
    typeof value === "string" &&
    valid.includes(value as VoiceWorkflowVerbosity)
  ) {
    return value as VoiceWorkflowVerbosity;
  }
  return VOICE_WORKFLOW_DEFAULTS.verbosity;
}

/**
 * Parse and validate auto-approve setting.
 */
function parseAutoApprove(value: unknown): VoiceWorkflowAutoApprove {
  const valid: VoiceWorkflowAutoApprove[] = ["off", "small", "medium", "all"];
  if (
    typeof value === "string" &&
    valid.includes(value as VoiceWorkflowAutoApprove)
  ) {
    return value as VoiceWorkflowAutoApprove;
  }
  return VOICE_WORKFLOW_DEFAULTS.autoApprove;
}

/**
 * Parse and validate notifications setting.
 */
function parseNotifications(value: unknown): VoiceWorkflowNotifications {
  const valid: VoiceWorkflowNotifications[] = ["voice", "silent", "sound"];
  if (
    typeof value === "string" &&
    valid.includes(value as VoiceWorkflowNotifications)
  ) {
    return value as VoiceWorkflowNotifications;
  }
  return VOICE_WORKFLOW_DEFAULTS.notifications;
}

/**
 * Parse and validate updates setting.
 */
function parseUpdates(value: unknown): VoiceWorkflowUpdates {
  const valid: VoiceWorkflowUpdates[] = [
    "request",
    "25percent",
    "phase",
    "continuous",
  ];
  if (
    typeof value === "string" &&
    valid.includes(value as VoiceWorkflowUpdates)
  ) {
    return value as VoiceWorkflowUpdates;
  }
  return VOICE_WORKFLOW_DEFAULTS.updates;
}

/**
 * Parse a number with bounds checking.
 */
function parseNumber(value: unknown, defaultValue: number): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, Math.min(60, value)); // Clamp to 0-60 minutes
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.min(60, parsed));
    }
  }
  return defaultValue;
}
