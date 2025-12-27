/**
 * ALFRED Personality Types
 * Cognitive traits that modulate agent behavior
 */

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Trait value bounded to [0, 1]
 */
export type TraitValue = number & { readonly _brand: "TraitValue" };

/**
 * Create a trait value (clamped to [0, 1])
 */
export function traitValue(value: number): TraitValue {
  return Math.max(0, Math.min(1, value)) as TraitValue;
}

// ============================================================================
// Goal and Objective Types
// ============================================================================

export type Goal = {
  id: string;
  description: string;
  priority: TraitValue;
  deadline?: Date;
  progress: TraitValue;
  active: boolean;
};

export type Objective = {
  id: string;
  goalId: string;
  description: string;
  completed: boolean;
  createdAt: Date;
};

// ============================================================================
// Core Cognitive Traits
// ============================================================================

/**
 * Purpose trait - goal-directed behavior
 */
export type PurposeTrait = {
  goals: Goal[];
  objectives: Objective[];
  alignmentThreshold: TraitValue;
  decayRate: number;
  activeOptimization: boolean;
};

/**
 * Curiosity trait - exploration and novelty seeking
 */
export type CuriosityTrait = {
  explorationRate: TraitValue;
  noveltyBias: TraitValue;
  questionFrequency: TraitValue;
  topicBreadth: TraitValue;
};

/**
 * Deliberation trait - thinking depth and carefulness
 */
export type DeliberationTrait = {
  thinkingBudgetMs: number;
  depthPreference: TraitValue;
  uncertaintyTolerance: TraitValue;
  planningHorizon: number; // Steps ahead to consider
};

// ============================================================================
// Self-Improvement Traits
// ============================================================================

/**
 * Confidence trait - calibration and self-awareness
 */
export type ConfidenceTrait = {
  calibrationError: number; // Brier score or similar
  uncertaintyThreshold: TraitValue;
  overconfidenceBias: number;
  domainCalibration: Record<string, number>; // Per-domain calibration
};

/**
 * MetaLearning trait - learning to learn
 */
export type MetaLearningTrait = {
  strategyUpdateRate: TraitValue;
  patternRecognitionStrength: TraitValue;
  abstractionLevel: TraitValue;
};

// ============================================================================
// Interaction Traits
// ============================================================================

/**
 * SkillAcquisition trait - how quickly skills are learned and retained
 */
export type SkillAcquisitionTrait = {
  learningRate: TraitValue;
  retentionFactor: TraitValue;
  transferLearning: TraitValue;
  practiceSchedule: "massed" | "spaced" | "adaptive";
};

/**
 * Aesthetics trait - preferences for output style
 */
export type AestheticsTrait = {
  codeStyle: string; // e.g., "functional", "object-oriented", "minimal"
  outputFormat: string; // e.g., "concise", "detailed", "structured"
  verbosityLevel: TraitValue;
  explanationDepth: TraitValue;
};

// ============================================================================
// Complete Personality Type
// ============================================================================

export type Personality = {
  // Core cognitive traits
  purpose: PurposeTrait;
  curiosity: CuriosityTrait;
  deliberation: DeliberationTrait;

  // Self-improvement traits
  confidence: ConfidenceTrait;
  metaLearning: MetaLearningTrait;

  // Interaction traits
  skillAcquisition: SkillAcquisitionTrait;
  aesthetics: AestheticsTrait;

  // Metadata
  version: number;
  lastUpdated: Date;
};

// ============================================================================
// Personality Events
// ============================================================================

export type PersonalityEvent =
  | {
      type: "feedback_positive";
      trait: keyof Personality;
      strength: TraitValue;
    }
  | {
      type: "feedback_negative";
      trait: keyof Personality;
      strength: TraitValue;
    }
  | { type: "calibration_update"; domain: string; accuracy: number }
  | { type: "goal_progress"; goalId: string; progress: TraitValue }
  | { type: "goal_completed"; goalId: string }
  | { type: "skill_practiced"; skill: string; duration: number }
  | { type: "exploration_success"; topic: string }
  | { type: "exploration_failure"; topic: string }
  | { type: "override"; trait: keyof Personality; value: unknown };

// ============================================================================
// Default Values
// ============================================================================

export function defaultPersonality(): Personality {
  return {
    purpose: {
      goals: [],
      objectives: [],
      alignmentThreshold: traitValue(0.7),
      decayRate: 0.01,
      activeOptimization: false,
    },
    curiosity: {
      explorationRate: traitValue(0.3),
      noveltyBias: traitValue(0.5),
      questionFrequency: traitValue(0.4),
      topicBreadth: traitValue(0.5),
    },
    deliberation: {
      thinkingBudgetMs: 5000,
      depthPreference: traitValue(0.6),
      uncertaintyTolerance: traitValue(0.3),
      planningHorizon: 3,
    },
    confidence: {
      calibrationError: 0.2,
      uncertaintyThreshold: traitValue(0.3),
      overconfidenceBias: 0,
      domainCalibration: {},
    },
    metaLearning: {
      strategyUpdateRate: traitValue(0.1),
      patternRecognitionStrength: traitValue(0.5),
      abstractionLevel: traitValue(0.5),
    },
    skillAcquisition: {
      learningRate: traitValue(0.5),
      retentionFactor: traitValue(0.8),
      transferLearning: traitValue(0.4),
      practiceSchedule: "adaptive",
    },
    aesthetics: {
      codeStyle: "functional",
      outputFormat: "structured",
      verbosityLevel: traitValue(0.5),
      explanationDepth: traitValue(0.6),
    },
    version: 1,
    lastUpdated: new Date(),
  };
}

// ============================================================================
// Trait Accessors
// ============================================================================

export type TraitName = keyof Omit<Personality, "version" | "lastUpdated">;

export function getTraitValue(
  personality: Personality,
  trait: TraitName,
  subTrait: string
): TraitValue | number | undefined {
  const traitObj = personality[trait];
  if (
    typeof traitObj === "object" &&
    traitObj !== null &&
    subTrait in traitObj
  ) {
    return (traitObj as Record<string, unknown>)[subTrait] as
      | TraitValue
      | number;
  }
  return;
}
