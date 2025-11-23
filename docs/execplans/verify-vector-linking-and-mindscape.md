# ExecPlan: Verify Vector-Native Entity Linking and Mindscape Visualization

**Status**: Proposed
**Owner**: Cognition Team
**Date**: 2025-11-22

## Purpose

This plan outlines the verification and deployment steps for the recently implemented **Vector-Native Entity Linking** and **Live Mindscape Activation** features. These features hybridize vector similarity with graph topology to improve entity resolution and provide real-time visual feedback in the Mindscape UI.

## Plan

### 1. Database Migration

Apply the new schema changes to enable vector embeddings on `memory_nodes`.

- **Command**: `bun run db:migrate`
- **Expected Outcome**: Migration `0036_memory_nodes_embedding.sql` is applied successfully. The `memory_nodes` table gains an `embedding` column (vector(1024)) and an HNSW index.

### 2. Verify Embedding Service

Ensure the local embedding service is operational, as the adapter now relies on `embedMany` for entity linking.

- **Action**: Check `EMBEDDING_URL` in `.env` (should point to local service or mock).
- **Verification**: Run a simple script or curl command to confirm the embedding endpoint returns vectors of dimension 1024.
- **Fallback**: If the service is unavailable, the code should log a warning and fallback to text matching. Confirm this fallback behavior by temporarily unsetting the env var in a test run.

### 3. Monitor "Forgetting Curve" (Confidence Decay)

The learning worker now includes logic to decay node confidence over time and prune low-confidence nodes.

- **Action**: Tail logs for `learning_worker_maintenance`.
- **Metrics**:
  - `learning_worker_decayed`: Count of nodes with reduced confidence.
  - `learning_worker_pruned`: Count of nodes archived due to low confidence.
  - `learning_worker_cleanup`: Count of archived nodes permanently deleted.
- **Tuning**: If decay is too aggressive, adjust `decayFactor` (currently 0.95) or `decayThresholdMs` (24h) in `packages/agent/src/orchestrator/learning-worker.ts`.

### 4. E2E Verification (Mindscape)

Verify the end-to-end flow from user input to visual activation in Mindscape.

- **Scenario**:
  1. Open `/mindscape`.
  2. Send a message: "How do I optimize React performance?"
  3. **Observation**:
     - The "React" node (if it exists) should glow/pulse.
     - The path from "React" to "Coding" (Anchor) should animate.
     - The Assistant should respond with the "Coding" persona active.
- **Debugging**:
  - Check browser network tab for `x-mindscape-activation` header in the `/api/assistant` response.
  - Check server logs for `ADAPTER GRAPH QUERY ERROR` if visualization fails.

## Rollback Plan

If critical issues arise:

1.  **Revert Code**: Revert changes to `adapter.ts`, `stream-handler.ts`, and `use-chat-logic.ts`.
2.  **Revert Migration**: `bun run db:migrate:down` (if implemented) or manually drop the `embedding` column and index from `memory_nodes`.
3.  **Disable Features**: Set `ENABLE_VECTOR_LINKING=0` (if we add a flag) or rely on the `try/catch` blocks already in place to fail open.

## Success Criteria

- [ ] Database migration applied without error.
- [ ] `memory_nodes` are successfully populated with embeddings during learning.
- [ ] `findNearestConcept` returns accurate results using vector similarity.
- [ ] Mindscape UI visualizes activation paths during conversation.
- [ ] Stale nodes are correctly decayed and pruned over time.
