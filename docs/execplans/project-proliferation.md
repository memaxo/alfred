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
- [ ] (2026-01-09) Milestone 1: Fix Project↔Linear linkage by storing Linear workspace (“space”) ID on projects and using it for Linear installation lookup (instead of filesystem workspace path).
- [ ] (2026-01-09) Milestone 2: Attach `projectId` to Codex sessions/runs and propagate it through the runtime/orchestrator so learning and artifacts are project-scoped.
- [ ] (2026-01-09) Milestone 3: Attach `projectId` to conversations/messages, RAG documents/chunks, and memory graph nodes/edges (or introduce an explicit project-scoping column that replaces implicit `resource` scoping).
- [ ] (2026-01-09) Milestone 4: Introduce managed Project↔Container attachments: reuse a shared AgentFS container per project for development, and attach additional containers for deployments.
- [ ] (2026-01-09) Milestone 5: Project lifecycle + learning decay integration: archival, relevance decay, and cross-project linkage (ALFRED self-improvement vs personal-assistant vs external codebases).

## Surprises & Discoveries

- Observation: ALFRED already has a durable `projects` table and UI window, and core workflow tables already reference `projectId`.
  Evidence: `packages/db/src/schema/project.ts`, `packages/db/src/schema/workflow.ts`, `apps/web/src/components/windows/project/project-window.tsx`.

- Observation: Memory graph storage already supports access-based adaptive decay (`access_count`, `last_accessed_at`), which is a key primitive for “forever stored with relevance decay.”
  Evidence: `packages/db/src/schema/graph.ts` and `docs/guides/memory-system.md`.

- Observation: Project↔Linear linkage currently uses `projects.workspace` as the key to fetch Linear installations, but `linear_installations.workspace_id` stores Linear organization IDs; `projects.workspace` is a filesystem path. This mismatch makes linking brittle/incorrect.
  Evidence: `packages/plan/src/project/linear.ts` calls `linearRepo.getLinearByWorkspace(project.workspace)`, while `packages/api/src/routers/linear.ts` stores `space: organizationId` into `linear_installations.workspace_id`.

## Decision Log

- Decision: Keep `projects.workspace` as the filesystem workspace path and add a new `projects.linear_space_id` column for the Linear organization/workspace id.
  Rationale: `projects.workspace` is already used as a unique key for project detection (`UNIQUE(user_id, workspace)`), and conflating filesystem paths with Linear organization IDs breaks correct Linear linkage. Adding `linear_space_id` is additive and supports future multi-org setups.
  Date/Author: 2026-01-09 / agent

- Decision: Treat “Project” as the primary scoping key for durable entities (runs, chats, knowledge, artifacts), even when additional “resource” identifiers exist.
  Rationale: Project scoping enables strong locality for retrieval + learning, enables per-project container reuse, and provides a clean lifecycle boundary for retention/decay policies.
  Date/Author: 2026-01-09 / agent

## Outcomes & Retrospective

- (Pending) This ExecPlan has been drafted but implementation milestones are not yet complete.

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

