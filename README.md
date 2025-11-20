# ALFRED

**ALFRED** is a personal AI assistant designed for deep single-user personalization. Unlike multi-tenant SaaS products, ALFRED learns your specific workflows, preferences, and infrastructure to become increasingly valuable over time.

## What is ALFRED?

ALFRED is a secure, AI SDK v6-powered automation assistant that helps you manage projects, automate infrastructure, and boost productivity. It's built as a **personal assistant**—meaning it's designed for a single user, enabling aggressive personalization and learning without multi-tenancy complexity.

### Core Use Cases

- **Workflow Automation**: Execute multi-step workflows with AI SDK v6 (e.g., "deploy this app to staging", "create a Linear issue and assign it")
- **Personal Productivity**: Notes, reminders, timers, and bookmarks with semantic search
- **Infrastructure Management**: Proxmox VM operations, Docker deployments, Git workflows
- **Project Management**: Linear integration for issue tracking and automation
- **Voice Interaction**: Speech-to-speech with local models (Faster-Whisper STT, Piper TTS)

### Key Features

- **AI SDK v6 Workflows**: Streaming execution with tool chaining and durable state
- **Local-First Architecture**: Local embeddings (KaLM-Embedding-Gemma3-12B), local voice models, zero-cost privacy
- **Knowledge Graph**: Hypergraph memory with semantic search and pattern recognition
- **Learning System**: Self-supervision from outcomes, preference inference, mistake analysis
- **Security**: Policy engine with biometric elevation for high-risk operations
- **Observability**: Prometheus metrics, distributed tracing, structured logging
- **Multi-Client**: Web (TanStack Start) and Native (React Native/Expo) apps

## Technical Overview

ALFRED is built as a monorepo using **Bun + Turborepo** with a layered architecture:

- **Runtime Layer**: Orchestrates domain packages into cohesive execution
- **Domain Packages**: Cognitive state, knowledge graph, learning system, RAG
- **Tool Packages**: AI SDK v6 tool definitions (assistant & orchestrator tools)
- **API Layer**: tRPC routers with Better Auth session context
- **Infrastructure**: Drizzle ORM, PostgreSQL + pgvector, Redis (optional)

See [`docs/architecture/overview.md`](docs/architecture/overview.md) for detailed architecture documentation.

## Prerequisites

- [Bun](https://bun.sh) 1.2+
- Node.js 20+ (for tooling compatibility)
- PostgreSQL 16 with pgvector extension (`pgvector/pgvector:pg16` docker image recommended)
- (Optional) Redis for biometric cache & token replay protection
- (Optional) Laminar account/api key for tracing + eval exports

## Quick Start

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment:**
   ```bash
   cp config/env.example .env
   # Edit .env and add DATABASE_URL, BETTER_AUTH_*, OPENAI_API_KEY
   ```

3. **Start database and run migrations:**
   ```bash
   bun run db:start       # Starts Postgres with pgvector
   bun run db:migrate     # Applies migrations
   ```

4. **Start development server:**
   ```bash
   bun run dev            # Starts web app + API
   ```

5. **Visit the app:**
   - Web: `http://localhost:3000`
   - API: `http://localhost:3000/api`
   - Metrics: `http://localhost:3000/api/metrics`

## Project Layout

```
apps/
  web/         # TanStack Start web app (SSR)
  native/      # React Native + Expo app
packages/
  runtime/     # 🆕 Orchestration layer (composes all domains)
  agent/       # AI SDK v6 tool registries
  api/         # tRPC routers, metrics, schedulers
  cognitive/   # State machine (idle → thinking → acting)
  knowledge/   # Hypergraph memory
  learning/    # Self-supervision & pattern extraction
  rag/         # Semantic search (local embeddings)
  embed/       # Local embedding model (Python subprocess)
  voice/       # STT/TTS (local or OpenAI)
  policy/      # Security & access control (PDP)
  db/          # Drizzle schema, repositories, migrations
  auth/        # Better Auth configuration & token helpers
  metrics/     # Prometheus registry
  type/        # Shared TypeScript types
  ui/          # Shared React components
```

## Tech Stack

**Runtime & Language:**
- Bun 1.2+ (TypeScript execution, package management)
- TypeScript 5.7+ (strict mode, solution-style project references)

**Frontend:**
- Web: TanStack Start (SSR, file-based routing)
- Native: React Native + Expo + NativeWind
- UI: React 18+, TanStack Query, AI SDK v6 React hooks

**Backend:**
- API: tRPC v11 (type-safe RPC)
- Auth: Better Auth (passkey support)
- Database: PostgreSQL 16 + pgvector (vector search)
- ORM: Drizzle ORM (type-safe queries)
- Caching: Redis (optional, for run registry)

**AI/ML:**
- AI SDK v6 (workflow streaming, tool calling)
- Models: OpenAI, Google, Cohere (configurable)
- Embeddings: Local KaLM-Embedding-Gemma3-12B (1024 dims via MRL)
- Voice: Faster-Whisper (STT), Piper TTS (local), or OpenAI APIs

**Infrastructure:**
- Observability: Prometheus metrics, structured logging
- Tracing: Distributed tracing support
- Deployment: Proxmox (planned)

**Development:**
- Testing: Vitest (Bun test runner)
- Linting: Biome + Ultracite
- Type checking: TypeScript solution-style builds

## Environment Configuration

Copy `config/env.example` to `.env` (or export variables via shell/CI) and fill in values:

```bash
cp config/env.example .env
```

Important keys:

- `DATABASE_URL` – Postgres connection string (required)
- `BETTER_AUTH_*` – Auth origin/secret settings
- `OPENAI_API_KEY` – Required for AI SDK v6 model access
- `EVALS_SAMPLING_RATE` – Fraction of live agent runs sampled for scoring (default `0.1`)
- `LMNR_PROJECT_API_KEY` (+ `EVAL_LAMINAR_EXPORT=1`) – Enables Laminar dual-write for evals
- `RUN_REGISTRY_BACKEND` – Defaults to `memory`; set to `redis` (with `REDIS_URL`) to enable the multi-instance run registry.

Each package can also read a local `.env` inside its directory when executed stand-alone.

### Database Setup

The project uses PostgreSQL 16 with the pgvector extension for vector search. Migrations are managed via a custom runner in `packages/db/scripts/migrate.ts`.

**Using Docker (recommended):**
```bash
bun run db:start       # Starts Postgres container with pgvector
bun run db:migrate     # Applies migrations
```

**Manual setup:**
1. Install PostgreSQL 16 with pgvector extension
2. Set `DATABASE_URL` in your `.env`
3. Run `bun run db:migrate`

The migrate script records state in `_migrations` while applying SQL from `packages/db/src/migrations`.

## Development Workflow

### Running the Development Server

**Web + API (default):**
```bash
bun run dev
```
Starts the Turborepo pipeline (API + web app). Visit `http://localhost:3000` for the SSR app.

**Native app:**
```bash
bun run dev:native
```
Follow the Expo output to run on iOS/Android simulators or the Expo Go app.

**Web only:**
```bash
bun run dev:web
```

### API Endpoints

**Streaming endpoints (AI SDK v6 SSE):**
- `POST /api/assistant` – streams `UIMessage` parts using `streamText` and assistant tools
- `POST /api/orchestrator` – streams `UIMessage` parts using `streamText` and orchestrator tools

**Workflow router (tRPC):**
- `workflow.start` – initializes a durable workflow run and returns `{ runId, summary }`
- `workflow.stream` – emits `WorkflowEvent` chunks and persists each to Postgres
- `workflow.resume` – delivers authorization events to the active run via the run registry
- `workflow.get` / `workflow.events` – hydrate run metadata and persisted events for replay

**Health checks:**
- `/healthz` – basic liveness probe
- `/healthz/deps` – Postgres/Redis readiness probes

## Available Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start all workspaces in development mode |
| `bun run dev:web` | Start only the web app |
| `bun run dev:native` | Start the Expo dev server |
| `bun run build` | Build all packages/apps |
| `bun run typecheck` | Solution-style `tsc -b` across packages |
| `bun run test` | Run all tests |
| `bun run --filter @alfred/<package> test` | Run tests for specific package |
| `bun run check` | Lint and format code (Biome) |
| `bun run db:start` | Start Postgres container |
| `bun run db:migrate` | Apply SQL migrations |
| `bun run db:studio` | Launch Drizzle Studio |
| `bun run db:stop` | Stop Postgres container |

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
- `workflow_stream_events_total{event}`, `workflow_stream_duration_seconds{status}`
- `run_registry_events_total{event,backend,outcome}`, `run_registry_dispatch_duration_seconds{backend,outcome}`

Integrate the endpoint with your scraping pipeline (Prometheus, Grafana Agent, etc.).

## Known Limitations

- Workflow run resumes require sticky routing unless `RUN_REGISTRY_BACKEND=redis` is configured alongside `REDIS_URL`; ensure consistent routing when scaling the API horizontally.

## For New Developers

### Key Documentation

- **[Architecture Overview](docs/architecture/overview.md)** - System architecture and design principles
- **[Package Organization](docs/architecture/packages.md)** - Detailed package structure and dependencies
- **[PRD](docs/alfred-prd.md)** - Product requirements and development phases
- **[Development Rules](.ruler/)** - Coding standards, naming conventions, and best practices

### Understanding the Codebase

1. **Start with the runtime**: `packages/runtime/` is the orchestration layer that composes all domain packages
2. **Follow the data flow**: User request → tRPC router → WorkflowRuntime → AI SDK → Tools → Events
3. **Domain packages are pure**: `cognitive/`, `knowledge/`, `learning/` contain pure logic without side effects
4. **Boundaries handle I/O**: `api/`, `db/`, `auth/` handle persistence, HTTP, and side effects

### Development Guidelines

- **Naming**: Single-word files/directories (see `.ruler/01-naming-conventions.md`)
- **Performance**: Hot paths must meet budgets (<100µs transitions, <1ms queries, <10ms RAG)
- **Purity**: Core logic is pure functions; side effects belong at boundaries
- **Type Safety**: End-to-end TypeScript, no `any` types
- **Testing**: Vitest for all packages, integration tests for routers

## Branching Strategy

The repository uses three primary branches:

- **`main`**: Development integration branch. All feature branches merge here first.
- **`dev`**: Development/staging environment branch. Used for testing integrations before production.
- **`prod`**: Production branch. Only updated via merges from `dev` after thorough testing.

**Workflow:**
1. Create feature branches from `main`
2. Merge feature branches to `main` via pull requests
3. Periodically merge `main` → `dev` for staging deployments
4. Merge `dev` → `prod` for production releases after validation

CI runs on all three branches (`main`, `dev`, `prod`) to ensure code quality across environments.

## Workflow Tips

- Use feature branches off `main`
- Run `bun run typecheck` and relevant tests before raising PRs
- Keep `.ruler/` guidelines in sync with architectural changes
- See [Development Coordination Guide](docs/guides/development-coordination.md) for collaboration patterns

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `fatal: cannot find origin` | Run `git remote add origin https://github.com/<org>/alfred.git` |
| Laminar exports failing | Check `laminar_eval_errors_total` labels, verify env keys & network access |
| `Error: eval_scorers_unavailable` | Ensure `OPENAI_API_KEY` (or other model providers) is set |
| Postgres migration errors | Confirm the DB is running & accessible via `DATABASE_URL` |

## License

MIT License © 2025 memaxo
