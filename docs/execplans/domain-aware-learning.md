# Domain-Aware Learning & Prioritization

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will upgrade ALFRED's background learning system to be **domain-aware**, specifically optimizing for the user's interests: **Coding, AI, Politics, News, Social Media, Music, Movies, and Cybersecurity**.

The goal is to prioritize and retain high-value information in these domains (especially Coding) while filtering out noise. This transforms the learning process from a flat "recency-based" loop into a targeted "interest-based" curation engine.

## Progress

- [ ] **Domain Detection Logic**
    - [ ] Update `packages/knowledge/src/extractor.ts` with a taxonomy of keywords for target domains.
    - [ ] Implement `detectTopics(text): string[]` to classify input.
    - [ ] Special handling for **Coding**: Detect code blocks (` ``` `) and common language/framework keywords (TypeScript, React, Bun, etc.).
- [ ] **Prioritized Extraction**
    - [ ] Modify `extract()` to return `topics` alongside facts.
    - [ ] Adjust `confidence` scoring based on domain relevance (Coding = High Boost).
- [ ] **Learning Worker Enhancements**
    - [ ] Update `packages/agent/src/orchestrator/learning-worker.ts`.
    - [ ] Implement "Interest Filter": If a conversation is off-topic and lacks personal context, down-weight or discard it.
    - [ ] Store `topics` in the Knowledge Graph node `properties` for better retrieval.
- [ ] **Testing**
    - [ ] Create `packages/knowledge/src/__tests__/extractor.domain.test.ts` to verify topic detection and boosting.

## Surprises & Discoveries

*(Populate during execution)*

## Decision Log

- **Strategy**: We are using a "Boosting" strategy. We don't strictly *ignore* non-domain info (to avoid missing unexpected important things), but we heavily **boost** the confidence and retention of domain-aligned facts. This ensures the Graph becomes dense in the areas the user cares about.

## Outcomes & Retrospective

*(Populate during execution)*

## Context and Orientation

-   **Current State**: `learning-worker.ts` polls all completed runs. `extractor.ts` uses `compromise` for generic NER.
-   **Target State**: `extractor.ts` understands "Python" is "Coding" and boosts it. `learning-worker.ts` saves these facts with `topics: ['coding']` and high confidence.

## Plan of Work

### 1. Taxonomy Definition (`packages/knowledge/src/taxonomy.ts`)
Create a lightweight, extensible mapping of keywords to domains.
```typescript
export const DOMAINS = {
  coding: ["typescript", "python", "rust", "react", "code", "function", "api", "deploy", ...],
  ai: ["llm", "transformer", "model", "inference", "rag", ...],
  cybersecurity: ["exploit", "vulnerability", "cve", "firewall", ...],
  // ... others
}
```

### 2. Enhanced Extractor (`packages/knowledge/src/extractor.ts`)
Import the taxonomy.
Add `detectTopics` function.
Modify `extract` to:
1.  Run topic detection.
2.  If `coding`, boost confidence by `1.2x` (capped at 1.0).
3.  If `code_block` detected, treat as high-value pattern/fact.

### 3. Learning Worker Update (`packages/agent/src/orchestrator/learning-worker.ts`)
Update the `upsertNodes` call to include `topics` in the `properties` JSONB column. This allows future graph queries to filter by topic (e.g., "Show me everything I learned about Coding").

### 4. Verification
Run a test case with: "I prefer using Bun over Node for my servers."
*   **Expect**: Topic: `coding`, Confidence: `High`, Entity: `Bun`, `Node`.

## Concrete Steps

1.  Create `packages/knowledge/src/taxonomy.ts`.
2.  Modify `packages/knowledge/src/extractor.ts` to use it.
3.  Update `packages/agent/src/orchestrator/learning-worker.ts` to persist topic metadata.
4.  Add unit tests.
