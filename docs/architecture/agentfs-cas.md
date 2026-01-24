# agentfs-cas

Purpose: Document the canonical pattern for AgentFS portable archives and content-addressed storage (CAS), including access control, on-disk layout, and retention.

## On-disk layout

- Run directories: `.agentfs/<runId>/...`
  - Project hint (optional): `.agentfs/<runId>/.project` (UUID)
  - Retention override (optional): `.agentfs/<runId>/.retention` (integer days)
- Content-addressed archives:
  - Archive: `.agentfs/cas/<sha256>.tar.gz`
  - Metadata: `.agentfs/cas/<sha256>.json`
  - Pin file (optional): `.agentfs/cas/<sha256>.keep`

## Canonical archive format

- Prefer deterministic creation: `tar -cf` + `gzip -n` so identical inputs produce identical `<sha256>`.
- Fallback when `gzip` is unavailable/fails: `tar -czf` (functional, but not deterministic across runs).

## CAS metadata contract

`<sha>.json` stores:

```json
{
  "sha": "<sha256>",
  "runId": "<runId>",
  "projectId": "<uuid>|null",
  "createdAt": "<iso>",
  "sizeBytes": 123
}
```

## Access control (project-scoped)

- AgentFS routes must validate run ownership using a project hint when present (`.agentfs/<runId>/.project`) and enforce DB-backed ownership when the DB is available.
- CAS downloads/restores are project-scoped when `metadata.projectId` is set:
  - Missing or mismatched `projectId` must be rejected (403).
- Restores from CAS must write the `.project` file into the restored run directory so subsequent reads/downloads remain scoped.

## Retention

- CAS cleanup is age-based and controlled by `ALFRED_AGENTFS_CAS_RETENTION_DAYS` (default: 30).
- Cleanup must preserve any pinned artifacts with `<sha>.keep`.
