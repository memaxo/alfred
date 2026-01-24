# AgentFS CAS & Archives

1. Store content-addressed exports under `.agentfs/cas/<sha256>.tar.gz` with sidecar metadata `.agentfs/cas/<sha256>.json`.
2. Produce deterministic archives via `tar -cf` + `gzip -n` when available; fall back to `tar -czf` only when `gzip` is unavailable or fails.
3. CAS metadata must include `{ sha, runId, projectId, createdAt, sizeBytes }` and treat `projectId` as an access boundary.
4. Export/download/restore routes that accept a `projectId` must enforce access via `checkAgentfsAccess()` and must reject CAS downloads/restores when metadata `projectId` is present but does not match the requested `projectId`.
5. When restoring from a project-scoped source, write `.agentfs/<runId>/.project` to persist the project hint for future access checks.
6. Cleanup schedulers must delete CAS artifacts older than `ALFRED_AGENTFS_CAS_RETENTION_DAYS` (default 30), delete the paired `.json`, and preserve any `<sha>.keep` pinned artifacts.
7. Add route tests that cover `store=1` export, download-by-sha authorization, and restore-by-sha including `.project` tagging.
