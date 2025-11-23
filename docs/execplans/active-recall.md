# ExecPlan: Active Recall (Memory Reinforcement)

## Purpose
Implement "Active Recall" to strengthen memory nodes when they are successfully retrieved and utilized. This counters the forgetting curve: memories that are useful stay fresh and high-confidence, while unused ones decay.

## Plan

### 1. Touch Mechanism
- [ ] **Repository Update**: Add `touchNodes(nodeIds: string[])` to `packages/db/src/repo/graph.ts`.
    - This function should set `updated_at = NOW()` and increment `confidence` by a small factor (e.g., +0.05, capped at 1.0).
    - Use a batched update query for performance.

### 2. Retrieval Integration
- [ ] **Graph Router**: Update `packages/api/src/routers/graph.ts` in the `runQuery` procedure.
    - When `input.kind === "semantic"` or "traverse" returns nodes, queue them for a "touch" operation.
    - **Optimization**: Do not await the touch operation (fire-and-forget) to avoid latency on the read path.

### 3. RAG Integration
- [ ] **RAG Retrieval**: Update `packages/rag/src/doc.ts` -> `retrieve`.
    - When chunks are retrieved, identify their source memory nodes (if mapped).
    - Queue these nodes for reinforcement.

### 4. Feedback Loop (Optional/Advanced)
- [ ] **Outcome-Based Reinforcement**: Only reinforce if the user provides positive feedback or the workflow succeeds. (For MVP, we will reinforce on *retrieval*, assuming relevance).

## Progress
- [ ] Touch Mechanism
- [ ] Retrieval Integration
- [ ] RAG Integration

## Surprises & Discoveries
*(To be filled during execution)*

## Decision Log
*(To be filled during execution)*

## Outcomes & Retrospective
*(To be filled upon completion)*
