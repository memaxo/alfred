# Knowledge Hypergraph Overview

## System Anatomy
- **packages/knowledge/** – Pure in-memory hypergraph with dirty tracking, interval-tree temporal index, optional embeddings, and AC-3/MRV query execution. Exposes `persistHypergraph`, `loadHypergraph`, and reasoning-chain helpers.
- **packages/agent/assistant/src/graphstore.ts** – Bridge that serializes hypergraph entries into `KnowledgeEntry[]`, writes them through `@alfred/db/repo/graph`, and hydrates fresh graphs on demand.
- **packages/runtime/** – Runtime engines that read from and now also write to the hypergraph/graph substrate. `LearningEngine` consumes canonical `KnowledgeUpdate[]` from `@alfred/learning/self_supervision` and applies them to a per-run `Hypergraph` via `RuntimeKnowledgeBridge`, flushing to `memory_nodes`/`memory_edges` with `persistHypergraphToDb("runtime:<runId>")`.
- **packages/rag/** – RAG ingestion and retrieval. When `RAG_ENRICH_GRAPH=1`, `ingest()` calls `extract`/`toKnowledge` on stored chunks and persists the resulting `KnowledgeEntry[]` to the graph via `@alfred/db/repo/graph.upsertNodes/upsertEdges` under `resource = "rag:<source>"`.
- **packages/db/** – `memory_nodes` / `memory_edges` schema plus repo helpers (`getNeighbors`, `getSubgraph`, `findPath`, `getReasoningChain`) shared by tRPC routers, smoke scripts, and workflow capture flows.
- **packages/api/** – Graph + workflow routers fetch from the repo layer, so capture → persist → reload is validated via tRPC (see `graph.integration.test.ts`, `workflow.capture.integration.test.ts`, `workflow.reasoning.integration.test.ts`).

## Persistence Flow
1. Agent and runtime capture facts/relations/insights → hypergraph mutates in memory (either directly via `@alfred/knowledge` APIs or indirectly via `RuntimeKnowledgeBridge` in the runtime learning engine).
2. `persistHypergraphToDb(resource)` (agent bridge) extracts dirty nodes/edges and calls `persistKnowledge`, which upserts `memory_nodes` / `memory_edges`. Runtime learning uses resources of the form `runtime:<runId>`, while RAG enrichment uses `rag:<source>`.
3. Workflow reasoning events call `persistReasoning`, which writes temporal chains plus reasoning edges. `workflow.reasoning` rebuilds the chain via `getReasoningChain` + `reconstructReasoningChain`.
4. On reload, `loadHypergraphFromDb(resource)` hydrates a fresh hypergraph before executing queries (graph router `runQuery(kind: "datalog" | "semantic")` uses this for hypergraph-backed queries).

## Validation Matrix
- `bun run test:integration` – Runs sqlite-backed suites for hypergraph persistence, agent graphstore, graph router, workflow capture (start → stream → resume → reasoning), and workflow reasoning.
- `bun run smoke:hypergraph [--use-existing-db]` – CLI smoke for capture → persist → reload.
- `bun test packages/runtime/test/learning.integration.test.ts` – Verifies that `LearningEngine.persistUpdatesBatch` applies supervised `KnowledgeUpdate[]` into a non-empty `Hypergraph` and calls `persistHypergraphToDb` with a `runtime:<runId>` resource.
- `.github/workflows/postgres-nightly.yml` – Nightly Postgres run executes migrations, embed E2E (with `RUN_EMBED_MODEL_TESTS=1` and `RAG_ENRICH_GRAPH=1`), hypergraph smoke, the runtime learning integration test, and the workflow capture suite (with `WORKFLOW_CAPTURE_TEST_USE_EXISTING_DB=1`) to cover production-only code paths.

## Open Focus Areas
- **Mindscape integration:** Continue to visualise and edit the persisted hypergraph rather than maintaining separate React Flow graphs. The current initializer stitches notes/reminders (`graph.dbId`) and knowledge (`graph.runQuery` results) together; future work should extend this to more resource types (workflow runs, reasoning chains, RAG documents).
- **Advanced indices:** the current implementation meets latency targets, but spatial (embedding) indices can be optimized once Mindscape + embeddings share a contract.
- **Observability:** capture/copy metrics exist; future work includes surfacing per-resource graph sizes and query hit/miss ratios via `@alfred/metrics`.

## UI Integration Notes
- **Mindscape → Graph:** When users connect nodes in the mindscape canvas, write through the existing tRPC graph mutations (`graph.connect`) so `persistKnowledge` / `upsertEdges` stay the single write path. Treat React Flow state as a view-model derived from the persisted graph.
- **Hypergraph/Graph → Mindscape:** Mindscape initializer already hydrates note/reminder nodes and edges from `note.list`, `remind.due`, `graph.getEdges`, and `graph.watchEdges`. It now also calls `graph.runQuery` (`kind: "traverse"`) for known `dbId` nodes and materialises returned `UnifiedNode` records as `knowledge` nodes with `graph.dbId` / `graph.hgHash` mappings.
- **Selection & Editing:** Detail panels should fetch neighbors via `graph.getEdges`/`graph.getNeighbors` (or `graph.runQuery` with `kind: "traverse"`) for the selected node so the UI reflects the DB-backed graph, not local approximations.
- **Testing:** UI tests that depend on the graph can either use the full API/server harness with sqlite or inject a fake tRPC client via `apps/web/src/test/render-route.tsx`. The `mindscape.graph.test.tsx` suite exercises the latter to confirm that `MindscapeCanvas` consumes `graph.runQuery` output.
