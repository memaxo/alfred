# codex-live-run-observability

Owner: orchestrator

## Purpose

This documents how to run **real** Codex CLI executions (`codex exec --json`) through ALFRED's Codex tool and verify:

- streaming execution completes (non-interactive, never hangs),
- resume semantics work (same session/thread across prompts),
- artifacts are created in an isolated workspace,
- **durable, searchable logs** are persisted to Postgres (`codex_runs`, `codex_events`).

This targets **ALFRED itself** (server-side packages + DB + API + agent tools), not generated apps.

## Run the live verification script (developer workflow)

The Level-4 verification script runs **by default** and is safe to keep in-repo:

```bash
bun run scripts/verify-codex-live.ts
```

To skip it explicitly:

```bash
RUN_CODEX_LIVE=0 bun run scripts/verify-codex-live.ts
```

The script:

- checks all prerequisites (Docker, Postgres, Codex binary, API keys) with actionable error messages,
- creates an isolated workspace (`worktree` by default; `container`/`poof` when enabled),
- runs a Codex prompt that creates `codex_live_artifact.txt`,
- runs a second prompt with the same `sessionId` and verifies it resumes the same `threadId`,
- queries Postgres to verify `codex_runs` + `codex_events` exist and are searchable.

## Prerequisites

The verification script requires the following to be set up:

1. **Docker running** with `alfred-postgres` container
2. **Migrations applied** (`bun run db:migrate`)
3. **API key** (`CODEX_API_KEY` or `OPENAI_API_KEY`)
4. **Ed25519 signing keys** (`AGENT_ED25519_PRIVATE` and `AGENT_ED25519_PUBLIC_PEM`)
5. **Codex binary** available (`CODEX_BIN` or in `PATH`)

### Quick bring-up flow

```bash
# 1. Start Docker Desktop (macOS)
open -a Docker

# 2. Wait for Docker to be ready, then start Postgres
bun run db:start

# 3. Apply migrations
bun run db:migrate

# 4. Run verification
bun run scripts/verify-codex-live.ts
```

## Required environment

### Required

- **`DATABASE_URL`**: must point to Postgres with migrations applied. DB is essential for live verification.
- **`CODEX_API_KEY`** (preferred) or **`OPENAI_API_KEY`** (runtime aliased to `CODEX_API_KEY` when absent).
- **`AGENT_ED25519_PRIVATE`** and **`AGENT_ED25519_PUBLIC_PEM`**: required to mint a short-lived tool token for `toolCodex`.

### Live-script controls

- **`RUN_CODEX_LIVE=0`**: skip verification entirely (default: runs).
- **`RUN_CODEX_LIVE_TIMEOUT_MS`**: watchdog timeout for the script (defaults to 5 minutes / 300000ms).
- **`ORCH_CODEX_APPROVAL=never`**: the script forces this by default so Codex cannot block on approval prompts.
- **`CODEX_BIN`**: override path to Codex binary (otherwise searches `vendor/codex/target/release/codex` and `PATH`).
- **`ORCH_SKIP_SECURE_SPAWN=1`**: use path-based cwd instead of fd-based secure spawn (required on some systems where fd inheritance doesn't work correctly with Bun.spawn).

### Optional (isolation selection)

- **Worktree (default)**: no additional env required.
- **Docker**:
  - `ORCH_USE_CONTAINERS=1`
  - `ORCH_DOCKER_IMAGE=<image-with-codex-installed>`
- **Poof (Linux only)**:
  - `ORCH_USE_POOF=1`
  - `poof` installed and available on `PATH` (or `POOF_BIN` set).

## Non-interactive mode

The verification script runs Codex in **non-interactive mode** by default:

- `ORCH_CODEX_APPROVAL=never` is set automatically unless already configured
- Codex will not prompt for user approval, preventing hangs in headless environments
- A watchdog timeout (default 5 minutes) aborts execution if Codex hangs for any reason
- The watchdog properly propagates abort signals through the execution chain

## Isolation policy: Docker vs Poof

Docker and Poof are treated as **mutually exclusive** isolation modes for Codex execution:

- On Linux, if `ORCH_USE_POOF=1`, Poof wins (filesystem overlay + namespace isolation).
- Otherwise, if `ORCH_USE_CONTAINERS=1`, Docker is used.
- Otherwise, a git worktree is used.

Rationale: Docker bind mounts bypass host overlay semantics, so "Docker + Poof" does not reliably isolate or capture filesystem changes in the way Poof intends.

### Container workdir correctness

When using container workspaces (`ORCH_USE_CONTAINERS=1`):

- The repository is mounted at `/workspace` in the container
- The `containerCw` field is computed relative to the repo root
- Codex runs with `--workdir` set to the correct path inside the container (e.g., `/workspace/.agent/worktrees/<runId>`)

## Durable logs model

### Tables

- **`codex_runs`**: one row per Codex execution (distinct from `sessionId`/`threadId`).
- **`codex_events`**: full event log (seq-ordered) with `jsonb` payloads and a generated FTS `tsvector`.

### Retention

The DB function **`prune_old_codex_data(retention_days int)`** deletes old events and old terminal runs.

Default retention for operational usage is expected to be **30 days** (caller-configurable).

## Query surfaces

### tRPC (additive; UI streaming contract unchanged)

The existing `codex.stream` UI contract remains unchanged. New read-only procedures were added:

- `codex.listRuns`
- `codex.getRun`
- `codex.events`
- `codex.searchEvents`
- `codex.streamEvents` (debug tail via polling)

### Agent tool

The orchestrator tool **`codexlog`** provides log access:

- `list`, `get`, `events`, `search`, `artifacts`, `reasoning`

It requires the `codex.read` scope and enforces policy via `requireToolScopesAndPolicy`.

## Error handling

The verification script provides actionable error messages for common issues:

| Error | Fix |
|-------|-----|
| `docker_daemon_not_running` | Start Docker Desktop with `open -a Docker` |
| `postgres_not_ready` | Run `bun run db:start` and wait for health check |
| `codex_binary_not_found` | Build with `cd vendor/codex && cargo build --release` or set `CODEX_BIN` |
| `missing_env:*` | Set required environment variables in `.env` |

## API key aliasing

The script uses runtime aliasing to avoid mutating `.env` files:

- If `CODEX_API_KEY` is not set but `OPENAI_API_KEY` is present, `CODEX_API_KEY` is set to `OPENAI_API_KEY` in-process
- This aliasing happens at runtime and does not modify any files
- A log message indicates when aliasing is used: "Using OPENAI_API_KEY as CODEX_API_KEY (runtime alias)"
