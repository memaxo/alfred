# codex-live-run-observability

Owner: orchestrator

## Purpose

This documents how to run **real** Codex CLI executions (`codex exec --json`) through ALFRED’s Codex tool and verify:

- streaming execution completes,
- resume semantics work (same session/thread across prompts),
- artifacts are created in an isolated workspace,
- **durable, searchable logs** are persisted to Postgres (`codex_runs`, `codex_events`).

This targets **ALFRED itself** (server-side packages + DB + API + agent tools), not generated apps.

## Run the live verification script (developer workflow)

The Level-4 verification script is gated and safe to keep in-repo:

```bash
RUN_CODEX_LIVE=1 bun run scripts/verify-codex-live.ts
```

The script:

- creates an isolated workspace (`worktree` by default; `container`/`poof` when enabled),
- runs a Codex prompt that creates `codex_live_artifact.txt`,
- runs a second prompt with the same `sessionId` and verifies it resumes the same `threadId`,
- queries Postgres to verify `codex_runs` + `codex_events` exist and are searchable.

## Required environment

### Required

- **`DATABASE_URL`**: must point to Postgres with migrations applied (the script validates persistence).
- **`CODEX_API_KEY`** (preferred) or **`OPENAI_API_KEY`** (fallback when `ORCH_CODEX_ALLOW_OPENAI_KEY=1`).
- **`AGENT_ED25519_PRIVATE`** and **`AGENT_ED25519_PUBLIC_PEM`**: required to mint a short-lived tool token for `toolCodex`.

### Optional (isolation selection)

- **Worktree (default)**: no additional env required.
- **Docker**:
  - `ORCH_USE_CONTAINERS=1`
  - `ORCH_DOCKER_IMAGE=<image-with-codex-installed>`
- **Poof (Linux only)**:
  - `ORCH_USE_POOF=1`
  - `poof` installed and available on `PATH` (or `POOF_BIN` set).

## Isolation policy: Docker vs Poof

Docker and Poof are treated as **mutually exclusive** isolation modes for Codex execution:

- On Linux, if `ORCH_USE_POOF=1`, Poof wins (filesystem overlay + namespace isolation).
- Otherwise, if `ORCH_USE_CONTAINERS=1`, Docker is used.
- Otherwise, a git worktree is used.

Rationale: Docker bind mounts bypass host overlay semantics, so “Docker + Poof” does not reliably isolate or capture filesystem changes in the way Poof intends.

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

