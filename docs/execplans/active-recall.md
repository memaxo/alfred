# ExecPlan: Active Recall (Memory Reinforcement)

## Purpose

Implement "Active Recall" to strengthen memory nodes when they are successfully retrieved and utilized. This counters the forgetting curve: memories that are useful stay fresh and high-confidence, while unused ones decay.

## Plan

### 1. Touch Mechanism

- [x] **Repository Update**: Add `touchNodes(nodeIds: string[])` to `packages/db/src/repo/graph/write.ts` (lines 311-340).
  - ✅ Function sets `updated = NOW()` and increments `confidence` by `0.05` (capped at 1.0).
  - ✅ Uses batched update query for performance.

### 2. Retrieval Integration

- [x] **Graph Router**: Update `packages/api/src/routers/graph.ts` in the `runQuery` procedure (lines 435-448).
  - ✅ When query returns nodes, extracts `dbId` from node IDs.
  - ✅ **Fire-and-forget**: Uses `void touchNodes(...).catch(...)` to avoid latency on read path.

### 3. RAG Integration

- [x] **RAG Retrieval**: Update `packages/rag/src/doc.ts` -> `retrieve` (lines 176-202).
  - ✅ When chunks are retrieved, extracts `documentId` from metadata.
  - ✅ Calls `touchNodes` with document IDs (fire-and-forget).

### 4. Feedback Loop (Optional/Advanced)

- [ ] **Outcome-Based Reinforcement**: Only reinforce if the user provides positive feedback or the workflow succeeds. (For MVP, we reinforce on _retrieval_, assuming relevance).

## Progress

- [x] Touch Mechanism ✅
- [x] Retrieval Integration ✅
- [x] RAG Integration ✅

## Surprises & Discoveries

- Implementation uses fire-and-forget pattern (`void touchNodes(...).catch(...)`) to avoid latency on read path.
- Both graph queries and RAG retrieval trigger reinforcement.
- Confidence boost is `0.05` per retrieval, capped at `1.0`.
- `updated` timestamp reset prevents decay timer from expiring.

## Decision Log

- **Fire-and-forget**: Decided to use `void` pattern to avoid blocking read operations.
- **Confidence boost**: `0.05` per retrieval provides meaningful reinforcement without over-boosting.
- **Both paths**: Graph queries and RAG retrieval both trigger reinforcement for comprehensive coverage.

## Outcomes & Retrospective

**Status**: ✅ Complete (except outcome-based reinforcement)

- Core Active Recall mechanism fully implemented and integrated.
- Works seamlessly with both graph queries and RAG retrieval.
- Fire-and-forget pattern ensures zero latency impact on read operations.
- Outcome-based reinforcement (feedback-driven) remains optional/future enhancement.
