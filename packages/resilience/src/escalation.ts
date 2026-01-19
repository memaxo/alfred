/**
 * Escalation Detection and Handling
 *
 * Detects stuck workflows and provides recovery mechanisms.
 */

import type { StuckDetectionConfig } from "@alfred/agent/orchestrator/multi/tracker";

// Re-export the unified StuckDetectionConfig from agent/tracker
export type { StuckDetectionConfig };

/**
 * Escalation reasons.
 */
export const ESCALATION_REASONS = {
  STUCK_LOOP: "stuck_in_escalation_loop",
  TIMEOUT: "workflow_timeout",
  MAX_TRANSITIONS: "exceeded_max_transitions",
  REPEATED_ERROR: "repeated_error_without_progress",
  RESOURCE_EXHAUSTED: "resource_exhausted",
} as const;

export type EscalationReason =
  (typeof ESCALATION_REASONS)[keyof typeof ESCALATION_REASONS];

/**
 * Escalation event data.
 */
export type EscalationEvent = {
  reason: EscalationReason;
  context: {
    runId: string;
    attemptCount?: number;
    lastError?: string;
    transitionCount?: number;
    elapsedMs?: number;
  };
  timestamp: Date;
};

/**
 * Escalation handler function.
 */
export type EscalationHandler = (
  event: EscalationEvent
) => void | Promise<void>;

/**
 * Escalation detector for workflows.
 */
export class EscalationDetector {
  private readonly handlers: EscalationHandler[] = [];
  private readonly escalations = new Map<string, EscalationEvent[]>();

  /**
   * Register an escalation handler.
   *
   * @param handler - Function to call on escalation
   */
  onEscalation(handler: EscalationHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Trigger an escalation event.
   *
   * @param event - Escalation event to emit
   */
  async escalate(event: EscalationEvent): Promise<void> {
    const runId = event.context.runId;
    const history = this.escalations.get(runId) ?? [];
    history.push(event);
    this.escalations.set(runId, history);

    // Call all handlers
    await Promise.all(this.handlers.map((h) => h(event)));
  }

  /**
   * Get escalation history for a run.
   *
   * @param runId - Workflow run ID
   * @returns Array of escalation events
   */
  getHistory(runId: string): EscalationEvent[] {
    return this.escalations.get(runId) ?? [];
  }

  /**
   * Clear escalation history for a run.
   *
   * @param runId - Workflow run ID
   */
  clearHistory(runId: string): void {
    this.escalations.delete(runId);
  }

  /**
   * Check if run has been escalated.
   *
   * @param runId - Workflow run ID
   * @returns True if run has any escalations
   */
  hasEscalated(runId: string): boolean {
    return (this.escalations.get(runId)?.length ?? 0) > 0;
  }

  /**
   * Count escalations for a specific reason.
   *
   * @param runId - Workflow run ID
   * @param reason - Escalation reason to count
   * @returns Number of escalations for this reason
   */
  countByReason(runId: string, reason: EscalationReason): number {
    return (
      this.escalations.get(runId)?.filter((e) => e.reason === reason).length ??
      0
    );
  }
}

/**
 * Detect if workflow is stuck based on various signals.
 *
 * @param config - Detection configuration (uses unified StuckDetectionConfig from @alfred/agent)
 * @param context - Current workflow context
 * @returns Escalation reason if stuck, null otherwise
 */
export function detectStuck(
  config: Required<
    Pick<
      StuckDetectionConfig,
      "maxTransitions" | "maxTimeMs" | "maxRepeatedErrors"
    >
  >,
  context: {
    transitionCount: number;
    elapsedMs: number;
    errorCount: number;
  }
): EscalationReason | null {
  if (context.transitionCount > config.maxTransitions) {
    return ESCALATION_REASONS.MAX_TRANSITIONS;
  }

  if (context.elapsedMs > config.maxTimeMs) {
    return ESCALATION_REASONS.TIMEOUT;
  }

  if (context.errorCount > config.maxRepeatedErrors) {
    return ESCALATION_REASONS.REPEATED_ERROR;
  }

  return null;
}

/**
 * Default escalation detector instance.
 */
export const defaultEscalationDetector = new EscalationDetector();
