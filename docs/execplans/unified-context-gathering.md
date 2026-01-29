# Unified context gathering

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

ALFRED’s “context gathering” currently happens via two different paths: planner research uses `@alfred/codeprint` (fast lexical retrieval), while orchestrator/chat uses an LLM (Codex/Droid) to pick files and then slices the first ~N lines of each file. This produces inconsistent quality, avoidable latency, and unnecessary token/cost.

After this change, both planner and chat agents will use a single, low-effort context tool that:

1. Retrieves the right code files quickly using a hybrid of techniques (lexical BM25 + structural signals + optional lightweight ML).
2. Produces a token-efficient “evidence bundle” by slicing around relevant definitions/calls instead of file headers.
3. Optionally produces a layered “senior engineer” analysis using a large model (Cerebras/OpenAI/local), with deterministic structure and explicit citations back to the evidence bundle.

The user-visible proof is that a single tool call (or single code path for the planner) returns a stable set of relevant file slices and a high-quality analysis for representative tasks (e.g. “add workflow hooks persistence”, “agentfs docker workspace constraints”) with low latency and without requiring a Codex/Droid file-picking step.

## Progress

- [x] (2026-01-25) Establish baseline harness: `scripts/contextbench.ts` compares fallback scan vs codeprint for 10 fixed queries (no external services).
- [x] (2026-01-25) Make orchestrator `gatherCodeContext()` codeprint-first (default), with LLM file-picking as a fallback only.
- [x] (2026-01-25) Replace naive “first N lines” slicing with slice selection anchored to codeprint semantic metadata (symbols/references).
- [x] (2026-01-25) Add a lightweight learned ranker (linear model) to combine existing retrieval features deterministically (gated by `CODEPRINT_RANKER=1`).
- [x] (2026-01-27) Commit ranker weights in `packages/codeprint/src/ranker.weights.ts` and make training deterministic (coordinate descent).
- [x] (2026-01-27) Add optional lightweight late-fusion for semantic refinement (hash-embed fallback; rerank-based fusion when available; `CODEPRINT_LITE_FUSION=hash|rerank|1`).
- [x] (2026-01-25) Add a single orchestrator tool (one call) that returns: (a) receipts, (b) evidence bundle, (c) optional structured multi-layer analysis (`toolContext`).
- [x] (2026-01-27) Add citation validation + deterministic intent output to `toolContext` (always returns `{ receipts, bundle, intent }`, plus `analysis|analysisError`).
- [x] (2026-01-27) Add targeted tests for each layer (retrieval, bundling, tool output shape, citation validation, edge-follow).
- [x] (2026-01-27) Run scoped validators for changed packages (agent + codeprint typecheck + unit tests).

## Surprises & Discoveries

- Observation: Planner and orchestrator use different context gatherers today.
  Evidence: `packages/plan/src/research/codebase.ts` calls `@alfred/codeprint.findRelevantFiles()`, while `packages/agent/src/orchestrator/flow/context.ts` uses Codex/Droid and a filename keyword scan fallback.

- Constraint: ALFRED’s DB/RAG embedding dimension is pinned to 1024 (KaLM MRL), so CodeBERT-like 768-dim embeddings cannot be stored in the existing vector columns without a projection or schema change.
  Evidence: `packages/embed/src/dim.ts` exports `EMBEDDING_DIM = 1024`, and multiple DB tables use `vector(..., { dimensions: EMBEDDING_DIM })`.

- Tool schema mismatch: `planSearchReceiptSchema` / `planContextBundleSchema` (from `@alfred/type` re-exports) are not the `SearchReceipt` / `ContextBundle` schemas from `packages/type/src/plan.ts`.
  Evidence: `packages/type/src/plan.zod.ts` defines a different `searchReceiptSchema` shape (query/results).

## Decision Log

- Decision: Orchestrator code context retrieval becomes codeprint-first by default; Codex/Droid file-picking becomes a fallback only when codeprint is disabled or returns empty/low-confidence.
  Rationale: Keeps context gathering fast and cheap for the common case, while preserving an escape hatch for edge cases.
  Date/Author: 2026-01-25 / Droid

- Decision: The first “ML” improvement is a learned linear ranker over existing features (no model runtime). A CodeBERT-class embedding late-fusion is added as an optional refinement behind strict budgets and fail-open behavior.
  Rationale: Linear rankers are extremely fast and robust; embedding late-fusion adds semantic lift but must not introduce fragility or large startup costs.
  Date/Author: 2026-01-25 / Droid

- Decision: Implement the optional embedding late-fusion as a local feature-hash embed (no Python/model downloads) until a CodeBERT-class runtime is proven within cold-start and memory budgets.
  Rationale: Keeps the default path import-safe and fast while still allowing a gated “semantic-ish” refinement stage.
  Date/Author: 2026-01-25 / Droid

- Decision: Treat `CODEPRINT_LITE_FUSION` as an explicit runtime mode: `hash` (no deps), `rerank` (time-bounded semantic blend), or `1` (auto: prefer rerank, else hash). When enabled, skip full rerank and return `method="keyword"` results.
  Rationale: Allows a strictly-bounded refinement stage for “fast path” callers without forcing the full rerank stage.
  Date/Author: 2026-01-27 / Droid

- Decision: Validate analysis citations against the evidence bundle and degrade to "insufficient evidence" rather than returning ungrounded claims.
  Rationale: Prevents hallucinated citations from being treated as actionable guidance.
  Date/Author: 2026-01-27 / Droid

## Outcomes & Retrospective

### What shipped

- Orchestrator context gathering is codeprint-first with confidence gating:
  - `packages/agent/src/orchestrator/flow/context.ts` (`gatherCodeContext()`)
- Evidence bundle slicing is semantic-anchor based (symbols/references) with optional caller edge-follow:
  - `packages/agent/src/orchestrator/flow/context.ts` (`buildContextBundle()`)
  - Gates: `ORCH_CONTEXT_EDGE_FOLLOW=1`, `ORCH_CONTEXT_INCLUDE_HEADER=0` (disable header prelude)
- Single orchestrator tool that returns `{ receipts, bundle, intent }` always, plus optional `{ analysis | analysisError }`:
  - `packages/agent/src/orchestrator/tool/context.ts`
  - Citation validation gate: `ORCH_CONTEXT_VALIDATE_CITATIONS=0` (disable)
- Codeprint learned ranker + committed weights (deterministic) and optional late-fusion:
  - `packages/codeprint/src/ranker.ts`, `packages/codeprint/src/ranker.weights.ts`
  - `CODEPRINT_RANKER=1`
  - `CODEPRINT_LITE_FUSION=hash|rerank|1` (rerank fusion is time-bounded + fail-open)

### Evidence (tests/validators)

- Typecheck:
  - `bun run typecheck`
- Codeprint tests:
  - `cd packages/codeprint && bun run test`
- Agent context/tool tests:
  - `bun test packages/agent/test/orchestrator/flow/context.test.ts packages/agent/test/orchestrator/flow/bundle.test.ts packages/agent/test/orchestrator/tool/context.test.ts packages/agent/test/orchestrator/tool/context.analysis.test.ts`

### What remained hard / follow-ups

- Full eval/bench coverage for the end-to-end orchestrator “context → plan/execute quality” loop (beyond unit tests).
- Decide whether to keep `CODEPRINT_LITE_FUSION=rerank` semantics as “fast-path semantic blend” vs routing all semantic needs through the full rerank stage.
- Consider adding a small regression harness around real ALFRED tasks (golden queries) that asserts stable top-K + stable slice anchors.

## Context and Orientation

### Key terms

- “Retrieval”: selecting a set of candidate files likely relevant to a requirement.
- “Rerank”: re-ordering the candidate list using a more expensive model (often higher precision).
- “Evidence bundle”: a set of small file slices (path + line ranges + snippet) that fit within a token budget.
- “Lexical ranking”: term matching (e.g. BM25) that rewards rare, high-signal words.
- “Embedding late-fusion”: compute embedding similarity only for top lexical candidates and combine scores, rather than embedding the whole repo.
- “Learned ranker”: a tiny model (here: linear weights) that combines features into a final score.

### Current code paths

Planner:

- `packages/plan/src/research/codebase.ts` uses `@alfred/codeprint.findRelevantFiles(workspace, requirement, topK)` and returns paths.
- `packages/plan/src/research/internal.ts` composes planner research, including codebase context.

Orchestrator/chat:

- `packages/agent/src/orchestrator/flow/context.ts`:
  - `gatherCodeContext()` uses Codex/Droid (LLM) to pick files, with a filesystem keyword scan fallback.
  - `buildContextBundle()` reads each file and takes the first ~N lines (with shrinking), which is often not the relevant portion.
  - `indexCodeEmbeddings()` ingests the bundle into DB RAG chunks via `packages/agent/src/utils/rag-ingest.ts`.

Code retrieval engine:

- `packages/codeprint/src/index.ts` implements `findRelevantFiles()` with BM25 + semantic boosts + package/directory heuristics + optional rerank via `@alfred/rerank`.
- `packages/codeprint/src/types.ts` defines per-file semantic metadata (`symbols`, `references`) including line numbers.

Reranking:

- `packages/rerank/src/resolve.ts` selects `cohere`, `qwen3vl`, or `none` based on env.

Embeddings (RAG):

- `packages/rag/src/doc.ts` uses `@alfred/embed` providers (default KaLM) and expects `EMBEDDING_DIM = 1024`.

## Plan of Work

### Milestone 1: Baseline and acceptance harness

Add a small, deterministic harness that can run locally (no external services required) to compare:

1. Current orchestrator `gatherCodeContext()` results/latency, and
2. Codeprint `findRelevantFiles()` results/latency,

for a fixed set of queries.

This milestone exists to prevent regressions and to make “better” measurable before wiring in new behavior.

Key outcomes:

- A script (or test) that prints top paths + timing for both paths.
- A small set of representative queries committed as test data.

### Milestone 2: Codeprint-first retrieval for orchestrator

Modify `packages/agent/src/orchestrator/flow/context.ts` so that `gatherCodeContext()` first attempts to use codeprint.

Concrete behavior:

- If `process.env.CODEPRINT_ENABLED !== "0"` and `@alfred/codeprint` returns results, use them.
- Otherwise fall back to the existing Codex/Droid + scan behavior.
- Preserve cache behavior, `data-cache-handoff` emission, and existing `SearchReceipt` shape.

Implementation detail:

- Convert `RelevantFile[]` from codeprint into `SearchReceiptItem[]` with:
  - `kind: "code"`
  - `path: <relative path>`
  - `score: <0..1>`
  - `reason: "codeprint:<method>"` or a richer reason when available.

Add tests that:

- Use a temporary workspace with a few files and confirm codeprint path is used (no Codex/Droid invocation).
- Confirm fallback still works when codeprint disabled.

### Milestone 3: Evidence bundle slicing anchored to semantics

Replace `buildContextBundle()`’s “file head slice” approach with slices selected around likely-relevant locations.

Approach:

- Load the codeprint index for the workspace (the `.codeprint.json` file) and map each returned file to its `EnrichedEntry`.
- For each file, compute “anchors” (line numbers) based on:
  - symbols whose `name` matches query terms (or alias-expanded terms)
  - references whose `name` matches query terms
  - path segment matches (as a weaker anchor)
- Extract windows around anchors (e.g. ±40 lines), merge overlaps, and choose the smallest set of windows that fits the token budget.
- Keep the existing shrinking behavior as a fallback when no anchors exist.

Key constraints:

- Must remain import-safe (no background handles at import time).
- Must be bounded and fast: do not parse ASTs during bundling; only use stored line numbers and file reads.
- Must be deterministic for the same workspace/query.

Add tests that:

- Construct a small workspace where the relevant code is not in the file header, and assert the slice includes the relevant function/class.

### Milestone 4: Lightweight learned ranker in codeprint

Add a deterministic linear ranker inside `packages/codeprint` that combines existing features to improve precision with effectively zero runtime cost.

Work:

- Define a feature vector for each candidate result (top ~200 BM25 results), such as:
  - bm25Score (normalized)
  - symbolBoost
  - pathTermHits
  - packageBoostApplied / directoryBoostApplied
  - fileDepth
  - fileType indicators (.ts/.tsx/.md)
  - “entrypoint” indicators (index/types/shared/env/client/server/etc.)
- Implement a pure scoring function:
  - `score = clamp01(sigmoid(w·x))` or `clamp01(w·x)` (choose one and document why).
- Store weights in a small committed file (e.g. `packages/codeprint/src/ranker.weights.ts`), not generated at runtime.

Training:

- Add a script in `packages/codeprint/scripts/` that reads `packages/codeprint/src/eval/datasets/alfred-tasks.ts`, runs retrieval to produce features, and optimizes weights to improve ranking metrics (MRR/NDCG/precision@15).
- The script should output a suggested weight set and a diff-friendly format.
- Commit weights manually (no auto-write in CI) to avoid churn.

Add tests that:

- Assert the ranker is stable/deterministic.
- Assert eval metrics do not regress below agreed thresholds.

### Milestone 5: Optional lightweight embedding late-fusion (CodeBERT-class)

Add an optional semantic refinement stage that does not require embedding the whole repo.

Constraints and design:

- This stage runs only on the top-N lexical candidates (e.g. 30–80) and is strictly time-bounded.
- It must fail open to the non-embedding ranker when unavailable.

Prototyping step (required before committing to a model/runtime):

- Implement a small spike that can embed short texts and measure:
  - cold start time
  - per-embedding latency
  - memory footprint
- Candidate backends:
  - Python subprocess using a small transformer embedding model.
  - A JS/WASM embedding runtime if Bun compatibility is acceptable.

Implementation:

- Add a `LiteEmbeddingProvider` behind a gate (env var), used only by codeprint.
- Compute cosine similarity between query embedding and candidate “rerank text” (already built by codeprint).
- Combine with the learned ranker score using a small weight (late-fusion).

Acceptance:

- On machines without the embedding runtime, everything still works (no errors, just no embedding stage).
- On machines with the runtime, measurable recall/precision improves on targeted semantic cases.

### Milestone 6: Single orchestrator tool that returns receipts + bundle + analysis

Add a new orchestrator tool (file: `packages/agent/src/orchestrator/tool/context.ts`) that implements a single call:

- Inputs: `requirement`, `cw`, `topK`, `maxTokens`, optional flags for web context inclusion.
- Output:
  - `receipts: SearchReceipt` (code + optional web)
  - `bundle: ContextBundle`
  - `analysis: { summary, architecture, hotspots, changePlan, tests, risks }` (structured, deterministic headings)

The tool should:

1. Call `gatherCodeContext()` (now codeprint-first).
2. Optionally call `gatherWebContext()`.
3. Build the `ContextBundle`.
4. Call an LLM (Cerebras/OpenAI/local via AI SDK v6) to generate the structured analysis using only the evidence bundle and explicit citations (file path + line range).

Add tests that:

- Validate the tool output shape (schema) without asserting free-form content.
- Ensure tool is import-safe and does not leak handles.

## Concrete Steps

All commands below assume the repository root is `/Users/jackmazac/Development/alfred`.

1. Run baseline typecheck:
   - `bun run typecheck`

2. Baseline codeprint eval (for retrieval quality):
   - `cd packages/codeprint && bun run eval --verbose`

3. After each milestone, run targeted tests:
   - Codeprint unit tests: `cd packages/codeprint && bun run test`
   - Agent unit tests (scoped): `bun test packages/agent/test/orchestrator/flow/context.test.ts`
   - Workspace fast tests (optional): `bun run test:fast`

4. For performance checks, prefer existing perf tests in codeprint and add new ones only when needed.

## Validation and Acceptance

### Functional acceptance

1. Orchestrator code retrieval is codeprint-first.

   Evidence: a unit test demonstrates that `gatherCodeContext()` returns paths from codeprint for a synthetic workspace without calling Codex/Droid.

2. Evidence bundle includes relevant slices, not just file headers.

   Evidence: a unit test constructs a file where the relevant function is after line 500 and verifies the bundle includes that function’s lines.

3. A single orchestrator tool call returns receipts + bundle + structured analysis.

   Evidence: a tool test validates JSON shape and that citations refer to files present in the bundle.

### Quality and performance acceptance

- Codeprint eval average Precision@15 remains ≥ 0.15 (or improves) on `packages/codeprint/src/eval/datasets/alfred-tasks.ts`.
- Retrieval-only path remains fast:
  - codeprint query latency stays well under the existing perf budget test (`packages/codeprint/test/perf.test.ts`).
- The new embedding stage is optional and time-bounded; it must not make the default path slower when disabled.

### Repo validators

- `bun run typecheck` passes.
- Relevant unit tests pass:
  - `cd packages/codeprint && bun run test`
  - `bun test packages/agent/test/orchestrator/flow/context.test.ts` (and any new tests added by this work)

## Idempotence and Recovery

- All changes must be safe to run repeatedly.
- Any new caches must be bounded and keyed by workspace + index version.
- The embedding stage must be gated and fail open:
  - if the embedding runtime is missing or unhealthy, skip and continue.

## Artifacts and Notes

- Keep retrieval and bundling debug output behind existing logger debug events; do not print to stdout in library code.
- If a training script is added for ranker weights, it must be explicitly invoked and must not run during normal tests.

## Interfaces and Dependencies

### New/modified interfaces

In `packages/agent/src/orchestrator/flow/context.ts`, `gatherCodeContext()` must support a codeprint-first path without changing its public signature.

In `packages/agent/src/orchestrator/tool/context.ts` (new), define the tool input/output schemas (Zod) and implement `execute()` following existing tool patterns (see `packages/agent/src/orchestrator/tool/droid.ts`).

In `packages/codeprint/src/index.ts`, introduce a ranker abstraction that can be enabled without changing the public `findRelevantFiles()` signature (feature computation and score combination remain internal).

### External services

- None required for the default fast path.
- Optional:
  - rerank backends already supported by `@alfred/rerank` (Cohere/Qwen3-VL).
  - optional lightweight embedding backend (must be local and fail open).
