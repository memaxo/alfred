# Enhanced Prompt: Canonical Pipeline ExecPlan Verification

### Task

Review and update `docs/execplans/canonical-pipeline.md` to align with actual codebase function signatures, types, and patterns. The current execplan contains several assumptions that don't match the existing implementation.

---

## Critical Discrepancies Found

### 1. Functions That DON'T EXIST (Must Create or Rename References)

| Execplan Reference             | Actual Status                           | Correct Alternative                                                                                                      |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `createRootExecPlan()`         | **Does not exist**                      | Must create or use `persistExecPlans()` from `@alfred/agent/assistant/graphstore`                                        |
| `createSubtaskSkeleton()`      | **Does not exist**                      | Use `generateSubtaskExecPlanSkeleton(subTask, runId)` from `packages/agent/src/orchestrator/multi/execplan.ts:163`       |
| `learnFromRun()`               | **Does not exist**                      | Learning is polling-based via `startLearningWorker(config?)` at `packages/agent/src/orchestrator/learning-worker.ts:105` |
| `runReviewPhase()` at line 285 | **Does not exist as exported function** | Review logic is in `packages/runtime/src/orchestrator/review.ts` but exported via `reviewWorkflowRepo` pattern           |
| `updateLinearIssue()`          | **Does not exist**                      | Use `toolTicket.execute()` from `@alfred/agent/orchestrator/tool/ticket`                                                 |
| `commentOnLinearIssue()`       | **Does not exist**                      | Use `toolTicket.execute()` with action `"comment"`                                                                       |

### 2. Function Signature Mismatches

#### `runAgent` (packages/runtime/src/orchestrator/agent.ts:111)

**Execplan assumes:**

```typescript
runAgent({
  id,
  subTaskId,
  requirement,
  runId,
  workspace,
  signal,
  execPlanPath,
  handoffFromPrevious,
  maxAttempts,
});
```

**Actual signature:**

```typescript
export async function runAgent({
  spec, // AgentSpec object, not individual fields
  phaseId,
  runId,
  workspace,
  workspaceRoot,
  subTaskById, // Map<string, SubTask>
  projectConfig,
  activeWorkspaces,
  agentFileHints,
  rootExecPlanPath,
  signal,
  authz,
  userId,
  trackerContextRef,
  queue,
}: RunAgentOptions): Promise<AgentOutcome>;
```

#### `ContextBuilder.build()` (packages/runtime/src/context.ts:94)

**Execplan assumes:**

```typescript
builder.build() → { bundle, receipts, ragChunks, totalTokens }
```

**Actual signature:**

```typescript
async build(
  input: ContextBuildInput,
  overrides?: { receipts?: SearchReceipt; writer?: ContextWriter }
): Promise<ExecutionContext>
```

Where `ContextBuildInput` is:

```typescript
type ContextBuildInput = {
  requirement: string;
  workspace?: string;
  repoBase?: string;
  web?: boolean;
  topK?: number;
  maxTokens?: number;
  exts?: string[];
  ignore?: string[];
  seeds?: string[];
  authz?: string;
};
```

#### `generateWaveSummary` (packages/runtime/src/orchestrator/summary.ts:9)

**Execplan assumes:**

```typescript
generateWaveSummary({ runId, workspace, requirement, insights });
```

**Actual signature:**

```typescript
export async function generateWaveSummary(
  outcomes: AgentOutcome[],
  changes: FileChanges
): Promise<string>;
```

#### `decomposeTask` (packages/agent/src/orchestrator/multi/decompose.ts:151)

**Execplan assumes:** Returns `Promise<...>` (async)

**Actual signature:** Synchronous function

```typescript
export function decomposeTask(
  requirement: string,
  context: DecomposeContext // NOT ContextBundle directly
): SubTask[];

type DecomposeContext = {
  bundle?: ContextBundle;
  linearMeta?: { projectId?: string; teamId?: string };
};
```

#### `planWaves` (packages/agent/src/orchestrator/multi/spawn.ts:145)

**Execplan assumes:** Returns `Promise<...>` (async)

**Actual signature:** Synchronous function

```typescript
export function planWaves(
  subTasks: SubTask[],
  options?: {
    maxParallel?: number;
    dependencies?: Map<SubTaskId, SubTaskId[]>;
  }
): WavePlan[];
```

### 3. Type Location Corrections

| Type            | Execplan Location | Actual Location                                                                       |
| --------------- | ----------------- | ------------------------------------------------------------------------------------- |
| `ContextBundle` | `@alfred/type`    | `@alfred/type/plan` (line 178)                                                        |
| `SearchReceipt` | `@alfred/type`    | `@alfred/type/plan` (line 150)                                                        |
| `SubTask`       | Custom definition | `@alfred/type/plan` (line 351) AND `@alfred/agent/orchestrator/multi/decompose`       |
| `WavePlan`      | Custom definition | `@alfred/type/plan` (line 367) AND `@alfred/agent/orchestrator/multi/spawn` (line 36) |
| `AgentSpec`     | Custom definition | `@alfred/agent/orchestrator/multi/spawn` (line 11)                                    |
| `AgentOutcome`  | Custom definition | `@alfred/runtime/orchestrator/agent`                                                  |

### 4. Existing Phase Functions (Correct References)

```typescript
// packages/runtime/src/phases/scan.ts:73
export async function* executeScanPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  authz?: string,
  userId?: string
): AsyncGenerator<WorkflowEvent, ExecutionContext | null, void>

// packages/runtime/src/phases/plan.ts:109
export async function* executePlanPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  model: LanguageModel,
  prebuiltContext?: ExecutionContext | null,
  deps?: { userId?; projectId?; createAiAdapter?; buildContext?; decomposeTask?; ... }
): AsyncGenerator<WorkflowEvent, string | null, void>

// packages/runtime/src/orchestrator/waves.ts:55
export async function* runWaves(
  ctx: OrchestratorContext
): AsyncGenerator<WorkflowEvent, WavesResult, void>
```

---

## Relevant Context Files

### Core Orchestration

- `packages/runtime/src/orchestrator/agent.ts` - `runAgent()` actual implementation
- `packages/runtime/src/orchestrator/waves.ts` - `runWaves()` wave orchestration
- `packages/runtime/src/orchestrator/review.ts` - Review phase logic
- `packages/runtime/src/context.ts` - `ContextBuilder` class

### Multi-Agent

- `packages/agent/src/orchestrator/multi/decompose.ts` - Task decomposition
- `packages/agent/src/orchestrator/multi/spawn.ts` - `buildAgentSpec()`, `planWaves()`
- `packages/agent/src/orchestrator/multi/execplan.ts` - ExecPlan generation helpers

### Learning

- `packages/agent/src/orchestrator/learning-worker.ts` - `startLearningWorker()` (polling-based)

### Linear Integration

- `packages/agent/src/workflow/linear.ts` - `ensureLinearTicket()`
- `packages/agent/src/orchestrator/linear-rate-limiter.ts` - `LinearRateLimiter` class
- `packages/agent/src/orchestrator/tool/ticket.ts` - `toolTicket` for Linear actions

### Types

- `packages/type/src/plan.ts` - `ContextBundle`, `SearchReceipt`, `SubTask`, `WavePlan`
- `packages/agent/src/orchestrator/multi/spawn.ts` - `AgentSpec`, `WavePlan` (duplicate)
- `packages/runtime/src/orchestrator/types.ts` - `OrchestratorContext`, `AgentHandoff`

---

## Implementation Guidelines

### Step 1: Update Stage Input/Output Types

The execplan defines custom types that conflict with existing ones. Update to use existing types:

```typescript
// WRONG (execplan):
import type { ContextBundle } from "@alfred/type";

// CORRECT:
import type {
  ContextBundle,
  SearchReceipt,
  SubTask,
  WavePlan,
} from "@alfred/type/plan";
import type { AgentSpec } from "@alfred/agent/orchestrator/multi/spawn";
import type { ExecutionContext } from "@alfred/runtime/context";
```

### Step 2: Fix ContextStage Implementation

```typescript
// WRONG (execplan):
const builder = new ContextBuilder({
  requirement: ctx.requirement,
  workspace: ctx.workspace,
  runId: ctx.runId,
  config: { enable: true, web: false, maxTokens: 50_000 },
});
const result = await builder.build();

// CORRECT:
const builder = new ContextBuilder();
const result = await builder.build({
  requirement: ctx.requirement,
  workspace: ctx.workspace,
  maxTokens: 50_000,
  web: false,
});
// result is ExecutionContext with .bundle, .receipts properties
```

### Step 3: Fix PlanStage Implementation

```typescript
// WRONG (execplan):
const decomposed = await decomposeTask(ctx.requirement, input.bundle);

// CORRECT (synchronous):
const decomposed = decomposeTask(ctx.requirement, { bundle: input.bundle });
```

### Step 4: Fix ExecuteStage Implementation

Must use `OrchestratorContext` pattern from `runWaves()` instead of direct `runAgent()` calls:

```typescript
// WRONG (execplan):
const result = await runAgent({
  id: agentSpec.id,
  subTaskId: agentSpec.subTaskId,
  requirement: agentSpec.requirement,
  // ...
});

// CORRECT: Build full OrchestratorContext and delegate to runWaves
// OR: Build RunAgentOptions with spec object
const subTaskById = new Map(subtasks.map((t) => [t.id, t]));
const result = await runAgent({
  spec: agentSpec,
  phaseId: "execute",
  runId: ctx.runId,
  workspace: ctx.workspace,
  workspaceRoot: ctx.workspace,
  subTaskById,
  projectConfig: {},
  activeWorkspaces: [],
  agentFileHints: new Map(),
  rootExecPlanPath,
  signal: ctx.signal,
  authz: undefined,
  userId: ctx.userId,
  trackerContextRef: { current: null },
  queue: new AsyncQueue(),
});
```

### Step 5: Fix LearnStage Implementation

```typescript
// WRONG (execplan):
const learningResult = await learnFromRun({
  runId: ctx.runId,
  workspace: ctx.workspace,
  reviewPassed: input.allPassed,
});

// CORRECT: Learning is done by background worker, not on-demand
// Option A: Trigger via marking run complete (learning worker polls completed runs)
// Option B: Extract and call internal functions directly:
import { extract, toKnowledge } from "@alfred/knowledge/extractor";
import { upsertNodes, upsertEdges } from "@alfred/db/repo/graph/index";

// Learning happens asynchronously after run completion
```

### Step 6: Fix LinearSyncObserver Implementation

```typescript
// WRONG (execplan):
await updateLinearIssue({ issueId, status, authz });
await commentOnLinearIssue({ issueId, body, authz });

// CORRECT: Use toolTicket
import { toolTicket } from "@alfred/agent/orchestrator/tool/ticket";

await toolTicket.execute({
  action: "update",
  input: { issueId, state: status },
  authz,
});

await toolTicket.execute({
  action: "comment",
  input: { issueId, body },
  authz,
});
```

---

## Success Criteria

1. **Type Alignment:** All types import from correct packages (`@alfred/type/plan`, `@alfred/agent/orchestrator/multi/*`)
2. **Function Signatures:** All stage implementations use correct function signatures
3. **Sync vs Async:** `decomposeTask` and `planWaves` called synchronously (no `await`)
4. **Learning Pattern:** Document that learning is polling-based, not on-demand
5. **Linear Integration:** Use `toolTicket.execute()` pattern
6. **Build Verification:** `bun run typecheck --filter=@alfred/pipeline` passes

---

## Additional Considerations

### Existing Pipeline Infrastructure

There's already a nascent pipeline at `packages/runtime/src/pipeline/`:

- `runner.ts` - `PipelineRunner` class with phase registration
- `types.ts` - `Phase`, `PhaseResult`, `PipelineState` types
- `phases/` - Phase implementations (scan, plan, act, report)

Consider whether to extend this existing infrastructure vs creating a new `packages/pipeline/` package.

### AgentFS Workspace Sharing

The execplan mentions "Agents share AgentFS container via runId convention". The actual pattern in `runAgent()` creates container names like `alfred-agentfs-{runId}` via:

```typescript
// packages/runtime/src/orchestrator/agentfs.ts
export function resolveAgentfsContainer(runId: string): string;
export function resolveAgentfsContainerCw(runId: string): string;
```

### Internal Project Tracker

The execplan mentions needing internal project tracking. This aligns with:

- `packages/agent/src/orchestrator/multi/tracker.ts` - `TrackerContext`, `createTrackerContext()`
- Consider this as the foundation for internal state management that mirrors Linear
