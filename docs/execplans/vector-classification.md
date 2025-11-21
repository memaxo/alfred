# Vector Classification Implementation Plan

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will upgrade the domain detection system from pure keyword matching to **Semantic Vector Classification**. This enables ALFRED to detect user interests (Coding, Cybersecurity, etc.) even when they use slang, synonyms, or phrasing not explicitly listed in the keyword taxonomy.

This leverages the existing `@alfred/embed` local model, adding intelligence without adding new infrastructure.

## Progress

- [ ] **Initialization**
    - [ ] Update `packages/knowledge/src/taxonomy.ts` to export domain *descriptions* suitable for embedding.
    - [ ] Create `packages/knowledge/src/classifier.ts` to handle vector operations (loading model, computing centroids).
- [ ] **Classification Logic**
    - [ ] Implement `classify(text): Promise<Domain[]>` using cosine similarity.
    - [ ] Cache domain centroids in memory to avoid re-embedding them on every call.
- [ ] **Integration**
    - [ ] Update `packages/knowledge/src/extractor.ts` to use `classifier.classify()` alongside (or instead of) `detectDomains()`.
    - [ ] Ensure `extractor.ts` functions become `async` where needed (since embedding is async).
- [ ] **Refactor Propagation**
    - [ ] `extract` is currently synchronous. We must refactor it to `extractAsync` or handle the async nature of embeddings.
    - [ ] Update `learning-worker.ts` to await the new extraction.
- [ ] **Testing**
    - [ ] Create `packages/knowledge/src/__tests__/classifier.test.ts`.
    - [ ] Verify "stack smashing" detects as "Cybersecurity" without keyword match.

## Surprises & Discoveries

*(Populate during execution)*

## Decision Log

- **Async Architecture**: `extract` was synchronous for performance. Vector operations are async. We will create `extractAsync` to avoid breaking existing synchronous callers (if any remain that strictly need sync), but eventually migrate `learning-worker` to the async version.

## Outcomes & Retrospective

*(Populate during execution)*

## Context and Orientation

-   **Embeddings**: We use `@alfred/embed` which provides `embed(text)`.
-   **Taxonomy**: `packages/knowledge/src/taxonomy.ts` currently holds keywords. We will add semantic descriptions.
-   **Worker**: `packages/agent/src/orchestrator/learning-worker.ts` is the primary consumer and is already async-compatible.

## Plan of Work

### 1. Define Descriptions
Enhance `DOMAINS` in `taxonomy.ts` with rich descriptions.
```typescript
export const DOMAINS = {
  cybersecurity: {
    description: "Hacking, network defense, vulnerabilities, exploits, penetration testing, and digital security.",
    keywords: [...]
  },
  // ...
}
```

### 2. Implement Classifier
Create a class that computes centroids on first use.
```typescript
// classifier.ts
export class VectorClassifier {
  private centroids: Map<Domain, number[]> = new Map();
  
  async init() {
    // embed all descriptions
  }
  
  async classify(text: string): Promise<Domain[]> {
    const vec = await embed(text);
    // compare with centroids
  }
}
```

### 3. Update Extractor
Refactor `extract` to support the async classifier. This is a breaking change for the signature, but safe since we control the callers.

### 4. Update Callers
Fix `learning-worker.ts` and tests to `await extract(...)`.

## Concrete Steps

1.  Edit `taxonomy.ts` to add descriptions.
2.  Create `classifier.ts`.
3.  Refactor `extractor.ts` to be async.
4.  Update `learning-worker.ts`.
5.  Test.
