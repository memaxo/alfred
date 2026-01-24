# sense-mvp-wiring

Owner: product, apps (web/native), api, db

This document explains the **repeatable wiring pattern** for adding a new “domain system” to ALFRED using the canonical layering **type → domain → DB → API → apps**, and the specific guardrails learned while implementing ALFRED Sense MVP.

## What a “domain system” is (in this repo)

A domain system is a cohesive capability that:

- has shared DTOs used across packages and apps
- has durable persistence (tables + repos) in `@alfred/db`
- exposes a thin transport surface (tRPC routers) in `@alfred/api`
- has at least one UX surface in `apps/web` and/or `apps/native`
- keeps core transformations **pure** and import-safe in its own package

## Canonical wiring: type → domain → DB → API → apps

### 1) Shared DTOs and validation live in `@alfred/type`

Pattern:

- Add domain types in `packages/type/src/<domain>.ts`
- Add Zod schemas in `packages/type/src/<domain>.zod.ts`
- Export them from `packages/type/src/index.ts`

Sense example:

- `packages/type/src/sense.ts`
- `packages/type/src/sense.zod.ts`

Guardrail:

- Do not rely on `Date` objects crossing JSON boundaries (tRPC/Web). Use strings/numbers and parse at the edge, or validate+transform via Zod.

### 2) Pure domain logic lives in `packages/<domain>`

Pattern:

- Keep transformations pure-by-default and import-safe (no DB, no API, no import-time side effects)
- Provide small helpers for scoring/formatting/corrections that routers can call
- Add unit tests for invariants

Sense example:

- `packages/sense/src/route.ts`
- `packages/sense/test/route.test.ts`
- `packages/sense/test/boundary.test.ts`

Guardrail:

- Add a boundary test that asserts forbidden imports (e.g. `@alfred/db`, `@alfred/api`) do not appear in the domain package.

### 3) Durable persistence lives in `@alfred/db` (schema + repo + migrations)

Pattern:

- Define tables in `packages/db/src/schema/<domain>.ts`
- Add repository helpers in `packages/db/src/repo/<domain>.ts`
- Export them from `packages/db/src/index.ts`
- Add a Postgres migration in `packages/db/src/migrations/NNNN_<domain>.sql`
- Maintain sqlite parity in `packages/db/src/sqlite/schema.ts` so sqlite-mode tests can run

Sense example:

- `packages/db/src/schema/sense.ts`
- `packages/db/src/repo/sense.ts`
- `packages/db/src/migrations/0084_sense.sql`
- sqlite parity: `packages/db/src/sqlite/schema.ts`

Guardrail:

- DB tests may default to Postgres if `DATABASE_URL` is set in the environment. If a test must be sqlite-deterministic, force `process.env.DATABASE_URL = "sqlite::memory:"` before importing the DB client/module.

### 4) Thin transport lives in `@alfred/api` (tRPC routers)

Pattern:

- Routers should validate input, enforce auth, call repo + domain helpers, and return DTOs
- For MVP real-time updates, in-memory pubsub is acceptable for single-user/single-instance
- Use dynamic imports for server-only helpers when needed in routes that may run under SSR bundling constraints

Sense example routers:

- `packages/api/src/routers/capture.ts`
- `packages/api/src/routers/inbox.ts`
- `packages/api/src/routers/receipt.ts`
- `packages/api/src/routers/workingset.ts`

Registration:

- `packages/api/src/routers/index.ts`

Guardrail:

- Avoid import-time work in routers and helpers; prefer lazy/dynamic import when interacting with optional subsystems.

### 5) UX surfaces live in apps

Web pattern:

- Implement an app component under `apps/web/src/components/apps/<domain>/index.tsx`
- Export it from `apps/web/src/components/apps/index.ts`
- Register it in `apps/web/src/components/desktop/windows/registry.tsx`
- Add the new window type to both `apps/web/src/store/desktop/types.ts` and `types.new.ts`
- Update `WINDOW_DEFAULTS` in both files for exhaustive type safety

Sense example:

- Inbox: `apps/web/src/components/apps/inbox/index.tsx` (includes `capture.triage` buttons)
- Working set: `apps/web/src/components/apps/workingset/index.tsx`

Native pattern:

- Add a screen under `apps/native/app/(drawer)/(tabs)/<domain>.tsx`
- Register it in the tab layout `apps/native/app/(drawer)/(tabs)/_layout.tsx`
- Use tRPC client hooks (`apps/native/utils/trpc.ts`) only; never import server modules

Sense example:

- `apps/native/app/(drawer)/(tabs)/capture.tsx`

## Hook-safe commit hygiene (pre-commit pitfalls)

Non-obvious behavior:

- The repo’s pre-commit formatting can rewrite files and attempt to restore unstaged changes via a patch.
- If you have **unstaged edits in the same files** the formatter rewrites, the restoration patch can fail and block commits.

Repeatable prevention:

- Keep the worktree clean for files you’re committing (no partial/unstaged edits in those files).
- Split commits by intent (feature vs formatting vs docs).
- If the repo is busy (multiple agents), stash unrelated edits before committing, then re-apply after.
