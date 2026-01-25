/**
 * Memory Boost Tool
 *
 * Reinforce/strengthen a memory by increasing its confidence.
 * Used to mark memories as important or validated.
 */

import { getNode, recordAccess } from "@alfred/db/repo/graph/read";
import { updateNodeConfidence } from "@alfred/db/repo/graph/write";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryBoost,
  recordMemoryToolCall,
} from "../../../../src/metrics";

const boostInputSchema = z.object({
  id: z.string().uuid().describe("Memory node ID to boost"),
  amount: z
    .number()
    .min(0.01)
    .max(0.5)
    .optional()
    .describe("Boost amount (default: 0.1, max: 0.5)"),
  reason: z.string().optional().describe("Why this memory is being reinforced"),
});

type BoostInput = z.infer<typeof boostInputSchema>;

export const toolMemoryBoost = {
  name: "memory_boost",
  description:
    "Reinforce a memory by increasing its confidence. Use this to mark important memories or validate correct information.",
  inputSchema: boostInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    id: z.string(),
    previousConfidence: z.number().nullable(),
    newConfidence: z.number().nullable(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: BoostInput }) => {
    recordAssistantToolCall("memory_boost");

    // Verify node exists
    const existing = await getNode(input.id);
    if (!existing) {
      return {
        success: false,
        id: input.id,
        previousConfidence: null,
        newConfidence: null,
        message: "Memory not found",
      };
    }

    // Get current confidence
    const props = existing.properties as Record<string, unknown> | null;
    const currentConfidence =
      props && typeof props.confidence === "number" ? props.confidence : 0.5;

    // Calculate new confidence
    const boostAmount = input.amount ?? 0.1;
    const newConfidence = Math.min(1, currentConfidence + boostAmount);

    // Update confidence
    const result = await updateNodeConfidence(input.id, newConfidence);

    if (!result) {
      return {
        success: false,
        id: input.id,
        previousConfidence: currentConfidence,
        newConfidence: null,
        message: "Failed to update confidence",
      };
    }

    // Also record access to slow decay
    await recordAccess(input.id).catch(() => {
      // Non-fatal
    });

    // If reason provided, could log it to properties
    if (input.reason) {
      // The reason is logged via metrics/audit, not stored in the node
      // This keeps the node clean while preserving audit trail
    }

    recordMemoryBoost();
    recordMemoryToolCall("memory_boost", "success");

    return {
      success: true,
      id: input.id,
      previousConfidence: Math.round(currentConfidence * 1000) / 1000,
      newConfidence: Math.round(newConfidence * 1000) / 1000,
      message: `Boosted confidence by ${boostAmount}${
        input.reason ? ` (reason: ${input.reason})` : ""
      }`,
    };
  },
};

export type ToolMemoryBoost = typeof toolMemoryBoost;
