/**
 * Memory Remove Tool
 *
 * Soft-delete (archive) or permanently remove a memory.
 * Soft delete is preferred as it preserves history for audit.
 */

import type { MemoryForgetEvent } from "@alfred/type";
import type { ToolCallOptions } from "ai";

import { getNode } from "@alfred/db/repo/graph/read";
import { archiveNodes, deleteNode } from "@alfred/db/repo/graph/write";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryRemoval,
  recordMemoryToolCall,
} from "../../../../src/metrics";
import { getHooksRuntime } from "./hook";

const removeInputSchema = z.object({
  id: z.string().uuid().describe("Memory node ID to remove"),
  reason: z
    .string()
    .optional()
    .describe("Reason for removal (for audit trail)"),
  permanent: z
    .boolean()
    .optional()
    .describe("Hard delete instead of archive (default: false)"),
});

type RemoveInput = z.infer<typeof removeInputSchema>;

export const toolMemoryRemove = {
  name: "memory_remove",
  description:
    "Remove a memory. By default, memories are archived (soft delete) to preserve history. Use permanent=true for hard delete.",
  inputSchema: removeInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    action: z.enum(["archived", "deleted", "not_found"]),
    message: z.string(),
  }),
  execute: async (
    { input }: { input: RemoveInput },
    options?: ToolCallOptions
  ) => {
    recordAssistantToolCall("memory_remove");

    const hooks = getHooksRuntime(options);
    let { id } = input;
    let permanent = input.permanent ?? false;

    if (hooks) {
      const hookEvent: MemoryForgetEvent = {
        type: "memory:forget",
        memoryId: id,
        deleteType: permanent ? "hard" : "soft",
        ...(input.reason ? { reason: input.reason } : {}),
      };
      const out = await hooks.registry.emit(hookEvent, hooks.ctx);
      if (out.decision === "deny" || out.decision === "ask") {
        throw new Error(out.reason ?? "hook_denied");
      }

      const next = (out.transformed ?? hookEvent) as MemoryForgetEvent;
      id = next.memoryId;
      permanent = next.deleteType === "hard";
    }

    // Verify node exists
    const existing = await getNode(id);
    if (!existing) {
      return {
        success: false,
        id,
        action: "not_found" as const,
        message: "Memory not found",
      };
    }

    // Check if already archived
    const props = existing.properties as Record<string, unknown> | null;
    if (props?.archived) {
      if (permanent) {
        // Permanently delete an already archived node
        const count = await deleteNode(id);
        return {
          success: count > 0,
          id,
          action: "deleted" as const,
          message:
            count > 0
              ? "Permanently deleted archived memory"
              : "Failed to delete",
        };
      }
      return {
        success: false,
        id,
        action: "archived" as const,
        message: "Memory is already archived",
      };
    }

    if (permanent) {
      // Hard delete
      const count = await deleteNode(id);
      if (count > 0) {
        recordMemoryRemoval("deleted");
        recordMemoryToolCall("memory_remove", "success");
      }
      return {
        success: count > 0,
        id,
        action: "deleted" as const,
        message: count > 0 ? "Memory permanently deleted" : "Failed to delete",
      };
    }

    // Soft delete (archive)
    const reason = input.reason ?? "agent_requested";
    const count = await archiveNodes([id], reason);

    if (count > 0) {
      recordMemoryRemoval("archived");
      recordMemoryToolCall("memory_remove", "success");
    }

    return {
      success: count > 0,
      id,
      action: "archived" as const,
      message:
        count > 0
          ? `Memory archived with reason: ${reason}`
          : "Failed to archive",
    };
  },
};

export type ToolMemoryRemove = typeof toolMemoryRemove;
