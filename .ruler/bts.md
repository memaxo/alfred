# ALFRED Monorepo Overview

This project is a Better-T-Stack monorepo orchestrated by Turborepo and Bun workspaces. It delivers the ALFRED assistant across web and native clients with a shared backend stack.

## Key Workspaces

- `apps/web`: TanStack Start app with tRPC client and SSR. Never import server-only modules (`@alfred/db`, `pg`, etc.) into browser bundles.
- `apps/native`: React Native (Expo + NativeWind) client that reuses Better Auth via the Expo plugin.
- `packages/db`: Drizzle schema, migrations, and migration runner. Always run migrations through `scripts/migrate.ts`.
- `packages/auth`: Better Auth configuration, biometric tickets, and Ed25519 tool tokens.
- `packages/api`: tRPC routers, context, metrics, and scheduler entry points.
- `packages/type`: Shared DTOs for cross-layer type safety.

## Development Commands

- `bun run dev` — Run all apps via Turborepo.
- `bun run db:start` — Launch Postgres (`pgvector`) locally.
- `bun run db:migrate` — Apply migrations using the custom runner.
- `bun run ruler:apply` — Regenerate AI assistant instructions after editing `.ruler` files.

## Guardrails

- Follow the one-word naming rule for files, directories, and exported symbols.
- Gate background schedulers behind env flags (e.g. `SCHED_REMIND=1`).
- Treat `@alfred/auth/token` as the only source for tool token signing/verification.
- Update `docs/alfred-prd.md` and `.ruler` guidance when milestones ship.
