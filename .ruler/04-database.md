# Database Rules

1. **Source of truth.** Migrations in `packages/db/src/migrations` define the schema. Never edit generated SQL directly in production environments—add new migrations.
2. **Vector support.** Local Postgres runs via `pgvector/pgvector:pg16`. Keep `CREATE EXTENSION IF NOT EXISTS vector` in the earliest migration and verify with `\dx`.
3. **Idempotent migrations.** Wrap DDL in `IF NOT EXISTS` / `IF EXISTS` when safe. Non-idempotent operations must document irreversible effects.
4. **Index discipline.** Composite indexes should match the repo query predicates. When adding new queries, expand `0008_indexes.sql` or subsequent migrations accordingly.
5. **Migration runner.** Use `packages/db/scripts/migrate.ts` everywhere (CI, local dev). It records applied migrations in `_migrations`.
6. **Testing.** Write Vitest suites under `packages/db/test` that spin up an isolated database schema and assert repo behaviour (notes, reminders, timers, etc.).
