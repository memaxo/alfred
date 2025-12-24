# AI-Native Workflow: Comprehensive Gap Analysis

> **Date:** 2025-01-27  
> **Status:** Gap Analysis Complete  
> **Reference:** `docs/execplans/ai-native-workflow.md`

---

## Executive Summary

This document provides a comprehensive gap analysis comparing the AI-Native Workflow ExecPlan against the current codebase. The analysis identifies **what exists**, **what's missing**, and **what needs modification** to implement the AI-native workflow system.

**Overall Assessment:** The codebase has **~60% of required infrastructure**, with critical gaps in planning, pattern learning, and UI components.

---

## Methodology

1. **Systematic Component Search:** Searched for each ExecPlan component across the codebase
2. **Type System Verification:** Checked for `StructuredPlan`, `WorkflowIntent`, `WorkflowPattern`, `Phase` types
3. **Package Verification:** Confirmed `@alfred/plan` package does not exist
4. **Database Schema Review:** Checked for `workflow_plans`, `workflow_patterns`, `projects` tables
5. **API Router Review:** Checked for plan-related tRPC endpoints

---

## Component-by-Component Analysis

### Phase 1: Intent & Research

#### 1.1 Intent Parser (`packages/plan/src/intent/parser.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/api/src/routers/codex-intent.ts` - Simple intent-to-codex-prompt mapper (not structured `WorkflowIntent`)
- Basic intent classification exists but not for workflow planning

**What's Missing:**
- `WorkflowIntent` type definition
- Structured intent parsing with ambiguity detection
- Clarification tool/mechanism (`askClarification`)
- Multi-intent splitting
- Intent classification for workflow types

**Gap Details:**
```typescript
// MISSING: packages/plan/src/intent/parser.ts
export type WorkflowIntent = {
  description: string;
  context: {
    codebase: string;
    existingPatterns: Pattern[];
    constraints: Constraint[];
  };
};

// MISSING: Clarification mechanism
export async function parseIntent(
  input: string,
  options?: { maxClarifications?: number }
): Promise<WorkflowIntent | { clarification: ClarificationRequest }>;
```

**Related Tickets:** P1-2 ([ALF-277](https://linear.app/alfred-ops/issue/ALF-277))

---

#### 1.2 External Research Aggregator (`packages/plan/src/research/external.ts`)

**Status:** 🟡 **PARTIAL** - Research exists but not structured as `ResearchResult`

**What Exists:**
- `packages/runtime/src/context.ts` - `ContextBuilder` with `gatherWebContext()`
- `packages/agent/src/orchestrator/tool/web.ts` - Web search with Exa/DDG fallback
- `packages/runtime/src/phases/scan.ts` - Scan phase gathers web context

**What's Missing:**
- Structured `ResearchResult` type
- Source reliability scoring
- Date filtering/decay
- Framework version matching
- Research aggregation into single result

**Gap Details:**
```typescript
// EXISTS: packages/runtime/src/context.ts
async gatherWebContext({ requirement, authz }): Promise<WebReceipt>

// MISSING: Structured ResearchResult
export type ResearchResult = {
  external: Array<{
    source: string;
    summary: string;
    reliability: number; // 0.0-1.0
    date?: Date;
  }>;
  internal: {
    existingCode: string[];
    patterns: LearnedPattern[];
    conventions: Convention[];
  };
};
```

**Related Tickets:** P1-3 ([ALF-278](https://linear.app/alfred-ops/issue/ALF-278))

---

#### 1.3 Internal Research (`packages/plan/src/research/internal.ts`)

**Status:** 🟡 **PARTIAL** - Codebase scanning exists, pattern lookup missing

**What Exists:**
- `packages/runtime/src/context.ts` - `gatherCodeContext()` for semantic code search
- `packages/agent/src/orchestrator/reasoning/decompose-semantic.ts` - Import analysis
- Codebase scanning via RAG/knowledge graph

**What's Missing:**
- Pattern lookup from knowledge graph (workflow patterns don't exist yet)
- Convention extraction (project conventions not stored)
- Structured internal research result type
- Integration with project-scoped patterns

**Gap Details:**
```typescript
// EXISTS: packages/runtime/src/context.ts
async gatherCodeContext({ requirement, cw, topK }): Promise<CodeReceipt>

// MISSING: Pattern lookup
export async function lookupPatterns(
  intent: string,
  projectId?: string
): Promise<WorkflowPattern[]>;

// MISSING: Convention extraction
export async function extractConventions(
  projectId: string
): Promise<Convention[]>;
```

**Related Tickets:** P1-4 ([ALF-279](https://linear.app/alfred-ops/issue/ALF-279))

---

#### 1.4 Research Aggregation (`packages/plan/src/research/aggregate.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/runtime/src/context.ts` - Combines code + web receipts into `SearchReceipt`
- Basic aggregation exists but not structured as `ResearchResult`

**What's Missing:**
- Token limit management for combined research
- Source deduplication
- Research result schema validation
- Integration with pattern/convention data

**Related Tickets:** P1-5 ([ALF-280](https://linear.app/alfred-ops/issue/ALF-280))

---

#### 1.5 Project Entity (`packages/db/src/schema/project.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/runtime/src/orchestrator/types.ts` - `ProjectConfig` (runtime-only, technical config)
- `workflow_runs.linearIssueId` - Links to Linear issues, not projects
- No project container entity

**What's Missing:**
- `projects` table schema
- Project auto-detection from workspace path
- Project-Linear sync
- Convention storage per project
- Project-scoped pattern filtering

**Gap Details:**
```sql
-- MISSING: Migration 0XXX_projects.sql
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
```

**Related Tickets:** P1-6 ([ALF-281](https://linear.app/alfred-ops/issue/ALF-281)), P1-7 ([ALF-282](https://linear.app/alfred-ops/issue/ALF-282))

---

### Phase 2: Planning & Evaluation

#### 2.1 Plan Generator (`packages/plan/src/generate/phased.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/runtime/src/phases/plan.ts` - `executePlanPhase()` generates text-based ExecPlan markdown
- `packages/agent/src/orchestrator/multi/decompose.ts` - `decomposeTask()` creates `SubTask[]`
- `packages/cognitive/src/plan/types.ts` - Simple `Plan` type (steps, duration, confidence) - NOT `StructuredPlan`

**What's Missing:**
- `StructuredPlan` type with `Phase[]` structure
- `Phase` type wrapping `SubTask[]`
- Plan generation from `WorkflowIntent + ResearchResult`
- Phase dependency graph generation
- Agent type assignment per phase
- Duration estimation per phase

**Gap Details:**
```typescript
// EXISTS: packages/agent/src/orchestrator/multi/decompose.ts
export type SubTask = {
  id: SubTaskId;
  title: string;
  requirement: string;
  deps: SubTaskId[];
  priority: number;
  acceptance: string[];
  filesHint: string[];
};

// MISSING: Phase wrapper
export type Phase = {
  id: string;
  name: string;
  description: string;
  tasks: SubTask[]; // ← REUSES existing type
  dependsOn: string[];
  estimatedDurationMs: number;
  agentType: "codex" | "droid" | "claude-code" | "research" | "review";
};

// MISSING: StructuredPlan
export type StructuredPlan = {
  id: string;
  title: string;
  intent: string;
  phases: Phase[];
  resources: ResourceAllocation;
  evaluationCriteria: Criterion[];
};
```

**Related Tickets:** P2-1 ([ALF-283](https://linear.app/alfred-ops/issue/ALF-283))

---

#### 2.2 Plan Evaluation (`packages/plan/src/evaluate/judge.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- No multi-model judging exists
- No plan variant generation
- No evaluation pipeline

**What's Missing:**
- Best-of-N plan variant generation
- Multi-model judges (Claude, GPT-4, Gemini)
- Evaluation criteria schema
- Weighted score aggregation
- Verification-first evaluation (typecheck/tests/build)

**Gap Details:**
```typescript
// MISSING: packages/plan/src/evaluate/judge.ts
export async function evaluatePlans(
  plans: StructuredPlan[],
  signal?: AbortSignal
): Promise<{ evaluations: PlanEvaluation[]; winner: StructuredPlan }>;

// MISSING: Verification-first evaluation
export async function verifyPlans(
  plans: StructuredPlan[],
  checks: ("typecheck" | "test" | "lint")[]
): Promise<VerificationResult[]>;
```

**Related Tickets:** P2-2 ([ALF-284](https://linear.app/alfred-ops/issue/ALF-284)), P2-3 ([ALF-285](https://linear.app/alfred-ops/issue/ALF-285))

---

#### 2.3 Plan Persistence (`packages/db/src/schema/plan.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- `workflow_runs` table stores execution state
- No `workflow_plans` table for persisted plans

**What's Missing:**
- `workflow_plans` table schema
- Plan approval gate
- Plan-to-run conversion
- Plan versioning

**Gap Details:**
```sql
-- MISSING: Migration 0XXX_workflow_plans.sql
CREATE TABLE IF NOT EXISTS workflow_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  intent TEXT NOT NULL,
  plan_data JSONB NOT NULL, -- StructuredPlan
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' | 'executed'
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Related Tickets:** P2-4 ([ALF-286](https://linear.app/alfred-ops/issue/ALF-286))

---

### Phase 3: Execution Integration

#### 3.1 Plan → WavePlan Conversion (`packages/runtime/src/orchestrator/waves.ts`)

**Status:** 🟡 **PARTIAL** - Wave planning exists, but not from `StructuredPlan`

**What Exists:**
- `packages/agent/src/orchestrator/multi/spawn.ts` - `planWaves()` converts `SubTask[]` → `WavePlan[]`
- `packages/runtime/src/orchestrator/waves.ts` - `runWaves()` executes waves
- Wave dependency handling

**What's Missing:**
- Conversion from `StructuredPlan.phases` → `WavePlan[]`
- Phase-to-wave mapping
- Agent type assignment from plan phases
- Resource allocation from plan

**Gap Details:**
```typescript
// EXISTS: packages/agent/src/orchestrator/multi/spawn.ts
export function planWaves(
  subTasks: SubTask[],
  options?: { maxParallel?: number }
): WavePlan[];

// MISSING: Phase-based conversion
export function planWavesFromPhases(
  phases: Phase[],
  options?: { maxParallel?: number }
): WavePlan[] {
  // Flatten phases into SubTask[], then call existing planWaves()
  // But also respect phase-level agent assignments
}
```

**Related Tickets:** P3-1 ([ALF-287](https://linear.app/alfred-ops/issue/ALF-287))

---

#### 3.2 Cross-Agent Context Handoff

**Status:** 🟡 **PARTIAL** - Workspace persists, but no explicit handoff

**What Exists:**
- `packages/runtime/src/orchestrator/waves.ts` - Workspace persists between waves
- Agents see workspace state implicitly

**What's Missing:**
- Explicit context handoff between agents
- Agent output summaries for next agent
- Context refresh after each wave
- Structured handoff data

**Gap Details:**
```typescript
// EXISTS: Workspace persistence (implicit)
// Each agent sees workspace state via file system

// MISSING: Explicit handoff
export type AgentHandoff = {
  fromAgentId: string;
  toAgentId: string;
  summary: string;
  modifiedFiles: string[];
  context: ExecutionContext;
};

export async function handoffContext(
  from: AgentOutcome,
  to: AgentSpec
): Promise<AgentHandoff>;
```

**Related Tickets:** P3-2 ([ALF-288](https://linear.app/alfred-ops/issue/ALF-288))

---

#### 3.3 Execution Event Streaming

**Status:** 🟡 **PARTIAL** - Events exist, but not structured for plan visualization

**What Exists:**
- `packages/runtime/src/orchestrator/waves.ts` - Yields `WorkflowEvent` for wave progress
- `workflow_events` table stores events
- WebSocket subscription exists (`apps/web/src/lib/subscription/manager.ts`)

**What's Missing:**
- Plan-specific event types (`plan-variant`, `plan-selected`, `phase-start`, `phase-complete`)
- Phase progress tracking
- Plan generation event streaming
- Integration with desktop UI subscription protocol

**Gap Details:**
```typescript
// EXISTS: packages/runtime/src/orchestrator/waves.ts
yield { type: "notice", message: `wave_${wave.id}_start` };

// MISSING: Phase-specific events
export type PlanEvent =
  | { type: "plan-variant"; index: number; plan: StructuredPlan }
  | { type: "plan-selected"; plan: StructuredPlan }
  | { type: "phase-start"; phaseId: string }
  | { type: "phase-complete"; phaseId: string; result: PhaseResult };
```

**Related Tickets:** P3-3 ([ALF-289](https://linear.app/alfred-ops/issue/ALF-289))

---

#### 3.4 Workflow Suspend/Resume on Clarification

**Status:** ❌ **MISSING**

**What Exists:**
- `workflow_runs.suspendedAt`, `workflow_runs.resumedAt` - Schema supports suspend/resume
- No clarification-triggered suspend mechanism

**What's Missing:**
- Clarification request handling
- Suspend on clarification
- Resume with user response
- State persistence across suspend/resume

**Related Tickets:** P3-4 ([ALF-290](https://linear.app/alfred-ops/issue/ALF-290))

---

### Phase 4: Pattern Learning

#### 4.1 Pattern Extraction (`packages/plan/src/pattern/extract.ts`)

**Status:** 🟡 **PARTIAL** - Pattern learning exists for tool sequences, not workflow patterns

**What Exists:**
- `packages/agent/src/orchestrator/tool/learning/exec.ts` - `executeLearnPattern()` stores tool sequence patterns
- `packages/agent/src/orchestrator/learning-worker.ts` - `learnFromRun()` extracts facts from workflows
- `packages/knowledge/src/extract/patterns.ts` - Pattern extraction for text/knowledge

**What's Missing:**
- `WorkflowPattern` type (different from tool sequence patterns)
- Pattern extraction from successful `StructuredPlan` executions
- Pattern structure capture (phase graph, dependencies)
- Success rate tracking
- Pattern confidence calculation

**Gap Details:**
```typescript
// EXISTS: Tool sequence patterns
export type ToolPattern = {
  toolSequence: Tool[];
  rule: string;
  confidence: number;
};

// MISSING: Workflow patterns
export type WorkflowPattern = {
  id: string;
  trigger: string; // Semantic trigger (e.g., "add-ui-feature")
  planTemplate: Omit<StructuredPlan, "id" | "intent">;
  successRate: number;
  avgDurationMs: number;
  usageCount: number;
  projectId?: string; // Project-scoped
};
```

**Related Tickets:** P4-1 ([ALF-291](https://linear.app/alfred-ops/issue/ALF-291))

---

#### 4.2 Pattern Matching (`packages/plan/src/pattern/match.ts`)

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/knowledge/src/reasoning/decisions.ts` - Semantic similarity for decision extraction
- No workflow pattern matching

**What's Missing:**
- Semantic pattern matching for intents
- Structural validation (phase count, file paths)
- Project-scoped pattern filtering
- Pattern confidence thresholds (0.85+ auto-suggest, 0.70-0.85 require confirmation)

**Gap Details:**
```typescript
// MISSING: packages/plan/src/pattern/match.ts
export async function matchPatterns(
  intent: string,
  projectId?: string,
  minSimilarity: number = 0.7
): Promise<WorkflowPattern[]> {
  // 1. Semantic match via embeddings
  // 2. Structural validation (phase count, dependencies)
  // 3. Project-scoped filtering
  // 4. Confidence thresholding
}
```

**Related Tickets:** P4-2 ([ALF-292](https://linear.app/alfred-ops/issue/ALF-292))

---

#### 4.3 Pattern Confidence Decay & Quarantine

**Status:** ❌ **MISSING**

**What Exists:**
- No pattern lifecycle management

**What's Missing:**
- 30-day unused decay
- <30% success quarantine
- >90% success amplification
- Pattern status tracking (`active`, `quarantined`, `trusted`)

**Related Tickets:** P4-3 ([ALF-293](https://linear.app/alfred-ops/issue/ALF-293))

---

#### 4.4 Anti-Pattern Learning

**Status:** 🟡 **PARTIAL** - Failure learning exists, but not as anti-patterns

**What Exists:**
- `packages/agent/src/orchestrator/learning-worker.ts` - `processFailedRuns()` extracts facts from failures
- Failures stored as knowledge graph facts

**What's Missing:**
- Explicit anti-pattern storage
- Anti-pattern blocking mechanism
- Time-based rehabilitation
- Failure reason categorization

**Related Tickets:** P4-4 ([ALF-294](https://linear.app/alfred-ops/issue/ALF-294))

---

#### 4.5 Project-Scoped Pattern Matching

**Status:** ❌ **MISSING** (depends on Project entity)

**What's Missing:**
- `workflow_patterns.project_id` FK
- Project-scoped pattern queries
- Cross-project pattern weighting (0.8x)
- In-project vs cross-project accuracy tracking

**Related Tickets:** P4-5 ([ALF-295](https://linear.app/alfred-ops/issue/ALF-295))

---

#### 4.6 Convention Learning

**Status:** ❌ **MISSING**

**What Exists:**
- No convention extraction or storage

**What's Missing:**
- Convention extraction from successful workflows
- Convention storage in `projects.conventions` JSONB
- Convention confidence tracking
- Convention injection into research phase

**Related Tickets:** P4-6 ([ALF-296](https://linear.app/alfred-ops/issue/ALF-296))

---

### Phase 5: Visual Builder

#### 5.1 Workflow Canvas View (`apps/web/src/components/windows/workflow/canvas.tsx`)

**Status:** ❌ **MISSING**

**What Exists:**
- `apps/web/src/components/windows/workflow/` - Basic workflow window exists
- React Flow used elsewhere in codebase
- Desktop window system supports `workflow` type

**What's Missing:**
- Canvas subview within workflow window
- Phase node components
- Dependency edge components
- Zoom/pan controls
- View mode toggle ("plan" | "canvas" | "timeline")

**Gap Details:**
```typescript
// MISSING: apps/web/src/components/windows/workflow/canvas.tsx
export function PlanCanvas({ plan }: { plan: StructuredPlan }) {
  const nodes = phasesToNodes(plan.phases);
  const edges = dependenciesToEdges(plan.phases);
  return <ReactFlow nodes={nodes} edges={edges} />;
}
```

**Related Tickets:** P5-1 ([ALF-297](https://linear.app/alfred-ops/issue/ALF-297)), P5-2 ([ALF-298](https://linear.app/alfred-ops/issue/ALF-298)), P5-3 ([ALF-299](https://linear.app/alfred-ops/issue/ALF-299))

---

#### 5.2 Approval Controls Panel

**Status:** ❌ **MISSING**

**What Exists:**
- No plan approval UI

**What's Missing:**
- Approve/reject/iterate buttons
- Keyboard shortcuts
- Approval state management
- Integration with plan persistence

**Related Tickets:** P5-4 ([ALF-300](https://linear.app/alfred-ops/issue/ALF-300))

---

#### 5.3 Plan Editing (Drag-Drop, Reorder)

**Status:** ❌ **MISSING**

**What's Missing:**
- Drag-drop phase reordering
- Cycle detection
- Optimistic updates
- Plan mutation validation

**Related Tickets:** P5-5 ([ALF-301](https://linear.app/alfred-ops/issue/ALF-301))

---

### Phase 6: Resilience & Optimization

#### 6.1 Docker Warm Pool

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/agent/src/environment/container.ts` - Container creation
- Container reuse for same runId

**What's Missing:**
- Pre-created container pool
- Pool assignment/replenishment
- Idle timeout management

**Related Tickets:** P6-1 ([ALF-302](https://linear.app/alfred-ops/issue/ALF-302))

---

#### 6.2 Cost Tracking & Budget Limits

**Status:** ❌ **MISSING**

**What Exists:**
- `packages/agent/src/orchestrator/tool/web.ts` - Tracks `CostInfo` for Exa searches only
- No aggregate cost tracking

**What's Missing:**
- Per-workflow cost tracking
- Token usage per phase
- Budget enforcement
- Cost UI display

**Related Tickets:** P6-2 ([ALF-303](https://linear.app/alfred-ops/issue/ALF-303))

---

#### 6.3 Resilience Tests & Safeguards

**Status:** 🟡 **PARTIAL** - Some safeguards exist, but not comprehensive

**What Exists:**
- `packages/runtime/src/core.ts` - Workflow timeout (30 minutes)
- `packages/cognitive/src/loop.ts` - Stall detection (60 seconds)
- MAX_TRANSITIONS guard exists

**What's Missing:**
- Explicit tests for success/escalation/MAX_TRANSITIONS
- Abort propagation tests
- Comprehensive resilience test suite

**Related Tickets:** P6-3 ([ALF-304](https://linear.app/alfred-ops/issue/ALF-304))

---

## Package Structure Gaps

### Missing Package: `@alfred/plan`

**Status:** ❌ **COMPLETELY MISSING**

**Expected Structure:**
```
packages/plan/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── intent/
│   ├── research/
│   ├── generate/
│   ├── evaluate/
│   ├── pattern/
│   ├── serialize/
│   └── project/
├── test/
└── package.json
```

**Current State:** Package does not exist. All references in ExecPlan are proposals.

---

## Database Schema Gaps

### Missing Tables

1. **`workflow_plans`** - Persisted plans before execution
2. **`workflow_patterns`** - Learned workflow patterns
3. **`projects`** - Project container entity

### Missing Columns

1. **`workflow_runs.project_id`** - FK to projects table
2. **`workflow_runs.plan_id`** - FK to workflow_plans table

---

## API Router Gaps

### Missing tRPC Routers

1. **`plan.parseIntent`** - Intent parsing endpoint
2. **`plan.research`** - Research aggregation endpoint
3. **`plan.generate`** - Plan generation endpoint
4. **`plan.evaluate`** - Plan evaluation endpoint
5. **`plan.approve`** - Plan approval endpoint
6. **`plan.patterns`** - Pattern listing endpoint
7. **`plan.matchPattern`** - Pattern matching endpoint
8. **`project.resolve`** - Project resolution endpoint
9. **`project.list`** - Project listing endpoint
10. **`project.conventions`** - Convention management endpoint

**Current State:** No `planRouter` exists. Only `workflowRouter` exists for execution.

---

## Type System Gaps

### Missing Types

1. **`WorkflowIntent`** - Structured intent representation
2. **`StructuredPlan`** - Phased plan structure
3. **`Phase`** - Phase wrapper for SubTasks
4. **`WorkflowPattern`** - Learned workflow pattern
5. **`PlanEvaluation`** - Evaluation result
6. **`ResearchResult`** - Aggregated research
7. **`Convention`** - Project convention
8. **`Project`** - Project entity type

**Current State:** Only `SubTask`, `WavePlan`, `AgentSpec` exist. No planning types.

---

## Integration Gaps

### Missing Integrations

1. **Plan → WavePlan conversion** - Need adapter from `StructuredPlan` to existing `WavePlan`
2. **Pattern → Research injection** - Patterns not injected into research phase
3. **Convention → Research injection** - Conventions not injected into research phase
4. **Plan → Execution bridge** - No connection between plan approval and workflow start
5. **Execution → Pattern extraction** - No post-execution pattern learning

---

## UI Component Gaps

### Missing Components

1. **`PlanViewer`** - Plan display component
2. **`PlanCanvas`** - React Flow canvas for phases
3. **`PhaseNode`** - Visual phase representation
4. **`DependencyEdge`** - Animated dependency edges
5. **`ApprovalControls`** - Approve/reject/iterate panel
6. **`PlanTimeline`** - Execution timeline view
7. **`PlanCollection`** - TanStack DB collection for plans

**Current State:** Basic workflow window exists, but no plan-specific UI.

---

## Critical Path Dependencies

### Must-Have Before Execution Can Use Plans

1. ✅ **`@alfred/plan` package** - Foundation
2. ✅ **`StructuredPlan` type** - Core data structure
3. ✅ **Plan → WavePlan conversion** - Execution bridge
4. ✅ **Plan persistence** - Approval gate
5. ✅ **Plan approval endpoint** - UI integration

### Can Defer (Nice-to-Have)

1. Pattern learning (can start without patterns)
2. Best-of-N evaluation (can use single plan)
3. Visual builder editing (can start read-only)
4. Docker warm pool (optimization)
5. Cost tracking (optimization)

---

## Summary Statistics

| Category | Exists | Partial | Missing | Total |
|----------|--------|---------|---------|-------|
| **Phase 1: Intent & Research** | 0 | 3 | 4 | 7 |
| **Phase 2: Planning & Evaluation** | 0 | 1 | 3 | 4 |
| **Phase 3: Execution Integration** | 1 | 3 | 1 | 5 |
| **Phase 4: Pattern Learning** | 0 | 2 | 4 | 6 |
| **Phase 5: Visual Builder** | 0 | 0 | 3 | 3 |
| **Phase 6: Resilience** | 0 | 1 | 2 | 3 |
| **Infrastructure** | 0 | 0 | 3 | 3 |
| **TOTAL** | 1 | 10 | 20 | 31 |

**Completion Estimate:** ~35% of required components exist (mostly partial implementations)

---

## Recommended Implementation Order

### Critical Path (Must-Have)

1. **P1-1:** Create `@alfred/plan` package scaffold
2. **P1-2:** Intent parser (minimal - no clarification initially)
3. **P1-3:** External research aggregator (wrap existing `gatherWebContext`)
4. **P1-4:** Internal research (wrap existing `gatherCodeContext`)
5. **P1-5:** Research aggregation (combine existing receipts)
6. **P2-1:** Plan generator (wrap `decomposeTask` + phase grouping)
7. **P2-4:** Plan persistence (create `workflow_plans` table)
8. **P3-1:** Plan → WavePlan conversion (adapter layer)
9. **P3-3:** Execution event streaming (extend existing events)

### High Value (Should-Have)

10. **P1-6:** Project entity (enables pattern scoping)
11. **P4-1:** Pattern extraction (enables learning)
12. **P4-2:** Pattern matching (enables reuse)
13. **P5-1:** Canvas view (enables visualization)

### Optimization (Nice-to-Have)

14. **P2-2:** Plan critique (improves quality)
15. **P2-3:** Evaluation (improves selection)
16. **P6-2:** Cost tracking (resource management)
17. **P6-1:** Docker warm pool (performance)

---

## Risk Assessment

### High Risk Gaps

1. **No `@alfred/plan` package** - Blocks all planning work
2. **No `StructuredPlan` type** - Core data structure missing
3. **No plan persistence** - Can't approve/execute plans
4. **No plan → execution bridge** - Plans can't be executed

### Medium Risk Gaps

1. **No clarification mechanism** - UX gap, but can proceed with assumptions
2. **No pattern learning** - Reduces value, but system works without it
3. **No visual builder** - Can use text-based plan viewer initially

### Low Risk Gaps

1. **No Docker warm pool** - Performance optimization, not blocker
2. **No cost tracking** - Resource management, not blocker
3. **No best-of-N evaluation** - Can use single plan initially

---

## Next Steps

1. **Create `@alfred/plan` package** - Foundation for all planning work
2. **Define core types** - `StructuredPlan`, `Phase`, `WorkflowIntent`
3. **Create database migrations** - `workflow_plans`, `projects`, `workflow_patterns`
4. **Implement minimal intent parser** - Without clarification initially
5. **Wrap existing research** - Aggregate into `ResearchResult`
6. **Create plan generator** - Wrap `decomposeTask` with phase grouping
7. **Build plan → execution bridge** - Convert `StructuredPlan` to `WavePlan`

---

## Conclusion

The codebase has **strong execution infrastructure** (~80% as stated in ExecPlan) but **weak planning infrastructure** (~10%). The gap is primarily in:

1. **Planning types and structures** - No `StructuredPlan`, `Phase`, `WorkflowIntent`
2. **Pattern learning** - Exists for tool sequences, not workflows
3. **UI components** - No plan visualization or approval UI
4. **Database schema** - Missing `workflow_plans`, `projects`, `workflow_patterns` tables

**Recommendation:** Start with Phase 1 (Intent & Research) and Phase 2 (Planning) foundation work. These are prerequisites for all other phases.
