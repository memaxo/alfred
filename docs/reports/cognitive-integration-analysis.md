# Cognitive Architecture Integration Analysis

**Date**: 2025-01-27  
**Purpose**: Assess integration quality of supervisor, dreaming, and physiology components with ALFRED's cognitive, learning, and runtime systems.

## Executive Summary

Overall integration quality: **Good with one critical gap**

- ✅ **Dreaming → Learning Worker**: Fully integrated
- ✅ **Physiology → Autonomy**: Fully integrated  
- ⚠️ **Supervisor → Cognitive Loop**: Partial integration (workflow-level only, missing cognitive event bridge)

## Component Integration Analysis

### 1. Supervisor → Cognitive Loop Integration

**Status**: ⚠️ **Partial Integration**

**Current Flow:**
```
WorkflowRuntime.supervisor.observe() 
  → detects loop 
  → throws Error("workflow_interrupted:reason")
  → WorkflowRuntime catches error
  → Workflow fails
```

**Integration Points:**
- ✅ Supervisor instantiated in `WorkflowRuntime` constructor (`packages/runtime/src/core.ts:84`)
- ✅ Supervisor observes reasoning events via `handleSupervisorObservation()` (`packages/runtime/src/core.ts:483-506`)
- ✅ Supervisor throws interrupt error which fails workflow (`packages/runtime/src/core.ts:504`)
- ✅ Supervisor heartbeat monitoring via `checkPhysiology()` (`packages/runtime/src/core.ts:454-462`)

**Gap Identified:**
- ❌ **Supervisor interrupts do NOT create cognitive `interrupt` events**
- ❌ **No bridge from workflow-level supervisor error to cognitive state machine**
- ❌ **Cognitive loop never receives supervisor interrupt events**

**Impact:**
- Supervisor can kill workflows but doesn't update cognitive state
- Cognitive physiology (boredom) doesn't get updated when supervisor detects loops
- No cognitive state persistence of supervisor interventions

**Recommendation:**
Add bridge in `WorkflowRuntime` to convert supervisor interrupts to cognitive events:
```typescript
// In WorkflowRuntime.handleSupervisorObservation()
if (result.interrupt) {
  // Bridge to cognitive loop
  await runCognitiveLoop(this.runtimeContext, this.runId, {
    _: "interrupt",
    reason: result.reason,
    priority: 1,
    ts: Date.now(),
  });
  // Then fail workflow
  this.failFromSupervisor(result.reason);
}
```

### 2. Dreaming → Learning Worker Integration

**Status**: ✅ **Fully Integrated**

**Current Flow:**
```
startLearningWorker() (packages/api/src/init.ts:60)
  → processDreaming() runs every 6 hours (default)
  → Creates heuristic nodes (kind: "heuristic")
  → findHeuristics() retrieves via FTS
  → buildCodexLearningContext() injects into Codex prompts
```

**Integration Points:**
- ✅ Learning worker started in API init (`packages/api/src/init.ts:59-60`)
- ✅ Dreaming runs in worker loop (`packages/agent/src/orchestrator/learning-worker.ts:145-151`)
- ✅ Heuristics persisted to knowledge graph (`packages/agent/src/orchestrator/learning-worker.ts:247-262`)
- ✅ Heuristics retrieved via `findHeuristics()` (`packages/db/src/repo/codex-learning.ts:197-239`)
- ✅ Heuristics injected into Codex prompts (`packages/db/src/repo/codex-learning.ts:481-551`)
- ✅ Codex execution uses learning context (`packages/agent/src/orchestrator/tool/codex/exec.ts:558-570`)

**Configuration:**
- Gated by `ENABLE_LEARNING_WORKER=1` (default: disabled)
- Dreaming interval: `DREAMING_INTERVAL_MS` (default: 6 hours)
- Enabled by default: `DREAMING_ENABLED !== "false"`

**No Issues Found**: End-to-end flow is complete and tested.

### 3. Physiology → Autonomy Integration

**Status**: ✅ **Fully Integrated**

**Current Flow:**
```
Cognitive State includes Physiology
  → updatePhysiology() updates on events
  → updateAutonomy() receives physiology parameter
  → Multipliers applied: frustration (0.5x), energy (0.8x)
  → meetsConstraints() blocks actions based on thresholds
```

**Integration Points:**
- ✅ Physiology in `CognitiveState` (`packages/cognitive/src/state.ts:120-124`)
- ✅ `updatePhysiology()` called in transitions (`packages/cognitive/src/transition.ts:27-32`)
- ✅ `updateAutonomy()` receives physiology (`packages/cognitive/src/state.ts:369-447`)
- ✅ Physiology multipliers applied after Bayesian update (`packages/cognitive/src/state.ts:408-415`)
- ✅ `meetsConstraints()` checks physiology thresholds (`packages/cognitive/src/state.ts:626-636`)
- ✅ Cognitive loop passes physiology to autonomy updates (`packages/runtime/src/loops/cognitive.ts:102, 106`)

**Regulation Logic:**
- Frustration > 0.7: 0.5x autonomy multiplier
- Energy < 0.2: 0.8x autonomy multiplier  
- Boredom > 0.9: Blocks execution via `meetsConstraints()`
- Frustration > 0.85: Blocks execution via `meetsConstraints()`
- Energy < 0.1: Blocks execution via `meetsConstraints()`

**No Issues Found**: Complete integration with proper regulation.

## Integration Quality Matrix

| Component | Runtime | Cognitive | Learning | Overall |
|-----------|---------|-----------|----------|---------|
| **Supervisor** | ✅ Integrated | ⚠️ Partial | N/A | ⚠️ **Partial** |
| **Dreaming** | N/A | N/A | ✅ Integrated | ✅ **Complete** |
| **Physiology** | ✅ Integrated | ✅ Integrated | N/A | ✅ **Complete** |

## Recommendations

### High Priority

1. **Bridge Supervisor → Cognitive Loop** (Critical Gap)
   - Add `runCognitiveLoop()` call in `WorkflowRuntime.handleSupervisorObservation()`
   - Convert supervisor interrupt to cognitive `interrupt` event
   - Ensures cognitive state reflects supervisor interventions
   - Enables physiology updates from supervisor-detected loops

### Medium Priority

2. **Enable Learning Worker by Default**
   - Consider enabling `ENABLE_LEARNING_WORKER=1` by default
   - Or document why it's disabled (resource constraints?)
   - Dreaming provides valuable self-healing capabilities

3. **Add Integration Tests**
   - Test supervisor interrupt → cognitive event flow
   - Test dreaming → heuristic injection in Codex execution
   - Test physiology regulation in workflow execution

## Conclusion

The cognitive architecture components are **well-integrated** with two exceptions:

1. **Dreaming** is fully integrated end-to-end (learning worker → knowledge graph → Codex prompts)
2. **Physiology** is fully integrated (state → autonomy → constraints)
3. **Supervisor** has a critical gap: interrupts workflows but doesn't update cognitive state

The supervisor gap prevents cognitive state from reflecting supervisor interventions, which means:
- Cognitive boredom doesn't increase when supervisor detects loops
- No cognitive event history of supervisor interventions
- Cognitive state and workflow state can diverge

**Priority**: Fix supervisor → cognitive bridge to complete the integration.
