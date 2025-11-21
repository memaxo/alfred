import { memoryEdges } from "@alfred/db/schema/graph";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { db } from "@alfred/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { observable } from "@trpc/server/observable";
import { runQuery as runUnifiedQuery } from "@alfred/graph";
import { empty as createHypergraph } from "@alfred/knowledge/hypergraph";
import { loadHypergraphFromDb } from "@alfred/agent/assistant/src/hypergraph-bridge";

type EdgeRow = typeof memoryEdges.$inferSelect;

const traverseQuerySchema = z.object({
  kind: z.literal("traverse"),
  nodeId: z.string(),
  direction: z.enum(["in", "out", "both"]).optional(),
  edgeKind: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  resource: z.string().optional(),
});

const pathQuerySchema = z.object({
  kind: z.literal("path"),
  fromId: z.string(),
  toId: z.string(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  resource: z.string().optional(),
});

const datalogQuerySchema = z.object({
  kind: z.literal("datalog"),
  query: z.string().min(1),
  resource: z.string().optional(),
});

const semanticQuerySchema = z.object({
  kind: z.literal("semantic"),
  text: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional(),
  preferRag: z.boolean().optional(),
  resource: z.string().optional(),
});

const unifiedQuerySchema = z.discriminatedUnion("kind", [
  traverseQuerySchema,
  pathQuerySchema,
  datalogQuerySchema,
  semanticQuerySchema,
]);

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

  watchEdges: authedProcedure
    .input(
      z.object({
        nodeIds: z.array(z.string()).min(1),
        resource: z.string().optional(),
        pollMs: z.number().int().min(500).max(30_000).default(3_000),
      })
    )
    .subscription(({ input }) =>
      observable<{ edges: EdgeRow[] }>((emit) => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let stopped = false;
        let lastIds = new Set<string>();
        const uniqueIds = Array.from(new Set(input.nodeIds));
        const resource = input.resource ?? "user";

        const buildWhere = () => {
          const idPredicate =
            uniqueIds.length === 1
              ? or(
                  eq(memoryEdges.fromId, uniqueIds[0]!),
                  eq(memoryEdges.toId, uniqueIds[0]!)
                )
              : or(
                  inArray(memoryEdges.fromId, uniqueIds),
                  inArray(memoryEdges.toId, uniqueIds)
                );
          const predicates = [idPredicate];
          if (resource) {
            predicates.push(eq(memoryEdges.resource, resource));
          }
          return predicates.length === 1 ? predicates[0]! : and(...predicates);
        };

        const poll = async () => {
          if (stopped || uniqueIds.length === 0) {
            return;
          }
          try {
            const rows = await db
              .select()
              .from(memoryEdges)
              .where(buildWhere())
              .orderBy(memoryEdges.created);
            const currentIds = new Set(rows.map((row) => row.id));
            const fresh = rows.filter((row) => !lastIds.has(row.id));
            if (fresh.length > 0) {
              emit.next({ edges: fresh });
            }
            lastIds = currentIds;
          } catch (error) {
            emit.error(error as Error);
            return;
          }
          timeout = setTimeout(poll, input.pollMs);
        };

        poll();

        return () => {
          stopped = true;
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
        };
      })
    ),

  runQuery: authedProcedure
    .input(unifiedQuerySchema)
    .query(async ({ input }) => {
      const resource = input.resource ?? "user";
      let graphInstance = null;
      if (
        input.kind === "datalog" ||
        (input.kind === "semantic" && input.preferRag !== true)
      ) {
        graphInstance = createHypergraph();
        await loadHypergraphFromDb(resource, graphInstance);
      }
      return runUnifiedQuery(input, {
        graph: graphInstance ?? undefined,
        resource,
      });
    }),
});
