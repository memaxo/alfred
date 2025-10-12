# Migration Guide

1. **Create new files** using the next sequential number (`0011_name.sql`). Keep names single-word snake case if unavoidable (e.g. `vectorindex`).
2. **Structure.** Place DDL statements in dependency order: extensions → tables → indexes → constraints → seeds (if any).
3. **Transaction boundaries.** The migration runner wraps each file in a transaction. Avoid statements that implicitly break transactions (e.g. `CREATE INDEX CONCURRENTLY`).
4. **Rollback notes.** Add comments describing manual rollback steps when dropping columns or performing destructive operations.
5. **Testing.** After authoring a migration, run `bun run db:migrate` against a fresh database and ensure `_migrations` count matches file count.
