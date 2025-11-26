/**
 * Cognitive State Machine
 * Pure algebraic data types with zero runtime overhead
 */
type Timestamp = number & {
  readonly _: unique symbol;
};
type Confidence = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};
type Autonomy = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};
type Evidence =
  | {
      _: "success";
      task: string;
      duration: number;
      reliability?: number;
    }
  | {
      _: "failure";
      task: string;
      error: string;
      reliability?: number;
    }
  | {
      _: "feedback";
      positive: boolean;
      strength: number;
      reliability?: number;
    }
  | {
      _: "override";
      reason: string;
      reliability?: number;
    };
type Constraint =
  | {
      _: "temporal";
      until: Timestamp;
    }
  | {
      _: "scope";
      allowed: string[];
      forbidden: string[];
    }
  | {
      _: "confidence";
      minimum: Confidence;
    }
  | {
      _: "approval";
      required: boolean;
    };
export type Decision = {
  id: string;
  description: string;
  score: number;
  plan: Plan;
  risks: Risk[];
  autonomy: Autonomy;
};
export type Plan = {
  steps: Step[];
  duration: number;
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
export type Path = {
  direction: string;
  depth: number;
  promise: number;
};
export type Criteria = {
  safety: number;
  speed: number;
  accuracy: number;
  cost: number;
};
export type Outcome =
  | {
      _: "success";
      result: unknown;
      duration: number;
    }
  | {
      _: "failure";
      error: string;
      recoverable: boolean;
    }
  | {
      _: "partial";
      completed: string[];
      failed: string[];
    }
  | {
      _: "cancelled";
      reason: string;
    };
export type CognitiveState =
  | {
      _: "idle";
      since: Timestamp;
    }
  | {
      _: "capturing";
      input: string;
      confidence: Confidence;
      started: Timestamp;
    }
  | {
      _: "thinking";
      about: string;
      depth: number;
      paths: Path[];
      reasoningTraces?: string[];
      started: Timestamp;
    }
  | {
      _: "deciding";
      options: Decision[];
      criteria: Criteria;
      weights: number[];
      deadline: Timestamp;
    }
  | {
      _: "executing";
      plan: Plan;
      step: number;
      auto: AutonomyGradient;
      started: Timestamp;
    }
  | {
      _: "reflecting";
      outcome: Outcome;
      expected: string;
      actual: string;
      error: number;
    };
export type AutonomyGradient = {
  level: Autonomy;
  confidence: Confidence;
  evidence: Evidence[];
  constraints: Constraint[];
  lastUpdate: Timestamp;
};
export type Event =
  | {
      _: "input";
      content: string;
      source: "user" | "system" | "tool";
      ts: Timestamp;
    }
  | {
      _: "timeout";
      deadline: Timestamp;
    }
  | {
      _: "feedback";
      expected: string;
      actual: string;
      ts: Timestamp;
    }
  | {
      _: "interrupt";
      reason: string;
      priority: 1 | 2 | 3;
      ts: Timestamp;
    }
  | {
      _: "complete";
      outcome: Outcome;
      ts: Timestamp;
    };
export declare const idle: (now: number, phy?: Physiology) => CognitiveState;
export declare const capturing: (
  now: number,
  input: string,
  conf: number,
  phy?: Physiology
) => CognitiveState;
export declare const thinking: (
  now: number,
  about: string,
  depth?: number,
  traces?: string[],
  phy?: Physiology
) => CognitiveState;
export declare const deciding: (
  now: number,
  options: Decision[],
  criteria?: Criteria,
  phy?: Physiology
) => CognitiveState;
export declare const executing: (
  now: number,
  plan: Plan,
  auto: AutonomyGradient,
  phy?: Physiology
) => CognitiveState;
export declare const reflecting: (
  outcome: Outcome,
  expected: string,
  actual: string,
  phy?: Physiology
) => CognitiveState;
export declare const initialAutonomy: (now: number) => AutonomyGradient;
export declare const updateAutonomy: (
  now: number,
  current: AutonomyGradient,
  evidence: Evidence,
  physiology?: Physiology
) => AutonomyGradient;
/**
 * Evaluate reasoning quality based on trace characteristics
 */
export declare const evaluateReasoningQuality: (
  traces: string[],
  outcome: Outcome
) => Evidence;
export declare const meetsConstraints: (
  auto: AutonomyGradient,
  action: string
) => boolean;
export declare const isActive: (state: CognitiveState) => boolean;
export declare const canInterrupt: (state: CognitiveState) => boolean;
export declare const requiresInput: (state: CognitiveState) => boolean;
export declare const isExecuting: (state: CognitiveState) => boolean;
export declare const duration: (state: CognitiveState) => number;
export declare const isStale: (
  state: CognitiveState,
  threshold?: number
) => boolean;
export type FocusState = {
  _: "idle" | "active";
  since?: string;
  duration?: number;
  note?: string;
  sessions?: number;
  last?: {
    started: string;
    stopped: string;
    duration: number;
  };
};
type FocusStartParams = {
  durationMin?: number;
  note?: string;
  since?: string;
};
type FocusUpdateParams = {
  durationMin?: number;
  note?: string;
  timestamp?: string;
};
export declare const statusFocus: (
  state: FocusState | null | undefined
) => FocusState;
export declare const startFocus: (
  current: FocusState | null | undefined,
  params: FocusStartParams
) => FocusState;
export declare const stopFocus: (
  current: FocusState | null | undefined
) => FocusState;
export declare const updateFocus: (
  current: FocusState | null | undefined,
  params: FocusUpdateParams
) => FocusState;
//# sourceMappingURL=state.d.ts.map
