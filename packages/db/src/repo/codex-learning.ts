import { db } from "../client.js";
import { memoryEdges, memoryNodes } from "../schema/graph.js";
import { and, desc, eq, inArray } from "drizzle-orm";

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
        eq(memoryNodes.resource, resource)
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
    const labelLower = node.label.toLowerCase();
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
        eq(memoryNodes.kind, "reasoning")
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
  // Find heuristic nodes.
  // Ideally, we'd use vector search here (embedding match on requirement).
  // For this MVP, we'll match keywords in the label/rule against the requirement.
  
  const heuristics = await db
    .select()
    .from(memoryNodes)
    .where(eq(memoryNodes.kind, "heuristic"))
    .orderBy(desc(memoryNodes.created)) // Newest first
    .limit(limit * 5); 

  const results: Array<{ rule: string; confidence: number; score: number }> = [];

  const reqLower = requirement.toLowerCase();
  const keywords = reqLower.split(/\s+/).filter(w => w.length > 3);

  for (const node of heuristics) {
    const props = node.properties as Record<string, any> || {};
    const rule = typeof props.rule === 'string' ? props.rule : node.label;
    const confidence = typeof props.confidence === 'number' ? props.confidence : 0.5;
    const context = typeof props.context === 'string' ? props.context.toLowerCase() : "";

    // Scoring: 
    // 1. Match context (if heuristic has a 'context' field like 'python', 'db', etc.)
    // 2. Match keywords in the rule itself
    
    let matches = 0;
    for (const k of keywords) {
      if (rule.toLowerCase().includes(k) || context.includes(k)) {
        matches++;
      }
    }

    const score = matches / Math.max(1, keywords.length);
    
    if (score > 0.1) { // Threshold
      results.push({ rule, confidence, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => ({ rule: r.rule, confidence: r.confidence }));
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
    const rules = heuristics.map(h => `- ${h.rule}`).join("\n");
    const section = `[Intuition / Heuristics]
Based on past failures, keep these rules in mind:
${rules}`;
    sections.push(section);
    tokenEstimate += Math.ceil(section.length / 4);
  }

  // 2. Inject Similar Executions
  for (const task of similar) {
    if (!task.result) {
      continue;
    }

    const snippet = task.result.substring(0, 500);
    const section = `[Similar Task - ${task.auto ?? "unknown"} autonomy]
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

  return `[Past Execution Context]
The following are summaries of similar past Codex executions in this repository:

${sections.join("\n\n")}

[End Past Context]
`;
}
