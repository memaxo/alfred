# Learning Architecture (Dreaming + Heuristics)

Owner: agent / db

## Purpose
Codify how ALFRED converts failures into durable heuristics (“dreaming”) and how those heuristics influence future Codex executions.

## Dreaming (failed runs → heuristics)
- **Trigger**: The learning worker processes `workflow_runs` where `status="failed"` and `dreamed_at IS NULL`.
- **Skip policy**: Ignore transient/infra-like errors (timeouts, network, 5xx/rate-limit style failures) to avoid poisoning heuristics.
- **Output**: Persist `memory_nodes.kind="heuristic"` under `resource="user"` with `properties.source="dreaming"`.
- **Deduplication**: Use a stable hash (content-addressed) so reprocessing never creates duplicates.

## Prompt influence (heuristics → Codex)
- **Builder**: Fetch user-scoped `kind="heuristic"` nodes and select a small, bounded set with cheap keyword overlap.
- **Sanitization**: All text injected into prompts must flow through `sanitizeContextText()` / `sanitizeGraphValue()` before concatenation.
- **Injection order**: Prepend `Heuristics` context first (user-scoped), then prepend `Similar past executions` (repo-scoped).
- **Safety**: Each injection block should be wrapped in its own try/catch with debug logging so prompt enrichment never blocks tool execution.

## Schema
- `workflow_runs.dreamed_at`: marks dreaming processed for a failed run.

