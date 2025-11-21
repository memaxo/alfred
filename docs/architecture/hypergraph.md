# Knowledge Hypergraph Overview

## System Anatomy
- **packages/knowledge/** – Pure in-memory hypergraph with dirty tracking, interval-tree temporal index, optional embeddings, and AC-3/MRV query execution. Exposes `persistHypergraph`, `loadHypergraph`, and reasoning-chain helpers.
- **packages/agent/assistant/src/graphstore.ts** – Bridge that serializes hypergraph entries into `KnowledgeEntry[]`, writes them through `@alfred/db/repo/graph`, and hydrates fresh graphs on demand.
- **packages/db/** – `memory_nodes` / `memory_edges` schema plus repo helpers (`getNeighbors`, `getSubgraph`, `findPath`, `getReasoningChain`) shared by tRPC routers, smoke scripts, and workflow capture flows.
- **packages/api/** – Graph + workflow routers fetch from the repo layer, so capture → persist → reload is validated via tRPC (see `graph.integration.test.ts`, `workflow.capture.integration.test.ts`, `workflow.reasoning.integration.test.ts`).

## Persistence Flow
1. Agent captures facts/relations → hypergraph mutates in memory.
2. `persistHypergraphToDb(resource)` (agent bridge) extracts dirty nodes/edges and calls `persistKnowledge`, which upserts `memory_nodes` / `memory_edges`.
3. Workflow reasoning events call `persistReasoning`, which writes temporal chains plus reasoning edges. `workflow.reasoning` rebuilds the chain via `getReasoningChain` + `reconstructReasoningChain`.
4. On reload, `loadHypergraphFromDb(resource)` hydrates a fresh hypergraph before executing queries.

## Validation Matrix
- `bun run test:integration` – Runs sqlite-backed suites for hypergraph persistence, agent graphstore, graph router, workflow capture (start → stream → resume → reasoning), and workflow reasoning.
- `bun run smoke:hypergraph [--use-existing-db]` – CLI smoke for capture → persist → reload.
- `.github/workflows/postgres-nightly.yml` – Nightly Postgres run executes migrations, embed E2E, hypergraph smoke, and the workflow capture suite (with `WORKFLOW_CAPTURE_TEST_USE_EXISTING_DB=1`) to cover production-only code paths.

## Open Focus Areas
- **Mindscape integration:** visualize and edit the persisted hypergraph rather than maintaining separate React Flow graphs.
- **Advanced indices:** the current implementation meets latency targets, but spatial (embedding) indices can be optimized once mindscape + embeddings share a contract.
- **Observability:** capture/copy metrics exist; future work includes surfacing per-resource graph sizes and query hit/miss ratios via `@alfred/metrics`.

