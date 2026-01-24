1. Workflow completion artifacts must be persisted outside pipeline snapshots (snapshots may be deleted on completion).
2. `@alfred/pipeline` stays DB-free; persist completion/compilation via an API-layer observer in `packages/api`.
3. Store durable work compilation under `workflow_runs.stateData.compilation` as a versioned object.
4. Emit a small completion preview (`summaryText`) in `pipeline:complete` for immediate UI presentation; fetch full compilation via API for detailed views.
