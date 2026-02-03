# executor-api-management

Purpose: define a **first-class Executor API Management surface** for ALFRED’s executor backends (**Opencode**, **Codex**, **Droid**), with **Opencode as the primary/most complete implementation first**. This is an **ALFRED backend** concern (tRPC/API + orchestration), not UI-only.

Scope: static inventory + concrete gap matrix against what ALFRED can support today (evidence via file paths), and the target API contract we’re implementing using **AgentFS router (`packages/api/src/routers/agentfs.ts`)** + **AgentFS KV** as the storage/access-control backbone.

Owner: runtime/api

## Current executor-related surfaces (evidence index)

### Runtime dispatch (the canonical executor selection point)

- `packages/runtime/src/orchestrator/agent.ts`
  - Dispatch by `spec.agentType` (`"codex" | "droid" | "opencode"`)
  - `execProfile` selection + server fallback semantics
  - MCP transport hints per executor
  - Opencode transport selection currently comes from env (`ORCH_OPENCODE_TRANSPORT`) and not from any persisted config.

### Agent executor tools (capability sources we can manage)

- **Opencode**
  - Tool: `packages/agent/src/orchestrator/tool/opencode/index.ts`
  - Input schema: `packages/agent/src/orchestrator/tool/opencode/definition.ts`
    - Supports `transport: "acp" | "http"`
    - Supports `execProfile: "default" | "server"`
    - HTTP supports `baseUrl` + basic auth (`username`, `password`)
  - HTTP server lifecycle helpers: `packages/agent/src/orchestrator/tool/opencode/server.ts`
  - HTTP execution path: `packages/agent/src/orchestrator/tool/opencode/http.ts`
  - ACP execution path: `packages/agent/src/orchestrator/tool/opencode/exec.ts`

- **Codex**
  - API router: `packages/api/src/routers/codex.ts` (streaming execution surface)
  - Tool (modern): `packages/agent/src/orchestrator/tool/codex/index.ts` + `packages/agent/src/orchestrator/tool/codex/*`
  - **Known drift risk**: legacy tool entrypoint also exists as `packages/agent/src/orchestrator/tool/codex.ts` (file) which can be selected by module resolution depending on import site.

- **Droid**
  - API router: `packages/api/src/routers/droids.ts` (run/stream/resume surface)
  - Tool: `packages/agent/src/orchestrator/tool/droid.ts`
  - No `server` exec profile (runtime already warns and continues).

### Existing “management backbone” (AgentFS router)

- `packages/api/src/routers/agentfs.ts`
  - Auth + scopes: `authedProcedure` + `requireScopes({ required: READ_SCOPES.AGENTFS | WRITE_SCOPES.AGENTFS })`
  - Policy enforcement: `requirePolicy("agentfs.read", ...)`
  - AgentFS workspace load + access control:
    - `loadAgentfs({ runId, dbPath })`
    - `enforceAgentfsProjectAccess({ ctx, runId, dbPath, baseDir, projectId })`
  - KV is currently enumerable via:
    - `kvList`
    - `snapshot` (`kvStore` is included)

### Version pins / vendor sources

- Submodule pointers:
  - `vendor/opencode` in `.gitmodules`
  - `vendor/codex` in `.gitmodules`
- AgentFS image pin (Opencode binary installed into the AgentFS container):
  - `docker/agentfs/Dockerfile` (`ARG OPENCODE_VERSION=...`)
- SDK dependency used for Opencode HTTP mode:
  - `packages/agent/package.json` (`@opencode-ai/sdk`)

Current alignment (2026-02-03):

- `vendor/opencode`: `acc2bf5db95f5719610e6811dca74c6cbe74b027` (tag `v1.1.49`)
- AgentFS image: `docker/agentfs/Dockerfile` `OPENCODE_VERSION=1.1.49`
- SDK: `packages/agent/package.json` `@opencode-ai/sdk` `^1.1.49`

## Target: Executor API Management contract (Opencode-first)

We’re implementing the management API **inside** the AgentFS router (`packages/api/src/routers/agentfs.ts`), so all operations inherit:

- Auth/session requirements
- OAuth scope requirements (`read:agentfs`, `write:agentfs`)
- Policy gating (`agentfs.read`)
- AgentFS run ownership + projectId enforcement

### Stored config model (AgentFS KV)

Config is **per AgentFS run** (stored in the run DB’s KV store). Key scheme is namespaced and future-proof:

- `executor:<kind>:config` (non-secret config, validated)
- `executor:<kind>:secrets` (secret-bearing subset, validated)

Rationale:

- This meets the “AgentFS router backbone” requirement.
- It keeps config close to the execution environment and run audit trail.
- It avoids introducing global/user preferences DB migrations for the first version.

Implication:

- Clients must set defaults per run (or copy from a prior run) rather than expecting a global preference.

### Procedures (contract)

All procedures are AgentFS-scoped and accept `{ runId, dbPath, projectId? }` + executor selector. Responses are typed via `@alfred/type` schemas.

- `agentfs.executorConfigGet`
  - Returns a **redacted/public** view of config (no secrets)
  - Includes metadata: `exists`, `updatedAt` (KV timestamp) if available

- `agentfs.executorConfigSet`
  - Validates config; splits secrets into `executor:<kind>:secrets`
  - Requires `write:agentfs` scope + policy gate
  - Returns the redacted/public view

- `agentfs.executorStatus`
  - Derived info only (no secrets):
    - Supported transports (Opencode: `acp|http`)
    - Supported execProfiles (`server` supported for Codex/Opencode only)
    - Whether config is internally consistent (e.g. http transport requires baseUrl unless container-mode)

- `agentfs.executorHealth`
  - Fast, bounded check (never hangs)
  - Opencode-first:
    - HTTP: ping the configured server with a hard timeout (and SSRF guards)
    - ACP: minimal check is best-effort (initially may return unsupported if no safe bounded handshake exists)
  - Codex/Droid: initially minimal/unsupported but contract-compatible

## Security + redaction requirements (why this matters)

### KV enumeration surfaces leak by default

Because `agentfs.kvList` and `agentfs.snapshot` currently expose KV values, we must not allow secrets to appear there.

Mitigation we will implement:

- Redact KV values for `executor:` keys in:
  - `agentfs.kvList`
  - `agentfs.snapshot` (`kvStore`)

### SSRF risk for Opencode HTTP baseUrl

Health checks and config storage can introduce SSRF vectors if `baseUrl` is arbitrary.

Mitigation we will implement:

- Strict URL validation for Opencode HTTP `baseUrl`:
  - Allow only loopback (`localhost`, `127.0.0.1`, `::1`) and RFC1918 IP literals by default
  - Block hostnames and public IPs unless an explicit server-side override is enabled
- Apply validation in:
  - `executorConfigSet`
  - `executorHealth`

## Gap matrix (what exists vs what the management surface must add)

| Capability                                     | Opencode today | Codex today | Droid today | Gap / action                                                                |
| ---------------------------------------------- | -------------: | ----------: | ----------: | --------------------------------------------------------------------------- |
| Persisted executor config                      |              ✗ |           ✗ |           ✗ | Add AgentFS KV-backed config get/set                                        |
| Typed, shared DTOs for config/status/health    |              ✗ |           ✗ |           ✗ | Add `@alfred/type` executor schemas                                         |
| Redacted config reads                          |              ✗ |           ✗ |           ✗ | Add public/redacted shapes + ensure KV list/snapshot redaction              |
| Health check endpoint                          |              ✗ |           ✗ |           ✗ | Add `executorHealth` (Opencode-first)                                       |
| SSRF hardening for HTTP baseUrl                |              ✗ |         n/a |         n/a | Add strict baseUrl validation + safe defaults                               |
| Unified status/capabilities surface            |              ✗ |           ✗ |           ✗ | Add `executorStatus` with a stable contract                                 |
| Runtime applies persisted config               |              ✗ |           ✗ |           ✗ | Read KV in runtime and apply to tool inputs (precedence rules)              |
| Version pin alignment (vendor vs image vs SDK) |       drifting |    drifting |         n/a | Update `vendor/opencode` and align AgentFS `OPENCODE_VERSION` intentionally |

## Related docs

- `docs/reports/executor-audit-codex-opencode.md` (executor interface audit; this doc adds the management API layer and its gaps)
