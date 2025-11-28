import { randomBytes } from "node:crypto";
import { metricsRegistry } from "@alfred/metrics/registry";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import client from "prom-client";
import { db } from "../client.js";
import { memoryEdges, memoryNodes } from "../schema/graph.js";
import { sanitizeContextText } from "./sanitize.js";

export { sanitizeContextText } from "./sanitize.js";

const ensureHistogram = (config: client.HistogramConfiguration<string>) => {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Histogram<string>;
  }
  return new client.Histogram(config);
};

const heuristicsQueryDurationSeconds = ensureHistogram({
  name: "codex_heuristics_query_duration_seconds",
  help: "Duration of Codex heuristic fetches grouped by strategy.",
  labelNames: ["strategy"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

const HEURISTICS_CACHE_TTL_MS = 30_000;
const HEURISTICS_CACHE_MAX_ENTRIES = 64;
const MIN_KEYWORD_LENGTH = 3;
const KEYWORD_SCORE_THRESHOLD = 0.15;
const FALLBACK_FETCH_MULTIPLIER = 2;

type HeuristicCandidate = {
  rule: string;
  confidence: number;
  score: number;
};

type RankedHeuristicRow = {
  label: string;
  properties: Record<string, unknown> | null;
  createdAt: Date | null;
  rankScore: number | string | null;
};

type KeywordHeuristicRow = {
  label: string;
  properties: Record<string, unknown> | null;
  createdAt: Date | null;
};

const heuristicsCache = new Map<
  string,
  { expiresAt: number; data: Array<{ rule: string; confidence: number }> }
>();

// type NodeRow = typeof memoryNodes.$inferSelect;
// type EdgeRow = typeof memoryEdges.$inferSelect;

export type SimilarTaskResult = {
  nodeId: string;
  sessionId: string | null;
  threadId: string | null;
  auto: string | null;
  result: string | null;
  createdAt: Date | null;
  similarity: number;
};

/**
 * Query the graph for similar past Codex executions
 * Returns execution nodes with metadata for context injection
 */
export async function findSimilarCodexExecutions(
  resource: string,
  requirement: string,
  limit = 5
): Promise<SimilarTaskResult[]> {
  // Find codex_execution nodes in the same resource
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
    .limit(limit * 3); // Fetch more for filtering

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

    // Simple similarity: check if node label contains requirement keywords
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
        nodeId: node.id,
        sessionId,
        threadId,
        auto,
        result,
        createdAt: node.created ?? null,
        similarity,
      });
    }
  }

  // Sort by similarity desc, then by recency
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
 * Get reasoning traces for a Codex execution
 * Returns reasoning nodes linked to the execution
 */
export async function getCodexExecutionReasoning(
  executionNodeId: string
): Promise<Array<{ text: string; timestamp: number }>> {
  // Find reasoning nodes via edges from execution node
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
 * Find heuristics (intuitions) applicable to the current task
 */
export async function findHeuristics(
  requirement: string,
  limit = 3
): Promise<Array<{ rule: string; confidence: number }>> {
  const normalized = normalizeReq(requirement);
  const safeLimit = Math.max(1, limit);
  const cacheKey = getCacheKey(normalized, safeLimit);
  const cached = getCachedHeuristics(cacheKey);

  if (cached) {
    return cached.slice(0, safeLimit);
  }

  const picks = new Map<string, HeuristicCandidate>();
  const keywords = extractKeywords(normalized);

  if (normalized.length > 0) {
    const ftsPicks = await queryFtsHeuristics(normalized, safeLimit * 2);
    for (const pick of ftsPicks) {
      upsertPick(picks, pick);
    }
  }

  const remaining = Math.max(0, safeLimit - picks.size);
  if (remaining > 0) {
    const keywordPicks = await keywordFallback(keywords, remaining);
    for (const pick of keywordPicks) {
      upsertPick(picks, pick);
      if (picks.size >= safeLimit * 2) {
        break;
      }
    }
  }

  const sorted = Array.from(picks.values()).sort((a, b) => b.score - a.score);
  const topPicks = sorted
    .slice(0, safeLimit)
    .map(({ rule, confidence }) => ({ rule, confidence }));

  setCacheEntry(cacheKey, topPicks);

  return topPicks;
}

function startQueryTimer(strategy: "fts" | "keyword"): (() => void) | null {
  try {
    return heuristicsQueryDurationSeconds.startTimer({ strategy });
  } catch {
    return null;
  }
}

async function queryFtsHeuristics(
  searchText: string,
  desired: number
): Promise<HeuristicCandidate[]> {
  const fetchAmount = Math.max(1, desired);
  const stopTimer = startQueryTimer("fts");

  try {
    const query = sql<RankedHeuristicRow>`
      WITH search AS (
        SELECT plainto_tsquery('english', ${searchText}) AS query
      )
      SELECT
        mn.label,
        mn.properties,
        mn.created_at AS "createdAt",
        ts_rank(mn.label_tsvector, search.query) +
        ts_rank(to_tsvector('english', COALESCE(mn.properties->>'rule', '')), search.query)
          AS "rankScore"
      FROM memory_nodes mn,
        search
      WHERE mn.kind = 'heuristic'
        AND mn.sanitized = true
        AND (
          mn.label_tsvector @@ search.query
          OR to_tsvector('english', COALESCE(mn.properties->>'rule', '')) @@ search.query
        )
      ORDER BY "rankScore" DESC NULLS LAST, mn.created_at DESC NULLS LAST
      LIMIT ${fetchAmount * 2}
    `;

    const result = await db.execute(query);
    const rows = (result.rows ?? []) as RankedHeuristicRow[];

    return rows
      .map((row) => buildFtsPick(row))
      .filter((pick): pick is HeuristicCandidate => Boolean(pick))
      .slice(0, fetchAmount * 2);
  } finally {
    stopTimer?.();
  }
}

async function keywordFallback(
  keywords: string[],
  desired: number
): Promise<HeuristicCandidate[]> {
  const fetchAmount = Math.max(1, desired * FALLBACK_FETCH_MULTIPLIER);
  const stopTimer = startQueryTimer("keyword");

  try {
    const nodes = await db
      .select({
        label: memoryNodes.label,
        properties: memoryNodes.properties,
        createdAt: memoryNodes.created,
      })
      .from(memoryNodes)
      .where(
        and(eq(memoryNodes.kind, "heuristic"), eq(memoryNodes.sanitized, true))
      )
      .orderBy(desc(memoryNodes.created))
      .limit(fetchAmount);

    const denom = keywords.length === 0 ? 1 : keywords.length;
    const picks: HeuristicCandidate[] = [];

    for (const node of nodes as KeywordHeuristicRow[]) {
      const pick = buildKeywordPick(node, keywords, denom);
      if (!pick) {
        continue;
      }
      picks.push(pick);
      if (picks.length >= desired) {
        break;
      }
    }

    return picks;
  } finally {
    stopTimer?.();
  }
}

function buildFtsPick(row: RankedHeuristicRow): HeuristicCandidate | null {
  const props = (row.properties as Record<string, unknown>) ?? {};
  const rule = typeof props.rule === "string" ? props.rule : row.label;
  if (!rule) {
    return null;
  }

  const confidence =
    typeof props.confidence === "number" ? props.confidence : 0.5;
  const rawScore =
    typeof row.rankScore === "number"
      ? row.rankScore
      : typeof row.rankScore === "string"
        ? Number(row.rankScore)
        : 0;
  const recencyBoost = row.createdAt
    ? Math.max(0, 1 - (Date.now() - row.createdAt.getTime()) / 86_400_000) * 0.1
    : 0;

  return {
    rule,
    confidence,
    score: rawScore + recencyBoost,
  };
}

function buildKeywordPick(
  row: KeywordHeuristicRow,
  keywords: string[],
  denom: number
): HeuristicCandidate | null {
  const props = (row.properties as Record<string, unknown>) ?? {};
  const rule = typeof props.rule === "string" ? props.rule : row.label;
  if (!rule) {
    return null;
  }

  const confidence =
    typeof props.confidence === "number" ? props.confidence : 0.5;
  const context =
    typeof props.context === "string" ? props.context.toLowerCase() : "";
  const baselineScore =
    keywords.length === 0
      ? 0.1
      : countKeywordMatches(rule, context, keywords) / Math.max(1, denom);

  if (keywords.length > 0 && baselineScore < KEYWORD_SCORE_THRESHOLD) {
    return null;
  }

  const recencyBoost = row.createdAt
    ? Math.max(0, 1 - (Date.now() - row.createdAt.getTime()) / 604_800_000) *
      0.05
    : 0;

  return {
    rule,
    confidence,
    score: baselineScore + recencyBoost,
  };
}

function countKeywordMatches(
  rule: string,
  context: string,
  keywords: string[]
): number {
  if (keywords.length === 0) {
    return 1;
  }

  const ruleLower = rule.toLowerCase();
  let matches = 0;

  for (const keyword of keywords) {
    if (ruleLower.includes(keyword) || context.includes(keyword)) {
      matches++;
    }
  }

  return matches;
}

function upsertPick(
  picks: Map<string, HeuristicCandidate>,
  pick: HeuristicCandidate
) {
  const key = pick.rule.toLowerCase();
  const existing = picks.get(key);
  if (!existing || pick.score > existing.score) {
    picks.set(key, pick);
  }
}

function normalizeReq(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function extractKeywords(input: string): string[] {
  if (!input) {
    return [];
  }

  return input
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter((word) => word.length >= MIN_KEYWORD_LENGTH);
}

function getCacheKey(requirement: string, limit: number): string {
  return `${limit}:${requirement}`;
}

function getCachedHeuristics(
  key: string
): Array<{ rule: string; confidence: number }> | null {
  const cached = heuristicsCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt < Date.now()) {
    heuristicsCache.delete(key);
    return null;
  }
  return cached.data.map((item) => ({ ...item }));
}

function setCacheEntry(
  key: string,
  data: Array<{ rule: string; confidence: number }>
) {
  heuristicsCache.set(key, {
    expiresAt: Date.now() + HEURISTICS_CACHE_TTL_MS,
    data: data.map((item) => ({ ...item })),
  });

  if (heuristicsCache.size > HEURISTICS_CACHE_MAX_ENTRIES) {
    const firstKey = heuristicsCache.keys().next().value;
    if (firstKey) {
      heuristicsCache.delete(firstKey);
    }
  }
}

/**
 * Build context from similar past tasks for prompt injection
 */
export async function buildCodexLearningContext(
  resource: string,
  requirement: string,
  maxTokens = 2000
): Promise<string | null> {
  const similar = await findSimilarCodexExecutions(resource, requirement, 3);
  const heuristics = await findHeuristics(requirement, 3);

  if (similar.length === 0 && heuristics.length === 0) {
    return null;
  }

  const sections: string[] = [];
  let tokenEstimate = 0;

  // 1. Inject Heuristics (Intuitions) - High Priority
  if (heuristics.length > 0) {
    const rules = heuristics
      .map((h) => sanitizeContextText(h.rule))
      .filter((rule) => rule.length > 0)
      .map((rule) => `- ${rule}`)
      .join("\n");

    if (rules) {
      const section = `[Intuition / Heuristics]
Based on past failures, keep these rules in mind:
${rules}`;
      sections.push(section);
      tokenEstimate += Math.ceil(section.length / 4);
    }
  }

  // 2. Inject Similar Executions
  for (const task of similar) {
    if (!task.result) {
      continue;
    }

    const snippet = sanitizeContextText(task.result.substring(0, 500));
    if (!snippet) {
      continue;
    }

    const autoLabel = sanitizeContextText(task.auto ?? "unknown") || "unknown";
    const section = `[Similar Task - ${autoLabel} autonomy]
${snippet}${task.result.length > 500 ? "..." : ""}`;

    const sectionTokens = Math.ceil(section.length / 4); // Rough estimate
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

  return `${startDelim}
The following are summaries of similar past Codex executions in this repository:

${sections.join("\n\n")}

${endDelim}
`;
}
