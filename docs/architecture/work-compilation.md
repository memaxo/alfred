# Work compilation

Purpose: Define the canonical “work compilation” artifact that summarizes what a workflow run changed, and how clients retrieve and render it after the run completes.

Owner: workflow

## Why this exists

The pipeline persists checkpoints (`workflow_snapshots`) for resume. However, checkpoints may be deleted after completion, so **post-run views must not depend on snapshots** for durable “what happened” output.

We persist a compact compilation object as part of the workflow run record (`workflow_runs.stateData`) and expose it through an API endpoint. This makes completion presentation consistent across Web, Native, and TUI.

## Data contract

### Persisted record

- **Storage**: `workflow_runs.stateData.compilation`
- **Type**: `WorkflowCompilation` (`@alfred/type/compilation`)
- **Versioning**: `version: "workflow-compilation-v1"`

The payload is intentionally compact:

- `summaryText` (human-readable completion sentence)
- `fileChanges` (created/modified/deleted paths)
- `agents[]` (agent outcomes + summaries)
- timing/count fields copied from pipeline `ExecutionSummary`

Do **not** store full context bundle file contents in compilation.

### Streaming preview

The pipeline emits `pipeline:complete.summaryText` so UIs can show an explicit completion card immediately, without waiting for a follow-up fetch.

## Implementation pattern

### API-layer observer

Create an API-layer `PipelineObserver` that:

- collects `context:set` values for `executeOutput` and `summarizeOutput`
- on `pipeline:complete`, builds a `WorkflowCompilation` and persists it to `workflow_runs.stateData`
- on `pipeline:failed`, persists a partial compilation (status + error + any available work)

Canonical implementation: `packages/api/src/services/compilation.ts`

### API endpoint

Expose a query endpoint that returns `WorkflowCompilation | null` for a `runId`:

- `packages/api/src/routers/workflow.ts` → `workflow.compilation.get`

Clients should use:

- streaming preview for immediate “Completed” UI
- compilation fetch for the full “Work” view

## Client usage

- **Web**: Work tab in workflow details + “Completed” card in `WorkflowWindow`.
- **Native**: workflow detail screen displays compilation when run is completed/failed.
- **TUI**: CLI command prints compilation by run id.
