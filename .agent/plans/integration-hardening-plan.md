# Integration & Smoke Coverage Expansion ExecPlan

This ExecPlan is maintained per `.agent/PLANS.md`. It is the single source of truth for hardening Alfred's integration/smoke testing story along three fronts: reproducible DB-backed integration tests (leveraging the new SQLite harness), a lightweight smoke script that exercises capture → persist → reload → query, and a RAG/doc test suite that no longer depends on spinning up the native embed pool.

## Purpose / Big Picture

Guarantee that Alfred’s critical reasoning loop (hypergraph capture + persistence + query) and RAG ingest/retrieve flows keep working in real environments without relying on manual QA. By the end of this effort a contributor should be able to: (1) run `bun test --filter integration` (or similar) locally or in CI to verify DB-backed behavior, (2) execute a documented smoke script that demonstrates capture → persist → reload → query against the agent stack, and (3) run the full `packages/rag` test suite without provisioning the heavy embed pool process. This raises confidence in releases and shortens MTTR when regressions slip in.

## Progress

- [x] (2025-11-20 21:20Z) Baseline repository survey: reviewed SQLite fallback in `packages/db/src/client.ts`, noted missing memory graph schema + absent smoke tooling, and captured findings here.
- [x] (2025-11-20 22:05Z) Integration tests: shipped `packages/knowledge/test/hypergraph.integration.test.ts`, expanded the SQLite schema, and added `bun run test:integration` for reproducible coverage.
- [x] (2025-11-20 22:20Z) Smoke script: added `scripts/smoke-hypergraph.ts` with SQLite-by-default behavior and a `--use-existing-db` escape hatch, plus a root `smoke:hypergraph` script.
- [x] (2025-11-20 22:35Z) RAG/doc tests: introduced `setEmbeddingProvider` and rewrote `packages/rag/test/doc.test.ts` so the suite runs without spinning up the embed pool.
- [x] (2025-11-20 22:45Z) Validation + docs: updated README command tables/testing guidance, ran `bun run test:integration`, `bun test packages/rag`, `bun test packages/knowledge`, and `bun run smoke:hypergraph`.
- [x] (2025-11-20 23:18Z) Added `packages/api/test/graph.integration.test.ts`, expanded `bun run test:integration` to run both knowledge + graph router suites, and patched the SQLite schema with a `memory_edges.hash` unique index to keep connect conflicts deterministic.
- [x] (2025-11-20 23:35Z) Added `packages/agent/assistant/test/graphstore.integration.test.ts` so the agent persistence bridge is covered on sqlite and wired that suite into `bun run test:integration` (now running 3 files / 10 specs).
- [x] (2025-11-20 23:55Z) Added `packages/api/test/workflow.reasoning.integration.test.ts` plus sqlite workflow tables, updated `workflow.reasoning` JSON parsing, and created `.github/workflows/postgres-nightly.yml` to run embed E2E + hypergraph smoke against Postgres nightly.

## Surprises & Discoveries

- SQLite fallback originally lacked `memory_nodes` / `memory_edges` tables (and the `label_tsvector` column). Added schema bootstrap + idempotent `ALTER TABLE` calls to keep integration tests deterministic.
- Drizzle emitted uppercase `NOW()` in generated SQL, so we had to normalize statements (regex replace) rather than relying on Bun’s sqlite driver functions.
- Static imports pulled in `@alfred/db` before tests/scripts could set `DATABASE_URL`; switching to dynamic imports (and explicit overrides inside integration tests) ensured we always hit SQLite instead of an unset Postgres instance.

## Decision Log

- Decision: Force integration tests to pin `DATABASE_URL=sqlite::memory:` inside the suite.
  Rationale: Keeps the tests reproducible regardless of the developer’s shell env; Postgres runs can still opt in manually.
  Date/Author: 2025-11-20 / Codex.
- Decision: Default the smoke script to SQLite unless `--use-existing-db` is passed.
  Rationale: Prevents accidental writes to a production database while still allowing explicit Postgres runs.
  Date/Author: 2025-11-20 / Codex.
- Decision: Introduce `setEmbeddingProvider` so doc/RAG tests can stub embeddings and run without the heavy pool.
  Rationale: Enables `bun test packages/rag` in CI and keeps tests fast.
  Date/Author: 2025-11-20 / Codex.
- Decision: Extend the SQLite schema with a `memory_edges.hash` unique index so API-level `graph.connect` tests exercise the same conflict semantics as Postgres while running in-memory.
  Rationale: Prevents spurious sqlite errors and keeps the fallback truthful when `onConflictDoNothing` targets the hash column.
  Date/Author: 2025-11-20 / Codex.
- Decision: Create `packages/api/test/graph.integration.test.ts` to drive capture → persist → `graph.getEdges`/`graph.connect` via tRPC, ensuring API consumers are covered by the same sqlite harness used by knowledge tests.
  Rationale: Validates the end-to-end flow (knowledge bridge → DB → router) without mocking the router or requiring Postgres.
  Date/Author: 2025-11-20 / Codex.
- Decision: Add `packages/agent/assistant/test/graphstore.integration.test.ts` so `persistKnowledge` is validated directly (nodes + edges + idempotence) under sqlite and include it in the shared `test:integration` command.
  Rationale: Confirms the agent bridge produces DB rows exactly as expected, catching regressions before they bubble into API layers.
  Date/Author: 2025-11-20 / Codex.
- Decision: Extend the sqlite schema with workflow tables, add a workflow reasoning sqlite integration test, and parse `workflowRuns.inputData` when it’s a string so sqlite fallbacks behave like Postgres.
  Rationale: Enables end-to-end coverage for the workflow/assistant entry point without Postgres while keeping router semantics identical.
  Date/Author: 2025-11-20 / Codex.
- Decision: Add `.github/workflows/postgres-nightly.yml` to run embed E2E and the hypergraph smoke script against Postgres on a schedule (and on-demand) for production-only coverage.
  Rationale: Ensures vector + Postgres-only flows stay healthy even though default CI relies on sqlite.
  Date/Author: 2025-11-20 / Codex.

## Outcomes & Retrospective

- Integration + smoke commands now exist (`bun run test:integration`, `bun run smoke:hypergraph`). RAG/doc tests are reliable without native dependencies. API graph router coverage now runs on sqlite, catching regressions before Postgres is available. Remaining work: monitor CI flakiness, add agent/workflow-level coverage, and wire a Postgres-only stage for heavyweight flows.

## Context and Orientation

Current state:
- `packages/db/test/graph.test.ts` gates integration tests behind `RUN_DB_TESTS` and expects a live Postgres connection; there is a new SQLite harness in `packages/api/test/utils/db.ts` but it is not reused broadly.
- There is no documented smoke command to run a capture/persist/reload/query scenario; contributors typically exercise flows manually.
- `packages/rag/test/doc.test.ts` spins up the embed pool, which requires native dependencies and model downloads; CI/local runs often skip the suite.

Key constraints:
- Keep integration tests deterministic and hermetic by default (SQLite or dockerized Postgres stub).
- Avoid heavy dependencies in default `bun test` runs (no GPU/Metal requirements).
- Ensure smoke script is idempotent and can run locally without bleeding into production data.

## Plan of Work

1. **Survey & harness selection** – Locate the SQLite test helpers introduced for preference/DB tests (`packages/api/test/utils/db.*`), confirm compatibility with knowledge + graph repos, and document any schema features that require Postgres-only behavior (e.g., vector, generated columns). Decide whether to use SQLite for most integration coverage with targeted Postgres fallbacks.
2. **Integration test scaffolding** – Create a new test entry point (e.g., `packages/knowledge/test/integration/hypergraph.sqlite.test.ts`) that uses the SQLite harness to spin up `memory_nodes`/`memory_edges`, runs the agent bridge to persist/reload, and asserts hypergraph queries + graph repo operations. Gate Postgres-only cases via env flags.
3. **CI wiring** – Add a Turbo/bun script (e.g., `bun run test:integration`) and update `package.json`/CI config so integration tests run in pull requests. Document how contributors can run them locally.
4. **Smoke script** – Under `scripts/` (or `packages/runtime/bin/`), add a Bun/Node script that boots the agent stack (or a minimal harness), performs a capture, persists to DB (using the new bridge), reloads into a fresh hypergraph, runs `semanticQuery`, and prints results. Include CLI docs + README entry.
5. **RAG test refactor** – Abstract the embedding provider inside `packages/rag/src/doc.ts` so tests can inject a stub provider. Introduce a Bun test helper that stubs `embed`/`embedMany` and ensures the suite runs without the native pool; keep one optional test that hits the real pool under an env flag.
6. **Docs + validation** – Update `README.md` / `docs/` with instructions for the integration suite and smoke script, note the new `test:integration` target in Turbo/CI, and capture the new test commands in the ExecPlan’s Artifacts section.

## Concrete Steps

1. Inspect `packages/api/test/utils/db.ts` (and the compiled JS) to understand the SQLite harness; record findings in the plan.
2. Prototype a `bun test` file that uses the harness to run hypergraph persist/reload; once stable, expand coverage to graph repo traversal and semantically query loaded nodes.
3. Add package-level scripts (`test:integration`) and update CI config (GitHub Actions/Turbo pipeline) so integration tests run automatically.
4. Build the smoke script (`scripts/smoke-hypergraph.ts` or similar) that imports the agent capture routines, writes to SQLite/Postgres, reloads the hypergraph, and prints success output.
5. Refactor `packages/rag/src/doc.ts` to rely on an injectable embedding provider (defaulting to the real embed pool) and update tests to stub it; ensure `bun test packages/rag` passes without special envs.
6. Document all new commands in `README.md` or `docs/`, and add ExecPlan entries to `Progress`, `Surprises`, `Decision Log`, and `Artifacts` as work proceeds.

## Validation and Acceptance

- `bun run test:integration` (or equivalent) runs the SQLite-backed integration suite locally and in CI, covering hypergraph persist/reload and graph traversal scenarios.
- Running the new smoke script prints a clear success message showing capture → persist → reload → query behavior (with sample output recorded in Artifacts).
- `bun test packages/rag` no longer spins up the embed pool unless explicitly requested; the suite passes by default on developer machines/CI.

## Idempotence and Recovery

- Integration tests should reset the SQLite database between cases (the harness already truncates tables). Document how to recover if a test fails halfway and leaves stale files.
- Smoke script should accept `--reset` or automatically clean its workspace so multiple runs don’t interfere.
- Embedding stubs should default back to real providers when env flags are cleared.

## Artifacts and Notes

- 2025-11-20 22:46Z: `bun run test:integration` → 2 pass.
- 2025-11-20 22:47Z: `bun run smoke:hypergraph` (default SQLite) → emitted `{ event: "smoke.hypergraph", nodes: 3, results: 1 }`.
- 2025-11-20 22:48Z: `bun test packages/rag` → 13 pass (no embed pool spin-up).
- 2025-11-20 23:18Z: `bun run test:integration` (knowledge + graph router suites) → 8 pass.
- 2025-11-20 23:35Z: `bun run test:integration` (knowledge + agent graphstore + graph router suites) → 10 pass.
- 2025-11-20 23:55Z: `bun run test:integration` (knowledge + agent graphstore + workflow reasoning + graph router suites) → 11 pass.

## Interfaces and Dependencies

- SQLite test harness under `packages/api/test/utils/db.*` (or a new shared helper) for reproducible integration tests.
- Hypergraph persistence bridge (`packages/agent/assistant/src/hypergraph-bridge.ts`) and knowledge persistence module (`packages/knowledge/src/persist.ts`).
- RAG doc module (`packages/rag/src/doc.ts`) + embedding provider abstraction; tests must be able to inject a stub provider without pulling in `@alfred/embed`.
- CLI/smoke script under `scripts/` or `packages/runtime/bin/`, documented in `README.md` and the ExecPlan.

## Revision History

- 2025-11-20: Initial ExecPlan created to scope integration tests, smoke script, and RAG test reliability (Codex).
