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

- **AI SDK v6 Workflows**: Streaming execution with tool chaining, durable state, suspend/resume, and conflict resolution
- **Cognitive Architecture**: Event-sourced state machine with physiology (energy/boredom/frustration), autonomy gradient, and brainstem supervisor
- **Local-First Architecture**: Local embeddings (KaLM-Embedding-Gemma3-12B), local voice models (NeMo STT, Maya1/Piper TTS), zero-cost privacy
- **Knowledge Graph**: Hypergraph memory with active recall reinforcement, semantic search, and pattern recognition
- **Learning System**: Self-supervision from outcomes, preference inference, mistake analysis, memory decay
- **Voice System**: Real-time bidirectional streaming, VAD-driven interruptibility (barge-in), Mindscape visualization, admin dashboard
- **Security**: Policy engine with biometric elevation for high-risk operations, token scopes, audit logging
- **Observability**: Prometheus metrics, structured logging, build verification, memory maintenance telemetry
- **Multi-Client**: Web (TanStack Start) and Native (React Native/Expo) apps
- **Linear Integration**: First-class Linear agent with Agent Activities, 10-second acknowledgment, webhook handling

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
   # Edit .env and confirm DATABASE_URL=postgresql://alfred:alfred@localhost:5432/alfred
   # (tests may override with sqlite::memory:; see README section below)
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
- AI SDK v6 (workflow streaming, tool calling, structured outputs)
- Models: OpenAI, Google, Cohere (configurable)
- Embeddings: Local KaLM-Embedding-Gemma3-12B (1024 dims via MRL truncation)
- Voice: NeMo STT (local), Maya1/Piper TTS (local), or OpenAI APIs
- Cognitive: Event-sourced state machine with pure transitions

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

- `DATABASE_URL` – Postgres connection string (default `postgresql://alfred:alfred@localhost:5432/alfred` from `config/env.example`). During `bun test`, you may omit it or set `DATABASE_URL=sqlite::memory:` to activate the in-memory SQLite mock recommended by Drizzle.
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
- `WS /voice/stream` – bidirectional binary WebSocket for voice (STT/TTS streaming)

**Workflow router (tRPC):**
- `workflow.start` – initializes a durable workflow run and returns `{ runId, summary }`
- `workflow.stream` – emits `WorkflowEvent` chunks and persists each to Postgres
- `workflow.resume` – delivers authorization events to the active run via the run registry
- `workflow.get` / `workflow.events` – hydrate run metadata and persisted events for replay

**Admin router (tRPC, biometric-protected):**
- `admin.getVoiceStats` – real-time voice pool health and telemetry
- `admin.restartVoicePool` – restart STT/TTS pools
- `admin.clearVoiceSessions` – clear active voice sessions

**Cognitive router (tRPC):**
- `cognitive.feedback` – submit feedback for autonomy learning
- `cognitive.state` – get current cognitive state

**Health checks:**
- `/healthz` – basic liveness probe
- `/healthz/deps` – Postgres/Redis readiness probes
- `/api/metrics` – Prometheus metrics endpoint

## Available Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start all workspaces in development mode |
| `bun run dev:web` | Start only the web app |
| `bun run dev:native` | Start the Expo dev server |
| `bun run build` | Build all packages/apps |
| `bun run typecheck` | Solution-style `tsc -b` across packages |
| `bun run test` | Run all tests |
| `bun run test:integration` | Run SQLite-backed hypergraph + agent graphstore + workflow reasoning + graph router integration suites |
| `bun run --filter @alfred/<package> test` | Run tests for specific package |
| `bun run check` | Lint and format code (Biome) |
| `bun run smoke:hypergraph` | Execute capture → persist → reload smoke script (uses SQLite unless `--use-existing-db`) |
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
- **Integration tests:** `bun run test:integration` (uses SQLite fallback; respects `DATABASE_URL` when `--use-existing-db` flag passed)
- **Smoke test:** `bun run smoke:hypergraph` to exercise capture → persist → reload (add `--use-existing-db` to run against Postgres)
- **Nightly Postgres smoke:** `.github/workflows/postgres-nightly.yml` runs embed E2E plus the capture → persist → reload smoke script against a real Postgres instance.
- Add package-specific `test`/`typecheck` scripts when introducing new workspaces.
- Refer to `.ruler/05-testing.md` for expectations (Vitest coverage per repo/router, DB isolation, etc.).
- **Unit tests (sqlite fallback):** `bun run test:sqlite` runs every workspace’s `test` script without needing `DATABASE_URL`. Tests that depend on `@alfred/db` use the in-memory sqlite harness automatically.
- **Postgres-backed tests:** provision a Postgres instance, set `DATABASE_URL`, then run `bun run test:postgres`. Packages with real DB suites set `RUN_DB_TESTS=1` internally; the helpers in `@alfred/db/testing` ensure they fail fast if Postgres is unavailable.
- **Database targets:** When `DATABASE_URL` is unset, tests run against the in-memory sqlite fallback (fast, zero-config). Suites that rely on Postgres-only features must call `describePostgres(...)` or `requirePostgresTestEnv()` from `@alfred/db/testing` so they skip cleanly unless a Postgres URL is provided.

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
- `memory_maintenance_duration_seconds`, `memory_nodes_decayed_total`, `memory_nodes_pruned_total`, `memory_nodes_cleaned_total`
- `linear_activity_emissions_total{type,status}`, `linear_activity_duration_seconds{type}`
- `voice_stt_duration_seconds`, `voice_tts_duration_seconds`, `voice_session_rtt_millis`, `voice_session_jitter_millis`, `voice_session_packet_loss_total`

Integrate the endpoint with your scraping pipeline (Prometheus, Grafana Agent, etc.).

## Implementation Status

### ✅ Complete Features

- **Cognitive Architecture**: Physiology system, autonomy gradient, brainstem supervisor, event-sourced runtime loop
- **Voice System**: Barge-in interruptibility, Mindscape visualization, admin dashboard, telemetry
- **Knowledge Graph**: Active recall reinforcement, memory decay, entity linking, hybrid retrieval
- **Workflow Orchestration**: Multi-agent waves, conflict resolution (Arbiter), suspend/resume, Linear integration
- **Memory System**: Decay throttling, confidence floor, Prometheus metrics, safety rails
- **SSR Hardening**: Build verification script, variable-based dynamic imports, browser-only library isolation

### ⚠️ Mostly Complete

- **Memory System Hardening**: Bulk update optimization pending (still uses Promise.all loop)
- **SSR Hardening**: API route audit pending (build verification complete)

### 🚧 In Progress / Partial

- **Home Assistant Integration**: Backend skeleton exists, full implementation pending
- **Timer/Bookmark UI**: Backend complete, UI routes missing
- **Chat History**: Infinite scroll pending

## Known Limitations

- Workflow run resumes require sticky routing unless `RUN_REGISTRY_BACKEND=redis` is configured alongside `REDIS_URL`; ensure consistent routing when scaling the API horizontally.
- Some ExecPlans marked "Proposed" are actually complete or mostly complete (see `docs/execplans/` for details).

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
5. **Cognitive loop**: Voice/chat inputs feed into `runCognitiveLoop` which applies pure state transitions and emits effects
6. **Event sourcing**: Cognitive state is event-sourced (`cognitive_events` table) with periodic snapshots for fast hydration

### Development Guidelines

- **Naming**: Single-word files/directories (see `.ruler/01-naming-conventions.md`)
- **Performance**: Hot paths must meet budgets (<100µs transitions, <1ms queries, <10ms RAG, <100ms plan generation)
- **Purity**: Core logic is pure functions; side effects belong at boundaries
- **Type Safety**: End-to-end TypeScript, no `any` types (except JSONB `as any` pattern)
- **Testing**: Vitest for all packages, integration tests for routers, Playwright E2E for UI flows
- **Dynamic Imports**: Server-only packages must use variable-based dynamic imports in API routes (prevents Vite bundling)
- **ExecPlans**: Significant features use ExecPlans (see `docs/execplans/`) - update progress as work proceeds

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
