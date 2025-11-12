# ALFRED AI SDK v6 Adoption Audit

This document tracks the migration status of ALFRED to the AI SDK v6 runtime.

## Current State

- **Assistant & Orchestrator Routers:** use `generateText` and `streamText` with AI SDK v6 tool registries.
- **Workflow Router:** emits AI SDK v6 UI events via the placeholder runner. Full workflow orchestration will iterate on this foundation.
- **Tooling:** Shared tool registry (`@alfred/agent/src/v6.ts`) wraps existing tool modules with AI SDK `tool()` helpers.
- **Streaming:** HTTP endpoints (`/api/assistant`, `/api/orchestrator`) emit AI SDK UI message streams (`toUIMessageStreamResponse`).
- **Runtime Context:** A lightweight `RuntimeContext` shim in `@alfred/type` replaces the previous dependency.
- **Chat UI:** `@alfred/ui` Chat renders AI SDK UI messages with optional virtualization.

## Outstanding Work

| Area | Status | Notes |
|------|--------|-------|
| Workflow runner | In Progress | Placeholder events in place; full planning/execution logic to be ported. |
| Tool execution metrics | In Progress | Metrics registered; ensure high-cardinality labels remain bounded. |
| Evaluations | Not Started | `eval.run.start` currently disabled pending new evaluation harness. |
| Documentation | In Progress | Continue rewriting legacy docs toward AI SDK v6 references only. |

## Observability Checklist

- [ ] Expose workflow stream health metrics (success/failure counters, duration histograms)
- [ ] Add AI SDK tool invocation counters with latency buckets
- [ ] Add structured logging around tool errors and workflow resume events

## Testing Checklist

- [ ] Add regression tests for workflow resume events (`deploy-authz`, `linear-authz`, `bio-authz`)
- [ ] Mock AI SDK tool execution in router unit tests
- [ ] Add SSE smoke tests for `/api/orchestrator`

## Migration Guardrails

- Prefer pure data structures for UI streaming (`UIMessage`, `WorkflowEvent`)
- Keep AI SDK dependencies up to date (`ai@^6.x`, provider packages)
- Ensure `@alfred/agent` exports remain focused on AI SDK v6 tool registries and metrics only
