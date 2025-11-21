import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { z } from "zod";

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
    // In a real implementation, this might query the active Mindscape state via a shared store or DB
    // For now, we'll query the DB representation which is the source of truth for persistent nodes
    const nodes = await db.select().from(memoryNodes);
    const edges = await db.select().from(memoryEdges);

    // Filter if query provided
    const filteredNodes = query
      ? nodes.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
      : nodes;

    return {
      nodes: filteredNodes.map((n) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
      })),
      edges: edges.map((e) => ({ from: e.fromId, to: e.toId, kind: e.kind })),
      count: filteredNodes.length,
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

// TODO: Implement mindscape_arrange when we have a way to push layout updates to the client
