# Alfred

Alfred is a secure, Mastra-powered automation assistant that ships with a full-stack web app, an API layer, background schedulers, and evaluation tooling. The project is bootstrapped with Better‑T‑Stack and uses Bun + Turborepo to manage the monorepo.

## Key Capabilities

- **Workflow Orchestration:** Mastra agent with secure droid tooling and autonomy gating.
- **Evaluations:** First-party eval metadata in Postgres with optional Laminar dual-write for tracing and score dashboards.
- **API Surface:** tRPC routers backed by Drizzle repositories and Better Auth session context.
- **Multi-app Monorepo:** Web (TanStack Start) and Native (Expo) apps consuming the shared API & auth packages.
- **Observability:** Prometheus metrics (tRPC, policy, droid exec, evals, Laminar exports) and Laminar tracing support.

## Prerequisites

- [Bun](https://bun.sh) 1.2+
- Node.js 20+ (for tooling compatibility)
- PostgreSQL 16 with pgvector extension (`pgvector/pgvector:pg16` docker image recommended)
- (Optional) Redis for biometric cache & token replay protection
- (Optional) Laminar account/api key for tracing + eval exports

## Project Layout

```
apps/
  web/         # TanStack Start web app (SSR)
  native/      # React Native + Expo app
packages/
  agent/       # Mastra agents, eval runner, Laminar bridge
  api/         # tRPC routers, metrics, schedulers
  auth/        # Better Auth configuration & token helpers
  db/          # Drizzle schema, repositories, migrations
  policy/      # PDP rules + evaluation helpers
  type/        # Shared TypeScript types
```

## Environment Configuration

Copy `config/env.example` to `.env` (or export variables via shell/CI) and fill in values:

```bash
cp config/env.example .env
```

Important keys:

- `DATABASE_URL` – Postgres connection string (required)
- `BETTER_AUTH_*` – Auth origin/secret settings
- `OPENAI_API_KEY` – Required for Mastra LLM-backed scorers
- `EVALS_SAMPLING_RATE` – Fraction of live agent runs sampled for scoring (default `0.1`)
- `LMNR_PROJECT_API_KEY` (+ `EVAL_LAMINAR_EXPORT=1`) – Enables Laminar dual-write for evals

Each package can also read a local `.env` inside its directory when executed stand-alone.

## Database Setup

1. Ensure Postgres is running (the repo is configured for the pgvector docker image).
2. Install dependencies and start the database container if you’re using the provided compose file.

```bash
bun install
bun run db:start       # optional helper if you have a local docker compose
bun run db:migrate     # applies migrations via packages/db/scripts/migrate.ts
```

The migrate script records state in `_migrations` while applying SQL from `packages/db/src/migrations`.

## Running the Stack

### Web + API (default dev flow)

```bash
bun run dev
```

This starts the Turborepo pipeline (API + web app). Visit `http://localhost:3000` for the SSR app. The API listens at `http://localhost:3000/api`.

### Native (Expo)

```bash
bun run dev:native
```

Follow the Expo output to run on iOS/Android simulators or the Expo Go app.

## Available Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start all workspaces in development mode |
| `bun run dev:web` | Start only the web app |
| `bun run dev:native` | Start the Expo dev server |
| `bun run build` | Build all packages/apps |
| `bun run typecheck` | Solution-style `tsc -b` across packages |
| `bun run --filter @alfred/agent test` | Run agent package tests |
| `bun run db:migrate` | Apply SQL migrations |
| `bun run db:studio` | Launch Drizzle Studio |

## Using Codex Executor

Codex can replace the default droid executor once the CLI is installed locally. Follow these steps:

1. Install the Codex CLI (see `docs/codex-cli/install.md`) and ensure it is on your `PATH`.
2. Provide credentials via `CODEX_API_KEY`. If you only have `OPENAI_API_KEY`, leave `ORCH_CODEX_ALLOW_OPENAI_KEY=1` so the orchestrator forwards it.
3. Enable the executor by setting `ORCH_EXECUTOR=codex` in your environment. Optional helpers: `ORCH_EXECUTOR_FALLBACK=1` to auto-fallback to droid on spawn/runtime failures and `ORCH_EXECUTOR_SHADOW=1` to dual-run during testing.
4. Tune the binary/profile with `CODEX_BIN` and `CODEX_PROFILE` when you need a non-default install or workspace profile.

Codex metrics (`codex_exec_runs_total`, `codex_exec_duration_seconds`, and `codex_errors_total`) surface alongside the existing droid series on `/api/metrics` for dashboards.

## Testing & Quality Gates

- **Type checking:** `bun run typecheck`
- **Agent tests:** `bun run --filter @alfred/agent test`
- Add package-specific `test`/`typecheck` scripts when introducing new workspaces.
- Refer to `.ruler/05-testing.md` for expectations (Vitest coverage per repo/router, DB isolation, etc.).

## Evaluations & Laminar Integration

- Evaluation schema lives in `packages/db/src/schema/eval.ts` with migrations `0012_evals.sql` + `0013_eval_laminar.sql`.
- Run batch evals via the tRPC endpoint `eval.run.start` (see `packages/api/src/routers/eval.ts`).
- Live sampling is configured on the orchestrator agent via `EVALS_SAMPLING_RATE`.
- To enable Laminar exports set `EVAL_LAMINAR_EXPORT=1`, choose a mode (`sdk` or `api`), and provide `LMNR_PROJECT_API_KEY`. Metrics are exposed as `laminar_eval_datapoints_total{status}` and `laminar_eval_errors_total{stage}`.

## Observability

Prometheus metrics are served from `/api/metrics` (content type `text/plain; version=0.0.4`). Core series include:

- `trpc_requests_total{procedure,type}`
- `policy_decisions_total{action,decision}`
- `droid_exec_runs_total{auto,exit_code}` & `droid_exec_duration_seconds{auto}`
- `codex_exec_runs_total{auto,exit_code}`, `codex_exec_duration_seconds{auto}`, `codex_errors_total{stage}`
- `eval_runs_total{agent,status}` & `eval_duration_seconds{agent}`
- `eval_scores_total{scorer}`, `eval_failures_total{scorer,reason}`
- `laminar_eval_datapoints_total{status}`, `laminar_eval_errors_total{stage}`

Integrate the endpoint with your scraping pipeline (Prometheus, Grafana Agent, etc.).

## Known Limitations

- Workflow run resumes require sticky routing today; review `docs/mastra/server/run-registry.md` for the Redis-backed registry roadmap before scaling the API horizontally.

## Health Checks

- `/healthz` – basic liveness (see `apps/web/src/routes/healthz.ts`)
- `/healthz/deps` – Postgres/Redis readiness probes

Both handlers increment `health_checks_total` by target/status pair.

## Workflow Tips

- Use feature branches off `main` (current working branch: `feat/evals-enhancements`).
- Run `bun run typecheck` and the relevant tests before raising PRs.
- Keep `.ruler/` guidelines in sync with architectural changes.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `fatal: cannot find origin` | Run `git remote add origin https://github.com/<org>/alfred.git` |
| Laminar exports failing | Check `laminar_eval_errors_total` labels, verify env keys & network access |
| `Error: eval_scorers_unavailable` | Ensure `OPENAI_API_KEY` (or other model providers) is set |
| Postgres migration errors | Confirm the DB is running & accessible via `DATABASE_URL` |

## License

MIT License © 2025 memaxo
