/**
 * Plan domain types
 */

import type { Autonomy, Confidence } from "../util/math.js";

export interface Plan {
  steps: Step[];
  duration: number; // estimated ms
  confidence: Confidence;
}

export interface Step {
  action: string;
  params: Record<string, unknown>;
  timeout: number;
  retryable: boolean;
}

export interface Risk {
  type: "data_loss" | "irreversible" | "external_effect" | "high_cost";
  severity: "low" | "medium" | "high";
  mitigation?: string;
}

export interface Decision {
  id: string;
  description: string;
  score: number;
  plan: Plan;
  risks: Risk[];
  autonomy: Autonomy;
}

export interface Criteria {
  safety: number;
  speed: number;
  accuracy: number;
  cost: number;
}

export interface Path {
  direction: string;
  depth: number;
  promise: number; // how promising this path looks
}

export type Outcome =
  | { _: "success"; result: unknown; duration: number }
  | { _: "failure"; error: string; recoverable: boolean }
  | { _: "partial"; completed: string[]; failed: string[] }
  | { _: "cancelled"; reason: string };

export const defaultCriteria = (): Criteria => ({
  safety: 1,
  speed: 0.7,
  accuracy: 0.9,
  cost: 0.5,
});
