import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { desc, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

const NODE_LIMIT = 200;
const EDGE_LIMIT = 2000;

export const toolMindscapeRead = {
  name: "mindscape_read",
  description:
    "Read the current state of the Mindscape (nodes and connections). Use this to understand the spatial layout of knowledge.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Optional search query to filter nodes by label"),
  }),
  execute: async ({ query }: { query?: string }) => {
    const normalizedQuery = query?.trim();
    const pattern = normalizedQuery ? `%${normalizedQuery}%` : null;

    const nodes = await (pattern
      ? db
          .select({
            id: memoryNodes.id,
            label: memoryNodes.label,
            kind: memoryNodes.kind,
          })
          .from(memoryNodes)
          .where(sql`${memoryNodes.label} ilike ${pattern}`)
          .orderBy(desc(memoryNodes.updated), desc(memoryNodes.created))
          .limit(NODE_LIMIT)
      : db
          .select({
            id: memoryNodes.id,
            label: memoryNodes.label,
            kind: memoryNodes.kind,
          })
          .from(memoryNodes)
          .orderBy(desc(memoryNodes.updated), desc(memoryNodes.created))
          .limit(NODE_LIMIT));

    const ids = nodes.map((node) => node.id);
    const edges =
      ids.length === 0
        ? []
        : await db
            .select({
              from: memoryEdges.fromId,
              to: memoryEdges.toId,
              kind: memoryEdges.kind,
            })
            .from(memoryEdges)
            .where(
              or(
                inArray(memoryEdges.fromId, ids as [string, ...string[]]),
                inArray(memoryEdges.toId, ids as [string, ...string[]])
              )
            )
            .orderBy(desc(memoryEdges.created))
            .limit(EDGE_LIMIT);

    return {
      nodes,
      edges,
      count: nodes.length,
    };
  },
};

export const toolMindscapeConnect = {
  name: "mindscape_connect",
  description: "Connect two nodes in the Mindscape with a directed edge.",
  inputSchema: z.object({
    fromId: z.string().describe("ID of the source node"),
    toId: z.string().describe("ID of the target node"),
    kind: z.enum(["relates_to", "blocks", "depends_on"]).default("relates_to"),
  }),
  execute: async ({
    fromId,
    toId,
    kind,
  }: {
    fromId: string;
    toId: string;
    kind: "relates_to" | "blocks" | "depends_on";
  }) => {
    const [edge] = await db
      .insert(memoryEdges)
      .values({
        fromId,
        toId,
        kind,
        resource: "agent",
        hash: `${fromId}-${toId}-${kind}`,
      })
      .returning();
    if (!edge) {
      throw new Error("Failed to create edge");
    }

    return { success: true, edgeId: edge.id };
  },
};

// Note: implement mindscape_arrange once layout updates can be pushed to the client.
