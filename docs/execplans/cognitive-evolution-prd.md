# ALFRED Cognitive Evolution PRD

**Owner**: cognition  
**Status**: Proposed  
**Created**: 2025-12-13  
**Linear Project**: ALF-COGEVO

---

## 1. Executive Summary

ALFRED's cognitive architecture requires evolution from anthropomorphic personality traits toward self-improvement mechanisms informed by AlphaEvolve's evolutionary coding agent. This PRD transforms the AlphaEvolve critique into an actionable implementation plan: removing 2 traits without self-improvement value (Amicability, Passion), modifying 4 traits to align with evolutionary mechanics (Purpose, Curiosity, Tenacity, Willpower→Deliberation), and adding 5 new traits for autonomous coding improvement (Confidence, MetaLearning, SolutionDiversity, SkillAcquisition, Aesthetics). The result enables ALFRED to improve both intrinsically (background self-optimization) and purposefully (user-directed improvement).

---

## 2. Problem Statement

### Current State

ALFRED's proposed personality architecture is **biased toward human interaction rather than autonomous improvement**:

1. **Anthropomorphic traits** (Amicability, Passion) create illusion of personality without improving code quality
2. **Missing evolutionary mechanics**: No solution diversity (MAP-Elites), no strategy evolution (meta-prompts), no confidence calibration
3. **Passive improvement**: "Reinforcement on mention" waits for user; AlphaEvolve actively seeks metric improvement
4. **No abstraction switching**: Fixed approach regardless of problem structure
5. **No compute budget management**: No progressive evaluation or resource allocation

### Desired State

A **cognitive architecture for self-improvement** that:

1. Maintains diverse solutions across behavioral dimensions (MAP-Elites)
2. Co-evolves strategies alongside solutions (meta-prompt evolution)
3. Knows what it knows vs doesn't know (confidence calibration)
4. Actively improves during idle time (background optimization)
5. Allocates compute efficiently (evaluation cascade)

---

## 3. Goals & Non-Goals

### Goals

1. **Implement revised trait system** with 9 self-improvement focused traits
2. **Add solution diversity management** via MAP-Elites behavioral archive
3. **Add strategy evolution** for prompt/approach co-evolution
4. **Add confidence calibration** for domain-specific accuracy tracking
5. **Enable background improvement** during idle periods
6. **Expose tunable parameters** via settings UI
7. **Maintain <100µs performance budgets** for trait computations

### Non-Goals

1. **Not implementing full AlphaEvolve**: We adapt mechanisms, not replicate the system
2. **Not changing cognitive state machine**: Personality augments, doesn't replace, existing states
3. **Not adding anthropomorphic behavior**: Functional traits only, no simulated emotions
4. **Not breaking existing physiology**: Energy/boredom/frustration remain; personality extends
5. **Not requiring LLM for trait updates**: Trait computations are pure functions

---

## 4. Technical Architecture

### 4.1 Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        @alfred/type                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ personality │  │  cognitive  │  │  knowledge  │              │
│  │   .types    │  │   (exist)   │  │   (exist)   │              │
│  └──────┬──────┘  └─────────────┘  └─────────────┘              │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      @alfred/cognitive                           │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   state.ts  │◄────│ personality │────►│  evolution  │        │
│  │  (existing) │     │    .ts      │     │    .ts      │        │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘        │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ transition  │     │  strategy   │     │ calibration │        │
│  │    .ts      │◄────│    .ts      │     │    .ts      │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         @alfred/db                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │schema/          │  │schema/          │  │repo/             │ │
│  │ personality.ts  │  │ cognitive.ts    │  │ personality.ts   │ │
│  │    (new)        │  │  (existing)     │  │    (new)         │ │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         @alfred/api                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ routers/personality.ts (new)                                 ││
│  │  - get/set trait values                                      ││
│  │  - trigger active improvement                                ││
│  │  - get calibration stats                                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 New Files

| File | Purpose | Exports | Depends On | Budget |
|------|---------|---------|------------|--------|
| `packages/type/src/personality.ts` | Type definitions | `Personality`, `Purpose`, `Curiosity`, etc. | `@alfred/type/cognitive` | N/A |
| `packages/cognitive/src/personality.ts` | Trait state & updates | `defaultPersonality`, `updatePersonality`, `computeEffective` | `@alfred/type/personality` | <100µs |
| `packages/cognitive/src/evolution.ts` | Solution population | `SolutionPopulation`, `EvaluationCascade` | `@alfred/type/personality` | <5ms |
| `packages/cognitive/src/strategy.ts` | Strategy evolution | `StrategyEvolver`, `selectStrategy`, `mutateStrategy` | `@alfred/type/personality` | <1ms |
| `packages/cognitive/src/calibration.ts` | Confidence tracking | `updateCalibration`, `getCalibrationError` | `@alfred/type/personality` | <100µs |
| `packages/cognitive/src/queue.ts` | Task queue processor | `processQueue`, `selectNextTask`, `executeIntent` | `@alfred/type/personality` | <10ms |
| `packages/db/src/schema/personality.ts` | DB schema | `personality`, `strategies`, `solutions`, `skills`, `calibration` | drizzle-orm | N/A |
| `packages/db/src/schema/queue.ts` | Task queue schema | `taskQueue` | drizzle-orm | N/A |
| `packages/db/src/repo/personality.ts` | CRUD operations | `getPersonality`, `setPersonality`, `addSolution`, etc. | schema/personality | <10ms |
| `packages/db/src/repo/queue.ts` | Queue CRUD | `addTask`, `getReady`, `updateStatus`, `unblockDependents` | schema/queue | <10ms |
| `packages/api/src/routers/personality.ts` | tRPC procedures | `get`, `set`, `calibrationStats`, `triggerImprove` | repo/personality | N/A |
| `packages/api/src/routers/queue.ts` | Queue tRPC procedures | `add`, `list`, `cancel`, `status` | repo/queue | N/A |

### 4.3 Type Hierarchy

```typescript
// packages/type/src/personality.ts

import type { BetaPrior, Timestamp } from "./cognitive";

// Branded scalar [0, 1]
export type TraitValue = number & { readonly _brand: "TraitValue" };

// ═══════════════════════════════════════════════════════════════
// CORE COGNITIVE TRAITS
// ═══════════════════════════════════════════════════════════════

export interface Purpose {
  goals: Goal[];
  objectives: Objective[];
  alignmentThreshold: TraitValue;
  decayRate: number;
  activeOptimization: boolean;
  optimizationBudget: number;
}

export interface Curiosity {
  threshold: TraitValue;
  prior: BetaPrior;
  noveltyWeight: TraitValue;
  diversityPressure: number;
  explorationTemperature: number;
  contextDepth: "minimal" | "explicit" | "literature" | "full";
}

export interface Deliberation {
  threshold: TraitValue;
  evaluationStages: EvaluationStage[];
  totalBudget: number;
  budgetAllocation: BudgetAllocation;
}

export interface Tenacity {
  decayResistance: TraitValue;
  retryThreshold: number;
  prior: BetaPrior;
  currentAbstraction: AbstractionLevel;
  abstractionSwitchThreshold: number;
  abstractionHistory: AbstractionAttempt[];
  abandonedStrategies: AbandonedStrategy[];
  backtrackProbability: number;
}

export interface Confidence {
  domainCalibration: DomainCalibration[];
  calibrationBias: number;
  uncertaintyThreshold: TraitValue;
}

export interface MetaLearning {
  learningRate: number;
  selectionPressure: number;
  mutationRate: number;
  crossoverEnabled: boolean;
  elitePreservation: number;
}

export interface SolutionDiversity {
  behavioralDimensions: BehavioralDimension[];
  nicheSize: number;
  islands: IslandConfig;
  noveltyWeight: TraitValue;
  eliteFraction: number;
}

// ═══════════════════════════════════════════════════════════════
// CAPABILITY TRAITS
// ═══════════════════════════════════════════════════════════════

export interface SkillAcquisition {
  acquisitionDrive: TraitValue;
  adjacencyBonus: number;
  practiceMode: "opportunistic" | "deliberate" | "none";
  dailyPracticeBudget: number;
}

export interface Aesthetics {
  qualityBias: TraitValue;
  complexity: "minimal" | "moderate" | "any";
  abstraction: "concrete" | "balanced" | "abstract";
  verbosity: "terse" | "balanced" | "explicit";
  llmFeedbackWeight: TraitValue;
}

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT MODES
// ═══════════════════════════════════════════════════════════════

export interface BackgroundImprovement {
  enabled: boolean;
  triggers: ImprovementTriggers;
  activities: ImprovementActivities;
  budgetPerSession: number;
  interruptible: boolean;
}

export interface ActiveImprovement {
  currentGoal: ImprovementGoal | null;
  progress: ImprovementProgress;
}

// ═══════════════════════════════════════════════════════════════
// COMPLETE PERSONALITY
// ═══════════════════════════════════════════════════════════════

export interface Personality {
  // Core cognitive
  purpose: Purpose;
  curiosity: Curiosity;
  deliberation: Deliberation;
  tenacity: Tenacity;
  confidence: Confidence;
  metaLearning: MetaLearning;
  solutionDiversity: SolutionDiversity;
  
  // Capability
  skillAcquisition: SkillAcquisition;
  aesthetics: Aesthetics;
  
  // Improvement modes
  backgroundImprovement: BackgroundImprovement;
  activeImprovement: ActiveImprovement;
  
  // Metadata
  lastUpdate: Timestamp;
  version: number;
}

// ═══════════════════════════════════════════════════════════════
// SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════════

export interface Goal {
  id: string;
  description: string;
  weight: TraitValue;
  created: Timestamp;
  lastReinforced: Timestamp;
}

export interface Objective {
  id: string;
  metric: string;
  weight: TraitValue;
  currentBest: number;
  improvementHistory: number[];
}

export interface EvaluationStage {
  name: string;
  computeBudget: number;
  passThreshold: number;
}

export interface BudgetAllocation {
  generation: number;
  evaluation: number;
  exploration: number;
}

export type AbstractionLevel = "direct" | "constructor" | "search" | "metasearch";

export interface AbstractionAttempt {
  level: AbstractionLevel;
  attempts: number;
  bestResult: number;
}

export interface AbandonedStrategy {
  strategy: string;
  abandonedAt: Timestamp;
  lastScore: number;
}

export interface DomainCalibration {
  domain: string;
  predictedAccuracy: number;
  observedAccuracy: number;
  calibrationError: number;
  sampleCount: number;
}

export interface BehavioralDimension {
  name: string;
  discretization: number;
}

export interface IslandConfig {
  count: number;
  migrationRate: number;
  migrationInterval: number;
}

export interface ImprovementTriggers {
  idleTime: number;
  lowConfidenceDomain: number;
  staleSkill: number;
  taskQueueDepth: number;  // Process queue when depth exceeds threshold
}

// ═══════════════════════════════════════════════════════════════
// TASK QUEUING TYPES
// ═══════════════════════════════════════════════════════════════

export type TaskTrigger = 
  | { _: "time"; due: Timestamp }
  | { _: "idle"; minIdleMs: number }
  | { _: "completion"; blockedBy: string }
  | { _: "recurring"; cron: string };

export type TaskIntent =
  | { _: "workflow"; workflowId: string; params: Record<string, unknown> }
  | { _: "notification"; channel: "push" | "email" | "in-app" }
  | { _: "improvement"; type: ImprovementGoal["type"]; target: string };

export interface QueuedTask {
  id: string;
  userId: string;
  title: string;
  trigger: TaskTrigger;
  intent: TaskIntent;
  priority: number;         // Higher = more urgent
  status: "pending" | "blocked" | "ready" | "running" | "completed" | "failed";
  blockedBy?: string;       // Task ID this depends on
  created: Timestamp;
  scheduled?: Timestamp;    // When task became ready
}

export interface ImprovementActivities {
  solutionRefinement: boolean;
  skillPractice: boolean;
  strategyEvolution: boolean;
  diversityMaintenance: boolean;
}

export interface ImprovementGoal {
  type: "optimize" | "learn" | "diversify" | "calibrate";
  target: string;
  budget: number;
  deadline?: Timestamp;
}

export interface ImprovementProgress {
  startMetric: number;
  currentMetric: number;
  iterations: number;
  breakthroughs: string[];
}
```

### 4.4 Data Flow: Background Improvement

```
┌─────────────────────────────────────────────────────────────────┐
│                     IDLE DETECTION                               │
│  cognitive.state._ === "idle" && duration > triggers.idleTime   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ACTIVITY SELECTION                             │
│  Based on: calibrationError, staleSkills, populationAge         │
│  Output: "solutionRefinement" | "skillPractice" | "strategy"    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  SOLUTION    │  │    SKILL     │  │  STRATEGY    │
│  REFINEMENT  │  │   PRACTICE   │  │  EVOLUTION   │
│              │  │              │  │              │
│ 1. Sample    │  │ 1. Detect    │  │ 1. Select    │
│    archive   │  │    gap       │  │    parent    │
│ 2. Generate  │  │ 2. Generate  │  │ 2. Mutate    │
│    variant   │  │    exercise  │  │    template  │
│ 3. Evaluate  │  │ 3. Attempt   │  │ 3. Evaluate  │
│ 4. Archive   │  │ 4. Update    │  │    fitness   │
│    if better │  │    skill     │  │ 4. Archive   │
└──────────────┘  └──────────────┘  └──────────────┘
           │               │               │
           └───────────────┴───────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BUDGET EXHAUSTED?                             │
│  if compute_used < budgetPerSession: continue                   │
│  else: return to idle                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Data Flow: Active Improvement

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER TRIGGERS                                 │
│  trpc.personality.triggerImprove({ type, target, budget })      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  IMPROVEMENT LOOP                                │
│                                                                  │
│  while (budget > 0 && !deadline) {                              │
│    candidate = generate(target, strategy)                        │
│    result = evaluationCascade.run(candidate)                    │
│    if (result.passed) {                                         │
│      archive.add(candidate)                                      │
│      progress.currentMetric = max(progress.currentMetric, score)│
│      if (significant_improvement) {                             │
│        progress.breakthroughs.push(description)                 │
│      }                                                          │
│    }                                                            │
│    strategy = strategyEvolver.adapt(result)                     │
│    budget -= result.computeUsed                                 │
│  }                                                              │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REPORT RESULTS                                │
│  { bestCandidate, progress, strategiesEvolved }                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Data Flow: Task Queuing & Deferred Execution

Task queuing extends idle detection to process user-queued work alongside self-improvement.

```
┌─────────────────────────────────────────────────────────────────┐
│                    TASK INGESTION                                │
│  Sources: reminders (onFire), user commands, workflow outputs   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TASK QUEUE (DB)                                │
│  task_queue table with trigger, intent, priority, blockedBy     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    TIME      │  │    IDLE      │  │  COMPLETION  │
│   TRIGGER    │  │   TRIGGER    │  │   TRIGGER    │
│              │  │              │  │              │
│ scheduler    │  │ cognitive    │  │ workflow     │
│ polls due    │  │ state idle   │  │ finishes     │
│ tasks        │  │ > threshold  │  │ → unblock    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TASK PROCESSOR                                 │
│                                                                  │
│  1. Select highest-priority ready task                          │
│  2. Parse intent (workflow | notification | improvement)        │
│  3. Execute intent via appropriate subsystem                    │
│  4. Update task status                                          │
│  5. Unblock dependent tasks                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   WORKFLOW   │  │ NOTIFICATION │  │ IMPROVEMENT  │
│   EXECUTOR   │  │   SENDER     │  │    LOOP      │
│              │  │              │  │              │
│ createRun()  │  │ SSE/push/    │  │ triggerImp   │
│ stream       │  │ email        │  │ rove()       │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Integration with Background Improvement:**

When cognitive state enters idle and `idleTime` threshold is met:
1. Check task queue for ready tasks (priority-ordered)
2. If tasks exist → process highest priority task
3. If no tasks → proceed to background improvement activities
4. Respect `budgetPerSession` across both task processing and improvement

---

## 5. API Surface

### 5.1 New tRPC Procedures

```typescript
// packages/api/src/routers/personality.ts

export const personalityRouter = router({
  // ═══════════════════════════════════════════════════════════
  // TRAIT MANAGEMENT
  // ═══════════════════════════════════════════════════════════
  
  get: authedProcedure
    .query(async ({ ctx }) => {
      // Returns full personality config for user
    }),
  
  set: authedProcedure
    .input(z.object({
      trait: z.enum([
        "purpose", "curiosity", "deliberation", "tenacity",
        "confidence", "metaLearning", "solutionDiversity",
        "skillAcquisition", "aesthetics",
        "backgroundImprovement", "activeImprovement"
      ]),
      path: z.string(),       // Dot-notation path within trait
      value: z.unknown(),     // New value (validated per trait)
    }))
    .mutation(async ({ ctx, input }) => {
      // Updates specific trait parameter
    }),
  
  reset: authedProcedure
    .input(z.object({
      trait: z.enum([...]).optional(), // Omit = reset all
    }))
    .mutation(async ({ ctx, input }) => {
      // Resets to defaults
    }),
  
  // ═══════════════════════════════════════════════════════════
  // CALIBRATION
  // ═══════════════════════════════════════════════════════════
  
  calibration: authedProcedure
    .query(async ({ ctx }) => {
      // Returns domain calibration stats
    }),
  
  recordPrediction: authedProcedure
    .input(z.object({
      domain: z.string(),
      predicted: z.boolean(), // Did ALFRED predict success?
      actual: z.boolean(),    // Was it actually successful?
    }))
    .mutation(async ({ ctx, input }) => {
      // Updates calibration for domain
    }),
  
  // ═══════════════════════════════════════════════════════════
  // IMPROVEMENT
  // ═══════════════════════════════════════════════════════════
  
  triggerImprove: authedProcedure
    .input(z.object({
      type: z.enum(["optimize", "learn", "diversify", "calibrate"]),
      target: z.string(),
      budget: z.number().min(10).max(3600), // seconds
      deadline: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Starts active improvement session
    }),
  
  improvementStatus: authedProcedure
    .query(async ({ ctx }) => {
      // Returns current improvement progress
    }),
  
  cancelImprovement: authedProcedure
    .mutation(async ({ ctx }) => {
      // Stops active improvement
    }),
  
  // ═══════════════════════════════════════════════════════════
  // SOLUTION ARCHIVE
  // ═══════════════════════════════════════════════════════════
  
  solutions: authedProcedure
    .input(z.object({
      taskId: z.string().optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      // Returns solution archive
    }),
  
  // ═══════════════════════════════════════════════════════════
  // STRATEGIES
  // ═══════════════════════════════════════════════════════════
  
  strategies: authedProcedure
    .query(async ({ ctx }) => {
      // Returns strategy population with fitness
    }),
  
  // ═══════════════════════════════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════════════════════════════
  
  skills: authedProcedure
    .query(async ({ ctx }) => {
      // Returns skill inventory
    }),
});
```

---

## 6. Database Schema

```sql
-- packages/db/src/migrations/NNNN_personality.sql

-- ═══════════════════════════════════════════════════════════════
-- PERSONALITY CONFIGURATION
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_personality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  
  -- Purpose
  purpose_alignment_threshold REAL DEFAULT 0.3,
  purpose_decay_rate REAL DEFAULT 0.02,
  purpose_active_optimization BOOLEAN DEFAULT false,
  purpose_optimization_budget INTEGER DEFAULT 300,
  
  -- Curiosity
  curiosity_threshold REAL DEFAULT 0.4,
  curiosity_alpha REAL DEFAULT 3.0,
  curiosity_beta REAL DEFAULT 3.0,
  curiosity_diversity_pressure REAL DEFAULT 0.5,
  curiosity_exploration_temp REAL DEFAULT 1.0,
  curiosity_context_depth TEXT DEFAULT 'explicit',
  
  -- Deliberation
  deliberation_threshold REAL DEFAULT 0.5,
  deliberation_total_budget INTEGER DEFAULT 60,
  deliberation_generation_pct REAL DEFAULT 0.4,
  deliberation_evaluation_pct REAL DEFAULT 0.4,
  deliberation_exploration_pct REAL DEFAULT 0.2,
  
  -- Tenacity
  tenacity_decay_resistance REAL DEFAULT 0.5,
  tenacity_retry_threshold INTEGER DEFAULT 3,
  tenacity_alpha REAL DEFAULT 4.0,
  tenacity_beta REAL DEFAULT 4.0,
  tenacity_abstraction_switch INTEGER DEFAULT 5,
  tenacity_backtrack_probability REAL DEFAULT 0.1,
  
  -- Confidence
  confidence_calibration_bias REAL DEFAULT 0.0,
  confidence_uncertainty_threshold REAL DEFAULT 0.7,
  
  -- MetaLearning
  metalearning_rate REAL DEFAULT 0.1,
  metalearning_selection_pressure REAL DEFAULT 0.5,
  metalearning_mutation_rate REAL DEFAULT 0.1,
  metalearning_crossover BOOLEAN DEFAULT true,
  metalearning_elite INTEGER DEFAULT 3,
  
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
  skill_daily_budget INTEGER DEFAULT 30,
  
  -- Aesthetics
  aesthetics_quality_bias REAL DEFAULT 0.5,
  aesthetics_complexity TEXT DEFAULT 'moderate',
  aesthetics_abstraction TEXT DEFAULT 'balanced',
  aesthetics_verbosity TEXT DEFAULT 'balanced',
  aesthetics_llm_feedback_weight REAL DEFAULT 0.5,
  
  -- BackgroundImprovement
  background_enabled BOOLEAN DEFAULT true,
  background_idle_trigger INTEGER DEFAULT 300,
  background_budget INTEGER DEFAULT 120,
  background_interruptible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_personality_user_idx ON user_personality(user_id);

-- ═══════════════════════════════════════════════════════════════
-- GOALS & OBJECTIVES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  weight REAL DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_goals_user_idx ON user_goals(user_id);

CREATE TABLE IF NOT EXISTS user_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  weight REAL DEFAULT 0.5,
  current_best REAL DEFAULT 0.0,
  improvement_history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_objectives_user_idx ON user_objectives(user_id);

-- ═══════════════════════════════════════════════════════════════
-- CALIBRATION
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS confidence_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  predicted_accuracy REAL DEFAULT 0.5,
  observed_accuracy REAL DEFAULT 0.5,
  sample_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

CREATE INDEX IF NOT EXISTS confidence_calibration_user_idx ON confidence_calibration(user_id);

-- ═══════════════════════════════════════════════════════════════
-- STRATEGIES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS strategy_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  template TEXT NOT NULL,
  parameters JSONB DEFAULT '{}',
  fitness REAL DEFAULT 0.5,
  uses INTEGER DEFAULT 0,
  generation INTEGER DEFAULT 0,
  parent_id UUID REFERENCES strategy_templates(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategy_templates_user_idx ON strategy_templates(user_id);
CREATE INDEX IF NOT EXISTS strategy_templates_fitness_idx ON strategy_templates(user_id, fitness DESC);

-- ═══════════════════════════════════════════════════════════════
-- SOLUTION ARCHIVE (MAP-Elites)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS solution_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  code TEXT NOT NULL,
  behavioral_cell TEXT NOT NULL,  -- Serialized position in behavior space
  metrics JSONB NOT NULL,
  fitness REAL NOT NULL,
  generation INTEGER DEFAULT 0,
  parent_id UUID REFERENCES solution_archive(id),
  island_id INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solution_archive_user_task_idx ON solution_archive(user_id, task_id);
CREATE INDEX IF NOT EXISTS solution_archive_cell_idx ON solution_archive(user_id, behavioral_cell);
CREATE INDEX IF NOT EXISTS solution_archive_fitness_idx ON solution_archive(user_id, fitness DESC);

-- ═══════════════════════════════════════════════════════════════
-- SKILLS
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- ABSTRACTION HISTORY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS abstraction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  level TEXT NOT NULL,  -- 'direct' | 'constructor' | 'search' | 'metasearch'
  attempts INTEGER DEFAULT 1,
  best_result REAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS abstraction_history_user_task_idx ON abstraction_history(user_id, task_id);

-- ═══════════════════════════════════════════════════════════════
-- TASK QUEUE (Deferred Execution)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Trigger configuration (discriminated union via trigger_type)
  trigger_type TEXT NOT NULL,  -- 'time' | 'idle' | 'completion' | 'recurring'
  trigger_due TIMESTAMPTZ,     -- For 'time' trigger
  trigger_idle_ms INTEGER,     -- For 'idle' trigger (min idle duration)
  trigger_blocked_by UUID REFERENCES task_queue(id),  -- For 'completion' trigger
  trigger_cron TEXT,           -- For 'recurring' trigger
  
  -- Intent configuration (discriminated union via intent_type)
  intent_type TEXT NOT NULL,   -- 'workflow' | 'notification' | 'improvement'
  intent_workflow_id TEXT,     -- For 'workflow' intent
  intent_params JSONB,         -- For 'workflow' intent parameters
  intent_channel TEXT,         -- For 'notification' intent ('push' | 'email' | 'in-app')
  intent_improve_type TEXT,    -- For 'improvement' intent
  intent_improve_target TEXT,  -- For 'improvement' intent
  
  -- Execution state
  priority INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'blocked' | 'ready' | 'running' | 'completed' | 'failed'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,    -- When task became ready
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS task_queue_user_status_idx ON task_queue(user_id, status);
CREATE INDEX IF NOT EXISTS task_queue_ready_priority_idx ON task_queue(status, priority DESC) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS task_queue_due_idx ON task_queue(trigger_due) WHERE trigger_type = 'time' AND status = 'pending';
CREATE INDEX IF NOT EXISTS task_queue_blocked_idx ON task_queue(trigger_blocked_by) WHERE trigger_type = 'completion';

-- Add intent field to existing reminders for workflow triggering
ALTER TABLE assistant_reminders ADD COLUMN IF NOT EXISTS intent_type TEXT;
ALTER TABLE assistant_reminders ADD COLUMN IF NOT EXISTS intent_data JSONB;
```

---

## 7. UI Requirements

### 7.1 Settings Panel Structure

```
/settings/personality
├── Overview (trait radar chart)
├── Cognitive Traits
│   ├── Purpose (goals, objectives, optimization toggle)
│   ├── Curiosity (diversity pressure, temperature)
│   ├── Deliberation (budget allocation sliders)
│   ├── Tenacity (retry threshold, abstraction switch)
│   └── Confidence (calibration stats, bias indicator)
├── Learning Traits
│   ├── MetaLearning (learning rate, mutation rate)
│   ├── SolutionDiversity (niche size, island config)
│   └── SkillAcquisition (practice mode, budget)
├── Quality Traits
│   └── Aesthetics (quality bias, complexity preference)
├── Improvement Modes
│   ├── Background (toggle, triggers, activities)
│   └── Active (trigger button, progress display)
└── Presets
    ├── Balanced (default)
    ├── Aggressive Explorer (high diversity, temperature)
    ├── Conservative Expert (low mutation, high calibration)
    └── Speed Demon (low deliberation budget)
```

### 7.2 Key UI Components

1. **TraitSlider**: [0,1] slider with description tooltip
2. **CalibrationChart**: Domain accuracy vs predicted accuracy scatter
3. **StrategyPopulation**: Table of strategies with fitness, uses, lineage
4. **SolutionArchive**: Grid of solutions by behavioral cell
5. **ImprovementProgress**: Real-time progress with breakthrough highlights
6. **PresetSelector**: Quick personality profile selection

---

## 8. Success Metrics

### 8.1 Functional Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trait update latency | <100 µs p99 | Performance tests |
| Solution archive query | <10 ms p99 | Query benchmarks |
| Calibration error | <0.15 avg | Per-domain |predicted - observed| |
| Background improvement yield | >10% best solutions improved | Archive delta |
| Strategy evolution diversity | >5 active strategies | Population size |

### 8.2 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code quality improvement | +15% elegance score | Before/after LLM assessment |
| Task success rate | +10% over baseline | Success/total tasks |
| User satisfaction | 4.0+ / 5.0 | Feedback on personality settings |
| Skill coverage | 80% domains practiced monthly | Skill table staleness |

### 8.3 Operational Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Background improvement CPU | <5% idle usage | Process monitoring |
| Solution archive growth | <100 MB/month/user | Storage metrics |
| Strategy population stability | <20% churn/week | Generation tracking |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance regression | Medium | High | Strict budget enforcement, performance tests per trait |
| Over-engineering solutions | Medium | Medium | Aesthetics trait bounds, user feedback integration |
| Background improvement resource drain | Medium | Medium | Interruptible flag, strict budget limits, idle detection |
| Strategy population collapse | Low | High | Elite preservation, crossover diversity |
| Calibration drift | Low | Medium | Periodic recalibration triggers, confidence decay |
| User confusion with many traits | Medium | Low | Presets, sensible defaults, progressive disclosure UI |

---

## 10. Dependencies

### 10.1 Prerequisites

1. **Existing cognitive state machine** - Must not break `CognitiveState` transitions
2. **Event sourcing infrastructure** - `cognitive_events` table for recording trait changes
3. **tRPC router infrastructure** - Base patterns from existing routers
4. **UI settings framework** - Existing `/settings` route structure

### 10.2 External Dependencies

1. **LLM for code generation** - Required for solution generation in improvement loops
2. **Code execution sandbox** - Required for evaluation cascade stages
3. **Metrics/Prometheus** - For observability of trait computations

### 10.3 Migration Dependencies

1. No existing `user_personality` table - Clean install
2. May need to seed default strategies for new users
3. Calibration requires initial data collection period (cold start)

---

# Linear Project Plan

## Epics

### [EPIC-1] Personality Type Foundation

**Scope**: Define type hierarchy, implement core trait types, create default factories

**Duration**: 1 week

**Dependencies**: None (foundational)

**Stories**:

- **[STORY-1.1]** As ALFRED, I have a typed personality structure so that trait values are validated at compile time
  
  **Acceptance Criteria**:
  - All 9 trait interfaces defined in `@alfred/type/personality`
  - Branded `TraitValue` type with [0,1] validation
  - Complete `Personality` composite type
  - Type guards for runtime validation
  
  **Tasks**:
  - [TASK-1.1.1] Create `packages/type/src/personality.ts` with core trait types
  - [TASK-1.1.2] Add supporting types (Goal, Objective, EvaluationStage, etc.)
  - [TASK-1.1.3] Export from package index, add to build config
  - [TASK-1.1.4] Write type tests validating branded types

- **[STORY-1.2]** As ALFRED, I can create default personality state so that new users start with sensible trait values
  
  **Acceptance Criteria**:
  - `defaultPersonality(now)` factory function
  - All traits have documented default values
  - Defaults match PRD specifications
  
  **Tasks**:
  - [TASK-1.2.1] Create `packages/cognitive/src/personality.ts` with defaults
  - [TASK-1.2.2] Add unit tests for default creation
  - [TASK-1.2.3] Document default rationale in code comments

---

### [EPIC-2] Personality Persistence

**Scope**: Database schema, repository layer, migration

**Duration**: 1 week

**Dependencies**: EPIC-1 (types must exist)

**Stories**:

- **[STORY-2.1]** As ALFRED, I persist personality configuration so that trait values survive across sessions
  
  **Acceptance Criteria**:
  - `user_personality` table with all trait columns
  - Supporting tables: `user_goals`, `user_objectives`, `confidence_calibration`
  - Drizzle schema mirrors DB exactly
  - Repository with CRUD operations
  
  **Tasks**:
  - [TASK-2.1.1] Create migration `NNNN_personality.sql` with all tables
  - [TASK-2.1.2] Create `packages/db/src/schema/personality.ts` with Drizzle schema
  - [TASK-2.1.3] Create `packages/db/src/repo/personality.ts` with get/set operations
  - [TASK-2.1.4] Write repo integration tests

- **[STORY-2.2]** As ALFRED, I store solution archive for MAP-Elites so that diverse solutions persist across sessions
  
  **Acceptance Criteria**:
  - `solution_archive` table with behavioral cell indexing
  - `strategy_templates` table with fitness tracking
  - Efficient queries for cell-based sampling
  
  **Tasks**:
  - [TASK-2.2.1] Add `solution_archive` and `strategy_templates` to migration
  - [TASK-2.2.2] Add to Drizzle schema
  - [TASK-2.2.3] Add repo methods: `addSolution`, `getSolutionsInCell`, `getStrategies`
  - [TASK-2.2.4] Write repo integration tests

---

### [EPIC-3] Trait Update Engine

**Scope**: Pure trait update functions, trait interactions, performance budgets

**Duration**: 2 weeks

**Dependencies**: EPIC-1 (types), EPIC-2 (persistence for testing)

**Stories**:

- **[STORY-3.1]** As ALFRED, I can update individual traits so that personality evolves based on events
  
  **Acceptance Criteria**:
  - `updatePersonality(now, current, event)` pure function
  - Event types for each trait update scenario
  - All updates <100µs
  - Updates are deterministic
  
  **Tasks**:
  - [TASK-3.1.1] Define `PersonalityEvent` discriminated union
  - [TASK-3.1.2] Implement `updatePersonality` switch on event type
  - [TASK-3.1.3] Add performance instrumentation
  - [TASK-3.1.4] Write unit tests for each event type
  - [TASK-3.1.5] Write performance budget tests

- **[STORY-3.2]** As ALFRED, trait interactions regulate behavior so that high frustration dampens exploration
  
  **Acceptance Criteria**:
  - `computeEffectiveTraits(personality, physiology)` function
  - 7 documented trait interactions
  - Effective values derived, not mutated
  
  **Tasks**:
  - [TASK-3.2.1] Implement trait interaction matrix
  - [TASK-3.2.2] Implement `computeEffectiveTraits` applying interactions
  - [TASK-3.2.3] Write interaction unit tests
  - [TASK-3.2.4] Document interaction effects

- **[STORY-3.3]** As ALFRED, I can track domain confidence so that I know where I'm calibrated vs uncertain
  
  **Acceptance Criteria**:
  - `updateCalibration(domain, predicted, actual)` function
  - Calibration error computed as |predicted - observed|
  - Domain-specific accuracy tracking
  
  **Tasks**:
  - [TASK-3.3.1] Create `packages/cognitive/src/calibration.ts`
  - [TASK-3.3.2] Implement Bayesian accuracy update
  - [TASK-3.3.3] Implement calibration error computation
  - [TASK-3.3.4] Write calibration unit tests

---

### [EPIC-4] Solution Evolution Engine

**Scope**: MAP-Elites archive, evaluation cascade, island populations

**Duration**: 2 weeks

**Dependencies**: EPIC-2 (solution archive), EPIC-3 (traits for config)

**Stories**:

- **[STORY-4.1]** As ALFRED, I maintain diverse solutions via MAP-Elites so that I don't converge to local optima
  
  **Acceptance Criteria**:
  - `SolutionPopulation` class with add/sample/prune
  - Behavioral cell computation from solution
  - Niche-based archiving (best per cell)
  - Island populations with migration
  
  **Tasks**:
  - [TASK-4.1.1] Create `packages/cognitive/src/evolution.ts`
  - [TASK-4.1.2] Implement behavioral descriptor extraction
  - [TASK-4.1.3] Implement `SolutionPopulation` class
  - [TASK-4.1.4] Implement island migration logic
  - [TASK-4.1.5] Write evolution unit tests

- **[STORY-4.2]** As ALFRED, I evaluate solutions progressively so that bad solutions fail fast
  
  **Acceptance Criteria**:
  - `EvaluationCascade` with configurable stages
  - Stage-specific compute budgets
  - Early termination on stage failure
  - Result includes failed stage name
  
  **Tasks**:
  - [TASK-4.2.1] Define `EvaluationStage` interface
  - [TASK-4.2.2] Implement `EvaluationCascade` runner
  - [TASK-4.2.3] Implement default stages: syntax, unit, integration
  - [TASK-4.2.4] Write cascade unit tests

---

### [EPIC-5] Strategy Evolution

**Scope**: Meta-prompt evolution, strategy selection, mutation/crossover

**Duration**: 1.5 weeks

**Dependencies**: EPIC-2 (strategy persistence), EPIC-3 (MetaLearning trait)

**Stories**:

- **[STORY-5.1]** As ALFRED, I evolve prompting strategies so that effective approaches are reinforced
  
  **Acceptance Criteria**:
  - `StrategyEvolver` class with select/mutate/crossover
  - Fitness-weighted selection (selection pressure tunable)
  - Template mutation via LLM
  - Elite preservation
  
  **Tasks**:
  - [TASK-5.1.1] Create `packages/cognitive/src/strategy.ts`
  - [TASK-5.1.2] Implement fitness-proportionate selection
  - [TASK-5.1.3] Implement template mutation
  - [TASK-5.1.4] Implement crossover (parameter mixing)
  - [TASK-5.1.5] Write strategy evolution tests

---

### [EPIC-6] Improvement Modes

**Scope**: Background improvement scheduler, active improvement loop

**Duration**: 2 weeks

**Dependencies**: EPIC-3 (traits), EPIC-4 (evolution), EPIC-5 (strategies)

**Stories**:

- **[STORY-6.1]** As ALFRED, I improve solutions during idle time so that I get better without user prompting
  
  **Acceptance Criteria**:
  - Idle detection hooks into cognitive state machine
  - Activity selection based on trait priorities
  - Compute budget enforcement
  - Interruptible on user input
  
  **Tasks**:
  - [TASK-6.1.1] Add idle detection to cognitive transition handler
  - [TASK-6.1.2] Implement activity selector
  - [TASK-6.1.3] Implement improvement loop with budget tracking
  - [TASK-6.1.4] Add interrupt handling
  - [TASK-6.1.5] Write background improvement integration tests

- **[STORY-6.2]** As a user, I can trigger active improvement so that ALFRED optimizes specific targets on demand
  
  **Acceptance Criteria**:
  - tRPC procedure to start improvement session
  - Progress tracking with breakthrough detection
  - Cancel capability
  - Results returned on completion
  
  **Tasks**:
  - [TASK-6.2.1] Implement `triggerImprove` tRPC mutation
  - [TASK-6.2.2] Implement progress tracking
  - [TASK-6.2.3] Implement breakthrough detection
  - [TASK-6.2.4] Implement `cancelImprovement` mutation
  - [TASK-6.2.5] Write active improvement integration tests

---

### [EPIC-7] API Layer

**Scope**: tRPC router, procedures for all trait operations

**Duration**: 1 week

**Dependencies**: EPIC-2 (repo), EPIC-3 (update functions), EPIC-6 (improvement)

**Stories**:

- **[STORY-7.1]** As a user, I can read and update personality traits via API so that UI can configure ALFRED
  
  **Acceptance Criteria**:
  - `personality.get` returns full config
  - `personality.set` updates specific trait paths
  - `personality.reset` restores defaults
  - All procedures require authentication
  
  **Tasks**:
  - [TASK-7.1.1] Create `packages/api/src/routers/personality.ts`
  - [TASK-7.1.2] Implement CRUD procedures
  - [TASK-7.1.3] Add policy guards
  - [TASK-7.1.4] Register router in index
  - [TASK-7.1.5] Write router integration tests

- **[STORY-7.2]** As a user, I can view calibration and skill stats so that I understand ALFRED's competence
  
  **Acceptance Criteria**:
  - `personality.calibration` returns domain stats
  - `personality.skills` returns skill inventory
  - `personality.strategies` returns strategy population
  
  **Tasks**:
  - [TASK-7.2.1] Implement calibration query procedure
  - [TASK-7.2.2] Implement skills query procedure
  - [TASK-7.2.3] Implement strategies query procedure
  - [TASK-7.2.4] Write query integration tests

---

### [EPIC-8] Settings UI

**Scope**: Personality settings panel, trait controls, presets

**Duration**: 2 weeks

**Dependencies**: EPIC-7 (API must be complete)

**Stories**:

- **[STORY-8.1]** As a user, I can view and adjust personality traits so that I customize ALFRED's behavior
  
  **Acceptance Criteria**:
  - Settings panel at `/settings/personality`
  - Grouped trait sections
  - TraitSlider components for [0,1] values
  - Real-time persistence
  
  **Tasks**:
  - [TASK-8.1.1] Create `/settings/personality` route
  - [TASK-8.1.2] Create TraitSlider component
  - [TASK-8.1.3] Create trait group sections
  - [TASK-8.1.4] Wire to tRPC mutations
  - [TASK-8.1.5] Write UI component tests

- **[STORY-8.2]** As a user, I can select personality presets so that I quickly configure common profiles
  
  **Acceptance Criteria**:
  - Preset definitions: Balanced, Explorer, Expert, Speed
  - One-click apply
  - Preview before apply
  
  **Tasks**:
  - [TASK-8.2.1] Define preset configurations
  - [TASK-8.2.2] Create PresetSelector component
  - [TASK-8.2.3] Implement preset preview
  - [TASK-8.2.4] Wire preset application to API
  - [TASK-8.2.5] Write preset UI tests

- **[STORY-8.3]** As a user, I can view calibration and improvement stats so that I understand ALFRED's learning
  
  **Acceptance Criteria**:
  - CalibrationChart showing accuracy vs predicted
  - ImprovementProgress real-time display
  - StrategyPopulation table with lineage
  
  **Tasks**:
  - [TASK-8.3.1] Create CalibrationChart component
  - [TASK-8.3.2] Create ImprovementProgress component
  - [TASK-8.3.3] Create StrategyPopulation table
  - [TASK-8.3.4] Wire to tRPC queries
  - [TASK-8.3.5] Write stats UI tests

---

### [EPIC-9] Task Queuing & Deferred Execution

**Scope**: Task queue schema, reminder-to-action bridge, idle-time processing, sequential dependencies

**Duration**: 2 weeks

**Dependencies**: EPIC-6 (Improvement Modes - extends idle detection)

**Stories**:

- **[STORY-9.1]** As a user, I can set reminders that trigger workflows so that scheduled tasks execute automatically
  
  **Acceptance Criteria**:
  - Reminder fires → workflow starts automatically
  - Intent parsed from reminder metadata (`intent_type`, `intent_data`)
  - Notification fallback if workflow execution fails
  - Metrics tracked for reminder-to-workflow conversions
  
  **Tasks**:
  - [TASK-9.1.1] Add `intent_type`, `intent_data` columns to `assistant_reminders` (migration)
  - [TASK-9.1.2] Create `parseIntent()` in `packages/api/src/scheduler/remind.ts`
  - [TASK-9.1.3] Wire `onFire` callback to create workflow runs
  - [TASK-9.1.4] Add fallback notification on workflow failure
  - [TASK-9.1.5] Write reminder-to-workflow integration tests

- **[STORY-9.2]** As ALFRED, I process queued tasks during idle time so that deferred work completes automatically
  
  **Acceptance Criteria**:
  - Idle detection triggers task queue check before improvement activities
  - Tasks processed in priority order (highest first)
  - Budget shared between task processing and improvement
  - Interruptible on user input
  
  **Tasks**:
  - [TASK-9.2.1] Create `task_queue` table (migration)
  - [TASK-9.2.2] Create `packages/db/src/repo/queue.ts` with CRUD operations
  - [TASK-9.2.3] Implement `processQueue()` in `packages/cognitive/src/queue.ts`
  - [TASK-9.2.4] Integrate queue check into idle detection (extends TASK-6.1.1)
  - [TASK-9.2.5] Write idle-time queue processing tests

- **[STORY-9.3]** As a user, I can queue tasks with dependencies so that sequential workflows execute in order
  
  **Acceptance Criteria**:
  - Task can specify `blockedBy` referencing another task
  - Blocked tasks have status `blocked` until dependency completes
  - Completion of a task triggers status update of dependents to `ready`
  - Circular dependency detection on task creation
  
  **Tasks**:
  - [TASK-9.3.1] Add `trigger_blocked_by` FK and dependency validation to repo
  - [TASK-9.3.2] Implement `unblockDependents()` called on task completion
  - [TASK-9.3.3] Implement `detectCycle()` for circular dependency validation
  - [TASK-9.3.4] Add tRPC procedures: `queue.add`, `queue.list`, `queue.cancel`
  - [TASK-9.3.5] Write dependency chain integration tests

- **[STORY-9.4]** As a user, I can set recurring tasks so that periodic workflows execute automatically
  
  **Acceptance Criteria**:
  - Task can specify `trigger_cron` for recurring schedule
  - After task completes, next occurrence is scheduled automatically
  - Cron parsing supports: daily, weekly, monthly, custom expressions
  - Skip if previous occurrence still running
  
  **Tasks**:
  - [TASK-9.4.1] Add `parseCron()` utility using cron-parser library
  - [TASK-9.4.2] Implement `scheduleNext()` called on recurring task completion
  - [TASK-9.4.3] Add duplicate detection to prevent overlapping executions
  - [TASK-9.4.4] Extend remind scheduler to handle recurring reminders
  - [TASK-9.4.5] Write recurring task integration tests

---

## Dependency Graph

```
EPIC-1 (Types)
   │
   ├──────────────────────────┐
   ▼                          ▼
EPIC-2 (Persistence)      EPIC-3 (Updates)
   │                          │
   ├──────────┬───────────────┤
   ▼          ▼               ▼
EPIC-4    EPIC-5          EPIC-3 complete
(Evolution) (Strategy)        │
   │          │               │
   └────┬─────┴───────────────┘
        ▼
    EPIC-6 (Improvement)
        │
        ├──────────────────────┐
        ▼                      ▼
    EPIC-7 (API)         EPIC-9 (Task Queue)
        │                      │
        ▼                      │
    EPIC-8 (UI) ◄──────────────┘
```

## Milestone Timeline

| Milestone | Epics | Target | Deliverable |
|-----------|-------|--------|-------------|
| M1: Foundation | EPIC-1, EPIC-2 | Week 2 | Types defined, DB schema migrated |
| M2: Trait Engine | EPIC-3 | Week 4 | Trait updates working, calibration tracked |
| M3: Evolution | EPIC-4, EPIC-5 | Week 6 | MAP-Elites + strategy evolution functional |
| M4: Improvement | EPIC-6 | Week 8 | Background + active improvement working |
| M5: Integration | EPIC-7, EPIC-9 | Week 10 | Full API + task queue operational |
| M6: UI | EPIC-8 | Week 12 | Settings panel + queue UI complete |
| M7: Polish | - | Week 13 | Performance optimization, documentation |

---

## Progress

- [ ] EPIC-1: Personality Type Foundation
- [ ] EPIC-2: Personality Persistence
- [ ] EPIC-3: Trait Update Engine
- [ ] EPIC-4: Solution Evolution Engine
- [ ] EPIC-5: Strategy Evolution
- [ ] EPIC-6: Improvement Modes
- [ ] EPIC-7: API Layer
- [ ] EPIC-8: Settings UI
- [ ] EPIC-9: Task Queuing & Deferred Execution

---

## Surprises & Discoveries

*To be filled during implementation*

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-13 | Remove Amicability, Passion traits | No self-improvement value per AlphaEvolve analysis |
| 2025-12-13 | Rename Willpower → Deliberation | Remove psychological framing, focus on compute allocation |
| 2025-12-13 | Keep evolution inline in cognitive package | Not enough scope for separate package yet |
| 2025-12-13 | Single-word file names | Per .ruler/01-naming-conventions.md |
| 2025-12-13 | Add EPIC-9 Task Queuing | Capability analysis identified 4 gaps: reminder→workflow, idle processing, dependencies, recurring. Extends ImprovementTriggers infrastructure. |
| 2025-12-13 | Separate task_queue table from assistant_reminders | Clean separation: reminders are notifications, tasks are executable intents. Allows complex dependency graphs. |

---

## Outcomes & Retrospective

*To be filled on completion*
