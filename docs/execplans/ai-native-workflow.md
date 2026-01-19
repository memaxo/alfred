# AI-Native Workflow System

> **Status:** In progress (backend plumbing + web UI; pipeline/plan consolidation pending)  
> **Owner:** Runtime Architecture  
> **Created:** 2025-12-23  
> **Last Updated:** 2026-01-19  
> **Linear:** [AI-Native Workflow System](https://linear.app/alfred-ops/project/ai-native-workflow-system-3795d0f5e59a)  
> **Related:** [Gap Analysis](./ai-native-workflow-gap-analysis.md) | [Orchestrator UI Patterns](../strategy/orchestrator-ui-patterns.md)

---

## Purpose

Transform ALFRED's workflow system from a developer tool into an **AI-native orchestration engine** that:

1. **Inverts the orchestration paradigm** — AI orchestrates while humans approve at critical decision points
2. **Generates structured plans** from natural language intent (Best-of-N is optional and bounded)
3. **Executes via multi-agent waves** with container isolation by default (one container per run, shared by agents)
4. **Learns reusable patterns** from successful outcomes for continuous improvement
5. **Provides visual approval workflows** via interactive canvas (web/mobile)

This system leverages ALFRED's existing infrastructure (orchestrator phases, workspaces, merge/review, AI SDK adapter) while adding intent parsing, research aggregation, plan persistence/approval, and pattern learning capabilities.

### Scope boundaries (critical)

- **ALFRED core vs managed projects**: This ExecPlan targets **ALFRED operating on a user-selected project workspace** (a repo ALFRED maintains), not “ALFRED rewriting/deploying itself” by default.
- **Autonomy vs authorization**: Autonomy levels influence *defaults* and when to *suggest* actions, but do **not** grant permission. Any destructive or external effect (merge, deploy, migrations, irreversible operations) requires explicit **policy approval** and a fresh **biometric elevation** where applicable.
- **V1 focus**: V1 is a plan viewer + approval gate integrated into the existing runtime pipeline. Multi-model judging, chaos engineering, checkpoints, and deployments are **deferred** unless telemetry proves they’re necessary.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The n8n Architecture Problem](#the-n8n-architecture-problem)
3. [AI-Native Workflow Architecture](#ai-native-workflow-architecture-2025)
4. [ALFRED's Implementation Architecture](#alfreds-implementation-architecture)
5. [The Complete Workflow](#the-complete-workflow-detailed)
6. [Implementation Priority](#implementation-priority)
7. [Current State Analysis](#current-state-analysis)
8. [Gap Analysis](#gap-analysis) ← **NEW**
9. [Open Questions & Decisions](#open-questions--decisions)
10. [Risk Assessment](#risk-assessment)
11. [DevOps Integration](#devops-integration)
12. [Cognitive Integration](#cognitive-integration)
13. [Testing Strategy](#testing-strategy)
14. [Success Criteria](#success-criteria)
15. [Progress](#progress)
16. [Surprises & Discoveries](#surprises--discoveries)
17. [Phased Implementation Plan](#phased-implementation-plan)
    - [Phase 1: Intent & Research](#phase-1-intent--research)
    - [Phase 2: Planning & Evaluation](#phase-2-planning--evaluation)
    - [Phase 3: Execution Integration](#phase-3-execution-integration)
    - [Phase 4: Pattern Learning](#phase-4-pattern-learning)
    - [Phase 5: Visual Builder](#phase-5-visual-builder)
    - [Phase 6: Resilience & Optimization](#phase-6-resilience--optimization)
    - [Linear Epic/Ticket Creation Checklist](#linear-epicticket-creation-checklist)
17. [Proposal 1: Concrete File Structure](#proposal-1-concrete-file-structure)
18. [Proposal 2: Desktop UI Integration](#proposal-2-desktop-ui-integration)
19. [Proposal 3: AI SDK v6 Integration](#proposal-3-ai-sdk-v6-integration)
20. [Proposal 4: YAML vs JSON](#proposal-4-yaml-vs-json-for-structured-plans)
21. [Proposal 5: Agentic Planner/Orchestrator](#proposal-5-agentic-plannerorchestrator)
22. [Proposal 6: Antifragile Architecture](#proposal-6-antifragile-architecture-nassim-taleb)
23. [Proposal 7: Project Container Architecture](#proposal-7-project-container-architecture)
24. [Decision Log](#decision-log)
25. [Outcomes & Retrospective](#outcomes--retrospective)
26. [Appendix: Codebase Analysis & 47-Question Deep Dive](#appendix-codebase-analysis--47-question-deep-dive)

---

## Executive Summary

### Problem Statement

n8n's workflow paradigm is **human-as-orchestrator**: users manually place nodes, define conditions, and connect integrations. In 2025, this is backwards. AI should orchestrate while humans approve.

### Proposed Solution

Transform ALFRED's workflow system into an **AI-native orchestration engine** where:
- Users state **intent** in natural language (voice/chat)
- AI **researches** context (external + internal)
- AI **generates** structured plans (optional bounded best-of-N when complexity warrants)
- AI **executes** via multi-agent waves in isolated environments
- AI **learns** patterns from successful outcomes
- Users **approve/iterate** via visual canvas (web/mobile)

### Key Insight: ALFRED Already Has Most Execution Infrastructure

| Component | ALFRED Status | New Work Required |
|-----------|---------------|-------------------|
| **Execution Infrastructure** | | |
| Task decomposition | ✅ `decomposeTask()` | Wrap with Phase grouping |
| Wave planning | ✅ `planWaves()` | Convert from `StructuredPlan.phases` |
| Agent execution | ✅ `runAgent()` | None |
| Workspace isolation | ✅ `WorkspaceFactory` (Docker) | None |
| Merge/conflict | ✅ `runMergePhase()` | None |
| Review | ✅ `runReviewPhase()` | None |
| Context building | ✅ `ContextBuilder` | Structure as `ResearchResult` |
| Web research | ✅ `gatherWebContext()` | Aggregate into `ResearchResult` |
| Code research | ✅ `gatherCodeContext()` | Aggregate into `ResearchResult` |
| **Planning Infrastructure** | | |
| Intent parsing | ❌ Missing | NEW: `WorkflowIntent` type + parser (~200 lines) |
| Research aggregation | 🟡 Partial | Structure as `ResearchResult` (~100 lines) |
| Plan generation | ❌ Missing | NEW: `StructuredPlan` + phase grouping (~300 lines) |
| Plan evaluation | ❌ Missing | NEW: Verification-first + optional judges (~200 lines) |
| Plan persistence | ❌ Missing | NEW: `workflow_plans` table + approval gate (~150 lines) |
| **Pattern Learning** | | |
| Pattern extraction | 🟡 Partial | Tool sequences exist; workflow patterns missing (~200 lines) |
| Pattern matching | ❌ Missing | NEW: Semantic + structural matching (~150 lines) |
| Pattern storage | 🟡 Partial | Knowledge graph exists; SQL table missing (~100 lines) |
| **UI Components** | | |
| Visual builder | ❌ Missing | NEW: React Flow canvas + components (~500 lines) |
| Plan viewer | ❌ Missing | NEW: Plan display component (~200 lines) |
| Approval controls | ❌ Missing | NEW: Approve/reject/iterate UI (~100 lines) |

**Estimated new code:** ~2.2k–3.5k LOC core + ~800 LOC UI + tests + migrations (revised estimate based on gap analysis)

**Note:** Execution infrastructure is ~80% complete. Planning infrastructure is ~10% complete. See [Gap Analysis](#gap-analysis) for detailed breakdown.

---

## The n8n Architecture Problem

n8n's fundamental assumption is **human-as-orchestrator**:
- User drags nodes onto canvas
- User connects nodes manually
- User defines conditions and branches
- AI is just another node (like "OpenAI" or "Anthropic")

This is **backwards** for 2025. The AI should be the orchestrator, not a tool in a human-defined workflow.

### n8n's Limitations

| n8n Pattern | Problem | AI-Native Alternative |
|-------------|---------|----------------------|
| Visual node placement | Humans can't anticipate all paths | AI generates execution graph dynamically |
| Static conditions | Can't adapt to runtime context | AI evaluates conditions with reasoning |
| Single execution | No comparison of approaches | Best-of-N execution with evaluation |
| Manual integration setup | Tedious, error-prone | AI discovers and uses integrations |
| No learning | Same workflow every time | Pattern extraction from successful runs |

---

## AI-Native Workflow Architecture (2025)

### Core Paradigm Shift

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           n8n (2019 Paradigm)                                │
│                                                                             │
│   Human defines workflow → Workflow executes → Human reviews output         │
│                                                                             │
│   [Node] → [Node] → [Node] → [Output]                                       │
│      ↑        ↑        ↑                                                    │
│   (all connections defined by human)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        ALFRED (2025 AI-Native)                               │
│                                                                             │
│   Human states intent → AI generates plan → AI executes with judgment →     │
│   AI evaluates outcomes → Human approves/iterates → AI learns patterns      │
│                                                                             │
│   Intent → [Research] → [Plan Generation] → [Plan Selection (optional)] →  │
│            [Resource Allocation] → [Multi-Agent Execution] →                │
│            [Review & Merge] → [Human Approval] → [Pattern Extraction]       │
│                                                                             │
│   (AI decides graph structure, execution strategy, and resource allocation) │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AI-Native Primitives

**1. Intent → Structured Plan (not node placement)**
```typescript
type WorkflowIntent = {
  description: string;           // Natural language from user
  context: {
    codebase: string;            // Repository context
    existingPatterns: Pattern[]; // What ALFRED has learned
    constraints: Constraint[];   // Time, resources, complexity
  };
};

type StructuredPlan = {
  phases: Phase[];               // PRD-like phases
  dependencies: DependencyGraph; // What blocks what
  resources: ResourceAllocation; // Agents, containers, branches
  evaluationCriteria: Criterion[]; // How to judge success
  rollbackStrategy: RollbackPlan;  // If things go wrong
};
```

**2. Dynamic Execution Graph (not static connections)**
```typescript
type ExecutionGraph = {
  nodes: ExecutionNode[];        // What to do
  edges: ExecutionEdge[];        // Dependencies
  strategy: "sequential" | "parallel" | "topological" | "adaptive";
  adaptiveRules?: AdaptiveRule[]; // Runtime graph modification
};

// The graph is GENERATED, not drawn
function generateExecutionGraph(plan: StructuredPlan): ExecutionGraph {
  // AI reasons about dependencies, parallelism, failure modes
  // Returns optimal execution structure
}
```

**3. Multi-Agent Waves (not single execution)**
```typescript
type AgentWave = {
  id: string;
  agents: AgentConfig[];         // Codex, Droid, Claude Code, etc.
  strategy: WaveStrategy;        // How agents coordinate
  isolation: IsolationConfig;    // Worktrees, containers, branches
  mergeStrategy: MergeConfig;    // How to combine outputs
};

type WaveStrategy = 
  | { type: "parallel"; maxConcurrency: number }
  | { type: "sequential"; order: string[] }
  | { type: "topological"; dependencies: Record<string, string[]> }
  | { type: "racing"; selectBest: EvaluationCriteria };
```

**4. Best-of-N Evaluation (not just output)**
```typescript
type EvaluationPipeline = {
  candidates: ExecutionResult[];
  judges: Judge[];               // AI evaluators
  criteria: Criterion[];         // What matters
  aggregation: "voting" | "weighted" | "consensus";
};

type Judge = {
  id: string;
  model: "claude-sonnet" | "gpt-4o" | "gemini-pro";
  prompt: string;                // Evaluation instructions
  weight: number;                // How much this judge matters
};
```

**5. Pattern Learning (not static templates)**
```typescript
type LearnedPattern = {
  id: string;
  trigger: PatternTrigger;       // When to use this pattern
  structure: ExecutionGraph;     // What worked
  outcomes: Outcome[];           // Historical results
  confidence: number;            // How reliable is this pattern
  lastUsed: Date;
  refinements: Refinement[];     // How it's evolved
};

// After successful execution, extract patterns
function extractPatterns(
  intent: WorkflowIntent, 
  execution: ExecutionResult,
  outcome: Outcome
): LearnedPattern[];
```

---

## ALFRED's Implementation Architecture

### New Package: `@alfred/plan`

**Status:** ❌ **NOT YET CREATED** - This is the foundation package for all planning work.

**Proposed Structure** (matches Proposal 1):
```
packages/
├── plan/                           # NEW: AI-Native Planning Package
│   ├── src/
│   │   ├── index.ts                # Public exports
│   │   ├── types.ts                # Phase, StructuredPlan, WorkflowPattern, PlanEvaluation
│   │   │
│   │   ├── intent/                 # Intent extraction (NL → structured)
│   │   │   ├── index.ts
│   │   │   ├── parser.ts           # Voice/chat → WorkflowIntent
│   │   │   ├── classify.ts         # Intent classification
│   │   │   └── schema.ts           # Zod schemas for intent
│   │   │
│   │   ├── research/               # External + internal research
│   │   │   ├── index.ts
│   │   │   ├── external.ts         # Web search, docs lookup (wraps existing gatherWebContext)
│   │   │   ├── internal.ts          # Codebase scan, pattern lookup (wraps existing gatherCodeContext)
│   │   │   ├── aggregate.ts        # Combine research sources into ResearchResult
│   │   │   └── schema.ts            # ResearchResult schema
│   │   │
│   │   ├── generate/               # Plan generation
│   │   │   ├── index.ts
│   │   │   ├── phased.ts           # Intent → StructuredPlan (Phased PRD)
│   │   │   ├── variant.ts          # Generate N plan variants (optional)
│   │   │   ├── prompt.ts           # LLM prompts for plan gen
│   │   │   └── template.ts         # Template-based plan scaffolding
│   │   │
│   │   ├── evaluate/               # Best-of-N evaluation
│   │   │   ├── index.ts
│   │   │   ├── judge.ts            # AI judge definitions (optional)
│   │   │   ├── criteria.ts         # Evaluation criteria
│   │   │   ├── aggregate.ts        # Combine judge scores
│   │   │   └── verify.ts           # Verification-first (typecheck/tests/build)
│   │   │
│   │   ├── pattern/                # Pattern learning & matching
│   │   │   ├── index.ts
│   │   │   ├── extract.ts          # Success → WorkflowPattern
│   │   │   ├── match.ts            # Intent → relevant patterns
│   │   │   ├── refine.ts           # Pattern improvement over time
│   │   │   ├── store.ts            # Pattern persistence (SQL + graph)
│   │   │   └── conventions.ts      # Convention extraction & learning
│   │   │
│   │   ├── serialize/              # YAML/JSON serialization
│   │   │   ├── index.ts
│   │   │   ├── json.ts             # JSON marshaling (canonical)
│   │   │   ├── yaml.ts             # YAML export/import (optional; gated)
│   │   │   └── validate.ts         # Schema validation
│   │   │
│   │   └── project/                # Project resolution & Linear sync
│   │       ├── index.ts
│   │       ├── resolve.ts          # Auto-detect from workspace path
│   │       └── linear.ts            # Linear Project sync
│   │
│   ├── test/
│   │   ├── intent.test.ts
│   │   ├── research.test.ts
│   │   ├── generate.test.ts
│   │   ├── evaluate.test.ts
│   │   └── pattern.test.ts
│   │
│   └── package.json                # @alfred/plan
```

**Note:** This structure reuses existing infrastructure:
- `research/external.ts` wraps `packages/runtime/src/context.ts` `gatherWebContext()`
- `research/internal.ts` wraps `packages/runtime/src/context.ts` `gatherCodeContext()`
- `generate/phased.ts` wraps `packages/agent/src/orchestrator/multi/decompose.ts` `decomposeTask()`
- `pattern/store.ts` extends `packages/knowledge/src/hypergraph.ts` pattern storage

### Integration with Existing Architecture

**1. Keep the existing `packages/runtime/src/orchestrator` Phase A–E pipeline; extend Phase A**

Current orchestrator is already stable and test-covered:
`Phase A: runWaves → Phase B: runMergePhase → Phase C: runConflictPhase → Phase D: runMergeAnalysis → Phase E: runReviewPhase`.

**Integration Strategy:** Add planning phases **before** Phase A (runWaves):
- **Pre-Phase: Intent & Research** - Parse intent, aggregate research (new `@alfred/plan` package)
- **Pre-Phase: Plan Generation** - Generate `StructuredPlan` with phases (new `@alfred/plan` package)
- **Pre-Phase: Plan Approval** - User approves plan, creates workflow run
- **Phase A: Plan → WavePlan Conversion** - Convert `StructuredPlan.phases` to `WavePlan[]` (adapter layer)
- **Phase A: runWaves** - Execute waves (existing, unchanged)

**Key Insight:** Planning happens **before** workflow execution starts. The plan is persisted, approved, then converted to execution format.

**2. Extend `packages/agent/` for Agent Types**

```typescript
// packages/agent/src/types.ts

type AgentType = 
  | "codex"       // OpenAI Codex (fast, good at code gen)
  | "droid"       // ALFRED's Droid (full codebase access)
  | "claude-code" // Claude with computer use
  | "review"      // Specialized review agent
  | "research"    // Web + docs research
  | "judge";      // Evaluation agent

type AgentConfig = {
  type: AgentType;
  model: string;
  tools: Tool[];
  isolation: IsolationConfig;
  budget: { tokens: number; time: number; cost: number };
};
```

**3. Pattern Storage: Hybrid Approach (SQL + Knowledge Graph)**

**Current State:**
- `packages/knowledge/src/hypergraph.ts` - Supports pattern storage in knowledge graph
- `packages/agent/src/orchestrator/tool/learning/exec.ts` - `executeLearnPattern()` stores tool sequence patterns
- **Missing:** Workflow pattern storage (different from tool sequence patterns)

**Proposed Approach:**
- **SQL table** (`workflow_patterns`) for fast queries, project scoping, confidence tracking
- **Knowledge graph** for semantic search and relationship discovery
- **Dual storage:** Patterns stored in both SQL (primary) and graph (semantic)

```typescript
// NEW: packages/db/src/schema/pattern.ts
export const workflowPatterns = pgTable("workflow_patterns", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  trigger: text("trigger").notNull(), // Semantic trigger
  planTemplate: jsonb("plan_template").notNull(), // StructuredPlan template
  successRate: real("success_rate").notNull(),
  avgDurationMs: integer("avg_duration_ms").notNull(),
  usageCount: integer("usage_count").default(0),
  confidence: real("confidence").notNull(),
  status: text("status").default("active"), // 'active' | 'quarantined' | 'trusted'
  knowledgeNodeId: uuid("knowledge_node_id"), // Link to hypergraph
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  lastUsed: timestamp("last_used_at", { withTimezone: true }),
});

// packages/plan/src/pattern/store.ts
export async function storePattern(pattern: WorkflowPattern): Promise<void> {
  // 1. Store in SQL (primary)
  await db.insert(workflowPatterns).values(pattern);
  
  // 2. Store in knowledge graph (semantic)
  await graphRepo.upsertNodes([{
    resource: `project:${pattern.projectId}`,
    kind: "pattern",
    label: pattern.trigger,
    properties: { ...pattern },
  }]);
}
```

### Visual Representation in Desktop UI

**Use the existing `workflow` window type (no new WindowType)**

```typescript
// apps/web/src/store/desktop.schemas.ts

// Extend the existing workflow schema instead of introducing a new window type.
// The desktop store already supports `type: "workflow"` and `type: "workflowlist"`.
export const workflowWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("workflow"),
  // existing fields...

  // NEW (for plan viewer / canvas)
  planId: z.string().uuid().optional(),
  view: z.enum(["plan", "canvas", "timeline"]).optional(),
});
```

**Canvas Components (React Flow)**

```typescript
// apps/web/src/components/windows/workflow/ (new thin Desktop workflow window)

├── (existing) plan/task/tool renderers
└── (optional) canvas subview (ReactFlow) for phase dependencies
```

**Note:** For execution visualization (streaming output, progress tracking, error panels), see `docs/strategy/orchestrator-ui-patterns.md` which defines specialized UI components for technical operations. The workflow window integrates these patterns for real-time execution feedback.

---

## The Complete Workflow (Detailed)

### Phase 1: Initiation

```
User: "Alfred, I want to add dark mode toggle to the settings page"
       (via voice-to-voice or chat)
```

**System Actions:**
1. Voice STT → Text (if voice)
2. Intent extraction with structured output
3. Create `WorkflowIntent` object

```typescript
const intent: WorkflowIntent = {
  description: "Add dark mode toggle to settings page",
  source: "voice",
  user: "jack",
  timestamp: "2025-12-23T...",
  context: {
    codebase: "/Users/jackmazac/Development/alfred",
    recentFiles: ["apps/web/src/components/apps/settings/index.tsx"],
  }
};
```

### Phase 2: Research

**External Research:**
- Web search for "dark mode implementation react 2025"
- Documentation lookup (TailwindCSS dark mode, Zustand persistence)
- Similar implementations in open source

**Internal Research:**
- Codebase scan for existing theme handling
- Pattern lookup from knowledge graph
- Previous dark mode PRs (if any)

```typescript
const research: ResearchResult = {
  external: [
    { source: "tailwindcss.com", summary: "Use 'dark' class on html element..." },
    { source: "github.com/...", summary: "Zustand persist middleware for theme..." },
  ],
  internal: {
    existingCode: ["apps/web/src/styles/globals.css", "tailwind.config.js"],
    patterns: [LearnedPattern("ui-feature-addition", 0.87)],
    conventions: ["Use Zustand for UI state", "CSS variables in design system"],
  },
};
```

### Phase 3: Plan Generation

AI generates a **Phased PRD**:

```typescript
const plan: StructuredPlan = {
  id: "plan-dark-mode-001",
  title: "Dark Mode Toggle Implementation",
  phases: [
    {
      id: "phase-1",
      name: "Design System Extension",
      description: "Extend design tokens for dark mode",
      tasks: [
        { id: "task-1-1", name: "Add dark color tokens", complexity: "low" },
        { id: "task-1-2", name: "Update Tailwind config", complexity: "low" },
      ],
      estimatedDuration: "15 min",
      agentType: "codex",
    },
    {
      id: "phase-2", 
      name: "State Management",
      description: "Add theme preference to Zustand store",
      tasks: [
        { id: "task-2-1", name: "Create theme slice", complexity: "medium" },
        { id: "task-2-2", name: "Add localStorage persistence", complexity: "low" },
      ],
      estimatedDuration: "20 min",
      agentType: "droid",
      dependsOn: ["phase-1"],
    },
    {
      id: "phase-3",
      name: "UI Component",
      description: "Create toggle component in settings",
      tasks: [
        { id: "task-3-1", name: "Create ThemeToggle component", complexity: "medium" },
        { id: "task-3-2", name: "Integrate into settings page", complexity: "low" },
      ],
      estimatedDuration: "25 min",
      agentType: "codex",
      dependsOn: ["phase-2"],
    },
    {
      id: "phase-4",
      name: "System Integration",
      description: "Respect OS preference, persist choice",
      tasks: [
        { id: "task-4-1", name: "Detect OS preference", complexity: "low" },
        { id: "task-4-2", name: "Add prefers-color-scheme listener", complexity: "low" },
      ],
      estimatedDuration: "10 min",
      agentType: "codex",
      dependsOn: ["phase-3"],
    },
  ],
  resources: {
    agents: 3,
    strategy: "topological", // Respects dependencies
    isolation: "container",  // Default: one container per run; agents use branches/workspaces within it
  },
  evaluationCriteria: [
    { name: "builds", weight: 0.3, threshold: "pass" },
    { name: "tests", weight: 0.3, threshold: "pass" },
    { name: "lint", weight: 0.2, threshold: "no-errors" },
    { name: "style", weight: 0.2, threshold: "matches-design-system" },
  ],
};
```

### Phase 4: Plan Selection (Optional Evaluation)

Default: prefer deterministic verification (typecheck/tests/build) and only use LLM “judging” as a bounded tie-breaker.

```typescript
const planVariants = [plan, planVariantB, planVariantC];

const verification = await verifyPlans(planVariants, {
  checks: ["typecheck", "test", "lint"],
});

// Select the highest-scoring plan that passes checks
const selectedPlan = selectPlan(planVariants, verification);
```

### Phase 5: User Review (Visual Canvas)

**Desktop UI renders the plan as interactive canvas:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dark Mode Toggle Implementation                    [Approve] [Iterate]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────────┐                                                     │
│    │ Phase 1: Design  │                                                     │
│    │ System Extension │                                                     │
│    │   🤖 Codex       │                                                     │
│    │   ⏱️ 15 min      │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             ▼                                                               │
│    ┌──────────────────┐                                                     │
│    │ Phase 2: State   │                                                     │
│    │ Management       │                                                     │
│    │   🤖 Droid       │                                                     │
│    │   ⏱️ 20 min      │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             ▼                                                               │
│    ┌──────────────────┐                                                     │
│    │ Phase 3: UI      │                                                     │
│    │ Component        │                                                     │
│    │   🤖 Codex       │                                                     │
│    │   ⏱️ 25 min      │                                                     │
│    └────────┬─────────┘                                                     │
│             │                                                               │
│             ▼                                                               │
│    ┌──────────────────┐                                                     │
│    │ Phase 4: System  │                                                     │
│    │ Integration      │                                                     │
│    │   🤖 Codex       │                                                     │
│    │   ⏱️ 10 min      │                                                     │
│    └──────────────────┘                                                     │
│                                                                             │
│  Resources: 3 agents | Strategy: Topological | Est: 70 min                  │
│  Evaluation Score: 0.91 | Risk: Low                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**User can:**
- Click phases to expand details
- Drag to reorder (recalculates dependencies)
- Adjust agent types
- Add/remove tasks
- Approve or request iteration

### Phase 6: Execution (Multi-Agent Waves)

```typescript
// User approved plan

const execution = await executeWorkflow(selectedPlan, {
  isolation: {
    type: "container",
  },
  waves: [
    // Wave 1: Phase 1 (no dependencies)
    {
      agents: [{ type: "codex", task: "phase-1" }],
      strategy: "sequential",
    },
    // Wave 2: Phase 2 (depends on Wave 1)
    {
      agents: [{ type: "droid", task: "phase-2" }],
      strategy: "sequential",
      dependsOn: ["wave-1"],
    },
    // Wave 3: Phases 3 & 4 (3 depends on 2, 4 depends on 3)
    {
      agents: [
        { type: "codex", task: "phase-3" },
        { type: "codex", task: "phase-4" },
      ],
      strategy: "topological",
      dependsOn: ["wave-2"],
    },
  ],
});
```

**During Execution (streamed to UI):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Executing: Dark Mode Toggle                                    [Cancel]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Wave 1 ━━━━━━━━━━━━━━━━━━━━ 100% ✅                                        │
│    └── Phase 1: Design System Extension (Codex) ✅                          │
│                                                                             │
│  Wave 2 ━━━━━━━━━━━━━━━━━━━━ 100% ✅                                        │
│    └── Phase 2: State Management (Droid) ✅                                 │
│                                                                             │
│  Wave 3 ━━━━━━━━━━━━━━━━━━━━ 67% 🔄                                         │
│    ├── Phase 3: UI Component (Codex) ✅                                     │
│    └── Phase 4: System Integration (Codex) 🔄                               │
│                                                                             │
│  [Live Agent Output]                                                        │
│  > Creating ThemeToggle component...                                        │
│  > Adding useColorScheme hook...                                            │
│  > Integrating with settings page...                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 7: Review Agent

```typescript
// All waves complete → existing runtime phases handle merge/conflict/review:
// Phase B: runMergePhase
// Phase C: runConflictPhase
// Phase E: runReviewPhase
```

### Phase 8: PR Creation & User Notification

```typescript
// Review agent creates PR

const pr = await createPR({
  title: "feat: Add dark mode toggle to settings",
  body: generatePRDescription(plan, execution, review),
  branch: "feat/dark-mode-toggle",
  base: "main",
  squash: true,
});

// Notify user
await notifyUser("jack", {
  type: "workflow-complete",
  planId: plan.id,
  prUrl: pr.html_url,
  options: ["hop-on-call", "view-web", "view-mobile"],
});
```

### Phase 9: Pattern Learning

```typescript
// Workflow succeeded, extract patterns

const patterns = await extractPatterns({
  intent: intent,
  plan: selectedPlan,
  execution: execution,
  outcome: { success: true, duration: 68, prMerged: true },
});

// Store in knowledge graph
for (const pattern of patterns) {
  await storePattern({
    trigger: "ui-feature-addition-settings",
    structure: pattern.executionGraph,
    successRate: 1.0, // First run
    refinementCount: 0,
  });
}
```

---

## Implementation Priority

### Phase 1: Core Infrastructure (2 weeks)

1. **Intent Parser** - Voice/chat → structured intent
2. **Plan Generator** - Intent → phased PRD
3. **Execution Graph** - Plan → topological execution order
4. **Basic Waves** - Sequential agent execution

### Phase 2: Multi-Agent Execution (2 weeks)

1. **Worktree Isolation** - Each agent gets isolated environment
2. **Parallel Waves** - Concurrent agent execution
3. **Review Agent** - Automated merge and verification
4. **PR Generation** - Squashed commits with descriptions

### Phase 3: Evaluation & Learning (2 weeks)

1. **Optional plan variants** - Generate and evaluate plan variants when complexity warrants
2. **AI Judges** - Multi-model evaluation
3. **Pattern Extraction** - Successful workflow → reusable pattern
4. **Pattern Matching** - Intent → relevant patterns

### Phase 4: Visual Builder (2 weeks)

1. **Workflow Builder Window** - New React Flow canvas
2. **Phase Nodes** - PRD phases as visual blocks
3. **Dependency Edges** - Interactive connection editing
4. **Resource Panel** - Agent allocation controls
5. **Timeline View** - Gantt-like execution visualization

---

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **AI generates graph, not user** | Humans can't anticipate optimal execution paths |
| **Optional plan variants** | Single plans are often suboptimal; variants can help when bounded |
| **Worktree isolation** | Agents can't corrupt each other's work |
| **Review agent** | Human shouldn't merge; agent handles conflicts |
| **Pattern learning** | Each success makes future workflows better |
| **Visual canvas** | Humans need to understand and approve, not micromanage |

---

## Ontology: What is a "Node"?

### The Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ALFRED Workflow Ontology                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Intent (User's natural language request)                                   │
│    └── StructuredPlan (Phased PRD generated by AI)                          │
│          └── Phase (PRD section, e.g., "Design System Extension")           │
│                └── SubTask (Atomic work unit, EXISTING TYPE)                │
│                      └── Step (Agent tool call, internal)                   │
│                                                                             │
│  StructuredPlan ──executes-via──▶ WavePlan (EXISTING TYPE)                  │
│  WavePlan ──contains──▶ AgentSpec (EXISTING TYPE)                           │
│  AgentSpec ──produces──▶ Output (code changes, tests, etc.)                 │
│                                                                             │
│  Successful StructuredPlan ──extracts──▶ WorkflowPattern (NEW TYPE)         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Types (Minimal Surface Area)

We only introduce **4 new types**. Everything else reuses existing ALFRED types:

```typescript
// NEW: packages/plan/src/types.ts

import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type { WavePlan } from "@alfred/agent/orchestrator/multi/spawn";
import type { NodeId } from "@alfred/knowledge/hypergraph";

// 1. Phase: Groups SubTasks into PRD-like sections
export type Phase = {
  id: string;
  name: string;                // e.g., "Design System Extension"
  description: string;
  tasks: SubTask[];            // ← REUSES existing type
  dependsOn: string[];
  estimatedDurationMs: number;
  agentType: "codex" | "droid" | "claude-code" | "research" | "review";
};

// 2. StructuredPlan: The AI-generated PRD
export type StructuredPlan = {
  id: string;
  title: string;
  intent: string;              // Original user request
  phases: Phase[];
  waves?: WavePlan[];          // ← REUSES existing type (generated from phases)
  resources: {
    agentCount: number;
    strategy: "sequential" | "parallel" | "topological";
    isolation: "container" | "worktree";
  };
  evaluationCriteria: Array<{
    name: string;
    weight: number;
    threshold: string;
  }>;
};

// 3. WorkflowPattern: Learned reusable template
export type WorkflowPattern = {
  id: string;
  trigger: string;             // Semantic trigger (e.g., "add-ui-feature")
  planTemplate: Omit<StructuredPlan, "id" | "intent">;
  successRate: number;
  avgDurationMs: number;
  usageCount: number;
  knowledgeNodeId?: NodeId;    // Link to hypergraph for semantic queries
};

// 4. PlanEvaluation: Best-of-N evaluation result
export type PlanEvaluation = {
  planId: string;
  scores: Array<{
    judge: string;             // e.g., "claude-sonnet", "gpt-4o"
    criterion: string;         // e.g., "completeness", "risk"
    score: number;             // 0.0 to 1.0
    reasoning: string;
  }>;
  aggregateScore: number;
  selected: boolean;
};
```

### Visual Canvas Mapping

| Desktop Window Type | Represents | React Flow Node Type |
|---------------------|------------|----------------------|
| `workflow` | Plan viewer + executing run | PhaseNode (optional), DependencyEdge (optional) |
| `workflowlist` | Past runs | List view (existing) |

### Are We Overcomplicating This?

**No.** Here's why:

1. **Only 4 new types** — `Phase`, `StructuredPlan`, `WorkflowPattern`, `PlanEvaluation`
2. **New code estimate:** ~2.2k–3.5k LOC core + ~800 LOC UI + tests + migrations (revised based on gap analysis)
3. **Reuses ALL existing infrastructure** — waves, agents, workspaces, merge, review, context building
4. **Deferred complexity** — visual builder starts read-only, best-of-N evaluation is optional
5. **Execution infrastructure is 80% complete** — Only planning infrastructure needs to be built

**Key Insight:** The gap analysis shows execution infrastructure is strong (~80%). Planning infrastructure is weak (~10%) but can be built incrementally by wrapping existing components.

**The "standard 2025 spec-driven approach" is simply:**
```
Intent → Research → Plan → Evaluate → Execute → Learn
          ↑ NEW      ↑ NEW   ↑ NEW               ↑ NEW
```

We're adding 4 steps to an existing 5-step pipeline. That's not overcomplication — that's evolution.

---

## Current State Analysis

### Existing Infrastructure (packages/runtime)

ALFRED already has a sophisticated multi-agent orchestration system:

```
packages/runtime/src/orchestrator/
├── index.ts      → Main orchestrator (Phases A-E)
├── waves.ts      → Multi-agent wave execution
├── agent.ts      → Individual agent spawning
├── merge.ts      → Conflict detection and resolution
├── review.ts     → Review phase
├── hydrate.ts    → State recovery
└── types.ts      → OrchestratorContext
```

**Existing Phase Pipeline:**
```
Phase A: runWaves()        → Build context, decompose task, plan waves, execute agents
Phase B: runMergePhase()   → Merge execution, conflict detection
Phase C: runConflictPhase() → Conflict analysis and resolution
Phase D: runMergeAnalysis() → Merge analysis
Phase E: runReviewPhase()   → Review and self-correction
```

**Note:** Currently, `runWaves()` calls `decomposeTask()` internally (line 104). For AI-native workflows, planning happens **before** execution starts:
1. **Pre-execution:** Intent → Research → Plan Generation → Plan Approval
2. **Execution:** Plan → WavePlan conversion → Phase A (runWaves) → Phase B-E (unchanged)

### Existing Types We Can Reuse

```typescript
// packages/agent/src/orchestrator/multi/decompose.ts
type SubTask = {
  id: SubTaskId;
  title: string;
  requirement: string;
  deps: SubTaskId[];           // ← Already has dependencies
  priority: number;
  acceptance: string[];        // ← Already has acceptance criteria
  filesHint: string[];
};

// packages/agent/src/orchestrator/multi/spawn.ts
type WavePlan = {
  id: WaveId;
  agents: SubTaskId[];
  dependsOn: WaveId[];         // ← Already has wave dependencies
};

type AgentSpec = {
  agentId: AgentId;
  subTaskId: SubTaskId;
  environment: WorkspaceKind;  // ← Already has isolation config
  auto: "read" | "low" | "medium" | "high";
  model?: string;
};
```

### Existing Workspace Isolation

```typescript
// packages/agent/src/environment/factory.ts
const WorkspaceFactory = {
  create: async (kind, id, runId, repoBase, options) => {
    // Production: Docker container (default)
    // Development: Worktree (--feature=LEGACY_WORKTREE)
    return new ContainerWorkspace(...);
  }
};
```

### Existing Pattern Storage (Partial)

**What Exists:**
- `packages/knowledge/src/hypergraph.ts` - Knowledge graph supports pattern storage
- `packages/agent/src/orchestrator/tool/learning/exec.ts` - `executeLearnPattern()` stores tool sequence patterns
- `packages/agent/src/orchestrator/learning-worker.ts` - `learnFromRun()` extracts facts from workflows

**What Exists (as of 2026-01-19):**
- `packages/db/src/schema/pattern.ts` + migrations `packages/db/src/migrations/0059_workflow_patterns.sql` (+ lifecycle/embedding followups) — `workflow_patterns` SQL table exists
- `packages/plan/src/types.ts` + `packages/plan/src/schema.ts` — `WorkflowPattern` type + schema exist
- `packages/plan/src/pattern/match.ts` — intent → pattern matching exists (plus `packages/api/src/routers/plan.ts` endpoints `plan.patternsList` / `plan.patternsMatch`)

**What's Still Missing / Incomplete:**
- A single canonical “pattern extraction” pipeline wired to real workflow outcomes (success/failure → update `successRate`, `avgDurationMs`, `lastUsedAt`, embeddings)
- A clear contract for when patterns are suggested vs auto-applied (policy + UI affordances)
- Consolidation between “tool sequence patterns” (existing learning worker) and “workflow plan patterns” (this system) so we don’t learn the same thing twice with incompatible schemas

```typescript
// EXISTS: packages/knowledge/src/hypergraph.ts
type Knowledge =
  | { _: "fact"; ... }
  | { _: "relation"; ... }
  | { _: "insight"; ... }
  | { _: "pattern"; examples: NodeId[]; rule: string; accuracy: number };

// EXISTS: Tool sequence patterns
// packages/agent/src/orchestrator/tool/learning/exec.ts
export async function executeLearnPattern(args: {
  input: LearnPatternInput;
  userId: string;
}): Promise<LearnPatternOutput>;

// EXISTS: Workflow plan patterns (planning-layer, not tool-call sequences)
// packages/plan/src/types.ts
export type WorkflowPattern = {
  id: string;
  trigger: string;
  planTemplate: Omit<StructuredPlan, "id" | "intent">;
  successRate: number;
  avgDurationMs: number;
  usageCount: number;
  knowledgeNodeId?: NodeId;
};
```

---

## Gap Analysis

> **Comprehensive Gap Analysis:** See [`ai-native-workflow-gap-analysis.md`](./ai-native-workflow-gap-analysis.md) for detailed component-by-component analysis.

### Quick Summary

**Reality check (2026-01-19):** This system is **actively implemented**, but not yet fully consolidated.

- There is a dedicated planning package: `packages/plan/` (`@alfred/plan`) with intent parsing, research, plan generation, critique/evaluation, persistence, patterns, and project detection.
- There is a durable execution pipeline: `packages/pipeline/` (`@alfred/pipeline`) with staged execution + checkpoints (exposed via `packages/api/src/routers/workflow.ts`).
- There is a web UI surface: `apps/web/src/components/windows/workflow/` (`workflow` + `workflowlist`, plus an optional React Flow canvas).

**Primary remaining gap:** the pipeline `PlanStage` still plans via `decomposeTask()` + ExecPlan skeletons, while `@alfred/plan` produces `StructuredPlan` separately. We need one canonical plan representation for “AI-native workflows”.

| Category | Status | Notes |
|----------|--------|-------|
| **Execution Infrastructure** | ✅ | `@alfred/pipeline` stages + checkpointing; `workflowRouter.phase.plan/execute` exists |
| **Planning Infrastructure** | 🟡 | `@alfred/plan` + `planRouter` exist, but pipeline planning is still `decomposeTask()`-based |
| **Pattern Learning** | 🟡 | `workflow_patterns` table + match/list endpoints exist; outcome→pattern feedback loop still incomplete |
| **UI Components** | 🟡 | Web workflow windows + canvas exist; polishing + wiring to phase APIs is still ongoing |
| **Database Schema** | ✅ | `projects`, `workflow_plans`, `workflow_patterns` tables exist (plus `workflow_runs.plan_id`) |

**Critical path (next):**

1. Consolidate planning: decide whether pipeline should consume `StructuredPlan` (recommended) or retire it in favor of `decomposeTask()`.
2. Implement/standardize adapters so the execution path is singular: \(Intent → Research → StructuredPlan → WavePlan → Pipeline\).
3. Make approval deterministic: plan approval should either (a) start the pipeline execution, or (b) return a runId that the UI then executes via the same phase APIs (not a parallel path).
4. Add end-to-end tests at the workflow layer: success, policy suspend/resume, and MAX_TRANSITIONS safeguards for the consolidated path.

**Note on the linked gap analysis:** `docs/execplans/ai-native-workflow-gap-analysis.md` is useful historical context, but parts of it are now outdated (it predates `packages/plan/` and the DB tables for plans/patterns/projects).

---

## Open Questions & Decisions

### Critical Decisions Required

| # | Question | Options | Recommendation | Status |
|---|----------|---------|----------------|--------|
| 1 | Where do workflow patterns live? | Knowledge graph / SQL table / Hybrid | **Hybrid**: SQL for queries, graph for semantics | ⬜ Pending |
| 2 | What's a "Phase" vs "SubTask"? | Phase wraps SubTasks / Phase IS SubTask | **Phase wraps**: PRD section containing tasks | ⬜ Pending |
| 3 | How many plan variants when enabled? | 1 / 2 / 3 | **2**: Default; **3** only for complex tasks | ⬜ Pending |
| 4 | Which models for judges? | Same model / Different models | **Different**: Claude, GPT-4, Gemini for diversity | ⬜ Pending |
| 5 | Pattern confidence decay? | Time-based / Usage-based / Manual | **Usage-based**: Decay if unused for 30 days | ⬜ Pending |

### Open Questions (Research Needed)

| # | Question | Why It Matters | Owner |
|---|----------|----------------|-------|
| 1 | How to handle partial wave failures? | Affects rollback strategy | Runtime |
| 2 | Can user edit plan mid-execution? | UX complexity | Frontend |
| 3 | What's the cost budget per workflow? | Resource limits | Billing |
| 4 | How to version patterns? | Reproducibility | Knowledge |
| 5 | Voice approval UX? | "Sounds good" vs explicit | Voice |

### Assumptions to Verify

| # | Assumption | How to Verify | Status |
|---|------------|---------------|--------|
| 1 | `decomposeTask()` can be extended to return Phases | Read `decompose-semantic.ts` | ✅ Verified |
| 2 | Docker workspace is fast enough for interactive use | Benchmark workspace creation | ⬜ Pending |
| 3 | Knowledge graph can store patterns | Read `hypergraph.ts` | ✅ Verified |
| 4 | Voice STT latency is acceptable for workflow initiation | Benchmark voice system | ⬜ Pending |
| 5 | Cognitive autonomy affects approval thresholds | Read `autonomy/` | ✅ Verified |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Recovery |
|------|------------|--------|------------|----------|
| Best-of-N increases cost 3x | High | Medium | Cap at 3 variants; reuse research | Disable for low-value tasks |
| Pattern learning creates bad patterns | Medium | High | Require 3+ successful uses before pattern is trusted | Manual pattern review UI |
| Docker workspace creation too slow | Medium | Medium | Warm pool (optional); reuse containers; reduce concurrency | Degrade to sequential execution; prompt user to continue |
| Visual builder is scope creep | High | Medium | Start with read-only plan viewer | Defer editing to Phase 2 |
| Voice approval is ambiguous | Medium | Low | Require explicit "approve" keyword | Fall back to web/mobile |

---

## DevOps Integration (deferred; V3+)

V1 scope is **PR creation + CI visibility** (build/test/typecheck). Automated deployment is **out of scope** until policy + elevation + telemetry are proven.

### Project deployment flow (optional; managed projects only)

```
Code Change (Agent Output)
  │
  ├──▶ PR Creation (existing: agents create PRs)
  │
  ├──▶ CI Pipeline (GitHub Actions)
  │      ├── Build
  │      ├── Test
  │      ├── Lint
  │      └── Type Check
  │
  ├──▶ User Approval (Desktop UI or Mobile)
  │
  ├──▶ Deploy (optional; only with explicit policy approval + fresh biometric ticket; autonomy influences defaults)
  │      ├── Docker Build
  │      ├── Push to Registry
  │      └── Deploy to Target
  │
  └──▶ Rollback (if health check fails)
         ├── Git revert
         └── Redeploy previous version
```

### (V3+) DevOps types (sketch; do not implement until policy is end-to-end)

```typescript
// NEW: packages/plan/src/devops/types.ts

export type DeploymentConfig = {
  target: "fly" | "railway" | "kubernetes" | "docker-compose";
  registry: string;
  autoDeployOnApproval: boolean;
  rollbackOnFailure: boolean;
  healthCheckUrl: string;
  healthCheckTimeoutMs: number;
};

export type DeploymentResult = {
  id: string;
  status: "pending" | "building" | "deploying" | "healthy" | "failed" | "rolled-back";
  prUrl?: string;
  deployUrl?: string;
  error?: string;
};
```

### (V3+) Database migration support (sketch; high risk)

```typescript
// NEW: packages/plan/src/devops/migration.ts

export type MigrationPlan = {
  id: string;
  name: string;
  sql: string;
  rollbackSql: string;
  dependencies: string[];
  status: "pending" | "applied" | "failed" | "rolled-back";
};

// ALFRED can generate migrations as part of a plan
export async function generateMigration(
  schemaChange: string
): Promise<MigrationPlan>;
```

---

## Cognitive Integration

### Autonomy Gradient Mapping

| Autonomy Level | Workflow Behavior |
|----------------|-------------------|
| 0.0 - 0.3 (read-only) | Generate plan + show diffs; require explicit approval before any write action |
| 0.3 - 0.5 (suggest) | Auto-run research/planning; suggest write actions; require approval before executing writes |
| 0.5 - 0.7 (cautious) | Auto-execute low-risk writes; pause before medium/high-risk steps; still enforce policy + elevation |
| 0.7 - 0.9 (supervised) | Auto-execute most steps; still enforce policy + elevation for destructive/external effects; notify on completion |
| 0.9 - 1.0 (full) | Auto-execute with minimal prompts; merge/deploy remain gated behind explicit policy approval + fresh biometric ticket |

### Physiology Integration

| Physiology State | Workflow Action |
|------------------|-----------------|
| High frustration (>0.7) | Pause and escalate to user |
| Low energy (<0.3) | Suggest smaller scope |
| High boredom (>0.7) | Suggest pattern refinement |

### Cognitive State Mapping

| State | Workflow Phase |
|-------|----------------|
| `idle` | Ready for new intent |
| `capturing` | Parsing voice/chat input |
| `thinking` | Research, generating plan variants |
| `deciding` | (Optional) plan selection/evaluation + user approval |
| `executing` | Multi-agent waves running |
| `reflecting` | Pattern learning from outcome |

---

## Testing Strategy

### Unit Tests

| Component | Test Focus | Location |
|-----------|------------|----------|
| Intent parser | NL → structured intent | `packages/plan/src/__tests__/intent.test.ts` |
| Plan generator | Intent → StructuredPlan | `packages/plan/src/__tests__/plan.test.ts` |
| Pattern matcher | Intent → relevant patterns | `packages/plan/src/__tests__/pattern.test.ts` |
| Evaluator | Multi-judge aggregation | `packages/plan/src/__tests__/eval.test.ts` |

### Integration Tests

| Scenario | Test Focus | Location |
|----------|------------|----------|
| Intent → Plan → Execute | Full flow without approval | `packages/plan/test/flow.test.ts` |
| Pattern extraction | Success → pattern created | `packages/plan/test/learn.test.ts` |
| Wave execution | Multi-agent wave orchestration invariants | `packages/runtime/test/waves.execution.test.ts` |
| Hydration | State recovery and event replay | `packages/runtime/test/hydrate.test.ts` |
| MAX_TRANSITIONS safeguard | Escalation loop detection and abort | `packages/runtime/test/pipeline-safety.test.ts` |

**Workflow runtime invariants (required):**
- **Normal success**: completes without escalation
- **Escalation**: produces a suspension/escalation event and resumes deterministically
- **MAX_TRANSITIONS**: fails fast on escalation loops (guard against infinite transitions)

Use `installWorkflowRuntimeFixture` from `@alfred/test-kit/workflow/runtime-fixture` for workflow/runtime integration tests so success/error/suspend flows are deterministic and clean up properly.

### E2E Tests (Playwright)

| Flow | Test Focus | Location |
|------|------------|----------|
| Workflow plan view | Plan renders, approve/execute visible, canvas view toggles | `apps/web/e2e/workflow.spec.ts` |
| Voice initiation | "Add dark mode" → plan shown | `apps/web/e2e/voice-workflow.spec.ts` |
| Mobile approval | Plan view, approve button | `apps/native/e2e/approval.spec.ts` |

---

## Success Criteria

### Functional Requirements

- [ ] Voice/chat input creates structured intent
- [ ] External + internal research aggregated
- [ ] 3 plan variants generated and evaluated
- [ ] Visual plan shown on desktop canvas
- [ ] User can approve/iterate on plan
- [ ] Multi-agent waves execute with isolation
- [ ] Successful patterns stored and reused
- [ ] Failed patterns deprioritized

### Non-Functional Requirements

| Metric | Target |
|--------|--------|
| Intent parsing latency | < 2s |
| Research latency | < 10s |
| Plan generation latency | < 15s |
| Evaluation latency | < 10s |
| Pattern match accuracy | > 80% |
| Cost per workflow (avg) | < $0.50 |

---

## Progress

| Date | Phase | Item | Status | Notes |
|------|-------|------|--------|-------|
| 2025-12-23 | 0 | ExecPlan v1.0 created | ✅ | Initial architecture |
| 2025-12-23 | 0 | Current state analysis | ✅ | ALFRED has 80% of infrastructure |
| 2025-12-24 | 0 | Linear Project & Issues created | ✅ | 30 issues created across 6 phases |
| 2025-12-24 | 1 | Create @alfred/plan package scaffold | ✅ | P1-1 implemented with core types + schemas |
| 2025-12-24 | 1 | Intent parser with clarification tool | ✅ | P1-2 implemented with AI SDK v6 + tRPC |
| 2025-01-27 | 0 | Desktop system review | ✅ | Aligned with Desktop UI Paradigm v3; see review doc |
| 2025-01-27 | 0 | Comprehensive gap analysis | ✅ | See `ai-native-workflow-gap-analysis.md` for detailed component-by-component gaps |
| 2025-12-24 | 1 | Intent parser | ✅ | P1-2 implementation complete |
| 2025-12-24 | 1 | Research aggregator (v2) | ✅ | P1-3 updated with Exa SDK v2 native research capabilities |
| 2026-01-19 | 2 | Plan generator (`StructuredPlan`) | ✅ | `packages/plan/src/generate/phased.ts` + unit tests; not yet canonical in `@alfred/pipeline` |
| 2025-12-24 | 1 | @alfred/plan package scaffold | ✅ | P1-1 implementation complete |
| 2026-01-19 | 2 | Deterministic evaluation + critique | ✅ | `packages/plan/src/evaluate/*` + tests; surfaced via `packages/api/src/routers/plan.ts` |
| 2026-01-19 | 2 | Plan persistence & approval gate | ✅ | `workflow_plans` table + `planRepo` + `planRouter.create/approve/reject/get/list` |
| 2026-01-19 | 2 | Pattern storage (SQL) | ✅ | `workflow_patterns` table + `patternRepo` |
| 2026-01-19 | 3 | Pattern learner (outcome → pattern feedback loop) | 🟡 | extraction exists; wiring to real workflow outcomes still incomplete |
| 2026-01-19 | 3 | Pattern matcher | ✅ | `packages/plan/src/pattern/match.ts` + `planRouter.patternsMatch` |
| 2026-01-19 | 4 | Visual builder (read-only) | ✅ | Web `workflow` window has optional canvas: `apps/web/src/components/windows/workflow/workflow-canvas.tsx` |
| 2026-01-19 | 4 | Visual builder (editable) | 🟡 | Local edits supported in UI; persistence + validation (cycle prevention) still in progress |

---

## Surprises & Discoveries

> Updated as implementation progresses.

| Date | Discovery | Impact | Action Taken |
|------|-----------|--------|--------------|
| 2025-12-23 | ALFRED already has 80% infrastructure (waves, merge, review, workspace isolation) | Reduces scope significantly | Reuse existing orchestrator, add phases |
| 2025-12-23 | No clarification mechanism exists | Critical UX gap | Added as P0 in Phase 1 |
| 2025-12-23 | Context not propagated between agents | Limits multi-agent effectiveness | Workspace persistence is implicit; explicit handoff needed |
| 2025-12-23 | Pattern learning completely unimplemented | Core value proposition at risk | Elevated to Phase 2 (parallel with evaluation) |
| 2025-12-23 | Docker warm pool doesn't exist | Cold start 5-15s impacts UX | Deferred to Phase 6 (optimization) |
| 2025-12-23 | No Project container exists | Patterns pollute across codebases; conventions not accumulated | Added Project entity with auto-detection (P1-6, P1-7) |
| 2025-12-23 | ProjectConfig is runtime-only | Technical config not persisted or linked to workflows | Elevate to Project entity, persist in DB |
| 2025-12-24 | Exa SDK v2 released | Replaces manual research aggregation logic | Upgraded exa-js to v2.0.12, added native research support in toolWeb and research aggregator |

---

## Phased Implementation Plan

### Linear Structure Overview

```
Epic: AI-Native Workflow System
├── Cycle 1: Foundation
│   ├── Phase 1: Intent, Research & Projects (7 tickets)
│   └── Phase 2: Planning & Evaluation (4 tickets)
├── Cycle 2: Execution & Learning  
│   ├── Phase 3: Execution Integration (4 tickets)
│   └── Phase 4: Pattern Learning & Conventions (6 tickets)
└── Cycle 3: Polish & Scale
    ├── Phase 5: Visual Builder (5 tickets)
    └── Phase 6: Resilience & Optimization (4 tickets)

Total: 30 tickets across 6 phases
```

---

### Phase 1: Intent & Research

**Goal:** Users can speak/type intent and receive structured research context.

**Linear Tickets:**

| ID | Ticket | Title | Type | Description | Acceptance Criteria | Dependencies | Labels |
|----|--------|-------|------|-------------|---------------------|--------------|--------|
| P1-1 | [ALF-276](https://linear.app/alfred-ops/issue/ALF-276) | Create `@alfred/plan` package scaffold | Story | Initialize new package with types, schemas, exports | Package builds, exports `Phase`, `StructuredPlan`, `WorkflowPattern`, `PlanEvaluation` types | None | `plan`, `foundation` |
| P1-2 | [ALF-277](https://linear.app/alfred-ops/issue/ALF-277) | Intent parser with clarification tool | Story | Parse voice/chat to `WorkflowIntent`, detect ambiguity, emit clarification requests | Intent parsed from 5 test phrases; ambiguous input triggers clarification (max 3); multi-intent split working | P1-1 | `plan`, `intent` |
| P1-3 | [ALF-278](https://linear.app/alfred-ops/issue/ALF-278) | External research aggregator | Story | Integrate web search (Exa/DDG), docs lookup, source scoring | Web search returns top 5 results with source reliability scores; date filtering applied | ✅ | `plan`, `research` |
| P1-4 | [ALF-279](https://linear.app/alfred-ops/issue/ALF-279) | Internal research (codebase + patterns) | Story | Semantic code search, import analysis, pattern lookup (stub) | Codebase context includes relevant files, detected conventions; pattern lookup returns empty gracefully | P1-1 | `plan`, `research` |
| P1-5 | [ALF-280](https://linear.app/alfred-ops/issue/ALF-280) | Research aggregation & context builder | Story | Combine external + internal research into `ResearchResult` | Combined context under token limit; sources deduplicated; research completes in <10s | ✅ | `plan`, `research` |
| P1-6 | [ALF-281](https://linear.app/alfred-ops/issue/ALF-281) | Project entity & auto-detection | Story | Create `projects` table, auto-detect from workspace path, basic CRUD | Project auto-created from workspace; unique per user+workspace; config detected | ✅ | `plan`, `project` |
| P1-7 | [ALF-282](https://linear.app/alfred-ops/issue/ALF-282) | Project-Linear sync | Story | Link ALFRED Project to Linear Project, sync metadata bidirectionally | Linear Project ID stored; team ID resolved; metadata synced on workflow start | P1-6 | `plan`, `project` |

**Deliverables:**
- `packages/plan/src/intent/` — Intent parsing with clarification
- `packages/plan/src/research/` — Research aggregation
- `packages/plan/src/project/` — Project resolution & Linear sync
- `packages/plan/src/types.ts` — Core type definitions
- `packages/db/src/schema/project.ts` — Project schema
- Migration: `0XXX_projects.sql`
- tRPC router: `plan.parseIntent`, `plan.research`, `project.resolve`, `project.list`

---

### Phase 2: Planning & Evaluation

**Goal:** Generate structured plans from intent+research; keep evaluation bounded and prefer deterministic verification.

**Linear Tickets:**

| ID | Ticket | Title | Type | Description | Acceptance Criteria | Dependencies | Labels |
|----|--------|-------|------|-------------|---------------------|--------------|--------|
| P2-1 | [ALF-283](https://linear.app/alfred-ops/issue/ALF-283) | Phased plan generator | Story | Intent + Research → `StructuredPlan` with phases, tasks, dependencies | Plan generated with valid dependency graph; phases match bucket heuristics; acceptance criteria populated | P1-5 | `plan`, `generate` |
| P2-2 | [ALF-284](https://linear.app/alfred-ops/issue/ALF-284) | Plan critique (single-model, optional) | Story | Generate a critique + revisions loop for a single plan (bounded iterations) | Critique produced; max 2 revisions; output still validates schema; abort respected | P2-1 | `plan`, `evaluate` |
| P2-3 | [ALF-285](https://linear.app/alfred-ops/issue/ALF-285) | Deterministic evaluation (default) | Story | Prefer verification-first scoring: typecheck/tests/build, plus a small rubric for tie-breaks | “Passes checks” gates plan selection; rubric is only used when checks are equal; budgets enforced | P2-1 | `plan`, `evaluate` |
| P2-4 | [ALF-286](https://linear.app/alfred-ops/issue/ALF-286) | Plan persistence & approval gate | Story | Store plans in DB and require explicit approval to start a workflow run | Plan persisted to `workflow_plans` table; approval creates run; optional YAML export is explicit “download” | P2-3 | `plan`, `db` |

**Deliverables:**
- `packages/plan/src/generate/` — Plan generation
- `packages/plan/src/evaluate/` — Verification-first evaluation + bounded critique (optional)
- `packages/plan/src/serialize/` — JSON serialization (YAML export optional only)
- Migration: `0XXX_workflow_plans.sql`
- tRPC router: `plan.generate`, `plan.evaluate`, `plan.approve`

---

### Phase 3: Execution Integration

**Goal:** Connect plans to existing runtime orchestrator for multi-agent execution.

**Linear Tickets:**

| ID | Ticket | Title | Type | Description | Acceptance Criteria | Dependencies | Labels |
|----|--------|-------|------|-------------|---------------------|--------------|--------|
| P3-1 | [ALF-287](https://linear.app/alfred-ops/issue/ALF-287) | Plan → WavePlan conversion | Story | Convert `StructuredPlan` phases to existing `WavePlan` format | Phases correctly map to waves; dependencies respected; agent types assigned | P2-4 | `runtime`, `orchestrator` |
| P3-2 | [ALF-288](https://linear.app/alfred-ops/issue/ALF-288) | Cross-agent context handoff | Story | Propagate agent outputs to subsequent agents explicitly | Agent N+1 receives summary of Agent N changes; context refreshed after each wave | P3-1 | `runtime`, `context` |
| P3-3 | [ALF-289](https://linear.app/alfred-ops/issue/ALF-289) | Execution event streaming | Story | Stream wave progress, agent output, merge status to UI | Events emitted for wave-start, agent-complete, merge-progress; UI receives in <100ms | P3-2 | `runtime`, `stream` |
| P3-4 | [ALF-290](https://linear.app/alfred-ops/issue/ALF-290) | Workflow suspend/resume on clarification | Story | Pause workflow when clarification needed, resume with user response | Clarification suspends workflow; user response resumes; state persisted across restart | P3-3 | `runtime`, `suspend` |

**Deliverables:**
- Extend `packages/runtime/src/orchestrator/waves.ts` to incorporate research outputs + selected plan → effective requirement/subtasks
- Extend `packages/runtime/src/orchestrator/types.ts` to carry plan metadata through execution
- Keep Phase A–E orchestrator and thread plan execution through it (do not create a new `phases/` directory)
- tRPC router: `workflow.start`, `workflow.suspend`, `workflow.resume`

---

### Phase 4: Pattern Learning

**Goal:** Extract and reuse patterns from successful workflow executions.

**Linear Tickets:**

| ID | Ticket | Title | Type | Description | Acceptance Criteria | Dependencies | Labels |
|----|--------|-------|------|-------------|---------------------|--------------|--------|
| P4-1 | [ALF-291](https://linear.app/alfred-ops/issue/ALF-291) | Pattern extraction from success | Story | Extract `WorkflowPattern` from completed workflows | Pattern captures intent trigger, plan structure, success rate; stored in DB + knowledge graph | P3-4 | `plan`, `pattern` |
| P4-2 | [ALF-292](https://linear.app/alfred-ops/issue/ALF-292) | Pattern matching for intent | Story | Find relevant patterns for new intents based on semantic + structural similarity | Patterns matched with similarity >0.7; structural validation prevents near-misses | P4-1 | `plan`, `pattern` |
| P4-3 | [ALF-293](https://linear.app/alfred-ops/issue/ALF-293) | Pattern confidence decay & quarantine | Story | Decay unused patterns, quarantine failing patterns, amplify successful ones | 30-day unused decay; <30% success quarantine; >90% success amplification | P4-2 | `plan`, `pattern` |
| P4-4 | [ALF-294](https://linear.app/alfred-ops/issue/ALF-294) | Anti-pattern learning | Story | Store failure patterns to avoid repeating mistakes | Failed patterns recorded with failure reason; blocked from matching for configurable period | P4-2 | `plan`, `pattern` |
| P4-5 | [ALF-295](https://linear.app/alfred-ops/issue/ALF-295) | Project-scoped pattern matching | Story | Filter patterns by project_id before semantic matching | Project patterns prioritized; cross-project patterns weighted 0.8x; >90% in-project match accuracy | P4-2, P1-6 | `plan`, `pattern`, `project` |
| P4-6 | [ALF-296](https://linear.app/alfred-ops/issue/ALF-296) | Convention learning | Story | Extract and store project conventions from successful workflows | Conventions extracted post-success; confidence increases on reinforcement; injected into research | P4-1, P1-6 | `plan`, `pattern`, `project` |

**Deliverables:**
- `packages/plan/src/pattern/` — Pattern learning & matching
- `packages/plan/src/pattern/conventions.ts` — Convention extraction & learning
- Migration: `0XXX_workflow_patterns.sql` (includes project_id FK)
- Knowledge graph integration for semantic pattern search
- tRPC router: `plan.patterns`, `plan.matchPattern`, `project.conventions`

---

### Phase 5: Visual Builder

**Goal:** Interactive canvas for viewing, editing, and approving plans.

**Linear Tickets:**

| ID | Ticket | Title | Type | Description | Acceptance Criteria | Dependencies | Labels |
|----|--------|-------|------|-------------|---------------------|--------------|--------|
| P5-1 | [ALF-297](https://linear.app/alfred-ops/issue/ALF-297) | Workflow canvas view (inside `workflow` window) | Story | Add optional React Flow canvas view inside the existing `workflow` node/window | Canvas view renders; zoom/pan works; respects desktop window patterns | P2-4 | `ui`, `workflow` |
| P5-2 | [ALF-298](https://linear.app/alfred-ops/issue/ALF-298) | Phase node component | Story | Visual node representing a phase with status, agent, duration | Phases render as nodes; status indicator (pending/running/complete/failed); click expands detail | P5-1 | `ui`, `builder` |
| P5-3 | [ALF-299](https://linear.app/alfred-ops/issue/ALF-299) | Dependency edge component | Story | Animated edges showing phase dependencies | Edges connect dependent phases; animation during execution; highlight on hover | P5-2 | `ui`, `builder` |
| P5-4 | [ALF-300](https://linear.app/alfred-ops/issue/ALF-300) | Approval controls panel | Story | Approve/reject/iterate buttons with keyboard shortcuts | Approve executes plan; reject cancels; iterate opens edit mode; keyboard accessible | P5-3 | `ui`, `builder` |
| P5-5 | [ALF-301](https://linear.app/alfred-ops/issue/ALF-301) | Plan editing (drag-drop, reorder) | Story | Edit phases, reorder, adjust agents in canvas | Drag reorders phases; cycle detection prevents invalid deps; changes saved optimistically | P5-4 | `ui`, `builder` |

**Deliverables:**
- `apps/web/src/components/windows/workflow/` — New thin Desktop workflow window (v3-compliant; replaces Mindscape fat-node usage for workflows)
- `apps/web/src/collections/plan.ts` — Plan collection following `note.ts`/`reminder.ts` patterns (optional but consistent)
- Integration with desktop window system

---

### Phase 6: Resilience & Optimization

**Goal:** Production hardening with measurable wins (latency, cost, abort reliability). Avoid platform re-writes until telemetry demands them.

**Linear Tickets:**

| ID | Ticket | Title | Type | Description | Acceptance Criteria | Dependencies | Labels |
|----|--------|-------|------|-------------|---------------------|--------------|--------|
| P6-1 | [ALF-302](https://linear.app/alfred-ops/issue/ALF-302) | Docker warm pool (optional) | Story | Pre-create container pool for reduced cold start | Warm containers maintained; assignment from pool is fast; replenishment async; opt-in via env | P3-4 | `agent`, `performance` |
| P6-2 | [ALF-303](https://linear.app/alfred-ops/issue/ALF-303) | Cost tracking & budget limits | Story | Track per-workflow costs, enforce budgets, surface to user | Token usage tracked per phase; budget exceeded suspends workflow; cost surfaced in UI | P3-4 | `runtime`, `metrics` |
| P6-3 | [ALF-304](https://linear.app/alfred-ops/issue/ALF-304) | Resilience tests & safeguards | Story | Add explicit tests for success/escalation/MAX_TRANSITIONS + abort propagation | Suites cover normal success, escalation, and MAX_TRANSITIONS guards; abort cancels cleanly | P3-4 | `runtime`, `resilience` |
| P6-4 | [ALF-305](https://linear.app/alfred-ops/issue/ALF-305) | Defer checkpointing/circuit breakers | Story | Document why multi-level checkpoints + generic circuit breakers are postponed | Clear “not before” criteria; telemetry thresholds; avoids premature platform work | P6-3 | `runtime`, `resilience` |

**Deliverables:**
- `packages/agent/src/environment/pool.ts` — Container warm pool (if we implement it)
- Cost tracking in workflow metrics

**Implementation Status (2026-01-17):**

✅ **Phase 6 Complete**

All resilience and optimization tasks have been implemented:

1. **Docker Warm Pool (ALF-302):** ✅ Implemented
   - `AgentWarmPool` class exists at `packages/runtime/src/workflow/agent-warm-pool.ts`
   - Pre-warms containers for reduced cold start
   - Async replenishment

2. **Cost Tracking & Budget Limits (ALF-303):** ✅ Implemented
   - `packages/metrics/src/cost.ts` — Cost tracking with recordCost(), getRunCostSummary(), checkBudget()
   - `packages/metrics/src/pricing.ts` — Pricing registry for OpenAI, Cerebras, OpenRouter
   - `packages/pipeline/src/budget.ts` — Budget enforcement in pipeline context
   - Budget warning/exceeded events added to pipeline events

3. **Resilience Tests & Safeguards (ALF-304):** ✅ Implemented
   - `packages/pipeline/test/resilience/abort.test.ts` — Abort signal propagation tests
   - `packages/pipeline/test/resilience/transitions.test.ts` — MAX_TRANSITIONS guard tests
   - `packages/pipeline/test/resilience/escalation.test.ts` — Escalation flow tests

4. **Defer Checkpointing/Circuit Breakers (ALF-305):** ✅ Documented

**Checkpointing Decision:**

Multi-level checkpointing is **intentionally deferred** until the following criteria are met:

**Implement Checkpointing When:**
1. Average workflow duration exceeds 10 minutes
2. Workflow volume exceeds 100 runs/day
3. User feedback requests resume capability
4. Telemetry shows >5% transient failure rate

**Current State (Jan 2026):**
- Avg workflow duration: 2-5 minutes
- Volume: <10 runs/day
- Transient failures: <1%
- Sufficient safeguards exist (timeouts, abort, stuck detection, wave abort)

**Circuit Breaker Decision:**

Generic circuit breakers are **intentionally deferred** until:

**Implement Circuit Breakers When:**
1. Upstream API failures exceed 10% (24hr window)
2. Cascading failures detected
3. Recovery time exceeds 5 minutes
4. Manual intervention required >1x/week

**Current State:**
- Upstream APIs (OpenAI, Cerebras) have 99.9% uptime
- No cascading failures observed
- Auto-retry with backoff handles transient errors

**Next Review:** July 2026 or when any criterion is met

---

### Linear Epic/Ticket Creation Checklist

**Epic:**
- [ ] Create Epic: "AI-Native Workflow System" with description from Executive Summary
- [ ] Link to this ExecPlan document

**Cycles:**
- [ ] Cycle 1: "Foundation" — Phases 1-2
- [ ] Cycle 2: "Execution & Learning" — Phases 3-4
- [ ] Cycle 3: "Polish & Scale" — Phases 5-6

**Labels to Create:**
- [ ] `plan` — Planning package work
- [ ] `intent` — Intent parsing
- [ ] `research` — Research aggregation
- [ ] `generate` — Plan generation
- [ ] `evaluate` — Evaluation pipeline
- [ ] `pattern` — Pattern learning
- [ ] `project` — Project container & scoping
- [ ] `builder` — Visual builder
- [ ] `resilience` — Fault tolerance
- [ ] `performance` — Optimization

**Ticket Creation Order:**
1. Create Epic first
2. Create all Phase labels
3. Create tickets in phase order (P1-1 through P6-4)
4. Set dependencies between tickets
5. Assign to Cycle based on phase

---

### Implementation Dependencies Graph

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │               Phase 1: Intent, Research & Projects           │
                    │  P1-1 ──┬──▶ P1-2                                            │
                    │         ├──▶ P1-3 ──┬──▶ P1-5                                │
                    │         ├──▶ P1-4 ──┘                                        │
                    │         └──▶ P1-6 ──▶ P1-7  (Project container)              │
                    └─────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      Phase 2: Planning & Evaluation          │
                    │  P2-1 ──▶ P2-2 ──▶ P2-3 ──▶ P2-4                            │
                    └─────────────────────────────────────────────────────────────┘
                                              │
                          ┌───────────────────┴───────────────────┐
                          ▼                                       ▼
┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│      Phase 3: Execution Integration      │   │          Phase 5: Visual Builder         │
│  P3-1 ──▶ P3-2 ──▶ P3-3 ──▶ P3-4        │   │  P5-1 ──▶ P5-2 ──▶ P5-3 ──▶ P5-4 ──▶ P5-5│
└─────────────────────────────────────────┘   └─────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────┐
│     Phase 4: Pattern Learning & Conv.    │
│  P4-1 ──▶ P4-2 ──┬──▶ P4-3              │
│                  ├──▶ P4-4              │
│                  ├──▶ P4-5 (project)    │ ◀── P1-6
│                  └──▶ P4-6 (conventions)│ ◀── P1-6
└─────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────┐
│    Phase 6: Resilience & Optimization    │
│  P6-1 ──▶ P6-2 ──▶ P6-3                 │
│  P6-4 (parallel, depends on P3-4)       │
└─────────────────────────────────────────┘
```

---

### Risk Mitigation by Phase

| Phase | Primary Risk | Mitigation | Fallback |
|-------|--------------|------------|----------|
| 1 | Clarification UX too disruptive | Max 3 questions, auto-resolve with assumptions | Proceed without clarification, log gaps |
| 1 | Project auto-detection wrong | Detect from package.json/Cargo.toml + workspace path | User can rename/merge projects |
| 2 | Best-of-N too expensive | Auto-scale based on complexity | Single plan for simple tasks |
| 3 | Existing orchestrator incompatible | Plan→WavePlan adapter | Rewrite waves module |
| 4 | Pattern learning creates bad patterns | 3+ success threshold, decay + quarantine | Manual pattern curation |
| 4 | Convention pollution | Project isolation; cross-project conventions require >0.9 confidence | Manual convention review |
| 5 | React Flow performance | Virtualization, LOD | Read-only list view |
| 6 | Circuit breaker cascades | Terminal fallback chain | Queue for later execution |

---

### Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Intent parsing accuracy | >90% correct extraction |
| 1 | Research latency | <10 seconds |
| 1 | Project auto-detection success | >95% |
| 2 | Plan generation latency | <15 seconds |
| 2 | Human agreement with generated plans | >80% |
| 3 | Execution success rate | >70% |
| 3 | Context propagation effectiveness | <5% "missing context" errors |
| 4 | Pattern reuse rate | >30% after 30 days |
| 4 | Pattern-assisted success rate | >85% |
| 4 | In-project pattern match accuracy | >90% |
| 4 | Cross-project pattern rejection | >50% correctly filtered |
| 4 | Convention confidence (10 workflows) | >0.7 average |
| 5 | Visual builder interaction latency | <16ms (60fps) |
| 5 | Plan editing saves | <100ms |
| 6 | Circuit breaker recovery | <60s mean time to recovery |
| 6 | Cost per workflow | <$0.50 average |

---

## Proposal 1: Concrete File Structure

Following ALFRED's domain-driven modular design and single-word naming conventions:

```
packages/
├── plan/                           # NEW: AI-Native Planning Package
│   ├── src/
│   │   ├── index.ts                # Public exports
│   │   ├── types.ts                # Phase, StructuredPlan, WorkflowPattern, PlanEvaluation
│   │   │
│   │   ├── intent/                 # Intent extraction (NL → structured)
│   │   │   ├── index.ts
│   │   │   ├── parser.ts           # Voice/chat → WorkflowIntent
│   │   │   ├── classify.ts         # Intent classification
│   │   │   └── schema.ts           # Zod schemas for intent
│   │   │
│   │   ├── research/               # External + internal research
│   │   │   ├── index.ts
│   │   │   ├── external.ts         # Web search, docs lookup
│   │   │   ├── internal.ts         # Codebase scan, pattern lookup
│   │   │   ├── aggregate.ts        # Combine research sources
│   │   │   └── schema.ts           # ResearchResult schema
│   │   │
│   │   ├── generate/               # Plan generation
│   │   │   ├── index.ts
│   │   │   ├── phased.ts           # Intent → StructuredPlan (Phased PRD)
│   │   │   ├── variant.ts          # Generate N plan variants
│   │   │   ├── prompt.ts           # LLM prompts for plan gen
│   │   │   └── template.ts         # Template-based plan scaffolding
│   │   │
│   │   ├── evaluate/               # Best-of-N evaluation
│   │   │   ├── index.ts
│   │   │   ├── judge.ts            # AI judge definitions
│   │   │   ├── criteria.ts         # Evaluation criteria
│   │   │   ├── aggregate.ts        # Combine judge scores
│   │   │   └── prompt.ts           # Evaluation prompts
│   │   │
│   │   ├── pattern/                # Pattern learning & matching
│   │   │   ├── index.ts
│   │   │   ├── extract.ts          # Success → WorkflowPattern
│   │   │   ├── match.ts            # Intent → relevant patterns
│   │   │   ├── refine.ts           # Pattern improvement over time
│   │   │   └── store.ts            # Pattern persistence (SQL + graph)
│   │   │
│   │   └── serialize/              # YAML/JSON serialization
│   │       ├── index.ts
│   │       ├── json.ts             # JSON marshaling (canonical)
│   │       ├── yaml.ts             # YAML export/import (optional; gated)
│   │       └── validate.ts         # Schema validation
│   │
│   ├── test/
│   │   ├── intent.test.ts
│   │   ├── research.test.ts
│   │   ├── generate.test.ts
│   │   ├── evaluate.test.ts
│   │   └── pattern.test.ts
│   │
│   └── package.json                # @alfred/plan

apps/web/src/
├── components/
│   └── windows/
│       └── workflow/
│           ├── index.tsx          # NEW: Thin Desktop workflow window (plan + execution)
│           ├── plan.tsx           # Plan viewer (resource-backed)
│           └── canvas.tsx         # Optional React Flow view (pure render)
│
├── collections/
│   └── plan.ts                     # Plan collection (follow note/reminder patterns via @tanstack/react-db)

packages/runtime/src/orchestrator/
├── waves.ts                        # EXTEND: Phase A (research + plan selection + allocation inputs)
├── merge.ts                        # KEEP: Phase B/D
├── conflict.ts                     # KEEP: Phase C
├── review.ts                       # KEEP: Phase E
└── index.ts                        # KEEP: Orchestrator entrypoint
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate `@alfred/plan` package | Isolate planning complexity from runtime |
| Extend existing `workflow` window | Desktop already supports `workflow`/`workflowlist`; avoid new window types unless necessary |
| `collections/plan.ts` | Same pattern as `note.ts`, `reminder.ts` |
| Single-word folder names | ALFRED naming convention compliance |

---

## Proposal 2: Desktop UI Integration

### State Management Architecture

```typescript
// Desktop UI Paradigm v3 compliance:
// - Desktop = Thin Windows (WindowData + optional resourceRef)
// - Mindscape = Fat Nodes (embedded data) → do NOT extend Mindscape nodes for new Desktop features.
//
// Use the existing desktop window model (no new store slice required).
//
// apps/web/src/store/desktop/types.ts already supports:
// - WindowType includes "workflow" and "workflowlist"
// - WindowData includes `draft?: unknown` for per-window transient UI state
//
// apps/web/src/store/desktop.schemas.ts already defines `workflowWindowDataSchema`.
// We extend it with `planId` and `view` to support plan viewing and an optional canvas view.
```

### Resource Reference Pattern

**Question:** Should `planId` be a direct field or part of `resourceRef`?

**Decision:** Plans are persisted resources (stored in `workflow_plans` table), so they should use `resourceRef` pattern for consistency. However, since plans are conceptually part of a workflow run, we use `planId` as a direct field for simplicity, with the understanding that:

- Plans are persisted resources (source of truth: Postgres `workflow_plans` table)
- Plans can exist independently of workflow runs (draft plans before approval)
- `planId` references the plan resource; `runId` references the execution resource
- Both can coexist: a window can show a plan (`planId`) and its execution (`runId`)

**Extended Schema:**
```typescript
export const workflowWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("workflow"),
  // Existing fields...
  messages: z.array(uiMessageSchema).optional(),
  status: z.enum(["Idle", "running", "completed", "failed", "pending", "starting"]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  requirement: z.string().optional(),
  runId: z.string().optional(), // Workflow execution resource
  auto: z.enum(["read", "low", "medium", "high"]).optional(),
  
  // NEW fields for plan viewer/canvas
  planId: z.string().uuid().optional(), // Plan resource (persisted in workflow_plans table)
  view: z.enum(["plan", "canvas", "timeline"]).optional(), // Transient UI state (could use draft instead)
  
  // Optional: explicit resourceRef for future extensibility
  resourceRef: z.object({
    type: z.enum(["workflow_run", "plan"]),
    id: z.string().uuid(),
  }).optional(),
});
```

### Source-of-Truth Matrix

Following the desktop paradigm's source-of-truth matrix (see `docs/execplans/desktop-ui-paradigm.md` Section 5):

| Data Type | Source of Truth | Local Cache | Sync Strategy |
|-----------|----------------|-------------|---------------|
| **Layout State** | | | |
| Window positions | Zustand | localStorage | None (UI-only) |
| Window sizes | Zustand | localStorage | None (UI-only) |
| Canvas zoom/pan | Zustand | `WindowData.draft` | None (UI-only) |
| **Domain Resources** | | | |
| Workflow plans | Postgres (`workflow_plans`) | TanStack DB Collection | Optimistic mutation |
| Workflow runs | Postgres (`workflow_runs`) | TanStack DB Collection | tRPC subscription |
| Workflow events | Postgres (`workflow_events`) | (streamed, not cached) | WebSocket stream |
| **Ephemeral State** | | | |
| Canvas node positions | `WindowData.draft` | Memory | None (ephemeral) |
| View mode ("plan" \| "canvas" \| "timeline") | `WindowData.view` | Memory | None (ephemeral) |
| Draft plan edits | `WindowData.draft` | Memory | Explicit save |

**Key Principle:** Layout state (positions, sizes, view mode) lives locally. Domain resources (plans, runs, events) are backend-first with optimistic UI updates.

### Data Flow (tRPC + TanStack Query + WebSocket)

**Initial Fetch:**
- Plans fetched via TanStack Query (`trpc.plan.get.useQuery`)
- Collections use `@tanstack/react-db` + `@tanstack/query-db-collection` for optimistic mutations
- Standard TanStack Query invalidation / `setQueryData` for updates

**Real-Time Streaming:**
- **WebSocket subscription** for workflow execution events (plan generation, wave progress, agent output)
- Single WebSocket connection per client with multiplexed streams (see `apps/web/src/lib/subscription/manager.ts`)
- Cursor-based resume for long-running operations
- Stream ID: `workflow:{runId}` for execution events, `plan:{planId}` for plan generation events

**Example:**
```typescript
// apps/web/src/components/windows/workflow/workflow-window.tsx

import { useSubscription } from "@/lib/subscription/hooks";
import { trpc } from "@/lib/trpc-client";

export function WorkflowWindow({ id, data }: { id: string; data: WorkflowWindowData }) {
  // Initial fetch via TanStack Query
  const { data: plan } = trpc.plan.get.useQuery(
    { planId: data.planId! },
    { enabled: !!data.planId }
  );
  
  // Real-time execution events via WebSocket
  const { status, lastEvent } = useSubscription(
    `workflow:${data.runId}`,
    (event) => {
      // Handle workflow events: wave-start, agent-complete, merge-progress, etc.
      updateWorkflowState(event);
    },
    { enabled: !!data.runId }
  );
  
  // Plan generation events (if generating)
  const { lastEvent: planEvent } = useSubscription(
    `plan:${data.planId}`,
    (event) => {
      // Handle plan events: plan-variant, plan-selected, etc.
      updatePlanState(event);
    },
    { enabled: !!data.planId && !plan }
  );
  
  // ... render logic
}
```

**Reference:** See desktop paradigm Section 10 (Subscription Protocol Contract) and `apps/web/src/lib/subscription/` for implementation patterns.

### Window Lifecycle

**Spawning:**
- Windows spawned programmatically when plan is created or workflow starts
- Example: `spawnWindow({ type: "workflow", planId: plan.id, runId: run.id })`
- Can also be spawned from Dock or Command Palette

**Focus/Activation:**
- Window receives focus when plan is approved or workflow status changes
- Active execution windows auto-focus on critical events (errors, completion)

**Persistence:**
- Layout state (position, size) persists in Zustand + localStorage
- Resource state (plan, run) persists in Postgres
- Windows can persist after workflow completion for review/history

**Cleanup:**
- Optional auto-close on completion (configurable per workflow)
- Manual dismissal via window controls
- Historical workflows remain accessible via `workflowlist` window

**Window Tier:**
- Active execution: `primary` tier (visual prominence)
- Completed workflows: `secondary` tier
- Historical/archived: `tertiary` tier

### Canvas Subview (React Flow)

**Important:** Canvas is a **subview within the workflow window**, not a separate window type.

```typescript
// apps/web/src/components/windows/workflow/workflow-window.tsx

export function WorkflowWindow({ id, data }: { id: string; data: WorkflowWindowData }) {
  const view = data.view ?? "plan"; // Default to plan view
  
  return (
    <WindowFrame>
      {/* View selector */}
      <ViewTabs>
        <Tab onClick={() => updateView("plan")}>Plan</Tab>
        <Tab onClick={() => updateView("canvas")}>Canvas</Tab>
        <Tab onClick={() => updateView("timeline")}>Timeline</Tab>
      </ViewTabs>
      
      {/* Render subview based on view mode */}
      {view === "plan" && <PlanViewer plan={plan} />}
      {view === "canvas" && <PlanCanvas plan={plan} />}
      {view === "timeline" && <ExecutionTimeline run={run} />}
    </WindowFrame>
  );
}

// Canvas state can live in WindowData.draft for persistence
function PlanCanvas({ plan }: { plan: StructuredPlan }) {
  const [nodes, setNodes] = useState(() => phasesToNodes(plan.phases));
  const [edges, setEdges] = useState(() => dependenciesToEdges(plan.phases));
  
  // Save canvas state to draft on changes
  useEffect(() => {
    updateWindow(id, {
      draft: { canvasNodes: nodes, canvasEdges: edges },
    });
  }, [nodes, edges]);
  
  return <ReactFlow nodes={nodes} edges={edges} />;
}
```

**Canvas Features:**
- Phases render as nodes with status indicators
- Dependencies render as animated edges
- Read-only initially (Phase 5), editable later (Phase 5-5)
- Zoom/pan state persists in `WindowData.draft`

### Orchestrator UI Patterns Integration

Workflow execution requires specialized UI patterns for technical operations. See `docs/strategy/orchestrator-ui-patterns.md` for:

- **StreamingTerminal** component for Codex/Docker output streaming
- **ProgressWindow** for long-running operations (Docker builds, Proxmox VM creation)
- **WorkflowTimeline** component for phase/task visualization (already described in orchestrator patterns)
- **ErrorPanel** for failure visualization and debugging
- **ResourceMonitor** for Docker container/Proxmox VM resource usage

**Alignment:**
- Workflow execution events stream via WebSocket (matches StreamingTerminal pattern)
- Phase progress tracked via WorkflowTimeline component
- Agent output streams to terminal-like UI (Codex stdout/stderr)
- Errors surface in ErrorPanel with context and retry controls

**Reference:** See `docs/strategy/orchestrator-ui-patterns.md` Sections 1-8 for component specifications and integration patterns.

---

## Proposal 3: AI SDK v6 Integration

### Plan Generation with streamText

```typescript
// packages/plan/src/generate/phased.ts

import { streamText, tool, generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { WorkflowIntent, StructuredPlan, Phase } from "../types";
import type { ResearchResult } from "../research";

const structuredPlanSchema = z.object({
  title: z.string().describe("Concise plan title"),
  phases: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      requirement: z.string(),
      complexity: z.enum(["low", "medium", "high"]),
    })),
    estimatedDurationMs: z.number(),
    agentType: z.enum(["codex", "droid", "claude-code", "research", "review"]),
    dependsOn: z.array(z.string()),
  })),
  resources: z.object({
    agentCount: z.number(),
    strategy: z.enum(["sequential", "parallel", "topological"]),
    isolation: z.enum(["container", "worktree"]),
  }),
});

export async function* generatePlan(
  intent: WorkflowIntent,
  research: ResearchResult,
  signal?: AbortSignal
): AsyncGenerator<WorkflowEvent, StructuredPlan, void> {
  const model = openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o");

  // Use generateObject for structured output
  const result = await generateObject({
    model,
    schema: structuredPlanSchema,
    prompt: buildPlanPrompt(intent, research),
    abortSignal: signal,
  });

  yield {
    type: "plan-generated",
    plan: result.object,
  };

  return {
    id: crypto.randomUUID(),
    intent: intent.description,
    ...result.object,
    evaluationCriteria: defaultEvaluationCriteria(),
  };
}

// Plan variant generation with Best-of-N
export async function generatePlanVariants(
  intent: WorkflowIntent,
  research: ResearchResult,
  count: number = 3,
  signal?: AbortSignal
): Promise<StructuredPlan[]> {
  const model = openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o");
  
  // Generate N variants in parallel
  const variants = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const result = await generateObject({
        model,
        schema: structuredPlanSchema,
        prompt: buildPlanPrompt(intent, research, {
          variantHint: getVariantHint(i), // "optimize for speed" | "optimize for safety" | "balanced"
        }),
        abortSignal: signal,
        temperature: 0.7 + (i * 0.1), // Slightly different temperatures
      });

      return {
        id: crypto.randomUUID(),
        intent: intent.description,
        ...result.object,
        evaluationCriteria: defaultEvaluationCriteria(),
      };
    })
  );

  return variants;
}
```

### Evaluation with Multi-Model Judges

```typescript
// packages/plan/src/evaluate/judge.ts

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { StructuredPlan, PlanEvaluation } from "../types";
import { z } from "zod";

const evaluationSchema = z.object({
  completeness: z.number().min(0).max(1),
  efficiency: z.number().min(0).max(1),
  risk: z.number().min(0).max(1),
  testability: z.number().min(0).max(1),
  reasoning: z.string(),
});

type JudgeConfig = {
  id: string;
  model:
    | ReturnType<typeof openai>
    | ReturnType<typeof anthropic>
    | ReturnType<typeof google>;
  weight: number;
};

const judges: JudgeConfig[] = [
  { id: "claude-sonnet", model: anthropic("claude-sonnet-4-20250514"), weight: 0.4 },
  { id: "gpt-4o", model: openai("gpt-4o"), weight: 0.35 },
  { id: "gemini-pro", model: google("gemini-1.5-pro"), weight: 0.25 },
];

export async function evaluatePlans(
  plans: StructuredPlan[],
  signal?: AbortSignal
): Promise<{ evaluations: PlanEvaluation[]; winner: StructuredPlan }> {
  const evaluations: PlanEvaluation[] = [];

  for (const plan of plans) {
    const scores: PlanEvaluation["scores"] = [];

    // Evaluate with each judge in parallel
    const judgeResults = await Promise.all(
      judges.map(async (judge) => {
        const result = await generateObject({
          model: judge.model,
          schema: evaluationSchema,
          prompt: buildEvaluationPrompt(plan),
          abortSignal: signal,
        });

        return {
          judge: judge.id,
          weight: judge.weight,
          ...result.object,
        };
      })
    );

    for (const result of judgeResults) {
      scores.push({
        judge: result.judge,
        criterion: "completeness",
        score: result.completeness,
        reasoning: result.reasoning,
      });
      scores.push({
        judge: result.judge,
        criterion: "efficiency",
        score: result.efficiency,
        reasoning: result.reasoning,
      });
      scores.push({
        judge: result.judge,
        criterion: "risk",
        score: 1 - result.risk, // Lower risk = higher score
        reasoning: result.reasoning,
      });
    }

    // Weighted aggregate
    const aggregateScore = judgeResults.reduce(
      (acc, r) =>
        acc +
        r.weight *
          ((r.completeness + r.efficiency + (1 - r.risk) + r.testability) / 4),
      0
    );

    evaluations.push({
      planId: plan.id,
      scores,
      aggregateScore,
      selected: false,
    });
  }

  // Select winner
  const sorted = evaluations.sort((a, b) => b.aggregateScore - a.aggregateScore);
  sorted[0].selected = true;

  const winner = plans.find((p) => p.id === sorted[0].planId)!;

  return { evaluations, winner };
}
```

### Streaming Events to UI

```typescript
// packages/plan/src/generate/stream.ts

import { AISDKAdapter } from "@alfred/runtime/adapters/ai";
import type { WorkflowEvent } from "@alfred/type/plan";

export async function* streamPlanGeneration(
  intent: WorkflowIntent,
  callbacks: {
    onResearchStart?: () => void;
    onResearchComplete?: (research: ResearchResult) => void;
    onPlanVariant?: (plan: StructuredPlan, index: number) => void;
    onEvaluationComplete?: (evaluations: PlanEvaluation[]) => void;
  }
): AsyncGenerator<WorkflowEvent, StructuredPlan, void> {
  // Phase 1: Research
  yield { type: "phase-start", phase: "research" };
  callbacks.onResearchStart?.();
  
  const research = await aggregateResearch(intent);
  callbacks.onResearchComplete?.(research);
  yield { type: "phase-complete", phase: "research", data: research };

  // Phase 2: Generate variants
  yield { type: "phase-start", phase: "generate" };
  
  const variants = await generatePlanVariants(intent, research, 3);
  for (let i = 0; i < variants.length; i++) {
    callbacks.onPlanVariant?.(variants[i], i);
    yield { type: "plan-variant", index: i, plan: variants[i] };
  }
  yield { type: "phase-complete", phase: "generate" };

  // Phase 3: Evaluate
  yield { type: "phase-start", phase: "evaluate" };
  
  const { evaluations, winner } = await evaluatePlans(variants);
  callbacks.onEvaluationComplete?.(evaluations);
  yield { type: "phase-complete", phase: "evaluate", data: evaluations };

  // Return winner
  yield { type: "plan-selected", plan: winner };
  return winner;
}
```

---

## Proposal 4: YAML vs JSON for Structured Plans

### Recommendation: **Typed JSON for storage + editing; YAML export only (optional)**

| Format | Use Case | Rationale |
|--------|----------|-----------|
| **YAML** | Optional export format (download/share) | Readable + commentable, but avoid accepting YAML as a primary edit/transport format |
| **JSON** | Database storage, API transport | Type-safe, faster parsing, Zod validation |
| **TypeScript** | Internal representation | Full type safety, IDE support |

### YAML Benefits for Plans

```yaml
# workflow-plan.yaml

title: Dark Mode Toggle Implementation
intent: Add dark mode toggle to settings page

phases:
  - id: phase-1
    name: Design System Extension
    description: Extend design tokens for dark mode
    # Agent specialization: Codex excels at CSS/design work
    agentType: codex
    estimatedDuration: 15m
    
    tasks:
      - id: task-1-1
        title: Add dark color tokens
        requirement: |
          Add dark mode color tokens to the design system.
          Follow existing naming conventions in tailwind.config.js.
        complexity: low
        
      - id: task-1-2
        title: Update Tailwind config
        requirement: Update dark mode configuration
        complexity: low
    
    dependsOn: []  # No dependencies, can start immediately

  - id: phase-2
    name: State Management
    agentType: droid  # Droid has full codebase context
    estimatedDuration: 20m
    dependsOn: [phase-1]  # Explicit dependency
    
    # ... more tasks

resources:
  agentCount: 3
  strategy: topological  # Respect dependencies
  isolation: container   # Docker isolation

evaluationCriteria:
  - name: builds
    weight: 0.3
    threshold: pass
  - name: tests
    weight: 0.3
    threshold: pass
```

### Implementation

```typescript
// packages/plan/src/serialize/yaml.ts

import * as yaml from "yaml";
import type { StructuredPlan } from "../types";
import { structuredPlanSchema } from "./validate";

export function planToYaml(plan: StructuredPlan): string {
  const doc = new yaml.Document(plan);
  
  // Add comments for human readability
  doc.commentBefore = "# AI-Native Workflow Plan\n# Generated by ALFRED";
  
  return doc.toString({
    indent: 2,
    lineWidth: 100,
  });
}

export function yamlToPlan(content: string): StructuredPlan {
  const raw = yaml.parse(content);
  const result = structuredPlanSchema.safeParse(raw);
  
  if (!result.success) {
    throw new Error(`Invalid plan YAML: ${result.error.message}`);
  }
  
  return result.data;
}

// Duration parsing helper
export function parseDuration(s: string): number {
  const match = s.match(/^(\d+)(s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: ${s}`);
  
  const [, num, unit] = match;
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return parseInt(num, 10) * multipliers[unit as keyof typeof multipliers];
}
```

### Decision: JSON-only API; YAML is export/import at the edges

```typescript
// API accepts typed JSON only (StructuredPlan), to keep transport deterministic and avoid YAML edge cases.
// YAML can be generated for export, and imported only via an explicit “import” action that validates and
// shows a diff before saving.
const planInput = structuredPlanSchema;

export async function savePlan(input: z.infer<typeof planInput>) {
  const plan = input;

  // Store as JSON in database
  await db.insert(plans).values({
    id: plan.id,
    data: plan, // JSONB column
  });
}
```

---

## Proposal 5: Agentic Planner/Orchestrator

### Research Agent with Tools

```typescript
// packages/plan/src/research/agent.ts

import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const researchTools = {
  webSearch: tool({
    description: "Search the web for documentation, examples, or best practices",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      maxResults: z.number().default(5),
    }),
    execute: async ({ query, maxResults }) => {
      // Use Exa or similar
      const results = await searchWeb(query, maxResults);
      return results;
    },
  }),
  
  codebaseSearch: tool({
    description: "Search the user's codebase for relevant code patterns",
    inputSchema: z.object({
      query: z.string().describe("Semantic search query"),
      fileTypes: z.array(z.string()).optional(),
    }),
    execute: async ({ query, fileTypes }) => {
      const results = await semanticCodeSearch(query, { fileTypes });
      return results;
    },
  }),
  
  readFile: tool({
    description: "Read a specific file from the codebase",
    inputSchema: z.object({
      path: z.string().describe("File path relative to repo root"),
    }),
    execute: async ({ path }) => {
      const content = await readCodeFile(path);
      return content;
    },
  }),
  
  askClarification: tool({
    description: "Ask the user a clarifying question before proceeding",
    inputSchema: z.object({
      question: z.string().describe("The question to ask"),
      options: z.array(z.string()).optional().describe("Multiple choice options"),
    }),
    execute: async ({ question, options }) => {
      // This pauses the workflow and waits for user response
      return { type: "clarification_needed", question, options };
    },
  }),
  
  findPatterns: tool({
    description: "Find similar workflow patterns from past successes",
    inputSchema: z.object({
      intent: z.string().describe("The user's intent to match"),
      minConfidence: z.number().default(0.7),
    }),
    execute: async ({ intent, minConfidence }) => {
      const patterns = await matchPatterns(intent, minConfidence);
      return patterns;
    },
  }),
};

export async function* runResearchAgent(
  intent: WorkflowIntent,
  signal?: AbortSignal
): AsyncGenerator<WorkflowEvent, ResearchResult, void> {
  const model = openai("gpt-4o");
  
  yield { type: "research-start" };

  const result = await generateText({
    model,
    tools: researchTools,
    maxSteps: 10, // Allow multiple tool calls
    prompt: buildResearchPrompt(intent),
    abortSignal: signal,
    
    // Stop when we have enough context or user needs to respond
    stopWhen: ({ toolResults }) => {
      const clarification = toolResults?.find(
        (r) => r.output?.type === "clarification_needed"
      );
      return !!clarification;
    },
  });

  // Check if clarification is needed
  const clarificationNeeded = result.toolResults?.find(
    (r) => r.output?.type === "clarification_needed"
  );
  
  if (clarificationNeeded) {
    yield {
      type: "clarification-needed",
      question: clarificationNeeded.output.question,
      options: clarificationNeeded.output.options,
    };
    // Workflow suspends here, waiting for user response
    return; // Will be resumed with user's answer
  }

  // Aggregate research results
  const external = aggregateExternalResults(result);
  const internal = aggregateInternalResults(result);
  const patterns = aggregatePatternResults(result);

  yield {
    type: "research-complete",
    data: { external, internal, patterns },
  };

  return { external, internal, patterns };
}
```

### Clarification Flow

```typescript
// packages/api/src/routers/plan.ts

export const planRouter = router({
  generate: authedProcedure
    .input(z.object({
      intent: z.string(),
      clarificationResponse: z.string().optional(), // Resume with answer
    }))
    .mutation(async ({ input, ctx }) => {
      const runId = await workflowRepo.createRun({
        userId: ctx.session.user.id,
        workflowId: "plan-generation",
        status: "running",
        inputData: input,
      });

      // If this is a clarification response, load existing state
      if (input.clarificationResponse) {
        const existingRun = await workflowRepo.getRunById(runId);
        // Resume from suspended state with user's answer
        // ...
      }

      // Start fresh research
      const generator = runResearchAgent(
        { description: input.intent },
        abortController.signal
      );

      for await (const event of generator) {
        if (event.type === "clarification-needed") {
          // Suspend and wait for user
          await workflowRepo.updateRun(runId, {
            status: "suspended",
            stateData: { clarificationPending: event },
          });
          
          return {
            runId,
            status: "suspended",
            clarification: event,
          };
        }
        
        // Stream other events
        await persistEvent(runId, event);
      }
      
      // Continue with plan generation...
    }),
});
```

### Agentic Loop with Self-Correction

```typescript
// packages/plan/src/generate/agent.ts

export async function* agenticPlanLoop(
  intent: WorkflowIntent,
  maxIterations: number = 5
): AsyncGenerator<WorkflowEvent, StructuredPlan, void> {
  let currentPlan: StructuredPlan | null = null;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    yield { type: "iteration-start", iteration };

    // Generate or refine plan
    if (!currentPlan) {
      const research = yield* runResearchAgent(intent);
      const variants = await generatePlanVariants(intent, research);
      const { winner } = await evaluatePlans(variants);
      currentPlan = winner;
    } else {
      // Refine based on feedback
      currentPlan = await refinePlan(currentPlan, feedback);
    }

    yield { type: "plan-draft", plan: currentPlan, iteration };

    // Self-critique
    const critique = await critiquePlan(currentPlan, intent);
    
    if (critique.score > 0.9) {
      yield { type: "plan-accepted", plan: currentPlan };
      return currentPlan;
    }

    // Need refinement
    yield { type: "plan-critique", critique };
    
    // Feed critique back for next iteration
    // (This is the self-improvement loop)
  }

  // Max iterations reached, return best effort
  yield { type: "max-iterations-reached", plan: currentPlan };
  return currentPlan!;
}
```

---

## Proposal 6: Antifragile Architecture (Nassim Taleb)

> **Status:** Deferred (V3+ only).  
> This section is a design appendix, not a delivery plan. Do **not** implement generic circuit breakers, checkpointing, chaos engineering, or “immune systems” until we have production telemetry that proves they’re necessary.

### Core Antifragile Principles Applied

| Taleb Principle | ALFRED Implementation |
|-----------------|----------------------|
| **Optionality** | Multiple execution paths, fallback agents |
| **Barbell Strategy** | Deferred; only after we can quantify “risk” and measure outcomes |
| **Via Negativa** | Remove failure modes, not add features |
| **Skin in the Game** | Agents own their decisions (pattern confidence) |
| **Non-linearity** | Small stresses improve system (pattern learning) |
| **Redundancy** | N+1 agents (bounded), container isolation by default; worktree only in dev builds |

### Self-Healing Architecture

```typescript
// packages/runtime/src/engines/resilience.ts

import type { WorkflowEvent, StructuredPlan, Phase } from "@alfred/plan";

export type RecoveryStrategy =
  | { type: "retry"; maxAttempts: number; backoffMs: number }
  | { type: "fallback"; alternatePhase: Phase }
  | { type: "skip"; reason: string }
  | { type: "escalate"; to: "user" | "review-agent" }
  | { type: "rollback"; checkpoint: string };

export type FailureContext = {
  phase: Phase;
  error: Error;
  attempt: number;
  history: WorkflowEvent[];
  checkpoint?: string;
};

// Antifragile: System learns from failures
export async function determineRecovery(
  ctx: FailureContext
): Promise<RecoveryStrategy> {
  // 1. Check if this failure type has been seen before
  const pastFailures = await queryFailurePatterns(ctx.phase.id, ctx.error);
  
  if (pastFailures.length > 0) {
    // We've seen this before - use learned strategy
    const bestStrategy = pastFailures.sort(
      (a, b) => b.successRate - a.successRate
    )[0];
    return bestStrategy.recoveryStrategy;
  }

  // 2. Apply heuristics based on failure type
  const strategy = classifyFailure(ctx.error);
  
  switch (strategy.type) {
    case "transient":
      // Network, rate limit, temporary unavailable
      return { type: "retry", maxAttempts: 3, backoffMs: 1000 * (2 ** ctx.attempt) };
      
    case "resource":
      // Out of memory, disk full, timeout
      return { type: "fallback", alternatePhase: createLighterPhase(ctx.phase) };
      
    case "code":
      // Compilation error, test failure
      if (ctx.attempt < 2) {
        return { type: "retry", maxAttempts: 2, backoffMs: 0 }; // Agent will self-correct
      }
      return { type: "escalate", to: "review-agent" };
      
    case "conflict":
      // Merge conflict, concurrent modification
      return { type: "rollback", checkpoint: ctx.checkpoint! };
      
    case "unknown":
      return { type: "escalate", to: "user" };
  }
}

// Record recovery outcomes for learning
export async function recordRecoveryOutcome(
  ctx: FailureContext,
  strategy: RecoveryStrategy,
  success: boolean
): Promise<void> {
  await db.insert(failurePatterns).values({
    phaseType: ctx.phase.agentType,
    errorClass: classifyError(ctx.error),
    recoveryStrategy: strategy,
    success,
    timestamp: new Date(),
  });
  
  // Update pattern confidence
  await updatePatternConfidence(ctx.phase.id, success ? 0.1 : -0.2);
}
```

### Circuit Breaker for External Dependencies

```typescript
// packages/runtime/src/engines/circuit.ts

type CircuitState = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private lastFailure: Date | null = null;
  
  constructor(
    private readonly name: string,
    private readonly threshold: number = 5,
    private readonly resetTimeMs: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (this.shouldReset()) {
        this.state = "half-open";
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    
    if (this.failures >= this.threshold) {
      this.state = "open";
      logger.warn("circuit_breaker_opened", { name: this.name, failures: this.failures });
    }
  }

  private shouldReset(): boolean {
    if (!this.lastFailure) return true;
    return Date.now() - this.lastFailure.getTime() > this.resetTimeMs;
  }
}

// Circuit breakers for external services
export const circuits = {
  openai: new CircuitBreaker("openai", 3, 60000),
  anthropic: new CircuitBreaker("anthropic", 3, 60000),
  github: new CircuitBreaker("github", 5, 30000),
  linear: new CircuitBreaker("linear", 5, 30000),
};
```

### Multi-Level Checkpointing

```typescript
// packages/runtime/src/workflow/checkpoint.ts

export type Checkpoint = {
  id: string;
  runId: string;
  phaseId: string;
  state: "pre" | "post";
  data: {
    worktreeRef: string;     // Git commit SHA
    containerState?: string; // Docker checkpoint ID
    fileHashes: Record<string, string>;
  };
  created: Date;
};

export async function createCheckpoint(
  runId: string,
  phase: Phase,
  state: "pre" | "post"
): Promise<Checkpoint> {
  const checkpoint: Checkpoint = {
    id: crypto.randomUUID(),
    runId,
    phaseId: phase.id,
    state,
    data: {
      worktreeRef: await getWorktreeHead(phase.id),
      containerState: await dockerCheckpoint(runId, phase.id),
      fileHashes: await hashModifiedFiles(phase.id),
    },
    created: new Date(),
  };

  await db.insert(checkpoints).values(checkpoint);
  
  return checkpoint;
}

export async function rollbackToCheckpoint(checkpoint: Checkpoint): Promise<void> {
  logger.info("rollback_checkpoint", { checkpointId: checkpoint.id });
  
  // 1. Restore worktree state
  await gitReset(checkpoint.data.worktreeRef);
  
  // 2. Restore container state (if exists)
  if (checkpoint.data.containerState) {
    await dockerRestore(checkpoint.data.containerState);
  }
  
  // 3. Verify file integrity
  const currentHashes = await hashModifiedFiles(checkpoint.phaseId);
  for (const [file, hash] of Object.entries(checkpoint.data.fileHashes)) {
    if (currentHashes[file] !== hash) {
      await restoreFile(file, checkpoint.data.worktreeRef);
    }
  }
}
```

### Chaos Engineering Integration

```typescript
// packages/runtime/src/engines/chaos.ts

// Only enabled in development/testing
const CHAOS_ENABLED = process.env.ALFRED_CHAOS_MODE === "true";

type ChaosConfig = {
  failureRate: number;      // 0.0 - 1.0
  latencyMs: number;        // Add artificial latency
  targetPhases: string[];   // Which phases to target
};

export function withChaos<T>(
  fn: () => Promise<T>,
  phaseId: string
): () => Promise<T> {
  if (!CHAOS_ENABLED) return fn;

  return async () => {
    const config = getChaosConfig();
    
    // Should we inject chaos?
    if (config.targetPhases.includes(phaseId)) {
      // Random failure
      if (Math.random() < config.failureRate) {
        throw new ChaosInjectedError(`Chaos failure in ${phaseId}`);
      }
      
      // Artificial latency
      if (config.latencyMs > 0) {
        await delay(config.latencyMs);
      }
    }
    
    return fn();
  };
}

// Stress testing: Generate random workflow failures
export async function runChaosTest(plan: StructuredPlan): Promise<ChaosReport> {
  const results: ChaosTestResult[] = [];
  
  for (let i = 0; i < 100; i++) {
    const chaos = randomChaosConfig();
    try {
      await executeWithChaos(plan, chaos);
      results.push({ chaos, success: true, recoverySteps: [] });
    } catch (error) {
      const recovered = await attemptRecovery(error);
      results.push({
        chaos,
        success: recovered,
        recoverySteps: getRecoveryLog(),
        error: error.message,
      });
    }
  }
  
  return analyzeChaosResults(results);
}
```

### Barbell Strategy: Conservative + Aggressive

```typescript
// packages/plan/src/generate/barbell.ts

/**
 * Barbell Strategy for Plan Generation:
 * - 80% conservative: Use proven patterns, well-tested agents
 * - 20% aggressive: Try new approaches, experimental agents
 */
export async function barbellPlanGeneration(
  intent: WorkflowIntent,
  research: ResearchResult
): Promise<{ conservative: StructuredPlan; aggressive: StructuredPlan }> {
  // Conservative: Use highest-confidence patterns
  const conservative = await generateConservativePlan(intent, research, {
    patternMinConfidence: 0.9,
    agentTypes: ["codex"],  // Proven reliable
    isolation: "container", // Maximum safety
    strategy: "sequential", // No parallel risk
  });

  // Aggressive: Experiment with new approaches
  const aggressive = await generateAggressivePlan(intent, research, {
    patternMinConfidence: 0.5,  // Try newer patterns
    agentTypes: ["droid", "claude-code"],  // Different capabilities
    isolation: "worktree",  // Faster, less isolation
    strategy: "parallel",   // Maximize speed
  });

  return { conservative, aggressive };
}

// In production: Use conservative by default, aggressive for low-risk tasks
export function selectStrategy(
  intent: WorkflowIntent,
  autonomy: number
): "conservative" | "aggressive" {
  if (autonomy >= 0.9 && intent.riskLevel === "low") {
    return "aggressive";
  }
  return "conservative";
}
```

### Immune System: Pattern Decay and Healing

```typescript
// packages/plan/src/pattern/immune.ts

/**
 * Immune System: Patterns that consistently fail are "quarantined"
 * Patterns that consistently succeed are "amplified"
 */
export async function immuneSystemTick(): Promise<void> {
  const patterns = await getAllPatterns();
  
  for (const pattern of patterns) {
    const recentOutcomes = await getRecentOutcomes(pattern.id, { days: 30 });
    
    const successRate = recentOutcomes.filter(o => o.success).length / recentOutcomes.length;
    
    if (successRate < 0.3) {
      // Quarantine: Don't use in production, but keep for analysis
      await updatePattern(pattern.id, { status: "quarantined" });
      logger.warn("pattern_quarantined", { patternId: pattern.id, successRate });
    } else if (successRate > 0.9 && recentOutcomes.length >= 10) {
      // Amplify: Increase confidence, prioritize in matching
      await updatePattern(pattern.id, { 
        confidence: Math.min(1.0, pattern.confidence + 0.1),
        status: "trusted",
      });
    } else {
      // Decay unused patterns
      const daysSinceUse = (Date.now() - pattern.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUse > 30) {
        await updatePattern(pattern.id, {
          confidence: Math.max(0.1, pattern.confidence - 0.1),
        });
      }
    }
  }
}

// Run as background job
export function startImmuneSystem() {
  setInterval(immuneSystemTick, 1000 * 60 * 60); // Every hour
}
```

---

## Proposal 7: Project Container Architecture

### The Problem: Missing Grouping Abstraction

ALFRED currently tracks workflows as isolated executions. This creates several issues:

| Gap | Impact | Example |
|-----|--------|---------|
| **Context silos** | Research repeats for every workflow | Same conventions rediscovered each run |
| **Pattern pollution** | Patterns from Project A match Project B | "Add dark mode" pattern from ALFRED misapplied to client project |
| **Deployment orphans** | No traceability deployment → workflow → project | Can't see which workflows deployed which apps |
| **Linear mismatch** | Linear has Projects; ALFRED maps only to issues | No bi-directional project navigation |
| **Multi-workspace** | Single user, multiple codebases, no isolation | Patterns bleed across unrelated repos |

### Existing State Analysis

**What exists:**
- `ProjectConfig` in `packages/runtime/src/orchestrator/types.ts` — **technical only** (test commands, build commands)
- `workflow_runs.linearIssueId` — links to issues, not projects
- `memory_nodes.resource` — thread-level scoping, not project-level
- `deployments` — no project FK

**What's missing:**
- Container entity grouping related workflows
- Project-scoped pattern storage
- Linear Project integration
- Accumulated project conventions

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Project Container                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Project (new entity)                                                       │
│  ├── id, name, slug, userId                                                 │
│  ├── workspace: string           // Filesystem path                         │
│  ├── linearProjectId: string     // Link to Linear Project                  │
│  ├── linearTeamId: string        // Default team for issues                 │
│  ├── config: ProjectConfig       // Elevated from runtime-only              │
│  ├── conventions: Conventions[]  // Learned architectural rules             │
│  │                                                                          │
│  │   Relationships:                                                         │
│  ├──▶ WorkflowRuns[]             // FK: project_id                          │
│  ├──▶ WorkflowPatterns[]         // FK: project_id (scoped patterns)        │
│  ├──▶ Deployments[]              // FK: project_id                          │
│  └──▶ MemoryNodes[]              // resource: "project:{id}"                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Schema Design

```typescript
// NEW: packages/db/src/schema/project.ts

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Projects (container for related workflows, patterns, deployments)
 */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // URL-safe identifier
  workspace: text("workspace").notNull(), // Filesystem path (unique per user)
  
  // Linear integration
  linearProjectId: text("linear_project_id"), // Linear Project UUID
  linearTeamId: text("linear_team_id"), // Default team for issue creation
  
  // Elevated ProjectConfig (was runtime-only)
  config: jsonb("config"), // { type, testCommand, buildCommand, ... }
  
  // Learned conventions (accumulated over time)
  conventions: jsonb("conventions"), // [{ rule, confidence, source }]
  
  // Metadata
  created: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

// Types
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Convention = {
  rule: string;        // "Use Zustand for UI state"
  confidence: number;  // 0.0 - 1.0
  source: "explicit" | "inferred" | "review"; // How was it learned
  examples: string[];  // Workflow IDs where this was applied
};
```

### Migration

```sql
-- Migration 0XXX_projects.sql

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  workspace TEXT NOT NULL,
  linear_project_id TEXT,
  linear_team_id TEXT,
  config JSONB,
  conventions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Unique workspace per user
CREATE UNIQUE INDEX projects_user_workspace_idx 
  ON projects (user_id, workspace);

-- Slug lookup
CREATE INDEX projects_user_slug_idx 
  ON projects (user_id, slug);

-- Linear project lookup
CREATE INDEX projects_linear_project_idx 
  ON projects (linear_project_id) 
  WHERE linear_project_id IS NOT NULL;

-- Add FK to workflow_runs
ALTER TABLE workflow_runs 
  ADD COLUMN project_id UUID REFERENCES projects(id);

CREATE INDEX workflow_runs_project_idx 
  ON workflow_runs (project_id) 
  WHERE project_id IS NOT NULL;

-- Add FK to deployments
ALTER TABLE deployments 
  ADD COLUMN project_id UUID REFERENCES projects(id);

CREATE INDEX deployments_project_idx 
  ON deployments (project_id) 
  WHERE project_id IS NOT NULL;
```

### Auto-Detection Strategy

Projects are **implicitly created** from workspace path to minimize friction:

```typescript
// packages/plan/src/project/resolve.ts

import * as path from "node:path";
import { slugify } from "@alfred/util";
import * as projectRepo from "@alfred/db/repo/project";

export type ProjectResolution = {
  project: Project;
  created: boolean;
};

/**
 * Resolve or create project from workspace path.
 * Zero-config: projects are auto-created on first workflow.
 */
export async function resolveProject(
  userId: string,
  workspace: string,
  linearHint?: { projectId?: string; teamId?: string }
): Promise<ProjectResolution> {
  // 1. Normalize workspace path
  const normalizedWorkspace = path.resolve(workspace);
  
  // 2. Check if workspace already mapped to a project
  const existing = await projectRepo.findByWorkspace(userId, normalizedWorkspace);
  if (existing) {
    // Update Linear link if provided and not set
    if (linearHint?.projectId && !existing.linearProjectId) {
      await projectRepo.update(existing.id, {
        linearProjectId: linearHint.projectId,
        linearTeamId: linearHint.teamId,
      });
    }
    return { project: existing, created: false };
  }
  
  // 3. Auto-detect project config
  const config = await detectProjectConfig(normalizedWorkspace);
  
  // 4. Create implicit project
  const name = path.basename(normalizedWorkspace);
  const project = await projectRepo.create({
    userId,
    name,
    slug: slugify(name),
    workspace: normalizedWorkspace,
    linearProjectId: linearHint?.projectId,
    linearTeamId: linearHint?.teamId,
    config,
    conventions: [],
  });
  
  return { project, created: true };
}

/**
 * Detect ProjectConfig from workspace filesystem.
 */
async function detectProjectConfig(workspace: string): Promise<ProjectConfig> {
  // Reuse existing detection logic
  const { detectProject } = await import("@alfred/agent/utils/project-detector");
  return detectProject(workspace);
}
```

### Integration Points

**1. RuntimeInput Extension**

```typescript
// packages/runtime/src/types.ts

export type RuntimeInput = {
  requirement: string;
  auto: "read" | "low" | "medium" | "high";
  workspace?: string;
  projectId?: string;  // NEW: Explicit project (or auto-resolved from workspace)
  // ... existing fields
};
```

**2. Pattern Matching (Project-Scoped)**

```typescript
// packages/plan/src/pattern/match.ts

export async function matchPatterns(
  intent: string,
  projectId: string,
  minSimilarity: number = 0.7
): Promise<WorkflowPattern[]> {
  // 1. First, search project-specific patterns
  const projectPatterns = await patternRepo.findByProject(projectId, {
    minConfidence: 0.5,
    status: ["trusted", "active"],
  });
  
  // 2. Semantic match within project patterns
  const projectMatches = await semanticMatch(intent, projectPatterns, minSimilarity);
  
  // 3. If insufficient matches, search global patterns (lower weight)
  if (projectMatches.length < 2) {
    const globalPatterns = await patternRepo.findGlobal({
      excludeProjectId: projectId,
      minConfidence: 0.8, // Higher bar for cross-project
    });
    const globalMatches = await semanticMatch(intent, globalPatterns, minSimilarity + 0.1);
    
    // Weight project matches higher
    return [
      ...projectMatches,
      ...globalMatches.map(p => ({ ...p, confidence: p.confidence * 0.8 })),
    ].sort((a, b) => b.confidence - a.confidence);
  }
  
  return projectMatches;
}
```

**3. Research Phase (Convention Injection)**

```typescript
// packages/plan/src/research/internal.ts

export async function internalResearch(
  intent: string,
  projectId: string
): Promise<InternalResearchResult> {
  const project = await projectRepo.getById(projectId);
  
  // Inject project conventions into research context
  const conventions = (project.conventions as Convention[]) ?? [];
  const highConfidenceConventions = conventions.filter(c => c.confidence > 0.7);
  
  return {
    codebaseContext: await scanCodebase(project.workspace, intent),
    patterns: await matchPatterns(intent, projectId),
    conventions: highConfidenceConventions, // NEW
    projectConfig: project.config,
  };
}
```

**4. Convention Learning (Post-Success)**

```typescript
// packages/plan/src/pattern/conventions.ts

export async function learnConventions(
  projectId: string,
  workflowRun: WorkflowRun,
  reviewFeedback?: ReviewFeedback
): Promise<void> {
  const project = await projectRepo.getById(projectId);
  const conventions = (project.conventions as Convention[]) ?? [];
  
  // Extract potential conventions from successful workflow
  const newConventions = await extractConventions(workflowRun);
  
  for (const candidate of newConventions) {
    const existing = conventions.find(c => c.rule === candidate.rule);
    
    if (existing) {
      // Reinforce existing convention
      existing.confidence = Math.min(1.0, existing.confidence + 0.1);
      existing.examples.push(workflowRun.id);
    } else if (candidate.confidence > 0.5) {
      // Add new convention (needs confirmation)
      conventions.push({
        ...candidate,
        source: "inferred",
        examples: [workflowRun.id],
      });
    }
  }
  
  await projectRepo.update(projectId, { conventions });
}
```

### Linear Project Integration

```typescript
// packages/plan/src/project/linear.ts

import { linearClient } from "@alfred/agent/orchestrator/linear";

/**
 * Sync ALFRED Project with Linear Project.
 */
export async function syncLinearProject(
  projectId: string,
  authz: string
): Promise<void> {
  const project = await projectRepo.getById(projectId);
  if (!project.linearProjectId) return;
  
  const client = linearClient(authz);
  const linearProject = await client.project(project.linearProjectId);
  
  // Update ALFRED project with Linear metadata
  await projectRepo.update(projectId, {
    name: linearProject.name, // Keep in sync
    linearTeamId: linearProject.teamIds[0], // Default team
  });
}

/**
 * Create workflow as Linear issue under project.
 */
export async function createLinearIssueForWorkflow(
  projectId: string,
  intent: string,
  authz: string
): Promise<{ issueId: string; issueUrl: string }> {
  const project = await projectRepo.getById(projectId);
  
  if (!project.linearProjectId || !project.linearTeamId) {
    throw new Error("Project not linked to Linear");
  }
  
  const client = linearClient(authz);
  const issue = await client.createIssue({
    title: deriveIssueTitle(intent),
    teamId: project.linearTeamId,
    projectId: project.linearProjectId,
  });
  
  return { issueId: issue.id, issueUrl: issue.url };
}
```

### UI Integration

**Desktop Window: Project Selector**

```typescript
// apps/web/src/components/windows/project/selector.tsx

export function ProjectSelector({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: projects } = trpc.project.list.useQuery();
  const [selected, setSelected] = useBuilderStore((s) => s.projectId);
  
  return (
    <Select value={selected} onValueChange={(id) => {
      setSelected(id);
      onSelect(id);
    }}>
      <SelectTrigger>
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {projects?.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              {p.name}
              {p.linearProjectId && <LinearIcon className="h-3 w-3 text-muted" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Decision: Implicit vs Explicit Projects

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Implicit (auto-detect)** | Zero config, seamless UX | Less control over naming/boundaries | ✅ **Default for v1** |
| **Explicit (user creates)** | Full control, clear boundaries | Onboarding friction, extra step | Add in v2 as optional |
| **Hybrid** | Best of both | Complexity | Future consideration |

**Chosen approach:** Implicit project creation from workspace path with optional Linear linking.

### New Linear Tickets

| ID | Ticket | Title | Phase | Type | Description |
|----|--------|-------|-------|------|-------------|
| P1-6 | [ALF-281](https://linear.app/alfred-ops/issue/ALF-281) | Project entity & auto-detection | 1 | Story | Create `projects` table, auto-detect from workspace, basic CRUD |
| P1-7 | [ALF-282](https://linear.app/alfred-ops/issue/ALF-282) | Project-Linear sync | 1 | Story | Link ALFRED Project to Linear Project, sync metadata |
| P4-5 | [ALF-295](https://linear.app/alfred-ops/issue/ALF-295) | Project-scoped pattern matching | 4 | Story | Filter patterns by project_id before semantic matching |
| P4-6 | [ALF-296](https://linear.app/alfred-ops/issue/ALF-296) | Convention learning | 4 | Story | Extract and store project conventions from successful workflows |

### Success Metrics

| Metric | Target |
|--------|--------|
| Pattern match accuracy (within project) | >90% |
| Pattern match accuracy (cross-project) | <50% (correctly rejected) |
| Project auto-detection success | >95% |
| Convention confidence after 10 workflows | >0.7 average |

---

## Decision Log

| Date | Decision | Rationale | Made By |
|------|----------|-----------|---------|
| 2025-12-23 | Extend runtime, don't rebuild | ALFRED has 80% of infrastructure | Architecture |
| 2025-12-23 | Phase wraps SubTasks | Maps to PRD sections cleanly | Architecture |
| 2025-12-23 | Hybrid pattern storage | SQL for speed, graph for semantics | Architecture |
| 2025-12-23 | Verification-first evaluation | Deterministic checks beat judge “opinions” | Architecture |
| 2025-12-23 | Plan variants are optional | Only when complexity warrants; bounded budgets | Architecture |
| 2025-12-23 | Docker default, worktree optional | Production safety | Architecture |
| 2025-12-23 | Separate `@alfred/plan` package | Isolates planning from runtime, clean boundaries | Architecture |
| 2025-12-23 | JSON-only API; YAML export optional | Deterministic transport + safe import/export | Architecture |
| 2025-12-23 | Multi-model judges deferred | High cost/complexity; revisit with telemetry | Architecture |
| 2025-12-23 | Research agent with clarification tool | AI asks questions vs user predicts needs | Architecture |
| 2025-12-23 | Circuit breakers deferred | Avoid premature platform work; add when incidents justify | Architecture |
| 2025-12-23 | Checkpointing deferred | Large surface area; prefer event log + reruns first | Architecture |
| 2025-12-23 | Barbell strategy deferred | Only after we can measure risk reliably | Architecture |
| 2025-12-23 | Simple pattern decay/quarantine | Avoid “immune system” complexity in V1 | Architecture |
| 2025-12-23 | Use existing web collections + query patterns | Prefer `apps/web/src/collections/*` (`@tanstack/react-db`) + TanStack Query over new state/data layers | Architecture |
| 2025-12-23 | Implicit Project containers | Auto-detect from workspace path; zero-config UX | Architecture |
| 2025-12-23 | Project-scoped patterns | Filter patterns by project_id first; prevent cross-project pollution | Architecture |
| 2025-12-23 | Convention learning | Accumulate project-specific rules from successful workflows | Architecture |
| 2025-12-23 | Linear Project integration | Link ALFRED Projects to Linear Projects for bi-directional navigation | Architecture |
| 2025-01-27 | Resource reference pattern | Use `planId` as direct field; plans are persisted resources but conceptually part of workflow runs | Architecture |
| 2025-01-27 | Subscription protocol | Use WebSocket streaming for real-time execution events; single connection with multiplexed streams | Architecture |
| 2025-01-27 | Canvas as subview | Canvas is a subview within workflow window, not a separate window type; state in `WindowData.draft` | Architecture |
| 2025-01-27 | Orchestrator UI patterns | Integrate StreamingTerminal, ProgressWindow, WorkflowTimeline, ErrorPanel components | Architecture |

---

## Outcomes & Retrospective

> To be completed post-implementation.

### Outcomes

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| New code lines | ~650 | | ⬜ |
| Intent → Plan latency | < 30s | | ⬜ |
| Pattern reuse rate | > 30% | | ⬜ |
| User approval rate | > 90% | | ⬜ |

### Retrospective

**What went well:**
- (To be filled)

**What could be improved:**
- (To be filled)

**Lessons learned:**
- (To be filled)

---

## Appendix: Codebase Analysis & 47-Question Deep Dive

> **Analysis Date:** 2025-12-23  
> **Methodology:** Comprehensive codebase search across `packages/runtime`, `packages/agent`, `packages/cognitive`, `packages/knowledge`, `packages/policy`, `packages/db`

---

### I. Foundational Assumptions

#### Q1: The Orchestration Inversion Thesis

**Codebase Evidence:**
- `packages/runtime/src/orchestrator/index.ts` shows existing 5-phase pipeline: Waves → Merge → Conflict → Analysis → Review
- `packages/cognitive/src/autonomy/constraint.ts` implements approval gating based on autonomy level
- Policy enforcement requires biometric for `medium`/`high` autonomy (`config/policy.yaml` lines 28-59)

**Current State:** ALFRED already implements a **hybrid model** where:
- AI orchestrates execution (decomposeTask, planWaves, runAgent)
- Humans approve at autonomy-based gates
- Policy obligations pause workflows for biometric/confirmation

**Answer:** The dichotomy IS a false binary. ALFRED's existing architecture supports **interleaved human checkpoints** based on:
1. Autonomy level (cognitive constraint checks)
2. Risk assessment (gateExecution in `logic/autonomy.ts`)
3. Policy obligations (biometric, confirmation)

**Gap:** The visual canvas for **mid-execution approval** doesn't exist yet.

---

#### Q2: Sequential vs Interleaved Pipeline

**Codebase Evidence:**
- `packages/runtime/src/orchestrator/waves.ts` line 162-170 shows wave-by-wave sequential execution
- `packages/runtime/src/orchestrator/review.ts` has self-correction loop (MAX_FIX_ATTEMPTS)
- No "re-plan" capability exists once waves begin

**Current State:** Pipeline is **strictly sequential** post-approval. Waves execute in topological order; no feedback loop to planning phase.

**Answer:** The assumption of sequential pipeline is **correct but limiting**. Current architecture lacks:
1. Mid-execution plan mutation
2. Discovery-driven replanning
3. Partial execution feedback to planner

**Recommendation:** Add escalation path from wave execution back to Plan phase (exists partially via `escalationContext` but underutilized).

---

#### Q3: Best-of-N Evaluation Epistemology

**Codebase Evidence:**
- NO multi-model judges exist in current codebase (grep for "judge" returns 0 workflow-related results)
- `packages/knowledge/src/reasoning/decisions.ts` uses single embedding model for similarity

**Current State:** Best-of-N does NOT exist. Plans are generated once and executed.

**Answer:** The concern about correlated error is valid. However, the proposed multi-model approach (Claude + GPT-4 + Gemini) provides **implementation diversity** rather than just opinion diversity:
- Different training data cutoffs
- Different RLHF processes
- Different failure modes

**Mitigation:** Add evaluation criteria that measure **structural properties** (dependency graph validity, parallelization opportunities) rather than just semantic quality. These are verifiable without model judgment.

---

### II. Intent Understanding

#### Q4: Clarification Budget

**Codebase Evidence:**
- **NO `askClarification` tool exists** (grep returns 0 matches)
- Intent flows directly from `requirement` string to `decomposeTask()`
- `packages/agent/src/preference/prompt.ts` adapts responses but doesn't ask questions

**Current State:** ALFRED **never asks clarifying questions**. The system infers everything.

**Answer:** This is a **critical gap**. The proposed clarification tool is NEW work. Recommended:
1. **Budget formula:** `clarifications = ceil(log2(ambiguity_score * 10))` where ambiguity_score from 0-1
2. **Max 3 questions** per intent
3. **Auto-resolve after timeout** with documented assumptions

---

#### Q5: Implicit vs Explicit Intent

**Codebase Evidence:**
- `packages/agent/src/orchestrator/multi/decompose.ts` lines 233-264 inject implicit requirements:
  - "Server builds and runs"
  - "Endpoints updated and tests passing"
  - "UI builds and renders"
- These are hardcoded acceptance criteria per bucket type

**Current State:** Implicit requirements ARE injected during decomposition, but they're **generic, not project-specific**.

**Answer:** Implicit requirements should be:
1. **Research outputs** for project-specific constraints (design system, accessibility)
2. **Injected defaults** for universal requirements (builds, tests pass)

**Gap:** No mechanism to learn project-specific implicit requirements from past successes.

---

#### Q6: Multi-Intent Decomposition

**Codebase Evidence:**
- `decomposeTask()` takes single `requirement` string
- No intent boundary detection

**Current State:** Multi-intent is NOT handled. "Add dark mode and fix login bug" would become ONE workflow.

**Answer:** Need explicit **intent segmentation**:
1. Use NLP to detect conjunctions ("and", "also", "plus")
2. Semantic similarity clustering of extracted actions
3. Split into separate workflows if similarity < 0.7

---

#### Q7: Intent Evolution

**Codebase Evidence:**
- `workflow_runs` table has `stateData` JSONB but no intent history
- No version tracking for requirement changes

**Current State:** Intent is **immutable** once workflow starts.

**Answer:** Need:
1. Intent diff threshold (word-level edit distance)
2. If diff > 30%: New workflow
3. If diff ≤ 30%: Plan iteration (add phases, not restart)

---

### III. Research Phase

#### Q8: Research Quality vs Speed

**Codebase Evidence:**
- `packages/agent/src/orchestrator/flow/context.ts` line 441: `topK ?? 4` (max 5 web results)
- Cache TTL: `CONTEXT_CACHE_TTL_MS` (60 seconds inferred from pattern)
- No explicit research budget or quality metric

**Current State:** Research is **fast and shallow**—4-5 web results, top-K code files by semantic similarity.

**Answer:** The 10-second budget is **achievable but insufficient** for complex features. Need:
1. Complexity scoring: Simple (<100 LOC) = 5s, Medium (100-500 LOC) = 15s, Complex (>500 LOC) = 30s
2. Quality metric: % of relevant files found (measure via human feedback)

---

#### Q9: Codebase Understanding Limits

**Codebase Evidence:**
- `packages/agent/src/orchestrator/reasoning/decompose-semantic.ts` builds dependency graph via import analysis
- Directory-based clustering (`packages/*`, `apps/*`)
- NO architectural constraints detection

**Current State:** ALFRED understands:
- ✅ Import dependencies (line 11-85)
- ✅ Directory structure
- ❌ Team conventions (no mechanism)
- ❌ Architectural constraints (no explicit modeling)

**Answer:** Tacit knowledge capture requires:
1. `.alfred/conventions.yaml` file for project-specific rules
2. Learning from review feedback ("We don't use Redux" → constraint)

---

#### Q10: External Research Reliability

**Codebase Evidence:**
- `packages/agent/src/orchestrator/tool/web.ts` lines 445-463 show provider fallback: Exa → DDG
- No source scoring or date filtering
- `livecrawl: "fallback"` attempts fresh content

**Current State:** Source reliability is NOT modeled. All results treated equally.

**Answer:** Need:
1. Source type classification: Official docs (1.0), GitHub (0.9), Blog (0.7), Forum (0.5)
2. Date decay: `score *= 0.95^(months_old)`
3. Framework version matching: Extract version from codebase, filter results

---

#### Q11: Pattern Matching Semantic Similarity

**Codebase Evidence:**
- `packages/knowledge/src/reasoning/decisions.ts` line 12: `MIN_SIMILARITY = 0.32` for decision extraction
- `packages/cognitive/src/loop.ts` line 28: `similarityThreshold: 0.92` for loop detection

**Current State:** Similarity thresholds vary by use case. NO pattern matching for workflows exists.

**Answer:** For workflow patterns:
1. **0.85+ similarity:** Auto-suggest pattern with explanation
2. **0.70-0.85:** Show pattern as option, require user confirmation
3. **<0.70:** Don't match

**Critical:** Semantic near-misses are dangerous. Add **structural validation**:
- Pattern expects 3 phases, intent implies 5 → Don't match
- Pattern touches `auth/`, intent mentions `settings/` → Reduce score by 0.2

---

### IV. Planning Phase

#### Q12: Phase Granularity Calibration

**Codebase Evidence:**
- `packages/agent/src/orchestrator/multi/decompose.ts` uses:
  - Bucket heuristics: backend/frontend/test/misc (lines 211-264)
  - Semantic clustering: packages/apps as clusters (line 94-128)
- NO explicit granularity parameter

**Current State:** Granularity is determined by:
1. Number of affected directories
2. Import graph complexity
3. Hardcoded bucket categories

**Answer:** Granularity should be configurable:
- `minPhaseLOC`: Minimum lines of code per phase (default: 50)
- `maxPhases`: Maximum phases (default: 8)
- `parallelizationTarget`: Desired parallelization factor (default: 3)

---

#### Q13: Dependency Graph Correctness

**Codebase Evidence:**
- `packages/agent/src/orchestrator/reasoning/decompose-semantic.ts` `analyzeDependencyGraph()` extracts actual imports
- `packages/agent/src/orchestrator/multi/decompose.ts` lines 133-163 `validateAndFixDependencies()` removes cycles

**Current State:** Dependencies are inferred from **actual import statements**, not lexical guessing.

**Answer:** The implementation is sound. However, add:
1. Type-level dependencies (shared types across packages)
2. Runtime dependencies (API calls between services)
3. Build-time dependencies (shared configs)

---

#### Q14: Duration Estimation

**Codebase Evidence:**
- NO duration estimation code exists (grep for `estimatedDuration` returns 0 in runtime/agent)
- `packages/runtime/src/metrics.ts` records actual duration only

**Current State:** Duration is **not estimated**. Only tracked post-execution.

**Answer:** Estimation needs:
1. Historical data: `AVG(duration) WHERE similar_intent AND success`
2. Complexity heuristics: LOC × 0.5 minutes + dependencies × 2 minutes
3. Agent-specific multipliers: Codex = 1.0x, Droid = 1.5x (deeper analysis)

---

#### Q15: Agent Type Selection

**Codebase Evidence:**
- `packages/agent/src/orchestrator/multi/spawn.ts` `determineEnvironment()` always returns `"container"`
- `packages/agent/src/orchestrator/multi/decompose.ts` does NOT set `agentType`—uses single agent

**Current State:** Agent type is **NOT selected per phase**. All tasks use Codex.

**Answer:** Selection criteria should be:
| Factor | Codex | Droid | Claude-Code |
|--------|-------|-------|-------------|
| Single file | ✅ | | |
| Cross-package | | ✅ | |
| Complex reasoning | | | ✅ |
| Tests only | ✅ | | |

---

#### Q16: Best-of-N Cost Explosion

**Codebase Evidence:**
- NO cost tracking per workflow exists
- `packages/agent/src/orchestrator/tool/web.ts` tracks `CostInfo` for Exa searches only

**Current State:** Cost is NOT aggregated or limited.

**Answer:** Auto-scale evaluation:
- Simple (1 phase, <100 LOC): 1 plan, 0 judges
- Medium (2-4 phases): 2 plans, 1 judge
- Complex (5+ phases): 3 plans, 3 judges

**Cost estimate (corrected):**
- Intent parsing: $0.01 (1K tokens)
- Research: $0.05 (5 web searches)
- Plan generation: $0.10 × N variants
- Evaluation: $0.03 × N plans × M judges

**For 3 plans × 3 judges:** ~$0.42 (achievable under $0.50 target)

---

### V. Execution Phase

#### Q17: Worktree Merge Conflicts

**Codebase Evidence:**
- `packages/runtime/src/orchestrator/merge.ts` lines 210-238 scans for conflict markers
- `packages/runtime/src/orchestrator/conflict.ts` spawns conflict resolution agent
- NO semantic conflict detection

**Current State:** Only **git merge conflicts** are detected. Semantic conflicts pass through.

**Answer:** Need:
1. AST-level diff comparison (same function modified differently)
2. Type compatibility checks (exported interface changed)
3. Visual conflict UI for non-git conflicts

---

#### Q18: Agent Output Verification

**Codebase Evidence:**
- `packages/runtime/src/orchestrator/review.ts` runs tests in review phase (line 261)
- NO immediate verification after agent execution

**Current State:** Verification is **deferred to review phase**.

**Answer:** Minimum viable verification per agent:
1. **Syntax check:** File parses without error
2. **Type check:** `tsc --noEmit` on modified files
3. **Import resolution:** All imports resolve

---

#### Q19: Partial Execution Recovery

**Codebase Evidence:**
- `packages/runtime/src/loops/resume.ts` lines 42-53 show Dead Letter Queue with max 3 retries
- `packages/runtime/src/orchestrator/agent.ts` line 280-289 restores workspace on interrupt

**Current State:**
- Wave failures mark wave as "failed" but don't rollback previous waves
- Agent failures restore to `"pre-agent"` checkpoint

**Answer:** Current behavior:
1. Wave 2 fails → Wave 1 changes preserved
2. Wave 3 in-progress → Interrupted, changes rolled back
3. Retry from Wave 2 with fresh workspace

---

#### Q20: Cross-Phase Context Loss

**Codebase Evidence:**
- `packages/runtime/src/orchestrator/waves.ts` lines 74-97 builds context ONCE per workflow
- Each agent receives same `context.bundle`
- Agent outputs NOT propagated to subsequent agents

**Current State:** **Context is NOT propagated between agents.** Each sees original codebase state.

**Answer:** This is a **critical gap**. Options:
1. **File-based:** Write outputs to workspace, subsequent agents see via codebase scan
2. **Explicit handoff:** Pass `previousAgentOutputs[]` to next agent prompt
3. **Re-scan:** Rebuild context bundle after each wave (expensive)

Current implementation uses option 1 implicitly (workspace persists).

---

#### Q21: Docker Container Cold Start

**Codebase Evidence:**
- `packages/agent/src/environment/container.ts` lines 77-163 show container creation
- Checks for existing container by name (line 79-109)
- NO warm pool implementation

**Current State:**
- Container reuse: YES (same runId reuses container)
- Warm pool: NO
- Estimated cold start: **5-15 seconds** (Docker image pull + container create)

**Answer:** Need warm pool:
1. Pre-create 3 containers at startup
2. Assign from pool, replenish async
3. Idle timeout: 10 minutes

---

### VI. Learning Phase

#### Q22: Pattern Abstraction Level

**Codebase Evidence:**
- **WorkflowPattern type does NOT exist** (grep returns 0)
- `packages/knowledge/src/extract/patterns.ts` exists but for text patterns, not workflows

**Current State:** Workflow pattern learning is **completely unimplemented**.

**Answer:** Pattern trigger abstraction strategy:
1. Extract **action verbs** from intent: "add", "fix", "refactor", "remove"
2. Extract **domain** from file paths: "ui", "api", "auth", "db"
3. Pattern key: `{verb}-{domain}` (e.g., `add-ui`, `fix-auth`)

---

#### Q23: Pattern Overfitting

**Answer:** Distinguish via **structural match score**:
1. Intent structure: number of actions, domains touched
2. Pattern structure: phases, dependencies
3. If intent structure diverges > 30%: Don't match, even if semantic similarity high

---

#### Q24: Negative Pattern Learning

**Codebase Evidence:**
- `packages/agent/src/orchestrator/learning-worker.ts` `processFailedRuns()` extracts facts from failures
- Facts stored in knowledge graph, but NOT as "anti-patterns"

**Current State:** Failures are learned as facts, not anti-patterns.

**Answer:** Explicit anti-pattern storage needed:
```typescript
type AntiPattern = {
  trigger: string;
  failedStructure: ExecutionGraph;
  failureReason: string;
  blockedUntil: Date; // Time-based rehabilitation
};
```

---

#### Q25: Pattern Staleness

**Codebase Evidence:**
- NO pattern versioning exists
- Knowledge graph has `confidence` decay but not dependency tracking

**Answer:** Staleness detection:
1. **Dependency tracking:** Pattern depends on `packages/auth` → watch for auth changes
2. **Success rate decay:** If pattern hasn't succeeded in 30 days, confidence -= 0.1/week
3. **Explicit invalidation:** Migration removes file → invalidate patterns touching that file

---

### VII. Antifragility

#### Q26: Recovery Strategy Selection

**Codebase Evidence:**
- `packages/runtime/src/loops/resume.ts` has simple retry logic (max 3)
- NO meta-learning for recovery strategies

**Current State:** Recovery is **hardcoded, not learned**.

**Answer:** Add:
1. Recovery outcome tracking: `{ strategy, success, context }`
2. Strategy selection: `SELECT strategy FROM recoveries WHERE similar(context) ORDER BY success_rate DESC`

---

#### Q27: Circuit Breaker Cascades

**Codebase Evidence:**
- NO circuit breaker implementation exists (grep returns 0)
- `packages/agent/src/orchestrator/tool/web.ts` has basic fallback (Exa → DDG)

**Current State:** **Circuit breakers do NOT exist.** This is new work.

**Answer:** Terminal fallback order:
1. Primary (Claude) → Secondary (GPT-4) → Tertiary (Gemini) → Local (Codex CLI offline) → Queue for later

---

#### Q28: Checkpoint Storage Costs

**Codebase Evidence:**
- `workflow_events` table stores events with JSONB `event_data`
- NO explicit checkpoint storage beyond event log

**Current State:** Checkpoints are **implicit in event stream**, not explicit snapshots.

**Answer:** For 100 workflows/day × 5 phases:
- Event storage: ~500 rows/day × 2KB = 1 MB/day
- Container checkpoints: NOT implemented
- Git refs: ~500 refs/day × 100 bytes = 50 KB/day

**Retention policy:** Keep last 30 days, archive to cold storage after.

---

#### Q29: Chaos Engineering in Production

**Answer:** For single-user system: **NO production chaos**.
- Development/testing only
- 0.1% failure rate is meaningful only at scale
- Instead: Comprehensive error injection in E2E tests

---

#### Q30: Barbell Strategy Risk Definition

**Codebase Evidence:**
- `packages/cognitive/src/logic/autonomy.ts` has `RiskAssessment` type
- Risk levels: "low", "medium", "high"

**Answer:** "Low risk" = ALL of:
- Autonomy level ≥ 0.7
- Task complexity ≤ 2 phases
- No destructive operations (delete, drop, rm)
- File scope ≤ 5 files

---

### VIII. UX and Human-in-the-Loop

#### Q31: Visual Builder Constraint Enforcement

**Answer:** Validation strategy:
1. **Client-side:** Prevent cycles via drag handlers (onConnect → check for cycles)
2. **Server-side:** Validate on save, return errors
3. **Visual feedback:** Highlight invalid edges in red

---

#### Q32: Mobile Approval UX

**Answer:** Minimum mobile experience:
1. **List view:** Phase names with status icons
2. **Summary card:** Total phases, estimated time, risk level
3. **Approve/Reject:** Two-button footer
4. **Expand detail:** Tap phase for description

Editing: Desktop only for v1.

---

#### Q33: Voice Approval Lexicon

**Codebase Evidence:**
- NO voice approval keywords defined

**Answer:** Explicit approval words:
- **Approve:** "approve", "yes", "do it", "go ahead", "execute", "proceed"
- **Reject:** "no", "cancel", "stop", "reject", "wait"
- **Iterate:** "change", "modify", "update", "add", "remove"

Ambiguous phrases ("sounds good", "sure") → Ask for confirmation.

---

#### Q34: Plan Expiration

**Answer:** Plan validity window:
1. **5 minutes:** No changes to codebase → execute immediately
2. **5-30 minutes:** Re-run research, compare diff → execute if <10% change
3. **>30 minutes:** Expired, regenerate plan

---

#### Q35: Multi-Device Sync

**Codebase Evidence:**
- `workflow_runs` table is single source of truth
- NO real-time sync mechanism

**Answer:** Sync strategy:
1. Workflow state lives in DB
2. All devices poll/subscribe to state
3. Optimistic locking: `updated_at` check before mutations
4. Conflict: Last write wins, notify other devices

---

### IX. Cost and Resource Management

#### Q36: Per-Workflow Cost Breakdown

**Revised estimate:**
| Phase | Tokens (approx) | Cost @ $10/1M tokens |
|-------|-----------------|----------------------|
| Intent parsing | 1,000 | $0.01 |
| Research (5 searches) | 5,000 | $0.05 |
| Plan gen (3 variants) | 15,000 | $0.15 |
| Evaluation (3×3) | 27,000 | $0.27 |
| **Total** | 48,000 | **$0.48** |

**Answer:** $0.50 target is **achievable** with current model pricing.

---

#### Q37: Agent Token Budget Exceeded

**Codebase Evidence:**
- `packages/agent/src/orchestrator/tool/codex/definition.ts` has `timeoutSec` but no token limit

**Current State:** Token budgets are NOT enforced.

**Answer:** On budget exceed:
1. Allow current operation to complete (max 30s grace)
2. Save partial output
3. Mark agent as "budget_exceeded"
4. Option to extend or skip remaining phases

---

#### Q38: Parallel vs Sequential Cost Tradeoff

**Codebase Evidence:**
- `packages/runtime/src/orchestrator/waves.ts` line 226: `pLimit(maxParallel)` for concurrency

**Answer:** Rate limits are per-provider, not aggregate. Parallel execution:
- Hits rate limits faster per provider
- Can use multiple providers in parallel
- Net effect: **Faster** for 2-3 agents, **Same** for 4+ (rate-limited)

---

### X. Security and Safety

#### Q39: Malicious Intent Injection

**Codebase Evidence:**
- Policy enforcement in `packages/policy/src/pdp.ts`
- Tool-level authorization checks

**Answer:** Safety layers:
1. **Intent sanitization:** Detect shell commands, file paths outside workspace
2. **Tool restrictions:** Codex runs in container with mounted workspace only
3. **Policy obligations:** Dangerous actions require biometric

---

#### Q40: Agent Sandbox Escape

**Codebase Evidence:**
- `packages/agent/src/environment/container.ts` mounts only `${repoBase}:/workspace`
- Resource limits: `cpus: 1.0, memory: "1g"` (lines 119-122)

**Current State:** Docker provides network, filesystem isolation. Resource limits enforced.

**Answer:** Defense in depth:
1. ✅ Container isolation
2. ✅ Volume mount restriction
3. ✅ Resource limits
4. ❌ seccomp profiles (not configured)
5. ❌ Network policy (not configured)

---

#### Q41: Pattern Poisoning

**Answer:** Mitigation:
1. **Minimum success threshold:** Pattern requires 3+ successes before reuse
2. **Source isolation:** Patterns tagged with `source: "workflow:{runId}"`
3. **Review queue:** New patterns shown in admin UI for approval
4. **Expiration:** Unverified patterns expire in 7 days

---

### XI. Edge Cases and Pathological Scenarios

#### Q42: Zero-Pattern Cold Start

**Answer:** Cold start experience:
1. Research phase runs (web + codebase)
2. Plan generation uses research only (no patterns)
3. User sees "No similar workflows found—generating fresh plan"
4. First success creates first pattern

System degrades gracefully.

---

#### Q43: Conflicting Patterns

**Answer:** Resolution order:
1. **Recency:** More recent pattern wins (last 7 days)
2. **Success rate:** Higher success rate wins
3. **User preference:** If tie, present both with "Choose approach"

---

#### Q44: Infinite Clarification Loop

**Codebase Evidence:**
- NO max clarification count exists (clarification doesn't exist)

**Answer:** Escape hatch:
1. Max 3 clarifications
2. After 3: "I'll proceed with my best understanding: {assumptions}"
3. User can override or approve

---

#### Q45: Workflow Deadlock

**Codebase Evidence:**
- `packages/runtime/src/core.ts` lines 220-237 show workflow timeout (30 minutes)
- `packages/cognitive/src/loop.ts` has stall detection (60 seconds)

**Answer:** Deadlock detection:
1. **Stall detector:** 60s without activity → interrupt
2. **Workflow timeout:** 30 minutes → fail with timeout error
3. **UI notification:** Show "Workflow appears stuck" after 5 minutes of no progress

---

#### Q46: Irreversible Operations

**Answer:** Pre-execution checks:
1. **Migration analysis:** Parse SQL for `DROP COLUMN`, `DELETE`, `TRUNCATE`
2. **Flag irreversible:** Mark phase as `irreversible: true`
3. **Extra confirmation:** Require explicit "I understand this cannot be undone"
4. **Backup prompt:** Suggest backup command before execution

---

#### Q47: Minimum Viable Experiment

**Answer:** Validate architecture with:

**Week 1-2: Intent → Plan (no execution)**
1. Build intent parser with clarification
2. Generate plans for 10 real requests from Linear backlog
3. Measure: Human agreement rate with generated phases

**Week 3-4: Single-Agent Execution**
1. Execute plans with 1 agent (no waves)
2. Measure: Success rate, actual vs estimated duration

**Week 5-6: Multi-Agent + Learning**
1. Enable parallel agents
2. Track pattern extraction
3. Measure: Pattern reuse rate, cost per workflow

**Success criteria before full build:**
- 80%+ human agreement on generated plans
- 70%+ single-agent execution success
- Pattern extraction working for 50%+ of successes

---

### Summary: Critical Gaps Identified

| # | Gap | Ticket | Severity | Effort |
|---|-----|--------|----------|--------|
| 1 | **No clarification mechanism** | [ALF-277](https://linear.app/alfred-ops/issue/ALF-277) | High | 2 days |
| 2 | **No pattern storage/learning** | [ALF-291](https://linear.app/alfred-ops/issue/ALF-291) | High | 1 week |
| 3 | **No duration estimation** | [ALF-283](https://linear.app/alfred-ops/issue/ALF-283) | Medium | 2 days |
| 4 | **No circuit breakers** | [ALF-305](https://linear.app/alfred-ops/issue/ALF-305) | Medium | 3 days |
| 5 | **No cross-agent context propagation** | [ALF-288](https://linear.app/alfred-ops/issue/ALF-288) | Medium | 3 days |
| 6 | **No Docker warm pool** | [ALF-302](https://linear.app/alfred-ops/issue/ALF-302) | Low | 2 days |
| 7 | **No semantic conflict detection** | TBD | Low | 1 week |
| 8 | **No cost tracking/limits** | [ALF-303](https://linear.app/alfred-ops/issue/ALF-303) | Low | 2 days |

**Total new work estimate (revised):** ~6-8 weeks for core planning infrastructure, ~2-3 weeks for UI, ~1-2 weeks for optimizations. Total: ~9-13 weeks for full implementation (revised based on gap analysis).

---

### Answers to the 5 Most Critical Questions

| # | Question | Answer |
|---|----------|--------|
| 1 | **How do we prevent semantic near-misses in pattern matching?** | Structural validation (phase count, file paths) + minimum 0.85 similarity + user confirmation for 0.70-0.85 range |
| 2 | **What's the right phase granularity and who decides?** | Currently auto-decided by import graph + bucket heuristics. Add configurable `minPhaseLOC`, `maxPhases`, `parallelizationTarget` |
| 3 | **How do we propagate context between agents?** | Currently implicit via workspace. Need explicit handoff OR re-scan after each wave (tradeoff: cost vs freshness) |
| 4 | **What's the cold start experience?** | Graceful degradation: Research-only plan generation, "No patterns found" messaging, first success creates first pattern |
| 5 | **What's the minimum viable experiment?** | 6-week phased rollout: Intent→Plan validation (2w), Single-agent execution (2w), Multi-agent + learning (2w). Success criteria: 80% plan agreement, 70% execution success |
