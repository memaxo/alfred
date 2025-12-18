import { createHash } from "node:crypto";
import { loadHypergraphFromDb } from "@alfred/agent/assistant/hypergraph-bridge";
import { db } from "@alfred/db";
import { ensureMirrorNodes, touchNodes } from "@alfred/db/repo/graph/write";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import {
  getExplainingDocuments,
  runQuery as runUnifiedQuery,
} from "@alfred/graph";
import { empty as createHypergraph } from "@alfred/knowledge/hypergraph";
import { logger } from "@alfred/logger";
import { observable } from "@trpc/server/observable";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { requirePolicy } from "../gate";
import {
  graphContextDurationSeconds,
  graphQueriesTotal,
  graphQueryDurationSeconds,
  graphRagEmptyTotal,
  graphRagHitsTotal,
} from "../metrics";
import { authedProcedure, router } from "../trpc";

type EdgeRow = typeof memoryEdges.$inferSelect;

function mapGraphWriteResource(raw: unknown) {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const resource = typeof input.resource === "string" ? input.resource : "user";
  const fromId = typeof input.fromId === "string" ? input.fromId : undefined;
  const toId = typeof input.toId === "string" ? input.toId : undefined;
  const edgeKind = typeof input.kind === "string" ? input.kind : undefined;

  if (fromId && toId) {
    return {
      kind: "graph" as const,
      id: resource,
      attrs: {
        op: "connect",
        fromId,
        toId,
        edgeKind,
      },
    };
  }

  return {
    kind: "graph" as const,
    id: resource,
    attrs: {
      op: "ensure_mirrors",
      entities: Array.isArray(input.entities) ? input.entities.length : 0,
    },
  };
}

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
  topK: z.number().int().min(1).max(1000).optional(),
  preferRag: z.boolean().optional(),
  resource: z.string().optional(),
});

const contextQuerySchema = z.object({
  kind: z.literal("context"),
  nodeId: z.string().min(1),
  text: z.string().min(1),
  topK: z.number().int().min(1).max(1000).optional(),
  resource: z.string().optional(),
});

const unifiedQuerySchema = z.discriminatedUnion("kind", [
  traverseQuerySchema,
  pathQuerySchema,
  datalogQuerySchema,
  semanticQuerySchema,
  contextQuerySchema,
]);

export const graphRouter = router({
  ensureMirrors: authedProcedure
    .use(requirePolicy("graph.write", (raw) => mapGraphWriteResource(raw)))
    .input(
      z.object({
        resource: z.string().optional(),
        entities: z.array(
          z.object({
            kind: z.enum(["note", "reminder", "workflow_run"]),
            id: z.string().uuid(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const resource = input.resource ?? "user";
      const rowsByEntity = await ensureMirrorNodes(resource, input.entities);

      const refs = input.entities
        .map((entity) => {
          const row = rowsByEntity.get(`${entity.kind}:${entity.id}`);
          if (!row) {
            return null;
          }
          return {
            entity,
            ref: {
              id: { dbId: row.id },
              resource,
            },
          };
        })
        .filter(
          (
            entry
          ): entry is {
            entity: { kind: "note" | "reminder" | "workflow_run"; id: string };
            ref: { id: { dbId: string }; resource: string };
          } => Boolean(entry)
        );

      return { refs };
    }),

  getEdges: authedProcedure
    .input(
      z.object({
        nodeIds: z.array(z.string()),
        resource: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { nodeIds } = input;
      if (nodeIds.length === 0) {
        return [];
      }
      const resource = input.resource ?? "user";

      try {
        return await db
          .select()
          .from(memoryEdges)
          .where(
            and(
              eq(memoryEdges.resource, resource),
              inArray(memoryEdges.fromId, nodeIds),
              inArray(memoryEdges.toId, nodeIds)
            )
          );
      } catch (error) {
        logger.error("graph_get_edges_failed", {
          resource,
          nodeCount: nodeIds.length,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),

  connect: authedProcedure
    .use(requirePolicy("graph.write", (raw) => mapGraphWriteResource(raw)))
    .input(
      z.object({
        fromId: z.string(),
        toId: z.string(),
        kind: z
          .enum(["relates_to", "blocks", "depends_on", "is_a", "part_of"])
          .default("relates_to"),
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

  explainedBy: authedProcedure
    .input(
      z.object({
        reasoningNodeId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const { nodes, edges } = await getExplainingDocuments(
        input.reasoningNodeId
      );
      return {
        nodes,
        edges,
      };
    }),

  watchEdges: authedProcedure
    .input(
      z.object({
        nodeIds: z.array(z.string()).min(1),
        resource: z.string().optional(),
        pollMs: z.number().int().min(500).max(30_000).default(3000),
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
          const id = uniqueIds[0];
          const idPredicate =
            uniqueIds.length === 1 && id
              ? or(eq(memoryEdges.fromId, id), eq(memoryEdges.toId, id))
              : or(
                  inArray(memoryEdges.fromId, uniqueIds),
                  inArray(memoryEdges.toId, uniqueIds)
                );
          const predicates = [idPredicate];
          if (resource) {
            predicates.push(eq(memoryEdges.resource, resource));
          }
          const firstPredicate = predicates[0];
          return predicates.length === 1 && firstPredicate
            ? firstPredicate
            : and(...predicates);
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
      const kind = input.kind;
      let graphInstance = null;
      let stopTimer: (() => void) | null = null;

      try {
        try {
          stopTimer = graphQueryDurationSeconds.startTimer({ kind });
        } catch {
          stopTimer = null;
        }

        // Context Query: Parallel Graph Traversal + Vector RAG
        if (input.kind === "context") {
          let stopContextTimer: (() => void) | null = null;
          try {
            stopContextTimer = graphContextDurationSeconds.startTimer();
          } catch {
            /* ignore */
          }

          // 1. Graph Traversal (1-hop neighbors)
          const edgesPromise = db
            .select()
            .from(memoryEdges)
            .where(
              and(
                eq(memoryEdges.resource, resource),
                or(
                  eq(memoryEdges.fromId, input.nodeId),
                  eq(memoryEdges.toId, input.nodeId)
                )
              )
            );

          // 2. Vector RAG
          // We reuse the runUnifiedQuery logic for semantic search by constructing a synthetic input
          const ragInput = {
            kind: "semantic" as const,
            text: input.text,
            topK: input.topK,
            preferRag: true,
            resource,
          };
          const ragPromise = runUnifiedQuery(ragInput, { resource });

          const [edges, ragResult] = await Promise.all([
            edgesPromise,
            ragPromise,
          ]);

          // 1. Identify 1-hop neighbors
          const neighborIds = new Set<string>();
          edges.forEach((edge) => {
            if (edge.fromId !== input.nodeId) neighborIds.add(edge.fromId);
            if (edge.toId !== input.nodeId) neighborIds.add(edge.toId);
          });

          // 2. Deep RAG: If 1-hop is sparse (< 3) and we have neighbors, go deeper (2-hop)
          let deepEdges: EdgeRow[] = [];
          const oneHopIds = Array.from(neighborIds);

          if (edges.length < 3 && oneHopIds.length > 0) {
            try {
              deepEdges = await db
                .select()
                .from(memoryEdges)
                .where(
                  and(
                    eq(memoryEdges.resource, resource),
                    or(
                      inArray(memoryEdges.fromId, oneHopIds),
                      inArray(memoryEdges.toId, oneHopIds)
                    )
                  )
                )
                .limit(10);

              // Filter edges connecting back to start node
              deepEdges = deepEdges.filter(
                (e) => e.fromId !== input.nodeId && e.toId !== input.nodeId
              );

              // Add 2-hop neighbors to ID set for label fetching
              deepEdges.forEach((e) => {
                if (!neighborIds.has(e.fromId)) neighborIds.add(e.fromId);
                if (!neighborIds.has(e.toId)) neighborIds.add(e.toId);
              });
            } catch (error) {
              // Ignore deep RAG failures, fallback to 1-hop
              logger.warn("graph_context_deep_traversal_failed", {
                resource,
                nodeId: input.nodeId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          // 3. Fetch labels for all identified nodes (1-hop + 2-hop)
          const neighborsPromise =
            neighborIds.size > 0
              ? db
                  .select({ id: memoryNodes.id, label: memoryNodes.label })
                  .from(memoryNodes)
                  .where(inArray(memoryNodes.id, Array.from(neighborIds)))
              : Promise.resolve([]);

          const neighbors = await neighborsPromise;
          const labelMap = new Map(neighbors.map((n) => [n.id, n.label]));

          // 4. Format 1-hop edges
          const graphNodes = edges.map((edge) => {
            const isOutgoing = edge.fromId === input.nodeId;
            const neighborId = isOutgoing ? edge.toId : edge.fromId;
            const label = labelMap.get(neighborId) ?? neighborId;

            return {
              id: { uiId: neighborId },
              kind: "link",
              label,
              properties: {
                relation: edge.kind,
                direction: isOutgoing ? "outgoing" : "incoming",
              },
            };
          });

          // 5. Format 2-hop edges
          const deepGraphNodes = deepEdges.map((edge) => {
            // Heuristic: Identify the "bridge" node (the one in 1-hop set)
            // If both are 1-hop, it's a lateral connection.
            // If one is new, it's the target.
            const fromIs1Hop = oneHopIds.includes(edge.fromId);

            // Default to 'to' as target if 'from' is the bridge
            const bridgeId = fromIs1Hop ? edge.fromId : edge.toId;
            const targetId = fromIs1Hop ? edge.toId : edge.fromId;

            const targetLabel = labelMap.get(targetId) ?? targetId;
            const bridgeLabel = labelMap.get(bridgeId) ?? bridgeId;

            return {
              id: { uiId: targetId },
              kind: "link",
              label: `${targetLabel} (via ${bridgeLabel})`,
              properties: {
                relation: edge.kind,
                direction: "indirect",
              },
            };
          });

          const allGraphNodes = [...graphNodes, ...deepGraphNodes];
          const allEdges = [...edges, ...deepEdges, ...(ragResult.edges || [])];

          // Record metrics
          try {
            const vectorCount = (ragResult.nodes || []).length;
            const graphCount = allGraphNodes.length;

            if (vectorCount > 0) {
              graphRagHitsTotal.inc({ source: "vector" }, vectorCount);
            }
            if (graphCount > 0) {
              graphRagHitsTotal.inc({ source: "graph" }, graphCount);
            }
            if (vectorCount === 0 && graphCount === 0) {
              graphRagEmptyTotal.inc();
            }
          } catch {
            /* ignore metrics errors */
          }

          if (stopContextTimer) stopContextTimer();

          return {
            nodes: [...allGraphNodes, ...(ragResult.nodes || [])],
            edges: allEdges,
            meta: {
              graphCount: allGraphNodes.length,
              ragCount: (ragResult.nodes || []).length,
            },
          };
        }

        if (
          input.kind === "datalog" ||
          (input.kind === "semantic" && input.preferRag !== true)
        ) {
          graphInstance = createHypergraph();
          await loadHypergraphFromDb(resource, graphInstance);
        }

        const result = await runUnifiedQuery(input, {
          graph: graphInstance ?? undefined,
          resource,
        });

        // Active Recall: Reinforce nodes that were successfully retrieved
        // Fire-and-forget to avoid latency
        if (result.nodes && result.nodes.length > 0) {
          const nodeIds = result.nodes
            .map((n) => n.id.dbId)
            .filter((id): id is string => Boolean(id));

          if (nodeIds.length > 0) {
            // Use a microtask or immediate to detach from current stack
            void touchNodes(nodeIds).catch((err: unknown) => {
              logger.warn("graph_active_recall_failed", {
                nodeCount: nodeIds.length,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        }

        try {
          graphQueriesTotal.inc({ kind, resource });
        } catch {
          // Metrics failures must not affect query results
        }

        return result;
      } catch (error) {
        logger.error("graph_run_query_failed", {
          kind,
          resource,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        if (stopTimer) {
          try {
            stopTimer();
          } catch {
            // Ignore histogram failures
          }
        }
      }
    }),
});
