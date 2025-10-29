import type { KnowledgeConfidence, KnowledgeInsight, KnowledgeUpdate } from "@alfred/type/knowledge";

export interface SupervisionEvent {
  input: unknown;
  output: unknown;
  expected: unknown;
  error: number;
  context?: Record<string, unknown>;
  ts: string;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const confidence = (value: number) => clamp(value) as KnowledgeConfidence;

export function supervise(event: SupervisionEvent): KnowledgeUpdate[] | null {
  if (!Number.isFinite(event.error) || event.error <= 0) {
    return null;
  }

  const insight: KnowledgeInsight = {
    id: `insight-${Date.now().toString(36)}`,
    derived: [],
    conclusion: "Prediction error detected",
    confidence: confidence(Math.max(0.1, 1 - clamp(event.error))),
    rationale:
      typeof event.context?.reason === "string"
        ? event.context.reason
        : `Observed difference between expected and actual output at ${event.ts}.`,
  };

  return [
    {
      node: insight,
      replace: false,
    },
  ];
}
