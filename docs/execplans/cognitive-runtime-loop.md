# ExecPlan: Cognitive Runtime Loop & Voice Integration

**Owner:** Runtime/Cognitive
**Status:** Proposed

## Purpose
Activate the dormant Cognitive Architecture by implementing a persistent runtime event loop. This moves the system from stateless request/response interactions to a stateful, event-sourced cognitive model where the voice assistant feeds inputs into a continuous decision-making process.

## Plan

### Phase 1: Event Persistence (The Memory)
Establish the durable storage for the cognitive stream.
- [ ] **Schema Definition**: Create `cognitive_events` and `cognitive_snapshots` tables in `@alfred/db`.
    - `events`: Immutable log of inputs, signals, and outcomes.
    - `snapshots`: Periodic state checkpoints for fast hydration.
- [ ] **Repository Layer**: Implement `@alfred/db/repo/cognitive` for append-only event writing and state reconstruction.

### Phase 2: The Runtime Loop (The Brain)
Implement the orchestrator that drives state transitions.
- [ ] **Cognitive Loop Implementation**: Create `packages/runtime/src/loops/cognitive.ts`.
    - **Load**: Hydrate state from snapshots + recent events.
    - **Step**: Apply pure transition function `(State, Event) -> State`.
    - **Effect**: Execute side effects (tools, queries) based on new state.
    - **Emit**: Persist resulting events.
- [ ] **Autonomy Integration**: Connect the dormant `AutonomyGradient` logic to gate execution steps.

### Phase 3: Voice Integration (The Senses)
Refactor the voice assistant to be an input source rather than a standalone handler.
- [ ] **Input Adapter**: Modify `packages/api/src/voice/assistant.ts` to:
    - Emit `input` events to the Cognitive Loop instead of calling `generateText`.
    - Subscribe to the loop's output stream for responses.
- [ ] **Feedback Loop**: Wire user interruptions/corrections from voice as `feedback` events.

### Phase 4: Verification
- [ ] **Unit Tests**: Verify state hydration and transition correctness.
- [ ] **Integration Tests**: Test the full `Voice Input -> Cognitive Process -> Action -> Voice Response` cycle.

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
- [ ] Phase 1: Event Persistence
- [ ] Phase 2: The Runtime Loop
- [ ] Phase 3: Voice Integration
- [ ] Phase 4: Verification

## Decision Log
- **Event Sourcing**: Chosen to allow full deterministic replay of cognitive sessions and simpler debugging of complex state transitions.
- **On-Demand Loop**: The loop will likely be "stepped" by incoming events or internal async completions (via queues) rather than a `while(true)` busy wait, fitting the serverless-friendly architecture of the monorepo.

## Outcomes & Retrospective
*Pending execution*
