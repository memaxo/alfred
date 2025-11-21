/**
 * Cognitive Domain Types
 */

import type {
  KnowledgeFact,
  KnowledgeInsight,
  KnowledgeRelation,
  KnowledgeUpdate,
} from "./knowledge";

export type Timestamp = string & { readonly _: unique symbol };
export type CognitiveConfidence = number & { readonly _: unique symbol };
export type Autonomy = number & { readonly _: unique symbol };

export type FocusSessionRecord = {
  started: Timestamp;
  stopped: Timestamp;
  duration: number;
};

export type FocusState =
  | {
      _: "idle";
      duration?: number;
      note?: string;
      sessions?: number;
      last?: FocusSessionRecord;
    }
  | {
      _: "active";
      since: Timestamp;
      duration?: number;
      note?: string;
      sessions?: number;
      last?: FocusSessionRecord;
    };

export type CaptureInput = {
  content: string;
  context?: Record<string, unknown>;
};

export type CaptureResult = {
  facts: KnowledgeFact[];
  confidence: CognitiveConfidence;
  ambiguities: string[];
};

export type SynthesisResult = {
  insights: KnowledgeInsight[];
  relations: KnowledgeRelation[];
  contradictions: string[];
};

export type ExecutionStep = {
  description: string;
  etaMs?: number;
  metadata?: Record<string, unknown>;
};

export type ExecutionPlan = {
  steps: ExecutionStep[];
  goal?: string;
  autonomy?: Autonomy;
  metadata?: Record<string, unknown>;
};

export type ExecutionResult = {
  actions: Array<{
    id: string;
    status: "completed" | "skipped" | "failed";
    detail?: string;
  }>;
  effects: Record<string, unknown>[];
  deviations: string[];
};

export type ReflectionResult = {
  errors: string[];
  lessons: string[];
  updates: KnowledgeUpdate[];
};
