<chatName="Semantic replacement of magic lists across ALFRED"/>

# Design and Implementation Plan: Replacing Magic Lists with Semantic, Graph, and Structural Methods

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

This document proposes a concrete, repo-specific architecture and implementation plan to eliminate all nine "magic list" patterns enumerated in docs/reports/magic-lists-inventory.md using embeddings, graph topology, and syntactic structure, while adhering to ALFRED's architecture, purity, and performance standards.

## Progress

Use this section to track granular implementation steps. Every stopping point must be documented here, even if it requires splitting a partially completed task into two ("done" vs. "remaining"). This section must always reflect the actual current state of the work.

- [ ] Extend ontology with risk and pattern anchors (Concept:HighRisk, Concept:MediumRisk, Concept:LowRisk, Pattern:Causal, Pattern:Decision, Pattern:Alternative)
- [ ] Create packages/runtime/src/engines/safety.ts with classifyPlanRisk function
- [ ] Refactor packages/cognitive/src/logic/autonomy.ts to remove keyword lists and accept RiskAssessment
- [ ] Create packages/agent/src/preference/semantic.ts with semantic inference functions
- [ ] Refactor packages/agent/src/preference/inference.ts to delegate to semantic module and add async variants
- [ ] Update packages/api/src/scheduler/preference-inference.ts to use async preference inference
- [ ] Refactor packages/knowledge/src/extractor.ts to remove CAUSAL_MARKERS, CONFIDENCE_MODIFIERS, and negation fallback
- [ ] Add structural confidence calculation (computeSentenceConfidence) to extractor
- [ ] Create packages/knowledge/src/reasoning/causality.ts with deriveCausalityFromText
- [ ] Create packages/knowledge/src/reasoning/decisions.ts with deriveDecisionFacts
- [ ] Create packages/knowledge/src/reasoning/alternatives.ts with deriveAlternativeFacts
- [ ] Update packages/agent/src/orchestrator/learning-worker.ts to invoke reasoning passes
- [ ] Refactor packages/knowledge/src/query.ts to remove STOP_WORDS and add POS-based term extraction
- [ ] Integrate risk classification into runtime pipeline phases (plan/act)
- [ ] Add observability metrics and logging for new semantic operations
- [ ] Update tests to cover new semantic/structural implementations
- [ ] Run end-to-end validation for all nine magic list replacements

## Surprises & Discoveries

Document unexpected behaviors, bugs, optimizations, or insights discovered during implementation. Provide concise evidence.

- Observation: (To be filled during implementation)
  Evidence: (To be filled during implementation)

## Decision Log

Record every decision made while working on the plan in the format:

- Decision: Keep extractor synchronous and move causal/decision/alternative detection to reasoning passes
  Rationale: Preserve purity and budget; embedding is async
  Date/Author: 2025-01-XX / ALFRED

- Decision: Risk classification moved to runtime engine and provided to pure gating
  Rationale: Maintain cognitive purity and <100 µs budget
  Date/Author: 2025-01-XX / ALFRED

- Decision: Preference centroids cached globally; per-user centroids as a future enhancement
  Rationale: Simplicity and performance
  Date/Author: 2025-01-XX / ALFRED

- Decision: Use gateExecutionWithAssessment to avoid breaking existing gateExecution callers
  Rationale: Backward compatibility while enabling new semantic risk assessment
  Date/Author: 2025-01-XX / ALFRED

- Decision: Keep async preference inference in scheduler only, not in hot UI paths
  Rationale: Scheduler has direct access to server resources and is not performance-critical
  Date/Author: 2025-01-XX / ALFRED

## Outcomes & Retrospective

At completion, all nine magic lists are removed. Risk, preferences, and reasoning are semantic/structural. The system remains within budgets and exhibits improved accuracy and robustness. Remaining opportunities and lessons learned will be summarized here.

(To be updated as milestones are completed)

## 1) High-Level Overview

We will replace static keyword/regex heuristics with a unified semantic-structural system that leverages:

- Embeddings via @alfred/embed and @alfred/rag to classify text (tone, verbosity, formatting) using prototype centroids and per-user learned centroids, cached in-memory.
- Graph-based classification via ontology anchors and nearest-concept traversal (packages/db/repo/graph/traverse.ts::findNearestConcept) to derive risk categories and pattern labels by proximity to “anchor” nodes seeded during ontology initialization.
- Syntactic structure via compromise.js (already used in extractor.ts) to replace simple word lists (stop words, negation) and support clause-oriented detection while preserving synchronous, pure extraction.

The resulting system maintains purity in core cognitive transitions (no side effects, pure gating) by moving embedding/graph operations to boundary layers (runtime engines, schedulers, workers), passing annotations into the pure transitions. It preserves budgets: <100 µs for gating/state transitions, <1 ms for light query filters, <10 ms for extraction or context building, and used only on non-hot paths (schedulers, learning workers) when embedding is required.

This design eliminates all nine magic lists—no hardcoded arrays or regex heuristics—replacing them with semantic prototypes and graph anchors maintained as data (ontology seeds), and structural parsing using part-of-speech tags and clause structure.

## 2) Per-Magic-List Replacement Design

For each pattern, we summarize current behavior, propose the replacement, modules, data flow, performance budget, and API surface details.

1) Risk Assessment Keywords (cognitive/autonomy.gateExecution)

- Current
  - File: packages/cognitive/src/logic/autonomy.ts
  - assessRisk() matches action strings against hardcoded keywords to return "low"/"medium"/"high", used by gateExecution() to enforce autonomy thresholds.

- Replacement
  - Move semantic risk scoring out of pure cognitive logic into a boundary-level RiskScorer engine that:
    - Embeds step action/params descriptions with @alfred/embed (batched with embedMany).
    - Uses findNearestConcept against ontology anchors Concept:HighRisk, Concept:MediumRisk, Concept:LowRisk to classify risk (“holonic” graph approach).
    - Aggregates per-plan risk score (e.g., max or fused score).
  - Maintain gateExecution() purity by consuming a precomputed RiskAssessment passed via Plan annotations or as a separate parameter. No embedding/graph calls in cognitive/core code.
  - New modules:
    - packages/runtime/src/engines/safety.ts (new): RiskScorer engine
      - classifyPlanRisk(plan: Plan, options?): Promise<RiskAssessment>
      - caches anchor centroids and step-level embeddings per run to keep latency low.
    - packages/knowledge/src/ontology.ts (extend):
      - Seed anchors: Concept:HighRisk, Concept:MediumRisk, Concept:LowRisk (with NL descriptions; not keywords).
  - Changes:
    - Replace assessRisk() implementation with a pure resolver that uses an injected risk label on the Plan, not string keywords.
    - Introduce gateExecutionWithAssessment(state, autonomyLevel, assessment) or make gateExecution read plan-level annotation, preserving current signature if possible.
  - Budget
    - RiskScorer (async, boundary): ≤10 ms p99 per plan (batch embedMany, cached anchors).
    - gateExecution (pure): ≤100 µs p99.

2) Preference Inference Hints (response.verbosity/tone/format)

- Current
  - File: packages/agent/src/preference/inference.ts
  - inferResponsePreferences() uses keyword lists to infer verbosity, tone, format. detectTone() also uses regexes (see next item).

- Replacement
  - Introduce semantic preference inference using embeddings of user utterances:
    - Compare aggregated user text embedding(s) to prototype centroids for each class:
      - ResponseVerbosity: minimal/concise/detailed/verbose
      - ResponseTone: formal/casual/technical/friendly
      - ResponseFormat: bullet/paragraph/structured/narrative
    - Prototypes live as data (descriptions and examples) and their centroids are cached in memory (no hardcoded word arrays).
    - Optionally, refine per-user centroids over time using user feedback and corrections.
  - New modules:
    - packages/agent/src/preference/semantic.ts (new)
      - buildPreferencePrototypes(): Map<Category, Array<{id:string, text:string}>>
      - getPreferenceCentroids(): Promise<PreferenceCentroids> (memoized)
      - inferResponsePreferencesSemantic(conversations): Promise<Map<PreferenceKey, PreferenceDetail>>
      - detectToneSemantic(text: string): Promise<ResponseTone | null>
      - computePreferenceScores(embedding): Map<Category, Array<{label, score}>>
    - packages/knowledge/src/ontology.ts (extend):
      - Optional: seed Concept:ToneFormal, ToneCasual, FormatBullet, etc., for graph-assisted refinement (not required for MVP).
  - Changes:
    - Replace inferResponsePreferences with async counterpart and deprecate sync:
      - export async function inferResponsePreferencesAsync(...)
      - Keep named export inferResponsePreferences but mark deprecated or wrap the async (call sites must be updated).
    - Replace detectTone with detectToneSemantic; see item 3.
    - Update API scheduler packages/api/src/scheduler/preference-inference.ts to await new async functions.
  - Budget
    - Scheduler invocation is not hot; aggregate ≤10–20 ms per user per run with embedding caches. The functions remain pure with respect to input → output; embedding calls happen server-side only.

3) Tone Detection Regex (detectTone)

- Current
  - File: packages/agent/src/preference/inference.ts
  - detectTone() returns ResponseTone based on regex heuristics.

- Replacement
  - Embed corrected message text and classify against tone prototype centroids (semantic).
  - New function (in semantic.ts):
    - detectToneSemantic(text: string): Promise<ResponseTone | null>
  - Changes:
    - inferPreferenceFromCorrection will call detectToneSemantic and thus become async:
      - export async function inferPreferenceFromCorrectionAsync(...)
    - Keep a thin sync wrapper that returns null and logs deprecation, or migrate call sites to async.
  - Budget
    - Not hot; used reactively in schedulers or workers. ≤10 ms per call with caching.

4) Causal Markers (extractor.ts)

- Current
  - File: packages/knowledge/src/extractor.ts
  - CAUSAL_MARKERS list splits on fixed phrases, producing causality facts synchronously in extract().

- Replacement
  - Remove CAUSAL_MARKERS and the causal split from extract(). Keep extractor pure, synchronous, and structural.
  - Add a post-extraction, asynchronous reasoning pass that identifies causal relations using a hybrid approach:
    - Syntactic: Use compromise to identify Subject-Verb-Object (SVO) patterns between clauses.
    - Semantic: Embed sentence(s)/clause pairs and compare against ontology pattern anchors Pattern:Causal (with NL descriptions) to score cause-effect directionality.
  - New modules:
    - packages/knowledge/src/reasoning/causality.ts (new)
      - deriveCausalityFromText(text): Promise<Array<{cause:string,effect:string,confidence:number,evidence:string[]}>>
      - deriveCausalityFromFacts(facts): Promise<KnowledgeEntry[]>
  - Changes:
    - learning-worker.ts (learnFromRun)
      - After extract() and before toKnowledge(), run deriveCausalityFromText() and merge returned KnowledgeEntry[] (relations “causes”, insight nodes).
  - Budget
    - Post-extraction reasoning is in the learning worker (not hot), ≤10 ms per run segment, batched embeddings, cached anchors.

5) Decision Markers (extractReasoning)

- Current
  - File: packages/knowledge/src/extractor.ts
  - DECISION_MARKERS list finds “considering/choosing/decided/will” and turns sentences into facts.

- Replacement
  - Remove DECISION_MARKERS and rely on a semantic reasoning pass:
    - Syntactic: Use compromise to find decision-like modal patterns (tag-based, not word list).
    - Semantic: Embed sentences and classify against Pattern:Decision anchor(s) in ontology (NL description of “deciding, choosing among alternatives”).
  - New module:
    - packages/knowledge/src/reasoning/decisions.ts (new)
      - deriveDecisionFacts(text): Promise<Array<KnowledgeEntry>>
  - Changes:
    - learning-worker.ts: After basic extraction, call deriveDecisionFacts and merge KnowledgeEntry[].
  - Budget
    - Worker-only, ≤10 ms per run segment, embedding batched.

6) Alternative Markers (extractReasoning)

- Current
  - File: packages/knowledge/src/extractor.ts
  - ALTERNATIVE_MARKERS list locates alternative phrasing (“however”, “alternatively”, “instead”, “but”, “though”).

- Replacement
  - Remove ALTERNATIVE_MARKERS from extractor.
  - Add a semantic-structural reasoning pass:
    - Syntactic: clause segmentation via compromise’s clauses(); look for contrastive conjunction tag groups (not word lists).
    - Semantic: embed candidate clauses; classify against Pattern:Alternative anchors seeded in ontology.
  - New module:
    - packages/knowledge/src/reasoning/alternatives.ts (new)
      - deriveAlternativeFacts(text): Promise<Array<KnowledgeEntry>>
  - Changes:
    - learning-worker.ts: After extraction, call deriveAlternativeFacts and merge.
  - Budget
    - Worker-only, ≤10 ms per run segment.

7) Stop Words (query.semanticQueryInternal)

- Current
  - File: packages/knowledge/src/query.ts
  - STOP_WORDS is a small static set used in the fallback term-based search (when embeddings are unavailable or not used).

- Replacement
  - Eliminate STOP_WORDS; extract informative terms structurally using compromise instead:
    - From the natural-language query, select nouns, verbs, organizations, people, and topics via POS tags; lowercase and deduplicate terms > length 2.
    - This avoids hardcoded lists and improves precision without new infrastructure.
  - Changes:
    - Replace the current term extraction logic in semanticQueryInternal() with a helper extractQueryTerms(nlQuery) using compromise without explicit word lists.
  - Budget
    - semanticQueryInternal() has SEMANTIC_BUDGET_MS=15; compromise parsing with POS filtering remains under budget.

8) Confidence Modifiers (extractor.ts)

- Current
  - File: packages/knowledge/src/extractor.ts
  - CONFIDENCE_MODIFIERS maps words like “likely/probable/uncertain” to constants.

- Replacement
  - Structural confidence estimation without word lists:
    - Use compromise tags to detect modality (#Modal), question forms, hedges (#Adverb of manner/intensity), exclamation, numerics, passive voice.
    - Combine into a deterministic confidence score function (no lists), e.g. base 0.8, subtract for modal/question, adjust for numbers/specifity.
  - Changes:
    - Replace the current loop over CONFIDENCE_MODIFIERS with a structural evaluator:
      - computeSentenceConfidence(sDoc: nlp.Doc): number; no word arrays.
  - Budget
    - Remains synchronous and pure; per-sentence < 100 µs.

9) Negation Words (detectContradiction fallback)

- Current
  - File: packages/knowledge/src/extractor.ts
  - Fallback negation detection uses a static array (“not”, “no”, “never”, “none”, “neither”).

- Replacement
  - Remove fallback negations array completely:
    - Rely on compromise’s #Negative detection and toPositive() transformations to compare normalized forms (already used earlier in function).
  - Changes:
    - Delete the fallback loop over negations; keep structural checks only.
  - Budget
    - Pure; unchanged.

## 3) Call Path, Hotness, Budgets, and Caching

- Risk Assessment (hotness: medium within planning/execution cycle)
  - Call path: Runtime PlanPhase (or before ActPhase) → engines/safety.classifyPlanRisk (async) → annotate Plan → cognitive/autonomy.gateExecution (pure).
  - Budgets:
    - classifyPlanRisk: ≤10 ms p99 (embedMany batched; centroids cached).
    - gateExecution: ≤100 µs p99 (pure).
  - Caching:
    - In-memory LRU of anchor centroids (process-lifetime).
    - Per-run cache of step embeddings (Map<stepKey, vector>).

- Preference Inference (hotness: low; scheduler periodic)
  - Call path: packages/api/src/scheduler/preference-inference.ts → inferResponsePreferencesAsync → mergePreferences → userRepo.setPreference.
  - Budgets:
    - end-to-end per user run: ≤20 ms; embedding/centroid cache ensures lower p99.
  - Caching:
    - Prototypes centroids memoized (global).
    - Text embeddings for conversation samples batched via embedMany.

- Tone Detection (hotness: low; used on corrections)
  - Call path: correction flows or scheduler analysis → detectToneSemantic.
  - Budgets: ≤10 ms per call; cache per text hash optional if repeated.

- Extractor and Reasoning (hotness: low; worker)
  - Call path: learning-worker.ts → extract (pure) → derive* reasoning passes (async).
  - Budgets:
    - extract: <10 ms overall, pure.
    - derive* modules: ≤10 ms each, embedding batched.

- Semantic Query Fallback (hotness: medium in knowledge engine)
  - Call path: runtime/engines/knowledge.semanticQuery → semanticQueryInternal (≤15 ms).
  - Budget: ≤15 ms enforced by measureSync.

- Allocation Patterns and Caching Summary
  - Embedding operations: always embedMany and reuse per batch.
  - Anchors/prototypes centroids: initialize-on-first-use caches; TTL optional.
  - No large allocations in hot loops; no regex scanning across full text repeatedly.
  - Use Maps and pre-sized arrays only where necessary.

## 4) Architecture and Data Flow

- Global Anchors and Prototypes (data, not code):
  - Extend packages/knowledge/src/ontology.ts with:
    - Risk anchors: Concept:HighRisk, Concept:MediumRisk, Concept:LowRisk (NL descriptions).
    - Pattern anchors: Pattern:Causal, Pattern:Decision, Pattern:Alternative (NL descriptions).
    - Optional tone/format anchors for diagnostics and future graph evaluation.

- Risk Classification Flow:
  - PlanPhase/ActPhase builds a Plan from requirement/context.
  - engines/safety.classifyPlanRisk(plan) embeds step action descriptions and queries findNearestConcept on ontology resource using batched vectors; returns RiskAssessment.
  - Gate: gateExecution consumes RiskAssessment synchronously, respecting autonomy bands.

- Preference Inference Flow:
  - Scheduler loads conversation histories and feedback → inferResponsePreferencesAsync computes embeddings of user utterances, scores against prototype centroids → Map<PreferenceKey, PreferenceDetail> → merge and persist above confidence threshold.

- Extractor and Reasoning Flow:
  - Worker: extract(text) returns facts/entities/relations (pure).
  - deriveCausalityFromText(text), deriveDecisionFacts(text), deriveAlternativeFacts(text) asynchronously; embed clause spans and match to pattern anchors → KnowledgeEntry[] “causes”/decision/alternative insight nodes added.
  - Persist to graph via upsertNodes/upsertEdges with embeddings computed in batch (existing path).

- Semantic Query Flow:
  - knowledge.semanticQueryInternal: if embedding available, use KNN; else use compromise to extract nouns/verbs/topics (no stop list) for fallback term scoring.

- Caching:
  - Centroids caches in preference/semantic.ts, engines/safety.ts.
  - Derivation results not cached across runs (learning worker persists outcomes).

## 5) Detailed Implementation Plan (File-by-File)

Below are precise changes with function signatures, reasons, and side effects.

A) packages/knowledge/src/ontology.ts (extend)

- Add anchors and pattern nodes (as data), no code changes to APIs:
  - Concepts:
    - "Concept:HighRisk" with description: “Operations with potential irreversible effects, financial transactions, destructive or external side-effects.”
    - "Concept:MediumRisk" with description: “Operations that modify state but are reversible or scoped.”
    - "Concept:LowRisk" with description: “Read-only, non-destructive actions.”
  - Patterns:
    - "Pattern:Causal" with description: “Cause-effect relationships where one event leads to another.”
    - "Pattern:Decision" with description: “Statements reflecting choice among alternatives, intention, or commitment.”
    - "Pattern:Alternative" with description: “Statements presenting contrasting options or trade-offs.”
  - Optionally label tone/format anchors for observability (not mandatory for MVP).

- Impact: learning-worker.ts::seedOntology() already ingests ontology knowledge via getOntologyKnowledge(); ensure new anchors appear under resource "ontology".

B) packages/runtime/src/engines/safety.ts (new)

- Purpose: Boundary engine that classifies plan risk using embeddings and graph.

- New types
  - type RiskLevel = "low" | "medium" | "high"
  - type RiskAssessment = { level: RiskLevel; score: number; anchors: string[] }

- New API
  - async function classifyPlanRisk(plan: import("@alfred/cognitive/state").Plan, options?: { resource?: string; threshold?: number }): Promise<RiskAssessment>
    - Compose step texts: `${step.action} ${JSON.stringify(step.params)}`
    - Batch embed via @alfred/embed.embedMany
    - For each step vector, call findNearestConcept(stepLabel, ["HighRisk","MediumRisk","LowRisk"], 3, "ontology", vector) in parallel; map to nearest anchor and similarity score (compute 1 - distance if needed).
    - Aggregate risk: choose max anchor score mapped to risk level, with score normalized; return anchors seen.

- Caching
  - Cache anchor centroids lazily: embed anchor descriptions once (use in-memory Map<string, number[]>), or use findNearestConcept directly when DB vector index exists; pick one path consistently.
  - It must be pure w.r.t. the plan input; logging allowed in engine.

- Side effects
  - None beyond DB/embedding usage (boundary layer is allowed).
  - Add optional metrics via runtime metrics module (e.g., engine_safety_duration_seconds).

C) packages/cognitive/src/logic/autonomy.ts (refactor)

- Remove highRiskKeywords/mediumRiskKeywords.
- Introduce a pure gate that consumes an externally computed assessment:
  - export function gateExecutionWithAssessment(state: CognitiveState, autonomyLevel: number, assessment: { level: "low"|"medium"|"high" }): CognitiveState
- Keep gateExecution(state, autonomyLevel) for backward-compatibility:
  - Implementation: if plan has metadata risk (see below) use that; else default to “low” (no new magic lists).
  - Example snippet:
    - requiredAutonomy = assessment.level === "high" ? 0.95 : assessment.level === "medium" ? 0.7 : 0.3;

- Optional Plan annotation (non-breaking)
  - Avoid risky ADT changes; instead read a “hint” from plan.steps[0]?.params?.riskHint or state.auto.constraints; but better: provide gateExecutionWithAssessment to callers so cognitive ADT remains unchanged.

- Side effects
  - Purity preserved; risk computation removed entirely from this module.

D) packages/agent/src/preference/semantic.ts (new)

- Purpose: Semantic (embedding-based) inference for preferences.

- New types
  - type PreferenceCentroids = {
      verbosity: Map<ResponseVerbosity, number[]>;
      tone: Map<ResponseTone, number[]>;
      format: Map<ResponseFormat, number[]>;
    }
  - type PreferenceScores = {
      verbosity?: Array<{ label: ResponseVerbosity; score: number }>;
      tone?: Array<{ label: ResponseTone; score: number }>;
      format?: Array<{ label: ResponseFormat; score: number }>;
    }

- New APIs
  - function buildPreferencePrototypes(): {
      verbosity: Array<{ id: ResponseVerbosity; text: string }>;
      tone: Array<{ id: ResponseTone; text: string }>;
      format: Array<{ id: ResponseFormat; text: string }>;
    }
    - Use NL descriptions, e.g. “Concise: short, focused responses…” (no keyword lists)
  - async function getPreferenceCentroids(): Promise<PreferenceCentroids>
    - Memoize embeddings for prototypes (embedMany).
  - async function inferResponsePreferencesSemantic(conversations: ConversationHistory[]): Promise<Map<PreferenceKey, PreferenceDetail>>
    - Aggregate user utterances (recent k messages); embedMany; average; score against centroids via cosine similarity; map to z-inferred preference.
  - async function detectToneSemantic(text: string): Promise<ResponseTone | null>
  - function computePreferenceScores(queryEmbedding: number[]): PreferenceScores

- Caching
  - In-memory centroids (process lifetime).
  - Optional LRU cache by userId for aggregated text embeddings.

- Side effects / errors
  - None; exceptions from embedding gracefully caught at caller; follow .ruler/16-error-handling.md.

E) packages/agent/src/preference/inference.ts (refactor)

- Deprecate magic lists; rewire to semantic.ts.

- API changes
  - export async function inferResponsePreferencesAsync(conversations: ConversationHistory[]): Promise<Map<PreferenceKey, PreferenceDetail>>
    - Implementation: delegate to semantic.inferResponsePreferencesSemantic
  - export async function inferPreferenceFromCorrectionAsync(original: UIMessage, corrected: UIMessage, correctionType: "verbosity"|"tone"|"format"|"content"): Promise<{ key: PreferenceKey; value: PreferenceDetail["value"] } | null>
    - For “tone”, delegate to semantic.detectToneSemantic
    - For “format/verbosity/content”, keep structural inference (length ratio, bullets detection) without magic lists; for “format” rely on text structure (e.g., lines starting with bullets), not a list.
  - Keep existing synchronous exports as thin wrappers:
    - inferResponsePreferences → calls async and throws if awaited incorrectly? Prefer adding overload and migrating call sites.

- Side effects
  - Callers in scheduler must be updated to await new async functions.

F) packages/api/src/scheduler/preference-inference.ts (update)

- Change:
  - const responsePrefs = await inferResponsePreferencesAsync(conversations)
  - const domainPrefs = inferDomainPreferences(toolCalls) remains sync (unchanged)
  - const feedbackPrefs = inferPreferencesFromFeedback(feedback) remains sync
  - merged = mergePreferences([responsePrefs, domainPrefs, feedbackPrefs])
- Risk:
  - Minimal; this is a server-only scheduler.

G) packages/knowledge/src/extractor.ts (refactor – structural only)

- Remove:
  - const CAUSAL_MARKERS
  - const CONFIDENCE_MODIFIERS
  - negations list in detectContradiction fallback

- Replace confidence calculation:
  - function computeSentenceConfidence(sDoc: nlp.Doc): number
    - base 0.8
    - if sDoc.has('#Modal') lower by 0.15
    - if sDoc.questions().length > 0 lower by 0.1
    - if sDoc.numbers().length > 0 add 0.05
    - clamp 0..1
  - Use only tag-based structural cues; no lists.

- Replace causality extraction:
  - Remove current marker-based splitting; do not populate result.causality here.
  - Document: causality now derived in reasoning pass (worker).

- Replace contradiction detection fallback:
  - Remove hard-coded negations loop; rely on #Negative + toPositive() normalizations (already used earlier in function).

- Side effects:
  - toKnowledge now relies on reasoning passes to add ‘causes’ relations; learning-worker updated accordingly.

H) packages/knowledge/src/query.ts (refactor – stop words removal)

- Remove STOP_WORDS constant and related logic.

- Introduce structural term extraction:
  - function extractQueryTerms(naturalLanguage: string): string[]
    - Use compromise:
      - nouns = doc.nouns().out("array")
      - verbs = doc.verbs().out("array")
      - topics/people/orgs = doc.topics().out("array"), doc.people().out("array"), doc.organizations().out("array")
      - union, lowercase, filter length > 2
    - Return deduped terms array.
  - Replace the existing terms extraction with extractQueryTerms.

- Budget:
  - Keep within SEMANTIC_BUDGET_MS=15 via measureSync.

I) packages/knowledge/src/reasoning/{causality.ts, decisions.ts, alternatives.ts} (new)

- Common shape:
  - async function derive*(text: string): Promise<KnowledgeEntry[]>
  - Steps:
    - Split text to sentences and/or clauses via compromise.
    - Build candidates using structural patterns (SVO relations, clause boundaries).
    - Embed candidate spans via embedMany.
    - Compare to ontology pattern anchors centroids (Pattern:*) using cosine similarity; threshold only (e.g., 0.7).
    - Synthesize KnowledgeEntry[]:
      - For causality: relation “causes” edges + insight nodes
      - For decision/alternative: fact nodes or specific insights per pattern
  - No lists of word markers; classification via centroids and clause structure.

J) packages/agent/src/orchestrator/learning-worker.ts (update)

- learnFromRun()
  - After const extraction = extract(...):
    - const causal = await deriveCausalityFromText(textToAnalyze)
    - const decisions = await deriveDecisionFacts(textToAnalyze)
    - const alternatives = await deriveAlternativeFacts(textToAnalyze)
    - Convert to KnowledgeEntry[] and append to knowledgeEntries before upserting.
  - Embed new text spans in the existing embeddings batch (coalesce labels).
  - Note: ensure batching with embedMany for all new entries.

- seedOntology()
  - Ontology changes auto-applied via getOntologyKnowledge().

K) packages/runtime/src/pipeline/phases/{plan|act}.ts (or executor hook)

- Integration point to compute RiskAssessment prior to gating:
  - After Plan computed and before any gate calls:
    - const risk = await classifyPlanRisk(plan)
    - Pass to gateExecutionWithAssessment(state, level, risk)
  - If gateExecution is called elsewhere, introduce a small wrapper in runtime to supply assessment.

- Side effects:
  - Introduces one async step prior to gating; only once per plan/wave.

L) packages/api/src/routers/* (observability only)

- Add lightweight logs/metrics (optional) around preference inference duration and results (count/keys).

M) packages/agent/src/services/entity-linker.ts (no change)

- Already uses embeddings + graph to link entities; consistent with design.

## 6) ExecPlan Skeleton (docs/execplans/magic-lists-replacement.md)

The following is a PLANS.md-compliant ExecPlan skeleton to paste as the full content of docs/execplans/magic-lists-replacement.md.

```md
# Replace Magic Lists with Semantic, Graph, and Structural Methods (ALFRED)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

## Purpose / Big Picture

We will eliminate nine brittle keyword/regex “magic list” patterns across ALFRED and replace them with a unified, high-performance system using semantic embeddings, graph topology, and syntactic structure. Users gain robust personalization (tone/verbosity/format), safer autonomy (risk gating), and better knowledge extraction (causal/decision/alternative reasoning) that generalizes beyond English keywords. The results are observable via preference updates, risk gating behavior, and richer graph insights.

## Progress

- [ ] Create safety engine and integrate with gating
- [ ] Implement semantic preference inference and migrate scheduler
- [ ] Remove regex/tokens in tone detection (semantic replacement)
- [ ] Refactor extractor confidence/negation (structural, no lists)
- [ ] Add reasoning passes (causality, decisions, alternatives)
- [ ] Replace query stop words with POS-based term selection
- [ ] Extend ontology with anchors/patterns
- [ ] Update tests and docs

## Surprises & Discoveries

- Observation: …
  Evidence: …

## Decision Log

- Decision: Keep extractor synchronous and move causal/decision/alternative detection to reasoning passes
  Rationale: Preserve purity and budget; embedding is async
  Date/Author: 2025-11-24 / ALFRED

- Decision: Risk classification moved to runtime engine and provided to pure gating
  Rationale: Maintain cognitive purity and <100 µs budget
  Date/Author: 2025-11-24 / ALFRED

- Decision: Preference centroids cached globally; per-user centroids as a future enhancement
  Rationale: Simplicity and performance
  Date/Author: 2025-11-24 / ALFRED

## Outcomes & Retrospective

At completion, all nine magic lists are removed. Risk, preferences, and reasoning are semantic/structural. The system remains within budgets and exhibits improved accuracy and robustness. Remaining opportunities and lessons learned will be summarized here.

## Context and Orientation

Key components:
- Risk & autonomy: `packages/cognitive/src/logic/autonomy.ts` (pure gating), new safety engine `packages/runtime/src/engines/safety.ts`.
- Preferences: `packages/agent/src/preference/inference.ts` (refactor) and new `packages/agent/src/preference/semantic.ts`.
- Extraction/Reasoning: `packages/knowledge/src/extractor.ts` (structural only), new `packages/knowledge/src/reasoning/*`.
- Graph & ontology: `packages/knowledge/src/ontology.ts`, traversal in `packages/db/src/repo/graph/traverse.ts`.
- Scheduler integration: `packages/api/src/scheduler/preference-inference.ts`.

Purity and budgets from `.ruler/09-purity-and-performance.md` apply. Embeddings remain server-only per `.ruler/21-tanstack-start.md`.

## Plan of Work

1. Extend ontology with risk and pattern anchors; re-run seeding.
2. Add `engines/safety.ts` with `classifyPlanRisk`; annotate plan before gating.
3. Refactor `autonomy.ts`: remove keyword lists; accept assessed risk.
4. Implement `preference/semantic.ts` and expose `inferResponsePreferencesAsync` and `detectToneSemantic`.
5. Update scheduler to use async preference inference.
6. Refactor extractor: remove CAUSAL_MARKERS, CONFIDENCE_MODIFIERS, negations fallback; add structural confidence.
7. Add reasoning passes `reasoning/causality.ts`, `reasoning/decisions.ts`, `reasoning/alternatives.ts`; call from learning-worker.
8. Replace stop words term filtering in query with POS-based selection via compromise.
9. Update tests and run end-to-end validation.

## Concrete Steps

Run from repository root.

- Step: Typecheck and test
  Command: `bun run -A tsc -b && bun test`
  Expectation: Baseline passes before changes.

- Step: Ontology extension
  Edit: `packages/knowledge/src/ontology.ts` and run learning worker.
  Command: `SCHED_LEARNING=1 bun run -A packages/agent/src/orchestrator/learning-worker.ts`
  Expectation: Logs indicate ontology seeding completed.

- Step: Preference scheduler
  Command: `SCHED_PREFERENCE_INFERENCE=1 bun run -A packages/api/src/scheduler/preference-inference.ts`
  Expectation: No errors; preferences updated for active users.

Additional steps will be added/updated as work proceeds.

## Validation and Acceptance

- Risk: Trigger a workflow with a destructive step; observe that `classifyPlanRisk` returns `high` and gateExecution blocks without biometric/approval (per autonomy band).
- Preferences: Provide conversation inputs indicating concise/formal responses; run the scheduler; observe `response.verbosity=concise` and `response.tone=formal` inferred with source `inferred`.
- Extraction: Supply reasoning text with causal/decision/alternative statements; confirm graph nodes/edges are created via reasoning passes.
- Query: Test semantic fallback with natural language; confirm terms are POS-derived without stop lists.

## Idempotence and Recovery

Seeding and preference inference are idempotent. Ontology seeds use upsert semantics. Reasoning passes can run multiple times; content-addressed knowledge prevents duplication.

## Artifacts and Notes

Add short log excerpts and sample outputs here as the implementation progresses.

## Interfaces and Dependencies

- `engines/safety.classifyPlanRisk(plan: Plan, options?): Promise<{ level:'low'|'medium'|'high'; score:number; anchors:string[] }>`
- `preference/semantic.getPreferenceCentroids(): Promise<PreferenceCentroids>`
- `preference/semantic.inferResponsePreferencesSemantic(conversations): Promise<Map<PreferenceKey, PreferenceDetail>>`
- `knowledge/reasoning/*.derive*(text: string): Promise<KnowledgeEntry[]>`
```

## 7) Risk & Trade-Off Analysis

- Backwards Compatibility
  - Preference inference and correction functions become async. Migration plan includes new Async exports while keeping old names deprecated. Update scheduler and tests accordingly.
  - gateExecution remains pure; introducing gateExecutionWithAssessment avoids breaking callers. Where gateExecution is used directly, annotate plan or wrap call.
  - Extractor no longer produces immediate causality; downstream (learning-worker) now injects causality nodes. toKnowledge remains compatible; only the pipeline changes.

- Performance Regressions
  - Embeddings added in safety engine and semantic preference; both on non-hot paths and batched. Caches ensure minimal repeated cost. Gating stays pure.
  - semanticQueryInternal POS parsing within 15 ms budget. Using compromise adds small overhead but avoids term-list maintenance.

- Accuracy Degradation Risk
  - Prototype centroids selection is critical; ensure rich NL descriptions (not lists). Start with 5–10 short examples per class for robust centroids.
  - Cold start may underperform for niche idioms; graph anchors and feedback-driven (learned) preferences can improve over time.

- Mitigations
  - Shadow mode flags (env) for semantic preference inference and reasoning passes; run both old/new in parallel for short period and log deltas only during rollout.
  - Observability: add histograms for classification duration and counters for cache hits/misses. Log top-1 class and confidence for sampled requests.

## 8) Open Questions & Validation Plan

- Open Questions
  - Per-user vs. global centroids: start global; later compute per-user centroids from corrections/feedback.
  - Multilingual inputs: current embeddings must handle; ontology anchors are English; later add multilingual descriptions.
  - Where exactly to invoke risk classification in runtime phases: PlanPhase vs ActPhase; choose PlanPhase so approvals happen early.

- Benchmarking Strategy
  - Build small corpora: 100+ labeled utterances for tone/verbosity/format; measure precision/recall before/after.
  - Measure runtime budgets with @alfred/metrics performance histograms; compare p50/p95 for functions touched.

- Production Metrics
  - Add counters: semantic_preference_inference_total{status}, safety_risk_classify_duration_seconds, reasoning_derivation_duration_seconds.
  - Log: sampled classification outputs with userId anonymized, only categories and confidence.

## 9) Configuration, Types, and Interfaces

- No changes to @alfred/type/preference keys; sources remain "user" | "inferred" | "learned" | "default".
- No new external dependencies; rely on compromise, @alfred/embed, and existing repositories.
- Embeddings remain server-only with variable-based imports where required by TanStack Start SSR rules.

## 10) Implementation Notes (Critical Architectural Decisions)

- The cognitive core stays pure; all embedding/graph logic moves to boundary engines (runtime) or workers (learning). This enforces .ruler/09 and .ruler/11.
- Ontology serves as data source for classification anchors; it is not a keyword list and is maintained with descriptions to avoid brittleness. The existence of anchors is architectural and aligns with holonic architecture ExecPlan.
- Reasoning passes are appended to learning-worker to keep extraction synchronous and pure, meeting the extractor budget consistently.
- Preference inference scheduler is the right place for semantic preferences: not in hot UI paths and with direct access to server resources.

## 11) File-by-File Summary (Reference)

- New
  - packages/runtime/src/engines/safety.ts
  - packages/agent/src/preference/semantic.ts
  - packages/knowledge/src/reasoning/causality.ts
  - packages/knowledge/src/reasoning/decisions.ts
  - packages/knowledge/src/reasoning/alternatives.ts

- Modified
  - packages/knowledge/src/ontology.ts (data: anchors/patterns)
  - packages/cognitive/src/logic/autonomy.ts (remove keywords; accept assessment)
  - packages/agent/src/preference/inference.ts (delegate to semantic; async variants)
  - packages/api/src/scheduler/preference-inference.ts (await async inference)
  - packages/knowledge/src/extractor.ts (remove lists; structural confidence; no negation fallback; causality removed)
  - packages/knowledge/src/query.ts (remove STOP_WORDS; POS-based term extraction)
  - packages/agent/src/orchestrator/learning-worker.ts (invoke reasoning passes)

## 12) Selected Signatures and Contracts

- Risk engine
  ```
  // packages/runtime/src/engines/safety.ts
  export type RiskLevel = "low" | "medium" | "high";
  export type RiskAssessment = { level: RiskLevel; score: number; anchors: string[] };

  export async function classifyPlanRisk(
    plan: import("@alfred/cognitive/state").Plan,
    options?: { resource?: string; threshold?: number }
  ): Promise<RiskAssessment>;
  ```

- Cognitive gate (pure)
  ```
  // packages/cognitive/src/logic/autonomy.ts
  export function gateExecutionWithAssessment(
    state: CognitiveState,
    autonomyLevel: number,
    assessment: { level: "low" | "medium" | "high" }
  ): CognitiveState;
  ```

- Semantic preferences
  ```
  // packages/agent/src/preference/semantic.ts
  export async function inferResponsePreferencesSemantic(
    conversations: ConversationHistory[]
  ): Promise<Map<PreferenceKey, PreferenceDetail>>;

  export async function detectToneSemantic(
    text: string
  ): Promise<ResponseTone | null>;
  ```

- Reasoning passes
  ```
  // packages/knowledge/src/reasoning/causality.ts
  export async function deriveCausalityFromText(
    text: string
  ): Promise<KnowledgeEntry[]>;

  // decisions.ts / alternatives.ts mirror the same shape
  ```

- Semantic query fallback
  ```
  // packages/knowledge/src/query.ts
  function extractQueryTerms(naturalLanguage: string): string[];
  ```

## 13) Potential Side Effects and Safe-Guards

- Async migrations (scheduler, correction inference):
  - Ensure all callers await async versions. Keep deprecated sync exports for one cycle with warnings/logging.
- Ontology seeding:
  - Idempotent upsert; safe to re-run.
- Reasoning passes:
  - Knowledge is content-addressed; duplication prevented.
- CI budgets:
  - Keep extraction sync budgets intact; add performance metrics to monitor.

---

This plan removes all nine “magic list” patterns with semantic, graph, and structural approaches, keeps core transitions pure, adheres to performance budgets, and provides a clear, repo-anchored path to implement and validate the new system.