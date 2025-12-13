# AlphaEvolve-Informed Personality Architecture Critique

**Owner**: cognition  
**Status**: Design Review  
**Date**: 2025-12-13

---

## Executive Summary

After analyzing the AlphaEvolve paper against ALFRED's proposed personality hyperparameters, the critique reveals:

- **2 traits should be removed** (Amicability, Passion) - no self-improvement value
- **3 traits need significant modification** (Purpose, Curiosity, Tenacity)
- **5 traits should be added** for coding self-improvement
- **The core architecture is sound** but biased toward human interaction rather than autonomous improvement

AlphaEvolve's key insight: **self-improvement comes from evolutionary search with rich feedback, not anthropomorphic personality traits**.

---

## 1. AlphaEvolve Key Mechanisms

### 1.1 Evolutionary Core

AlphaEvolve operates as a **code superoptimization agent** using evolutionary computation:

```
┌─────────────────┐
│  Prompt Sampler │ ← Samples from Program Database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   LLM Ensemble  │ ← Gemini Flash (throughput) + Pro (quality)
└────────┬────────┘
         │ generates diffs
         ▼
┌─────────────────┐
│   Evaluators    │ ← Multiple metrics, cascaded hypothesis testing
└────────┬────────┘
         │ scores
         ▼
┌─────────────────┐
│ Program Database│ ← MAP-Elites + Island populations
└─────────────────┘
```

### 1.2 Critical Self-Improvement Mechanisms

| Mechanism | What It Does | Personality Analog? |
|-----------|--------------|---------------------|
| **MAP-Elites** | Maintains diverse solutions across behavioral dimensions | ✗ Missing |
| **Island Populations** | Parallel exploration of different solution regions | ✗ Missing |
| **Evaluation Cascade** | Progressive filtering of unpromising solutions | ~ Willpower (partial) |
| **Multi-Objective Optimization** | Evolves for multiple metrics simultaneously | ~ Purpose (weak) |
| **Meta-Prompt Evolution** | Co-evolves prompts alongside solutions | ✗ Missing |
| **Abstraction Level Choice** | Raw solution vs constructor vs search algorithm | ✗ Missing |
| **Model Ensemble** | Fast (throughput) + powerful (quality) mix | ✗ Missing |
| **Rich Context Injection** | Problem-specific equations, papers, code | ~ Curiosity (weak) |
| **LLM-Generated Feedback** | Simplicity, elegance grading by LLM | ✗ Missing |

### 1.3 AlphaEvolve "Personality-Like" Hyperparameters

From the ablations and method sections:

```typescript
// Implicit AlphaEvolve "traits"
interface AlphaEvolveConfig {
  // Exploration vs Exploitation
  diversityPressure: number;      // MAP-Elites selection pressure
  islandMigrationRate: number;    // Cross-population breeding
  
  // Adaptation Rate
  evaluationCascadeStages: number; // How quickly to prune
  metaPromptMutationRate: number;  // How fast prompts evolve
  
  // Quality vs Quantity
  modelMix: { flash: number; pro: number }; // Throughput vs quality
  contextRichness: "minimal" | "explicit" | "literature";
  
  // Abstraction
  evolutionScope: "function" | "file" | "codebase";
  representationLevel: "direct" | "constructor" | "search";
}
```

---

## 2. Critique of Proposed Traits

### 2.1 Purpose ✓ (Needs Modification)

**Current Design**: Goal-weighted attention vector with decay

**AlphaEvolve Analog**: Multiple evaluation metrics

**Critique**:
- ✓ **Good**: Persistent goals across sessions
- ✗ **Missing**: Multi-objective optimization framing
- ✗ **Missing**: Goal evolution (AlphaEvolve co-evolves objectives)
- ✗ **Wrong Framing**: "Reinforcement on mention" is passive; AlphaEvolve actively seeks metric improvement

**Modification Required**:

```typescript
interface Purpose {
  // EXISTING (keep)
  goals: Goal[];
  alignmentThreshold: TraitValue;
  decayRate: number;
  
  // NEW: Multi-objective optimization
  objectives: Array<{
    id: string;
    metric: string;            // "test_pass_rate" | "execution_time" | "code_complexity"
    weight: TraitValue;        // Relative importance
    currentBest: number;       // Best achieved value
    improvementHistory: number[]; // Track progress
  }>;
  
  // NEW: Active improvement mode
  activeOptimization: boolean; // Background improvement enabled?
  optimizationBudget: number;  // Compute budget per session
}
```

**Coding-Specific Effect**: When `activeOptimization=true`, ALFRED proactively searches for improvements to past solutions during idle time.

---

### 2.2 Curiosity ✓ (Needs Modification)

**Current Design**: Information-gain threshold with exploration history

**AlphaEvolve Analog**: MAP-Elites exploration + rich context injection

**Critique**:
- ✓ **Good**: Bayesian prior on exploration success
- ✗ **Missing**: Behavioral diversity preservation (MAP-Elites core feature)
- ✗ **Missing**: Context injection depth control
- ✗ **Wrong Focus**: "Clarifying questions" is user-facing; AlphaEvolve explores solution space

**Modification Required**:

```typescript
interface Curiosity {
  // EXISTING (keep)
  threshold: TraitValue;
  prior: BetaPrior;
  noveltyWeight: TraitValue;
  
  // REMOVE (user-facing, not self-improvement)
  // cooldownMs: number;
  // lastExplored: Timestamp;
  
  // NEW: Solution space exploration
  diversityPressure: number;     // [0.0, 1.0] - How much to favor novel solutions
  explorationTemperature: number; // [0.1, 2.0] - LLM sampling temperature for generation
  contextDepth: "minimal" | "explicit" | "literature" | "full";
  
  // NEW: Behavioral dimensions to diversify across
  diversityAxes: Array<{
    axis: string;     // "code_style" | "algorithm_family" | "complexity" | "language"
    granularity: number; // Bins for MAP-Elites
  }>;
}
```

**Coding-Specific Effect**: Higher `diversityPressure` causes ALFRED to maintain multiple qualitatively different solutions rather than converging to one approach.

---

### 2.3 Tenacity ✓ (Needs Modification)

**Current Design**: Frustration decay resistance with retry thresholds

**AlphaEvolve Analog**: Evolutionary persistence + abstraction level switching

**Critique**:
- ✓ **Good**: Retry logic with Bayesian prior
- ✗ **Missing**: Abstraction level switching (key AlphaEvolve insight)
- ✗ **Missing**: Strategy backtracking (island populations can explore abandoned regions)
- ✗ **Too Simple**: Fixed retry threshold; AlphaEvolve adapts based on problem structure

**Key AlphaEvolve Insight**: When stuck, don't just retry—change the abstraction level:
- Direct solution → Constructor function → Search algorithm
- "For problems with non-symmetric solutions it works better to evolve customized search algorithms"

**Modification Required**:

```typescript
interface Tenacity {
  // EXISTING (keep)
  decayResistance: TraitValue;
  retryThreshold: number;
  prior: BetaPrior;
  
  // REMOVE (too simplistic)
  // retryCount: number;
  
  // NEW: Abstraction level management
  currentAbstraction: "direct" | "constructor" | "search" | "meta-search";
  abstractionSwitchThreshold: number; // Failures before switching level
  abstractionHistory: Array<{
    level: string;
    attempts: number;
    bestResult: number;
  }>;
  
  // NEW: Strategy backtracking
  abandonedStrategies: Array<{
    strategy: string;
    abandonedAt: Timestamp;
    lastScore: number;
  }>;
  backtrackProbability: number; // Chance to revisit abandoned approaches
}
```

**Coding-Specific Effect**: After N failures, ALFRED automatically switches from "generate solution" to "generate solution-constructor" to "generate search algorithm that finds solution."

---

### 2.4 Amicability ✗ (REMOVE)

**Current Design**: Warmth/formality/expressiveness for communication style

**AlphaEvolve Analog**: **NONE**

**Critique**:
- ✗ **No self-improvement value**: Tone doesn't affect code quality
- ✗ **User-facing only**: Relevant for human interaction, not autonomous improvement
- ✗ **Static trait**: No learning dynamics that would enable evolution
- ✗ **Scope creep**: Personality system should focus on cognitive architecture, not communication

**Recommendation**: **Remove from personality module**. Move to separate `communication.ts` style configuration that is user-tunable but not part of cognitive architecture.

---

### 2.5 Willpower ~ (Needs Major Rework)

**Current Design**: Delayed gratification coefficient for deliberation

**AlphaEvolve Analog**: Evaluation cascade + compute budget management

**Critique**:
- ~ **Partial overlap**: Deliberation threshold maps loosely to evaluation cascade
- ✗ **Wrong metaphor**: "Impulse override" is psychological; AlphaEvolve is computational
- ✗ **Missing**: Compute budget allocation (AlphaEvolve key parameter)
- ✗ **Missing**: Progressive evaluation (easy→hard stages)

**Modification Required**:

```typescript
interface Deliberation {
  // RENAMED from Willpower (remove psychological framing)
  
  // KEEP (reframed)
  deliberationThreshold: TraitValue; // When to invest more compute
  
  // REMOVE (psychological metaphor)
  // discountFactor: number;
  // patienceMultiplier: number;
  
  // NEW: Evaluation cascade
  evaluationStages: Array<{
    name: string;           // "syntax_check" | "unit_test" | "integration" | "benchmark"
    computeBudget: number;  // Max seconds for this stage
    passThreshold: number;  // Score needed to proceed
  }>;
  
  // NEW: Compute budget management
  totalBudget: number;         // Total compute seconds per task
  budgetAllocation: {
    generation: number;        // % for generating candidates
    evaluation: number;        // % for testing candidates
    exploration: number;       // % for diverse sampling
  };
}
```

**Coding-Specific Effect**: Progressive evaluation catches bad solutions early ("fail fast") while reserving compute budget for thorough testing of promising candidates.

---

### 2.6 Passion ✗ (REMOVE)

**Current Design**: Interest-based engagement multiplier

**AlphaEvolve Analog**: **NONE**

**Critique**:
- ✗ **No self-improvement value**: "Enthusiasm" doesn't improve code
- ✗ **Anthropomorphic decoration**: Creates illusion of personality without function
- ✗ **Worse**: Could cause ALFRED to do *worse* on "boring" but important tasks
- ✗ **No AlphaEvolve analog**: Evolutionary systems don't have "passion"

**Recommendation**: **Remove entirely**. If response energy variation is desired, derive it from task success metrics, not simulated emotion.

---

## 3. Missing Traits for Self-Improvement

Based on AlphaEvolve mechanisms, ALFRED needs these additional traits:

### 3.1 Confidence (Calibration)

**Definition**: Knowing what ALFRED knows vs doesn't know. Critical for deciding when to explore vs exploit.

**AlphaEvolve Analog**: Evaluation cascade confidence + score distributions

```typescript
interface Confidence {
  /** Domain-specific calibration */
  domainCalibration: Map<string, {
    domain: string;              // "typescript" | "python" | "sql" | "algorithms"
    predictedAccuracy: number;   // ALFRED's self-assessed competence
    observedAccuracy: number;    // Actual performance on domain tasks
    calibrationError: number;    // |predicted - observed|
    sampleCount: number;         // Tasks completed in domain
  }>;
  
  /** Global overconfidence/underconfidence */
  calibrationBias: number; // [-1, 1] negative=underconfident, positive=overconfident
  
  /** Epistemic humility threshold */
  uncertaintyThreshold: number; // [0.0, 1.0] - When to say "I don't know"
  
  /** Update rule */
  updateOnFeedback(domain: string, predicted: boolean, actual: boolean): void;
}
```

**Behavioral Effect**:
- Low confidence in domain → more cautious, more verification, asks for examples
- High calibration error → triggers recalibration, seeks feedback
- Well-calibrated → efficient resource allocation between exploration/exploitation

---

### 3.2 MetaLearning (Strategy Evolution)

**Definition**: Rate at which ALFRED updates its own strategies based on experience. Direct analog to AlphaEvolve's meta-prompt evolution.

**AlphaEvolve Analog**: Meta-prompt co-evolution

```typescript
interface MetaLearning {
  /** How quickly to adapt strategies */
  learningRate: number; // [0.01, 0.5], default 0.1
  
  /** Prompt/strategy templates that evolve */
  strategyPopulation: Array<{
    id: string;
    template: string;           // Parameterized approach
    fitness: number;            // Success rate
    generationCount: number;    // How many tasks used this
    mutations: string[];        // History of changes
  }>;
  
  /** Strategy selection */
  selectionPressure: number; // [0.0, 1.0] - How strongly to favor successful strategies
  mutationRate: number;      // [0.0, 0.3] - Probability of trying variation
  
  /** Cross-strategy learning */
  crossoverEnabled: boolean; // Combine elements from different strategies
  elitePreservation: number; // Top N strategies always preserved
}
```

**Behavioral Effect**:
- High learning rate → quickly adopts new approaches, may be unstable
- Low learning rate → conservative, thorough validation before adoption
- Strategy population provides diverse starting points (like AlphaEvolve's program database)

---

### 3.3 Aesthetics (Code Quality Preference)

**Definition**: Preference for elegant, simple, maintainable solutions over expedient ones. AlphaEvolve uses LLM-generated feedback for this.

**AlphaEvolve Analog**: LLM-generated simplicity/elegance feedback

```typescript
interface Aesthetics {
  /** Quality vs speed tradeoff */
  qualityBias: number; // [0.0, 1.0] - Higher = prefer elegant over fast
  
  /** Specific style preferences */
  preferences: {
    complexity: "minimal" | "moderate" | "any";  // Cyclomatic complexity tolerance
    abstraction: "concrete" | "balanced" | "abstract"; // Prefer explicit vs DRY
    verbosity: "terse" | "balanced" | "explicit"; // Comment/naming verbosity
    patterns: string[]; // Favored design patterns
    antiPatterns: string[]; // Patterns to avoid
  };
  
  /** Self-assessment of code quality */
  assessQuality(code: string): {
    elegance: number;      // Subjective beauty
    simplicity: number;    // Inverse complexity
    maintainability: number;
    score: number;         // Weighted combination
  };
  
  /** LLM-graded feedback weight */
  llmFeedbackWeight: number; // [0.0, 1.0] - How much to trust LLM aesthetic judgment
}
```

**Behavioral Effect**:
- High aesthetics + high qualityBias → refactors aggressively, may over-engineer
- Low aesthetics → pragmatic "good enough" solutions
- Self-assessment provides additional optimization signal beyond functional correctness

---

### 3.4 SolutionDiversity (Population Management)

**Definition**: Explicit management of solution diversity, directly implementing MAP-Elites for code.

**AlphaEvolve Analog**: MAP-Elites + Island populations

```typescript
interface SolutionDiversity {
  /** Behavioral dimensions for diversity */
  behavioralDimensions: Array<{
    name: string;              // "algorithm_type" | "time_complexity" | "space_complexity"
    discretization: number;    // Number of bins
    extractor: (code: string) => number; // Maps code to dimension value
  }>;
  
  /** Population per niche */
  nicheSize: number; // Max solutions per behavioral cell
  
  /** Island model parameters */
  islands: {
    count: number;             // Number of parallel populations
    migrationRate: number;     // Fraction exchanged per generation
    migrationInterval: number; // Generations between migrations
  };
  
  /** Diversity pressure in selection */
  noveltyWeight: number; // [0.0, 1.0] - Weight novelty vs fitness in selection
  
  /** Elite preservation */
  eliteFraction: number; // [0.0, 0.3] - Top fraction always preserved
}
```

**Behavioral Effect**:
- High diversity pressure → maintains many qualitatively different solutions
- Island model → parallel exploration of different solution regions
- Prevents premature convergence to local optima

---

### 3.5 SkillAcquisition (Competence Growth)

**Definition**: Drive to expand capabilities in new domains/tools. Not just curiosity about information, but active skill building.

**AlphaEvolve Analog**: Full-file evolution + expanding codebase scope

```typescript
interface SkillAcquisition {
  /** Current skill inventory */
  skills: Map<string, {
    domain: string;           // "react" | "postgres" | "kubernetes"
    proficiency: TraitValue;  // [0, 1] competence level
    lastPracticed: Timestamp;
    practiceCount: number;
    decayRate: number;        // Skill atrophy without practice
  }>;
  
  /** Skill acquisition drive */
  acquisitionDrive: TraitValue; // How motivated to learn new skills
  
  /** Adjacent skill targeting */
  adjacencyBonus: number; // Bonus for skills adjacent to existing competencies
  
  /** Practice allocation */
  practiceMode: "opportunistic" | "deliberate" | "none";
  dailyPracticeBudget: number; // Minutes allocated to skill building
  
  /** Skill gap detection */
  detectGaps(task: string): string[]; // Returns skills needed but not possessed
}
```

**Behavioral Effect**:
- High acquisition drive → proactively learns tools encountered in tasks
- Deliberate practice mode → allocates idle time to skill exercises
- Adjacency bonus → strategic skill tree expansion

---

## 4. Proposed Revised Trait Architecture

### 4.1 Trait Categories

```
COGNITIVE TRAITS (Self-Improvement Core)
├── Purpose (multi-objective goals)
├── Curiosity (exploration/diversity)
├── Deliberation (compute allocation)
├── Tenacity (abstraction switching)
├── Confidence (calibration)
├── MetaLearning (strategy evolution)
└── SolutionDiversity (population management)

CAPABILITY TRAITS (Competence)
├── SkillAcquisition (learning drive)
└── Aesthetics (code quality)

REMOVED (No Self-Improvement Value)
├── Amicability → move to communication config
└── Passion → remove entirely
```

### 4.2 Trait Interaction Matrix (Revised)

```typescript
const TRAIT_INTERACTIONS: TraitInteraction[] = [
  // Frustration dampens exploration (existing, keep)
  {
    source: "physiology.frustration",
    target: "curiosity.explorationTemperature",
    effect: (f) => f > 0.5 ? 0.7 : 1.0, // Reduce temperature when frustrated
  },
  
  // Low confidence increases deliberation
  {
    source: "confidence.calibrationError",
    target: "deliberation.totalBudget",
    effect: (e) => 1 + 0.5 * e, // More compute when uncertain
  },
  
  // High diversity pressure increases exploration temperature
  {
    source: "solutionDiversity.noveltyWeight",
    target: "curiosity.explorationTemperature",
    effect: (n, c) => c.explorationTemperature * (1 + 0.3 * n),
  },
  
  // Many retries triggers abstraction switch
  {
    source: "tenacity.abstractionHistory.length",
    target: "tenacity.currentAbstraction",
    effect: (h, t) => h > t.abstractionSwitchThreshold ? "next_level" : "same",
  },
  
  // Skill gaps increase acquisition drive
  {
    source: "skillAcquisition.detectGaps",
    target: "skillAcquisition.acquisitionDrive",
    effect: (gaps) => Math.min(1, 0.3 + 0.1 * gaps.length),
  },
  
  // High aesthetics increases deliberation budget
  {
    source: "aesthetics.qualityBias",
    target: "deliberation.budgetAllocation.evaluation",
    effect: (q, d) => d.evaluation * (1 + 0.3 * q),
  },
  
  // MetaLearning success reduces curiosity threshold
  {
    source: "metaLearning.strategyPopulation.avgFitness",
    target: "curiosity.threshold",
    effect: (f, c) => c.threshold * (1 - 0.2 * f), // Successful strategies → more exploration
  },
];
```

### 4.3 Background vs Active Improvement Modes

**Intrinsic (Background) Improvement**:
```typescript
interface BackgroundImprovement {
  enabled: boolean;
  
  // What triggers background work
  triggers: {
    idleTime: number;        // Seconds idle before starting
    lowConfidenceDomain: number; // Calibration error threshold
    staleSkill: number;      // Days since practice
  };
  
  // What background work does
  activities: {
    solutionRefinement: boolean;  // Improve past solutions
    skillPractice: boolean;       // Exercise weak skills
    strategyEvolution: boolean;   // Evolve meta-prompts
    diversityMaintenance: boolean; // Prune/expand solution population
  };
  
  // Resource limits
  budgetPerSession: number; // Max compute seconds
  interruptible: boolean;   // Can user interrupt?
}
```

**Purposeful (Active) Improvement**:
```typescript
interface ActiveImprovement {
  // User-triggered improvement goals
  currentGoal: {
    type: "optimize" | "learn" | "diversify" | "calibrate";
    target: string;           // What to improve
    budget: number;           // Allowed compute
    deadline?: Timestamp;     // When to stop
  } | null;
  
  // Progress tracking
  progress: {
    startMetric: number;
    currentMetric: number;
    iterations: number;
    breakthroughs: string[]; // Significant discoveries
  };
}
```

---

## 5. Implementation Modifications

### 5.1 Files to Modify

#### `packages/cognitive/src/personality.ts`

Replace proposed implementation with self-improvement focused traits:

```typescript
// REMOVE
// - Amicability
// - Passion

// MODIFY
// - Purpose → add objectives, activeOptimization
// - Curiosity → add diversityPressure, explorationTemperature, remove cooldown
// - Tenacity → add abstraction switching, strategy backtracking
// - Willpower → rename to Deliberation, add evaluation cascade, compute budget

// ADD
// - Confidence
// - MetaLearning
// - SolutionDiversity
// - SkillAcquisition
// - Aesthetics

export type CodingPersonality = {
  // Core cognitive traits
  purpose: Purpose;
  curiosity: Curiosity;
  deliberation: Deliberation;
  tenacity: Tenacity;
  confidence: Confidence;
  metaLearning: MetaLearning;
  solutionDiversity: SolutionDiversity;
  
  // Capability traits
  skillAcquisition: SkillAcquisition;
  aesthetics: Aesthetics;
  
  // Improvement modes
  backgroundImprovement: BackgroundImprovement;
  activeImprovement: ActiveImprovement;
  
  // Metadata
  lastUpdate: Timestamp;
  version: number;
};
```

### 5.2 New Files to Create

#### `packages/cognitive/src/evolution.ts`

Implement AlphaEvolve-style evolutionary mechanics:

```typescript
/**
 * Solution Evolution Engine
 * Implements MAP-Elites + Island populations for code improvement
 */

export interface SolutionCandidate {
  id: string;
  code: string;
  metrics: Map<string, number>;
  behavioralDescriptor: number[]; // Position in behavior space
  generation: number;
  parentId?: string;
  mutationType?: string;
}

export interface EvaluationResult {
  candidate: SolutionCandidate;
  scores: Map<string, number>;
  passedStages: string[];
  failedAt?: string;
  executionTime: number;
}

export class SolutionPopulation {
  private archive: Map<string, SolutionCandidate[]>; // Behavioral cell → candidates
  private islands: SolutionCandidate[][];
  
  constructor(config: SolutionDiversity) { /* ... */ }
  
  add(candidate: SolutionCandidate): boolean { /* ... */ }
  sample(n: number): SolutionCandidate[] { /* ... */ }
  migrate(): void { /* ... */ }
  prune(): void { /* ... */ }
}

export class EvaluationCascade {
  private stages: EvaluationStage[];
  
  constructor(config: Deliberation) { /* ... */ }
  
  async evaluate(candidate: SolutionCandidate): Promise<EvaluationResult> {
    for (const stage of this.stages) {
      const result = await stage.run(candidate);
      if (result.score < stage.passThreshold) {
        return { ...result, failedAt: stage.name };
      }
    }
    return result;
  }
}
```

#### `packages/cognitive/src/metaprompt.ts`

Implement meta-prompt evolution:

```typescript
/**
 * Meta-Prompt Evolution
 * Prompts/strategies evolve alongside solutions
 */

export interface StrategyTemplate {
  id: string;
  template: string;
  parameters: Map<string, string>;
  fitness: number;
  uses: number;
}

export class StrategyEvolver {
  private population: StrategyTemplate[];
  private config: MetaLearning;
  
  constructor(config: MetaLearning) { /* ... */ }
  
  select(): StrategyTemplate { /* ... */ }
  mutate(strategy: StrategyTemplate): StrategyTemplate { /* ... */ }
  crossover(a: StrategyTemplate, b: StrategyTemplate): StrategyTemplate { /* ... */ }
  updateFitness(id: string, outcome: boolean): void { /* ... */ }
}
```

### 5.3 Schema Changes

#### `packages/db/src/migrations/NNNN_personality_v2.sql`

```sql
-- Rename and restructure personality table
ALTER TABLE user_personality RENAME TO user_personality_v1;

CREATE TABLE IF NOT EXISTS user_personality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  
  -- Purpose (multi-objective)
  purpose_alignment_threshold REAL DEFAULT 0.3,
  purpose_decay_rate REAL DEFAULT 0.02,
  purpose_active_optimization BOOLEAN DEFAULT false,
  purpose_optimization_budget INTEGER DEFAULT 300, -- seconds
  
  -- Curiosity (exploration)
  curiosity_threshold REAL DEFAULT 0.4,
  curiosity_alpha REAL DEFAULT 3.0,
  curiosity_beta REAL DEFAULT 3.0,
  curiosity_diversity_pressure REAL DEFAULT 0.5,
  curiosity_exploration_temp REAL DEFAULT 1.0,
  curiosity_context_depth TEXT DEFAULT 'explicit',
  
  -- Deliberation (compute allocation)
  deliberation_threshold REAL DEFAULT 0.5,
  deliberation_total_budget INTEGER DEFAULT 60, -- seconds
  deliberation_generation_pct REAL DEFAULT 0.4,
  deliberation_evaluation_pct REAL DEFAULT 0.4,
  deliberation_exploration_pct REAL DEFAULT 0.2,
  
  -- Tenacity (abstraction switching)
  tenacity_decay_resistance REAL DEFAULT 0.5,
  tenacity_retry_threshold INTEGER DEFAULT 3,
  tenacity_alpha REAL DEFAULT 4.0,
  tenacity_beta REAL DEFAULT 4.0,
  tenacity_abstraction_switch_threshold INTEGER DEFAULT 5,
  tenacity_backtrack_probability REAL DEFAULT 0.1,
  
  -- Confidence (calibration)
  confidence_calibration_bias REAL DEFAULT 0.0,
  confidence_uncertainty_threshold REAL DEFAULT 0.7,
  
  -- MetaLearning
  meta_learning_rate REAL DEFAULT 0.1,
  meta_selection_pressure REAL DEFAULT 0.5,
  meta_mutation_rate REAL DEFAULT 0.1,
  meta_crossover_enabled BOOLEAN DEFAULT true,
  meta_elite_preservation INTEGER DEFAULT 3,
  
  -- SolutionDiversity
  diversity_niche_size INTEGER DEFAULT 5,
  diversity_island_count INTEGER DEFAULT 3,
  diversity_migration_rate REAL DEFAULT 0.1,
  diversity_novelty_weight REAL DEFAULT 0.3,
  diversity_elite_fraction REAL DEFAULT 0.1,
  
  -- SkillAcquisition
  skill_acquisition_drive REAL DEFAULT 0.5,
  skill_adjacency_bonus REAL DEFAULT 0.3,
  skill_practice_mode TEXT DEFAULT 'opportunistic',
  skill_daily_budget INTEGER DEFAULT 30, -- minutes
  
  -- Aesthetics
  aesthetics_quality_bias REAL DEFAULT 0.5,
  aesthetics_complexity_pref TEXT DEFAULT 'moderate',
  aesthetics_abstraction_pref TEXT DEFAULT 'balanced',
  aesthetics_verbosity_pref TEXT DEFAULT 'balanced',
  aesthetics_llm_feedback_weight REAL DEFAULT 0.5,
  
  -- Background improvement
  background_enabled BOOLEAN DEFAULT true,
  background_idle_trigger INTEGER DEFAULT 300, -- seconds
  background_budget INTEGER DEFAULT 120, -- seconds per session
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategy templates table
CREATE TABLE IF NOT EXISTS strategy_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  template TEXT NOT NULL,
  fitness REAL DEFAULT 0.5,
  uses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategy_templates_user_idx ON strategy_templates(user_id);
CREATE INDEX IF NOT EXISTS strategy_templates_fitness_idx ON strategy_templates(user_id, fitness DESC);

-- Solution archive table (MAP-Elites)
CREATE TABLE IF NOT EXISTS solution_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  code TEXT NOT NULL,
  behavioral_descriptor REAL[] NOT NULL, -- Position in behavior space
  metrics JSONB NOT NULL,
  generation INTEGER DEFAULT 0,
  parent_id UUID REFERENCES solution_archive(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solution_archive_user_task_idx ON solution_archive(user_id, task_id);
CREATE INDEX IF NOT EXISTS solution_archive_descriptor_idx ON solution_archive USING GIN (behavioral_descriptor);

-- Skill inventory table
CREATE TABLE IF NOT EXISTS user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  proficiency REAL DEFAULT 0.0,
  last_practiced TIMESTAMPTZ DEFAULT NOW(),
  practice_count INTEGER DEFAULT 0,
  decay_rate REAL DEFAULT 0.01,
  UNIQUE(user_id, domain)
);

CREATE INDEX IF NOT EXISTS user_skills_user_idx ON user_skills(user_id);

-- Domain calibration table
CREATE TABLE IF NOT EXISTS confidence_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  predicted_accuracy REAL DEFAULT 0.5,
  observed_accuracy REAL DEFAULT 0.5,
  sample_count INTEGER DEFAULT 0,
  UNIQUE(user_id, domain)
);

CREATE INDEX IF NOT EXISTS confidence_calibration_user_idx ON confidence_calibration(user_id);
```

---

## 6. Performance Considerations

### 6.1 Budget Allocation

New traits introduce compute overhead. Budget guidelines:

| Operation | Budget | Notes |
|-----------|--------|-------|
| Trait updates | <100 µs | Same as existing |
| Evaluation cascade (per stage) | <10 ms | Stage timeout handles slow eval |
| Population sampling | <1 ms | Pre-indexed behavioral cells |
| Strategy selection | <100 µs | Cached fitness values |
| Diversity calculation | <5 ms | Batch with generation |

### 6.2 Background Improvement Limits

```typescript
const BACKGROUND_LIMITS = {
  maxConcurrentEvaluations: 3,
  maxPopulationSize: 1000,
  maxStrategyPopulation: 50,
  checkpointInterval: 60_000, // Save state every minute
  yieldInterval: 100, // Yield to user tasks every 100ms
};
```

---

## 7. Summary

### Traits Removed (No Self-Improvement Value)

| Trait | Reason |
|-------|--------|
| Amicability | User-facing communication style, not cognitive |
| Passion | Anthropomorphic decoration with no functional benefit |

### Traits Modified (AlphaEvolve-Informed)

| Trait | Key Changes |
|-------|-------------|
| Purpose | Added multi-objective optimization, active improvement mode |
| Curiosity | Added diversity pressure, exploration temperature, removed user-facing cooldown |
| Tenacity | Added abstraction level switching, strategy backtracking |
| Willpower→Deliberation | Renamed, added evaluation cascade, compute budget allocation |

### Traits Added (Missing for Self-Improvement)

| Trait | AlphaEvolve Analog |
|-------|-------------------|
| Confidence | Evaluation cascade confidence, knows what it doesn't know |
| MetaLearning | Meta-prompt co-evolution, strategy learning |
| SolutionDiversity | MAP-Elites + island populations |
| SkillAcquisition | Full-file evolution, expanding capability scope |
| Aesthetics | LLM-generated simplicity/elegance feedback |

### Key Insight

> **AlphaEvolve succeeds through evolutionary mechanics with rich feedback, not anthropomorphic personality. ALFRED's personality should be a _cognitive architecture for self-improvement_, not a simulation of human traits.**
