/**
 * CarPlay Offline Command Queue
 *
 * Queues CarPlay actions when offline and processes them on reconnect.
 * Uses the existing sync queue infrastructure.
 */

import type { OfflineCommand } from "../types";

import {
  enqueue,
  getPendingItems,
  markAttempted,
  markCompleted,
} from "../../sync/queue";
import { getClient } from "../api";
import { useCarPlayStore } from "../store";

const CARPLAY_TABLE = "carplay_commands";

/**
 * Queue an offline command for later processing.
 */
export async function queueCommand(command: OfflineCommand): Promise<string> {
  const id = `${command.type}-${Date.now()}`;

  await enqueue(CARPLAY_TABLE, id, "create", command);

  // Add to local store for UI
  useCarPlayStore.getState().addOfflineCommand(command);

  return id;
}

/**
 * Process pending CarPlay commands when back online.
 */
export async function processPendingCommands(): Promise<{
  processed: number;
  failed: number;
}> {
  const items = await getPendingItems(50);
  const carplayItems = items.filter((item) => item.tableName === CARPLAY_TABLE);

  let processed = 0;
  let failed = 0;

  for (const item of carplayItems) {
    try {
      const command = item.payload as OfflineCommand;
      await executeCommand(command);
      await markCompleted(item.id);

      // Remove from local store
      useCarPlayStore.getState().removeOfflineCommand(command.id);
      processed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await markAttempted(item.id, message);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Execute a queued command against the API.
 *
 * NOTE: The actual API endpoints may not exist yet.
 * This function provides the structure for when they're implemented.
 */
async function executeCommand(command: OfflineCommand): Promise<void> {
  const client = getClient();
  if (!client) {
    throw new Error("tRPC client not initialized");
  }

  // TODO: Wire to actual tRPC endpoints when available
  // The router methods below are placeholders for the expected API:
  // - workflow.resolveEscalation
  // - github.reviewPR
  // - plan.approvePlan / plan.rejectPlan
  // - workflow.pauseWorkflow / resumeWorkflow / cancelWorkflow

  switch (command.type) {
    case "escalation_decision":
      break;

    case "pr_decision":
      break;

    case "plan_decision":
      break;

    case "workflow_action":
      break;

    default:
      throw new Error(
        `Unknown command type: ${(command as OfflineCommand).type}`
      );
  }
}

/**
 * Get count of pending CarPlay commands.
 */
export async function getPendingCommandCount(): Promise<number> {
  const items = await getPendingItems(100);
  return items.filter((item) => item.tableName === CARPLAY_TABLE).length;
}

/**
 * Clear all pending CarPlay commands.
 */
export async function clearPendingCommands(): Promise<void> {
  const items = await getPendingItems(100);
  const carplayItems = items.filter((item) => item.tableName === CARPLAY_TABLE);

  for (const item of carplayItems) {
    await markCompleted(item.id);
  }

  useCarPlayStore.getState().clearOfflineCommands();
}
