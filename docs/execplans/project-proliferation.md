# Project Proliferation & Linear Vocabulary

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

ALFRED already has a `projects` table, but “project” is not yet the *primary organizing axis* for the system: many durable entities (Codex runs, chats, RAG docs, memory graph nodes, deployments) are stored without a `projectId`, so retrieval, learning, and container reuse cannot reliably stay “neuron-local” to a project’s lifecycle.

After this work, every durable ALFRED entity will be explicitly attached to an ALFRED Project, and ALFRED’s internal vocabulary will mirror Linear’s mental model: a Linear “workspace” (organization) contains teams, projects, and issues. ALFRED’s own “projects” will be first-class, long-lived containers for codebases, assistant threads, ALFRED self-improvement goals, artifacts, and knowledge. Agents (Codex) will run in shared Docker containers, reused per project for development, with managed attachment of additional containers for deployments.

The user-visible proof is:

1. In the web UI, Projects can be linked to Linear projects reliably (no hidden dependency on filesystem paths).
2. Runs (workflow + codex) and conversations persist with `projectId` and can be filtered/grouped by project.
3. AgentFS containers are reused per project (development) and recorded as attached resources.

## Progress

- [x] (2026-01-09) Audit current state of Projects, Linear linkage, and AgentFS container reuse. Key files: `packages/db/src/schema/project.ts`, `packages/api/src/routers/project.ts`, `packages/plan/src/project/detect.ts`, `packages/plan/src/project/linear.ts`, `packages/agent/src/environment/agentfs.ts`, `packages/agent/src/orchestrator/tool/codex/spawn-process.ts`.
- [x] (2026-01-09) Milestone 1: Fix Project↔Linear linkage by storing Linear workspace (“space”) ID on projects and using it for Linear installation lookup (instead of filesystem workspace path).
- [x] (2026-01-09) Milestone 2: Attach `projectId` to Codex sessions/runs and propagate it through the runtime/orchestrator so learning and artifacts are project-scoped.
- [x] (2026-01-09) Milestone 3: Attach `projectId` to conversations/messages, RAG documents/chunks, and memory graph nodes/edges (or introduce an explicit project-scoping column that replaces implicit `resource` scoping).
- [x] (2026-01-09) Milestone 4: Introduce managed Project↔Container attachments: reuse a shared AgentFS container per project for development, and attach additional containers for deployments.
- [x] (2026-01-09) Milestone 5: Project lifecycle + learning decay integration: archival, relevance decay, and cross-project linkage. (Project archival + scheduler + archived-project accelerated decay; internal research now reads project conventions and performs weighted cross-project pattern lookup; pattern lifecycle scheduler added to retire/quarantine stale patterns.)
- [x] (2026-01-09) Milestone 6: Project-scope remaining durable entities (assistant artifacts + workflow replays). Added `project_id` to assistant tables (notes, reminders, timers, etc.), extended repo/routers to accept `projectId`, and updated `persistResult`/workflow suspension to store `projectId`.

## Surprises & Discoveries

- Observation: ALFRED already has a durable `projects` table and UI window, and core workflow tables already reference `projectId`.
  Evidence: `packages/db/src/schema/project.ts`, `packages/db/src/schema/workflow.ts`, `apps/web/src/components/windows/project/project-window.tsx`.

- Observation: Memory graph storage already supports access-based adaptive decay (`access_count`, `last_accessed_at`), which is a key primitive for “forever stored with relevance decay.”
  Evidence: `packages/db/src/schema/graph.ts` and `docs/guides/memory-system.md`.

- Observation: Project↔Linear linkage currently uses `projects.workspace` as the key to fetch Linear installations, but `linear_installations.workspace_id` stores Linear organization IDs; `projects.workspace` is a filesystem path. This mismatch makes linking brittle/incorrect.
  Evidence: `packages/plan/src/project/linear.ts` calls `linearRepo.getLinearByWorkspace(project.workspace)`, while `packages/api/src/routers/linear.ts` stores `space: organizationId` into `linear_installations.workspace_id`.

- Discovery: SQLite schema parity matters even for “optional” features; missing columns can cause silent persistence failures and test deadlocks.
  Evidence: `packages/db/src/sqlite/schema.ts` needed workflow event columns to match Postgres.

- Discovery: Graph `resource` scoping (via `scopeResource(projectId, resource)`) must be applied consistently across both persistence and retrieval; otherwise Codex learning context injection silently returns empty results.
  Evidence: `persistCodexExecution()` scopes `resource`, so `buildCodexLearningContext()` must be called with the same scoped key.

- Discovery: Plan internal research shipped with stubs for pattern lookup + convention extraction; once durable entities are project-scoped, retrieval must also become project-aware (and resilient when DB/embeddings are unavailable).
  Evidence: `packages/plan/src/research/patterns.ts` and `packages/plan/src/research/conventions.ts` were returning `[]`.

## Decision Log

- Decision: Keep `projects.workspace` as the filesystem workspace path and add a new `projects.linear_space_id` column for the Linear organization/workspace id.
  Rationale: `projects.workspace` is already used as a unique key for project detection (`UNIQUE(user_id, workspace)`), and conflating filesystem paths with Linear organization IDs breaks correct Linear linkage. Adding `linear_space_id` is additive and supports future multi-org setups.
  Date/Author: 2026-01-09 / agent

- Decision: Treat “Project” as the primary scoping key for durable entities (runs, chats, knowledge, artifacts), even when additional “resource” identifiers exist.
  Rationale: Project scoping enables strong locality for retrieval + learning, enables per-project container reuse, and provides a clean lifecycle boundary for retention/decay policies.
  Date/Author: 2026-01-09 / agent

- Decision: Keep RAG documents globally deduplicated while attaching them to projects via a join table (`project_rag_documents`).
  Rationale: Preserves the existing `rag_documents.source` uniqueness constraint while enabling per-project document collections.
  Date/Author: 2026-01-09 / agent

## Outcomes & Retrospective

- Milestones 1-4 implemented: durable entities now carry `projectId` (or are project-attached via join tables), and AgentFS containers are reused per project.
- Milestone 5 implemented: project archival + decay hooks are in place, internal research is project-aware (patterns + conventions), and pattern retention is automated.
- Milestone 6 implemented: assistant entities (notes, reminders, timers, bookmarks, tasks, events) and workflow replays/suspensions are now project-scoped.
- Added gated schedulers:
  - `SCHED_PROJECT_LIFECYCLE=1` to auto-archive inactive projects.
  - `SCHED_PATTERN_LIFECYCLE=1` to retire/quarantine stale workflow patterns.

## Context and Orientation

In this repository:

- `projects` are stored in Postgres in `packages/db/src/schema/project.ts` (migration: `packages/db/src/migrations/0055_projects.sql`). Projects are currently detected/created from a filesystem workspace path by `packages/plan/src/project/detect.ts`, called via the tRPC router `packages/api/src/routers/project.ts` and surfaced in the desktop web UI (`apps/web/src/components/windows/project/project-window.tsx`).

- Linear OAuth installations are stored in `linear_installations` (`packages/db/src/schema/linear.ts`). The column `workspace_id` stores Linear’s organization ID (called `space` in the repo’s Linear repo code), written by `packages/api/src/routers/linear.ts`.

- Agents run via AgentFS in Docker (`packages/agent/src/environment/agentfs.ts`), with the repo mounted at `/workspace` and Codex invoked inside the container using `docker exec` (`packages/agent/src/orchestrator/tool/codex/spawn-process.ts`).

## Plan of Work

This is a multi-phase refactor. Each milestone should be shippable and independently verifiable.

### Milestone 1: Fix Project↔Linear linkage (Linear vocabulary correctness)

Make “Linear workspace/space id” a first-class attribute of ALFRED projects.

Edits:

- Add `linear_space_id` to `projects` via a new migration in `packages/db/src/migrations/`.
- Update Drizzle schema `packages/db/src/schema/project.ts`.
- Update `packages/plan/src/project/linear.ts` so it resolves the Linear installation using `project.linearSpaceId` (or an explicitly provided override) rather than the filesystem workspace path.
- Update `packages/api/src/routers/project.ts` to supply the correct Linear `space` id when linking, using the active Linear installation.
- Update tests in `packages/plan/src/__tests__/linear-sync.test.ts`.

Acceptance:

- Link a project to a Linear project in the web UI; it succeeds while Linear is connected and fails with a clear error when Linear isn’t connected.

### Milestone 2: Attach `projectId` to Codex sessions/runs

Make Codex runs/sessions explicitly project-scoped to support learning/decay per project.

Edits:

- Add `project_id` to `codex_sessions` and `codex_runs` (migrations + Drizzle schema).
- Update the codex recorder path (`packages/agent/src/orchestrator/tool/codex/record.ts`) to populate projectId.
- When the runtime launches an agent, resolve projectId from workspace (via `@alfred/plan` project detection) and pass it into Codex execution metadata.

Acceptance:

- A Codex run row persisted during a workflow execution contains a non-null `project_id` matching the active ALFRED project.

### Milestone 3: Project-scope the rest of durable knowledge

Add projectId to:

- `conversations` / `messages`
- `rag_documents` / `rag_chunks`
- `memory_nodes` / `memory_edges`
- `deployments`

Acceptance:

- For a given project, queries for chats, RAG docs, and memory nodes can be scoped to that project without leaking cross-project data.

### Milestone 4: Managed Project↔Container attachments

Introduce explicit management of project-attached containers:

- Development: one reusable AgentFS container per project (default).
- Deployments: many containers per project, tracked and lifecycle-managed.

Implementation sketch:

- Create a `project_containers` table keyed by `(project_id, kind, name)` with status + last_used_at.
- Extend `AgentFSWorkspace` to accept an optional container name override from the runtime (container name derived from project id for dev reuse).

Acceptance:

- Two separate workflow runs in the same project reuse the same AgentFS container (visible in logs and/or DB).

### Milestone 5: Project lifecycle + retention + cross-project linkage

Make project boundaries meaningful over time.

Edits:

- Add `projects.archived_at/archived_reason` and archive/unarchive endpoints.
- Gate a lifecycle scheduler (`SCHED_PROJECT_LIFECYCLE=1`) to auto-archive inactive projects.
- Accelerate memory-node decay for archived projects (best-effort, Postgres).
- Implement internal research retrieval:
  - `lookupPatterns(intent, projectId)` uses weighted cross-project semantic matching.
  - `extractConventions(projectId)` returns stored project conventions.
- Gate a pattern lifecycle scheduler (`SCHED_PATTERN_LIFECYCLE=1`) to retire/quarantine stale patterns.

Acceptance:

- Inactive projects can be auto-archived and manually unarchived.
- Pattern lookup prefers same-project patterns but can fall back cross-project.
- Pattern lifecycle retires unused patterns and quarantines failing ones.

### Milestone 6: Project-scope assistant artifacts + workflow replays

Extend project ऑर्गेनाइज़िंग axis to remaining durable writes.

Edits:

- Add `project_id` UUID columns + indexes to assistant tables (`assistant_tasks`, `assistant_notes`, `assistant_events`, `assistant_reminders`, `assistant_bookmarks`, `assistant_timers`).
- Update SQLite schema parity in `packages/db/src/sqlite/schema.ts`.
- Update assistant repo signatures in `packages/db/src/repo/assistant.ts` to accept optional `projectId`.
- Update assistant API routers (`note`, `remind`, `timer`, `book`) to accept and propagate `projectId`.
- Update AI `persistResult()` and workflow suspension to store `projectId`.

Acceptance:

- Assistant entities created in a project context are persisted with `projectId`.
- Workflow runs created via replay or suspension are persisted with `projectId`.


## Concrete Steps

When implementing a milestone:

1. Add the migration under `packages/db/src/migrations/NNNN_<singleword>.sql`.
2. Update the matching Drizzle schema file under `packages/db/src/schema/`.
3. Update the relevant repo/router/service code.
4. Run targeted tests with Bun:

   - From repo root:
     - `bun run scripts/test-bun.ts --scope unit --filter @alfred/plan`
     - `bun run scripts/test-bun.ts --scope unit --filter @alfred/api`

5. If needed for integration verification:

   - `bun run db:migrate` (only when you intend to apply migrations to your local DB).

## Validation and Acceptance

Milestone 1 validation:

- Connect Linear in the Integrations UI.
- Open the Projects window and link an ALFRED project to a Linear Project ID.
- Expect success toast and persisted `projects.linear_project_id` (and `linear_space_id`) to be non-null.

Milestone 2 validation:

- Run a workflow that executes Codex.
- Query `codex_runs` and verify `project_id` is populated and matches `workflow_runs.project_id`.

## Idempotence and Recovery

- All migrations must be additive and use `ADD COLUMN IF NOT EXISTS` to support re-apply.
- Do not drop or rename columns in early milestones; prefer backfill + parallel reads and only later consider cleanup migrations.
- Container reuse changes must preserve an escape hatch: if project-based reuse fails, fall back to per-run container naming while still recording attachments.

