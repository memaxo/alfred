# ExecPlan: Emergent Behavior Hardening

**Status**: Proposed
**Owner**: Cognition Team
**Date**: 2025-11-22

## Purpose

Following the successful implementation of Vector-Native Entity Linking and Mindscape Visualization, this plan outlines the steps to harden the system through rigorous testing, architectural refactoring, and documentation updates. The goal is to ensure the system is robust, maintainable, and well-understood.

## Plan

### 1. Expand Test Coverage

Enhance the `emergent-behavior.test.ts` suite to cover edge cases and failure modes.

- **Task 1.1: Ambiguous Inputs**
  - **What**: Test inputs that could map to multiple domains (e.g., "Encryption" -> "Security" AND "Coding").
  - **Why**: Verify that the system can handle and prioritize multiple relevant domains.
  - **Expected**: `analyzeContext` returns multiple domains or prioritizes the strongest match.

- **Task 1.2: Graph Depth Limits**
  - **What**: Create a test scenario with a deep graph (depth > 3) and verify traversal stops at `maxDepth`.
  - **Why**: Prevent performance degradation from unbounded graph traversals.
  - **Expected**: Concepts beyond `maxDepth` are not detected.

- **Task 1.3: Fallback Behavior**
  - **What**: Mock `embedMany` to throw an error or return empty/invalid embeddings.
  - **Why**: Ensure the system degrades gracefully to text-based matching when the embedding service is unavailable.
  - **Expected**: Entity linking still works (via string match) or fails safely without crashing the agent.

### 2. Automate Test Execution

Ensure the new tests run automatically in CI.

- **Task 2.1: CI Integration**
  - **What**: Verify `packages/agent/test/emergent-behavior.test.ts` is included in the `bun test` globs.
  - **Why**: prevent regressions.
  - **Action**: Check `package.json` scripts and CI workflows. If necessary, add a specific step or update patterns.

### 3. Refactor Adapter Logic

Clean up `packages/agent/src/assistant/src/adapter.ts` by extracting concerns.

- **Task 3.1: Extract Entity Linker**
  - **What**: Move the logic for embedding generation + graph querying into `packages/agent/src/services/entity-linker.ts` (or similar).
  - **Why**: `adapter.ts` is becoming a "god object". Entity linking is a generic capability useful for other agents (e.g., Orchestrator).
  - **Interface**: `class EntityLinker { link(text: string): Promise<LinkedEntity[]> }`

### 4. Mindscape UI Polish

Refine the frontend visualization.

- **Task 4.1: Path Visualization Robustness**
  - **What**: Ensure `use-chat-logic.ts` and `MindscapeStore` handle complex path data (e.g., multiple disjoint paths, overlapping paths).
  - **Why**: Prevent visual glitches when the AI "thinks" about multiple unrelated concepts.

### 5. Documentation

Update architectural documentation to reflect the new reality.

- **Task 5.1: Update Architecture Docs**
  - **What**: Update `docs/architecture/cognitive-architecture.md` (or create if missing).
  - **Content**:
    - Explain the "Vector-Graph Hybrid" approach.
    - Document the `memory_nodes.embedding` column and HNSW index.
    - Describe the "Emergent Behavior" flow: Input -> Embed -> Graph Search -> Persona/Context.

## Success Criteria

- [ ] `emergent-behavior.test.ts` includes ambiguous, depth, and fallback test cases.
- [ ] Tests pass reliably in CI.
- [ ] `adapter.ts` is simplified, with core logic moved to a reusable service.
- [ ] Documentation accurately describes the vector-native entity linking architecture.
