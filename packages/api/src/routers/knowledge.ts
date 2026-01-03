import { db } from "@alfred/db";
import { upsertEdges, upsertNodes } from "@alfred/db/repo/graph";
import { touchNodes } from "@alfred/db/repo/graph/write";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { logger } from "@alfred/logger";

/** Node seed for graph upsert operations */
type GraphNodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  properties?: unknown;
  embedding?: number[];
};

/** Edge seed for graph upsert operations */
type GraphEdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
  metadata?: unknown;
};

import type { Knowledge, NodeId } from "@alfred/knowledge/hypergraph";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

type VisualizeNode = {
  id: string;
  label: string;
  entityType?: string;
  confidence?: number;
  archived?: string;
  description?: string;
  hgHash?: string;
};

type VisualizeEdge = {
  id: string;
  fromId: string;
  toId: string;
  kind: string;
  weight?: number;
};

function asProps(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/** Maximum facts to fetch for entity filtering */
const ENTITY_FETCH_LIMIT = 500;

const visualizeInputSchema = z.object({
  text: z.string().min(1).max(20_000),
  resource: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function nodeKey(resource: string, hash: string): string {
  return `${resource}:${hash}`;
}

function makeNode(
  resource: string,
  entry: { hash: string; data: Knowledge }
): GraphNodeSeed | null {
  const { data, hash } = entry;
  switch (data._) {
    case "fact":
      return {
        resource,
        hash,
        kind: data._,
        label: data.content,
        properties: {
          confidence: data.confidence,
          source: data.source,
          ts: data.ts,
        },
      };
    case "insight":
      return {
        resource,
        hash,
        kind: data._,
        label: data.conclusion,
        properties: {
          derived: data.derived,
          confidence: data.confidence,
        },
      };
    case "pattern":
      return {
        resource,
        hash,
        kind: data._,
        label: data.rule,
        properties: {
          examples: data.examples,
          accuracy: data.accuracy,
        },
      };
    default:
      return null;
  }
}

function makeEdge(
  resource: string,
  entry: { hash: string; data: Knowledge },
  nodes: Map<string, { id: string }>
): GraphEdgeSeed | null {
  if (entry.data._ !== "relation") {
    return null;
  }
  const fromHash = String(entry.data.from as unknown as NodeId);
  const toHash = String(entry.data.to as unknown as NodeId);
  const from = nodes.get(nodeKey(resource, fromHash));
  const to = nodes.get(nodeKey(resource, toHash));
  if (!(from && to)) {
    return null;
  }

  return {
    resource,
    hash: entry.hash,
    fromId: from.id,
    toId: to.id,
    kind: entry.data.kind,
    weight: entry.data.weight,
    metadata: {
      from: fromHash,
      to: toHash,
    },
  };
}

export const knowledgeRouter = router({
  /**
   * Get knowledge graph statistics
   * Returns counts of facts, relations, insights, and patterns
   */
  stats: authedProcedure
    .input(z.object({ resource: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const resource = input?.resource ?? "user";

      // Count nodes by kind
      const nodeCountsByKind = await db
        .select({
          kind: memoryNodes.kind,
          count: count(),
        })
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, resource))
        .groupBy(memoryNodes.kind);

      // Count total edges
      const edgeCountResult = await db
        .select({ count: count() })
        .from(memoryEdges)
        .where(eq(memoryEdges.resource, resource));

      // Extract counts by kind
      const kindCounts = new Map(
        nodeCountsByKind.map((row) => [row.kind, Number(row.count)])
      );

      return {
        facts: kindCounts.get("fact") ?? 0,
        relations: edgeCountResult[0]?.count ?? 0,
        insights: kindCounts.get("insight") ?? 0,
        patterns: kindCounts.get("pattern") ?? 0,
        totalNodes: Array.from(kindCounts.values()).reduce((a, b) => a + b, 0),
        resource,
      };
    }),

  visualize: authedProcedure
    .input(visualizeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const resource = input.resource ?? "user";
      const limit = input.limit ?? 20;
      const source = `mindscape:${ctx.session.user.id}`;

      const { extract, toKnowledge } = await import(
        "@alfred/knowledge/extractor"
      );
      const extraction = extract(input.text, source);
      const entries = toKnowledge(extraction);

      // Persist to DB (facts + entity facts + relation edges) with visible failures (unlike runtime fire-and-forget).
      const nodeSeeds: GraphNodeSeed[] = [];
      const relationEntries: Array<{ hash: string; data: Knowledge }> = [];
      for (const entry of entries) {
        const nodeSeed = makeNode(resource, entry);
        if (nodeSeed) {
          nodeSeeds.push(nodeSeed);
        }
        if (entry.data._ === "relation") {
          relationEntries.push(entry);
        }
      }

      const nodeMap = await upsertNodes(nodeSeeds);

      // Active Recall: Reinforce newly created/updated nodes
      try {
        const nodeIds = Array.from(nodeMap.values()).map((n) => n.id);
        if (nodeIds.length > 0) {
          await touchNodes(nodeIds);
        }
      } catch (error) {
        // Non-blocking: log but don't throw
        logger.debug("active_recall_failed", {
          error: error instanceof Error ? error.message : String(error),
          nodeCount: nodeMap.size,
        });
      }

      if (relationEntries.length > 0) {
        const idMap = new Map<string, { id: string }>();
        for (const row of nodeMap.values()) {
          idMap.set(nodeKey(row.resource, row.hash), { id: row.id });
        }

        const edgeSeeds: GraphEdgeSeed[] = [];
        for (const rel of relationEntries) {
          const seed = makeEdge(resource, rel, idMap);
          if (seed) {
            edgeSeeds.push(seed);
          }
        }
        if (edgeSeeds.length > 0) {
          await upsertEdges(edgeSeeds);
        }
      }

      const extractedEntityLabels = new Set(
        (extraction.entityDetails ?? [])
          .filter((entity) => !entity.isPronoun)
          .map((entity) => entity.label.trim().toLowerCase())
          .filter(Boolean)
      );

      // Pull a bounded window of recent entity fact nodes with SQL-level filtering.
      // Filter by source containing ":entity" at the database level for better performance.
      const recentEntityFacts = await db
        .select()
        .from(memoryNodes)
        .where(
          and(
            eq(memoryNodes.resource, resource),
            eq(memoryNodes.kind, "fact"),
            sql`json_extract(${memoryNodes.properties}, '$.source') LIKE '%:entity%'`
          )
        )
        .orderBy(desc(memoryNodes.created))
        .limit(ENTITY_FETCH_LIMIT);

      const { parseEntityFactLabel } = await import("@alfred/knowledge/entity");

      // Further filter by parsed entity label format and extracted labels
      const entityRows = recentEntityFacts.filter((row) => {
        const parsed = parseEntityFactLabel(row.label);
        if (!parsed) {
          return false;
        }
        if (extractedEntityLabels.size === 0) {
          return true;
        }
        return extractedEntityLabels.has(parsed.label.toLowerCase());
      });

      const picked = entityRows.slice(0, limit);
      const nodeIds = picked.map((row) => row.id);
      const nodeIdSet = new Set(nodeIds);

      const nodes: VisualizeNode[] = picked.map((row) => {
        const props = asProps(row.properties);
        const parsed = parseEntityFactLabel(row.label);
        const confidence =
          typeof props.confidence === "number" ? props.confidence : undefined;
        const archived =
          typeof props.archived === "string" ? props.archived : undefined;
        const description =
          typeof props.description === "string" ? props.description : undefined;

        return {
          id: row.id,
          label: parsed?.label ?? row.label,
          entityType: parsed?.entityType,
          confidence,
          archived,
          description,
          hgHash: row.hash,
        };
      });

      const edges: VisualizeEdge[] =
        nodeIds.length === 0
          ? []
          : (
              await db
                .select()
                .from(memoryEdges)
                .where(
                  and(
                    eq(memoryEdges.resource, resource),
                    or(
                      inArray(memoryEdges.fromId, nodeIds),
                      inArray(memoryEdges.toId, nodeIds)
                    )
                  )
                )
                .orderBy(desc(memoryEdges.created))
            )
              .filter(
                (edge) => nodeIdSet.has(edge.fromId) && nodeIdSet.has(edge.toId)
              )
              .map((edge) => ({
                id: edge.id,
                fromId: edge.fromId,
                toId: edge.toId,
                kind: edge.kind,
                weight: edge.weight ?? undefined,
              }));

      return {
        nodes,
        edges,
        meta: {
          resource,
          extractedEntities: extractedEntityLabels.size,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      };
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Entity Management Procedures
  // ─────────────────────────────────────────────────────────────────────────

  entitiesList: authedProcedure
    .input(
      z.object({
        resource: z.string().min(1).default("default"),
        kind: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const conditions = [eq(memoryNodes.resource, input.resource)];

      if (input.kind) {
        conditions.push(eq(memoryNodes.kind, input.kind));
      }

      const query = db
        .select()
        .from(memoryNodes)
        .where(and(...conditions))
        .orderBy(desc(memoryNodes.created))
        .limit(input.limit);

      const rows = await query;

      // Filter by search if provided
      const filteredRows = input.search
        ? rows.filter((row) =>
            row.label.toLowerCase().includes(input.search!.toLowerCase())
          )
        : rows;

      const entities = filteredRows.map((row) => {
        const props = asProps(row.properties);
        return {
          id: row.id,
          name: row.label,
          type: row.kind,
          description:
            typeof props.description === "string" ? props.description : null,
          confidence:
            typeof props.confidence === "number" ? props.confidence : null,
          createdAt: row.created?.toISOString() ?? null,
        };
      });

      return { entities };
    }),

  entityGet: authedProcedure
    .input(
      z.object({
        entityId: z.string().min(1),
        resource: z.string().min(1).default("default"),
      })
    )
    .query(async ({ input }) => {
      // Get the entity node
      const [node] = await db
        .select()
        .from(memoryNodes)
        .where(
          and(
            eq(memoryNodes.id, input.entityId),
            eq(memoryNodes.resource, input.resource)
          )
        )
        .limit(1);

      if (!node) {
        return null;
      }

      const props = asProps(node.properties);

      // Get related facts (edges from this node)
      const outgoingEdges = await db
        .select()
        .from(memoryEdges)
        .where(
          and(
            eq(memoryEdges.fromId, input.entityId),
            eq(memoryEdges.resource, input.resource)
          )
        )
        .limit(20);

      // Get target nodes for edges
      const targetIds = outgoingEdges.map((e) => e.toId);
      const targetNodes =
        targetIds.length > 0
          ? await db
              .select()
              .from(memoryNodes)
              .where(inArray(memoryNodes.id, targetIds))
          : [];
      const targetMap = new Map(targetNodes.map((n) => [n.id, n]));

      const facts = outgoingEdges.map((edge) => {
        const target = targetMap.get(edge.toId);
        return {
          id: edge.id,
          predicate: edge.kind,
          object: target?.label ?? edge.toId,
          confidence: edge.weight ?? 1,
        };
      });

      // Get relations (all edges involving this node)
      const allEdges = await db
        .select()
        .from(memoryEdges)
        .where(
          and(
            eq(memoryEdges.resource, input.resource),
            or(
              eq(memoryEdges.fromId, input.entityId),
              eq(memoryEdges.toId, input.entityId)
            )
          )
        )
        .limit(30);

      const relationNodeIds = new Set<string>();
      for (const e of allEdges) {
        if (e.fromId !== input.entityId) relationNodeIds.add(e.fromId);
        if (e.toId !== input.entityId) relationNodeIds.add(e.toId);
      }

      const relationNodes =
        relationNodeIds.size > 0
          ? await db
              .select()
              .from(memoryNodes)
              .where(inArray(memoryNodes.id, Array.from(relationNodeIds)))
          : [];
      const relationMap = new Map(relationNodes.map((n) => [n.id, n]));

      const relations = allEdges
        .map((edge) => {
          const otherId =
            edge.fromId === input.entityId ? edge.toId : edge.fromId;
          const other = relationMap.get(otherId);
          return {
            id: edge.id,
            target: other?.label ?? otherId,
            type: edge.kind,
          };
        })
        .slice(0, 20);

      return {
        id: node.id,
        name: node.label,
        type: node.kind,
        description:
          typeof props.description === "string" ? props.description : null,
        facts,
        relations,
      };
    }),

  insightsList: authedProcedure
    .input(
      z.object({
        resource: z.string().min(1).default("default"),
        limit: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ input }) => {
      // Get node/edge counts for basic insights
      const [nodeCount] = await db
        .select({ count: count() })
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, input.resource));

      const [edgeCount] = await db
        .select({ count: count() })
        .from(memoryEdges)
        .where(eq(memoryEdges.resource, input.resource));

      // Get most connected nodes (entities with most edges)
      const topConnected = await db
        .select({
          nodeId: memoryEdges.fromId,
          edgeCount: count(),
        })
        .from(memoryEdges)
        .where(eq(memoryEdges.resource, input.resource))
        .groupBy(memoryEdges.fromId)
        .orderBy(desc(count()))
        .limit(5);

      // Get labels for top connected
      const topIds = topConnected.map((t) => t.nodeId);
      const topNodes =
        topIds.length > 0
          ? await db
              .select()
              .from(memoryNodes)
              .where(inArray(memoryNodes.id, topIds))
          : [];
      const nodeMap = new Map(topNodes.map((n) => [n.id, n.label]));

      // Generate insights
      const insights: Array<{
        id: string;
        type: "pattern" | "trend" | "suggestion";
        title: string;
        description: string;
        confidence: number;
      }> = [];

      // Cluster insight
      if (topConnected.length > 0) {
        const topEntity = nodeMap.get(topConnected[0]?.nodeId ?? "");
        if (topEntity) {
          insights.push({
            id: "insight-cluster",
            type: "pattern",
            title: "Central entity",
            description: `${topEntity} is a highly connected entity with ${topConnected[0]?.edgeCount} relations.`,
            confidence: 0.85,
          });
        }
      }

      // Graph size insight
      insights.push({
        id: "insight-size",
        type: "trend",
        title: "Knowledge graph size",
        description: `Graph contains ${nodeCount?.count ?? 0} entities and ${edgeCount?.count ?? 0} relations.`,
        confidence: 1.0,
      });

      // Suggestion insight (based on isolated nodes if any)
      if ((nodeCount?.count ?? 0) > (edgeCount?.count ?? 0)) {
        insights.push({
          id: "insight-suggest",
          type: "suggestion",
          title: "Disconnected entities",
          description:
            "Some entities may be isolated. Consider adding more relations to improve connectivity.",
          confidence: 0.7,
        });
      }

      return { insights: insights.slice(0, input.limit) };
    }),
});
