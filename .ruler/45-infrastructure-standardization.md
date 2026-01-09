# Infrastructure Standardization

## Core Principles

Standardize ALFRED’s deployment surface for reproducibility, modularity, and observability.

## Rules

1. **Modular Ansible Roles.** Group infrastructure logic into discrete roles (`base`, `docker`, `caddy`, `alfred`, `postgres`, `monitoring`). Each role must be idempotent and standalone.
2. **Sidecar Topology.** Use Docker Compose profiles for heavy or optional runtimes (`voice`, `embed`, `monitoring`). Never bundle heavy ML runtimes into the core `alfred` image.
3. **Multi-stage Dockerfiles.** All production images must use multi-stage builds.
   - Stage 1 (`base`): OS dependencies.
   - Stage 2 (`prune`): Turbo prune for monorepo isolation.
   - Stage 3 (`build`): Build-time dependencies and compilation.
   - Stage 4 (`runtime`): Minimal runtime environment, no compiler toolchain, non-root user.
4. **Context Optimization.** Maintain a comprehensive `.dockerignore`. Large model files (`*.onnx`, `*.pt`), heap snapshots, and local virtual environments must be excluded from the build context.
5. **Runtime Device Resolution.** ML runtimes must explicitly resolve devices (`cpu`, `cuda`, `rocm`, `mps`) from environment variables (e.g., `EMBED_DEVICE`) with safe CPU fallbacks.
6. **Agentic Lifecycle Tools.** Every core service must expose lifecycle tools to agents:
   - `runtime.status`: Health and dependency check.
   - `runtime.recover`: Safe restart/reconnection logic.
   - `runtime.logs`: Log tailing with secret redaction.
7. **Canonical Compose.** `docker/compose.yml` is the single source of truth for local and production deployment topologies. Use `.env.example` to document required variables.
8. **Observability Sidecars.** Standard monitoring stack consists of Prometheus, Grafana, Loki, and Promtail. Prometheus must scrape `/api/metrics`.
9. **Persistent Volume Documentation.** Document persistent data requirements (DB, models, logs) via Compose volumes and labels.
10. **Synchronous Repo Helpers.** Prefer synchronous repository helpers for queries that don't perform external I/O or complex logic, ensuring consistent linting and performance.
