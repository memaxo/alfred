# Infra + Runtime Standardization (Docker + Ansible + Observability + Agent Recovery)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `.agent/PLANS.md`.

Owner: infra

## Purpose / Big Picture

Standardize ALFRED’s deployment/runtime surface so it is:

- **Reproducible**: single-command local + production bring-up.
- **Modular**: reusable infra building blocks (Ansible roles) and reusable runtimes (voice/embed).
- **Correct**: runtime knobs behave as documented (e.g. `EMBED_DEVICE`).
- **Observable**: metrics, logs, traces are consistently emitted and exportable.
- **Recoverable**: agents can detect failures and execute safe recovery steps via AI SDK v6 tools.

This plan targets **ALFRED itself** (not the apps ALFRED generates).

## Scope

In scope:

- Docker images + Compose topology for:
  - `alfred` (web/SSR + API-in-process)
  - `postgres` (pgvector)
  - `redis` (optional)
  - optional `voice` and `embed` runtimes (either in-process or sidecars)
- Ansible IaC to provision and operate a single-host deployment (home server / VM):
  - Docker + Compose
  - TLS termination (Caddy)
  - services, health checks, backups, upgrades
- Observability stack (Prometheus + Grafana + Loki + optional OTEL Collector) and first dashboards.
- Runtime correctness fixes:
  - embeddings honor `EMBED_DEVICE`
  - voice ROCm container determinism + missing system deps
  - implement or remove `/api/subscriptions` WebSocket
- Agent-facing AI SDK v6 tool catalog for lifecycle + recovery (safe, policy-gated).
- Tests for each runtime contract + recovery invariants.

Out of scope:

- Kubernetes
- Multi-tenant concerns
- Reworking Better Auth/OIDC semantics

## Current Baseline (evidence)

- `docker/alfred/Dockerfile` is single-stage; includes build toolchain.
- `docker/alfred/compose.yml` provides Postgres + optional Redis + `alfred`.
- Monitoring compose is a placeholder (`docker/monitoring/docker-compose.yml`).
- Voice streaming prototype uses `Bun.serve` and `/voice/stream` gated by `VOICE_STREAMING_PROTO=1`.
- Embeddings worker ignores `EMBED_DEVICE` today (Python always auto-detects).
- Client-side subscription manager expects `/api/subscriptions`; server route is absent.

## Progress

- [x] (2026-01-09) Captured baseline + authored this ExecPlan.

### Phase 1: Runtime correctness (stop the bleeding)

- [x] (2026-01-09) Honor `EMBED_DEVICE` end-to-end
  - Python worker now resolves device from `EMBED_DEVICE` (`auto|cpu|mps|cuda|rocm`) with safe fallback.
  - Added a fast unit test that asserts selection logic without importing torch or loading models.
- [x] (2026-01-09) Fix ROCm voice container determinism
  - Dockerfile now installs `ffmpeg` + `libsndfile1` and uses `pyproject.rocm.toml` (as `pyproject.toml`) with an in-image `uv lock` + `uv sync --frozen`.
  - Added an in-image smoke check that imports key deps without loading models.
- [x] (2026-01-09) Decide and implement `subscriptions` surface
  - Decision: rely on tRPC subscriptions (HTTP) and disable exports of the bespoke `/api/subscriptions` client manager.
  - TODO: if we need graph realtime, implement it as a tRPC subscription.

### Phase 2: “Perfect” Dockerfiles (fast, minimal, secure, reproducible)

- [x] (2026-01-09) `docker/alfred/Dockerfile` multi-stage
  - Builder stage: toolchain + `turbo prune --scope=web --docker` + cached `bun install`.
  - Runtime stage: minimal Bun image, **no compiler toolchain**, non-root user.
  - Deterministic install (`bun install --frozen-lockfile`).
- [x] (2026-01-09) Add optional dedicated images for heavy runtimes
  - `docker/embed/Dockerfile` (CPU + ROCm variants)
  - `docker/voice/Dockerfile` (CPU + ROCm variants)
  - Persistent model/cache volumes documented via Compose labels/comments.
- [x] (2026-01-09) Compose standardization
  - Added canonical `docker/compose.yml` for `alfred` + `pg` (+ optional `redis` profile).
  - Added `voice` and `embed` profiles with dedicated images.

### Phase 3: Modular Ansible IaC (reusable, idempotent)

- [x] (2026-01-09) Create `infra/ansible/` with:
  - `roles/base` (packages, users, firewall defaults)
  - `roles/docker` (engine + compose plugin)
  - `roles/caddy` (TLS termination + reverse proxy)
  - `roles/alfred` (compose deploy, env templating, upgrades)
  - `roles/postgres` (data dir, backups, retention)
  - `roles/redis` (optional)
  - `roles/monitoring` (prom/grafana/loki/otel)
- [x] (2026-01-09) Inventories + vars
  - `inventory/hosts.yml`
  - `group_vars/all.yml` (non-secret defaults)
- [x] (2026-01-09) Operational playbooks
  - `deploy.yml` (initial deployment and configuration)

### Phase 4: Observability + telemetry (first-class)

- [x] (2026-01-09) Monitoring stack in Docker
  - Prometheus scrapes ALFRED `/api/metrics`.
  - Loki + promtail (or vector) for log aggregation.
  - Grafana dashboards (ALFRED core + DB + redis + container health).
- [ ] Runtime log/metric hygiene
  - Ensure all long-lived timers `.unref()` and no import-time work (guardrail tests).
  - Add error codes + structured context for voice/embed subprocess failures.
  - Standardize metric labels for service health + recovery actions.

### Phase 5: Agent tools for lifecycle + recovery (AI SDK v6)

- [x] (2026-01-09) Add a small, policy-gated tool catalog focused on _safe operations_:
  - `runtime.status` (deps + feature flags + pool health + active connections)
  - `runtime.recover` (restart voice/embed pools, reconnect redis, clear stale state)
  - `runtime.logs` (tail last N lines for a component, redacting secrets)
  - `deploy.status` (compose service state; local only unless explicitly configured)
- [x] (2026-01-09) Wire tools into agent defaults
  - Expose to orchestrator agent by default; assistant agent only when elevated + relevant.
- [ ] Recovery playbooks encoded as code
  - Deterministic decision tree: detect → classify → attempt bounded recovery → escalate.
  - Metrics emitted on every recovery attempt and outcome.

## Decision Log

- Decision: Prefer **single-host Docker Compose + Ansible** for production (home server / VM).
  - Rationale: single-user context, minimal operational burden.
  - Date: 2026-01-09
- Decision: Keep TLS termination **external** (Caddy) and keep ALFRED HTTP plaintext inside the private network.
  - Rationale: simpler cert rotation and consistent streaming/proxy behavior.
  - Date: 2026-01-09
- Decision: Observability baseline is **Prometheus + Grafana + Loki**, OTEL Collector optional.
  - Rationale: ALFRED already exports Prometheus metrics; logs are structured.
  - Date: 2026-01-09

## Validation / Acceptance Criteria

Minimum acceptance for “done”:

1. `docker build` succeeds for all shipped images.
2. `docker compose up` (canonical compose) brings up:
   - ALFRED + Postgres (required)
   - Redis (optional profile)
   - Monitoring (optional profile)
3. Runtime contracts:
   - Embeddings honors `EMBED_DEVICE` (unit test + integration sanity).
   - Voice container includes required system deps and can run a smoke start.
   - If `/api/subscriptions` is kept: client ↔ server integration test passes.
4. Observability:
   - Prometheus scrapes `/api/metrics` and Grafana dashboard renders core panels.
5. Agent recovery:
   - A test simulates a failed voice/embed subprocess and asserts bounded recovery + metrics.

## Surprises & Discoveries

- (none yet)

## Outcomes & Retrospective

- (pending)
