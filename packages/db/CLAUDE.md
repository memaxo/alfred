

<!-- Source: .ruler/migration-guide.md -->

# Migration Guide

1. **Create new files** using the next sequential number (`0011_name.sql`). Keep names single-word snake case if unavoidable (e.g. `vectorindex`).
2. **Structure.** Place DDL statements in dependency order: extensions → tables → indexes → constraints → seeds (if any).
3. **Transaction boundaries.** The migration runner wraps each file in a transaction. Avoid statements that implicitly break transactions (e.g. `CREATE INDEX CONCURRENTLY`).
4. **Rollback notes.** Add comments describing manual rollback steps when dropping columns or performing destructive operations.
5. **Testing.** After authoring a migration, run `bun run db:migrate` against a fresh database and ensure `_migrations` count matches file count.



<!-- Source: .ruler/schema-rules.md -->

# Schema Rules

1. **Single source.** Define tables with Drizzle schema builders in `packages/db/src/schema`. Keep column names aligned with migration SQL.
2. **Timestamps.** Use `timestamp("created_at", { withTimezone: true }).defaultNow()` style helpers. Avoid relying on application clocks for created/updated fields.
3. **Vector columns.** Use the pgvector helper for embedding columns. Always document the expected dimensionality in comments.
4. **Foreign keys.** Declare relationships explicitly so we can leverage Drizzle relations when needed. Name constraints `<table>_<column>_fkey`.
5. **Enums.** Prefer Postgres enums defined in migrations and referenced via Drizzle `pgEnum`. Avoid TypeScript-only enums for persisted values.
