# Database Rules

1. **Source of truth.** Migrations in `packages/db/src/migrations` define the schema. Never edit generated SQL directly in production environments—add new migrations, and mirror new features (e.g., eval definitions/runs/scores) with dedicated SQL files.
2. **Vector support.** Local Postgres runs via `pgvector/pgvector:pg16`. Keep `CREATE EXTENSION IF NOT EXISTS vector` in the earliest migration and verify with `\dx`. When defining columns, import `vector` from `drizzle-orm/pg-core` (not `drizzle-orm-pgvector/pg`) to avoid SSR bundling issues in the web app.
3. **Idempotent migrations.** Wrap DDL in `IF NOT EXISTS` / `IF EXISTS` when safe. Non-idempotent operations must document irreversible effects.
4. **Index discipline.** Composite indexes should match the repo query predicates. When adding new queries, expand `0008_indexes.sql` or subsequent migrations accordingly. Eval tables must index `(def_id, dataset_id, started_at)` for run listings and `(run_id, point_id, scorer)` for score lookups, as seen in `0012_evals.sql`.
5. **Migration runner.** Use `packages/db/scripts/migrate.ts` everywhere (CI, local dev). It records applied migrations in `_migrations`.
6. **Testing.** Write Vitest suites under `packages/db/test` that spin up an isolated database schema and assert repo behaviour (notes, reminders, timers, eval runs/scores, etc.).
7. **Laminar correlation.** Columns like `laminar_eval_id` belong in the primary run table to enable dual-write correlation. Always backfill with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migrations so replays remain idempotent.
