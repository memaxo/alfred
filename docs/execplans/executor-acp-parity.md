# executor-acp-parity

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

ALFRED currently supports multiple “executors” (subagents) such as Codex and OpenCode. After this work, ALFRED will have a single canonical Codex executor implementation, and OpenCode will fully interoperate with Agent Client Protocol (ACP) as a first-class executor: filesystem operations work, and thought/plan/diff events flow through ALFRED’s runtime tracking and UI streaming.

You can see it working by running ALFRED’s tests which cover:

- OpenCode server profile reuse, restart, and abort behavior.
- OpenCode ACP filesystem read/write behavior in both host and AgentFS-container modes.
- OpenCode thought/plan/diff event handling producing tracker updates and file hints.
- A single canonical Codex tool is used by both the runtime and the orchestrator tool registry.

## Progress

- [ ] (2026-01-12) Canonicalize Codex tool entrypoint (remove duplicate; make all imports explicit and consistent).
- [ ] (2026-01-12) Implement ACP filesystem operations for OpenCode (host + AgentFS container), with ALFRED security boundaries.
- [ ] (2026-01-12) Integrate ACP thought/plan/diff events end-to-end (writer → tracker → workflow event stream).
- [ ] (2026-01-12) Add missing tests and verification script(s) for OpenCode parity and no-regression coverage.
- [ ] (2026-01-12) Run comprehensive validation: typecheck + targeted tests (unit/integration) and fix regressions.

## Surprises & Discoveries

- Observation: ALFRED currently defines tracker events only as `codex/*`, but OpenCode can emit thought/plan/diff over ACP; mapping these into Codex-shaped events is a hidden coupling that blocks full executor parity.
  Evidence: `packages/agent/src/orchestrator/multi/tracker.ts` only allows `codex/thought`, `codex/command`, `codex/file`.

- Observation: There are two Codex tool entrypoints; the orchestrator tool registry likely imports the legacy one.
  Evidence: `packages/agent/src/v6.ts` imports `./orchestrator/tool/codex` while both `packages/agent/src/orchestrator/tool/codex.ts` and `packages/agent/src/orchestrator/tool/codex/index.ts` exist.

## Decision Log

- Decision: Treat OpenCode ACP filesystem operations as part of ALFRED’s executor integration and implement them with the same security constraints as Codex (allowed prefixes + AgentFS container path restrictions).
  Rationale: Upstream OpenCode ACP agents expect filesystem capabilities; advertising them but returning empty content is incorrect and reduces agent quality.
  Date/Author: 2026-01-12 / assistant

- Decision: Replace Codex-only tracker event types with executor-agnostic tracker event types, and migrate call sites in one pass.
  Rationale: “No technical debt” requires removing codex-shaped coupling and making the tracker correct for any executor, while keeping runtime stuck detection and MAX_TRANSITIONS safeguards intact.
  Date/Author: 2026-01-12 / assistant

## Outcomes & Retrospective

- Pending.

## Context and Orientation

ALFRED executor work happens in two layers:

1) **Runtime dispatch** chooses an executor per agent and calls the executor tool:

   - `packages/runtime/src/orchestrator/agent.ts` (`runAgent`) selects `"codex" | "droid" | "opencode"` and threads execution profile (`default|server`) and AgentFS container routing into tool calls.

2) **Executor tools** implement execution:

   - Codex: `packages/agent/src/orchestrator/tool/codex/` (modern) and `packages/agent/src/orchestrator/tool/codex.ts` (legacy duplicate, to be removed).
   - OpenCode: `packages/agent/src/orchestrator/tool/opencode/` runs an ACP stdio backend, either host-spawned (default) or container-spawned (server).

OpenCode’s ACP client surface is implemented inside `packages/agent/src/orchestrator/tool/opencode/exec.ts` via `ClientSideConnection`. This file currently stubs filesystem calls and only partially handles ACP session update events.

Tracking and stuck detection is implemented in:

   - `packages/agent/src/orchestrator/multi/tracker.ts` (LoopDetector-backed MAX_TRANSITIONS + no-progress windows)
   - `packages/runtime/src/orchestrator/agent.ts` (ingests writer events and calls `updateTrackerWithContext`)

Server-profile lifecycle is shared between executors via:

   - `packages/agent/src/orchestrator/tool/shared/server.ts` (`ensureServer`, `stopAllServers`, `resolveExecProfile`)
   - `packages/runtime/src/orchestrator/index.ts` cleans up servers in a `finally` block.

## Plan of Work

This work proceeds in five milestones.

### Milestone 1: Canonicalize Codex tool entrypoint

We will remove the duplicated Codex tool implementation and make all Codex imports explicit so there is only one `toolCodex` used by:

- runtime flows (`runAgent`, merge/review/conflict phases),
- orchestrator tool registry (`packages/agent/src/v6.ts`),
- loop flows (`packages/agent/src/orchestrator/loops/ralph.ts`).

Edits:

- Update `packages/agent/src/v6.ts` to import `toolCodex` from `packages/agent/src/orchestrator/tool/codex/index.ts` explicitly.
- Delete `packages/agent/src/orchestrator/tool/codex.ts` after verifying no remaining imports.
- Add/adjust a unit test that fails if the registry uses the legacy Codex schema (e.g., asserts `execProfile` exists on the registered Codex tool schema).

### Milestone 2: Implement ACP filesystem operations for OpenCode

We will implement `readTextFile` and `writeTextFile` in `packages/agent/src/orchestrator/tool/opencode/exec.ts` with:

- Host mode: Bun-native file I/O (`Bun.file`, `Bun.write`) guarded by ALFRED allowed prefixes.
- AgentFS container mode: proxy file I/O via `docker exec` (no shell), restricted to `/workspace/**`, and only for AgentFS containers.

We will also ensure ACP client capabilities accurately reflect what we implement (no lying about capabilities).

### Milestone 3: Fully integrate thought/plan/diff events

We will extend the OpenCode ACP session-update handler to process:

- `agent_thought_chunk` → tracked “thought” events
- `plan` → tracked plan/progress events (and surfaced as workflow events)
- `tool_call_update` diff payloads → artifact/file hint events (path-based at minimum)

To remove Codex-shaped coupling, we will make tracker events executor-agnostic and update the runtime ingestion accordingly.

### Milestone 4: Verification: tests and scripts

We will add/extend tests to cover:

- OpenCode filesystem operations (host + container paths) including security boundary rejection cases.
- OpenCode thought/plan/diff event mapping affecting tracker and file hints.
- Codex tool registry canonicalization (no legacy path).
- Workflow-level server cleanup invariants (existing tests must still pass).

We will add a verification script `scripts/verify-opencode-live.ts` analogous to `scripts/verify-codex-live.ts` (but kept minimal and deterministic).

### Milestone 5: Comprehensive validation

We will run:

- `bun run typecheck`
- `bun scripts/test-bun.ts` (scoped to the modified packages/files) with timeouts
- any relevant integration suites already present for workflow runtime cleanup and agent dispatch

We will fix regressions immediately and update this plan’s `Progress`, `Decision Log`, and `Outcomes & Retrospective` as we go.

## Concrete Steps

All commands are run from the repository root.

1) Find and remove duplicate Codex tool:

   - Search for imports of `packages/agent/src/orchestrator/tool/codex.ts` and update them to the canonical path.
   - Delete the legacy file once unused.

2) Implement ACP filesystem ops:

   - Add secure path resolution helpers in `packages/agent/src/orchestrator/tool/opencode/exec.ts`.
   - Implement host mode with Bun-native file I/O.
   - Implement container mode with `docker exec` and stdin piping (no shell).

3) Integrate thought/plan/diff:

   - Extend the ACP `sessionUpdate` handler to map those event kinds to ALFRED events.
   - Refactor tracker event types to be executor-agnostic; update runtime ingestion.

4) Add tests:

   - Update existing OpenCode exec tests or add new ones for filesystem and event mapping.
   - Add tests enforcing single Codex tool entrypoint usage.

5) Validate:

   - Run `bun run typecheck`.
   - Run targeted tests via `bun scripts/test-bun.ts` with appropriate filters.

## Validation and Acceptance

Acceptance is:

- All Codex references resolve to the canonical `packages/agent/src/orchestrator/tool/codex/` implementation.
- OpenCode ACP filesystem operations return real file content and write actual files (host mode) while rejecting paths outside allowed prefixes; in container mode, rejects paths outside `/workspace` and refuses non-AgentFS container names.
- OpenCode ACP `agent_thought_chunk` and `plan` events are visible in ALFRED’s workflow event stream and affect stuck detection inputs deterministically.
- Diff/tool edits produce artifact/file hint events used by downstream merge/review heuristics.
- Tests pass, including:
  - OpenCode tool exec tests
  - runtime agent dispatch tests
  - orchestrator executor cleanup tests

## Idempotence and Recovery

- All code changes are safe to re-run and re-test.
- Deleting the legacy `packages/agent/src/orchestrator/tool/codex.ts` is safe once all imports are removed; if needed, revert by restoring the file from version control.

## Interfaces and Dependencies

- ACP library: `@agentclientprotocol/sdk` via `@alfred/protocol/acp.ts`.
- File I/O: prefer `Bun.file` and `Bun.write` for host mode; for container mode use `Bun.spawn(["docker", "exec", ...])` with stdin piping to avoid shells.
- Security boundaries: reuse ALFRED’s existing filesystem allowlist logic (`DEFAULT_ALLOW_PREFIXES`, `openDirectorySecure`, and `/workspace` constraints in AgentFS).

