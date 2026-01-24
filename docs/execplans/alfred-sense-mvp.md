# alfred-sense-mvp

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Enable ALFRED Sense MVP: create captures on iOS (text/voice) that arrive in the desktop/web Inbox within seconds, with a persisted bundle (derived text), a persisted receipt (routing suggestion + evidence), and a persisted working set that influences routing.

You can see this working by:

- starting the API + web app
- creating a capture on native (Capture tab) or by calling `capture.create`
- opening the `Inbox` window in web and watching items appear live
- pinning a `Working Set` focus and observing new capture receipts include that evidence

## Progress

- [x] (2026-01-17) Added Sense DTOs + schemas to `packages/type/src/sense.ts` and `packages/type/src/sense.zod.ts`.
- [x] (2026-01-17) Created `packages/sense` (pure route scoring + correction helpers) with unit + boundary tests.
- [x] (2026-01-17) Added Sense persistence (`packages/db/src/schema/sense.ts`, `packages/db/src/repo/sense.ts`, migration `packages/db/src/migrations/0084_sense.sql`, sqlite parity in `packages/db/src/sqlite/schema.ts`).
- [x] (2026-01-17) Added API routers: `capture`, `inbox`, `receipt`, `workingset` and registered them in `packages/api/src/routers/index.ts`.
- [x] (2026-01-17) Added web windows: `Inbox` and `Working Set` and registered them in `apps/web/src/components/desktop/windows/registry.tsx`.
- [x] (2026-01-17) Added native Capture tab screen at `apps/native/app/(drawer)/(tabs)/capture.tsx`.
- [x] (2026-01-17) Added tests:
  - `packages/sense/test/route.test.ts`, `packages/sense/test/boundary.test.ts`
  - `packages/api/test/sense.router.test.ts`
  - `packages/db/test/repo.sense.test.ts` (forces sqlite in-memory for determinism)
- [x] (2026-01-17) Updated product spec at `docs/specs/alfred-sense.md` with MVP constraints.

## Surprises & Discoveries

- Observation: Local test environment may have `DATABASE_URL` set, which makes DB tests hit Postgres by default.
  Evidence: Initial `packages/db/test/repo.sense.test.ts` run failed with `relation "sense_captures" does not exist` until the test forced `process.env.DATABASE_URL = "sqlite::memory:"` prior to importing the repo.

## Decision Log

- Decision: Persist derived-only media (derived transcript/text) and defer raw blob storage.
  Rationale: Enables MVP without object storage or retention systems.
  Date/Author: 2026-01-17 / agent

- Decision: Keep inbox subscriptions in-memory for MVP.
  Rationale: Single-user, single-instance MVP; avoids committing to a durable streaming backend prematurely.
  Date/Author: 2026-01-17 / agent

## Outcomes & Retrospective

ALFRED Sense MVP wiring exists end-to-end across type → domain → DB → API → apps. What remains for v1 is better routing (date parsing, entity extraction), photo/OCR pipeline, durable stream/cursors for inbox, and richer conversion UX in web (one-tap actions with editable fields).

## Context and Orientation

ALFRED Sense is a capture-to-execution system with four primitives:

- Capture: immutable record of an inbound capture (kind, status, evidence).
- Bundle: derived interpretation; MVP stores only derived text.
- Receipt: explainable decision (route + evidence + corrections).
- Working Set: user-controlled list + focus pointer that influences routing.

Key locations:

- Types: `packages/type/src/sense.ts`, `packages/type/src/sense.zod.ts`
- Domain scoring: `packages/sense/src/route.ts`
- DB: `packages/db/src/schema/sense.ts`, `packages/db/src/repo/sense.ts`, migration `packages/db/src/migrations/0084_sense.sql`
- API: `packages/api/src/routers/capture.ts`, `packages/api/src/routers/inbox.ts`, `packages/api/src/routers/receipt.ts`, `packages/api/src/routers/workingset.ts`
- Web: `apps/web/src/components/apps/inbox/index.tsx`, `apps/web/src/components/apps/workingset/index.tsx`
- Native: `apps/native/app/(drawer)/(tabs)/capture.tsx`

## Plan of Work

This plan is now largely implemented. Future work should continue incrementally:

- Add photo/OCR bundle creation for `payload.kind = "photo"`.
- Add durable inbox streaming with cursors (likely via the existing subscription manager and a DB-backed event stream).
- Add “one-tap convert” controls to the Inbox UI and route-specific fields (e.g., reminder due date).
- Add entity extraction and project/link suggestions using existing knowledge/graph tooling.

## Concrete Steps

From repository root:

- Run Sense domain tests:
  bun scripts/test-bun.ts packages/sense/test/boundary.test.ts packages/sense/test/route.test.ts

- Run API router tests:
  bun scripts/test-bun.ts --timeout 60000 --preload packages/test-kit/src/bun/preload.ts --preload packages/api/test/utils/sandbox.ts --preload packages/api/test/utils/mock-metrics.ts --preload packages/api/test/utils/mock-db-client.ts --preload packages/api/test/utils/mock-voice.ts packages/api/test/sense.router.test.ts

- Run DB repo tests (sqlite forced):
  bun scripts/test-bun.ts packages/db/test/repo.sense.test.ts

To apply Postgres migration in a real dev DB:

- Ensure Postgres is running, then:
  bun run db:migrate

## Validation and Acceptance

Acceptance (manual):

- Start ALFRED web + API.
- In native, open the `Capture` tab and submit a text capture.
- In web, open the `Inbox` window and verify the capture appears.
- Open the `Working Set` window, pin a project focus, then submit another capture and verify its receipt includes working-set evidence.

## Idempotence and Recovery

Most steps are additive and safe to rerun. If the Postgres migration fails, fix the schema locally and re-run `bun run db:migrate` (do not hand-edit already-applied migrations in shared environments).

## Artifacts and Notes

New tests to rely on:

- `packages/api/test/sense.router.test.ts` validates router wiring via mocks.
- `packages/db/test/repo.sense.test.ts` validates sqlite schema parity and repo correctness.
