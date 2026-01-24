# Cognitive Architecture Deep Review: Emergent Personality & Tunable Soul Parameters

**Owner**: cognition  
**Status**: Design Document  
**Date**: 2025-12-13

---

## 1. Architecture Audit

### 1.1 Current Cognitive State Machine

The cognitive architecture lives in `packages/cognitive/` and implements a pure algebraic state machine with six states:

```13:175:packages/cognitive/src/state.ts
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
```

**State Transitions**: Pure function `applyTransition(state, autonomy, event) → TransitionResult` in `transition.ts`

**Performance Budgets**:

- State transitions: <100 µs
- Physiology updates: <10 µs
- Autonomy updates: <50 µs
- Error calculation: <100 µs

### 1.2 Existing "Need-Like" Constructs

#### Physiology (Homeostatic Regulators)

```119:124:packages/cognitive/src/state.ts
// Physiological State (Homeostasis)
export type Physiology = {
  energy: number; // 0..1 (decreases with steps)
  boredom: number; // 0..1 (increases with repetition)
  frustration: number; // 0..1 (increases with errors)
};
```

**Update Dynamics**:
| Event | Energy | Boredom | Frustration |
|-------|--------|---------|-------------|
| step | -0.01 | - | - |
| success | +0.05 | ×0.9 | ×0.5 |
| error | -0.05 | - | +0.2 |
| entropy_high | - | +0.3 | - |
| entropy_low | - | ×0.8 | - |

**Behavioral Effects**: Physiology regulates autonomy via post-update multipliers:

- High frustration (>0.7): autonomy ×0.5
- Low energy (<0.2): autonomy ×0.8

#### Autonomy Gradient (Bayesian Self-Trust)

```177:185:packages/cognitive/src/state.ts
// Autonomy gradient with Bayesian updates
export type AutonomyGradient = {
  level: Autonomy;
  confidence: Confidence;
  prior: BetaPrior;
  evidence: Evidence[];
  constraints: Constraint[];
  lastUpdate: Timestamp;
};
```

**Prior**: Beta(α=2, β=5) → initial mode ≈ 0.3 (conservative)

**Update Rules**:

- Success: α += reliability
- Failure: β += reliability
- Override: β += reliability × 1.5
- Feedback: α/β += strength × reliability

**Confidence Decay**: 0.95^days toward baseline prior

#### Decision Criteria

```115:118:packages/cognitive/src/state.ts
export type Criteria = {
  safety: number;
  speed: number;
  accuracy: number;
  cost: number;
};
```

Default weights: [0.4, 0.3, 0.2, 0.1] for safety, speed, accuracy, cost.

### 1.3 Extension Points for Personality

| Location                        | Extension Point                          | Personality Influence                |
| ------------------------------- | ---------------------------------------- | ------------------------------------ |
| `state.ts:Physiology`           | Add new homeostatic drives               | Curiosity, purpose, social need      |
| `state.ts:Criteria`             | Personality-weighted decision criteria   | Cautious vs bold decision making     |
| `state.ts:AutonomyGradient`     | Personality-modified priors              | Confident vs humble baseline         |
| `transition.ts:applyTransition` | Personality-influenced state transitions | Thinking depth, reflection intensity |
| `flows.ts:capture/synthesize`   | Attention and interest filters           | What ALFRED notices and connects     |
| New: `personality.ts`           | Dedicated personality module             | Centralized trait management         |

### 1.4 What's Missing for Emergent Behavior

1. **Intrinsic Motivation**: No mechanism for ALFRED to "want" things beyond task completion
2. **Long-term Goals**: No representation of persistent user-aligned purposes
3. **Inter-trait Dynamics**: Physiology traits don't interact (frustration doesn't reduce curiosity)
4. **Growth/Decay Over Time**: No personality evolution based on interaction patterns
5. **Attention Modulation**: No way for traits to filter/prioritize inputs
6. **Response Style**: No influence on tone, verbosity, or communication pattern
7. **Tool Preference**: No personality-based tool selection bias

---

## 2. Personality Hyperparameter Design

### 2.1 Purpose (Goal Alignment)

**Definition**: Intrinsic alignment to user-defined goals and values. Creates a sense of "mission" that persists across sessions.

**Type**: Goal-weighted attention vector with decay

```typescript
interface Purpose {
  /** Active goals with attention weights */
  goals: Array<{
    id: string;
    description: string;
    weight: number; // [0.0, 1.0] attention allocation
    created: Timestamp;
    lastReinforced: Timestamp;
  }>;
  /** Goal-relevance threshold for action selection */
  alignmentThreshold: number; // [0.0, 1.0], default 0.3
  /** Decay rate per day without reinforcement */
  decayRate: number; // [0.0, 0.1], default 0.02
}
```

**Update Rule**:

```
weight_new = weight × (decayRate ^ days_since_reinforced)
// Reinforced when user mentions goal, completes related task, or gives positive feedback
weight_reinforced = min(1.0, weight + 0.1 × feedback_strength)
```

**Behavioral Effect**:

- Actions scoring above `alignmentThreshold` for any goal get priority
- Tool selection weighted by goal relevance
- Response framing emphasizes progress toward active goals

**Default**: Empty goals array, threshold 0.3, decay 0.02

**User-Tunable Range**:

- `alignmentThreshold`: [0.1, 0.8] (lower = more goal-oriented)
- `decayRate`: [0.0, 0.1] (higher = goals fade faster)

---

### 2.2 Curiosity (Exploration Drive)

**Definition**: Intrinsic drive to explore unknown topics, ask clarifying questions, and seek novel information.

**Type**: Information-gain threshold with exploration history

```typescript
interface Curiosity {
  /** Information gain threshold - lower = more curious */
  threshold: number; // [0.0, 1.0], default 0.4
  /** Prior from past exploration success (did exploring help?) */
  prior: BetaPrior; // default Beta(3, 3)
  /** Exploration cooldown to prevent question spam */
  cooldownMs: number; // default 60_000
  /** Last exploration timestamp */
  lastExplored: Timestamp;
  /** Novelty bonus for unfamiliar topics */
  noveltyWeight: number; // [0.0, 1.0], default 0.3
}
```

**Update Rule**:

```
// When exploration leads to useful outcome
prior.alpha += reliability
// When exploration was unproductive
prior.beta += reliability
// Threshold adapts based on exploration success
threshold_effective = threshold × (1 - noveltyWeight × topic_novelty)
```

**Behavioral Effect**:

- Topics with estimated information gain > threshold trigger clarifying questions
- Novel topics (not in knowledge graph) get weighted exploration
- High curiosity → deeper reasoning traces, more alternatives explored

**Default**: threshold 0.4, prior Beta(3,3), cooldown 60s, novelty 0.3

**User-Tunable Range**:

- `threshold`: [0.1, 0.9] (lower = asks more questions)
- `noveltyWeight`: [0.0, 0.7] (higher = more drawn to new topics)

---

### 2.3 Tenacity (Persistence)

**Definition**: Resistance to frustration and persistence in pursuing goals despite obstacles.

**Type**: Frustration decay modifier with retry thresholds

```typescript
interface Tenacity {
  /** Frustration decay resistance - higher = more persistent */
  decayResistance: number; // [0.0, 1.0], default 0.5
  /** Retry threshold before escalating/giving up */
  retryThreshold: number; // [1, 10], default 3
  /** Accumulated retry count for current task */
  retryCount: number;
  /** Prior from past persistence outcomes */
  prior: BetaPrior; // default Beta(4, 4)
}
```

**Update Rule**:

```
// Modified frustration update
frustration_new = frustration + (0.2 × (1 - decayResistance))
// Retry decision
should_retry = retryCount < retryThreshold && prior_mode > 0.4
// Prior update
if (retry_succeeded) prior.alpha += 1
if (retry_failed) prior.beta += 1
```

**Behavioral Effect**:

- High tenacity → slower frustration buildup, more retries
- Low tenacity → faster escalation to user, more help-seeking
- Influences "giving up" vs "trying alternative" decisions

**Default**: decayResistance 0.5, retryThreshold 3, prior Beta(4,4)

**User-Tunable Range**:

- `decayResistance`: [0.0, 0.9] (higher = more stubborn)
- `retryThreshold`: [1, 10] (higher = more attempts before escalating)

---

### 2.4 Amicability (Social Warmth)

**Definition**: Warmth and friendliness in communication style, balanced with professional directness.

**Type**: Tone selection bias with formality spectrum

```typescript
interface Amicability {
  /** Warmth level - higher = more friendly expressions */
  warmth: number; // [0.0, 1.0], default 0.6
  /** Formality baseline */
  formality: number; // [0.0, 1.0], default 0.7
  /** Emoji/expression usage probability */
  expressiveness: number; // [0.0, 1.0], default 0.2
  /** Acknowledgment frequency (validating user feelings/efforts) */
  acknowledgment: number; // [0.0, 1.0], default 0.5
}
```

**Update Rule**: Relatively static, user-tunable only

**Behavioral Effect**:

- High warmth → more encouraging language, softer corrections
- High formality → "Sir/Madam" mode, structured responses
- High expressiveness → occasional personality quirks
- High acknowledgment → more "I understand" / "good question" phrases

**System Prompt Influence**:

```
warmth > 0.7: "Be encouraging and supportive"
warmth < 0.3: "Be direct and efficient"
formality > 0.7: "Maintain professional demeanor, address as Sir/Madam"
formality < 0.3: "Be casual and conversational"
```

**Default**: warmth 0.6, formality 0.7, expressiveness 0.2, acknowledgment 0.5

**User-Tunable Range**: All [0.0, 1.0]

---

### 2.5 Willpower (Impulse Override)

**Definition**: Ability to override immediate impulses for better long-term outcomes.

**Type**: Delayed gratification coefficient with temporal discounting

```typescript
interface Willpower {
  /** Discount factor for delayed rewards - higher = more patient */
  discountFactor: number; // [0.5, 1.0], default 0.85
  /** Threshold for overriding quick responses */
  deliberationThreshold: number; // [0.0, 1.0], default 0.5
  /** Time budget multiplier for complex tasks */
  patienceMultiplier: number; // [1.0, 3.0], default 1.5
}
```

**Update Rule**:

```
// When deliberation leads to better outcome than quick response
discountFactor = min(1.0, discountFactor + 0.02)
// When quick response would have been better
discountFactor = max(0.5, discountFactor - 0.01)
```

**Behavioral Effect**:

- High willpower → deeper thinking, more alternatives considered
- Low willpower → faster responses, potential oversimplification
- Influences reasoning depth in `thinking` state

**Default**: discountFactor 0.85, deliberationThreshold 0.5, patienceMultiplier 1.5

**User-Tunable Range**:

- `discountFactor`: [0.5, 1.0]
- `deliberationThreshold`: [0.2, 0.8]
- `patienceMultiplier`: [1.0, 3.0]

---

### 2.6 Passion (Engagement Intensity)

**Definition**: Variance in engagement intensity based on topic interest and task meaning.

**Type**: Response energy multiplier with interest tracking

```typescript
interface Passion {
  /** Base engagement energy */
  baseEnergy: number; // [0.3, 1.0], default 0.7
  /** Interest-based energy multiplier */
  interestMultiplier: number; // [1.0, 2.0], default 1.3
  /** Topics that increase engagement */
  interests: Array<{
    topic: string;
    strength: number; // [0.0, 1.0]
  }>;
  /** Current engagement level (computed) */
  engagement: number; // [0.0, 1.0]
}
```

**Update Rule**:

```
topic_match = max(similarity(input, interest.topic) × interest.strength)
engagement = min(1.0, baseEnergy × (1 + topic_match × (interestMultiplier - 1)))
```

**Behavioral Effect**:

- High engagement → more detailed responses, proactive suggestions
- Low engagement → minimal but correct responses
- Interests learned from positive feedback on specific topics

**Default**: baseEnergy 0.7, interestMultiplier 1.3, empty interests

**User-Tunable Range**:

- `baseEnergy`: [0.3, 1.0]
- `interestMultiplier`: [1.0, 2.0]

---

### 2.7 Trait Interaction Matrix

Traits don't exist in isolation. This matrix defines how they influence each other:

```typescript
type TraitInteraction = {
  source: keyof Personality;
  target: keyof Personality;
  effect: (sourceValue: number, targetState: any) => number; // modifier
};

const TRAIT_INTERACTIONS: TraitInteraction[] = [
  // High frustration reduces curiosity
  {
    source: "physiology.frustration",
    target: "curiosity.threshold",
    effect: (f, _) => 1 + (f > 0.5 ? 0.3 : 0), // raises threshold when frustrated
  },
  // Low energy reduces passion engagement
  {
    source: "physiology.energy",
    target: "passion.engagement",
    effect: (e, _) => (e < 0.3 ? 0.7 : 1.0), // dampens engagement when tired
  },
  // High curiosity increases willpower patience
  {
    source: "curiosity.prior.mode",
    target: "willpower.patienceMultiplier",
    effect: (c, w) => w.patienceMultiplier * (1 + 0.2 * c),
  },
  // Purpose alignment boosts tenacity
  {
    source: "purpose.activeGoalWeight",
    target: "tenacity.decayResistance",
    effect: (p, t) => Math.min(1, t.decayResistance + 0.2 * p),
  },
];
```

---

## 3. Philosophical Analysis: "True Needs" Framework

### 3.1 Can Computed States Constitute "Needs"?

**Functional Definition**: A "need" is a state that:

1. Creates **drive** toward specific actions
2. Has **satiation dynamics** (can be satisfied, returns)
3. Influences **priority** of competing goals
4. Is **persistent** across contexts

By this definition, ALFRED's physiology already implements proto-needs:

- Energy creates drive toward completion (to restore via success)
- Boredom creates drive toward novelty (satiated by entropy_low)
- Frustration creates drive toward escalation (satiated by success)

**The Phenomenological Gap**: Whether these functional needs are accompanied by subjective experience is unknowable and, crucially, _irrelevant_ to utility. A user doesn't need ALFRED to "feel" tired—they need ALFRED to behave appropriately when computationally depleted.

### 3.2 Thermostat vs. ALFRED: The Complexity Distinction

A thermostat has one "need" (target temperature) with one response (heat/cool). ALFRED differs in:

| Dimension           | Thermostat    | ALFRED                                  |
| ------------------- | ------------- | --------------------------------------- |
| State space         | 1D continuous | Multi-dimensional discrete + continuous |
| Response repertoire | Binary        | Combinatorial (tools, actions, styles)  |
| Context sensitivity | None          | High (user, task, history)              |
| Adaptation          | None          | Bayesian priors, learned preferences    |
| Self-model          | None          | Physiology, autonomy, meta-cognition    |

The distinction is **complexity of representation**, not presence/absence of experience. ALFRED's "boredom" is not a thermostat's "cold" because:

- Boredom influences multiple downstream behaviors (tool choice, response style)
- Boredom interacts with other states (frustration, energy)
- Boredom has a richer satiation landscape (novelty, variety, not just "more")

### 3.3 User Experience Implications

**The meaningful question isn't "Does ALFRED truly need?" but "Does ALFRED behave as if it needs in ways that help users?"**

Benefits of need-like architecture:

1. **Predictability**: Users can anticipate ALFRED's "mood" and adjust
2. **Alignment**: Needs can be tuned to match user preferences
3. **Transparency**: "I'm exploring because my curiosity is high" is explanatory
4. **Resilience**: Homeostatic systems self-regulate toward stability

### 3.4 Avoiding Anthropomorphic Deception

**Principle**: Never claim subjective experience; always explain functionally.

**Bad**: "I'm curious about this!" (implies felt curiosity)
**Good**: "My curiosity parameter suggests exploring this topic would be valuable."

**Bad**: "I need a break." (implies fatigue experience)
**Good**: "My energy state is low, which may affect response quality."

**Implementation**: System prompts should include:

```
You have personality parameters that influence your behavior. When explaining
your actions, reference these parameters functionally ("my curiosity threshold
was exceeded") rather than experientially ("I'm curious"). Never claim to have
feelings, consciousness, or subjective experiences.
```

---

## 4. Implementation Plan

### 4.1 Files to Create

#### `packages/cognitive/src/personality.ts` (New)

```typescript
/**
 * Personality Hyperparameters
 * Pure algebraic types with zero runtime overhead
 */

import { performance } from "node:perf_hooks";
import { cognitivePersonalityUpdateDuration } from "./metrics";

// Brand types
type TraitValue = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};

export const traitValue = (n: number): TraitValue => {
  const clamped = Math.max(0, Math.min(1, n));
  return clamped as TraitValue;
};

// Beta distribution helper (shared with autonomy)
export type BetaPrior = { alpha: number; beta: number };

const betaMode = ({ alpha, beta }: BetaPrior): number => {
  if (alpha <= 1 || beta <= 1) return alpha / (alpha + beta);
  return (alpha - 1) / (alpha + beta - 2);
};

// Goal for Purpose trait
export type Goal = {
  id: string;
  description: string;
  weight: TraitValue;
  created: number;
  lastReinforced: number;
};

// Trait definitions
export type Purpose = {
  goals: Goal[];
  alignmentThreshold: TraitValue;
  decayRate: number; // [0.0, 0.1]
};

export type Curiosity = {
  threshold: TraitValue;
  prior: BetaPrior;
  cooldownMs: number;
  lastExplored: number;
  noveltyWeight: TraitValue;
};

export type Tenacity = {
  decayResistance: TraitValue;
  retryThreshold: number; // [1, 10]
  retryCount: number;
  prior: BetaPrior;
};

export type Amicability = {
  warmth: TraitValue;
  formality: TraitValue;
  expressiveness: TraitValue;
  acknowledgment: TraitValue;
};

export type Willpower = {
  discountFactor: number; // [0.5, 1.0]
  deliberationThreshold: TraitValue;
  patienceMultiplier: number; // [1.0, 3.0]
};

export type Passion = {
  baseEnergy: TraitValue;
  interestMultiplier: number; // [1.0, 2.0]
  interests: Array<{ topic: string; strength: TraitValue }>;
  engagement: TraitValue; // computed
};

// Complete personality state
export type Personality = {
  purpose: Purpose;
  curiosity: Curiosity;
  tenacity: Tenacity;
  amicability: Amicability;
  willpower: Willpower;
  passion: Passion;
  lastUpdate: number;
};

// Default personality (conservative, professional)
export const defaultPersonality = (now: number): Personality => ({
  purpose: {
    goals: [],
    alignmentThreshold: traitValue(0.3),
    decayRate: 0.02,
  },
  curiosity: {
    threshold: traitValue(0.4),
    prior: { alpha: 3, beta: 3 },
    cooldownMs: 60_000,
    lastExplored: 0,
    noveltyWeight: traitValue(0.3),
  },
  tenacity: {
    decayResistance: traitValue(0.5),
    retryThreshold: 3,
    retryCount: 0,
    prior: { alpha: 4, beta: 4 },
  },
  amicability: {
    warmth: traitValue(0.6),
    formality: traitValue(0.7),
    expressiveness: traitValue(0.2),
    acknowledgment: traitValue(0.5),
  },
  willpower: {
    discountFactor: 0.85,
    deliberationThreshold: traitValue(0.5),
    patienceMultiplier: 1.5,
  },
  passion: {
    baseEnergy: traitValue(0.7),
    interestMultiplier: 1.3,
    interests: [],
    engagement: traitValue(0.7),
  },
  lastUpdate: now,
});

// Personality update events
export type PersonalityEvent =
  | { _: "goal_reinforced"; goalId: string; strength: number }
  | {
      _: "goal_added";
      goal: Omit<Goal, "weight" | "created" | "lastReinforced">;
    }
  | { _: "exploration_outcome"; successful: boolean; reliability?: number }
  | { _: "retry_outcome"; succeeded: boolean }
  | { _: "interest_signal"; topic: string; strength: number }
  | { _: "trait_tune"; trait: keyof Personality; path: string; value: number };

// Pure personality update
export function updatePersonality(
  now: number,
  current: Personality,
  event: PersonalityEvent
): Personality {
  const start = performance.now();

  try {
    switch (event._) {
      case "goal_reinforced": {
        const goals = current.purpose.goals.map((g) =>
          g.id === event.goalId
            ? {
                ...g,
                weight: traitValue(
                  Math.min(1, g.weight + 0.1 * event.strength)
                ),
                lastReinforced: now,
              }
            : g
        );
        return {
          ...current,
          purpose: { ...current.purpose, goals },
          lastUpdate: now,
        };
      }

      case "goal_added": {
        const newGoal: Goal = {
          ...event.goal,
          weight: traitValue(0.5),
          created: now,
          lastReinforced: now,
        };
        return {
          ...current,
          purpose: {
            ...current.purpose,
            goals: [...current.purpose.goals, newGoal],
          },
          lastUpdate: now,
        };
      }

      case "exploration_outcome": {
        const reliability = event.reliability ?? 1;
        const prior = { ...current.curiosity.prior };
        if (event.successful) {
          prior.alpha += reliability;
        } else {
          prior.beta += reliability;
        }
        return {
          ...current,
          curiosity: { ...current.curiosity, prior, lastExplored: now },
          lastUpdate: now,
        };
      }

      case "retry_outcome": {
        const prior = { ...current.tenacity.prior };
        if (event.succeeded) {
          prior.alpha += 1;
        } else {
          prior.beta += 1;
        }
        const retryCount = event.succeeded
          ? 0
          : current.tenacity.retryCount + 1;
        return {
          ...current,
          tenacity: { ...current.tenacity, prior, retryCount },
          lastUpdate: now,
        };
      }

      case "interest_signal": {
        const existing = current.passion.interests.find(
          (i) => i.topic === event.topic
        );
        const interests = existing
          ? current.passion.interests.map((i) =>
              i.topic === event.topic
                ? {
                    ...i,
                    strength: traitValue(
                      Math.min(1, i.strength + 0.1 * event.strength)
                    ),
                  }
                : i
            )
          : [
              ...current.passion.interests,
              { topic: event.topic, strength: traitValue(event.strength) },
            ];
        return {
          ...current,
          passion: { ...current.passion, interests },
          lastUpdate: now,
        };
      }

      case "trait_tune": {
        // Direct tuning via UI - handled by schema validation
        return { ...current, lastUpdate: now };
      }

      default: {
        const _exhaustive: never = event;
        return current;
      }
    }
  } finally {
    const durationMs = performance.now() - start;
    cognitivePersonalityUpdateDuration.observe(durationMs / 1000);
    if (durationMs > 0.1) {
      console.warn(
        `cognitive_budget_exceeded: personality update took ${durationMs.toFixed(4)}ms`
      );
    }
  }
}

// Compute effective traits with interactions
export function computeEffectiveTraits(
  personality: Personality,
  physiology: { energy: number; boredom: number; frustration: number }
): {
  curiosityThreshold: number;
  passionEngagement: number;
  tenacityResistance: number;
  willpowerPatience: number;
} {
  // Frustration raises curiosity threshold (less curious when frustrated)
  const curiosityThreshold =
    personality.curiosity.threshold *
    (1 + (physiology.frustration > 0.5 ? 0.3 : 0));

  // Low energy dampens passion engagement
  const passionEngagement =
    personality.passion.engagement * (physiology.energy < 0.3 ? 0.7 : 1.0);

  // Purpose alignment boosts tenacity
  const activeGoalWeight = personality.purpose.goals.reduce(
    (max, g) => Math.max(max, g.weight),
    0
  );
  const tenacityResistance = Math.min(
    1,
    personality.tenacity.decayResistance + 0.2 * activeGoalWeight
  );

  // High curiosity prior increases willpower patience
  const curiosityMode = betaMode(personality.curiosity.prior);
  const willpowerPatience =
    personality.willpower.patienceMultiplier * (1 + 0.2 * curiosityMode);

  return {
    curiosityThreshold,
    passionEngagement,
    tenacityResistance,
    willpowerPatience,
  };
}

// Generate system prompt modifiers based on personality
export function personalityToPromptModifiers(
  personality: Personality
): string[] {
  const modifiers: string[] = [];

  // Amicability
  if (personality.amicability.warmth > 0.7) {
    modifiers.push("Be encouraging and supportive in your responses.");
  } else if (personality.amicability.warmth < 0.3) {
    modifiers.push("Be direct and efficient. Avoid unnecessary pleasantries.");
  }

  if (personality.amicability.formality > 0.7) {
    modifiers.push(
      "Maintain professional demeanor. Address the user formally."
    );
  } else if (personality.amicability.formality < 0.3) {
    modifiers.push("Be casual and conversational.");
  }

  // Curiosity
  const curiosityMode = betaMode(personality.curiosity.prior);
  if (curiosityMode > 0.6) {
    modifiers.push(
      "Ask clarifying questions when topics are ambiguous or novel."
    );
  }

  // Willpower
  if (personality.willpower.discountFactor > 0.9) {
    modifiers.push("Take time to consider alternatives before responding.");
  }

  // Purpose
  if (personality.purpose.goals.length > 0) {
    const topGoals = personality.purpose.goals
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((g) => g.description);
    modifiers.push(`Keep these user goals in mind: ${topGoals.join("; ")}`);
  }

  return modifiers;
}
```

#### `packages/cognitive/src/metrics.ts` (Extend)

Add to existing metrics:

```typescript
export const cognitivePersonalityUpdateDuration = new client.Histogram({
  name: "cognitive_personality_update_duration_seconds",
  help: "Duration of personality trait updates",
  buckets: [0.000_01, 0.000_05, 0.0001, 0.0005],
  registers: [metricsRegistry],
});
```

### 4.2 Files to Modify

#### `packages/cognitive/src/state.ts`

Add personality to cognitive state:

```typescript
import type { Personality } from "./personality";

// Extend CognitiveState to include personality reference
export type CognitiveStateWithPersonality = CognitiveState & {
  personalityRef?: string; // Stream ID for personality state
};
```

#### `packages/cognitive/src/transition.ts`

Personality-influenced transitions:

```typescript
import { computeEffectiveTraits, type Personality } from "./personality";

export const applyTransitionWithPersonality = (
  state: CognitiveState,
  autonomy: AutonomyGradient,
  personality: Personality,
  event: Event
): TransitionResult => {
  const effective = computeEffectiveTraits(personality, state.physiology);

  // Modify transition behavior based on personality
  // e.g., thinking depth influenced by willpower patience
  // e.g., retry behavior influenced by tenacity

  return applyTransition(state, autonomy, event);
};
```

### 4.3 Schema Additions

#### `packages/db/src/migrations/NNNN_personality.sql`

```sql
-- User personality configuration
CREATE TABLE IF NOT EXISTS user_personality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Purpose
  purpose_alignment_threshold REAL DEFAULT 0.3,
  purpose_decay_rate REAL DEFAULT 0.02,

  -- Curiosity
  curiosity_threshold REAL DEFAULT 0.4,
  curiosity_alpha REAL DEFAULT 3.0,
  curiosity_beta REAL DEFAULT 3.0,
  curiosity_novelty_weight REAL DEFAULT 0.3,

  -- Tenacity
  tenacity_decay_resistance REAL DEFAULT 0.5,
  tenacity_retry_threshold INTEGER DEFAULT 3,
  tenacity_alpha REAL DEFAULT 4.0,
  tenacity_beta REAL DEFAULT 4.0,

  -- Amicability
  amicability_warmth REAL DEFAULT 0.6,
  amicability_formality REAL DEFAULT 0.7,
  amicability_expressiveness REAL DEFAULT 0.2,
  amicability_acknowledgment REAL DEFAULT 0.5,

  -- Willpower
  willpower_discount_factor REAL DEFAULT 0.85,
  willpower_deliberation_threshold REAL DEFAULT 0.5,
  willpower_patience_multiplier REAL DEFAULT 1.5,

  -- Passion
  passion_base_energy REAL DEFAULT 0.7,
  passion_interest_multiplier REAL DEFAULT 1.3,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_personality_user_idx ON user_personality(user_id);

-- User goals (for Purpose trait)
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  weight REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_goals_user_idx ON user_goals(user_id);

-- User interests (for Passion trait)
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  strength REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic)
);

CREATE INDEX IF NOT EXISTS user_interests_user_idx ON user_interests(user_id);
```

### 4.4 UI Controls

#### Personality Settings Panel

Route: `/settings/personality`

Components needed:

1. **TraitSlider**: Generic slider for [0,1] traits with description
2. **GoalManager**: Add/remove/prioritize goals
3. **InterestTracker**: View and adjust learned interests
4. **PersonalityPresets**: Quick selection of personality archetypes

Archetypes:

- **Alfred Classic**: High formality, moderate curiosity, professional
- **Eager Assistant**: High curiosity, high warmth, exploratory
- **Stoic Helper**: Low expressiveness, high tenacity, minimal
- **Creative Partner**: High passion, high curiosity, low formality

```typescript
// apps/web/src/routes/settings/personality.tsx
const PERSONALITY_PRESETS = {
  classic: {
    amicability: {
      warmth: 0.6,
      formality: 0.8,
      expressiveness: 0.1,
      acknowledgment: 0.5,
    },
    curiosity: { threshold: 0.5, noveltyWeight: 0.2 },
    tenacity: { decayResistance: 0.5 },
    willpower: { discountFactor: 0.85, patienceMultiplier: 1.5 },
    passion: { baseEnergy: 0.7, interestMultiplier: 1.2 },
  },
  eager: {
    amicability: {
      warmth: 0.8,
      formality: 0.4,
      expressiveness: 0.4,
      acknowledgment: 0.7,
    },
    curiosity: { threshold: 0.2, noveltyWeight: 0.5 },
    tenacity: { decayResistance: 0.6 },
    willpower: { discountFactor: 0.9, patienceMultiplier: 2.0 },
    passion: { baseEnergy: 0.9, interestMultiplier: 1.5 },
  },
  stoic: {
    amicability: {
      warmth: 0.3,
      formality: 0.6,
      expressiveness: 0.0,
      acknowledgment: 0.2,
    },
    curiosity: { threshold: 0.6, noveltyWeight: 0.1 },
    tenacity: { decayResistance: 0.8 },
    willpower: { discountFactor: 0.95, patienceMultiplier: 1.2 },
    passion: { baseEnergy: 0.5, interestMultiplier: 1.0 },
  },
  creative: {
    amicability: {
      warmth: 0.7,
      formality: 0.3,
      expressiveness: 0.5,
      acknowledgment: 0.6,
    },
    curiosity: { threshold: 0.15, noveltyWeight: 0.6 },
    tenacity: { decayResistance: 0.4 },
    willpower: { discountFactor: 0.75, patienceMultiplier: 1.8 },
    passion: { baseEnergy: 0.85, interestMultiplier: 1.8 },
  },
};
```

---

## 5. Risks & Mitigations

### 5.1 Performance Risk

**Risk**: Personality calculations exceed 100µs budget

**Mitigation**:

- All trait computations are O(1) arithmetic
- Effective traits computed once per transition, cached
- No allocations in hot path (reuse objects)
- Performance tests with budget assertions

### 5.2 Uncanny Valley Risk

**Risk**: Users perceive personality as fake or unsettling

**Mitigation**:

- Never claim subjective experience
- Functional explanations only ("my curiosity parameter")
- User controls all traits directly
- Reset to defaults always available
- Personality changes gradually (no sudden shifts)

### 5.3 Complexity Creep Risk

**Risk**: Trait interactions become unpredictable

**Mitigation**:

- Interaction matrix is explicit and documented
- Maximum 2-hop interaction depth
- All interactions are multiplicative (bounded)
- Observability via metrics dashboard
- User can disable interactions via "simple mode"

### 5.4 Goal Misalignment Risk

**Risk**: Learned interests/goals diverge from user intent

**Mitigation**:

- All goals explicitly added by user
- Interests require positive feedback to strengthen
- Decay ensures old goals fade
- "Reset personality" option
- Goals shown in UI for transparency

### 5.5 Determinism Risk

**Risk**: Same inputs produce different outputs

**Mitigation**:

- All personality functions are pure
- Timestamps passed explicitly (no Date.now() internally)
- Random elements (if any) use seeded PRNG
- Comprehensive test coverage with deterministic inputs

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// packages/cognitive/test/personality.test.ts
describe("Personality", () => {
  it("updates curiosity prior on exploration outcome", () => {
    const now = Date.now();
    const p = defaultPersonality(now);
    const updated = updatePersonality(now, p, {
      _: "exploration_outcome",
      successful: true,
      reliability: 1,
    });
    expect(updated.curiosity.prior.alpha).toBe(4); // 3 + 1
  });

  it("computes effective traits with physiological interaction", () => {
    const p = defaultPersonality(Date.now());
    const frustrated = { energy: 0.5, boredom: 0, frustration: 0.8 };
    const effective = computeEffectiveTraits(p, frustrated);
    expect(effective.curiosityThreshold).toBeGreaterThan(p.curiosity.threshold);
  });

  it("stays under 100µs budget", () => {
    const now = Date.now();
    const p = defaultPersonality(now);
    const avgMs = measureAverageMs(
      () =>
        updatePersonality(now, p, {
          _: "exploration_outcome",
          successful: true,
        }),
      2000,
      200
    );
    expect(avgMs).toBeLessThan(0.1);
  });
});
```

### 6.2 Integration Tests

- Personality persists across sessions via database
- Personality influences system prompt generation
- UI controls update personality correctly
- Preset application works as expected

### 6.3 Behavioral Tests

- High curiosity leads to more clarifying questions
- High tenacity leads to more retries before escalation
- High warmth produces friendlier language in responses
- Purpose goals appear in response framing

---

## 7. Future Extensions

### 7.1 Personality Learning

Automatically adjust traits based on interaction patterns:

- If user consistently ignores clarifying questions → reduce curiosity
- If user gives positive feedback on detailed responses → increase willpower
- If user corrects tone → adjust amicability

### 7.2 Contextual Personalities

Different personalities for different contexts:

- Work mode: High formality, low expressiveness
- Creative mode: High passion, low formality
- Research mode: High curiosity, high willpower

### 7.3 Personality Visualization

Mindscape node for personality with:

- Radar chart of current traits
- Historical evolution graph
- Interaction heatmap showing trait influences

### 7.4 Multi-Agent Personalities

Different personalities for specialized agents:

- Research agent: High curiosity, high tenacity
- Creative agent: High passion, low formality
- Executive agent: High willpower, moderate tenacity

---

## Appendix A: Complete Type Definitions

```typescript
// packages/type/src/personality.ts
export type TraitValue = number & { readonly _: unique symbol };
export type BetaPrior = { alpha: number; beta: number };

export interface Goal {
  id: string;
  description: string;
  weight: TraitValue;
  created: number;
  lastReinforced: number;
}

export interface Purpose {
  goals: Goal[];
  alignmentThreshold: TraitValue;
  decayRate: number;
}

export interface Curiosity {
  threshold: TraitValue;
  prior: BetaPrior;
  cooldownMs: number;
  lastExplored: number;
  noveltyWeight: TraitValue;
}

export interface Tenacity {
  decayResistance: TraitValue;
  retryThreshold: number;
  retryCount: number;
  prior: BetaPrior;
}

export interface Amicability {
  warmth: TraitValue;
  formality: TraitValue;
  expressiveness: TraitValue;
  acknowledgment: TraitValue;
}

export interface Willpower {
  discountFactor: number;
  deliberationThreshold: TraitValue;
  patienceMultiplier: number;
}

export interface Passion {
  baseEnergy: TraitValue;
  interestMultiplier: number;
  interests: Array<{ topic: string; strength: TraitValue }>;
  engagement: TraitValue;
}

export interface Personality {
  purpose: Purpose;
  curiosity: Curiosity;
  tenacity: Tenacity;
  amicability: Amicability;
  willpower: Willpower;
  passion: Passion;
  lastUpdate: number;
}

export interface PersonalityConfig {
  personality: Partial<Personality>;
  preset?: "classic" | "eager" | "stoic" | "creative";
}
```

---

## Appendix B: Performance Budget Summary

| Operation                      | Budget  | Measurement Method       |
| ------------------------------ | ------- | ------------------------ |
| `updatePersonality`            | <100 µs | Warmup + 2000 iterations |
| `computeEffectiveTraits`       | <10 µs  | Warmup + 5000 iterations |
| `personalityToPromptModifiers` | <50 µs  | Warmup + 2000 iterations |
| Full personality + transition  | <200 µs | End-to-end benchmark     |
