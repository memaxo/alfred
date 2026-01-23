# SQLite Fallback Schema

1. **SQLite-default UUIDs.** SQLite schema must not use Postgres-only functions like `gen_random_uuid()`; use SQLite-compatible defaults.
2. **Default expressions.** SQLite `DEFAULT` expressions that call functions must be wrapped in parentheses.
3. **Normalization layer.** Any SQLite schema normalizer must only rewrite known Postgres-only functions and must produce valid SQLite SQL.
4. **Drift-catcher test.** Add a sqlite-only repo roundtrip test for new tables so schema errors fail immediately.

