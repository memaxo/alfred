# agentfs api completion

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this work, ALFRED has a complete AgentFS API management surface enabling operators to fully manage runs, CAS archives, quarantine, and retention through the API. No manual filesystem operations required for common administrative tasks.

User-visible outcome: A web UI can provide complete AgentFS management (quarantine inspection, storage analytics, batch operations) without requiring operators to access the filesystem directly.

This plan targets ALFRED itself (the monorepo), not applications ALFRED generates.

## Progress

- [ ] (Pending) Create domain types for new endpoints in `packages/api/src/agentfs/domain.ts`
- [ ] (Pending) Implement quarantine management endpoints (list, inspect, restore)
- [ ] (Pending) Implement storage metrics endpoint with per-project breakdown
- [ ] (Pending) Implement batch operations (bulk delete, pin/unpin)
- [ ] (Pending) Implement advanced search (file content, KV, tool calls)
- [ ] (Pending) Implement retention policy management (preview, force cleanup)
- [ ] (Pending) Implement CAS management endpoints (list, metadata, delete)
- [ ] (Pending) Implement access control audit endpoint
- [ ] (Pending) Add tests for all new endpoints
- [ ] (Pending) Update OpenAPI/spec documentation
- [ ] (Pending) Run validators: all tests pass, typecheck clean

## Surprises & Discoveries

_(To be filled as work progresses)_

## Decision Log

_(To be filled as work progresses)_

## Outcomes & Retrospective

_(To be filled upon completion)_

## Context and Orientation

The AgentFS API surface currently provides:

- 22 tRPC procedures for run/file management
- 4 HTTP routes for export/restore
- 3 background schedulers (cleanup, integrity, compact)

This plan implements the missing management endpoints identified in the API surface audit:

1. **Quarantine Management** - Currently quarantine is write-only via integrity scheduler
2. **Storage Metrics** - Prometheus metrics exist but no queryable API
3. **Batch Operations** - No bulk actions for run management
4. **Advanced Search** - No cross-run search capabilities
5. **Retention Policy** - No preview/simulation capabilities
6. **CAS Management** - No direct CAS archive management
7. **Access Audit** - No queryable audit log

## Plan of Work

### Phase 1: Domain Types and Infrastructure

1. Extend `packages/api/src/agentfs/domain.ts` with:
   - `QuarantineEntry` type
   - `StorageMetrics` type
   - `BatchOperationResult` type
   - `SearchResult` type
   - `RetentionPreview` type
   - `CasArchiveInfo` type
   - `AuditLogEntry` type

2. Create service modules:
   - `packages/api/src/services/quarantine.ts`
   - `packages/api/src/services/metrics.ts`
   - `packages/api/src/services/search.ts`

### Phase 2: Quarantine Management

Implement tRPC procedures:

1. `quarantine.list` - List quarantined runs and CAS archives
   - Input: `{ cursor?: string; limit?: number }`
   - Output: `{ items: QuarantineEntry[]; nextCursor?: string }`
   - Permissions: `agentfs.admin` scope

2. `quarantine.inspect` - Get detailed quarantine info
   - Input: `{ runId?: string; casSha?: string }`
   - Output: `QuarantineEntry with details`
   - Permissions: `agentfs.read` scope

3. `quarantine.restore` - Restore from quarantine to active
   - Input: `{ runId?: string; casSha?: string; targetRunId?: string }`
   - Output: `{ success: boolean; newPath: string }`
   - Permissions: `agentfs.write` scope
   - Side effects: Move from `.agentfs/quarantine/` to `.agentfs/<runId>/`

### Phase 3: Storage Metrics

Implement tRPC procedure:

1. `metrics.storage` - Get storage usage metrics
   - Input: `{ projectId?: string }`
   - Output: `StorageMetrics`
   ```typescript
   interface StorageMetrics {
     total: {
       runsBytes: number;
       casBytes: number;
       quarantineBytes: number;
       totalBytes: number;
     };
     runs: Array<{
       runId: string;
       sizeBytes: number;
       fileCount: number;
       ageDays: number;
       pinned: boolean;
     }>;
     cas: {
       archiveCount: number;
       totalBytes: number;
       pinnedCount: number;
       pinnedBytes: number;
     };
     byProject?: Record<
       string,
       {
         runsBytes: number;
         casBytes: number;
       }
     >;
   }
   ```

### Phase 4: Batch Operations

Implement tRPC procedures:

1. `runs.batchDelete` - Bulk delete runs
   - Input: `{ runIds: string[]; dryRun?: boolean }`
   - Output: `BatchOperationResult`
   - Skips pinned runs unless `force: true`
   - Validates each run exists and is accessible

2. `runs.batchPin` - Bulk pin runs
   - Input: `{ runIds: string[]; reason?: string }`
   - Output: `{ pinned: string[]; alreadyPinned: string[]; failed: string[] }`

3. `runs.batchUnpin` - Bulk unpin runs
   - Input: `{ runIds: string[] }`
   - Output: `{ unpinned: string[]; notPinned: string[]; failed: string[] }`

4. `runs.batchExport` - Bulk export to CAS
   - Input: `{ runIds: string[]; projectId?: string }`
   - Output: `{ archives: Array<{ runId: string; sha: string }>; failed: string[] }`

### Phase 5: Advanced Search

Implement tRPC procedure:

1. `search.files` - Search file content across runs
   - Input: `{ query: string; projectId?: string; runIds?: string[]; limit?: number }`
   - Output: `{ results: SearchResult[] }`
   - Uses SQLite FTS if available, falls back to grep-like search
   - Respects file sensitivity classification

2. `search.kv` - Search KV store values
   - Input: `{ keyPattern?: string; valuePattern?: string; projectId?: string }`
   - Output: `{ results: Array<{ runId: string; key: string; value: string }> }`

3. `search.toolCalls` - Search tool call history
   - Input: `{ toolName?: string; paramPattern?: string; projectId?: string }`
   - Output: `{ results: Array<{ runId: string; toolCall: ToolCall }> }`

### Phase 6: Retention Policy Management

Implement tRPC procedures:

1. `retention.preview` - Preview what would be deleted
   - Input: `{ retentionDays?: number; maxBytes?: number; casMaxBytes?: number }`
   - Output: `RetentionPreview`

   ```typescript
   interface RetentionPreview {
     runsToDelete: Array<{
       runId: string;
       reason: "age" | "size_cap";
       ageDays: number;
     }>;
     runsToAutopin: Array<{ runId: string; reason: string }>;
     casToDelete: Array<{
       sha: string;
       reason: "age" | "size_cap";
       ageDays: number;
     }>;
     bytesToFree: number;
   }
   ```

2. `retention.cleanupNow` - Force immediate cleanup
   - Input: `{ retentionDays?: number; maxBytes?: number; dryRun?: boolean }`
   - Output: `{ runsDeleted: number; casDeleted: number; bytesFreed: number }`
   - Invokes cleanup scheduler immediately

3. `retention.simulate` - Simulate policy changes
   - Input: `{ newRetentionDays: number; newMaxBytes?: number }`
   - Output: Same as preview but with hypothetical values

### Phase 7: CAS Management

Implement tRPC procedures:

1. `cas.list` - List CAS archives
   - Input: `{ cursor?: string; limit?: number; projectId?: string }`
   - Output: `{ archives: CasArchiveInfo[]; nextCursor?: string }`

2. `cas.metadata` - Get CAS archive metadata
   - Input: `{ sha: string }`
   - Output: `CasArchiveInfo`

3. `cas.delete` - Delete CAS archive
   - Input: `{ sha: string; force?: boolean }`
   - Output: `{ success: boolean }`
   - Rejects if pinned unless `force: true`

4. `cas.migrateToCold` - Trigger cold tier migration (future)
   - Input: `{ shas: string[] }`
   - Output: `{ migrated: string[]; failed: string[] }`

### Phase 8: Access Control Audit

Implement tRPC procedure:

1. `audit.log` - Query audit log
   - Input: `{ runId?: string; userId?: string; action?: string; since?: Date; limit?: number }`
   - Output: `{ entries: AuditLogEntry[] }`
   - Tracks: file access, run clone, checkpoint restore, etc.

### Phase 9: Testing & Documentation

1. Add unit tests for each new service
2. Add integration tests for each endpoint
3. Update API documentation
4. Add runbook for common operations

## Concrete Steps

From repo root:

1. Create/update domain types:
   - Edit `packages/api/src/agentfs/domain.ts`

2. Implement service layer:
   - Create `packages/api/src/services/quarantine.ts`
   - Create `packages/api/src/services/metrics.ts`
   - Create `packages/api/src/services/search.ts`

3. Extend router:
   - Edit `packages/api/src/routers/agentfs.ts`

4. Add tests:
   - Create `packages/api/test/agentfs/quarantine.test.ts`
   - Create `packages/api/test/agentfs/metrics.test.ts`
   - Create `packages/api/test/agentfs/batch.test.ts`
   - Create `packages/api/test/agentfs/search.test.ts`

5. Run validators:
   - `bun test packages/api/test/agentfs/`
   - `bun run typecheck`

## Validation and Acceptance

This work is accepted when:

- [ ] All 22 new endpoints are implemented and tested
- [ ] Quarantine can be fully managed via API (no FS access needed)
- [ ] Storage metrics provide actionable insights
- [ ] Batch operations handle 100+ items efficiently
- [ ] Search returns results in < 5 seconds for typical queries
- [ ] Retention preview accurately predicts deletions
- [ ] CAS management respects pins and project scoping
- [ ] Audit log captures all sensitive operations
- [ ] All tests pass
- [ ] TypeScript typecheck passes
- [ ] Documentation is complete

## Idempotence and Recovery

- Batch operations are atomic per-item (failures don't stop batch)
- Quarantine restore validates target doesn't exist before move
- Retention cleanup preview must match actual cleanup (deterministic)
- Search uses read-only queries (no recovery needed)

## Artifacts and Notes

_(To be filled as work progresses)_

## Interfaces and Dependencies

- No new runtime dependencies
- Uses existing `@alfred/agent` for AgentFS access
- Uses existing `@alfred/db` for audit log storage
- Uses existing Prometheus client for metrics aggregation
