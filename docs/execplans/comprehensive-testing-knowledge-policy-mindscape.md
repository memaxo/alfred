# Comprehensive Testing Plan: Knowledge, Policy, Mindscape

This plan outlines the manual and automated testing strategy for the recently implemented features.

## 1. Automated Integration Tests (Scripted)

### 1.1 Knowledge Extraction Pipeline
**Goal**: Verify that text input produces correctly structured Graph Nodes (Facts, Relations) using the new `compromise`/`chrono-node` logic.
**Script**: `scripts/test-knowledge-pipeline.ts`
**Steps**:
1.  Input a complex paragraph containing entities, dates, and causal links.
2.  Run `extract()`.
3.  Run `toKnowledge()`.
4.  Assert that the output contains expected `Knowledge` nodes with correct types and content.
5.  (Optional) Simulate DB insertion by printing the SQL/Schema structure.

### 1.2 Policy Enforcement (Obligations)
**Goal**: Verify that API routers correctly throw `PRECONDITION_FAILED` when obligations are unmet.
**Test File**: `packages/api/test/deploy.policy.test.ts`
**Steps**:
1.  Mock the TRPC context to include a policy obligation (e.g., `{ obligations: [{ type: "biometric", reason: "biometric_required" }] }`).
2.  Call `deployRouter.promote`.
3.  Expect `TRPCError` with code `PRECONDITION_FAILED` and `cause.obligations` matching the mock.
4.  Mock a context *without* obligations and verify success (or different error if upstream fails).

## 2. Manual/UI Verification (Mindscape)

### 2.1 Mindscape Concept Node
**Goal**: Verify `ConceptNode` renders correctly and Command Palette works.
**Steps**:
1.  Run `bun --filter @alfred/web dev`.
2.  Open `http://localhost:3000/mindscape`.
3.  Press `Cmd+K`.
4.  Select "Visualize Concept".
5.  **Expected**: A new node appears with the "Concept" icon/label.
6.  **Action**: Click/Drag the node.
    *   **Expected**: It moves and stays selected.
7.  **Action**: Refresh the page.
    *   **Expected**: The node persists in its position.

### 2.2 Knowledge Visualization (Future/Mock)
**Goal**: Verify we can spawn nodes representing RAG/Knowledge data.
**Steps**:
1.  Use the URL hack: `http://localhost:3000/mindscape?spawn=knowledge&nodeId=test-know-1`.
2.  **Expected**: A KnowledgeNode spawns (if the type mapping allows).
    *   *Note*: `spawn.ts` was updated to support `concept`.
3.  Use URL `http://localhost:3000/mindscape?spawn=concept`.
4.  **Expected**: A ConceptNode spawns.

## 3. Execution

I will implement the automated tests now.

1.  Create `scripts/test-knowledge-pipeline.ts`.
2.  Create `packages/api/test/deploy.policy.test.ts`.
3.  Run both and report results.
