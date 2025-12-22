import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../client.js";
import { memoryEdges, memoryNodes } from "../schema/graph.js";
import { sanitizeContextText } from "./sanitize.js";

export { sanitizeContextText } from "./sanitize.js";

export type SimilarTaskResult = {
  nodeId: string;
  sessionId: string | null;
  threadId: string | null;
  auto: string | null;
  result: string | null;
  createdAt: Date | null;
  similarity: number;
};

export type HeuristicResult = {
  nodeId: string;
  rule: string | null;
  severity: string | null;
  domain: string | null;
  createdAt: Date | null;
  similarity: number;
};

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
    const matchCount = keywords.filter((keyword) => labelLower.includes(keyword))
      .length;
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
    const matchCount = keywords.filter((keyword) => corpus.includes(keyword))
      .length;
    const similarity = keywords.length > 0 ? matchCount / keywords.length : 0;

    if (similarity > 0) {
      results.push({
        nodeId: node.id,
        rule,
        severity,
        domain,
        createdAt: node.created ?? null,
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
): Promise<Array<{ text: string; timestamp: number }>> {
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
      typeof props?.timestamp === "number" ? props.timestamp : createdAt.getTime();
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

    const snippet = sanitizeContextText(task.result.substring(0, 500));
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
    const snippet = sanitizeContextText((entry.rule ?? "").substring(0, 500));
    if (!snippet) {
      continue;
    }

    const severity = sanitizeContextText(entry.severity ?? "medium") || "medium";
    const domain = sanitizeContextText(entry.domain ?? "workflow") || "workflow";
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
