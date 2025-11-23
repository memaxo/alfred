# Database Rules

1. **Source of truth.** Migrations in `packages/db/src/migrations` define the schema. Never edit generated SQL directly in production environments—add new migrations, and mirror new features (e.g., eval definitions/runs/scores) with dedicated SQL files.
2. **Vector support.** Local Postgres runs via `pgvector/pgvector:pg16`. Keep `CREATE EXTENSION IF NOT EXISTS vector` in the earliest migration and verify with `\dx`. When defining columns, import `vector` from `drizzle-orm/pg-core` (not `drizzle-orm-pgvector/pg`) to avoid SSR bundling issues in the web app.
3. **Idempotent migrations.** Wrap DDL in `IF NOT EXISTS` / `IF EXISTS` when safe. Non-idempotent operations must document irreversible effects.
4. **Index discipline.** Composite indexes should match the repo query predicates. When adding new queries, expand `0008_indexes.sql` or subsequent migrations accordingly. Eval tables must index `(def_id, dataset_id, started_at)` for run listings and `(run_id, point_id, scorer)` for score lookups, as seen in `0012_evals.sql`. Use partial indexes (`WHERE column IS NOT NULL`) to reduce index size for sparse columns.
5. **Migration runner.** Use `packages/db/scripts/migrate.ts` everywhere (CI, local dev). It records applied migrations in `_migrations`.
6. **Schema sync.** Keep Drizzle schema files (`packages/db/src/schema/*.ts`) aligned with migrations. Vector dimensions must use `EMBEDDING_DIM` from `@alfred/embed` (single source of truth). When changing vector dimensions, drop indexes before `ALTER COLUMN TYPE`, recreate with `IF NOT EXISTS`, and document that existing embeddings become NULL.
7. **Testing.** Write Vitest suites under `packages/db/test` that spin up an isolated database schema and assert repo behaviour (notes, reminders, timers, eval runs/scores, etc.).
8. **Laminar correlation.** Columns like `laminar_eval_id` belong in the primary run table to enable dual-write correlation. Always backfill with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migrations so replays remain idempotent.
9. **Transactions.** Use `db.transaction()` for multi-step operations that must be atomic:
   ```typescript
   await db.transaction(async (tx) => {
     await tx.insert(users).values({...});
     await tx.insert(profiles).values({...});
   });
   ```
   Transactions automatically rollback on error. Use for operations that must succeed or fail together. PostgreSQL reserves a dedicated connection from the pool—keep transactions short to avoid connection exhaustion.
10. **Batch operations.** Use `db.batch()` for multiple independent queries (Drizzle batch API):
   ```typescript
   await db.batch([
     db.select().from(users).where(...),
     db.select().from(profiles).where(...),
     db.insert(notes).values({...}),
   ]);
   ```
   Batch operations execute sequentially in a single round-trip. Use for independent queries that don't require atomicity.
11. **Savepoints.** Use savepoints for partial rollbacks within transactions:
    ```typescript
    await db.transaction(async (tx) => {
      await tx.insert(users).values({...});
      await tx.savepoint(async (sp) => {
        await sp.update(profiles).set({...});
        if (condition) throw new Error("Rollback savepoint");
      });
      // Transaction continues even if savepoint rolled back
    });
    ```
12. **Query performance.** All repo queries must complete in <10ms (p99). Instrument with metrics before optimizing.
13. **Connection pooling.** PostgreSQL transactions reserve connections. Avoid long-running transactions to prevent connection exhaustion.
15. **Bulk updates.** Prefer batch updates with `Promise.all` + chunks (size 10-50) over `db.transaction` or sequential loops for high-volume writes. Use `UPDATE ... FROM (VALUES ...)` for massive updates if possible.
