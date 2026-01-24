# ExecPlan: GraphRAG Reranking & Mindscape Traversal

## Purpose

To finalize the Graph-Enhanced Retrieval (GraphRAG) system by enabling production-grade reranking and to complete the "Mindscape" infinite canvas experience by implementing dynamic graph traversal and verifying visual states. This plan builds upon the recent architecture fixes (circular deps, boost concepts) to deliver a robust, interactive knowledge system.

## Plan

### Phase 1: Production Reranking

Enable and verify the reranking fusion logic in `KnowledgeEngine`.

- [ ] **Test Reranking Integration**: Create `scripts/verify-rerank.ts` to test `KnowledgeEngine.retrieveContext` with `useReranking: true` against a mock reranker (or real if available).
- [ ] **Optimize Fusion Weights**: Verify if the 0.7 (Hybrid) / 0.3 (Rerank) split is optimal for our data distribution.
- [ ] **Error Handling**: Ensure reranking failures (e.g., model timeout) gracefully fallback to hybrid search results without crashing the request.

### Phase 2: Mindscape Traversal & Interaction

Make the Mindscape graph navigable and interactive.

- [ ] **Implement Expansion**: Wire up node clicks in `MindscapeCanvas` to trigger `graphRepo.getNeighbors`.
- [ ] **Dynamic Hydration**: Ensure fetched neighbors are merged into the Zustand store (`useMindscapeStore`) without resetting the layout.
- [ ] **Traversal UX**: Add visual cues (loading spinners on nodes) when fetching neighbors.

### Phase 3: Visual Verification (Living Edge)

Ensure the new bioluminescent aesthetic is robust.

- [ ] **Preview Route**: Create `apps/web/src/routes/dev/edges.tsx` to showcase `LivingEdge` in various states:
  - Idle (Dim)
  - Active (Bioluminescent Pulse)
  - RAG Highlight (Emerald Flow)
  - Error/Disconnected (Red/Faint)
- [ ] **Performance**: Profile edge animation performance with 100+ edges to ensure 60fps.

### Phase 4: Workflow Resilience (PlanRunner)

Improve workflow reliability.

- [ ] **Suspend Pattern**: Modify `PlanRunner.executeStep` to support a `Suspended` return state.
- [ ] **Resumption UI**: Ensure the UI can display a "Waiting for Approval" state for suspended workflows.
- [ ] **Checkpointing**: Verify that `cognitiveRepo.saveSnapshot` correctly captures the suspended state.

## Progress

- [x] **GraphRAG Boosting**: Fixed `boostConcepts` SQL generation and verified with `scripts/verify-graph-rag.ts`.
- [x] **Architecture Cleanup**: Resolved circular dependencies in `db` and `rag` packages.
- [x] **Living Edge Component**: Implemented `LivingEdge` with bioluminescent styling support.
- [ ] Phase 1 (Reranking) - Pending
- [ ] Phase 2 (Mindscape) - Pending
- [ ] Phase 3 (Visuals) - Pending
- [ ] Phase 4 (Resilience) - Pending

## Surprises & Discoveries

- **Discovery**: The `ragRepo` circular dependency was masking test isolation issues. Breaking the cycle improved test stability significantly.
- **Discovery**: Drizzle's `sql` template tag requires careful handling of dynamic `tsquery` strings to avoid syntax errors.

## Decision Log

- **Decision**: Move reranking logic _out_ of `db/repo/rag.ts` into `KnowledgeEngine`.
  - _Reason_: Repositories should be pure data access; complex ML orchestration belongs in the engine layer.
- **Decision**: Use `plainto_tsquery` for boost concepts.
  - _Reason_: Prevents SQL injection/syntax errors from user-generated concept strings (e.g., "C++" vs "C++ 20").

## Outcomes & Retrospective

_(To be filled upon completion)_
