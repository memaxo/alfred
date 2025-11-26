# ExecPlan: Cognitive Physiology (Energy, Boredom, Frustration)

**Status**: ✅ Complete
**Goal**: Augment the Cognitive State with physiological metrics to regulate autonomy and strategy naturally.

## Core Concept
The `CognitiveState` is currently purely functional/logical. We add a "Physiology" layer that acts as a homeostatic regulator.
- **Energy**: Decreases with steps. Low energy = "Finish up" or "Ask for help".
- **Boredom**: Increases with low entropy/repetition. High boredom = "Try something new" (Temperature increase).
- **Frustration**: Increases with errors. High frustration = "Stop and Reflect" (Autonomy drop).

## Architecture

### 1. State Expansion
Update `packages/cognitive/src/state.ts`:
```typescript
type Physiology = {
  energy: number;      // 0..1, decays per step
  boredom: number;     // 0..1, spikes on low entropy
  frustration: number; // 0..1, spikes on tool failure
};
```

### 2. Homeostatic Updaters
Update `packages/cognitive/src/logic/update.ts` (or similar) to include decay/boost logic.
- `onStep`: energy -= 0.01
- `onSuccess`: frustration *= 0.5, energy += 0.1
- `onError`: frustration += 0.2, energy -= 0.05
- `onEntropyHigh`: boredom *= 0.8
- `onEntropyLow`: boredom += 0.3

### 3. Autonomy Regulation
The `AutonomyGradient` calculation must input `Physiology`.
- `Frustration > 0.7` -> **Force Autonomy Low** (Supervisor Check Required).
- `Boredom > 0.8` -> **Force Temperature High** (Creative Mode).
- `Energy < 0.2` -> **Force Consolidation** (Wrap up tasks).

## Implementation Steps

1.  ✅ **Type Definition**: Add `Physiology` to `CognitiveState` in `@alfred/cognitive` (`packages/cognitive/src/state.ts` lines 120-124).
2.  ✅ **Logic Implementation**: Implement `updatePhysiology(current, event)` pure function (`packages/cognitive/src/state.ts` lines 305-350).
3.  ✅ **Integration**: In `CognitiveEngine`, track physiology alongside state transitions (`packages/runtime/src/loops/cognitive.ts`).
4.  ✅ **Metrics**: Exposed via `cognitivePhysiologyGauge` Prometheus metrics.
5.  ✅ **Autonomy Regulation**: `meetsConstraints` uses physiology to block actions (`packages/cognitive/src/state.ts` lines 629-677).
6.  ✅ **Tests**: `packages/cognitive/test/physiology.test.ts` exists and passes.
7.  [ ] **UI Visualization**: Update the "Mindscape" or "Brain" UI to visualize these bars (Health/Mana style) - Pending.

## Benefits
- **Self-Healing**: High frustration naturally stops the agent from digging a deeper hole.
- **Emergent Behavior**: The agent "gets tired" and stops maximizing token usage endlessly.
- **Tunability**: We can tweak "patience" by adjusting frustration decay rates.

## Risks
- **Complexity**: Adds state variables that might be hard to debug.
- **Paralysis**: If frustration rises too fast, the agent might give up on difficult but solvable tasks.

## Verification
- **Test**: `packages/cognitive/test/physiology.test.ts`
- **Scenario**: Simulate 3 consecutive errors. Verify `Autonomy` drops below `High` threshold.
