/**
 * Memory Traverse Tool
 *
 * Walk the knowledge graph from a starting point.
 * Supports both simple BFS and semantic DSA-BFS traversal.
 */

import type { NodeRow } from "@alfred/db/repo/graph/types";

import { type DsaBfsOptions, dsaBfs } from "@alfred/db/repo/graph/dsa-bfs";
import {
  getNeighbors,
  getNode,
  recordAccessBatch,
} from "@alfred/db/repo/graph/read";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryToolCall,
  recordMemoryTraverseDepth,
} from "../../../../src/metrics";
import { embedQuery } from "./embed";

const traverseInputSchema = z.object({
  startId: z.string().uuid().describe("Starting node ID for traversal"),
  query: z
    .string()
    .optional()
    .describe("Semantic query for DSA-BFS (prioritizes similar nodes)"),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .describe("Maximum traversal depth (default: 3)"),
  direction: z
    .enum(["out", "in", "both"])
    .optional()
    .describe("Edge direction to follow (default: both)"),
  kind: z.string().optional().describe("Filter edges by kind"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum nodes to return (default: 20)"),
});

type TraverseInput = z.infer<typeof traverseInputSchema>;

type TraversedNode = {
  id: string;
  label: string;
  kind: string;
  depth: number;
  path: string[];
  similarity?: number;
};

export const toolMemoryTraverse = {
  name: "memory_traverse",
  description:
    "Walk the knowledge graph from a starting point. Use a semantic query for DSA-BFS to prioritize relevant paths.",
  inputSchema: traverseInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    startNode: z
      .object({
        id: z.string(),
        label: z.string(),
        kind: z.string(),
      })
      .nullable(),
    nodes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.string(),
        depth: z.number(),
        path: z.array(z.string()),
        similarity: z.number().optional(),
      })
    ),
    count: z.number(),
    message: z.string(),
  }),
  execute: async ({ input }: { input: TraverseInput }) => {
    recordAssistantToolCall("memory_traverse");

    const maxDepth = input.maxDepth ?? 3;
    const direction = input.direction ?? "both";
    const limit = input.limit ?? 20;

    // Get start node
    const startNode = await getNode(input.startId);
    if (!startNode) {
      return {
        success: false,
        startNode: null,
        nodes: [],
        count: 0,
        message: "Start node not found",
      };
    }

    const traversedNodes: TraversedNode[] = [];

    if (input.query) {
      // Semantic traversal using DSA-BFS
      const queryEmbedding = await embedQuery(input.query);

      // Build neighbor fetcher
      const getNeighborNodes = async (nodeId: string) => {
        const neighbors = await getNeighbors(nodeId, {
          direction,
          kind: input.kind,
          limit: 50,
        });

        const nodes: NodeRow[] = [];
        for (const { otherNodeId } of neighbors) {
          const node = await getNode(otherNodeId);
          if (node) {
            nodes.push(node);
          }
        }
        return nodes;
      };

      const dsaOptions: DsaBfsOptions = {
        maxDepth,
        maxExpansions: limit * 3,
        similarityWeight: 0.7,
        depthWeight: 0.3,
        earlyTerminationThreshold: 0.95,
      };

      // Use dsaBfs to find best path
      const result = await dsaBfs(
        startNode,
        queryEmbedding,
        getNeighborNodes,
        undefined, // No target predicate - explore all
        dsaOptions
      );

      if (result) {
        // Get all nodes along the path
        for (let i = 0; i < result.path.length && i < limit; i++) {
          const nodeId = result.path[i];
          if (!nodeId) {
            continue;
          }

          const node = await getNode(nodeId);
          if (node) {
            traversedNodes.push({
              id: node.id,
              label: node.label,
              kind: node.kind,
              depth: i,
              path: result.path.slice(0, i + 1),
              similarity:
                i === result.path.length - 1 ? result.similarity : undefined,
            });
          }
        }
      }
    } else {
      // Simple BFS traversal
      const visited = new Set<string>([input.startId]);
      const queue: Array<{ nodeId: string; depth: number; path: string[] }> = [
        { nodeId: input.startId, depth: 0, path: [input.startId] },
      ];

      while (queue.length > 0 && traversedNodes.length < limit) {
        const current = queue.shift();
        if (!current || current.depth > maxDepth) {
          continue;
        }

        // Add current node to results (skip start node)
        if (current.depth > 0) {
          const node = await getNode(current.nodeId);
          if (node) {
            traversedNodes.push({
              id: node.id,
              label: node.label,
              kind: node.kind,
              depth: current.depth,
              path: current.path,
            });
          }
        }

        // Get neighbors for next level
        if (current.depth < maxDepth) {
          const neighbors = await getNeighbors(current.nodeId, {
            direction,
            kind: input.kind,
            limit: 20,
          });

          for (const { otherNodeId } of neighbors) {
            if (!visited.has(otherNodeId)) {
              visited.add(otherNodeId);
              queue.push({
                nodeId: otherNodeId,
                depth: current.depth + 1,
                path: [...current.path, otherNodeId],
              });
            }
          }
        }
      }
    }

    // Record access for traversed nodes
    const nodeIds = traversedNodes.map((n) => n.id);
    if (nodeIds.length > 0) {
      await recordAccessBatch(nodeIds).catch(() => {
        // Non-fatal
      });
    }

    // Record metrics
    const maxDepthReached = traversedNodes.reduce(
      (max, n) => Math.max(max, n.depth),
      0
    );
    recordMemoryTraverseDepth(maxDepthReached);
    recordMemoryToolCall("memory_traverse", "success");

    return {
      success: true,
      startNode: {
        id: startNode.id,
        label: startNode.label,
        kind: startNode.kind,
      },
      nodes: traversedNodes,
      count: traversedNodes.length,
      message: input.query
        ? "DSA-BFS traversal with semantic query"
        : `BFS traversal to depth ${maxDepth}`,
    };
  },
};

export type ToolMemoryTraverse = typeof toolMemoryTraverse;
