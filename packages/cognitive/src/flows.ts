import type { Hypergraph, NodeId } from "@alfred/knowledge";
import type {
  CaptureResult,
  CognitiveConfidence,
  ExecutionPlan,
  ExecutionResult,
  ReflectionResult,
  SynthesisContradiction,
  SynthesisResult,
} from "@alfred/type/cognitive";
import type {
  KnowledgeConfidence,
  KnowledgeFact,
  KnowledgeInsight,
  KnowledgeRelation,
  KnowledgeUpdate,
} from "@alfred/type/knowledge";

import { cosineSimilarity } from "@alfred/embed";
import {
  detectContradiction,
  extractReasoning,
} from "@alfred/knowledge/extractor";
import { embed } from "@alfred/rag";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const cognitiveConfidence = (value: number) =>
  clamp(value) as CognitiveConfidence;
const knowledgeConfidence = (value: number) =>
  clamp(value) as KnowledgeConfidence;

const SEMANTIC_SIMILARITY_THRESHOLD = 0.7;
const MIN_LEXICAL_SIMILARITY = 0.3;
const MAX_LEXICAL_RELATIONS = 3;

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "for",
  "nor",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "with",
  "about",
  "from",
]);

const relationKey = (from: string, to: string, kind: string) =>
  `${from}:${to}:${kind}`;

const makeInsightId = () =>
  `insight-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));

const lexicalSimilarity = (a: string, b: string): number => {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap++;
    }
  }
  const maxSize = Math.max(tokensA.size, tokensB.size);
  return overlap / maxSize;
};

/** Convert Float32Array to number[] for cosineSimilarity */
const toNumberArray = (arr: Float32Array): number[] => [...arr];

const embedFact = async (content: string): Promise<Float32Array | null> => {
  const normalized = content.trim();
  if (!normalized) {
    return null;
  }
  try {
    const vector = await embed(normalized);
    if (!Array.isArray(vector) || vector.length === 0) {
      return null;
    }
    return Float32Array.from(vector);
  } catch {
    return null;
  }
};

interface EntityCluster {
  label: string;
  facts: KnowledgeFact[];
}

const extractEntityMentions = (fact: KnowledgeFact): string[] => {
  const mentions = new Set<string>();
  for (const tag of fact.tags ?? []) {
    const cleaned = tag.trim();
    if (cleaned.length > 2 && !STOP_WORDS.has(cleaned.toLowerCase())) {
      mentions.add(cleaned);
    }
  }
  const pattern = /\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(fact.content)) !== null) {
    const mention = match[1]?.trim();
    if (!mention) {
      continue;
    }
    const normalized = mention.toLowerCase();
    if (mention.length > 2 && !STOP_WORDS.has(normalized)) {
      mentions.add(mention);
    }
  }
  return [...mentions];
};

const groupByEntity = (facts: KnowledgeFact[]): Map<string, EntityCluster> => {
  const clusters = new Map<string, EntityCluster>();
  for (const fact of facts) {
    for (const mention of extractEntityMentions(fact)) {
      const key = mention.toLowerCase();
      if (STOP_WORDS.has(key)) {
        continue;
      }
      const cluster = clusters.get(key);
      if (cluster) {
        if (!cluster.facts.includes(fact)) {
          cluster.facts.push(fact);
        }
      } else {
        clusters.set(key, { label: mention, facts: [fact] });
      }
    }
  }
  return clusters;
};

function makeFact(content: string, source?: string): KnowledgeFact {
  return {
    id: `fact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    confidence: knowledgeConfidence(0.85),
    source,
    timestamp: new Date().toISOString(),
  };
}

export function capture(
  input: string,
  context: Record<string, unknown> = {}
): CaptureResult {
  const content = input.trim();
  if (!content) {
    return {
      facts: [],
      confidence: cognitiveConfidence(0),
      ambiguities: [],
    };
  }

  const source =
    typeof context.source === "string" ? context.source : "capture";
  const facts = [makeFact(content, source)];
  const ambiguities =
    typeof context.ambiguities === "object" &&
    Array.isArray(context.ambiguities as unknown[])
      ? ((context.ambiguities as unknown[]).filter(
          (item) => typeof item === "string"
        ) as string[])
      : [];

  return {
    facts,
    confidence: cognitiveConfidence(0.8),
    ambiguities,
  };
}

export async function synthesize(
  facts: KnowledgeFact[],
  graph: Hypergraph
): Promise<SynthesisResult> {
  const insights: KnowledgeInsight[] = [];
  const relations: KnowledgeRelation[] = [];
  const contradictions: SynthesisContradiction[] = [];

  if (facts.length === 0) {
    return { insights, relations, contradictions };
  }

  const graphFacts: [NodeId, { _: "fact"; content: string }][] = [];
  for (const [nodeId, knowledge] of graph.entries()) {
    if (knowledge._ === "fact") {
      graphFacts.push([nodeId, knowledge]);
    }
  }

  const hasEmbeddings =
    typeof graph.embeddingCount === "function" && graph.embeddingCount() > 0;
  const embeddingEntries: [NodeId, Float32Array][] = hasEmbeddings
    ? [...graph.embeddingEntries()]
    : [];

  const relationKeys = new Set<string>();
  const contradictionKeys = new Set<string>();

  for (const fact of facts) {
    for (const [nodeId, knowledge] of graphFacts) {
      const contradiction = detectContradiction(
        fact.content,
        knowledge.content
      );
      if (!contradiction) {
        continue;
      }
      const key = `${fact.id}:${nodeId}:${contradiction.reason}`;
      if (contradictionKeys.has(key)) {
        continue;
      }
      contradictionKeys.add(key);
      contradictions.push({
        newFact: fact.id,
        existingFact: nodeId,
        reason: contradiction.reason,
        focus: contradiction.focus,
        pair: contradiction.pair,
        confidence: knowledgeConfidence(contradiction.confidence),
      });
    }

    if (hasEmbeddings) {
      const embedding = await embedFact(fact.content);
      if (embedding) {
        for (const [nodeId, nodeEmbedding] of embeddingEntries) {
          const similarity = cosineSimilarity(
            toNumberArray(embedding),
            toNumberArray(nodeEmbedding)
          );
          if (similarity <= SEMANTIC_SIMILARITY_THRESHOLD) {
            continue;
          }
          const key = relationKey(fact.id, nodeId, "semantically_similar");
          if (relationKeys.has(key)) {
            continue;
          }
          relationKeys.add(key);
          relations.push({
            id: `rel-${fact.id}-${nodeId}`,
            from: fact.id,
            to: nodeId,
            kind: "semantically_similar",
            weight: Number(similarity.toFixed(4)),
            metadata: { similarity },
          });
        }
      }
    }

    const lexicalMatches = graph
      .search(fact.content)
      .slice(0, MAX_LEXICAL_RELATIONS);
    for (const nodeId of lexicalMatches) {
      const knowledge = graph.get(nodeId);
      if (!knowledge || knowledge._ !== "fact") {
        continue;
      }
      const similarity = lexicalSimilarity(fact.content, knowledge.content);
      if (similarity < MIN_LEXICAL_SIMILARITY) {
        continue;
      }
      const key = relationKey(fact.id, nodeId, "lexical_match");
      if (relationKeys.has(key)) {
        continue;
      }
      relationKeys.add(key);
      relations.push({
        id: `rel-${fact.id}-${nodeId}`,
        from: fact.id,
        to: nodeId,
        kind: "lexical_match",
        weight: Number(similarity.toFixed(4)),
      });
    }
  }

  const entityClusters = groupByEntity(facts);
  for (const { label, facts: relatedFacts } of entityClusters.values()) {
    if (relatedFacts.length < 3) {
      continue;
    }
    const derived = relatedFacts.map((fact) => fact.id);
    const confidenceValue =
      0.7 + Math.min(0.2, 0.05 * (relatedFacts.length - 3));
    insights.push({
      id: makeInsightId(),
      derived,
      conclusion: `Multiple facts about ${label}`,
      confidence: knowledgeConfidence(confidenceValue),
      rationale: `Aggregated from ${relatedFacts.length} facts about ${label}.`,
    });
  }

  return {
    insights,
    relations,
    contradictions,
  };
}

/**
 * Capture reasoning traces into cognitive facts
 */
export async function captureReasoning(
  traces: { text: string; timestamp: number }[],
  context: { threadId?: string; executionId?: string }
): Promise<CaptureResult> {
  if (traces.length === 0) {
    return {
      facts: [],
      confidence: cognitiveConfidence(0),
      ambiguities: [],
    };
  }

  const facts: KnowledgeFact[] = [];
  const ambiguities: string[] = [];

  for (const trace of traces) {
    const fact = makeFact(
      trace.text,
      `reasoning:${context.executionId ?? "unknown"}`
    );
    fact.timestamp = new Date(trace.timestamp).toISOString();

    const extraction = await extractReasoning(trace.text, {
      threadId: context.threadId,
      source: `reasoning:${context.executionId ?? "unknown"}`,
    });
    const tags = extraction.facts
      .map((item) => item.source)
      .filter((tag): tag is string => Boolean(tag));
    if (tags.length > 0) {
      fact.tags = [...new Set([...(fact.tags ?? []), ...tags])];
    }

    facts.push(fact);

    const lower = trace.text.toLowerCase();
    if (
      lower.includes("might") ||
      lower.includes("unclear") ||
      lower.includes("uncertain") ||
      lower.includes("?")
    ) {
      ambiguities.push(trace.text);
    }
  }

  const avgLength =
    traces.reduce((sum, entry) => sum + entry.text.length, 0) / traces.length;
  const baseConfidence = 0.7;
  const lengthBonus = Math.min(0.2, avgLength / 500);
  const ambiguityPenalty = ambiguities.length * 0.05;
  const finalConfidence = Math.max(
    0.3,
    Math.min(1, baseConfidence + lengthBonus - ambiguityPenalty)
  );

  return {
    facts,
    confidence: cognitiveConfidence(finalConfidence),
    ambiguities,
  };
}

export function execute(
  plan: ExecutionPlan,
  world: Record<string, unknown>
): ExecutionResult {
  const actions = plan.steps.map((step, index) => ({
    id: `${plan.goal ?? "step"}-${index + 1}`,
    status: "completed" as const,
    detail: step.description,
  }));

  return {
    actions,
    effects: actions.map((action) => ({
      action: action.id,
      timestamp: new Date().toISOString(),
      world,
    })),
    deviations: [],
  };
}

export function reflect(
  expected: unknown,
  actual: unknown,
  reasoning?: { text: string; timestamp: number }[]
): ReflectionResult {
  const mismatch: string[] = expected === actual ? [] : ["outcome_mismatch"];
  const updates: KnowledgeUpdate[] = [];
  const lessons: string[] = [];

  if (mismatch.length > 0) {
    lessons.push("Adjust plan based on delta");

    if (reasoning && reasoning.length > 0) {
      const hasDecisionPoints = reasoning.some((entry) =>
        /considering|choosing|selecting|decided/i.test(entry.text)
      );
      const hasAlternatives = reasoning.some((entry) =>
        /however|alternatively|instead|but|though/i.test(entry.text)
      );

      if (!hasDecisionPoints) {
        lessons.push("Reasoning lacked explicit decision points");
        if (!mismatch.includes("insufficient_reasoning_depth")) {
          mismatch.push("insufficient_reasoning_depth");
        }
      }

      if (!hasAlternatives) {
        lessons.push("Reasoning did not consider alternatives");
        if (!mismatch.includes("single_path_reasoning")) {
          mismatch.push("single_path_reasoning");
        }
      }

      const insight: KnowledgeInsight = {
        id: `reflect-${Date.now().toString(36)}`,
        derived: [],
        conclusion: "Reasoning depth insufficient for task complexity",
        confidence: knowledgeConfidence(0.75),
        rationale: lessons.join("; "),
      };

      updates.push({
        node: insight,
        replace: false,
      });
    }
  }

  return {
    errors: mismatch,
    lessons,
    updates,
  };
}
