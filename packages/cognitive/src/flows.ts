import type { Hypergraph } from "@alfred/knowledge";
import { extractReasoning } from "@alfred/knowledge/extractor";
import type {
  CaptureResult,
  CognitiveConfidence,
  ExecutionPlan,
  ExecutionResult,
  ReflectionResult,
  SynthesisResult,
} from "@alfred/type/cognitive";
import type {
  KnowledgeConfidence,
  KnowledgeFact,
  KnowledgeInsight,
  KnowledgeRelation,
  KnowledgeUpdate,
} from "@alfred/type/knowledge";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const cognitiveConfidence = (value: number) =>
  clamp(value) as CognitiveConfidence;
const knowledgeConfidence = (value: number) =>
  clamp(value) as KnowledgeConfidence;

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

export function synthesize(
  facts: KnowledgeFact[],
  graph: Hypergraph
): SynthesisResult {
  const insights: KnowledgeInsight[] = [];
  const relations: KnowledgeRelation[] = [];

  for (const fact of facts) {
    const neighbours = graph.search(fact.content);
    if (neighbours.length > 0) {
      relations.push({
        id: `rel-${fact.id}`,
        from: fact.id,
        to: neighbours[0] ?? fact.id,
        kind: "similar",
        weight: 0.5,
      });
    }
  }

  return {
    insights,
    relations,
    contradictions: [],
  };
}

/**
 * Capture reasoning traces into cognitive facts
 */
export async function captureReasoning(
  traces: Array<{ text: string; timestamp: number }>,
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
  reasoning?: Array<{ text: string; timestamp: number }>
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
