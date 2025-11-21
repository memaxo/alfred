# ExecPlan: Cognitive Architecture Maturity

**Owner:** Runtime/Cognitive
**Status:** Proposed

## Purpose
Mature the Cognitive Architecture from a passive "shadow" system into an active, autonomous decision-making engine. This plan addresses architectural blockers (dependency cycles), enables safety-gated autonomy, activates structured planning capabilities, and closes the learning loop via explicit feedback.

## Plan

### Phase 1: Dependency Cycle Resolution
Break the `runtime` ↔ `api` cycle to enable real AI generation within the cognitive loop.
- [ ] **Create Adapter Interface**: Define `AIGenerationAdapter` in `@alfred/type/runtime`.
- [ ] **Implement Adapter**: Create `packages/api/src/adapters/ai-generation.ts` wrapping `generateText` and `prepareModelMessages`.
- [ ] **Inject Adapter**:
    - Modify `runCognitiveLoop` to accept `aiAdapter` in context.
    - Update `packages/api/src/voice/assistant.ts` to pass the adapter implementation.
- [ ] **Remove Mocks**: Delete the mocked generation functions in `packages/runtime/src/loops/cognitive.ts`.

### Phase 2: Autonomy Gating
Implement safety checks before execution.
- [ ] **Risk Analysis**: Add a `assessRisk(plan: Plan): RiskLevel` helper in `@alfred/cognitive`.
- [ ] **Gating Logic**: Update `processEffects` in the runtime loop:
    - If `autonomy.level < risk.threshold`, transition to `deciding`.
    - If `deciding`, emit a "Confirmation Required" output event instead of executing.
- [ ] **Approval Handling**: Handle `approval` events in the loop to transition from `deciding` → `executing`.

### Phase 3: Structured Planning
Move beyond simple text responses to multi-step execution.
- [ ] **Plan Generation**: Update the `thinking` state transition to use `generateObject` (AI SDK v6) with the `ExecutionPlan` schema.
- [ ] **Plan Execution**: Implement the `executing` state handler in the runtime loop to iterate through `plan.steps`.
- [ ] **Step-by-Step Persistence**: Emit `step_complete` events after each action to maintain resume capability.

### Phase 4: Explicit Feedback
Close the learning loop.
- [ ] **Correction Detection**: Update `packages/api/src/voice/assistant.ts` to classify input intent.
    - If intent is "correction" (e.g., "No, I meant..."), emit `feedback` (negative) + `input` (correction).
- [ ] **UI Affordances**: Add Thumbs Up/Down actions to `apps/web/src/components/ui/chat-message.tsx` that call a new `api/cognitive/feedback` endpoint.
- [ ] **Autonomy Update**: Verify the `feedback` event handler correctly adjusts the `AutonomyGradient`.

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
- [ ] Phase 1: Dependency Cycle Resolution
- [ ] Phase 2: Autonomy Gating
- [ ] Phase 3: Structured Planning
- [ ] Phase 4: Explicit Feedback

## Decision Log
- **Dependency Injection**: Chosen over creating a new package to minimize structural churn. Passing the adapter via `RuntimeContext` or function arguments keeps `runtime` pure and `api` as the service layer.
- **AI SDK v6**: Strictly adhering to `generateObject` for planning to ensure type-safe, structured outputs.

## Outcomes & Retrospective
*Pending execution*
