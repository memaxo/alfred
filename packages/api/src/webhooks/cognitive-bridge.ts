/**
 * ALFRED Cognitive Event Bridge
 * Routes external events to the cognitive system
 */

import { getBudgetManager } from "@alfred/agent/budget";
import type { Event } from "@alfred/cognitive/state";
import { timestamp } from "@alfred/cognitive/util/math";
import * as queueRepo from "@alfred/db/repo/queue";
import { logger } from "@alfred/logger";
import { runCognitiveLoop } from "@alfred/runtime/loops/cognitive";
import type { RuntimeContext } from "@alfred/type/runtime-context";

// ============================================================================
// Types
// ============================================================================

export type CognitiveEventSource =
  | "reminder"
  | "linear_webhook"
  | "github_webhook"
  | "calendar"
  | "custom_webhook"
  | "physiology";

export interface IncomingTrigger {
  source: CognitiveEventSource;
  userId: string;
  payload: unknown;
  priority?: 1 | 2 | 3; // 1 = highest, 3 = lowest
}

export interface BridgeResult {
  action: "immediate" | "queued" | "dropped";
  taskId?: string;
  reason?: string;
}

// ============================================================================
// Priority Configuration
// ============================================================================

const IMMEDIATE_PRIORITY_THRESHOLD = 1; // Priority 1 = immediate processing
const DEFAULT_PRIORITY = 2;

// Token estimates by source for budget checking
const TOKEN_ESTIMATES: Record<CognitiveEventSource, number> = {
  reminder: 1000,
  linear_webhook: 2000,
  github_webhook: 2000,
  calendar: 500,
  custom_webhook: 1500,
  physiology: 500,
};

// ============================================================================
// Event Parsing
// ============================================================================

/**
 * Parse an incoming trigger into a cognitive Event
 */
function parseToEvent(trigger: IncomingTrigger): Event {
  const ts = timestamp(Date.now());

  switch (trigger.source) {
    case "reminder": {
      const payload = trigger.payload as {
        title?: string;
        description?: string;
      };
      return {
        _: "input",
        content: `Reminder: ${payload.title ?? "Scheduled reminder"}${
          payload.description ? ` - ${payload.description}` : ""
        }`,
        source: "system",
        ts,
      };
    }

    case "linear_webhook": {
      const payload = trigger.payload as {
        action?: string;
        issue?: { title?: string; identifier?: string };
      };
      return {
        _: "input",
        content: `Linear: ${payload.action ?? "update"} - ${
          payload.issue?.identifier ?? ""
        } ${payload.issue?.title ?? "Issue updated"}`,
        source: "system",
        ts,
      };
    }

    case "github_webhook": {
      const payload = trigger.payload as {
        action?: string;
        repository?: { full_name?: string };
        sender?: { login?: string };
      };
      return {
        _: "input",
        content: `GitHub: ${payload.action ?? "event"} on ${
          payload.repository?.full_name ?? "repository"
        } by ${payload.sender?.login ?? "user"}`,
        source: "system",
        ts,
      };
    }

    case "calendar": {
      const payload = trigger.payload as {
        eventType?: string;
        title?: string;
        startTime?: string;
      };
      return {
        _: "input",
        content: `Calendar: ${payload.eventType ?? "event"} - ${
          payload.title ?? "Calendar event"
        }${payload.startTime ? ` at ${payload.startTime}` : ""}`,
        source: "system",
        ts,
      };
    }

    case "physiology": {
      const payload = trigger.payload as {
        triggerType?: string;
        reason?: string;
      };
      return {
        _: "interrupt",
        reason: payload.reason ?? payload.triggerType ?? "physiology_trigger",
        priority: (trigger.priority ?? 2) as 1 | 2 | 3,
        ts,
      };
    }

    case "custom_webhook":
    default: {
      const payload = trigger.payload as { content?: string; type?: string };
      return {
        _: "input",
        content:
          payload.content ?? `Custom webhook: ${payload.type ?? "event"}`,
        source: "system",
        ts,
      };
    }
  }
}

// ============================================================================
// Bridge Functions
// ============================================================================

/**
 * Bridge an incoming trigger to the cognitive system
 *
 * High priority triggers are processed immediately via the cognitive loop.
 * Lower priority triggers are queued for idle-time processing.
 */
export async function bridgeToCognitive(
  trigger: IncomingTrigger,
  ctx?: RuntimeContext
): Promise<BridgeResult> {
  const priority = trigger.priority ?? DEFAULT_PRIORITY;
  const estimatedTokens = TOKEN_ESTIMATES[trigger.source];

  logger.debug("cognitive_bridge_trigger", {
    source: trigger.source,
    userId: trigger.userId,
    priority,
  });

  // Check budget
  const budgetManager = getBudgetManager(trigger.userId);
  const budgetCheck = await budgetManager.checkBudget(
    "background",
    "background:cognitive",
    estimatedTokens
  );

  if (!budgetCheck.allowed) {
    logger.info("cognitive_bridge_budget_exceeded", {
      userId: trigger.userId,
      source: trigger.source,
      reason: budgetCheck.reason,
    });

    // Queue for later if budget exceeded (unless it's a high priority interrupt)
    if (priority <= IMMEDIATE_PRIORITY_THRESHOLD) {
      // High priority - still try to process but log warning
      logger.warn("cognitive_bridge_budget_override", {
        userId: trigger.userId,
        source: trigger.source,
        reason: "high_priority_override",
      });
    } else {
      // Queue for later
      return queueForLater(trigger);
    }
  }

  // High priority = immediate processing
  if (priority <= IMMEDIATE_PRIORITY_THRESHOLD) {
    return processImmediate(trigger, ctx);
  }

  // Lower priority = queue for idle time
  return queueForLater(trigger);
}

/**
 * Process a trigger immediately via the cognitive loop
 */
async function processImmediate(
  trigger: IncomingTrigger,
  ctx?: RuntimeContext
): Promise<BridgeResult> {
  try {
    const event = parseToEvent(trigger);
    const streamId = `cognitive:${trigger.userId}`;

    // Create a minimal runtime context if not provided
    const runtimeCtx: RuntimeContext = ctx ?? {
      userId: trigger.userId,
    };

    // Run the cognitive loop
    const result = await runCognitiveLoop(runtimeCtx, streamId, event);

    logger.info("cognitive_bridge_immediate_processed", {
      userId: trigger.userId,
      source: trigger.source,
      newState: result.state._,
      effectsCount: result.effects.length,
    });

    return { action: "immediate" };
  } catch (error) {
    logger.error("cognitive_bridge_immediate_failed", {
      userId: trigger.userId,
      source: trigger.source,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fall back to queuing
    return queueForLater(trigger);
  }
}

/**
 * Queue a trigger for idle-time processing
 */
async function queueForLater(trigger: IncomingTrigger): Promise<BridgeResult> {
  try {
    const task = await queueRepo.addTask({
      userId: trigger.userId,
      type: "webhook",
      priority: 10 - (trigger.priority ?? DEFAULT_PRIORITY) * 3, // Convert 1-3 to 7-1 (higher = more urgent in queue)
      payload: {
        source: trigger.source,
        originalPayload: trigger.payload,
        originalPriority: trigger.priority,
      },
      source: trigger.source,
      estimatedTokens: TOKEN_ESTIMATES[trigger.source],
    });

    logger.info("cognitive_bridge_queued", {
      userId: trigger.userId,
      source: trigger.source,
      taskId: task.id,
    });

    return { action: "queued", taskId: task.id };
  } catch (error) {
    logger.error("cognitive_bridge_queue_failed", {
      userId: trigger.userId,
      source: trigger.source,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      action: "dropped",
      reason: error instanceof Error ? error.message : "queue_failed",
    };
  }
}

// ============================================================================
// Specialized Bridge Functions
// ============================================================================

/**
 * Bridge a reminder to the cognitive system
 */
export async function bridgeReminder(
  userId: string,
  reminder: {
    id: string;
    title: string;
    description?: string;
    intentType?: string;
    intentData?: unknown;
  }
): Promise<BridgeResult> {
  // If it's a workflow intent, use higher priority
  const priority = reminder.intentType === "workflow" ? 1 : 2;

  return bridgeToCognitive({
    source: "reminder",
    userId,
    payload: {
      reminderId: reminder.id,
      title: reminder.title,
      description: reminder.description,
      intentType: reminder.intentType,
      intentData: reminder.intentData,
    },
    priority,
  });
}

/**
 * Bridge a Linear webhook to the cognitive system
 */
export async function bridgeLinearWebhook(
  userId: string,
  payload: {
    action: string;
    type: string;
    data: unknown;
  }
): Promise<BridgeResult> {
  // Issue assignments are higher priority
  const priority =
    payload.type === "Issue" && payload.action === "create" ? 2 : 3;

  return bridgeToCognitive({
    source: "linear_webhook",
    userId,
    payload: {
      action: payload.action,
      type: payload.type,
      issue: payload.data,
    },
    priority,
  });
}

/**
 * Bridge a GitHub webhook to the cognitive system
 */
export async function bridgeGitHubWebhook(
  userId: string,
  event: string,
  payload: unknown
): Promise<BridgeResult> {
  // PRs and issue mentions are higher priority
  const highPriorityEvents = [
    "pull_request",
    "pull_request_review",
    "issue_comment",
  ];
  const priority = highPriorityEvents.includes(event) ? 2 : 3;

  return bridgeToCognitive({
    source: "github_webhook",
    userId,
    payload: {
      event,
      ...((payload as object) ?? {}),
    },
    priority,
  });
}

/**
 * Bridge a physiology trigger (from brainstem supervisor)
 */
export async function bridgePhysiologyTrigger(
  userId: string,
  triggerType: string,
  reason: string
): Promise<BridgeResult> {
  return bridgeToCognitive({
    source: "physiology",
    userId,
    payload: {
      triggerType,
      reason,
    },
    priority: 1, // Physiology triggers are always high priority
  });
}
