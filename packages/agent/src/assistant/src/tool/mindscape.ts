import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { z } from "zod";

const mindscapeReadInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional search query to filter nodes by label"),
});

type MindscapeReadInput = z.infer<typeof mindscapeReadInputSchema>;

export const toolMindscapeRead = {
  name: "mindscape_read",
  description:
    "Read the current state of the Mindscape (nodes and connections). Use this to understand the spatial layout of knowledge.",
  inputSchema: mindscapeReadInputSchema,
  execute: async ({ input }: { input: MindscapeReadInput }) => {
    const { query } = input;
    const nodes = await db.select().from(memoryNodes);
    const edges = await db.select().from(memoryEdges);

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

const mindscapeConnectInputSchema = z.object({
  fromId: z.string().describe("ID of the source node"),
  toId: z.string().describe("ID of the target node"),
  kind: z.enum(["relates_to", "blocks", "depends_on"]).default("relates_to"),
});

type MindscapeConnectInput = z.infer<typeof mindscapeConnectInputSchema>;

export const toolMindscapeConnect = {
  name: "mindscape_connect",
  description: "Connect two nodes in the Mindscape with a directed edge.",
  inputSchema: mindscapeConnectInputSchema,
  execute: async ({ input }: { input: MindscapeConnectInput }) => {
    const { fromId, toId, kind } = input;
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
