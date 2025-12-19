# ExecPlan: Cognitive Architecture Maturity

**Owner:** Runtime/Cognitive
**Status:** Complete ✅ (Phases 1–4 done)

## Purpose
Mature the Cognitive Architecture from a passive "shadow" system into an active, autonomous decision-making engine. This plan addresses architectural blockers (dependency cycles), enables safety-gated autonomy, activates structured planning capabilities, and closes the learning loop via explicit feedback.

## Plan

### Phase 1: Dependency Cycle Resolution
Break the `runtime` ↔ `api` cycle to enable real AI generation within the cognitive loop.
- [x] **Create Adapter Interface**: Define `AIAdapter` in `@alfred/type/ai-adapter.ts`.
- [x] **Implement Adapter**: Create `packages/api/src/adapters/ai-generation.ts` (`DefaultAIAdapter` wrapping `generateText`).
- [x] **Inject Adapter**:
    - ✅ `RuntimeContext` includes `ai?: AIAdapter` (`packages/type/src/runtime-context.ts`).
    - ✅ `packages/api/src/voice/assistant.ts` creates `DefaultAIAdapter` and sets `ctx.ai` (line 93).
- [x] **Remove Mocks**: Real adapter used (`runAssistantGeneration` uses `ctx.ai.generateText`).

### Phase 2: Autonomy Gating
Implement safety checks before execution.
- [x] **Risk Analysis**: `classifyPlanRisk` exists (`packages/runtime/src/engines/safety.ts`).
- [x] **Gating Logic**: `enforceSafetyGate` implemented in `PlanRunner` (`packages/runtime/src/loops/plan-runner.ts` lines 78-104):
    - ✅ Uses `shouldGateExecution` (`packages/cognitive/src/logic/autonomy.ts`) to check autonomy vs risk.
    - ✅ Throws error if gated (prevents execution).
- [x] **Approval Handling**: `gateExecution` transitions `executing` → `deciding` (`packages/cognitive/src/logic/autonomy.ts` lines 43-71).

### Phase 3: Structured Planning
Move beyond simple text responses to multi-step execution.
- [x] **Plan Generation**: `ExecutionPlan` schema exists (`@alfred/cognitive/schemas`), used in `PlanRunner`.
- [x] **Plan Execution**: `PlanRunner.executePlan` implemented (`packages/runtime/src/loops/plan-runner.ts` lines 21-76):
    - ✅ Iterates through `plan.steps`.
    - ✅ Executes each step via `executeStep`.
    - ✅ Handles suspension and failures.
- [x] **Step-by-Step Persistence**: `cognitive_step_complete` events emitted after each plan step (`packages/runtime/src/loops/plan-runner.ts`) and asserted in `packages/runtime/test/plan-runner.test.ts`.

### Phase 4: Explicit Feedback
Close the learning loop.
- [x] **Correction Detection**: Feedback events handled via `cognitive.feedback` router.
- [x] **UI Affordances**: `CognitiveFeedbackControls` component exists (`apps/web/src/components/cognitive-feedback-controls.tsx`), `useCognitiveFeedback` hook available.
- [x] **Autonomy Update**: `runCognitiveLoop` handles `feedback` events and updates autonomy (lines 68-73).

## Technical Design

### Dependency Injection Pattern
```typescript
// @alfred/type/runtime
export interface AIAdapter {
  generate(params: GenerateParams): Promise<GenerateResult>;
}

// packages/runtime/src/loops/cognitive.ts
export async function runCognitiveLoop(
  ctx: RuntimeContext,
  ai: AIAdapter, // Injected dependency
  streamId: string,
  event: Event
) { ... }
```

### Planning with AI SDK v6
```typescript
import { generateObject } from 'ai';
import { executionPlanSchema } from '@alfred/cognitive/schemas';

// Inside transition logic
const { object: plan } = await generateObject({
  model: openai('gpt-4o'),
  schema: executionPlanSchema,
  prompt: "Create a plan for: " + state.about,
});
```

## Progress
- [x] Phase 1: Dependency Cycle Resolution ✅
- [x] Phase 2: Autonomy Gating ✅
- [x] Phase 3: Structured Planning ✅
- [x] Phase 4: Explicit Feedback ✅

## Decision Log
- **Dependency Injection**: Chosen over creating a new package to minimize structural churn. Passing the adapter via `RuntimeContext` or function arguments keeps `runtime` pure and `api` as the service layer.
- **AI SDK v6**: Strictly adhering to `generateObject` for planning to ensure type-safe, structured outputs.

## Outcomes & Retrospective

**Status**: ✅ Complete

- Dependency cycle resolved via `AIAdapter` interface and `DefaultAIAdapter` implementation.
- Autonomy gating fully implemented with `classifyPlanRisk` and `enforceSafetyGate`.
- Structured planning implemented via `PlanRunner` with step execution and checkpointing.
- Explicit feedback loop closed via `cognitive.feedback` router and UI controls.
- Added explicit per-step `cognitive_step_complete` cognitive events for better observability.

## Phase 5: State Transition Completion (ALF-142)

**Status**: ✅ Complete (2025-01-27)

- **State Transitions**: Completed all missing transitions:
  - `idle → capturing` (on input)
  - `capturing → thinking` (on input processed)
  - `deciding → executing` (on decision made)
  - `executing → reflecting` (on complete/interrupt)
- **Autonomy Updates**: Extended autonomy updates to handle `complete` events with success/failure outcomes, not just feedback events.
- **Effect Handling**: Implemented `execute_plan` and `log_reflection` effects with proper logging.
- **Tests**: Added comprehensive tests for all new transitions and autonomy update paths.
- **Dead Code Audit**: Verified all state constructors and functions are in use; no dead code found.

## Phase 6: Active Recall and Memory Decay (ALF-142)

**Status**: ✅ Complete (2025-01-27)

- **Active Recall Integration**: Completed integration across all knowledge retrieval points:
  - Knowledge Router (`visualize` endpoint) - reinforces newly created/updated nodes
  - Knowledge Tool (`executeQuery`) - tracks access to retrieved nodes
  - RAG Retrieval (`retrieve`) - reinforces document nodes for retrieved chunks
  - Knowledge Engine (`retrieveContext`) - reinforces document nodes in both hybrid and vector search paths
  - Graph Router (`runQuery`) - already implemented
- **Memory Decay Verification**: Confirmed fully implemented and working:
  - Decay worker (`processMemoryMaintenance`) runs periodically
  - Finds stale nodes, applies decay factor, respects confidence floor
  - Archives low-confidence nodes, cleans up old archived nodes
  - Tests verify all decay/pruning/cleanup paths
- **Active Recall Tests**: Added comprehensive tests:
  - `touchNodes()` boosts confidence correctly (0.05 increment, capped at 1.0)
  - `recordAccess()` updates access tracking (`accessCount`, `lastAccessedAt`)
  - Batch operations handle multiple nodes efficiently
  - Touched nodes excluded from decay candidates (recent `updated` timestamp)
- **Documentation**: Updated `docs/architecture/memory-system.md` with implementation status and integration points.

## Phase 7: Verification & Documentation (ALF-142)

**Status**: ✅ Complete (2025-01-27)

- **Supervisor → Cognitive Integration**: Verified supervisor interrupts trigger cognitive state transitions:
  - Added test verifying interrupt during `executing` state transitions to `reflecting` with `cancelled` outcome
  - Confirmed supervisor throws error which is handled by workflow runtime
  - Cognitive loop properly handles `interrupt` events via `applyTransition()`
- **Dreaming → Heuristic Injection**: Verified end-to-end flow:
  - `processDreaming()` creates `kind: "heuristic"` nodes from failed runs
  - `findHeuristics()` retrieves heuristics via full-text search
  - `buildCodexLearningContext()` injects heuristics into Codex prompts
  - Added integration tests for both creation and retrieval paths
- **Physiology Regulation**: Verified physiology affects autonomy:
  - High frustration (0.8+) reduces autonomy via 0.5x multiplier
  - High boredom (0.9+) reduces autonomy via 0.7x multiplier
  - Low energy (0.2) reduces autonomy via 0.8x multiplier
  - Multipliers applied after Bayesian update (post-update regulation)
  - Added comprehensive tests for all physiology scenarios
- **Documentation Updates**: Updated all architecture docs to reflect implementation status:
  - `docs/architecture/self-healing.md` - Marked Complete
  - `docs/execplans/brainstem-supervisor.md` - Verified Complete status
  - ALF-142 ticket updated with completion status
