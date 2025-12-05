/**
 * Memory Stats Tool
 *
 * Get memory system statistics and health metrics.
 * Provides visibility into the knowledge graph state.
 */

import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemoryToolCall,
} from "../../../../src/metrics";

const statsInputSchema = z.object({
  resource: z.string().optional().describe("Filter by resource scope"),
  detailed: z
    .boolean()
    .optional()
    .describe("Include per-kind breakdown (default: false)"),
});

type StatsInput = z.infer<typeof statsInputSchema>;

type KindBreakdown = {
  kind: string;
  count: number;
  avgConfidence: number | null;
  avgAccessCount: number;
};

type ConfidenceDistribution = {
  high: number; // >= 0.8
  medium: number; // 0.5 - 0.8
  low: number; // 0.3 - 0.5
  veryLow: number; // < 0.3
};

export const toolMemoryStats = {
  name: "memory_stats",
  description:
    "Get memory system statistics including node counts, confidence distribution, and access patterns.",
  inputSchema: statsInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    stats: z.object({
      totalNodes: z.number(),
      totalEdges: z.number(),
      activeNodes: z.number(),
      archivedNodes: z.number(),
      nodesWithEmbeddings: z.number(),
      avgAccessCount: z.number(),
      confidenceDistribution: z.object({
        high: z.number(),
        medium: z.number(),
        low: z.number(),
        veryLow: z.number(),
      }),
      resourceBreakdown: z.record(z.string(), z.number()).optional(),
      kindBreakdown: z
        .array(
          z.object({
            kind: z.string(),
            count: z.number(),
            avgConfidence: z.number().nullable(),
            avgAccessCount: z.number(),
          })
        )
        .optional(),
    }),
    message: z.string(),
  }),
  execute: async ({ input }: { input: StatsInput }) => {
    recordAssistantToolCall("memory_stats");

    // Build base condition
    const conditions = [];
    if (input.resource) {
      conditions.push(eq(memoryNodes.resource, input.resource));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total nodes
    const [totalResult] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(whereClause);
    const totalNodes = totalResult?.count ?? 0;

    // Total edges
    const edgeConditions = input.resource
      ? [eq(memoryEdges.resource, input.resource)]
      : [];
    const [edgeResult] = await db
      .select({ count: count() })
      .from(memoryEdges)
      .where(edgeConditions.length > 0 ? and(...edgeConditions) : undefined);
    const totalEdges = edgeResult?.count ?? 0;

    // Active vs archived nodes
    const [activeResult] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(
        and(
          ...(conditions.length > 0 ? conditions : [sql`1=1`]),
          sql`properties->>'archived' IS NULL`
        )
      );
    const activeNodes = activeResult?.count ?? 0;
    const archivedNodes = totalNodes - activeNodes;

    // Nodes with embeddings
    const [embeddingResult] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(
        and(
          ...(conditions.length > 0 ? conditions : [sql`1=1`]),
          sql`${memoryNodes.embedding} IS NOT NULL`
        )
      );
    const nodesWithEmbeddings = embeddingResult?.count ?? 0;

    // Average access count
    const [accessResult] = await db
      .select({
        avg: sql<number>`COALESCE(AVG(${memoryNodes.accessCount}), 0)`,
      })
      .from(memoryNodes)
      .where(whereClause);
    const avgAccessCount = Math.round((accessResult?.avg ?? 0) * 100) / 100;

    // Confidence distribution
    const confidenceDistribution: ConfidenceDistribution = {
      high: 0,
      medium: 0,
      low: 0,
      veryLow: 0,
    };

    // High confidence (>= 0.8)
    const [highConf] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(
        and(
          ...(conditions.length > 0 ? conditions : [sql`1=1`]),
          sql`(properties->>'confidence')::numeric >= 0.8`
        )
      );
    confidenceDistribution.high = highConf?.count ?? 0;

    // Medium confidence (0.5 - 0.8)
    const [medConf] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(
        and(
          ...(conditions.length > 0 ? conditions : [sql`1=1`]),
          sql`(properties->>'confidence')::numeric >= 0.5 AND (properties->>'confidence')::numeric < 0.8`
        )
      );
    confidenceDistribution.medium = medConf?.count ?? 0;

    // Low confidence (0.3 - 0.5)
    const [lowConf] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(
        and(
          ...(conditions.length > 0 ? conditions : [sql`1=1`]),
          sql`(properties->>'confidence')::numeric >= 0.3 AND (properties->>'confidence')::numeric < 0.5`
        )
      );
    confidenceDistribution.low = lowConf?.count ?? 0;

    // Very low confidence (< 0.3)
    const [veryLowConf] = await db
      .select({ count: count() })
      .from(memoryNodes)
      .where(
        and(
          ...(conditions.length > 0 ? conditions : [sql`1=1`]),
          sql`(properties->>'confidence')::numeric < 0.3`
        )
      );
    confidenceDistribution.veryLow = veryLowConf?.count ?? 0;

    // Optional detailed breakdowns
    let resourceBreakdown: Record<string, number> | undefined;
    let kindBreakdown: KindBreakdown[] | undefined;

    if (input.detailed) {
      // Resource breakdown
      const resourceResults = await db
        .select({
          resource: memoryNodes.resource,
          count: count(),
        })
        .from(memoryNodes)
        .where(whereClause)
        .groupBy(memoryNodes.resource);

      resourceBreakdown = {};
      for (const r of resourceResults) {
        resourceBreakdown[r.resource] = r.count;
      }

      // Kind breakdown with averages
      const kindResults = await db
        .select({
          kind: memoryNodes.kind,
          count: count(),
          avgAccess: sql<number>`COALESCE(AVG(${memoryNodes.accessCount}), 0)`,
          avgConfidence: sql<number | null>`AVG(
            CASE 
              WHEN properties ? 'confidence' 
               AND (properties->>'confidence') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (properties->>'confidence')::numeric 
              ELSE NULL 
            END
          )`,
        })
        .from(memoryNodes)
        .where(whereClause)
        .groupBy(memoryNodes.kind)
        .orderBy(sql`count(*) DESC`)
        .limit(20);

      kindBreakdown = kindResults.map((k) => ({
        kind: k.kind,
        count: k.count,
        avgConfidence:
          k.avgConfidence !== null
            ? Math.round(k.avgConfidence * 1000) / 1000
            : null,
        avgAccessCount: Math.round(k.avgAccess * 100) / 100,
      }));
    }

    recordMemoryToolCall("memory_stats", "success");

    return {
      success: true,
      stats: {
        totalNodes,
        totalEdges,
        activeNodes,
        archivedNodes,
        nodesWithEmbeddings,
        avgAccessCount,
        confidenceDistribution,
        resourceBreakdown,
        kindBreakdown,
      },
      message: input.resource
        ? `Stats for resource: ${input.resource}`
        : "Global memory statistics",
    };
  },
};

export type ToolMemoryStats = typeof toolMemoryStats;
