# LLM Logic Circuits Audit

**Purpose**: Replace naive heuristics throughout ALFRED with modular LLM calls ("LLMs as logic circuits"). LLM calls are cheap enough that we can use them strategically with light models, tight prompts, structured outputs, and context injection.

**Status**: Proposed

## Core Principle

Instead of pattern matching, regex, keyword lists, and embedding similarity thresholds, use small, focused LLM calls with:

- Light/fast models (Cerebras ~3000 tokens/sec)
- Tight, focused prompts
- Structured outputs (Zod schemas)
- Context injection (also via LLM assistance)

## Audit Results

### 1. Decision Extraction from Codex Reasoning

**Location**: `packages/knowledge/src/extract/reasoning.ts`

**Current Heuristic**:

- String matching against `DECISION_MARKERS` array: `["considering", "choosing", "selecting", "opting for", "decided to", "will"]`
- Simple `.includes()` checks on lowercase sentences
- Hardcoded confidence: 0.85

**Problem**: Misses nuanced decisions, false positives on casual language, no understanding of context.

**LLM Circuit Solution**:

```typescript
// Light LLM call with structured output
extractDecisions(reasoningText: string): Decision[] {
  // Use Cerebras or similar fast model
  // Prompt: "Extract explicit decisions made by the agent. Return structured decision objects."
  // Schema: { decision: string, rationale: string, alternatives: string[], confidence: number }
}
```

**Files**:

- `packages/knowledge/src/extract/reasoning.ts:22-44` - Decision markers
- `packages/knowledge/src/extract/reasoning.ts:47-68` - Alternative markers

---

### 2. Intent Classification

**Location**: `packages/plan/src/intent/classify.ts`

**Current Heuristic**:

- Regex patterns against lowercase description
- Categories: `fix`, `feat`, `refactor`, `test`, `docs`, `chore`
- First match wins

**Problem**: Brittle, misses compound intents, no nuance (e.g., "fix and refactor").

**LLM Circuit Solution**:

```typescript
classifyIntent(intent: WorkflowIntent): IntentCategory {
  // Fast LLM with structured output
  // Prompt: "Classify this workflow intent into categories. Can be multiple."
  // Schema: { primary: string, secondary?: string[], tags: string[] }
}
```

**Files**:

- `packages/plan/src/intent/classify.ts:6-29` - Regex classification

---

### 3. Decision Fact Derivation

**Location**: `packages/knowledge/src/reasoning/decisions.ts`

**Current Heuristic**:

- Embedding similarity to "decision" centroid
- Threshold: `MIN_SIMILARITY = 0.32`
- Sentence-level matching

**Problem**: Embedding similarity is noisy, threshold is arbitrary, misses implicit decisions.

**LLM Circuit Solution**:

```typescript
deriveDecisionFacts(text: string): KnowledgeEntry[] {
  // LLM extracts decisions with rationale
  // Prompt: "Identify decisions, choices, and commitments in this text."
  // Schema: { decision: string, context: string, confidence: number }
}
```

**Files**:

- `packages/knowledge/src/reasoning/decisions.ts:13-55` - Embedding-based decision extraction

---

### 4. Alternative Facts Extraction

**Location**: `packages/knowledge/src/reasoning/alternatives.ts`

**Current Heuristic**:

- Clause splitting via NLP library
- Embedding similarity to "alternative" centroid
- Threshold: `MIN_SIMILARITY = 0.28`

**Problem**: Clause splitting is syntactic, not semantic. Embedding similarity misses nuanced alternatives.

**LLM Circuit Solution**:

```typescript
deriveAlternativeFacts(text: string): KnowledgeEntry[] {
  // LLM identifies alternatives and trade-offs
  // Prompt: "Extract alternative options, trade-offs, and 'instead of' relationships."
  // Schema: { optionA: string, optionB: string, relationship: "alternative" | "tradeoff" | "replacement" }
}
```

**Files**:

- `packages/knowledge/src/reasoning/alternatives.ts:19-87` - Clause-based alternative extraction

---

### 5. Causal Relationship Extraction

**Location**: `packages/knowledge/src/reasoning/causality.ts`

**Current Heuristic**:

- Clause splitting, assumes adjacent clauses are cause-effect
- Embedding similarity to "causal" centroid
- Threshold: `MIN_SIMILARITY = 0.3`

**Problem**: Adjacent clauses ≠ causality. Misses implicit causal chains, temporal vs causal confusion.

**LLM Circuit Solution**:

```typescript
deriveCausalityFromText(text: string): KnowledgeEntry[] {
  // LLM extracts causal relationships with evidence
  // Prompt: "Identify cause-effect relationships. Distinguish from temporal sequences."
  // Schema: { cause: string, effect: string, evidence: string, type: "causal" | "temporal" | "correlation" }
}
```

**Files**:

- `packages/knowledge/src/reasoning/causality.ts:20-96` - Clause-based causality

---

### 6. Topic/Domain Classification

**Location**: `packages/knowledge/src/lexicon/domains.ts`

**Current Heuristic**:

- Keyword matching against `DOMAIN_KEYWORDS` dictionary
- Word boundary checks
- Score-based ranking

**Problem**: Keyword lists are incomplete, miss domain-specific jargon, no semantic understanding.

**LLM Circuit Solution**:

```typescript
classifyDomain(text: string): DomainResult[] {
  // Fast LLM for domain classification
  // Prompt: "Classify this text into domains: Coding, AI, Security, Politics, News, SocialMedia, Music, Movies."
  // Schema: { domains: string[], primary: string, confidence: number }
}
```

**Files**:

- `packages/knowledge/src/lexicon/domains.ts:447-480` - Static keyword classification
- `packages/knowledge/src/lexicon/domains.ts:724-757` - Topic detection wrapper

---

### 7. Pattern Structural Validation

**Location**: `packages/plan/src/pattern/match.ts`

**Current Heuristic**:

- Word count vs phase count comparison
- Hardcoded thresholds: `intentWordCount > 20 && phaseCount < 2` → reject
- `intentWordCount < 5 && phaseCount > 5` → reject

**Problem**: Word count ≠ complexity. Misses nuanced structural mismatches.

**LLM Circuit Solution**:

```typescript
validateStructural(patterns: Pattern[], intent: string): Pattern[] {
  // LLM validates structural fit
  // Prompt: "Does this workflow pattern structurally match the intent? Consider complexity, scope, dependencies."
  // Schema: { matches: boolean, reason: string, confidence: number }
}
```

**Files**:

- `packages/plan/src/pattern/match.ts:98-115` - Word count validation

---

### 8. Intent Splitting Detection

**Location**: `packages/plan/src/intent/split.ts`

**Current Heuristic**:

- String matching for conjunctions: `[" and ", " also ", " plus "]`
- Simple split on first match

**Problem**: Misses semantic splits, false positives on compound nouns ("frontend and backend").

**LLM Circuit Solution**:

```typescript
detectSplits(input: string): string[] {
  // LLM identifies if intent should be split
  // Prompt: "Does this intent contain multiple distinct requests? If so, split them."
  // Schema: { shouldSplit: boolean, parts: string[] }
}
```

**Files**:

- `packages/plan/src/intent/split.ts:4-12` - Conjunction-based splitting

---

### 9. Codex Event Extraction

**Location**: `packages/agent/src/orchestrator/tool/codex.ts`

**Current Heuristic**:

- Manual object property traversal (`item.text`, `item.content`, `item.output`)
- Type guards and null checks
- String concatenation for arrays

**Problem**: Brittle, breaks on schema changes, misses nested structures.

**LLM Circuit Solution**:

```typescript
extractAgentMessage(item: unknown): string | null {
  // LLM extracts message from unknown structure
  // Prompt: "Extract the agent's message text from this JSON structure."
  // Schema: { message: string | null }
}
```

**Files**:

- `packages/agent/src/orchestrator/tool/codex.ts:202-242` - Manual extraction
- `packages/agent/src/orchestrator/tool/codex.ts:244-258` - Aggregated output extraction

---

### 10. Path Classification (Backend/Frontend/Test)

**Location**: `packages/agent/src/orchestrator/multi/decompose.ts`

**Current Heuristic**:

- Path prefix matching (`/api/`, `/src/`, `/test/`)
- Hardcoded bucket rules

**Problem**: Misses non-standard structures, no semantic understanding of file purpose.

**LLM Circuit Solution**:

```typescript
classifyPath(path: string, fileContent?: string): Bucket {
  // LLM classifies file purpose
  // Prompt: "Classify this file path (and optionally content) as backend, frontend, test, or misc."
  // Schema: { bucket: "backend" | "frontend" | "test" | "misc", reason: string }
}
```

**Files**:

- `packages/agent/src/orchestrator/multi/decompose.ts:38-207` - Path-based classification

---

### 11. Sentence Confidence Computation

**Location**: `packages/knowledge/src/extract/facts.ts`

**Current Heuristic**:

- NLP library features (verb presence, sentence length, punctuation)
- Hardcoded confidence formula

**Problem**: Syntactic features ≠ semantic confidence. Misses context-dependent confidence.

**LLM Circuit Solution**:

```typescript
computeSentenceConfidence(sentence: string, context: string): number {
  // LLM assesses fact confidence
  // Prompt: "Rate the confidence (0-1) that this sentence contains a factual claim, given context."
  // Schema: { confidence: number, reason: string }
}
```

**Files**:

- `packages/knowledge/src/extract/facts.ts:39-70` - Feature-based confidence

---

### 12. Temporal Expression Extraction

**Location**: `packages/knowledge/src/extract/temporal.ts`

**Current Heuristic**:

- Regex patterns for date ranges: `/\b(?:from|between)\s+([^,.;]+?)\s+(?:to|and)\s+([^,.;]+?)/gi`
- Library-based parsing (`chrono.parse`)
- Hardcoded confidence adjustments

**Problem**: Regex misses natural language temporal expressions. Library parsing is brittle.

**LLM Circuit Solution**:

```typescript
extractTemporal(text: string): TemporalExpression[] {
  // LLM extracts temporal expressions
  // Prompt: "Extract all temporal expressions: dates, times, ranges, recurrences."
  // Schema: { type: "instant" | "range" | "recurrence", start?: string, end?: string, raw: string }
}
```

**Files**:

- `packages/knowledge/src/extract/temporal.ts:94-169` - Regex + library parsing

---

## Implementation Strategy

### Phase 1: Core Extraction Circuits

1. Decision extraction (`reasoning.ts`)
2. Intent classification (`classify.ts`)
3. Domain classification (`domains.ts`)

### Phase 2: Reasoning Circuits

4. Decision facts (`decisions.ts`)
5. Alternative facts (`alternatives.ts`)
6. Causal relationships (`causality.ts`)

### Phase 3: Structural Circuits

7. Pattern validation (`match.ts`)
8. Intent splitting (`split.ts`)
9. Path classification (`decompose.ts`)

### Phase 4: Extraction Circuits

10. Codex event extraction (`codex.ts`)
11. Sentence confidence (`facts.ts`)
12. Temporal extraction (`temporal.ts`)

## Architecture Pattern

Each LLM circuit should follow this pattern:

```typescript
// packages/knowledge/src/circuits/decision.ts
import { generateObject } from "ai";
import { z } from "zod";
import { getFastModel } from "@alfred/agent/models";

const decisionSchema = z.object({
  decisions: z.array(
    z.object({
      decision: z.string(),
      rationale: z.string(),
      alternatives: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    })
  ),
});

export async function extractDecisions(
  text: string,
  context?: string
): Promise<Decision[]> {
  const model = getFastModel(); // Cerebras or similar

  const result = await generateObject({
    model,
    schema: decisionSchema,
    prompt: `
Extract explicit decisions made in this text.

Text: ${text}
${context ? `Context: ${context}` : ""}

Return structured decision objects with rationale and alternatives.
`,
    temperature: 0, // Deterministic
  });

  return result.object.decisions;
}
```

## Model Selection

- **Fast inference**: Cerebras (~3000 tokens/sec)
- **Structured outputs**: Use `generateObject` with Zod schemas
- **Temperature**: 0 for deterministic extraction
- **Context injection**: Use LLM to prepare context summaries when needed

## Benefits

1. **Accuracy**: Semantic understanding vs pattern matching
2. **Maintainability**: No keyword lists or regex to update
3. **Flexibility**: Handles edge cases and nuances
4. **Cost**: Fast models make this affordable
5. **Modularity**: Each circuit is independent and testable

## Migration Notes

- Keep existing heuristics as fallbacks during migration
- Add feature flags for gradual rollout
- Monitor LLM costs and latency
- Compare accuracy metrics before/after

### 13. Risk Assessment Classification

**Location**: `packages/runtime/src/engines/safety.ts`

**Current Heuristic**:

- Embedding similarity to risk centroids (low/medium/high)
- Hardcoded thresholds: `< 0.35` → low, `< 0.6` → medium
- Vector averaging for plan-level assessment

**Problem**: Embedding similarity doesn't capture risk semantics. Thresholds are arbitrary. Misses nuanced risk factors.

**LLM Circuit Solution**:

```typescript
classifyPlanRisk(plan: PlanLike): RiskAssessment {
  // LLM assesses risk with structured reasoning
  // Prompt: "Assess the risk level of this workflow plan. Consider: destructive operations, data access, external dependencies, rollback difficulty."
  // Schema: { level: "low" | "medium" | "high", factors: string[], confidence: number }
}
```

**Files**:

- `packages/runtime/src/engines/safety.ts:147-256` - Embedding-based risk classification

---

### 14. Error Severity Inference

**Location**: `packages/agent/src/orchestrator/dreaming.ts`

**Current Heuristic**:

- String matching for error keywords
- Hardcoded severity mapping
- Confidence derived from severity

**Problem**: Keyword matching misses context. Doesn't understand error semantics or user impact.

**LLM Circuit Solution**:

```typescript
inferSeverity(errorMessage: string, context?: string): DreamSeverity {
  // LLM classifies error severity
  // Prompt: "Classify this error's severity for learning purposes. Consider: user impact, frequency, fixability."
  // Schema: { severity: "low" | "medium" | "high", reason: string }
}
```

**Files**:

- `packages/agent/src/orchestrator/dreaming.ts:75-98` - Keyword-based severity inference

---

## Infrastructure Requirements

### Model Selector Integration

The codebase already has a model selector system planned (`docs/execplans/model-selector.md`). LLM circuits should use:

- **Role**: `"background"` for extraction/classification tasks
- **Provider**: Cerebras for fast inference (~3000 tokens/sec)
- **Model**: Lightweight models like `cerebras:llama3.1-8b` or `cerebras:gpt-oss-120b`

### Circuit Module Structure

Create a new package: `packages/circuits/` with:

```
packages/circuits/
├── src/
│   ├── decision.ts          # Decision extraction
│   ├── intent.ts           # Intent classification
│   ├── domain.ts           # Domain classification
│   ├── causality.ts        # Causal relationships
│   ├── alternatives.ts     # Alternative options
│   ├── risk.ts             # Risk assessment
│   ├── temporal.ts         # Temporal extraction
│   ├── confidence.ts       # Confidence scoring
│   └── index.ts            # Exports
├── package.json
└── tsconfig.json
```

Each circuit follows the pattern:

1. Accept input text + optional context
2. Use fast model via model selector
3. Structured output via Zod schema
4. Return typed results

### Context Injection Pattern

For complex circuits that need context, use a two-stage approach:

```typescript
// Stage 1: Fast context summarization
const contextSummary = await summarizeContext(rawContext, fastModel);

// Stage 2: Main extraction with summarized context
const decisions = await extractDecisions(text, contextSummary, fastModel);
```

## Migration Strategy

### Phase 0: Infrastructure Setup

- [ ] Create `packages/circuits/` package
- [ ] Integrate with model selector (use `background` role)
- [ ] Set up fast model defaults (Cerebras)

### Phase 1: Core Extraction Circuits

- [ ] Decision extraction (`reasoning.ts`)
- [ ] Intent classification (`classify.ts`)
- [ ] Domain classification (`domains.ts`)

### Phase 2: Reasoning Circuits

- [ ] Decision facts (`decisions.ts`)
- [ ] Alternative facts (`alternatives.ts`)
- [ ] Causal relationships (`causality.ts`)

### Phase 3: Structural Circuits

- [ ] Pattern validation (`match.ts`)
- [ ] Intent splitting (`split.ts`)
- [ ] Path classification (`decompose.ts`)

### Phase 4: Extraction Circuits

- [ ] Codex event extraction (`codex.ts`)
- [ ] Sentence confidence (`facts.ts`)
- [ ] Temporal extraction (`temporal.ts`)

### Phase 5: Assessment Circuits

- [ ] Risk assessment (`safety.ts`)
- [ ] Error severity (`dreaming.ts`)

## Progress

- [ ] Phase 0: Infrastructure Setup
- [ ] Phase 1: Core Extraction Circuits
- [ ] Phase 2: Reasoning Circuits
- [ ] Phase 3: Structural Circuits
- [ ] Phase 4: Extraction Circuits
- [ ] Phase 5: Assessment Circuits
