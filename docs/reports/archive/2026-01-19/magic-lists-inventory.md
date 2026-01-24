# Magic Lists Inventory

**Status**: Investigation Complete  
**Date**: 2025-01-27  
**Purpose**: Identify brittle heuristic word lists and propose better strategies

## Executive Summary

Found **9 distinct magic list patterns** across the codebase. These hardcoded word arrays are brittle, language-specific, and fail on edge cases. They should be replaced with semantic/structural approaches.

## Magic Lists Found

### 1. Risk Assessment Keywords

**Location**: `packages/cognitive/src/logic/autonomy.ts:7-8`

```typescript
const highRiskKeywords = ["delete", "remove", "destroy", "purchase", "pay"];
const mediumRiskKeywords = ["update", "modify", "change", "send", "email"];
```

**Problem**:

- Misses synonyms ("erase", "terminate", "buy")
- False positives ("delete" in "delete this file" vs "delete this comment")
- No context awareness

**Usage**: Risk assessment for autonomy gating

---

### 2. Preference Inference Hints

**Location**: `packages/agent/src/preference/inference.ts:14-33`

```typescript
const VERBOSITY_HINTS: Record<ResponseVerbosity, string[]> = {
  minimal: ["one sentence", "single sentence", "shortest", "tiny"],
  concise: ["concise", "brief", "short", "too verbose", "trim down"],
  detailed: ["more detail", "expand", "elaborate", "add detail"],
  verbose: ["exhaustive", "comprehensive", "long form", "write a lot"],
};

const TONE_HINTS: Record<ResponseTone, string[]> = {
  formal: ["formal", "professional", "business"],
  casual: ["casual", "relaxed", "friendly"],
  technical: ["technical", "low-level", "use jargon"],
  friendly: ["friendly", "warm", "approachable"],
};

const FORMAT_HINTS: Record<ResponseFormat, string[]> = {
  bullet: ["bullet", "list", "- "],
  paragraph: ["paragraph", "full sentence"],
  structured: ["section", "heading", "outline"],
  narrative: ["story", "narrative", "flowing"],
};
```

**Problem**:

- Limited vocabulary coverage
- No semantic understanding
- Brittle substring matching

**Usage**: Inferring user preferences from conversation history

---

### 3. Tone Detection Regex Patterns

**Location**: `packages/agent/src/preference/inference.ts:40-45`

```typescript
const toneHeuristics = {
  formal: /\b(regards|sincerely|therefore|henceforth)\b/i,
  casual: /\b(hey|yo|gonna|wanna|lol)\b/i,
  technical: /\b(cpu|api|latency|throughput|kernel|schema)\b/i,
  friendly: /!|\bemojis?\b/i,
};
```

**Problem**:

- Extremely limited word coverage
- Regex patterns are brittle
- No context awareness

**Usage**: Detecting tone from text

---

### 4. Causal Markers

**Location**: `packages/knowledge/src/extractor.ts:37-48`

```typescript
const CAUSAL_MARKERS = [
  "because",
  "therefore",
  "thus",
  "hence",
  "as a result",
  "due to",
  "owing to",
  "leads to",
  "causes",
  "results in",
] as const;
```

**Problem**:

- Misses implicit causality
- No semantic understanding of causal relationships
- Language-specific

**Usage**: Extracting causal relationships from text

---

### 5. Confidence Modifiers

**Location**: `packages/knowledge/src/extractor.ts:51-58`

```typescript
const CONFIDENCE_MODIFIERS = {
  certain: 0.95,
  likely: 0.8,
  probable: 0.7,
  possible: 0.5,
  uncertain: 0.3,
  unlikely: 0.2,
} as const;
```

**Problem**:

- Hardcoded confidence values
- No context-dependent confidence
- Limited vocabulary

**Usage**: Determining fact extraction confidence

---

### 6. Decision Markers

**Location**: `packages/knowledge/src/extractor.ts:495-502`

```typescript
const DECISION_MARKERS = [
  "considering",
  "choosing",
  "selecting",
  "opting for",
  "decided to",
  "will",
] as const;
```

**Problem**:

- "will" is too generic (false positives)
- Misses implicit decisions
- No semantic understanding

**Usage**: Extracting decision reasoning from codex traces

---

### 7. Alternative Markers

**Location**: `packages/knowledge/src/extractor.ts:520-526`

```typescript
const ALTERNATIVE_MARKERS = [
  "however",
  "alternatively",
  "instead",
  "but",
  "though",
] as const;
```

**Problem**:

- "but" and "though" are too generic
- Misses implicit alternatives
- No semantic understanding

**Usage**: Extracting alternative reasoning from codex traces

---

### 8. Negation Words

**Location**: `packages/knowledge/src/extractor.ts:337`

```typescript
const negations = ["not", "no", "never", "none", "neither"];
```

**Problem**:

- Incomplete list (misses "nobody", "nothing", "nowhere", etc.)
- No semantic negation understanding
- Language-specific

**Usage**: Contradiction detection

---

### 9. Stop Words

**Location**: `packages/knowledge/src/query.ts:758-783`

```typescript
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "that",
  "the",
  "to",
  "was",
  "will",
  "with",
]);
```

**Problem**:

- Incomplete list (only 24 words, standard lists have 100+)
- No domain-specific stop words
- Hardcoded English-only

**Usage**: Filtering common words from semantic queries

---

## Impact Assessment

### High Impact (User-Facing)

1. **Risk Assessment Keywords** - Affects autonomy gating, security decisions
2. **Preference Inference Hints** - Affects user experience, response quality
3. **Tone Detection** - Affects response personalization

### Medium Impact (Internal Logic)

4. **Causal Markers** - Affects knowledge extraction quality
5. **Decision/Alternative Markers** - Affects reasoning trace extraction
6. **Stop Words** - Affects query quality

### Low Impact (Edge Cases)

7. **Confidence Modifiers** - Has fallback defaults
8. **Negation Words** - Used in contradiction detection (rare)

---

## Recommended Strategies

### Strategy 1: Semantic Embeddings (Preferred)

**For**: Preference inference, tone detection, risk assessment

**Approach**:

- Use `@alfred/embed` to generate embeddings for user text
- Compare against learned embeddings of preference examples
- Use cosine similarity instead of keyword matching

**Benefits**:

- Handles synonyms and paraphrasing
- Language-agnostic (with multilingual embeddings)
- Learns from user behavior

**Implementation**:

- Create `packages/agent/src/preference/semantic.ts`
- Replace keyword matching with embedding similarity
- Cache preference embeddings in memory

---

### Strategy 2: Graph-Based Classification (Emergent)

**For**: Domain detection, risk assessment, causal relationships

**Approach**:

- Use knowledge graph topology instead of keyword lists
- Seed graph with anchor concepts (e.g., `Concept:HighRisk`, `Concept:Coding`)
- Classify by proximity to anchors in graph

**Benefits**:

- Self-improving (graph grows over time)
- Context-aware (considers relationships)
- No hardcoded lists

**Implementation**:

- Follow `docs/execplans/holonic-architecture-phase-2.md`
- Replace keyword matching with graph traversal
- Use `findNearestConcept()` from `packages/db/src/repo/graph/traverse.ts`

---

### Strategy 3: Learned Patterns (ML-Based)

**For**: Causal markers, decision markers, negation

**Approach**:

- Train small classifiers on labeled examples
- Use compromise.js for syntactic patterns
- Combine with semantic embeddings

**Benefits**:

- Learns from data
- Handles edge cases
- Improves over time

**Implementation**:

- Create `packages/knowledge/src/patterns/` module
- Use compromise.js for syntactic extraction
- Add semantic embeddings for disambiguation

---

### Strategy 4: Hybrid Approach (Pragmatic)

**For**: Stop words, confidence modifiers

**Approach**:

- Keep minimal lists as fallback
- Add semantic filtering layer
- Use TF-IDF for domain-specific stop words

**Benefits**:

- Fast fallback for common cases
- Semantic layer handles edge cases
- Domain-aware filtering

**Implementation**:

- Expand `STOP_WORDS` to standard English list (100+ words)
- Add semantic filtering for domain-specific terms
- Use TF-IDF to identify domain stop words dynamically

---

## Migration Priority

### Phase 1: High-Impact Replacements (Q1)

1. **Preference Inference** → Semantic embeddings
2. **Risk Assessment** → Graph-based classification
3. **Tone Detection** → Semantic embeddings

### Phase 2: Medium-Impact Improvements (Q2)

4. **Causal Markers** → Learned patterns + embeddings
5. **Decision/Alternative Markers** → Syntactic patterns + embeddings
6. **Stop Words** → Expanded list + TF-IDF filtering

### Phase 3: Low-Impact Cleanup (Q3)

7. **Confidence Modifiers** → Context-dependent confidence
8. **Negation Words** → Syntactic negation detection

---

## Success Metrics

- **Coverage**: Handle 95%+ of user inputs without false negatives
- **Precision**: <5% false positive rate
- **Performance**: <10ms overhead for semantic approaches
- **Maintenance**: Zero manual list updates required

---

## Next Steps

1. Create ExecPlan for semantic preference inference
2. Implement graph-based risk assessment
3. Expand stop words list as interim solution
4. Add telemetry to measure magic list failure rates
