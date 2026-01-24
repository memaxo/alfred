# Proxmox Provisioning (Prod) — ALFRED server + Postgres + Redis

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this document in accordance with `.agent/PLANS.md`.

Owner: infra

## Purpose / Big Picture

Provision production infrastructure for **ALFRED itself** (not apps ALFRED generates) on a Proxmox VE host. After this work, a newcomer can:

- Run a single idempotent script to **create or reuse**:
  - an ALFRED server LXC (web + API-in-process),
  - a Postgres 16 + pgvector LXC,
  - a Redis LXC,
    and start them if needed.
- Re-run the script safely (no destructive operations by default, no duplicate creates).
- Verify connectivity by polling ALFRED health endpoints (`/healthz`, `/healthz/deps`) once the ALFRED service is installed and running in the server container.
- Follow updated docs to understand the chosen topology, required Proxmox API credentials, and the next operational steps (deploying ALFRED, applying migrations, enabling schedulers).

## Progress

- [x] (2026-01-10) Audited existing Proxmox tool + client library surface and existing deployment docs.
- [x] (2026-01-10) Decide topology (LXC-only) and encode defaults (VMIDs, hostnames, storage, network).
- [x] (2026-01-10) Implement `scripts/proxmox.ts` provisioning workflow (create/start/wait/status/report).
- [x] (2026-01-10) Add optional verification step that checks `/healthz` and `/healthz/deps` on the ALFRED server endpoint (requires ALFRED service running).
- [x] (2026-01-10) Update docs (`docs/guides/deployment.md`, `docs/architecture/deployment-proxmox.md`, `docs/architecture/production-proxmox.md`) to match the script and topology.
- [x] (2026-01-10) Update `config/env.example` with Proxmox provisioning env vars used by `scripts/proxmox.ts`.

## Surprises & Discoveries

- Observation: The Proxmox API client in `packages/agent/src/lib/proxmox.ts` supports only a minimal subset today (LXC create/start/stop/destroy/snapshot/rollback/status, VM power/status, task wait).
  Evidence: `packages/agent/src/lib/proxmox.ts` exports `class proxmox` with those methods only.

- Observation: The orchestrator tool wrapper `packages/agent/src/orchestrator/tool/proxmox.ts` includes the same set of operations and does not support VM creation.
  Evidence: Tool input schema includes `vm_power`/`vm_status`, but no VM create action.

## Decision Log

- Decision: Use **LXCs** for ALFRED server + Postgres + Redis to match the existing Proxmox API surface (no VM create) and keep provisioning idempotent.
  Rationale: The repo’s Proxmox integration can create LXCs directly; VM creation would require adding new API calls or shelling out to `qm`, which expands scope.
  Date/Author: 2026-01-10 (Codex)

## Outcomes & Retrospective

- Outcome: Added `scripts/proxmox.ts`, an idempotent Proxmox provisioning script that creates/starts three LXCs and can optionally verify ALFRED health endpoints once the service is deployed.
  Date/Author: 2026-01-10 (Codex)

- Outcome: Updated deployment docs and `config/env.example` to reflect the LXC-based topology and script-driven workflow.
  Date/Author: 2026-01-10 (Codex)

- Follow-up: If we want “fully automated” provisioning (install Postgres/Redis/packages and deploy ALFRED inside containers), extend `packages/agent/src/lib/proxmox.ts` with additional API endpoints (or a separate SSH/exec mechanism) and keep the workflow policy-gated.
  Date/Author: 2026-01-10 (Codex)

## Context and Orientation

Existing Proxmox integration points:

- Proxmox tool (agent/orchestrator layer): `packages/agent/src/orchestrator/tool/proxmox.ts`
  - Validates inputs/outputs and enforces tool authorization scopes.
  - Not used directly for production provisioning, but its supported operations define what we can do safely via the Proxmox API today.
- Proxmox API client: `packages/agent/src/lib/proxmox.ts`
  - Implements raw HTTP requests to Proxmox’s API endpoints and maps common errors (401/403 auth, 404 not found, timeouts, network errors).
  - Supports `taskWait` to block until a Proxmox task completes.

Existing documentation to reconcile:

- `docs/architecture/deployment-proxmox.md` (broad deployment options; notes TanStack Start serves web+API together).
- `docs/architecture/production-proxmox.md` (production guide with GPU passthrough context).
- `docs/guides/deployment.md` (general production deployment checklist; already references `/healthz` and `/healthz/deps`).

Health check endpoints (server):

- `apps/web/src/routes/healthz.ts` and `apps/web/src/routes/healthz/deps.ts` define the canonical health routes.

## Plan of Work

1. Implement a Bun/TypeScript script at `scripts/proxmox.ts` that:
   - Reads Proxmox API env vars:
     - `PROXMOX_HOST`, `PROXMOX_TOKEN_ID`, `PROXMOX_TOKEN_SECRET`, and `PROXMOX_NODE`.
   - Reads provisioning config (defaults, but overrideable via env vars):
     - VMIDs for `alfred`, `alfred-db`, and `alfred-redis`.
     - Hostnames.
     - Storage pool/rootfs sizing for each LXC.
     - Network config (`net0`) with static IPs so the script can run health checks deterministically.
     - OS template path (`ostemplate`).
   - For each LXC:
     - Call `lxcStatus(node, vmid)`:
       - If it returns running/stopped/paused: treat as “exists”.
       - If it throws `ProxmoxError.kind === "notfound"`: create it via `lxcCreate(...)`, then `taskWait(...)`.
     - Ensure it is running via `lxcStart(...)` + `taskWait(...)` if needed.
   - Print a final report with VMIDs, hostnames, and expected IPs.
2. Add verification:
   - `fetch("http://<alfred-ip>:<port>/healthz")` and `/healthz/deps` with timeouts and retries.
   - Document clearly that health verification requires ALFRED to already be deployed and running inside the server container.
3. Update docs to match:
   - Add a “Proxmox quickstart” section referencing `scripts/proxmox.ts` usage and the chosen topology.
   - Keep the runbook explicit: provisioning (Proxmox) vs deployment (installing ALFRED app inside the container).
4. Update `config/env.example` if the script requires additional env vars beyond the existing `PROXMOX_*` set.

## Concrete Steps

1. Provision containers:

   cd /path/to/repo
   PROXMOX_HOST=... PROXMOX_TOKEN_ID=... PROXMOX_TOKEN_SECRET=... PROXMOX_NODE=... \\
   bun run scripts/proxmox.ts

2. Verify ALFRED health (requires ALFRED running in the server container):

   curl http://<alfred-ip>:3000/healthz
   curl http://<alfred-ip>:3000/healthz/deps

## Validation and Acceptance

Acceptance is satisfied when:

- Re-running `bun run scripts/proxmox.ts` does not create duplicates and does not destroy anything by default.
- The script creates/starts the three containers (or reuses them if present) and prints a clear summary.
- Health checks are documented and the script can perform them when ALFRED is running.
- Documentation clearly distinguishes:
  - provisioning Proxmox resources (this plan),
  - deploying/running ALFRED inside the ALFRED server container (follow-on operational steps).

## Idempotence and Recovery

- The script must treat “resource already exists” as success and should only create resources when a 404/not-found is observed.
- No `destroy` operation is performed by default.
- If a create operation fails mid-flight, the script should print enough detail (UPIDs and endpoints) to retry safely.

## Artifacts and Notes

- Provisioning script: `scripts/proxmox.ts`.
- Proxmox client: `packages/agent/src/lib/proxmox.ts`.
