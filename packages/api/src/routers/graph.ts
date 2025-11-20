import { memoryEdges } from "@alfred/db/schema/graph";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { db } from "@alfred/db";

export const graphRouter = router({
  getEdges: authedProcedure
    .input(
      z.object({
        nodeIds: z.array(z.string()),
      })
    )
    .query(async ({ input }) => {
      if (input.nodeIds.length === 0) return [];

      // Find edges where BOTH ends are in the requested set
      // This creates a subgraph view
      const allEdges = await db.select().from(memoryEdges);
      
      return allEdges.filter(e => input.nodeIds.includes(e.fromId) && input.nodeIds.includes(e.toId));
    }),

  connect: authedProcedure
    .input(
      z.object({
        fromId: z.string(),
        toId: z.string(),
        kind: z.enum(["relates_to", "blocks", "depends_on"]).default("relates_to"),
      })
    )
    .mutation(async ({ input }) => {
      const [edge] = await db
        .insert(memoryEdges)
        .values({
          fromId: input.fromId,
          toId: input.toId,
          kind: input.kind,
          resource: "user", // Default scope
          hash: `${input.fromId}-${input.toId}-${input.kind}`, // Simple hash
        })
        .returning();
      return edge;
    }),
});
