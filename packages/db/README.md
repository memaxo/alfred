# @alfred/db

Shared Drizzle schemas, repository helpers, and migration runner scaffolding for ALFRED.

## Responsibilities

- Own the Postgres client bootstrap (`src/client.ts`) and export a shared `db` instance.
- Publish table schemas and repository helpers under stable namespaces (`assistantSchema`, `noteRepo`, …).
- Host migrations in `src/migrations` and expose the custom runner via `scripts/migrate.ts`.

## Local Development

```
bun run db:start
bun run db:migrate
```

These commands rely on `DATABASE_URL` from `config/env.example`. The default bootstrap uses a simple pool; production will wire PgBouncer in a later phase.

## Next Steps

- Fill in repository implementations with real queries.
- Add Vitest suites under `test/` to validate repo behaviour against a disposable database.
- Harden `createPgPool`/`createPgClient` with retry and backoff strategies before production launch.
