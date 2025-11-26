# ExecPlan: Cognitive Runtime Loop & Voice Integration

**Owner:** Runtime/Cognitive
**Status:** Complete ✅

## Purpose
Activate the dormant Cognitive Architecture by implementing a persistent runtime event loop. This moves the system from stateless request/response interactions to a stateful, event-sourced cognitive model where the voice assistant feeds inputs into a continuous decision-making process.

## Plan

### Phase 1: Event Persistence (The Memory)
Establish the durable storage for the cognitive stream.
- [x] **Schema Definition**: Create `cognitive_events` and `cognitive_snapshots` tables in `@alfred/db` (migration `0038_cognitive_state.sql`, schema `packages/db/src/schema/cognitive.ts`).
    - ✅ `events`: Immutable log of inputs, signals, and outcomes.
    - ✅ `snapshots`: Periodic state checkpoints for fast hydration.
- [x] **Repository Layer**: Implement `@alfred/db/repo/cognitive` (`packages/db/src/repo/cognitive.ts`) for append-only event writing and state reconstruction.
    - ✅ `appendEvent`, `saveSnapshot`, `getLatestSnapshot`, `getAllEvents`, `findActivePlans`

### Phase 2: The Runtime Loop (The Brain)
Implement the orchestrator that drives state transitions.
- [x] **Cognitive Loop Implementation**: Create `packages/runtime/src/loops/cognitive.ts` (lines 40-85).
    - ✅ **Load**: Hydrate state from snapshots + recent events (`getAllEvents`, replay history).
    - ✅ **Step**: Apply pure transition function `(State, Event) -> State` (`applyTransition`).
    - ✅ **Effect**: Execute side effects (tools, queries) based on new state (`computeEffects`).
    - ✅ **Emit**: Persist resulting events (`appendEvent`).
- [x] **Autonomy Integration**: Connect the dormant `AutonomyGradient` logic to gate execution steps (lines 68-73, feedback handling).

### Phase 3: Voice Integration (The Senses)
Refactor the voice assistant to be an input source rather than a standalone handler.
- [x] **Input Adapter**: Modify `packages/api/src/voice/assistant.ts` (lines 173-195):
    - ✅ Emit `input` events to the Cognitive Loop (`runCognitiveLoop` called with `input` event).
    - ✅ Subscribe to the loop's output stream for responses (`handleVoiceCognitiveEffects`).
- [x] **Feedback Loop**: Wire user interruptions/corrections from voice as `feedback` events (via `cognitive.feedback` router).

### Phase 4: Verification
- [x] **Unit Tests**: Verify state hydration and transition correctness (`packages/runtime/test/cognitive-loop.test.ts`).
- [x] **Integration Tests**: Test the full `Voice Input -> Cognitive Process -> Action -> Voice Response` cycle (`packages/runtime/test/cognitive-loop.integration.test.ts`).

## Technical Design

### Event Sourcing Model
```typescript
// packages/db/src/schema/cognitive.ts
export const cognitiveEvents = pgTable("cognitive_events", {
  id: serial("id").primaryKey(),
  streamId: text("stream_id").notNull(), // e.g., "voice:session-123"
  type: text("type").notNull(), // "input", "timeout", "feedback", "complete"
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### The Loop Pattern
```typescript
// packages/runtime/src/loops/cognitive.ts
export async function runCognitiveLoop(streamId: string, event: Event) {
  let state = await repo.hydrate(streamId);
  
  // 1. Transition
  state = transition(state, event);
  await repo.saveSnapshot(streamId, state);

  // 2. Effect Interpretation
  if (state._ === 'thinking') {
    const plan = await planner.generate(state.context);
    await runCognitiveLoop(streamId, { _: 'plan_generated', plan });
  }
  // ... handle other states
}
```

## Progress
- [x] Phase 1: Event Persistence ✅
- [x] Phase 2: The Runtime Loop ✅
- [x] Phase 3: Voice Integration ✅
- [x] Phase 4: Verification ✅

## Decision Log
- **Event Sourcing**: Chosen to allow full deterministic replay of cognitive sessions and simpler debugging of complex state transitions.
- **On-Demand Loop**: The loop will likely be "stepped" by incoming events or internal async completions (via queues) rather than a `while(true)` busy wait, fitting the serverless-friendly architecture of the monorepo.

## Outcomes & Retrospective

**Status**: ✅ Complete

- Event sourcing model fully implemented with `cognitive_events` and `cognitive_snapshots` tables.
- `runCognitiveLoop` implements load/step/effect/emit pattern with state hydration and event persistence.
- Voice assistant integrated (`runAssistantForVoice` calls `runCognitiveLoop` with `input` events).
- Cognitive effects handled (`handleVoiceCognitiveEffects` processes `generate_response` effects).
- Comprehensive test coverage (unit + integration tests).
- Autonomy integration working (feedback events update autonomy gradient).
