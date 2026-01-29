/**
 * Memory Update Tool
 *
 * Update a memory's confidence, properties, or label.
 * Enables the agent to correct or enhance memory metadata.
 */

import type { MemoryUpdateEvent } from "@alfred/type";
import type { ToolCallOptions } from "ai";

import { getNode } from "@alfred/db/repo/graph/read";
import { updateNode, updateNodeConfidence } from "@alfred/db/repo/graph/write";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryToolCall,
} from "../../../../src/metrics";
import { getHooksRuntime } from "./hook";

const updateInputSchema = z.object({
  id: z.string().uuid().describe("Memory node ID to update"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("New confidence value (0-1)"),
  properties: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Properties to merge with existing"),
  label: z.string().min(1).optional().describe("New label for the memory"),
});

type UpdateInput = z.infer<typeof updateInputSchema>;

export const toolMemoryUpdate = {
  name: "memory_update",
  description:
    "Update a memory's confidence, properties, or label. Use this to correct or enhance memory metadata.",
  inputSchema: updateInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    changes: z.object({
      confidence: z.boolean().optional(),
      properties: z.boolean().optional(),
      label: z.boolean().optional(),
    }),
    message: z.string(),
  }),
  execute: async (
    { input }: { input: UpdateInput },
    options?: ToolCallOptions
  ) => {
    recordAssistantToolCall("memory_update");

    const hooks = getHooksRuntime(options);
    let { id } = input;
    let { confidence } = input;
    let { properties } = input;
    let { label } = input;

    if (hooks) {
      const hookEvent: MemoryUpdateEvent = {
        type: "memory:update",
        memoryId: id,
        changes: {
          ...(confidence !== undefined ? { confidence } : {}),
          ...(properties !== undefined ? { properties } : {}),
          ...(label !== undefined ? { label } : {}),
        },
      };

      const out = await hooks.registry.emit(hookEvent, hooks.ctx);
      if (out.decision === "deny" || out.decision === "ask") {
        throw new Error(out.reason ?? "hook_denied");
      }

      const next = (out.transformed ?? hookEvent) as MemoryUpdateEvent;
      id = next.memoryId;
      ({ confidence } = next.changes);
      ({ properties } = next.changes);
      ({ label } = next.changes);
    }

    // Verify node exists
    const existing = await getNode(id);
    if (!existing) {
      return {
        success: false,
        id,
        changes: {},
        message: "Memory not found",
      };
    }

    const changes: {
      confidence?: boolean;
      properties?: boolean;
      label?: boolean;
    } = {};

    // Update confidence if provided
    if (confidence !== undefined) {
      const result = await updateNodeConfidence(id, confidence);
      changes.confidence = result !== null;
    }

    // Build updates object for other fields
    const updates: Parameters<typeof updateNode>[1] = {};

    if (label !== undefined) {
      updates.label = label;
      changes.label = true;
    }

    if (properties !== undefined) {
      // Merge with existing properties
      const existingProps =
        (existing.properties as Record<string, unknown>) ?? {};
      updates.properties = {
        ...existingProps,
        ...properties,
        // Preserve system fields
        ...(existingProps.confidence !== undefined && confidence === undefined
          ? { confidence: existingProps.confidence }
          : {}),
      };
      changes.properties = true;
    }

    // Apply other updates if any
    if (Object.keys(updates).length > 0) {
      const result = await updateNode(id, updates);
      if (!result) {
        return {
          success: false,
          id,
          changes,
          message: "Failed to apply updates",
        };
      }
    }

    const changedFields = Object.keys(changes).filter(
      (k) => changes[k as keyof typeof changes]
    );

    recordMemoryToolCall("memory_update", "success");

    return {
      success: true,
      id,
      changes,
      message:
        changedFields.length > 0
          ? `Updated: ${changedFields.join(", ")}`
          : "No changes applied",
    };
  },
};

export type ToolMemoryUpdate = typeof toolMemoryUpdate;
