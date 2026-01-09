# Infrastructure Standardization

This document outlines ALFRED's standardized deployment and runtime architecture, designed for single-user reproducibility and agent-managed operations.

## Architecture Overview

ALFRED uses a modular infrastructure stack centered around Docker Compose and Ansible. The architecture is designed to be "sidecar-first," where specialized workloads (Voice, Embeddings, Monitoring) run in dedicated containers.

### Container Topology

- **Core (`alfred`)**: Bun-based SSR and API server. Light and fast.
- **Data (`postgres`, `redis`)**: Persistent storage with `pgvector` support.
- **ML Sidecars (`voice`, `embed`)**: Python-based runtimes for heavy model inference. Isolated to allow device-specific optimizations (CPU vs GPU).
- **Observability Sidecars (`prometheus`, `grafana`, `loki`)**: Standard monitoring stack for system health.

## Infrastructure as Code (Ansible)

ALFRED's production environment is managed via Ansible in `infra/ansible/`.

### Key Roles

- `base`: System-level hardening, users, and firewall (UFW).
- `docker`: Engine installation and Compose plugin configuration.
- `caddy`: Automated TLS termination and reverse proxying.
- `alfred`: Application orchestration, environment templating, and lifecycle management.
- `postgres`: Automated backups and retention policies.
- `monitoring`: Provisioning of the observability stack and Grafana dashboards.

## Agentic Lifecycle Management

Agents are first-class citizens in ALFRED's infrastructure. They are equipped with tools to monitor and recover the system.

### Recovery Tools

The `runtime` router provides the foundation for agentic recovery:
- **Status**: Inspects system dependencies (UV, Docker, DB) and feature flags.
- **Logs**: Tails container logs to diagnose failures without human intervention.
- **Recovery**: Executes safe recovery playbooks, such as restarting process pools or clearing stale state.

## Observability

Standard observability is provided via Prometheus and Grafana.
- **Metrics**: ALFRED exports metrics at `/api/metrics`.
- **Dashboards**: Pre-provisioned dashboards in `infra/ansible/roles/monitoring/templates/dashboards/` provide a starting point for system monitoring.
- **Logs**: Loki aggregates logs from all containers for centralized debugging.

## Development Patterns

1. **Multi-stage Builds**: Reducer image size and attack surface by excluding build toolchains from runtime stages.
2. **Context Awareness**: Use `.dockerignore` to keep build context small (e.g., excluding 19GB+ models).
3. **Device Fallbacks**: ML code must detect and fallback to CPU if specialized hardware (CUDA/ROCm) is unavailable.
