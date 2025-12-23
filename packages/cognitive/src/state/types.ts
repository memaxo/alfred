/**
 * Core cognitive state ADT and event types
 */

import type { AutonomyGradient } from "../autonomy/types.js";
import type { Physiology } from "../physiology/types.js";
import type { Criteria, Decision, Outcome, Path, Plan } from "../plan/types.js";
import type { Confidence, Timestamp } from "../util/math.js";

// Re-export branded types for convenience
export type { Autonomy, Confidence, Timestamp } from "../util/math.js";

// Main cognitive state ADT
export type CognitiveState =
  | { _: "idle"; since: Timestamp; physiology: Physiology }
  | {
      _: "capturing";
      input: string;
      confidence: Confidence;
      started: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "thinking";
      about: string;
      depth: number;
      paths: Path[];
      reasoningTraces?: string[];
      started: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "deciding";
      options: Decision[];
      criteria: Criteria;
      weights: number[];
      deadline: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "executing";
      plan: Plan;
      step: number;
      auto: AutonomyGradient;
      started: Timestamp;
      physiology: Physiology;
    }
  | {
      _: "reflecting";
      outcome: Outcome;
      expected: string;
      actual: string;
      error: number;
      physiology: Physiology;
    };

// Event types that trigger transitions
export type Event =
  | {
      _: "input";
      content: string;
      source: "user" | "system" | "tool";
      ts: Timestamp;
    }
  | { _: "timeout"; deadline: Timestamp }
  | {
      _: "feedback";
      expected: string;
      actual: string;
      similarity?: number;
      ts: Timestamp;
    }
  | { _: "interrupt"; reason: string; priority: 1 | 2 | 3; ts: Timestamp }
  | { _: "complete"; outcome: Outcome; ts: Timestamp };
