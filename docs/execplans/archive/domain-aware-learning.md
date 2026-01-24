# Domain-Aware Learning & Prioritization

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will upgrade ALFRED's background learning system to be **domain-aware**, specifically optimizing for the user's interests: **Coding, AI, Politics, News, Social Media, Music, Movies, and Cybersecurity**.

The goal is to prioritize and retain high-value information in these domains (especially Coding) while filtering out noise. This transforms the learning process from a flat "recency-based" loop into a targeted "interest-based" curation engine.

## Progress

- [x] **Domain Detection Logic** ✅
  - [x] Updated `packages/knowledge/src/lexicon/domains.ts` with taxonomy of keywords for target domains (Coding, AI, Security, Politics, News, SocialMedia, Music, Movies).
  - [x] Implemented `detectTopics(text): TopicResult` to classify input and detect code presence.
  - [x] Special handling for **Coding**: Detects code blocks (triple backticks), inline code, and common patterns (import/export, function declarations, npm/bun commands, etc.).
  - [x] Added `node`, `bun`, `deno` to DEV_TOOLS for runtime detection.
  - [x] Improved keyword matching with word boundary awareness to prevent false positives.
- [x] **Prioritized Extraction** ✅
  - [x] Modified `extract()` to detect topics and return `topics`, `hasCodeBlock`, `primaryDomain` alongside facts.
  - [x] Implemented `applyTopicBoost()` for domain-based confidence boosting (Coding: 1.2x, AI: 1.15x, etc.).
  - [x] Extra boost (1.1x) for text containing code blocks, capped at 1.5x total.
- [x] **Learning Worker Enhancements** ✅
  - [x] Updated `packages/agent/src/orchestrator/learning-worker.ts` to persist topic metadata.
  - [x] Node properties now include `topics`, `primaryDomain`, `hasCodeBlock` for domain-aware retrieval.
- [x] **Testing** ✅
  - [x] Created `packages/knowledge/src/__tests__/extractor.domain.test.ts` with 21 tests covering:
    - Topic detection for all 8 domains
    - Code block and pattern detection
    - Confidence boosting mechanics
    - Integration with extract() function

## Surprises & Discoveries

- **Word boundary matching required**: Initial substring matching caused false positives (e.g., "sunny" matching "nn" for neural network). Fixed by implementing word boundary awareness for short keywords (≤2 chars).
- **DEV_TOOLS missing runtimes**: `bun`, `node`, `deno` were not in the DEV_TOOLS array, preventing detection of common JavaScript runtime mentions. Added them as a separate "Runtimes" category.
- **Code pattern detection more effective than keyword matching**: Regex patterns for detecting code (import statements, function declarations, npm/bun commands) proved more reliable than keyword matching for Coding domain detection.
- **ExtractionResult needed topic fields**: The existing type didn't have topic-related fields, requiring updates to `extract/types.ts` and the `extract()` function to thread topic data through.

## Decision Log

- **Strategy**: We are using a "Boosting" strategy. We don't strictly _ignore_ non-domain info (to avoid missing unexpected important things), but we heavily **boost** the confidence and retention of domain-aligned facts. This ensures the Graph becomes dense in the areas the user cares about.

## Outcomes & Retrospective

**Status: Complete ✅**

### Implementation Summary

1. **Domain taxonomy expanded**: Added SocialMedia, Music, Movies domains to complete the 8 target interest areas.
2. **Topic detection implemented**: `detectTopics()` function detects domains via keyword matching and code patterns, returning topics, primary domain, code block detection, and confidence boost.
3. **Confidence boosting active**: Domain-aligned facts receive confidence boosts (Coding: 1.2x, AI: 1.15x, Security: 1.1x) to prioritize retention.
4. **Learning worker enhanced**: Topic metadata (`topics`, `primaryDomain`, `hasCodeBlock`) persisted in graph node properties for future retrieval filtering.
5. **Full test coverage**: 21 new tests validate topic detection, confidence boosting, and integration with extraction.

### Files Modified

- `packages/knowledge/src/lexicon/domains.ts` - Added domains, detectTopics(), applyTopicBoost()
- `packages/knowledge/src/lexicon/code.ts` - Added bun/node/deno to DEV_TOOLS
- `packages/knowledge/src/lexicon/index.ts` - Exported new functions and types
- `packages/knowledge/src/extract/types.ts` - Added topics fields to ExtractionResult
- `packages/knowledge/src/extract/facts.ts` - Integrated topic detection and boosting
- `packages/agent/src/orchestrator/learning-worker.ts` - Persist topic metadata
- `packages/knowledge/test/extractor.test.ts` - Fixed classifyDomain test assertions

### Future Considerations

- Interest filter (down-weighting off-topic content) not yet implemented but structure supports it via topic metadata
- Graph queries can now filter by `properties.topics` or `properties.primaryDomain` for domain-aware retrieval

## Context and Orientation

- **Current State**: `learning-worker.ts` polls all completed runs. `extractor.ts` uses `compromise` for generic NER.
- **Target State**: `extractor.ts` understands "Python" is "Coding" and boosts it. `learning-worker.ts` saves these facts with `topics: ['coding']` and high confidence.

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

- **Expect**: Topic: `coding`, Confidence: `High`, Entity: `Bun`, `Node`.

## Concrete Steps

1.  Create `packages/knowledge/src/taxonomy.ts`.
2.  Modify `packages/knowledge/src/extractor.ts` to use it.
3.  Update `packages/agent/src/orchestrator/learning-worker.ts` to persist topic metadata.
4.  Add unit tests.
