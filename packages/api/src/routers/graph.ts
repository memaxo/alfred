import { db } from "@alfred/db";
import { ensureMirrorNodes, touchNodes } from "@alfred/db/repo/graph/write";
import { memoryEdges } from "@alfred/db/schema/graph";
import { logger } from "@alfred/logger";
import { observable } from "@trpc/server/observable";
import { and, eq, inArray, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";

import type { EdgeRow } from "../services/graph";

import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";

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
      const { getExplainingDocuments } = await import("@alfred/graph");
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
        const uniqueIds = [...new Set(input.nodeIds)];
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
      const { kind } = input;
      let graphInstance: import("@alfred/knowledge").Hypergraph | undefined;
      let stopTimer: (() => void) | null = null;
      let metrics: {
        graphQueryDurationSeconds: {
          startTimer: (labels: { kind: string }) => () => void;
        };
        graphQueriesTotal: {
          inc: (labels: { kind: string; resource: string }) => void;
        };
      } | null = null;

      try {
        // Lazy-load heavyweight metrics wiring to keep router imports fast.
        const m = await import("../metrics");
        metrics = {
          graphQueryDurationSeconds: m.graphQueryDurationSeconds,
          graphQueriesTotal: m.graphQueriesTotal,
        };
      } catch {
        metrics = null;
      }

      try {
        const { runQuery: runUnifiedQuery } = await import("@alfred/graph");
        try {
          stopTimer =
            metrics?.graphQueryDurationSeconds.startTimer({ kind }) ?? null;
        } catch {
          stopTimer = null;
        }

        // Context Query: Parallel Graph Traversal + Vector RAG
        if (input.kind === "context") {
          const { executeContextQuery } = await import("../services/graph");
          return await executeContextQuery(
            input.nodeId,
            input.text,
            input.topK,
            resource
          );
        }

        if (
          input.kind === "datalog" ||
          (input.kind === "semantic" && input.preferRag !== true)
        ) {
          const [{ empty: createHypergraph }, { loadHypergraphFromDb }] =
            await Promise.all([
              import("@alfred/knowledge/hypergraph"),
              import("@alfred/agent/assistant/hypergraph-bridge"),
            ]);
          graphInstance = createHypergraph();
          await loadHypergraphFromDb(resource, graphInstance);
        }

        const result = await runUnifiedQuery(input, {
          graph: graphInstance,
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
            void touchNodes(nodeIds).catch((error: unknown) => {
              logger.warn("graph_active_recall_failed", {
                nodeCount: nodeIds.length,
                error: error instanceof Error ? error.message : String(error),
              });
            });
          }
        }

        try {
          metrics?.graphQueriesTotal.inc({ kind, resource });
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

  // ─────────────────────────────────────────────────────────────────────────
  // Context retrieval for chat panel
  // ─────────────────────────────────────────────────────────────────────────

  getContext: authedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        nodeId: z.string().optional(),
        topK: z.number().int().min(1).max(20).default(5),
        resource: z.string().optional(),
      })
    )
    .query(async ({ input }) =>
      semanticQuery(
        { text: input.text, topK: input.topK, resource: input.resource },
        (result) => ({
          items: (result.nodes ?? []).map((node, index) => {
            const props = node.properties as
              | Record<string, unknown>
              | undefined;
            return {
              id: node.id.dbId ?? node.id.uiId ?? `ctx-${index}`,
              type: mapNodeKindToContextType(node.kind),
              title: node.label ?? "Unknown",
              content:
                (props?.content as string) ??
                (props?.text as string) ??
                node.label ??
                "",
              relevance: (props?.score as number) ?? 1 - index * 0.1,
            };
          }),
        }),
        "graph_get_context_failed"
      ).catch(() => ({ items: [] }))
    ),

  // ─────────────────────────────────────────────────────────────────────────
  // RAG chunks retrieval
  // ─────────────────────────────────────────────────────────────────────────

  getRagChunks: authedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        topK: z.number().int().min(1).max(20).default(5),
        resource: z.string().optional(),
      })
    )
    .query(async ({ input }) =>
      semanticQuery(
        { text: input.text, topK: input.topK, resource: input.resource },
        (result) => ({
          chunks: (result.nodes ?? []).map((node, index) => {
            const props = node.properties as
              | Record<string, unknown>
              | undefined;
            return {
              id: node.id.dbId ?? node.id.uiId ?? `chunk-${index}`,
              source:
                (props?.source as string) ??
                (props?.filename as string) ??
                node.label ??
                "unknown",
              content:
                (props?.content as string) ??
                (props?.text as string) ??
                node.label ??
                "",
              score: (props?.score as number) ?? 1 - index * 0.05,
              metadata: {
                section: (props?.section as string) ?? undefined,
                lastUpdated: (props?.updatedAt as string) ?? undefined,
              },
            };
          }),
        }),
        "graph_get_rag_chunks_failed"
      ).catch(() => ({ chunks: [] }))
    ),

  // ─────────────────────────────────────────────────────────────────────────
  // Graph visualization data
  // ─────────────────────────────────────────────────────────────────────────

  getGraphVisualization: authedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        topK: z.number().int().min(1).max(20).default(10),
        resource: z.string().optional(),
      })
    )
    .query(async ({ input }) =>
      semanticQuery(
        {
          text: input.text,
          topK: input.topK,
          resource: input.resource,
          preferRag: false,
        },
        (result) => ({
          nodes: (result.nodes ?? []).map(
            (
              node,
              index
            ): {
              id: string;
              label: string;
              type: string;
              relevance: number;
            } => {
              const props = node.properties as
                | Record<string, unknown>
                | undefined;
              return {
                id: node.id.dbId ?? node.id.uiId ?? `node-${index}`,
                label: node.label ?? "Unknown",
                type: node.kind ?? "other",
                relevance: (props?.score as number) ?? 1 - index * 0.05,
              };
            }
          ),
          edges: (result.edges ?? []).map((edge, index) => ({
            id: edge.id ?? `edge-${index}`,
            source: edge.source.uiId ?? edge.source.dbId ?? "",
            target: edge.target.uiId ?? edge.target.dbId ?? "",
            type: edge.kind ?? "relates_to",
            weight: edge.weight ?? 1,
          })),
        }),
        "graph_get_visualization_failed"
      ).catch(() => ({ nodes: [], edges: [] }))
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

async function semanticQuery<T>(
  params: {
    text: string;
    topK: number;
    resource?: string;
    preferRag?: boolean;
  },
  transform: (
    result: Awaited<ReturnType<typeof import("@alfred/graph").runQuery>>
  ) => T,
  errorKey: string
): Promise<T> {
  const resource = params.resource ?? "user";

  try {
    const { runQuery: runUnifiedQuery } = await import("@alfred/graph");

    const result = await runUnifiedQuery(
      {
        kind: "semantic",
        text: params.text,
        topK: params.topK,
        preferRag: params.preferRag ?? true,
        resource,
      },
      { resource }
    );

    return transform(result);
  } catch (error) {
    logger.error(errorKey, {
      resource,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function mapNodeKindToContextType(
  kind: string
): "document" | "url" | "knowledge" | "fact" {
  switch (kind) {
    case "document":
    case "file":
    case "note": {
      return "document";
    }
    case "url":
    case "link": {
      return "url";
    }
    case "fact": {
      return "fact";
    }
    default: {
      return "knowledge";
    }
  }
}
