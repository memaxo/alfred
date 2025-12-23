/**
 * Plan domain types
 */

import type { Autonomy, Confidence } from "../util/math.js";

export type Plan = {
  steps: Step[];
  duration: number; // estimated ms
  confidence: Confidence;
};

export type Step = {
  action: string;
  params: Record<string, unknown>;
  timeout: number;
  retryable: boolean;
};

export type Risk = {
  type: "data_loss" | "irreversible" | "external_effect" | "high_cost";
  severity: "low" | "medium" | "high";
  mitigation?: string;
};

export type Decision = {
  id: string;
  description: string;
  score: number;
  plan: Plan;
  risks: Risk[];
  autonomy: Autonomy;
};

export type Criteria = {
  safety: number;
  speed: number;
  accuracy: number;
  cost: number;
};

export type Path = {
  direction: string;
  depth: number;
  promise: number; // how promising this path looks
};

export type Outcome =
  | { _: "success"; result: unknown; duration: number }
  | { _: "failure"; error: string; recoverable: boolean }
  | { _: "partial"; completed: string[]; failed: string[] }
  | { _: "cancelled"; reason: string };

export const defaultCriteria = (): Criteria => ({
  safety: 1.0,
  speed: 0.7,
  accuracy: 0.9,
  cost: 0.5,
});
