/**
 * Memory Search Tool
 *
 * Semantic search through memories using embeddings.
 * Enables the agent to find relevant memories by meaning, not just keywords.
 */

import { db } from "@alfred/db";
import { recordAccessBatch } from "@alfred/db/repo/graph/read";
import {
  cosineSimilarity,
  DEFAULT_MIN_SCORE,
  type ScoredResult,
} from "@alfred/db/repo/graph/scoring";
import { memoryNodes } from "@alfred/db/schema/graph";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  recordAssistantToolCall,
  recordMemorySearchLatency,
  recordMemorySearchResults,
  recordMemoryToolCall,
} from "../../../../src/metrics";
import { embedQuery, normalizeEmbedding } from "./embed";

const searchInputSchema = z.object({
  query: z.string().min(1).describe("Natural language search query"),
  resource: z
    .string()
    .optional()
    .describe("Scope filter (e.g., 'user', 'ontology')"),
  kind: z.string().optional().describe("Filter by node type"),
  topK: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum results to return (default: 10)"),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimum relevance score (default: 0.3)"),
});

type SearchInput = z.infer<typeof searchInputSchema>;

type MemorySearchResult = {
  id: string;
  label: string;
  kind: string;
  resource: string;
  score: number;
  confidence: number | null;
  accessCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export const toolMemorySearch = {
  name: "memory_search",
  description:
    "Search through memories using semantic similarity. Find relevant memories by meaning, not just keywords.",
  inputSchema: searchInputSchema,
  outputSchema: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.string(),
        resource: z.string(),
        score: z.number(),
        confidence: z.number().nullable(),
        accessCount: z.number(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
      })
    ),
    count: z.number(),
    query: z.string(),
  }),
  execute: async ({ input }: { input: SearchInput }) => {
    recordAssistantToolCall("memory_search");
    const startTime = Date.now();

    try {
      const topK = input.topK ?? 10;
      const minScore = input.minScore ?? DEFAULT_MIN_SCORE;

      // Embed the query
      const queryEmbedding = await embedQuery(input.query);

      // Build query conditions
      const conditions = [sql`${memoryNodes.embedding} IS NOT NULL`];

      if (input.resource) {
        conditions.push(eq(memoryNodes.resource, input.resource));
      }

      if (input.kind) {
        conditions.push(eq(memoryNodes.kind, input.kind));
      }

      // Exclude archived nodes
      conditions.push(sql`properties->>'archived' IS NULL`);

      // Query nodes with embeddings
      const nodes = await db
        .select()
        .from(memoryNodes)
        .where(and(...conditions))
        .limit(topK * 5); // Get more candidates for scoring

      // Score and rank by semantic similarity
      const scored: ScoredResult<(typeof nodes)[0]>[] = [];

      for (const node of nodes) {
        const nodeEmbedding = normalizeEmbedding(node.embedding);
        if (!nodeEmbedding) {
          continue;
        }

        const similarity = cosineSimilarity(queryEmbedding, nodeEmbedding);
        // Convert from [-1, 1] to [0, 1]
        const score = (similarity + 1) / 2;

        if (score >= minScore) {
          scored.push({
            item: node,
            score,
            matchType: "semantic",
          });
        }
      }

      // Sort by score and take top K
      scored.sort((a, b) => b.score - a.score);
      const topResults = scored.slice(0, topK);

      // Record access for retrieved nodes
      const nodeIds = topResults.map((r) => r.item.id);
      if (nodeIds.length > 0) {
        await recordAccessBatch(nodeIds).catch(() => {
          // Non-fatal: don't fail search if access tracking fails
        });
      }

      // Format results
      const results: MemorySearchResult[] = topResults.map((r) => {
        const props = r.item.properties as Record<string, unknown> | null;
        const confidence =
          props && typeof props.confidence === "number"
            ? props.confidence
            : null;

        return {
          id: r.item.id,
          label: r.item.label,
          kind: r.item.kind,
          resource: r.item.resource,
          score: Math.round(r.score * 1000) / 1000, // Round to 3 decimals
          confidence,
          accessCount: r.item.accessCount ?? 0,
          createdAt: r.item.created?.toISOString() ?? null,
          updatedAt: r.item.updated?.toISOString() ?? null,
        };
      });

      // Record metrics
      const durationSeconds = (Date.now() - startTime) / 1000;
      recordMemorySearchLatency(durationSeconds);
      recordMemorySearchResults(results.length);
      recordMemoryToolCall("memory_search", "success");

      return {
        results,
        count: results.length,
        query: input.query,
      };
    } catch (error) {
      recordMemoryToolCall("memory_search", "error");
      throw error;
    }
  },
};

export type ToolMemorySearch = typeof toolMemorySearch;
