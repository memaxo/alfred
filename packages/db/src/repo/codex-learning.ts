import { logger } from "@alfred/logger";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

import { db } from "../client.js";
import { memoryEdges, memoryNodes } from "../schema/graph.js";
import { sanitizeContextText } from "./sanitize.js";

export { sanitizeContextText } from "./sanitize.js";

export interface SimilarTaskResult {
  nodeId: string;
  sessionId: string | null;
  threadId: string | null;
  auto: string | null;
  result: string | null;
  createdAt: Date | null;
  similarity: number;
}

export interface HeuristicResult {
  nodeId: string;
  rule: string | null;
  severity: string | null;
  domain: string | null;
  createdAt: Date | null;
  similarity: number;
}

/**
 * Query the graph for similar past Codex executions.
 * Returns execution nodes with metadata for context injection.
 */
export async function findSimilarCodexExecutions(
  resource: string,
  requirement: string,
  limit = 5
): Promise<SimilarTaskResult[]> {
  const executions = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        eq(memoryNodes.kind, "codex_execution"),
        eq(memoryNodes.resource, resource),
        eq(memoryNodes.sanitized, true)
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit * 3);

  const results: SimilarTaskResult[] = [];

  for (const node of executions) {
    const props = node.properties as Record<string, unknown> | null;
    if (!props) {
      continue;
    }

    const sessionId =
      typeof props.sessionId === "string" ? props.sessionId : null;
    const threadId = typeof props.threadId === "string" ? props.threadId : null;
    const auto = typeof props.auto === "string" ? props.auto : null;
    const result = typeof props.result === "string" ? props.result : null;

    // NOTE: This is intentionally cheap. Semantic similarity is handled elsewhere.
    const keywords = requirement
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3);
    const labelLower = sanitizeContextText(node.label).toLowerCase();
    const matchCount = keywords.filter((keyword) =>
      labelLower.includes(keyword)
    ).length;
    const similarity = keywords.length > 0 ? matchCount / keywords.length : 0;

    if (similarity > 0) {
      results.push({
        auto,
        createdAt: node.created ?? null,
        nodeId: node.id,
        result,
        sessionId,
        similarity,
        threadId,
      });
    }
  }

  results.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return results.slice(0, limit);
}

/**
 * Query user-scoped heuristic nodes ("dreaming" + explicit mistakes) for cheap keyword overlap.
 */
export async function findRelevantHeuristics(
  requirement: string,
  limit = 5
): Promise<HeuristicResult[]> {
  const heuristics = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        eq(memoryNodes.kind, "heuristic"),
        eq(memoryNodes.resource, "user"),
        eq(memoryNodes.sanitized, true)
      )
    )
    .orderBy(desc(memoryNodes.created))
    .limit(limit * 4);

  if (heuristics.length === 0) {
    return [];
  }

  const keywords = requirement
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const results: HeuristicResult[] = [];
  for (const node of heuristics) {
    const props = node.properties as Record<string, unknown> | null;
    const rule = typeof props?.rule === "string" ? props.rule : null;
    const severity =
      typeof props?.severity === "string" ? props.severity : null;
    const domain = typeof props?.domain === "string" ? props.domain : null;

    const corpus = sanitizeContextText(
      `${node.label}\n${rule ?? ""}`.trim()
    ).toLowerCase();
    const matchCount = keywords.filter((keyword) =>
      corpus.includes(keyword)
    ).length;
    const similarity = keywords.length > 0 ? matchCount / keywords.length : 0;

    if (similarity > 0) {
      results.push({
        createdAt: node.created ?? null,
        domain,
        nodeId: node.id,
        rule,
        severity,
        similarity,
      });
    }
  }

  results.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return results.slice(0, limit);
}

/**
 * Get reasoning traces for a Codex execution.
 * Returns reasoning nodes linked to the execution.
 */
export async function getCodexExecutionReasoning(
  executionNodeId: string
): Promise<{ text: string; timestamp: number }[]> {
  const edges = await db
    .select()
    .from(memoryEdges)
    .where(
      and(
        eq(memoryEdges.fromId, executionNodeId),
        eq(memoryEdges.kind, "has_reasoning")
      )
    )
    .orderBy(desc(memoryEdges.created));

  if (edges.length === 0) {
    return [];
  }

  const reasoningIds = edges.map((edge) => edge.toId);
  const reasoningNodes = await db
    .select()
    .from(memoryNodes)
    .where(
      and(
        inArray(memoryNodes.id, reasoningIds),
        eq(memoryNodes.kind, "reasoning"),
        eq(memoryNodes.sanitized, true)
      )
    )
    .orderBy(desc(memoryNodes.created));

  return reasoningNodes.map((node) => {
    const props = node.properties as Record<string, unknown> | null;
    const createdAt = node.created ?? new Date();
    const timestamp =
      typeof props?.timestamp === "number"
        ? props.timestamp
        : createdAt.getTime();
    return {
      text: node.label,
      timestamp,
    };
  });
}

/**
 * Build prompt injection context from similar past Codex executions.
 */
export async function buildCodexLearningContext(
  resource: string,
  requirement: string,
  maxTokens = 2000
): Promise<string | null> {
  const similar = await findSimilarCodexExecutions(resource, requirement, 3);

  if (similar.length === 0) {
    return null;
  }

  const sections: string[] = [];
  let tokenEstimate = 0;

  for (const task of similar) {
    if (!task.result) {
      continue;
    }

    const snippet = sanitizeContextText(task.result.slice(0, 500));
    if (!snippet) {
      continue;
    }

    const autoLabel = sanitizeContextText(task.auto ?? "unknown") || "unknown";
    const section = `[Similar Task - ${autoLabel} autonomy]\n${snippet}${
      task.result.length > 500 ? "..." : ""
    }`;

    const sectionTokens = Math.ceil(section.length / 4);
    if (tokenEstimate + sectionTokens > maxTokens) {
      break;
    }

    sections.push(section);
    tokenEstimate += sectionTokens;
  }

  if (sections.length === 0) {
    return null;
  }

  const token = randomBytes(8).toString("hex");
  const startDelim = `<!-- CONTEXT_START_${token} -->`;
  const endDelim = `<!-- CONTEXT_END_${token} -->`;

  return `${startDelim}\nThe following are summaries of similar past Codex executions in this repository:\n\n${sections.join(
    "\n\n"
  )}\n\n${endDelim}\n`;
}

/**
 * Build prompt injection context from user-scoped heuristics ("dreaming" + explicit mistakes).
 */
export async function buildCodexHeuristicContext(
  requirement: string,
  maxTokens = 1200
): Promise<string | null> {
  const similar = await findRelevantHeuristics(requirement, 5);

  if (similar.length === 0) {
    return null;
  }

  const sections: string[] = [];
  let tokenEstimate = 0;

  for (const entry of similar) {
    const snippet = sanitizeContextText((entry.rule ?? "").slice(0, 500));
    if (!snippet) {
      continue;
    }

    const severity =
      sanitizeContextText(entry.severity ?? "medium") || "medium";
    const domain =
      sanitizeContextText(entry.domain ?? "workflow") || "workflow";
    const section = `[Heuristic - ${severity} severity, ${domain}]\n${snippet}${
      (entry.rule?.length ?? 0) > 500 ? "..." : ""
    }`;

    const sectionTokens = Math.ceil(section.length / 4);
    if (tokenEstimate + sectionTokens > maxTokens) {
      break;
    }

    sections.push(section);
    tokenEstimate += sectionTokens;
  }

  if (sections.length === 0) {
    return null;
  }

  const token = randomBytes(8).toString("hex");
  const startDelim = `<!-- CONTEXT_START_${token} -->`;
  const endDelim = `<!-- CONTEXT_END_${token} -->`;

  return `${startDelim}\nThe following are user-scoped heuristics learned from past failures and corrections:\n\n${sections.join(
    "\n\n"
  )}\n\n${endDelim}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic Creation with Provenance (Enrichment System)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Input for creating a heuristic from a failure.
 */
export interface CreateHeuristicInput {
  /** The rule/heuristic text */
  rule: string;
  /** Domain category (e.g., "filesystem", "database", "testing") */
  domain: string;
  /** Severity level */
  severity: "low" | "medium" | "high";
  /** Run ID where the failure occurred */
  sourceRunId: string;
  /** Task ID where the failure occurred */
  sourceTaskId: string;
  /** The error that led to this heuristic */
  sourceError?: string;
  /** The failure status that triggered creation */
  sourceStatus?: string;
}

/**
 * Create a heuristic node with full provenance tracking.
 *
 * This allows tracing back from a heuristic to the original failure
 * that generated it, enabling:
 * - Understanding why a rule exists
 * - Evaluating if the rule is still relevant
 * - Connecting improvements back to failures
 */
export async function createHeuristicFromFailure(
  input: CreateHeuristicInput
): Promise<string> {
  const hash = createHash("sha256")
    .update(
      `heuristic:${input.sourceRunId}:${input.sourceTaskId}:${input.rule}`
    )
    .digest("hex");

  const result = await db
    .insert(memoryNodes)
    .values({
      hash,
      kind: "heuristic",
      label: sanitizeContextText(input.rule.slice(0, 200)),
      properties: {
        rule: input.rule,
        severity: input.severity,
        domain: input.domain,
        // Provenance fields
        sourceRunId: input.sourceRunId,
        sourceTaskId: input.sourceTaskId,
        sourceError: input.sourceError,
        sourceStatus: input.sourceStatus,
        createdBy: "enrichment_system",
      },
      resource: "user",
      sanitized: true,
    })
    .returning({ id: memoryNodes.id });

  const node = result[0];
  if (!node) {
    throw new Error("Failed to create heuristic node");
  }
  return node.id;
}

/**
 * Find heuristics that were created from a specific run.
 */
export async function findHeuristicsBySourceRun(
  sourceRunId: string
): Promise<HeuristicResult[]> {
  const heuristics = await db
    .select()
    .from(memoryNodes)
    .where(
      and(eq(memoryNodes.kind, "heuristic"), eq(memoryNodes.sanitized, true))
    )
    .orderBy(desc(memoryNodes.created));

  return heuristics
    .filter((node) => {
      const props = node.properties as Record<string, unknown> | null;
      return props?.sourceRunId === sourceRunId;
    })
    .map((node) => {
      const props = node.properties as Record<string, unknown> | null;
      return {
        createdAt: node.created ?? null,
        domain: typeof props?.domain === "string" ? props.domain : null,
        nodeId: node.id,
        rule: typeof props?.rule === "string" ? props.rule : null,
        severity: typeof props?.severity === "string" ? props.severity : null,
        similarity: 1.0,
      };
    });
}

/**
 * Record a codex execution for future similarity matching.
 */
export async function recordCodexExecution(
  resource: string,
  requirement: string,
  result: string,
  metadata: {
    sessionId?: string;
    threadId?: string;
    auto?: string;
    runId?: string;
    taskId?: string;
  }
): Promise<string> {
  const hash = createHash("sha256")
    .update(`codex:${resource}:${requirement}:${Date.now()}`)
    .digest("hex");

  const insertResult = await db
    .insert(memoryNodes)
    .values({
      hash,
      kind: "codex_execution",
      label: sanitizeContextText(requirement.slice(0, 200)),
      properties: {
        ...metadata,
        result: sanitizeContextText(result),
      },
      resource,
      sanitized: false, // Will be sanitized by background job
    })
    .returning({ id: memoryNodes.id });

  const node = insertResult[0];
  if (!node) {
    throw new Error("Failed to record codex execution");
  }
  return node.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Embedding-Based Similarity Search (Enrichment System)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find similar codex executions using embedding similarity (pgvector).
 *
 * Uses cosine distance via pgvector's <=> operator for fast similarity search.
 * Falls back to keyword-based search if embeddings are unavailable.
 *
 * @param resource Resource identifier for scoping
 * @param embedding Pre-computed embedding vector for the requirement
 * @param limit Maximum results to return
 * @returns Similar executions ordered by similarity
 */
export async function findSimilarByEmbedding(
  resource: string,
  embedding: number[],
  limit = 5
): Promise<SimilarTaskResult[]> {
  if (!embedding || embedding.length === 0) {
    logger.warn("findSimilarByEmbedding called without embedding");
    return [];
  }

  try {
    // Format embedding as pgvector array expression
    const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;

    const results = await db
      .select({
        created: memoryNodes.created,
        id: memoryNodes.id,
        label: memoryNodes.label,
        properties: memoryNodes.properties,
        similarity: sql<number>`1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)`,
      })
      .from(memoryNodes)
      .where(
        and(
          eq(memoryNodes.kind, "codex_execution"),
          eq(memoryNodes.resource, resource),
          eq(memoryNodes.sanitized, true),
          isNotNull(memoryNodes.embedding)
        )
      )
      .orderBy(sql`embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC`)
      .limit(limit);

    return results.map((row) => {
      const props = row.properties as Record<string, unknown> | null;
      return {
        auto: typeof props?.auto === "string" ? props.auto : null,
        createdAt: row.created ?? null,
        nodeId: row.id,
        result: typeof props?.result === "string" ? props.result : null,
        sessionId:
          typeof props?.sessionId === "string" ? props.sessionId : null,
        similarity: row.similarity ?? 0,
        threadId: typeof props?.threadId === "string" ? props.threadId : null,
      };
    });
  } catch (error) {
    logger.warn("embedding_similarity_search_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Find similar executions using embedding if available, with keyword fallback.
 *
 * This is the preferred method for enrichment queries as it:
 * 1. Tries embedding similarity first (more accurate)
 * 2. Falls back to keyword matching if embeddings unavailable
 */
export async function findSimilarWithFallback(
  resource: string,
  requirement: string,
  embedding: number[] | null,
  limit = 5
): Promise<SimilarTaskResult[]> {
  // Try embedding-based search if we have an embedding
  if (embedding && embedding.length > 0) {
    const embeddingResults = await findSimilarByEmbedding(
      resource,
      embedding,
      limit
    );

    if (embeddingResults.length > 0) {
      return embeddingResults;
    }

    // Fall through to keyword if embedding search returned nothing
    logger.info("embedding_search_empty_fallback_to_keyword", { resource });
  }

  // Fallback to keyword-based search
  return findSimilarCodexExecutions(resource, requirement, limit);
}
