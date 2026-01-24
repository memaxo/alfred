import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { authedProcedure, router } from "../trpc";

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

const visualizeInputSchema = z.object({
  text: z.string().min(1).max(20_000),
  resource: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

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
      const { visualizeKnowledge } = await import("../services/knowledge");
      return await visualizeKnowledge({
        text: input.text,
        resource: input.resource,
        limit: input.limit,
        userId: ctx.session.user.id,
      });
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
      const q = input.search?.toLowerCase();
      const filteredRows = q
        ? rows.filter((row) => row.label.toLowerCase().includes(q))
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
        if (e.fromId !== input.entityId) {
          relationNodeIds.add(e.fromId);
        }
        if (e.toId !== input.entityId) {
          relationNodeIds.add(e.toId);
        }
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
