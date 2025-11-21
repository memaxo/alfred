# Hypergraph Deep Integration ExecPlan (Runtime, RAG, UI, and Graph Unification)

This ExecPlan is a living document and must be maintained in accordance with `.agent/PLANS.md`. It defines how to take the existing knowledge hypergraph, graph memory, and RAG subsystems and integrate them deeply with the runtime, learning engine, and UI so that the whole system uses a single, durable knowledge substrate instead of parallel graphs or ad-hoc stores.

## Purpose / Big Picture

Today, the hypergraph, database graph, RAG pipeline, runtime learning engine, and Mindscape UI are all present and mostly functional, but they are not yet behaving as a single, cohesive knowledge system. The user experiences this as “Alfred remembers things in some places but not others”: runtime learns from outcomes, but that learning does not automatically show up in graph queries; RAG finds relevant documents, but their structure is not reflected as graph relations; Mindscape visualizes its own graph that is only loosely connected to the durable knowledge store.

After this ExecPlan is implemented, a novice should be able to:

1. Run a workflow that makes mistakes, see the learning engine record supervision events, and then query the resulting insights through the same hypergraph/graph APIs that power the rest of the system.
2. Ingest documentation through the RAG pipeline and then query the resulting facts/relations via graph queries, not just semantic text search.
3. Use Mindscape views that are backed directly by the durable knowledge graph (hypergraph + `memory_nodes`/`memory_edges`), so that links and clusters seen in the UI are the same ones used by the assistant and workflows.
4. Observe all of this working under both sqlite (fast tests) and Postgres (nightly workflow) with clear metrics and smoke tests, without needing to understand the internal layering.

The user-visible behavior we are aiming for is: “When Alfred learns something or reads something, it shows up as links and facts in the graph, and I can see and navigate those links in the UI and via API queries, even after restart.”

## Progress

This section is a running log of work completed under this ExecPlan. Update it at every meaningful stopping point so that a newcomer can resume.

- [x] (2025-11-21 00:45Z) Drafted this ExecPlan, surveyed current hypergraph, graph, RAG, runtime, and UI integration, and identified the three main integration frontiers: runtime learning → hypergraph/graph, RAG ingestion → hypergraph/graph, and Mindscape/UI → graph/unified query APIs. Confirmed sqlite + Postgres integration tests and smoke harness are already in place.
- [x] (2025-11-21 03:30Z) Aligned `LearningEngine` with canonical `KnowledgeUpdate` from `@alfred/type/knowledge`, introduced `RuntimeKnowledgeBridge` in `packages/runtime/src/engines/bridge.ts`, wired `persistUpdatesBatch` to apply supervision updates into a per-run hypergraph, and added `learning.integration.test.ts` to assert that `persistHypergraphToDb` is called with the expected `runtime:<runId>` resource and non-empty graph.
- [x] (2025-11-21 03:40Z) Extended `@alfred/rag` ingestion to optionally enrich the graph via `extract`/`toKnowledge` when `RAG_ENRICH_GRAPH=1` and `DATABASE_URL` is set, and added a Postgres-only assertion to `packages/embed/test/e2e.test.ts` that verifies `rag:` resources populate `memory_nodes` under the nightly workflow.
- [x] (2025-11-21 03:50Z) Updated Mindscape initializer to call `graph.runQuery` (`kind: "traverse"`) and materialise `UnifiedNode` results as `knowledge` nodes with `graph.dbId`/`graph.hgHash` mappings, plus a component-level test (`mindscape.graph.test.tsx`) that stubs tRPC and confirms knowledge nodes render from unified query output.
- [x] (2025-11-21 03:55Z) Updated `docs/architecture/hypergraph.md` and this ExecPlan to describe the runtime → hypergraph/graph, RAG → hypergraph/graph, and Mindscape → graph/unified query flows, and extended `.github/workflows/postgres-nightly.yml` to run embed E2E with enrichment enabled and the runtime learning integration test.

## Surprises & Discoveries

Capture unexpected findings as you implement the plan. Keep each entry tight but include enough evidence that a future reader can trust the conclusion.

- Discovery: The runtime learning engine (`packages/runtime/src/engines/learning.ts`) already defines its own `KnowledgeUpdate` type, but the canonical knowledge domain types live in `@alfred/type/knowledge` and are used by `@alfred/learning/self_supervision`. This duplication risks drift between what the learning library emits and what the runtime expects.
  Evidence: `packages/runtime/src/engines/learning.ts` vs `packages/learning/src/self_supervision.ts` and `packages/type/src/knowledge.ts`.
- Discovery: The hypergraph persistence bridge is already in place (`packages/agent/assistant/src/hypergraph-bridge.ts`) and exposes `persistHypergraphToDb`, `loadHypergraphFromDb`, and `startHypergraphSync`, but the runtime does not yet use these helpers; it still treats learning persistence as a black box.
  Evidence: references to `persistHypergraph` and `startAutoPersist` in `packages/knowledge/src/persist.ts` and `hypergraph-bridge.ts`, contrasted with the stubbed `writeBatch` in `LearningEngine`.
- Discovery: The `@alfred/graph` package implements a unified query surface that can combine DB graph traversal, hypergraph Datalog, and RAG semantic retrieval, but it is currently only used from the graph tRPC router; neither runtime nor UI use it as their primary query entry point.
  Evidence: `packages/graph/src/query.ts` and `packages/api/src/routers/graph.ts`.
- Discovery: Mindscape UI code maintains its own node/edge structures and does not use the persistent graph APIs yet. There is a dedicated ExecPlan for Mindscape migration, so this plan must coordinate with that work rather than invent a parallel path.
  Evidence: Mindscape components under `apps/web/src/components/mindscape/` and `docs/execplans/mindscape-migration-plan.md`.

## Decision Log

Record design decisions as they are made so future contributors understand why the system looks the way it does.

- Decision: Use `@alfred/type/knowledge` as the canonical representation of knowledge updates across runtime and learning, and treat `packages/runtime/src/engines/learning.ts`’s `KnowledgeUpdate` as a thin adapter rather than a separate domain type.
  Rationale: This prevents silent drift between learning outputs and what gets persisted, and aligns runtime behavior with the rest of the knowledge stack.
  Date/Author: 2025-11-21 / Codex.

- Decision: Model runtime learning persistence as “hypergraph-first, DB-backed”: keep a per-run or per-resource `Hypergraph` in memory during execution, update it with learning updates, and then persist to `memory_nodes`/`memory_edges` via `persistHypergraphToDb` (sqlite in tests, Postgres in nightly).
  Rationale: This keeps the knowledge stack pure in the core (hypergraph) while reusing the existing graph store for durability and API access.
  Date/Author: 2025-11-21 / Codex.

- Decision: Treat `@alfred/graph`’s `runQuery` as the main backend entry point for graph-style queries (traverse/path/datalog/semantic), and expose that consistently to UI and runtime rather than adding bespoke graph endpoints.
  Rationale: One unified query API is easier to maintain, optimize, and document than multiple query-specific routers.
  Date/Author: 2025-11-21 / Codex.

- Decision: Bind Mindscape’s persisted graph state to `memory_nodes`/`memory_edges` and graph/unified query APIs instead of keeping an independent React Flow graph, using server-side loaders and tRPC queries to hydrate UI state.
  Rationale: This eliminates divergence between what the user sees in the canvas and what the assistant, runtime, and persistence layers consider ground truth.
  Date/Author: 2025-11-21 / Codex.

- Decision: In runtime tests, stub `@alfred/agent/assistant/hypergraph-bridge.persistHypergraphToDb` and assert that `LearningEngine.persistUpdatesBatch` applies supervision updates into a non-empty `Hypergraph` and calls the bridge with a `runtime:<runId>` resource, leaving full DB coverage to existing hypergraph/graph and workflow capture integration suites plus the Postgres nightly workflow.
  Rationale: Local runtime tests avoid requiring a migrated Postgres instance while still proving that the learning engine is wired into the hypergraph/graph bridge; end-to-end DB behavior is already exercised elsewhere.
  Date/Author: 2025-11-21 / Codex.

- Decision: Implement RAG → graph enrichment directly in `@alfred/rag` using `extract`/`toKnowledge` and `@alfred/db/repo/graph.upsertNodes/upsertEdges`, gated behind `RAG_ENRICH_GRAPH=1`, and validate it via the existing Postgres embed E2E suite instead of adding a second sqlite-backed test under `packages/rag/test`.
  Rationale: This keeps `@alfred/rag` free of a dependency on `@alfred/agent`, avoids conflicts with existing RAG unit tests that mock `@alfred/db`, and leverages the production-like embed E2E path for verification.
  Date/Author: 2025-11-21 / Codex.

- Decision: For Mindscape, add a lightweight component-level test that injects a fake tRPC client returning `graph.runQuery` results and verifies that `MindscapeCanvas` renders `knowledge` nodes, rather than spinning up the full sqlite-backed API/server harness in UI tests.
  Rationale: This proves that the UI is wired to the unified graph query API while keeping UI tests fast and hermetic; deeper API/DB integration remains covered by backend integration suites.
  Date/Author: 2025-11-21 / Codex.

## Outcomes & Retrospective

Populate this section once major milestones are complete.

At the end of this ExecPlan, we expect:

- Runtime learning outcomes that used to vanish or sit in memory now show up as explicit facts or insights in the hypergraph/graph and can be queried via graph/unified query APIs and, eventually, visualized in Mindscape.
- RAG ingestion not only powers semantic retrieval but also produces structured knowledge entries that plug into the same hypergraph/graph, so text and graph views of the same data stay in sync.
- Mindscape nodes/edges are backed by the same DB graph used elsewhere, and basic UI flows (select a node, see neighbors, follow reasoning chains) rely on graph/unified query endpoints rather than bespoke in-memory structures.
- Integration tests and nightly workflows clearly demonstrate these behaviors under sqlite and Postgres, and the docs tell a coherent story about the single knowledge substrate.

## Context and Orientation

This section orients a newcomer with no prior context. It should contain everything they need to understand the problem and execute the plan.

The knowledge stack has several layers:

1. The **hypergraph core** in `packages/knowledge/src/hypergraph.ts` implements a pure, content-addressed hypergraph. Nodes represent `Knowledge` variants: `fact`, `relation`, `insight`, `pattern`. The hypergraph tracks:
   - Outbound and inbound adjacency (`neighbors`, `predecessors`).
   - Temporal indices via `IntervalTree` and `between(start, end)`.
   - Embedding indices via an in-memory multi-dimensional R-tree (`RTreeND`) accessed through `setEmbedding` and `embeddingCount`.
   - Dirty sets and a monotonically increasing `version()` count for caches.

2. The **hypergraph persistence helpers** in `packages/knowledge/src/persist.ts` provide:
   - `extractEntries(graph, { onlyDirty })` to turn the graph into `KnowledgeEntry[]`.
   - `persistHypergraph(graph, resource, persistFn)` to flush dirty nodes via a provided persistence function.
   - `loadHypergraph(resource, graph, loader)` to hydrate from abstract `NodeRecord`/`RelationRecord` loaders.
   - `startAutoPersist` to periodically flush dirty knowledge and fill in missing embeddings using an `Embedder` implementation.

3. The **graph store bridge** in `packages/agent/assistant/src/hypergraph-bridge.ts` wires the pure hypergraph into the database graph:
   - `persistHypergraphToDb(graph, resource)` calls `persistHypergraph` with `persistKnowledge` (from `graphstore.ts`), which itself uses `@alfred/db/repo/graph` to upsert nodes/edges into `memory_nodes`/`memory_edges`.
   - `loadHypergraphFromDb(resource, graph)` builds `HypergraphLoader` functions on top of `db.select().from(memoryNodes)` and `db.select().from(memoryEdges)`, mapping DB rows back to `NodeRecord` and `RelationRecord`.
   - `startHypergraphSync` runs `startAutoPersist` with an embedder backed by the `@alfred/embed` package.

4. The **database graph layer** in `packages/db/src/repo/graph.ts` exposes:
   - `upsertNodes` and `upsertEdges` that enforce uniqueness on `(resource, hash)` and align with the hypergraph’s hashing strategy.
   - Node and edge CRUD helpers and traversal functions: `getNeighbors`, `getSubgraph`, `findPath`, and `getReasoningChain` (used by `workflow.reasoning`).

5. The **unified graph query API** in `packages/graph/src/query.ts`:
   - Accepts a discriminated `UnifiedQuery` (`traverse`, `path`, `datalog`, `semantic`).
   - For `traverse` and `path`, talks to `db.repo.graph`.
   - For `datalog`, requires a `Hypergraph` and delegates to `@alfred/knowledge/query`.
   - For `semantic`, prefers hypergraph embeddings when available, otherwise falls back to RAG (`@alfred/rag`).

6. The **graph router** in `packages/api/src/routers/graph.ts`:
   - Exposes a tRPC router with:
     - `getEdges` / `connect` / `watchEdges` operating directly on `memory_edges`.
     - `runQuery` that accepts a `UnifiedQuery`, optionally hydrates a `Hypergraph` via `loadHypergraphFromDb`, and then calls `runUnifiedQuery`.

7. The **runtime knowledge engine** in `packages/runtime/src/engines/knowledge.ts`:
   - Wraps `@alfred/knowledge/query` (`parse`, `execute`, `semanticQuery`) and RAG (`@alfred/rag` + `@alfred/db/repo/rag`) to provide query and semantic retrieval helpers.

8. The **learning engine** in `packages/runtime/src/engines/learning.ts`:
   - Captures `SupervisionEvent`s during workflow execution and uses `@alfred/learning/self_supervision.supervise` to generate canonical `KnowledgeUpdate[]` values from `@alfred/type/knowledge`.
   - Batches updates and calls `persistUpdatesBatch`, which now applies those updates into a per-run `Hypergraph` via `RuntimeKnowledgeBridge` and flushes them through `persistHypergraphToDb` so they land in `memory_nodes`/`memory_edges` alongside other knowledge.

9. The **UI layer** (Mindscape and related components under `apps/web/src/components/mindscape/` and `apps/web/src/routes/mindscape.tsx`):
   - Renders nodes and edges in a canvas using React Flow, hydrating note/reminder nodes from tRPC (`note.list`, `remind.due`) and binding edges to `memory_edges` via `graph.getEdges` / `graph.watchEdges`.
   - After this ExecPlan, the initializer also calls `graph.runQuery` to fetch a small neighbourhood for known `dbId` nodes and materialises the returned `UnifiedNode` records as `knowledge` nodes with `graph.dbId` / `graph.hgHash` mappings so Mindscape can visualise the same graph that backend queries use.

Tests and smoke harnesses that already exist and must remain green:

- `bun run test:integration` runs sqlite-backed integration suites:
  - `packages/knowledge/test/hypergraph.integration.test.ts`
  - `packages/agent/assistant/test/graphstore.integration.test.ts`
  - `packages/api/test/graph.integration.test.ts`
  - `packages/api/test/workflow.reasoning.integration.test.ts`
  - `packages/api/test/workflow.capture.integration.test.ts`
- `bun run smoke:hypergraph [--use-existing-db]` exercises capture → persist → reload.
- `.github/workflows/postgres-nightly.yml` provisions Postgres with pgvector, runs migrations, runs the embed E2E, executes the hypergraph smoke, and now also runs the workflow capture integration suite against a real database.

## Plan of Work

Describe the implementation journey in prose. A future novice should be able to follow this like a story.

We will implement deeper hypergraph integration in three major phases: (1) runtime learning → hypergraph/graph, (2) RAG ingestion → hypergraph/graph, and (3) Mindscape/UI → graph/unified query API. Within each phase we will proceed in small, test-driven steps, leaning on sqlite for fast feedback and the nightly Postgres workflow for production-parity validation.

### Phase 1: Runtime Learning → Hypergraph / Graph

First, we will wire the runtime learning engine so that the “knowledge updates” it generates become real hypergraph nodes and relations, persisted via the existing graph store.

1. Align runtime `KnowledgeUpdate` with canonical types:
   - Replace or wrap `KnowledgeUpdate` in `packages/runtime/src/engines/learning.ts` so it uses `@alfred/type/knowledge`’s `KnowledgeUpdate` type (`node: KnowledgeNode`, `replace?: boolean`) instead of defining its own `data: unknown` bag.
   - Ensure `supervise()` from `@alfred/learning/self_supervision` is called with compatible `SupervisionEvent` types, and the runtime’s `SupervisionEvent` is a thin alias or adapter.
   - Update any existing tests in `packages/runtime/test` that rely on the prior shape to match the canonical type.

2. Introduce a `RuntimeKnowledgeBridge`:
   - Create a new module under `packages/runtime/src/engines/knowledge_bridge.ts` (exact name may be adjusted to fit repo style) that:
     - Accepts `KnowledgeUpdate[]` in canonical form.
     - Maintains a `Hypergraph` instance keyed by `runId` or a `resource` string derived from it (for example, `runtime:<runId>`).
     - Converts `KnowledgeNode` variants (`KnowledgeFact`, `KnowledgeInsight`, etc.) into `Knowledge` entries understood by the hypergraph, using stable mapping rules (e.g., map `KnowledgeInsight` to hypergraph `insight` with a consistent hash).
     - Calls `persistHypergraphToDb(graph, resource)` for that run/resource whenever requested, delegating to `hypergraph-bridge.ts`.

3. Wire `LearningEngine.persistUpdatesBatch` into the bridge:
   - Modify `LearningEngine` so that `persistUpdatesBatch(updates, runId)` depends on the `RuntimeKnowledgeBridge` instead of the stubbed `writeBatch`.
   - Ensure that:
     - A `Hypergraph` is created or reused for the given `runId`.
     - All updates are applied to the in-memory graph.
     - A flush is triggered at the end of the batch (or on demand), which calls `persistHypergraphToDb` and clears the dirty set.
   - Remove or downgrade the placeholder `writeBatch` path, keeping metrics and logging semantics intact (use `runtimeKnowledgeUpdatesTotal` and `runtimeKnowledgeBatchDurationSeconds` as today).

4. Add runtime–graph integration tests:
   - Under `packages/runtime/test`, add a test file that:
     - Mocks `@alfred/agent/assistant/hypergraph-bridge.persistHypergraphToDb` so it can observe calls without requiring a migrated Postgres instance.
     - Simulates a run by:
       - Creating a `LearningEngine`.
       - Recording a few `SupervisionEvent`s and calling `processOutcomes()`.
       - Calling `persistUpdatesBatch` with a fake `runId`.
       - Verifying that the mocked `persistHypergraphToDb` is invoked exactly once with a `resource` of the form `runtime:<runId>` and a `Hypergraph` whose `size()` is greater than zero, demonstrating that supervision updates were converted into hypergraph knowledge.
   - Keep these tests small and deterministic; avoid hitting external services or heavy RAG dependencies.

5. Extend the nightly Postgres workflow:
   - Update `.github/workflows/postgres-nightly.yml` to run the new runtime–graph integration test suite using the real Postgres driver, in addition to sqlite-based CI.
   - Ensure the workflow sets any required environment variables (e.g., `RUN_DB_TESTS=1` if needed) and fails if the tests regress.

### Phase 2: RAG Ingestion → Hypergraph / Graph

Second, we will use the hypergraph as a structured reflection of RAG content, so that text-based retrieval and graph-based reasoning see the same material.

1. Map RAG chunks to `KnowledgeEntry`:
   - In `packages/rag/src/doc.ts` (or equivalent ingestion module), identify the point where documents/chunks are normalized before being embedded and indexed.
   - Add a small, pure helper that:
     - Accepts a chunk (content + metadata).
     - Uses `@alfred/knowledge/extractor.extract` to derive `ExtractionResult` (facts, relations, causality, etc.).
     - Uses `@alfred/knowledge/extractor.toKnowledge` to turn these into `KnowledgeEntry[]`.

2. Introduce an optional “graph enrichment” step in ingestion:
   - Still in the ingestion path, add an optional hook (e.g., a boolean option or env flag) that:
     - After successfully storing the chunk in the RAG tables, calls the new helper to produce `KnowledgeEntry[]`.
     - Calls `persistKnowledge(resource, entries)` or, for more involved graphs, constructs a temporary `Hypergraph`, adds these entries via `Hypergraph.add`, and invokes `persistHypergraphToDb`.
   - Keep this path opt-in at first (for example, behind `RAG_ENRICH_GRAPH=1`) so we can roll it out gradually without surprising existing workflows.

3. Add RAG–graph integration tests:
   - Extend the existing embed E2E suite in `packages/embed/test/e2e.test.ts` (which already runs against Postgres in the nightly workflow) with an additional test that:
     - Sets `RAG_ENRICH_GRAPH=1` so enrichment is active.
     - Ingests one or two small documents with distinctive content via `@alfred/rag.ingest`.
     - Asserts that corresponding `memory_nodes` rows exist for a `resource` such as `rag:<source>`.
   - This keeps the fast `packages/rag/test` suite purely unit-level (mocked `ragRepo`) while validating the enrichment path under the same conditions as production (real Postgres + embed model).

4. Update docs to describe RAG → hypergraph flow:
   - Extend `docs/architecture/hypergraph.md` or the relevant RAG docs to include a short explanation of how RAG chunks become hypergraph facts and relations, and how to observe that via tests and queries.

### Phase 3: Mindscape / UI → Graph and Unified Query APIs

Finally, we will bring the UI into alignment with the hypergraph/graph system so that the user’s mental model of “the graph” matches the backend.

This phase should be carefully coordinated with `docs/execplans/mindscape-migration-plan.md`; do not duplicate work already planned there. Instead, anchor Mindscape’s data model to the existing graph APIs.

1. Identify Mindscape entry points:
   - Review `apps/web/src/components/mindscape/` and `apps/web/src/routes/_authed/*` to find:
     - How nodes and edges are currently represented (likely via React Flow nodes/edges).
     - Where data is fetched (if at all) from the backend.
   - Document in this plan which components and routes will be re-wired to use graph/unified query APIs.

2. Define a minimal UI–graph contract:
   - Decide on a small, stable shape for nodes and edges in the UI, derived from `UnifiedNode`/`UnifiedEdge` in `packages/graph/src/unified.ts` (or equivalent).
   - Avoid duplicating fields; instead, adapt `UnifiedNode.id` variants (`dbId`, `hgHash`, `uiId`) into a UI-friendly ID structure, preserving enough information to round-trip back to queries and mutations.

3. Add or extend tRPC endpoints for UI consumption:
   - If needed, extend `graphRouter` or add a thin façade router that:
     - Accepts Mindscape-friendly queries (e.g., “load neighborhood for node X”, “load subgraph around workflow run Y”).
     - Delegates to `runUnifiedQuery` with `traverse` or `path` queries, using `resource` to scope results.
   - Ensure these endpoints remain sqlite-friendly so that UI tests can run without Postgres.

4. Refactor Mindscape data fetching:
   - Update the relevant route loaders or React hooks to:
     - Call the new or existing graph/unified query endpoints instead of bespoke APIs or static data.
     - Normalize the results into the UI node/edge shape decided above.
   - Keep the UI change minimal for the first iteration: it is acceptable to keep existing layout logic while swapping out the data source.

5. Add basic UI–graph integration tests:
   - Under `apps/web/src/routes/__tests__/` or `apps/web/src/hooks/__tests__/`, add tests that:
     - Spin up the app in test mode with `DATABASE_URL=sqlite::memory:`.
     - Mock tRPC as little as possible (prefer real handlers) and ensure:
       - A Mindscape route can load and render at least one node and its neighbors based on data in `memory_nodes`/`memory_edges`.
     - These tests should be narrow and fast, intended as smoke tests rather than exhaustive UI coverage.

6. Update user-facing docs:
   - Add a short description to `docs/architecture/hypergraph.md` and relevant UI docs explaining that Mindscape now visualizes the same graph the assistant uses, and mentioning the key endpoints involved (graph queries, workflow reasoning, capture).

## Concrete Steps

This section gives exact commands and expected outputs for key milestones. Update it as new tests or scripts are added.

1. Baseline verification before making changes:

    From the repo root:

        bun run test:integration

    Expected: all sqlite integration suites pass (hypergraph persistence, graphstore, graph router, workflow reasoning, workflow capture).

        bun run smoke:hypergraph

    Expected: a JSON log line showing a small hypergraph was captured, persisted, reloaded, and queried, with `nodes` and `results` > 0.

2. After wiring runtime learning to the hypergraph/graph bridge:

    From the repo root:

        bun test packages/runtime/test/learning.integration.test.ts

    (Name is illustrative; the plan implementer must create this file.) Expected: tests that previously used a stubbed `writeBatch` now verify that sqlite-backed graph rows are created for the learning updates.

3. After adding RAG → hypergraph enrichment:

    From the repo root:

        bun test packages/rag

    Expected: an additional test file (for example, `rag.graph.integration.test.ts`) passes, confirming that ingesting a doc leads to retrievable graph nodes.

4. After UI/Mindscape refactor:

    From the repo root:

        bun test apps/web/src/components/__tests__/mindscape.graph.test.tsx

    Expected: the new test passes, confirming that `MindscapeCanvas` renders a `knowledge` node when `graph.runQuery` returns a `UnifiedNode` and that the UI is wired to the unified graph query API.

5. Nightly Postgres workflow:

    The GitHub Actions workflow `.github/workflows/postgres-nightly.yml` will run automatically on schedule and on manual dispatch. After extending it to include runtime and RAG integration tests (if they depend on Postgres-only behavior), verify locally by running:

        RUN_EMBED_MODEL_TESTS=1 RAG_ENRICH_GRAPH=1 bun test packages/embed/test/e2e.test.ts
        WORKFLOW_CAPTURE_TEST_USE_EXISTING_DB=1 bun test packages/api/test/workflow.capture.integration.test.ts

    Expected: both tests pass when pointed at a local Postgres instance with migrations applied.

## Validation and Acceptance

The work under this ExecPlan is considered acceptable when all of the following are true:

1. **Runtime learning integration:**
   - Recording supervision events and calling `persistUpdatesBatch` results in new knowledge entries being added to a per-run `Hypergraph` and flushed via `persistHypergraphToDb` with a `resource` derived from the `runId`.
   - The behavior is covered by `packages/runtime/test/learning.integration.test.ts` (which asserts the bridge call and graph size) and, for DB-backed paths, by existing hypergraph/graph and workflow capture integration suites plus the Postgres nightly workflow.

2. **RAG ingestion integration:**
   - Ingesting a document through the RAG pipeline produces:
     - Embeddings and chunks as before (RAG queries still work).
     - A set of hypergraph entries that, once persisted, yield graph nodes/edges discoverable via graph/unified query APIs.
   - This behavior is validated by the Postgres embed E2E suite when `RUN_EMBED_MODEL_TESTS=1` and `RAG_ENRICH_GRAPH=1`, which asserts that enriched RAG documents create `rag:`-scoped rows in `memory_nodes`.

3. **Mindscape/UI integration:**
   - Mindscape renders node(s) and edge(s) that correspond to data accessible via graph endpoints (notes/reminders for `dbId`, plus `knowledge` nodes created from `graph.runQuery` results).
   - Selecting or connecting nodes that carry `graph.dbId` values continues to use `graph.connect` / `graph.getEdges` / `graph.watchEdges`, while additional knowledge context is sourced via `graph.runQuery`.
   - UI tests confirm that `MindscapeCanvas` consumes `graph.runQuery` output, and manual smoke tests with Postgres show consistent graphs between UI and backend.

4. **Docs and metrics:**
   - `docs/architecture/hypergraph.md` and any relevant RAG or runtime docs clearly describe the new data flows and how to observe them.
   - Metrics for runtime learning persistence (batch counts, durations) remain accurate and are updated if the integration introduces new labels or behaviors.

## Idempotence and Recovery

Because this ExecPlan mostly adds or rewires code rather than altering schemas, most steps are idempotent:

- Re-running the runtime learning tests or RAG–graph integration tests simply reuses or recreates sqlite in-memory databases.
- `persistHypergraphToDb` and `persistKnowledge` are designed to be idempotent with respect to node/edge hashes; repeated flushes without changes should result in no new DB rows.
- If a change to runtime or RAG integration causes failures, the recovery path is:
  - Revert the corresponding module changes (`git checkout packages/runtime/src/engines/learning.ts`, `knowledge_bridge.ts`, or the RAG ingestion module).
  - Re-run `bun run test:integration` and the affected package tests to ensure the system returns to a green state.

The main non-idempotent pieces are RAG document ingestion into a persistent Postgres database. For development and tests, prefer sqlite and ephemeral databases; for Postgres, use throwaway databases or explicit cleanup scripts when running experiments locally.

## Artifacts and Notes

As work progresses, record the most important evidence here: key test outputs, metrics snapshots, or example queries that demonstrate behavior.

- Example: After wiring runtime learning to the graph, a test log might show:

        runtime_knowledge_batch_start {"runId":"run-123","updateCount":3}
        runtime_knowledge_batch_complete {"runId":"run-123","updateCount":3,"durationMs":5}

      Followed by a successful sqlite query returning the corresponding nodes in `memory_nodes`.

- Example: After RAG → hypergraph integration, running a semantic query via `@alfred/graph/runQuery` with `kind: "semantic"` should return nodes whose labels and properties clearly derive from the ingested document.

## Interfaces and Dependencies

This section specifies the key interfaces and types that should exist when the ExecPlan is complete.

- **Canonical knowledge types (unchanged, but now used by runtime):**
  - `packages/type/src/knowledge.ts`:

        export interface KnowledgeUpdate {
          node: KnowledgeNode;
          replace?: boolean;
        }

  - Runtime learning engine should use this `KnowledgeUpdate` rather than a custom shape.

- **Runtime knowledge bridge (new):**
  - In `packages/runtime/src/engines/bridge.ts`:

        export interface RuntimeKnowledgeContext {
          resource: string;
          runId: string;
        }

        export class RuntimeKnowledgeBridge {
          constructor(context: RuntimeKnowledgeContext, graph?: Hypergraph);

          applyUpdates(updates: KnowledgeUpdate[]): void;

          getGraph(): Hypergraph;

          persist(): Promise<void>; // uses persistHypergraphToDb under the hood
        }

  - The bridge is responsible for:
    - Mapping `KnowledgeNode` variants to hypergraph `Knowledge`.
    - Maintaining a `Hypergraph` instance per context, reusing it across multiple batches for the same run when invoked through `LearningEngine`.
    - Calling `persistHypergraphToDb` to flush dirty entries to the DB graph.

- **LearningEngine integration (modified):**
  - In `packages/runtime/src/engines/learning.ts`:

        export class LearningEngine {
          async persistUpdatesBatch(
            updates: KnowledgeUpdate[],
            runId: string
          ): Promise<void>;
        }

  - `LearningEngine` maintains an internal `Map<string, RuntimeKnowledgeBridge>` keyed by `runId`, constructs bridges with `resource = runtime:<runId>`, applies updates into the appropriate hypergraph, and then calls `persist()` once per batch while preserving existing metrics and logging semantics.

- **RAG ingestion hook (new/extended):**
  - In `packages/rag/src/doc.ts` (or equivalent):

        async function ingestWithGraphEnrichment(args: IngestArgs & { enrichGraph?: boolean }) {
          // existing ingest
          if (args.enrichGraph) {
            const entries = toKnowledge(extract(doc.content, docId));
            await persistKnowledge(resource, entries);
          }
        }

  - The exact signature should be tailored to existing RAG APIs but must make enrichment clearly optional and explicit.

- **Graph/unified query usage in UI (new):**
  - Mindscape data loaders and hooks should use tRPC procedures that ultimately call `@alfred/graph/runQuery` with `UnifiedQuery` rather than bespoke SQL or ad-hoc REST endpoints.

When implementing, keep changes as small and composable as possible, prefer additive refactors, and lean on the existing sqlite integration tests and nightly Postgres workflow to validate behavior.

## Revision History

- (2025-11-21 03:55Z, Codex) Marked Phase 1 (runtime learning → hypergraph/graph), Phase 2 (RAG ingestion → hypergraph/graph), and Phase 3 (Mindscape/UI → graph/unified query) as implemented; documented the concrete wiring in runtime (`RuntimeKnowledgeBridge` and `persistUpdatesBatch`), RAG (`RAG_ENRICH_GRAPH` enrichment and embed E2E assertion), and UI (Mindscape initializer calling `graph.runQuery` plus a dedicated component test). Updated validation steps and clarified that runtime tests stub the hypergraph-DB bridge while full DB behavior remains covered by existing integration suites and the Postgres nightly workflow.
