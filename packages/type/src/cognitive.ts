/**
 * Cognitive Domain Types
 */

import type { KnowledgeFact, KnowledgeInsight, KnowledgeRelation, KnowledgeUpdate } from "./knowledge";

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

export interface CaptureInput {
  content: string;
  context?: Record<string, unknown>;
}

export interface CaptureResult {
  facts: KnowledgeFact[];
  confidence: CognitiveConfidence;
  ambiguities: string[];
}

export interface SynthesisResult {
  insights: KnowledgeInsight[];
  relations: KnowledgeRelation[];
  contradictions: string[];
}

export interface ExecutionStep {
  description: string;
  etaMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  goal?: string;
  autonomy?: Autonomy;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  actions: Array<{
    id: string;
    status: "completed" | "skipped" | "failed";
    detail?: string;
  }>;
  effects: Array<Record<string, unknown>>;
  deviations: string[];
}

export interface ReflectionResult {
  errors: string[];
  lessons: string[];
  updates: KnowledgeUpdate[];
}
