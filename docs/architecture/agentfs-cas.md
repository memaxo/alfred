# agentfs-cas

Purpose: Document the canonical pattern for AgentFS portable archives and content-addressed storage (CAS), including access control, on-disk layout, and retention.

## On-disk layout

- Run directories: `.agentfs/<runId>/...`
  - Project hint (optional): `.agentfs/<runId>/.project` (UUID)
  - Retention override (optional): `.agentfs/<runId>/.retention` (integer days)
  - Pin file (optional): `.agentfs/<runId>/.keep`
- Content-addressed archives:
  - Archive: `.agentfs/cas/<sha256>.tar.gz`
  - Metadata: `.agentfs/cas/<sha256>.json`
  - Pin file (optional): `.agentfs/cas/<sha256>.keep`

## Canonical archive format

- Prefer deterministic creation: stable file ordering + `tar -cf` + `gzip -n` so identical inputs produce identical `<sha256>`.
  - Stable ordering: enumerate files under the run directory in lexical order and pass tar an explicit file list.
  - Normalize metadata where supported: omit ACLs/xattrs and record numeric owner/group as `0`.
- Fallback when `gzip` is unavailable/fails: `tar -czf` (functional, but not deterministic across runs).

## CAS metadata contract

`<sha>.json` stores:

```json
{
  "sha": "<sha256>",
  "runId": "<runId>",
  "projectId": "<uuid>|null",
  "createdAt": "<iso>",
  "lastAccessedAt": "<iso>|undefined",
  "sizeBytes": 123
}
```

- `lastAccessedAt` is updated on download/restore for LRU-style cleanup policies.

## Access control (project-scoped)

- AgentFS routes must validate run ownership using a project hint when present (`.agentfs/<runId>/.project`) and enforce DB-backed ownership when the DB is available.
- CAS downloads/restores are project-scoped when `metadata.projectId` is set:
  - Missing or mismatched `projectId` must be rejected (403).
- Restores from CAS must write the `.project` file into the restored run directory so subsequent reads/downloads remain scoped.

## Retention policy

### Run directories (`.agentfs/<runId>/...`)

- Default TTL: `ALFRED_AGENTFS_RETENTION_DAYS` (default: 14).
  Rationale: run directories are a “warm” cache for recent inspection; long-term retention should be explicit via pins.
- Age basis: mtime of `.agentfs/<runId>/agentfs.db` when present; otherwise the run directory mtime.
- Restores: the restore route touches the restored DB mtime to `now` so restored runs are retained as “new” according to the TTL.
- Pins: `.agentfs/<runId>/.keep` prevents deletion.
- Per-run override: `.agentfs/<runId>/.retention` (positive integer days) overrides the default TTL.
- Failure auto-pin: enabled by default; set `ALFRED_AGENTFS_AUTOPIN_FAILURES=0` to disable.
  When enabled, runs that contain failure context are pinned by writing `.keep` instead of deleting.
- Size cap: `ALFRED_AGENTFS_MAX_BYTES` enforces a hard upper bound on total run bytes; oldest unpinned runs are deleted first. Pinned runs are never deleted to satisfy the cap.

### CAS archives (`.agentfs/cas/<sha>.tar.gz`)

- Default TTL: `ALFRED_AGENTFS_CAS_RETENTION_DAYS` (default: 30).
  Rationale: CAS archives are explicit exports/restores and are typically more valuable to keep longer than raw runs, but still must remain bounded by default.
- Age basis: prefer `<sha>.json.createdAt` when present and parseable; fall back to the archive filesystem mtime if metadata is missing/corrupt.
- Pins: `.agentfs/cas/<sha>.keep` prevents deletion.
- Deletion: removes both `.agentfs/cas/<sha>.tar.gz` and `.agentfs/cas/<sha>.json`.
- Size cap: `ALFRED_AGENTFS_CAS_MAX_BYTES` enforces a hard upper bound on total CAS bytes; oldest unpinned archives are deleted first. Pinned archives are never deleted to satisfy the cap.

### Integrity and safety

- Integrity checks: The integrity scheduler (`SCHED_AGENTFS_INTEGRITY=1`) verifies that `<sha>.tar.gz` hashes to `<sha>`. Mismatches result in quarantine to `.agentfs/quarantine/cas/`.
- Atomic metadata writes: CAS metadata is written via temp file + rename to prevent corruption.
- Orphaned file cleanup: Cleanup removes orphaned `.json` metadata and `.keep` files that lack a corresponding `.tar.gz` archive.
- Dry-run mode: Set `ALFRED_AGENTFS_CLEANUP_DRY_RUN=1` to log planned deletions without executing them.
- Quarantine protection: Quarantined runs and CAS archives (under `.agentfs/quarantine/`) are never deleted by retention schedulers.

### Deletion vs “cold storage”

- Time-based TTL cleanup is the primary bound on disk growth; compression alone is not a sufficient replacement.
- Long-term retention is achieved via explicit pins (`.keep`).
- A future cold tier (if needed) should be additive (offload/recompress pinned CAS artifacts) and must still be bounded (separate TTLs and/or size caps) while preserving project scoping.
