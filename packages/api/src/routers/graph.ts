import { memoryEdges } from "@alfred/db/schema/graph";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { db } from "@alfred/db";
import { and, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";

export const graphRouter = router({
  getEdges: authedProcedure
    .input(
      z.object({
        nodeIds: z.array(z.string()),
        resource: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { nodeIds } = input;
      if (nodeIds.length === 0) return [];
      const resource = input.resource ?? "user";

      return db
        .select()
        .from(memoryEdges)
        .where(
          and(
            eq(memoryEdges.resource, resource),
            inArray(memoryEdges.fromId, nodeIds),
            inArray(memoryEdges.toId, nodeIds)
          )
        );
    }),

  connect: authedProcedure
    .input(
      z.object({
        fromId: z.string(),
        toId: z.string(),
        kind: z.enum(["relates_to", "blocks", "depends_on"]).default("relates_to"),
        resource: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const resource = input.resource ?? "user";
      const hash = createHash("sha256")
        .update(resource)
        .update("|")
        .update(input.fromId)
        .update("|")
        .update(input.toId)
        .update("|")
        .update(input.kind)
        .digest("hex");

      const inserted = await db
        .insert(memoryEdges)
        .values({
          fromId: input.fromId,
          toId: input.toId,
          kind: input.kind,
          resource,
          hash,
        })
        .onConflictDoNothing({ target: memoryEdges.hash })
        .returning();

      if (inserted.length > 0) {
        return inserted[0];
      }

      const [existing] = await db
        .select()
        .from(memoryEdges)
        .where(eq(memoryEdges.hash, hash))
        .limit(1);

      return existing ?? null;
    }),
});
