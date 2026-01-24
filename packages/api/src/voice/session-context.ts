/**
 * Voice workflow context storage.
 *
 * Extends the voice session registry with workflow-specific context
 * for tracking multi-turn voice workflow interactions.
 */

import { getRedis } from "@alfred/auth/redis";
import * as planRepo from "@alfred/db/repo/plan";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";

import {
  deserializeWorkflowContext,
  isApprovalExpired,
  serializeWorkflowContext,
  type VoiceWorkflowContext,
} from "./workflow-state.js";

const WORKFLOW_CONTEXT_TTL_SECONDS = 3600; // 1 hour

// Redis key for workflow context
const keyWorkflowContext = (userId: string) => `voice:workflow:${userId}`;

// In-memory fallback
const memWorkflowContexts = new Map<string, VoiceWorkflowContext>();

/**
 * Set voice workflow context for a user.
 *
 * Stores the workflow state to enable multi-turn voice interactions
 * for plan approval and status queries.
 */
export async function setVoiceWorkflowContext(
  userId: string,
  context: VoiceWorkflowContext
): Promise<void> {
  const redis = getRedis();
  const serialized = serializeWorkflowContext(context);

  if (redis) {
    await redis.set(
      keyWorkflowContext(userId),
      serialized,
      "EX",
      WORKFLOW_CONTEXT_TTL_SECONDS
    );
    logger.debug("voice_workflow_context_set", {
      userId,
      phase: context.state.phase,
    });
    return;
  }

  // In-memory fallback
  memWorkflowContexts.set(userId, context);
  logger.debug("voice_workflow_context_set_mem", {
    userId,
    phase: context.state.phase,
  });
}

/**
 * Get voice workflow context for a user.
 *
 * Returns undefined if no active workflow context exists.
 */
export async function getVoiceWorkflowContext(
  userId: string
): Promise<VoiceWorkflowContext | undefined> {
  const redis = getRedis();

  if (redis) {
    const json = await redis.get(keyWorkflowContext(userId));
    if (!json) {
      return;
    }

    const context = deserializeWorkflowContext(json);
    if (!context) {
      logger.warn("voice_workflow_context_parse_failed", { userId });
      return;
    }

    return context;
  }

  // In-memory fallback
  return memWorkflowContexts.get(userId);
}

/**
 * Clear voice workflow context for a user.
 *
 * Called when a workflow completes, is rejected, or expires.
 */
export async function clearVoiceWorkflowContext(userId: string): Promise<void> {
  const redis = getRedis();

  if (redis) {
    await redis.del(keyWorkflowContext(userId));
    logger.debug("voice_workflow_context_cleared", { userId });
    return;
  }

  // In-memory fallback
  memWorkflowContexts.delete(userId);
  logger.debug("voice_workflow_context_cleared_mem", { userId });
}

/**
 * Update voice workflow context for a user.
 *
 * Convenience function that reads, patches, and writes the context.
 */
export async function updateVoiceWorkflowContext(
  userId: string,
  patch: Partial<VoiceWorkflowContext>
): Promise<VoiceWorkflowContext | undefined> {
  const existing = await getVoiceWorkflowContext(userId);
  if (!existing) {
    return;
  }

  const updated: VoiceWorkflowContext = {
    ...existing,
    ...patch,
    updatedAt: new Date(),
  };

  await setVoiceWorkflowContext(userId, updated);
  return updated;
}

/**
 * Check if a user has an active workflow context.
 */
export async function hasActiveWorkflowContext(
  userId: string
): Promise<boolean> {
  const context = await getVoiceWorkflowContext(userId);
  if (!context) {
    return false;
  }

  // Check if the workflow is in an active state
  const { phase } = context.state;
  return (
    phase === "planning" ||
    phase === "awaiting_approval" ||
    phase === "executing"
  );
}

/**
 * Get the current workflow phase for a user.
 *
 * Returns "idle" if no active workflow context exists.
 */
export async function getWorkflowPhase(
  userId: string
): Promise<
  "idle" | "planning" | "awaiting_approval" | "executing" | "completed"
> {
  const context = await getVoiceWorkflowContext(userId);
  return context?.state.phase ?? "idle";
}

/**
 * Check and handle expired approval timeouts.
 *
 * If the context has an expired approval deadline, auto-reject the plan
 * and clear the context.
 *
 * @returns true if the context was expired and handled
 */
export async function checkAndHandleExpiredApproval(
  userId: string
): Promise<boolean> {
  const context = await getVoiceWorkflowContext(userId);
  if (!context) {
    return false;
  }

  if (!isApprovalExpired(context)) {
    return false;
  }

  // Context has expired - auto-reject
  if (context.state.phase === "awaiting_approval") {
    const { runId, planId } = context.state;

    try {
      // Update plan status to rejected
      await planRepo.updatePlanStatus(planId, "rejected", userId);

      // Update workflow run status
      await workflowRepo.updateRun(runId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: "Approval timeout expired",
      });

      logger.info("voice_workflow_approval_expired", {
        userId,
        runId,
        planId,
      });
    } catch (error) {
      logger.error("voice_workflow_timeout_handling_failed", {
        userId,
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Clear the context
  await clearVoiceWorkflowContext(userId);
  return true;
}

/**
 * Get voice workflow context with automatic expiration check.
 *
 * If the context has expired, auto-rejects the plan and returns undefined.
 */
export async function getVoiceWorkflowContextWithExpiryCheck(
  userId: string
): Promise<VoiceWorkflowContext | undefined> {
  const context = await getVoiceWorkflowContext(userId);
  if (!context) {
    return;
  }

  // Check for expiration
  if (isApprovalExpired(context)) {
    await checkAndHandleExpiredApproval(userId);
    return;
  }

  return context;
}
