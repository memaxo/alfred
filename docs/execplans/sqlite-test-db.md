# SQLite Test Harness for @alfred/db

This ExecPlan is a living document maintained in accordance with `.agent/PLANS.md`. Keep every section, especially `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`, current as work advances.

## Purpose / Big Picture

Developers need the real Postgres connection string for runtime behavior (`config/env.example` already defines `postgresql://alfred:alfred@localhost:5432/alfred`), yet most unit tests should not depend on a running Postgres instance. Drizzle recommends using an in-memory SQLite database for fast, deterministic tests. This plan adds a test-only SQLite fallback inside `@alfred/db` so any package that loads `@alfred/db` during `bun test` can operate without a Postgres server, while preserving the existing Postgres-only behavior for production code paths. Acceptance means: (1) loading `@alfred/db` without `DATABASE_URL` during tests no longer throws; (2) production builds still require a Postgres URL; (3) documentation clearly states where the Postgres URL lives and how to opt into the SQLite mock.

## Progress

- [x] (2025-11-20 20:35Z) Authored this ExecPlan after reviewing `.agent/PLANS.md`, `packages/db/src/client.ts`, `config/env.example`, and the failing `packages/embed` tests.
- [x] (2025-11-20 21:05Z) Updated `packages/db/src/client.ts` to detect SQLite URLs (or `bun test` mode without `DATABASE_URL`), instantiate `drizzle-orm/bun-sqlite` with `bun:sqlite`, and fall back to Postgres otherwise.
- [x] (2025-11-20 21:12Z) Documented the behavior in `README.md`, `packages/db/README.md`, `config/env.example`, and `config/env.test`, pointing readers to the canonical Postgres URL and the new SQLite fallback.
- [x] (2025-11-20 21:40Z) Re-ran `bun run typecheck`; failure now limited to existing issues in `packages/knowledge`, `packages/agent`, plus a new `tsvector` import warning which is being fixed within this effort.
- [x] (2025-11-20 22:00Z) Ran `cd packages/embed && bun run test`; suites progressed until an “Export named 'tsvector' not found” error surfaced once `@alfred/db` initialized successfully under SQLite.
- [x] (2025-11-20 22:30Z) Added `packages/db/src/sqlite/schema.ts` and auto-ran lightweight DDL plus SQL rewrites (`gen_random_uuid()`, `now()`) so sqlite can ingest documents/messages.
- [x] (2025-11-20 22:55Z) Updated repos using prepared statements (conversation/user) to fall back to plain queries when sqlite is active, preventing table creation errors during module import.
- [x] (2025-11-20 23:25Z) Introduced `@alfred/db/testing` helpers (`describePostgres`, `describeSqlite`, `requirePostgresTestEnv`) and applied them to `packages/embed/test/e2e.test.ts` so Postgres-only suites skip automatically when sqlite is active.
- [x] (2025-11-20 23:45Z) Split testing pipelines: root scripts + Turbo tasks now expose `test:sqlite` (default, no `DATABASE_URL`) and `test:postgres` (requires Postgres, sets `RUN_DB_TESTS=1`). CI runs both before integration/smoke tests.
- [ ] Capture outcomes, surprises, and decisions below.

## Surprises & Discoveries

- Observation: `drizzle-orm/bun-sqlite` works with tables defined via `pgTable` (it generates SQL the SQLite engine accepts) as long as we create the table manually; quick spike via `tmp-sqlite-test.ts` inserting/selecting rows succeeded. Evidence: local Bun script at 20:55Z printed `[{ id: "a" }]`.
- Observation: Importing `drizzle-orm/bun-sqlite` directly caused the TypeScript compiler to treat `db.insert()` as a union of Postgres and SQLite builders. Switched to `createRequire` + `any` to load the sqlite driver lazily so downstream repo code keeps the Postgres-only types.
- Observation: Once the SQLite fallback succeeded, type-checking exposed additional pre-existing issues in `packages/knowledge` (interval-tree nullability) and `packages/agent` (prepare step typing). Also discovered that `tsvector` is no longer exported by `drizzle-orm/pg-core`, so a local `customType` helper was added in `packages/db/src/schema/graph.ts`.
- Observation: Bun’s `Database` API doesn’t expose `db.function`, so Postgres-specific calls like `gen_random_uuid()` and `now()` must be rewritten before statements are prepared; string replacements in `sqlite.prepare` keep inserts working.
- Observation: Even with sqlite tables in place, RAG e2e tests still fail on Postgres-only SQL (`SET LOCAL hnsw.ef_search`). Need a future guard or sqlite-friendly code path for those queries if we want those suites to pass without Postgres.
- Observation: Providing `describePostgres` / `describeSqlite` wrappers under `@alfred/db/testing` makes Postgres-only suites visibly “skipped” instead of failing with sqlite errors, which gives instant feedback when contributors add new DB tests.
- Observation: Running `bun run test:postgres` now requires an actual Postgres instance; developers get immediate failures if they forget to set `DATABASE_URL`, while `bun run test:sqlite` remains zero-config for day-to-day work.

## Decision Log

- Decision: Default to `sqlite::memory:` only when `BUN_TEST=1` and `DATABASE_URL` is missing, keeping production behavior unchanged while allowing unit tests to run with zero config.
  Rationale: Prevents accidental SQLite usage in dev/production sessions where Postgres is required but not configured.
  Date/Author: 2025-11-20 / Codex
- Decision: Load the sqlite driver via `createRequire()` and treat it as `any` so the rest of the codebase retains pure Postgres typings while still executing against SQLite during tests.
  Rationale: Direct TypeScript imports pulled in SQLite generics and broke every `db.insert()` call; using `require` isolates those types to the fallback path.
  Date/Author: 2025-11-20 / Codex
- Decision: Introduced `packages/db/src/sqlite/schema.ts` plus statement rewrites for `gen_random_uuid()`/`now()` so sqlite can ingest rows without Postgres extensions.
  Rationale: Bun’s sqlite bindings don’t expose user-defined SQL functions, so rewriting SQL text is the most reliable cross-platform approach.
  Date/Author: 2025-11-20 / Codex
- Decision: Disable prepared statements for conversation/preferences repos when sqlite is active.
  Rationale: Prepared queries execute at module load time, which fails before sqlite tables exist; falling back to plain selects keeps tests from crashing while preserving prepared statements in Postgres.
  Date/Author: 2025-11-20 / Codex

## Outcomes & Retrospective

- With sqlite fallback enabled, importing `@alfred/db` in Bun tests no longer throws, and unit suites that don’t execute Postgres-only SQL run normally. Full `packages/embed` E2E tests still fail on sqlite because the RAG repository issues `SET LOCAL hnsw.ef_search` and other Postgres-exclusive statements; either those tests need a Postgres URL or the repo requires sqlite-safe branches before we can mark this plan complete.

## Context and Orientation

`packages/db/src/client.ts` exports the singleton `db` plus factory helpers. It currently throws when `DATABASE_URL` is unset, breaking unrelated packages during `bun test`. The real Postgres connection string lives in `config/env.example` (`postgresql://alfred:alfred@localhost:5432/alfred`) and `config/env.test` (test database). We will add a SQLite fallback that activates only when:
1. `process.env.DATABASE_URL` is explicitly set to a `sqlite:` or `file:` URI, or
2. `process.env.DATABASE_URL` is absent but `BUN_TEST=1` (Bun’s default when running `bun test`).

Drizzle’s SQLite driver (`drizzle-orm/bun-sqlite`) works with `bun:sqlite`, so we can follow their “use SQLite for mocks” guidance without affecting production Postgres usage.

## Plan of Work

1. Enhance `resolveConnectionString` in `packages/db/src/client.ts` to accept an `allowMockSqlite` flag. When true and both the explicit and environment strings are empty, default to `sqlite::memory:` during Bun tests (`BUN_TEST=1`). Otherwise, keep the existing error.
2. Introduce helper utilities in the same file: `isSqliteConnection` and `normalizeSqlitePath`. When the resolved connection string targets SQLite (prefix `sqlite:`, `file:`, or equals `:memory:`), instantiate `new Database(path)` from `bun:sqlite` and pass it to `drizzle-orm/bun-sqlite`. Otherwise, proceed with the Postgres pool/client as before.
3. Ensure `createPgClient`/`createPgPool` continue to require a Postgres string; only the generic `createDrizzleClient` and default `db` use the SQLite fallback.
4. Update `config/env.example` (and optionally `config/env.test`) with comments clarifying: keep the Postgres URL for production, but tests may override with SQLite by exporting `DATABASE_URL=sqlite::memory:` or leaving it blank so the fallback engages automatically during `bun test`.
5. Document the behavior in `README.md` and `packages/db/README.md`, including the actual Postgres URL path and instructions for tests.
6. Validate via `bun run typecheck` (expecting unrelated pre-existing TypeScript issues; record them) and `cd packages/embed && bun run test` to confirm the missing-URL failure disappears.
7. Add `@alfred/db/testing` helpers for Bun test suites and update representative tests (e.g., embed E2E) so they declare their Postgres/sqlite requirements explicitly.
8. Split root/Turbo test commands into `test:sqlite` and `test:postgres`, update the `ci` script to run both, and document the workflow in the README so contributors know which command to use.

## Concrete Steps

1. Edit `packages/db/src/client.ts` as described above. Keep changes additive and well-commented.
2. Update environment templates/documentation.
3. Run `bun run typecheck` at repo root.
4. Run `cd packages/embed && bun run test`.
5. Update this ExecPlan’s progress, surprises, decisions, and outcomes after each major step.

## Validation and Acceptance

- `bun run typecheck` completes (or fails only because of unrelated known issues noted in this plan).
- `bun run test` inside `packages/embed` succeeds without requiring `DATABASE_URL`.
- Manual inspection confirms that importing `@alfred/db` in a test with no `DATABASE_URL` no longer throws.
- Documentation clearly identifies the production Postgres URL (from `config/env.example`) and the SQLite testing fallback procedure.

## Idempotence and Recovery

Switching between Postgres and SQLite is controlled entirely by the `DATABASE_URL` environment variable. Developers can rerun `bun test` repeatedly; the SQLite database is in-memory by default. Production supervisors simply keep `DATABASE_URL` pointing at Postgres—no behavior change. If problems occur, deleting the new SQLite-specific branches and re-running tests restores the previous requirement for Postgres.

## Artifacts and Notes

- Capture truncated logs from `bun test` once the fallback is verified (showing that the suite runs without a Postgres URL) and paste them here when available.

## Interfaces and Dependencies

- Uses Bun’s built-in `bun:sqlite` driver plus `drizzle-orm/bun-sqlite`.
- Postgres connectivity continues to rely on `pg`.
- No new runtime dependencies are introduced beyond Bun’s standard library.

---

- **2025-11-20 (Codex)**: Initial ExecPlan creation capturing scope, motivation, and validation steps.
