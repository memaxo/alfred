# Integration & Smoke Coverage Expansion ExecPlan

This ExecPlan is maintained per `.agent/PLANS.md`. It is the single source of truth for hardening Alfred's integration/smoke testing story along three fronts: reproducible DB-backed integration tests (leveraging the new SQLite harness), a lightweight smoke script that exercises capture → persist → reload → query, and a RAG/doc test suite that no longer depends on spinning up the native embed pool.

## Purpose / Big Picture

Guarantee that Alfred’s critical reasoning loop (hypergraph capture + persistence + query) and RAG ingest/retrieve flows keep working in real environments without relying on manual QA. By the end of this effort a contributor should be able to: (1) run `bun test --filter integration` (or similar) locally or in CI to verify DB-backed behavior, (2) execute a documented smoke script that demonstrates capture → persist → reload → query against the agent stack, and (3) run the full `packages/rag` test suite without provisioning the heavy embed pool process. This raises confidence in releases and shortens MTTR when regressions slip in.

## Progress

- [ ] (2025-11-20 21:05Z) Baseline repository survey: confirm existing SQLite harness, smoke scripts, and RAG test behavior so instructions match HEAD.
- [ ] (2025-11-20 21:05Z) Integration tests: design + land reproducible SQLite-backed tests for hypergraph persistence/query and graph repo traversal; ensure CI/docs capture the RUN_DB_TESTS story.
- [ ] (2025-11-20 21:05Z) Smoke script: add CLI (or package script) that runs capture → persist → reload → query and document how to call it.
- [ ] (2025-11-20 21:05Z) RAG/doc tests: rework embedding layer (mockable provider) so `bun test packages/rag` runs without spawn errors; document fallback harness.
- [ ] (2025-11-20 21:05Z) Validation + docs: update READMEs/ExecPlan with instructions for the new commands; ensure CI wires in the integration suite.

## Surprises & Discoveries

- None yet. Capture unexpected SQLite limitations, Bun test runner quirks, or embed mocking issues here.

## Decision Log

- Pending future work.

## Outcomes & Retrospective

Populate after delivering the integration suite and smoke script: highlight the new commands, CI wiring, and any tradeoffs (e.g., SQLite vs Postgres equivalence).

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

- Capture shell transcripts for `bun run test:integration` and the smoke script once implemented.
- Record SQLite harness decisions or Postgres-only fallbacks in this section to guide future contributors.

## Interfaces and Dependencies

- SQLite test harness under `packages/api/test/utils/db.*` (or a new shared helper) for reproducible integration tests.
- Hypergraph persistence bridge (`packages/agent/assistant/src/hypergraph-bridge.ts`) and knowledge persistence module (`packages/knowledge/src/persist.ts`).
- RAG doc module (`packages/rag/src/doc.ts`) + embedding provider abstraction; tests must be able to inject a stub provider without pulling in `@alfred/embed`.
- CLI/smoke script under `scripts/` or `packages/runtime/bin/`, documented in `README.md` and the ExecPlan.

## Revision History

- 2025-11-20: Initial ExecPlan created to scope integration tests, smoke script, and RAG test reliability (Codex).
