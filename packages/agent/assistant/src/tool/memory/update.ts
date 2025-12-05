/**
 * Memory Update Tool
 *
 * Update a memory's confidence, properties, or label.
 * Enables the agent to correct or enhance memory metadata.
 */

import { getNode } from "@alfred/db/repo/graph/read";
import { updateNode, updateNodeConfidence } from "@alfred/db/repo/graph/write";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryToolCall,
} from "../../../../src/metrics";

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
  execute: async ({ input }: { input: UpdateInput }) => {
    recordAssistantToolCall("memory_update");

    // Verify node exists
    const existing = await getNode(input.id);
    if (!existing) {
      return {
        success: false,
        id: input.id,
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
    if (input.confidence !== undefined) {
      const result = await updateNodeConfidence(input.id, input.confidence);
      changes.confidence = result !== null;
    }

    // Build updates object for other fields
    const updates: Parameters<typeof updateNode>[1] = {};

    if (input.label !== undefined) {
      updates.label = input.label;
      changes.label = true;
    }

    if (input.properties !== undefined) {
      // Merge with existing properties
      const existingProps =
        (existing.properties as Record<string, unknown>) ?? {};
      updates.properties = {
        ...existingProps,
        ...input.properties,
        // Preserve system fields
        ...(existingProps.confidence !== undefined &&
        input.confidence === undefined
          ? { confidence: existingProps.confidence }
          : {}),
      };
      changes.properties = true;
    }

    // Apply other updates if any
    if (Object.keys(updates).length > 0) {
      const result = await updateNode(input.id, updates);
      if (!result) {
        return {
          success: false,
          id: input.id,
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
      id: input.id,
      changes,
      message:
        changedFields.length > 0
          ? `Updated: ${changedFields.join(", ")}`
          : "No changes applied",
    };
  },
};

export type ToolMemoryUpdate = typeof toolMemoryUpdate;
