/**
 * ALFRED Personality State Machine
 * Pure functions for updating personality traits
 */

import type { AutonomyGradient, Physiology } from "./state";

// Import types - we'll define a subset here to avoid complex imports
interface TraitValue extends number {
  readonly _brand: "TraitValue";
}

function traitValue(value: number): TraitValue {
  return Math.max(0, Math.min(1, value)) as unknown as TraitValue;
}

interface Goal {
  id: string;
  description: string;
  priority: TraitValue;
  deadline?: Date;
  progress: TraitValue;
  active: boolean;
}

interface Objective {
  id: string;
  goalId: string;
  description: string;
  completed: boolean;
  createdAt: Date;
}

interface PurposeTrait {
  goals: Goal[];
  objectives: Objective[];
  alignmentThreshold: TraitValue;
  decayRate: number;
  activeOptimization: boolean;
}

interface CuriosityTrait {
  explorationRate: TraitValue;
  noveltyBias: TraitValue;
  questionFrequency: TraitValue;
  topicBreadth: TraitValue;
}

interface DeliberationTrait {
  thinkingBudgetMs: number;
  depthPreference: TraitValue;
  uncertaintyTolerance: TraitValue;
  planningHorizon: number;
}

interface ConfidenceTrait {
  calibrationError: number;
  uncertaintyThreshold: TraitValue;
  overconfidenceBias: number;
  domainCalibration: Record<string, number>;
}

interface MetaLearningTrait {
  strategyUpdateRate: TraitValue;
  patternRecognitionStrength: TraitValue;
  abstractionLevel: TraitValue;
}

interface SkillAcquisitionTrait {
  learningRate: TraitValue;
  retentionFactor: TraitValue;
  transferLearning: TraitValue;
  practiceSchedule: "massed" | "spaced" | "adaptive";
}

interface AestheticsTrait {
  codeStyle: string;
  outputFormat: string;
  verbosityLevel: TraitValue;
  explanationDepth: TraitValue;
}

export interface Personality {
  purpose: PurposeTrait;
  curiosity: CuriosityTrait;
  deliberation: DeliberationTrait;
  confidence: ConfidenceTrait;
  metaLearning: MetaLearningTrait;
  skillAcquisition: SkillAcquisitionTrait;
  aesthetics: AestheticsTrait;
  version: number;
  lastUpdated: Date;
}

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
// Default Personality
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
// Personality Update Functions
// ============================================================================

/**
 * Apply an event to update personality (pure function)
 */
export function updatePersonality(
  current: Personality,
  event: PersonalityEvent
): Personality {
  const updated = structuredClone(current);
  updated.lastUpdated = new Date();

  switch (event.type) {
    case "feedback_positive":
      applyPositiveFeedback(updated, event.trait, Number(event.strength));
      break;

    case "feedback_negative":
      applyNegativeFeedback(updated, event.trait, Number(event.strength));
      break;

    case "calibration_update":
      applyCalibrationUpdate(updated, event.domain, event.accuracy);
      break;

    case "goal_progress":
      applyGoalProgress(updated, event.goalId, Number(event.progress));
      break;

    case "goal_completed":
      applyGoalCompleted(updated, event.goalId);
      break;

    case "skill_practiced":
      applySkillPractice(updated, event.skill, event.duration);
      break;

    case "exploration_success":
      applyExplorationSuccess(updated, event.topic);
      break;

    case "exploration_failure":
      applyExplorationFailure(updated, event.topic);
      break;

    case "override":
      if (
        event.trait in updated &&
        event.trait !== "version" &&
        event.trait !== "lastUpdated"
      ) {
        (updated as any)[event.trait] = event.value;
      }
      break;
  }

  return updated;
}

function applyPositiveFeedback(
  personality: Personality,
  trait: keyof Personality,
  strength: number
): void {
  const learningRate = Number(personality.skillAcquisition.learningRate);
  const delta = strength * learningRate * 0.1;

  switch (trait) {
    case "curiosity":
      personality.curiosity.explorationRate = traitValue(
        Number(personality.curiosity.explorationRate) + delta
      );
      break;
    case "confidence":
      personality.confidence.calibrationError = Math.max(
        0,
        personality.confidence.calibrationError - delta
      );
      break;
    case "deliberation":
      personality.deliberation.depthPreference = traitValue(
        Number(personality.deliberation.depthPreference) + delta * 0.5
      );
      break;
  }
}

function applyNegativeFeedback(
  personality: Personality,
  trait: keyof Personality,
  strength: number
): void {
  const delta = strength * 0.1;

  switch (trait) {
    case "curiosity":
      personality.curiosity.explorationRate = traitValue(
        Number(personality.curiosity.explorationRate) - delta * 0.5
      );
      break;
    case "confidence":
      personality.confidence.calibrationError = Math.min(
        1,
        personality.confidence.calibrationError + delta
      );
      personality.confidence.overconfidenceBias = Math.max(
        -0.5,
        personality.confidence.overconfidenceBias - delta
      );
      break;
  }
}

function applyCalibrationUpdate(
  personality: Personality,
  domain: string,
  accuracy: number
): void {
  // Update domain-specific calibration
  const current = personality.confidence.domainCalibration[domain] ?? 0.5;
  const alpha = 0.1; // Exponential moving average weight
  personality.confidence.domainCalibration[domain] =
    current * (1 - alpha) + accuracy * alpha;

  // Update overall calibration error (simple average of domain errors)
  const domains = Object.values(personality.confidence.domainCalibration);
  if (domains.length > 0) {
    const avgError =
      domains.reduce((sum, acc) => sum + Math.abs(acc - 0.5) * 2, 0) /
      domains.length;
    personality.confidence.calibrationError = avgError;
  }
}

function applyGoalProgress(
  personality: Personality,
  goalId: string,
  progress: number
): void {
  const goal = personality.purpose.goals.find((g) => g.id === goalId);
  if (goal) {
    goal.progress = traitValue(progress);
  }
}

function applyGoalCompleted(personality: Personality, goalId: string): void {
  const goal = personality.purpose.goals.find((g) => g.id === goalId);
  if (goal) {
    goal.progress = traitValue(1);
    goal.active = false;
  }

  // Mark related objectives as completed
  for (const obj of personality.purpose.objectives) {
    if (obj.goalId === goalId) {
      obj.completed = true;
    }
  }
}

function applySkillPractice(
  personality: Personality,
  _skill: string,
  duration: number
): void {
  // Longer practice sessions slightly increase retention
  const durationFactor = Math.min(1, duration / 3600); // Normalize to 1 hour
  const delta = durationFactor * 0.01;

  personality.skillAcquisition.retentionFactor = traitValue(
    Number(personality.skillAcquisition.retentionFactor) + delta
  );
}

function applyExplorationSuccess(
  personality: Personality,
  _topic: string
): void {
  const delta = 0.02;

  // Successful exploration increases exploration rate
  personality.curiosity.explorationRate = traitValue(
    Number(personality.curiosity.explorationRate) + delta
  );
  personality.curiosity.noveltyBias = traitValue(
    Number(personality.curiosity.noveltyBias) + delta * 0.5
  );
}

function applyExplorationFailure(
  personality: Personality,
  _topic: string
): void {
  const delta = 0.01;

  // Failed exploration slightly decreases exploration rate
  personality.curiosity.explorationRate = traitValue(
    Number(personality.curiosity.explorationRate) - delta
  );
}

// ============================================================================
// Autonomy Computation
// ============================================================================

/**
 * Compute effective autonomy level based on personality and physiology
 */
export function computeEffectiveAutonomy(
  personality: Personality,
  physiology: Physiology
): AutonomyGradient {
  // Base autonomy from deliberation trait
  const baseAutonomy = Number(personality.deliberation.depthPreference);

  // Confidence modulation (higher confidence = higher autonomy)
  const confidenceEffect = 1 - personality.confidence.calibrationError;

  // Physiology modulation
  const energyFactor = physiology.energy;
  const frustrationPenalty = physiology.frustration * 0.3;
  const boredomBonus = physiology.boredom * 0.1; // Boredom slightly increases autonomy to seek stimulation

  // Combine factors
  const rawAutonomy =
    baseAutonomy * 0.4 +
    confidenceEffect * 0.3 +
    energyFactor * 0.2 -
    frustrationPenalty +
    boredomBonus;

  // Clamp to valid range
  const clampedAutonomy = Math.max(0, Math.min(1, rawAutonomy));

  // Return as AutonomyGradient (simplified - actual implementation would use proper type)
  return {
    current: clampedAutonomy,
    target: clampedAutonomy,
    alpha: 1,
    beta: 1,
    lastUpdate: Date.now(),
  } as AutonomyGradient;
}

// ============================================================================
// Prompt Injection Helpers
// ============================================================================

/**
 * Generate personality-based instructions for prompt injection
 */
export function getPersonalityInstructions(personality: Personality): string {
  const instructions: string[] = [];

  // Curiosity instructions
  const curiosity = Number(personality.curiosity.explorationRate);
  if (curiosity > 0.6) {
    instructions.push("Be curious and explore alternative approaches.");
  } else if (curiosity < 0.3) {
    instructions.push(
      "Focus on proven approaches; avoid unnecessary exploration."
    );
  }

  // Deliberation instructions
  const depth = Number(personality.deliberation.depthPreference);
  if (depth > 0.7) {
    instructions.push(
      "Think deeply before acting. Consider multiple perspectives."
    );
  } else if (depth < 0.4) {
    instructions.push("Be efficient and direct. Don't over-analyze.");
  }

  // Confidence instructions
  if (personality.confidence.calibrationError > 0.3) {
    instructions.push(
      "Express uncertainty when appropriate. Verify assumptions."
    );
  }

  // Aesthetics instructions
  if (personality.aesthetics.codeStyle === "functional") {
    instructions.push("Prefer functional programming patterns.");
  } else if (personality.aesthetics.codeStyle === "minimal") {
    instructions.push("Keep code minimal and simple.");
  }

  const verbosity = Number(personality.aesthetics.verbosityLevel);
  if (verbosity > 0.7) {
    instructions.push("Provide detailed explanations.");
  } else if (verbosity < 0.3) {
    instructions.push("Be concise and brief.");
  }

  if (instructions.length === 0) {
    return "";
  }

  return `\n\n### Personality Guidelines\n${instructions.map((i) => `- ${i}`).join("\n")}`;
}
