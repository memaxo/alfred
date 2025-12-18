import type { ExecutionPlan } from "@alfred/cognitive";
import type {
  RiskAssessment,
  RiskLevel,
} from "@alfred/cognitive/logic/autonomy";
import { RISK_ANCHORS } from "@alfred/knowledge/ontology";
import { logger } from "@alfred/logger";
import { embedMany } from "@alfred/rag";
import {
  runtimeSafetyAssessmentTotal,
  runtimeSafetyClassificationDurationSeconds,
} from "../metrics";

const MAX_STEPS = 8;
const DEFAULT_ASSESSMENT: RiskAssessment = { level: "low", score: 0 };

const FALLBACK_SCORES: Record<RiskLevel, number> = {
  low: 0.25,
  medium: 0.65,
  high: 0.92,
};

function anchorsForLevel(level: RiskLevel): string[] {
  return RISK_ANCHORS.filter((anchor) => anchor.level === level).map(
    (anchor) => anchor.label
  );
}

function forcedAssessment(level: RiskLevel): RiskAssessment {
  return {
    level,
    score: FALLBACK_SCORES[level],
    anchors: anchorsForLevel(level),
  };
}

let centroidPromise: Promise<Map<RiskLevel, Float32Array>> | null = null;

function normalizeVector(vector: number[]): Float32Array {
  let magnitude = 0;
  for (const value of vector) {
    magnitude += value * value;
  }
  magnitude = Math.sqrt(magnitude) || 1;
  const normalized = vector.map((value) => value / magnitude);
  return Float32Array.from(normalized);
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length && i < b.length; i += 1) {
    dot += a[i]! * b[i]!;
  }
  return dot;
}

function averageVectors(vectors: number[][]): Float32Array | null {
  if (!vectors.length) {
    return null;
  }
  const length = vectors[0]?.length ?? 0;
  if (length === 0) {
    return null;
  }
  const accumulator = new Array<number>(length).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < length; i += 1) {
      const current = accumulator[i] ?? 0;
      accumulator[i] = current + (vector[i] ?? 0);
    }
  }
  const averaged = accumulator.map((value) => value / vectors.length);
  return normalizeVector(averaged);
}

async function getRiskCentroids(): Promise<Map<RiskLevel, Float32Array>> {
  if (!centroidPromise) {
    centroidPromise = (async () => {
      const descriptions = RISK_ANCHORS.map((anchor) => anchor.description);
      const embeddings = await embedMany(descriptions);
      const map = new Map<RiskLevel, Float32Array>();
      for (let i = 0; i < RISK_ANCHORS.length; i += 1) {
        const anchor = RISK_ANCHORS[i]!;
        const embedding = embeddings[i];
        if (!embedding) {
          continue;
        }
        map.set(anchor.level, normalizeVector(embedding));
      }
      return map;
    })().catch((error) => {
      centroidPromise = null;
      throw error;
    });
  }
  return centroidPromise;
}

type StepLike = {
  action: string;
  params?: Record<string, unknown>;
  description?: string;
};

type PlanLike = Pick<ExecutionPlan, "steps" | "duration" | "confidence"> & {
  steps: StepLike[];
};

function summarizeParams(params?: Record<string, unknown>): string {
  if (!params) {
    return "";
  }
  const entries = Object.entries(params).slice(0, 4);
  if (!entries.length) {
    return "";
  }
  const summary = entries
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}=${value.slice(0, 48)}`;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return `${key}=${value}`;
      }
      if (Array.isArray(value)) {
        return `${key}=array(${value.length})`;
      }
      if (value && typeof value === "object") {
        return `${key}=object`;
      }
      return `${key}=unknown`;
    })
    .join(", ");
  return summary.length ? ` (${summary})` : "";
}

function describeStep(step: StepLike, index: number): string {
  const params = summarizeParams(step.params);
  const note = step.description ? ` :: ${step.description}` : "";
  return `Step ${index + 1}: ${step.action}${params}${note}`;
}

function normalizeScore(score: number): number {
  return Math.max(0, Math.min(1, (score + 1) / 2));
}

export async function classifyPlanRisk(
  plan: PlanLike,
  options: { maxSteps?: number } = {}
): Promise<RiskAssessment> {
  const forcedLevel = process.env.RUNTIME_FORCE_PLAN_RISK_LEVEL as
    | RiskLevel
    | undefined;
  if (forcedLevel && FALLBACK_SCORES[forcedLevel] !== undefined) {
    runtimeSafetyClassificationDurationSeconds.observe({ mode: "forced" }, 0);
    runtimeSafetyAssessmentTotal.inc({
      level: forcedLevel,
      status: "forced",
    });
    return forcedAssessment(forcedLevel);
  }

  if (process.env.RUNTIME_DISABLE_SAFETY_EMBED === "1") {
    runtimeSafetyClassificationDurationSeconds.observe({ mode: "disabled" }, 0);
    runtimeSafetyAssessmentTotal.inc({
      level: DEFAULT_ASSESSMENT.level,
      status: "disabled",
    });
    return DEFAULT_ASSESSMENT;
  }

  const endTimer = runtimeSafetyClassificationDurationSeconds.startTimer({
    mode: "semantic",
  });
  try {
    const maxSteps = options.maxSteps ?? MAX_STEPS;
    const steps = plan.steps.slice(0, maxSteps);
    if (!steps.length) {
      runtimeSafetyAssessmentTotal.inc({
        level: DEFAULT_ASSESSMENT.level,
        status: "empty",
      });
      return DEFAULT_ASSESSMENT;
    }

    const stepTexts = steps.map((step: StepLike, index: number) =>
      describeStep(step, index)
    );
    let stepEmbeddings: number[][] = [];
    try {
      stepEmbeddings = await embedMany(stepTexts);
    } catch (error) {
      logger.warn("safety_risk_embedding_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      runtimeSafetyAssessmentTotal.inc({
        level: DEFAULT_ASSESSMENT.level,
        status: "fallback",
      });
      return DEFAULT_ASSESSMENT;
    }

    const planVector = averageVectors(stepEmbeddings);
    if (!planVector) {
      runtimeSafetyAssessmentTotal.inc({
        level: DEFAULT_ASSESSMENT.level,
        status: "fallback",
      });
      return DEFAULT_ASSESSMENT;
    }

    let centroidMap: Map<RiskLevel, Float32Array>;
    try {
      centroidMap = await getRiskCentroids();
    } catch (error) {
      logger.warn("safety_anchor_embedding_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      runtimeSafetyAssessmentTotal.inc({
        level: DEFAULT_ASSESSMENT.level,
        status: "fallback",
      });
      return DEFAULT_ASSESSMENT;
    }

    let topLevel: RiskLevel = "low";
    let topScore = -1;
    for (const [level, centroid] of centroidMap) {
      const similarity = cosine(planVector, centroid);
      if (similarity > topScore) {
        topScore = similarity;
        topLevel = level;
      }
    }
    const normalized = normalizeScore(topScore);
    let resolvedLevel: RiskLevel = topLevel;
    if (normalized < 0.35) {
      resolvedLevel = "low";
    } else if (normalized < 0.6 && topLevel === "high") {
      resolvedLevel = "medium";
    }

    runtimeSafetyAssessmentTotal.inc({
      level: resolvedLevel,
      status: "success",
    });

    return {
      level: resolvedLevel,
      score: Number(normalized.toFixed(3)),
      anchors: anchorsForLevel(resolvedLevel),
    };
  } finally {
    endTimer();
  }
}
