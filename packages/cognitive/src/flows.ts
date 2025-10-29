import { Hypergraph } from "@alfred/knowledge";
import type {
  CaptureResult,
  ExecutionPlan,
  ExecutionResult,
  ReflectionResult,
  SynthesisResult,
  Confidence as CognitiveConfidence,
} from "@alfred/type/cognitive";
import type {
  KnowledgeFact,
  KnowledgeInsight,
  KnowledgeRelation,
  Confidence as KnowledgeConfidence,
  KnowledgeUpdate,
} from "@alfred/type/knowledge";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

const cognitiveConfidence = (value: number) => clamp(value) as CognitiveConfidence;
const knowledgeConfidence = (value: number) => clamp(value) as KnowledgeConfidence;

function makeFact(content: string, source?: string): KnowledgeFact {
  return {
    id: `fact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    confidence: knowledgeConfidence(0.85),
    source,
    timestamp: new Date().toISOString(),
  };
}

export function capture(input: string, context: Record<string, unknown> = {}): CaptureResult {
  const content = input.trim();
  if (!content) {
    return {
      facts: [],
      confidence: cognitiveConfidence(0),
      ambiguities: [],
    };
  }

  const source = typeof context.source === "string" ? context.source : "capture";
  const facts = [makeFact(content, source)];
  const ambiguities =
    typeof context.ambiguities === "object" && Array.isArray((context.ambiguities as unknown[]))
      ? ((context.ambiguities as unknown[]).filter(item => typeof item === "string") as string[])
      : [];

  return {
    facts,
    confidence: cognitiveConfidence(0.8),
    ambiguities,
  };
}

export function synthesize(facts: KnowledgeFact[], graph: Hypergraph): SynthesisResult {
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

export function execute(plan: ExecutionPlan, world: Record<string, unknown>): ExecutionResult {
  const actions = plan.steps.map((step, index) => ({
    id: `${plan.goal ?? "step"}-${index + 1}`,
    status: "completed" as const,
    detail: step.description,
  }));

  return {
    actions,
    effects: actions.map(action => ({
      action: action.id,
      timestamp: new Date().toISOString(),
      world,
    })),
    deviations: [],
  };
}

export function reflect(expected: unknown, actual: unknown): ReflectionResult {
  const mismatch = expected === actual ? [] : ["outcome_mismatch"];
  const updates: KnowledgeUpdate[] = [];

  return {
    errors: mismatch,
    lessons: mismatch.length > 0 ? ["Adjust plan based on delta"] : [],
    updates,
  };
}
