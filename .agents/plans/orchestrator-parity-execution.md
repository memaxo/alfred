# Orchestrator Parity — Execution Tracker

Repository: /Users/jackmazac/Development/alfred
Branch: feat/orchestrator-parity-v6
Owner: Codex (AI)

## Scope

Execute the orchestrator parity plan to integrate an AI SDK v6 workflow runner, durable persistence/replay, strict policy gates, and baseline observability. Maintain plan hygiene: update progress, decisions, surprises.

## Progress (UTC)

- [x] 2025-11-08T18:10Z – Checkpoint commit and feature branch created.
- [x] 2025-11-08T18:30Z – Added v6 runner (packages/api/src/workflow/runner.ts).
- [x] 2025-11-08T18:45Z – Integrated runner into workflow router (start/stream/resume); added durable persistence repo.
- [x] 2025-11-08T18:55Z – Observability: wired workflow/run-registry metrics.
- [x] 2025-11-08T19:05Z – Non‑stream generate optional persistence for replay (ENABLE_GENERATE_PERSIST=1).
- [x] 2025-11-08T19:25Z – Tests green; adjusted DOM/mocks for Bun runner.
- [x] 2025-11-08T19:30Z – Docs/env updated (README + config/env.example).

## Decisions

- Canonical persistence format is AI SDK v6 `UIMessage` serialized in `workflow_events.event_data`.
- Keep SSE as canonical stream for assistant/orchestrator; tRPC stream is for workflow viewer and internal clients.
- Gate non‑stream persistence behind `ENABLE_GENERATE_PERSIST` to keep local dev tests DB-light by default.

## Surprises & Mitigations

- Bun runner lacks `vi.mock`; switched to `bun.mock.module` for web integration tests.
- DOM tests relying on global `screen` can misbehave without JSDOM; migrated to instance queries.

## Validation

- Typecheck: `tsc -b` — PASS
- Tests: `bun test` — PASS (DB tests skipped unless RUN_DB_TESTS=1)
- Sanity: `rg "@mastra/"` — no matches beyond plan docs

## Follow-ups

- Expand runner to use real orchestrator tools for context gathering and planning.
- Add history hydration to the run viewer using `workflow.get`/`workflow.events`.
- Extend policy tests for obligations in medium/high autonomy flows.

