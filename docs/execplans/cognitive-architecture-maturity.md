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
