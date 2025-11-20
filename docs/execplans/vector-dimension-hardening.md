# Vector Embedding Hardening and Schema Alignment

This ExecPlan is a living document maintained in accordance with `.agent/PLANS.md` from the repository root. Update every section—especially `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`—as soon as work advances.

## Purpose / Big Picture

ALFRED currently assumes that every retrieval-augmented generation (RAG) chunk and every stored user fact carries a 1024-dimensional embedding produced by the local KaLM model. Two historical migrations (`0024_embed_local.sql` and `0027_user_facts_embedding_dimension.sql`) attempted to change the column types from 1536 to 1024 dimensions but never nulled the pre-existing data, so they can fail against non-empty tables or leave stale 1536-dimension vectors in place. The reasoning index on `memory_nodes` can also fail when dirty data supplies non-numeric JSON. This plan ensures that migrations are safe and deterministic, all embeddings reset when dimensions change, and the Drizzle schema plus helper packages continue to source the shared `EMBEDDING_DIM`. After completing this plan, a developer can rerun `@alfred/db` migrations on a database with existing embeddings and reliably observe that the schema applies cleanly, existing embeddings are marked for regeneration, and the reasoning index is robust against garbage data.

## Progress

- [x] (2025-11-20 19:12Z) Authored this ExecPlan after reviewing `.agent/PLANS.md`, migrations `0023`, `0024`, `0027`, and the Drizzle schemas under `packages/db/src/schema`.
- [x] (2025-11-20 19:32Z) Added `0031_rag_chunks_embedding_reset.sql` to null legacy embeddings and rebuild the HNSW index with `CREATE INDEX IF NOT EXISTS`.
- [x] (2025-11-20 19:36Z) Added `0032_user_facts_embedding_reset.sql` mirroring the rag chunk remediation for `user_facts`.
- [x] (2025-11-20 19:40Z) Added `0033_memory_nodes_confidence_index.sql` to guard numeric casts with a regex filter before rebuilding the index.
- [ ] (2025-11-20 19:47Z) Attempted `bun run typecheck`; blocked by pre-existing errors in `packages/knowledge` and `packages/agent` (see Surprises section) so this validation remains outstanding.
- [ ] (2025-11-20 20:06Z) Attempted `cd packages/embed && bun run test`; embedding tests passed but the suite exited early because `packages/db` requires `DATABASE_URL`, so this validation step remains outstanding pending env guidance.
- [ ] Document outcomes and any surprises in this file.

## Surprises & Discoveries

- Observation: `bun run typecheck` currently fails before touching the new migrations because `packages/knowledge/src/indices/interval-tree.ts` has implicit `any` flows and `packages/agent/src/agents.ts` violates `PrepareStepFunction` typing. Evidence: TypeScript errors TS7022/TS2345/TS2322 logged at 19:47Z.
  Evidence: `packages/knowledge/src/indices/interval-tree.ts:115`, `packages/agent/src/agents.ts:17`.
- Observation: `bun run test` inside `packages/embed` aborts after the embed tests succeed because importing `@alfred/db` pulls in `packages/db/src/client.ts`, which throws `DATABASE_URL is required ...`. Evidence captured at 20:06Z when the suite reported “Unhandled error between tests” referencing `packages/db/src/client.ts:10`.

## Decision Log

- (2025-11-20, Codex) Opt to reset embeddings to NULL via the `ALTER COLUMN ... USING NULL::vector(1024)` pattern rather than writing ad-hoc `UPDATE` statements so that Postgres performs the rewrite atomically while we hold the exclusive lock, guaranteeing that no stale 1536-dimension payload survives the migration even if the database accepts mixed vector lengths.
- (2025-11-20, Codex) Re-created `memory_nodes_confidence_idx` with a regex guard instead of attempting to sanitize data ahead of time so the migration succeeds even when future dirty JSON sneaks in; this keeps the DDL idempotent and self-healing.

## Outcomes & Retrospective

- To be completed once migrations land and validation commands pass.

## Context and Orientation

Database migrations live under `packages/db/src/migrations`. The files of interest are:

1. `0023_reasoning.sql` adds the `memory_nodes_confidence_idx` expression index that currently assumes the JSON property is numeric.
2. `0024_embed_local.sql` and `0027_user_facts_embedding_dimension.sql` attempt to alter `rag_chunks.embedding` and `user_facts.embedding` to 1024 dimensions.
3. `packages/db/src/schema/rag.ts` and `packages/db/src/schema/user.ts` define the Drizzle schema for the same columns and already import `EMBEDDING_DIM` from `@alfred/embed`.

The migration runner (`bun run db:migrate`) executes files in lexical order, so new migrations should pick the next numbers (`0031`, `0032`, `0033`). Every migration must remain idempotent. HNSW indexes are large; always drop them before altering vector columns to avoid lock contention. `@alfred/embed` exports `EMBEDDING_DIM = 1024`, and the rest of the stack assumes that constant, so any schema drift must be caught immediately.

## Plan of Work

Describe each change in order:

1. Create `packages/db/src/migrations/0031_rag_chunks_embedding_reset.sql`. Drop `rag_chunks_embedding_hnsw`, alter the column with a `USING CASE` clause that coerces every non-null embedding to `NULL::vector(1024)`, reapply the column comment, and recreate the index with `CREATE INDEX IF NOT EXISTS` plus the `m=16, ef_construction=100` parameters. Note in comments that the migration intentionally nukes old embeddings and that downstream workers must regenerate them.
2. Create `packages/db/src/migrations/0032_user_facts_embedding_reset.sql` with the identical pattern for `user_facts`. Include explicit commentary instructing operators to rerun the fact-embedding backfill worker if necessary.
3. Create `packages/db/src/migrations/0033_memory_nodes_confidence_index.sql`. Drop the existing index if present. Recreate it only for rows whose `properties->>'confidence'` matches a strict numeric regex (`^[0-9]+(\\.[0-9]+)?$`). Cast inside the `CASE`. This prevents migration failures even if malformed data exists.
4. No Drizzle schema edits are needed because both `rag.ts` and `user.ts` already import `EMBEDDING_DIM`, but add a note in this plan (and, if necessary, a doc comment) capturing that verification. If future work reveals a schema mismatch, resolve it here.
5. Run root-level `bun run typecheck` plus `bun run test` inside `packages/embed` (fastest suite that asserts the constant is 1024) as smoke tests. Capture any surprises in this plan’s `Surprises & Discoveries` section. If `packages/db` has a narrow test to add later, mention it here for follow-up.

## Concrete Steps

1. From the repo root, create each new migration file with the SQL described above. Keep comments concise and explicit about intent.
2. After editing migrations, run `bun run typecheck` at `/Users/jackmazac/Development/alfred`.
3. Run `cd packages/embed && bun run test` to confirm the embedding package still reports `EMBEDDING_DIM = 1024`.
4. Optionally run `bun run db:migrate` against a dev database if one is configured locally; note results if executed.

Expected snippets (update with real runs):

    $ bun run typecheck
    ...expect no errors...

    $ cd packages/embed && bun run test
    ✓ EMBEDDING_DIM is 1024 (MRL truncation)
    ...

## Validation and Acceptance

The work is acceptable when:

1. `bun run typecheck` completes successfully from the repo root.
2. `bun run test` inside `packages/embed` passes, demonstrating that the shared embedding constant is intact.
3. Reviewing the new migrations shows that rerunning them is safe (`DROP INDEX IF EXISTS`, `CREATE INDEX IF NOT EXISTS`, and deterministic `ALTER TABLE ... USING ...` blocks). Optionally, applying them to a local database with artificial data that includes malformed `confidence` values succeeds without manual cleanup.

## Idempotence and Recovery

Each migration must be re-runnable: `DROP INDEX IF EXISTS` ensures the rebuild can run repeatedly, and the `ALTER TABLE ... USING` clause has deterministic output (`NULL` for every pre-existing embedding). Because these migrations only drop indexes and rewrite columns, rolling back is as simple as re-seeding embeddings via the usual backfill workflow. If a migration fails halfway, rerun the same migration file—the SQL is idempotent and will converge on the desired state.

## Artifacts and Notes

- Capture any `psql` or migration-runner output here once executed so future contributors can see examples.
- Record how long the column rewrite took on local data volumes if noteworthy (e.g., “rewriting 10k rag_chunks rows took 2.4 seconds on M3 Pro”).

## Interfaces and Dependencies

- Depends on `pgvector` 0.7+ supporting `vector(1024)` columns and `NULL::vector(1024)` expressions.
- Uses Postgres regex (`~`) to filter numeric strings in JSON before casting; no additional extensions required.
- Requires `@alfred/embed` to remain the single source of truth for `EMBEDDING_DIM`. No code changes needed, but validation commands confirm it.

---

Revision history:

- **2025-11-20 (Codex)**: Initial ExecPlan creation based on migration review; logged decision to null embeddings via the `ALTER ... USING` approach.
