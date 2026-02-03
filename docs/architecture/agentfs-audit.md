# agentfs-audit

Purpose: Document the canonical pattern for AgentFS audit logging and querying, backed by the policy `audit_logs` table (not filesystem `audit.log` files).

## Storage

- Audit rows live in `audit_logs` (schema in `@alfred/db`).
- Write API: `@alfred/agent/utils/audit` → `recordAudit(...)` → `@alfred/db/repo/policy.createAuditLog(...)`.
- Read API: `@alfred/db/repo/policy.queryAuditLogs(...)` (filtered queries + totalCount).

## Action naming

- AgentFS operation actions use the prefix `agentfs.op.`.
- The API domain union stores the suffix (e.g. `cas_export`) in `packages/api/src/agentfs/domain.ts`.
- The stored audit row action is `agentfs.op.<suffix>`.

## Resource encoding

- Prefer structured resource kinds:
  - Run: `agentfs_run:<runId>`
  - CAS: `agentfs_cas:<sha256>`
- Keep `projectId` set when the operation is project-scoped.

## Recording operations (API + web routes)

- Router procedures use a best-effort helper to record:
  - `decision`: `"allow"` on success, `"deny"` on failure
  - `context.success`: boolean (authoritative for UI)
  - `context.runId` / `context.sha` when available
- Audit failures must never block the primary operation.

Files:

- `packages/api/src/routers/agentfs.ts` (router procedures + `recordAgentfsOp`)
- `apps/web/src/routes/api/agentfs/export.ts` / `restore.ts` (route-level audit)

## Querying audit logs (AgentFS UI endpoints)

- Service: `packages/api/src/services/agentfs-audit.ts`
  - filters by `actionPrefix: "agentfs.op."`
  - supports filtering by `action`, `resource`, `resourceAll`, time range, and `decision`
  - maps DB rows to `AuditLogEntry` and extracts `runId`/`sha` from `resource` or `context`
- Router endpoints: `packages/api/src/routers/agentfs.ts` (`auditLog`, `auditRecent`, `auditStats`)

## Testing

- Unit tests should mock `@alfred/db/repo/policy` and include all imported exports (Bun `mock.module()` replaces the module’s full export surface).
- DB integration tests are gated behind `RUN_DB_TESTS=1` and should set `DATABASE_URL="sqlite::memory:"` before importing `@alfred/db`.
