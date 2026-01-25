/**
 * Memory Retrieve Tool
 *
 * Get a specific memory node by ID with full details.
 * Optionally includes connected nodes (neighbors) for context.
 */

import {
  getNeighbors,
  getNode,
  recordAccess,
} from "@alfred/db/repo/graph/read";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryToolCall,
} from "../../../../src/metrics";

const retrieveInputSchema = z.object({
  id: z.string().uuid().describe("Memory node ID to retrieve"),
  includeNeighbors: z
    .boolean()
    .optional()
    .describe("Include connected nodes (default: false)"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe("Neighbor depth (default: 1, max: 3)"),
});

type RetrieveInput = z.infer<typeof retrieveInputSchema>;

interface NeighborInfo {
  id: string;
  label: string;
  kind: string;
  edgeKind: string;
  direction: "outbound" | "inbound";
}

interface MemoryNode {
  id: string;
  label: string;
  kind: string;
  resource: string;
  properties: Record<string, unknown> | null;
  confidence: number | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const toolMemoryRetrieve = {
  name: "memory_retrieve",
  description:
    "Retrieve a specific memory by ID with full details. Optionally include connected memories for context.",
  inputSchema: retrieveInputSchema,
  outputSchema: z.object({
    found: z.boolean(),
    memory: z
      .object({
        id: z.string(),
        label: z.string(),
        kind: z.string(),
        resource: z.string(),
        properties: z.record(z.string(), z.unknown()).nullable(),
        confidence: z.number().nullable(),
        accessCount: z.number(),
        lastAccessedAt: z.string().nullable(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
      })
      .nullable(),
    neighbors: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          kind: z.string(),
          edgeKind: z.string(),
          direction: z.enum(["outbound", "inbound"]),
        })
      )
      .optional(),
  }),
  execute: async ({ input }: { input: RetrieveInput }) => {
    recordAssistantToolCall("memory_retrieve");

    // Get the node
    const node = await getNode(input.id);

    if (!node) {
      return {
        found: false,
        memory: null,
      };
    }

    // Record access for adaptive decay
    await recordAccess(input.id).catch(() => {
      // Non-fatal: don't fail retrieval if access tracking fails
    });

    // Extract properties
    const props = node.properties as Record<string, unknown> | null;
    const confidence =
      props && typeof props.confidence === "number" ? props.confidence : null;

    const memory: MemoryNode = {
      id: node.id,
      label: node.label,
      kind: node.kind,
      resource: node.resource,
      properties: props,
      confidence,
      accessCount: node.accessCount ?? 0,
      lastAccessedAt: node.lastAccessedAt?.toISOString() ?? null,
      createdAt: node.created?.toISOString() ?? null,
      updatedAt: node.updated?.toISOString() ?? null,
    };

    // Get neighbors if requested
    let neighbors: NeighborInfo[] | undefined;

    if (input.includeNeighbors) {
      const depth = input.depth ?? 1;
      const neighborResults = await getNeighbors(input.id, {
        direction: "both",
        limit: 50,
      });

      neighbors = [];

      for (const { edge, otherNodeId } of neighborResults) {
        // Get the neighbor node for its label and kind
        const neighborNode = await getNode(otherNodeId);
        if (!neighborNode) {
          continue;
        }

        neighbors.push({
          id: otherNodeId,
          label: neighborNode.label,
          kind: neighborNode.kind,
          edgeKind: edge.kind,
          direction: edge.fromId === input.id ? "outbound" : "inbound",
        });
      }

      // If depth > 1, recursively get more neighbors (limited to keep response size manageable)
      if (depth > 1 && neighbors.length > 0) {
        const level2Neighbors: NeighborInfo[] = [];
        const seenIds = new Set([input.id, ...neighbors.map((n) => n.id)]);

        for (const neighbor of neighbors.slice(0, 10)) {
          // Limit breadth
          const level2Results = await getNeighbors(neighbor.id, {
            direction: "both",
            limit: 10,
          });

          for (const { edge, otherNodeId } of level2Results) {
            if (seenIds.has(otherNodeId)) {
              continue;
            }
            seenIds.add(otherNodeId);

            const neighborNode = await getNode(otherNodeId);
            if (!neighborNode) {
              continue;
            }

            level2Neighbors.push({
              id: otherNodeId,
              label: neighborNode.label,
              kind: neighborNode.kind,
              edgeKind: edge.kind,
              direction: edge.fromId === neighbor.id ? "outbound" : "inbound",
            });
          }
        }

        neighbors = [...neighbors, ...level2Neighbors];
      }
    }

    recordMemoryToolCall("memory_retrieve", "success");

    return {
      found: true,
      memory,
      neighbors,
    };
  },
};

export type ToolMemoryRetrieve = typeof toolMemoryRetrieve;
