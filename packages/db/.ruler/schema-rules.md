# Schema Rules

1. **Single source.** Define tables with Drizzle schema builders in `packages/db/src/schema`. Keep column names aligned with migration SQL.
2. **Timestamps.** Use `timestamp("created_at", { withTimezone: true }).defaultNow()` style helpers. Avoid relying on application clocks for created/updated fields.
3. **Vector columns.** Use the pgvector helper for embedding columns. Always document the expected dimensionality in comments.
4. **Foreign keys.** Declare relationships explicitly so we can leverage Drizzle relations when needed. Name constraints `<table>_<column>_fkey`.
5. **Enums.** Prefer Postgres enums defined in migrations and referenced via Drizzle `pgEnum`. Avoid TypeScript-only enums for persisted values.
