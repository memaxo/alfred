# agentfs advanced features

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this work, AgentFS becomes a first-class “run filesystem” product inside ALFRED: users can browse historical runs, search and compare them, understand which tool caused which file changes, safely preview/inspect text and binary outputs, export/restore data between runs, and rely on background maintenance (retention tiers, integrity checks, and optional compaction/archival) without weakening security boundaries.

This plan targets ALFRED itself (the monorepo), not applications ALFRED generates.

This plan intentionally builds on the implemented foundations from `docs/execplans/agentfs-file-sharing.md` (file preview, download endpoint, artifact persistence, retention cleanup scheduler, base-run DB clone).

## Progress

- [x] (2026-01-23) Create `docs/execplans/agentfs-advanced-features.md`.
- [ ] (run explorer) Add a server-side run inventory API (DB-backed when available; filesystem scan fallback) and UI to browse/search runs. (completed: client-side search filter in workspace list; remaining: richer inventory source + filters)
- [x] (2026-01-24) (run stats) Add per-run summary stats (bytes written, file count, tool call count, checkpoint count) and expose them in the AgentFS Viewer.
- [ ] (path audit) Add per-file history and per-file timeline (“what happened to this path over time?”). (completed: MVP history section showing tool calls mentioning the path; remaining: checkpoint/snapshot-based timeline)
- [ ] (blame) Add file blame attribution to tool calls (best-effort correlation) in both API and UI. (completed: MVP `agentfs.fileBlame` + UI section; remaining: richer attribution / provenance)
- [ ] (run diff) Add compare view for two runs (file diff + KV diff). (completed: MVP `agentfs.compareRuns` + Compare tab; remaining: content-aware diffs + filtering/pagination)
- [ ] (safe preview++) Add enhanced safe preview rendering (bounded highlight/lines) and a binary inspector. (completed: MVP hex preview for binary content; remaining: bounded syntax highlight / long-line handling)
- [ ] (streaming preview) Add chunked/streamed preview for very large text files. (completed: MVP `agentfs.fileSlice` + "Load more" UI; remaining: streaming transport / infinite-scroll UX)
- [x] (2026-01-24) (live updates) Add a subscription/SSE surface that streams file change updates during a run.
- [x] (2026-01-24) (archive/export) Add an export endpoint that bundles a run into a portable archive.
- [x] (2026-01-24) (clone) Add a "clone run" capability that copies the AgentFS DB to a new runId.
- [x] (2026-01-24) (restore) Add “restore to new run” from: (a) run DB, (b) a checkpoint/snapshot, (c) an exported archive.
- [ ] (selective restore) Add selective file restore into a new run and (explicitly gated) into the host worktree.
- [ ] (checkpoint browser++) Add snapshot browser enhancements: labels, size deltas, and restore actions. (completed: restore actions + filesystem/KV discovery; remaining: size deltas)
- [ ] (artifact index) Add an artifacts index API + UI viewer for `.agent/tools/**` (schema-aware JSON rendering, safe text fallback).
- [ ] (handoff pack) Add a “handoff pack” generator (curated files + artifacts + summary) to seed follow-on runs. (completed: download route bundling run dir + `.agent/tools`; remaining: curated file selection + summary)
- [x] (2026-01-24) (project access control) Restrict AgentFS read/download/compare to runs belonging to the same project (when projectId is known).
- [x] (2026-01-24) (file classification) Add sensitivity classification for files and enforce stricter preview/download rules for “sensitive” outputs. (MVP: previews blocked; downloads require explicit confirm)
- [x] (2026-01-24) (retention tiers) Implement retention tiers + pin UI (writes `.keep`) + auto-pin on failures. (MVP: `.retention` per-run override + UI setter)
- [x] (2026-01-24) (integrity) Add DB integrity verification and quarantine flows for corrupted runs.
- [x] (2026-01-24) (compaction) Add optional background compaction (sqlite optimize/vacuum) for old runs.
- [x] (2026-01-24) (content-addressed archive) Add optional content-addressed archival storage (dedupe) for exported runs and/or packed DBs.
- [x] (2026-01-24) Run validators (targeted tests + typecheck) for Milestone 1.
- [x] (2026-01-24) Run validators (agentfs router tests + typecheck) for Milestone 6.
- [x] (2026-01-24) Run validators (scheduler + route tests + typecheck) for Milestones 7–8 + CAS.

## Surprises & Discoveries

- Observation: `apps/web` TypeScript build (`tsc -b`) can exceed 180s in a cold run.
  Evidence: `bun run typecheck` in `apps/web` required a 420s timeout in this session.

- Observation: `apps/web` typecheck transitively typechecks some workspace references (e.g. `@alfred/db`), so unrelated unused-import errors can break web builds.
  Evidence: fixed unused imports in `packages/db/src/repo/review.ts` to unblock `apps/web` typecheck.

- Observation: deterministic `.tar.gz` requires `gzip -n` (or equivalent) because default gzip headers include timestamps.
  Evidence: CAS archives are produced via `tar -cf` + `gzip -n`, with a fallback to `tar -czf` when gzip is unavailable.

- Observation: TanStack Start server routes can be unit-tested by importing the file-route `Route` and calling `Route.options.server.handlers.*` with a synthetic `Request`.
  Evidence: `apps/web/src/tests/routes/agentfs.route.test.ts` exercises export/store, sha download auth, and restore.

## Decision Log

- Decision: Treat some proposals as “best-effort attribution” (especially blame and live streaming) because AgentFS does not natively join file writes to tool calls.
  Rationale: A heuristic mapping (mtime within tool-call window) provides high utility without changing AgentFS’s underlying schema.
  Date/Author: 2026-01-23 / Droid

- Decision: Add content-addressed storage for exports/archives first, and only later consider “packing” live AgentFS DBs.
  Rationale: The agentfs SDK owns the live schema; dedupe at the archive layer avoids upstream fork pressure while still reducing disk.
  Date/Author: 2026-01-23 / Droid

- Decision: Store per-run retention overrides as a single `.agentfs/<runId>/.retention` file containing integer days.
  Rationale: Keeps cleanup logic filesystem-only and avoids DB migrations; supports simple UI edits.
  Date/Author: 2026-01-24 / Droid

- Decision: Implement initial file sensitivity as a hybrid (path heuristics + bounded prefix scan) cached in AgentFS KV under `classify:<path>`; block previews and require explicit confirm for downloads.
  Rationale: Provides practical safety without deep content inspection; keeps classification reversible and fast.
  Date/Author: 2026-01-24 / Droid

- Decision: Quarantine corrupt runs by moving `.agentfs/<runId>` to `.agentfs/quarantine/<runId>-<timestamp>` and writing `quarantine.json` metadata.
  Rationale: Reversible, preserves evidence for debugging, and prevents cleanup from deleting bad state.
  Date/Author: 2026-01-24 / Droid

- Decision: Implement CAS archives as `.agentfs/cas/<sha256>.tar.gz` produced via `tar -cf` followed by `gzip -n`.
  Rationale: `gzip -n` avoids timestamped headers so identical payloads remain content-addressable.
  Date/Author: 2026-01-24 / Droid

- Decision: Persist project scope for runs via `.agentfs/<runId>/.project` and enforce project-scoped reads/downloads/restores whenever a projectId is known.
  Rationale: Keeps access control filesystem-local and avoids schema migrations; provides a stable hint for filtering and CAS enforcement.
  Date/Author: 2026-01-24 / Droid

- Decision: Enforce CAS downloads/restores by matching `metadata.projectId` to the request `projectId` (403 on missing/mismatch when metadata is scoped).
  Rationale: Prevents cross-project replay of deduped archives while keeping sharing possible when `projectId` is unknown/null.
  Date/Author: 2026-01-24 / Droid

- Decision: Add age-based CAS retention cleanup with `.keep` pins and `ALFRED_AGENTFS_CAS_RETENTION_DAYS` (default 30).
  Rationale: Dedupe reduces storage but CAS can still grow unbounded; age-based cleanup is simple and safe.
  Date/Author: 2026-01-24 / Droid

- Decision: Instrument integrity and compaction schedulers with Prometheus counters/histograms.
  Rationale: These jobs run in the background; metrics provide operational visibility without log-scraping.
  Date/Author: 2026-01-24 / Droid

## Outcomes & Retrospective

- Shipped project-scoped AgentFS access for exports and CAS downloads/restores using `.project` hints.
- Shipped deterministic CAS archives + metadata, with gzip fallback for portability.
- Shipped CAS retention cleanup (age-based, `.keep` pins) and scheduler metrics for integrity/compaction.
- Added unit coverage for CAS export/download/restore and CAS cleanup.

## Context and Orientation

AgentFS is ALFRED’s SQLite-backed virtual filesystem and audit trail for agent execution. Each run produces a database at `.agentfs/<runId>/agentfs.db` and a tool-artifact trail at `.agent/tools/<category>/...`.

Core current surfaces (assumed implemented already):

- `packages/agent/src/environment/agentfs.ts`: creates the AgentFS workspace and Docker container; supports base-run DB cloning.
- `packages/api/src/routers/agentfs.ts`: AgentFS tRPC router (diff, snapshot/stream, fileContent).
- `apps/web/src/components/apps/agentfs/*`: AgentFS Viewer UI (diff list + preview).
- `apps/web/src/routes/api/agentfs/download.ts`: authenticated download endpoint.
- `packages/api/src/scheduler/agentfs.ts` + `apps/web/src/server/bootstrap.ts`: retention cleanup scheduler.

Important constraints and conventions:

- Security: all AgentFS file access must validate `dbPath` and normalize/validate `filePath`, and enforce policy via `@alfred/policy`.
- Server/client split: web client code must not import server-only packages at module scope.
- TanStack Router: after adding a new server route under `apps/web/src/routes/**`, regenerate the route tree:
  - In `apps/web/`, run `bunx @tanstack/router-cli generate`.

## Feature Map (the 20 proposals, explicitly covered)

This plan implements all of the following, grouped by milestone below:

1. Unified run explorer
2. Path-level audit timeline
3. Diff across runs
4. Per-file blame
5. Content-addressed storage option
6. Server-side safe preview rendering
7. Archive/export run
8. Selective restore
9. Snapshot browser
10. KV diff viewer
11. Access control by project
12. Retention tiers
13. Large file streaming preview
14. Binary inspector
15. Artifact index + viewer
16. Run hand-off pack
17. Corruption detection + repair/quarantine
18. Background compaction
19. Event streaming for file changes
20. Policy-visible file classifications

## Plan of Work

Implement these features in milestones that are independently shippable and testable. Each milestone must include:

1. API surface (tRPC procedure and/or server route).
2. Policy and input validation.
3. UI/UX integration in the AgentFS Viewer.
4. Unit tests at the router/service layer.
5. Updates to this ExecPlan’s `Progress` and `Decision Log`.

### Milestone 1: Run explorer + run stats (proposal 1)

At the end of this milestone, a user can open the AgentFS Viewer, search/filter runs, and click into a run to see a summary (files changed, total bytes, tool call count, last modified). This does not require reading the AgentFS DB unless a run is selected.

Implementation outline:

- Add a service module `packages/api/src/services/agentfs.ts` that exposes pure query helpers (no auth):
  - `listRuns({ userId, projectId? })` that prefers DB-backed workflow run records when Postgres is available (use `@alfred/db/repo/workflow`), and otherwise scans `.agentfs/*/agentfs.db` on disk.
  - `getRunStats({ dbPath })` that computes counts via bounded SQLite queries (file count, total bytes) and tool calls count.

- Add router endpoints in `packages/api/src/routers/agentfs.ts`:
  - `agentfs.runs`: returns a list of run summaries.
  - `agentfs.runStats`: returns stats for a run.

- Add UI in `apps/web/src/components/apps/agentfs/`:
  - A “Runs” tab with search input and filters (e.g. “Pinned”, “Has artifacts”, “Failed runs”).
  - Clicking a run loads stats and navigates the viewer to that run’s existing diff/file preview experience.

Acceptance:

- With the server running, Runs tab lists at least the most recent N runs and supports search by runId substring.
- Selecting a run shows a stats panel with non-zero numbers for runs that wrote files.

### Milestone 2: Path audit timeline + blame (proposals 2 and 4)

At the end of this milestone, for any path that exists in a run, the UI can show:

- A timeline of changes for that path (created/modified/deleted events).
- A best-effort attribution (“likely caused by tool call X”) by correlating file `mtime` to tool call windows.

Implementation outline:

- Extend `packages/api/src/services/agentfs.ts` with:
  - `getFileHistory({ dbPath, filePath })`: query SQLite for historical metadata where available. If AgentFS schema does not record per-path history, implement “history” as a sequence across snapshots/checkpoints when present (fallback: show only the current state and note that history is unavailable).
  - `blameFile({ dbPath, filePath })`: compute `mtime`, then find tool call(s) where `started_at <= mtime <= completed_at` (or closest window), return a ranked list with confidence.

- Add router endpoints:
  - `agentfs.fileHistory`
  - `agentfs.fileBlame`

- UI additions:
  - In the file preview panel, add a “History” and “Blame” section.

Acceptance:

- For a file modified during a tool call, “Blame” shows that tool as the top candidate.

### Milestone 3: Compare runs (file diff + KV diff) (proposals 3 and 10)

At the end of this milestone, the UI can compare two runs and show:

- A file-level diff summary (created/modified/deleted).
- A KV diff summary.

Implementation outline:

- Add API endpoints:
  - `agentfs.compareRuns`: input `{ leftDbPath, rightDbPath }` plus runIds for display.

- File compare strategy:
  - For each run, build a map `path -> { size, mtime }` from `fs_dentry/fs_inode`.
  - Determine created/deleted/common and mark “modified” when size differs or when (optional) a small hash differs.

- KV compare strategy:
  - Load kv entries for both runs and produce added/removed/changed keys.

- UI:
  - Add a “Compare” action in Runs list; show side-by-side summary and allow clicking into a file to preview left vs right.

Acceptance:

- Comparing a run to its `agentfsBaseRunId` shows expected deltas.

### Milestone 4: Safe preview upgrades + binary inspector + streaming preview (proposals 6, 13, 14)

At the end of this milestone:

- Text previews support bounded syntax highlighting and a max-line render mode (no UI lockups).
- Binary files show an inspector view (mime guess, size, hash, and small bounded hex/strings preview).
- Large text files can be paged (first N bytes, next N bytes) without requesting the full file.

Implementation outline:

- Add `agentfs.filePreviewChunk` endpoint: `{ dbPath, filePath, offset, limitBytes }` returning `content` plus `{ isBinary, truncated }`.
- Update the existing preview UI to request chunks and append on demand.
- Add a “Binary” rendering mode when `isBinary` is true.

Acceptance:

- Previewing a multi-megabyte log file does not fetch > preview cap and can page.
- Previewing a PNG shows binary inspector and download link.

### Milestone 5: Live file change streaming (proposal 19)

At the end of this milestone, when a run is active, the UI updates the file list automatically as the agent writes files.

Implementation outline:

- Add a subscription in `packages/api/src/routers/agentfs.ts` (or a server route) that:
  - Polls the AgentFS DB for changes since a cursor (monotonic timestamp or inode seq when available).
  - Emits small deltas (path + changeType + size + mtime).

- UI:
  - When viewing an active run, subscribe and merge deltas into the list.

Acceptance:

- While an agent run is writing, the list updates within a few seconds without a full refresh.

### Milestone 6: Export/archive + restore workflows (proposals 7, 8, 9, 16)

At the end of this milestone, a user can:

- Export a run into a portable archive.
- Restore an archive into a new run.
- Restore from a checkpoint/snapshot into a new run.
- Generate a “handoff pack” (subset of files + selected artifacts + summary) and create a new run based on it.

Implementation outline:

- Export:
  - Add `GET /api/agentfs/export?runId=...` that streams an archive containing: `agentfs.db`, selected metadata JSON, and optionally `.agent/tools/**` files referenced by the run.

- Restore-to-new-run:
  - Add `POST /api/agentfs/restore` that accepts an archive upload (or references an already-uploaded artifact), creates a new run, and seeds its `.agentfs/<newRunId>/agentfs.db`.
  - Reuse the existing base-run DB clone mechanism to avoid ad-hoc write paths.

- Checkpoint browser:
  - Extend the UI to list checkpoints (with labels) and provide “restore to new run” actions.

- Handoff pack:
  - Implement a builder that collects:
    - chosen files from AgentFS
    - newest artifact summaries in `.agent/tools/**`
    - a short human-readable summary
  - Store it as a durable artifact, and allow creating a new run seeded from it.

Acceptance:

- Exporting a run produces an archive that can be restored into a new run whose diff matches the original.

### Milestone 7: Project access control + file classification + retention tiers (proposals 11, 12, 20)

At the end of this milestone:

- Access to AgentFS read/compare/download is constrained to runs within the same project when `projectId` exists.
- Files are classified as “normal” vs “sensitive” (and possibly other categories) and stricter rules are enforced.
- Users can pin runs in the UI (creates `.keep`), and failures auto-pin.

Implementation outline:

- Add new policy resource kinds:
  - `agentfs_run` (id: `runId`)
  - `agentfs_file` (id: `runId:filePath`)

- When run metadata exists in Postgres, treat `projectId` as part of policy context and enforce “same project” for non-admin reads.

- File classification:
  - Add a classifier in `packages/api/src/services/agentfs.ts` that scans only a bounded prefix of file bytes.
  - Mark classification results in AgentFS kv (e.g. `classify:<path>`).
  - Enforce: sensitive files cannot be previewed, and download requires elevated authz (or explicit confirm).

- Retention tiers:
  - Add UI actions “Pin run” and “Unpin run” that create/remove `.agentfs/<runId>/.keep`.
  - Extend cleanup scheduler to support optional tier markers (e.g. `.retention` file with days) with safe defaults.

Acceptance:

- A run pinned via UI is not deleted by cleanup.
- A sensitive file cannot be previewed.

### Milestone 8: Integrity checks + compaction + content-addressed archive (proposals 17, 18, 5)

At the end of this milestone:

- Old runs are periodically verified for sqlite integrity; corrupt DBs are quarantined.
- Optional compaction reduces disk footprint for old DBs.
- Exports can be stored content-addressed to dedupe identical payloads.

Implementation outline:

- Integrity:
  - Add a background scheduler (gated behind an env flag) that runs `PRAGMA integrity_check` on candidate DBs.
  - If corrupt: move the run directory to a quarantine location (never delete immediately) and show UI diagnostics.

- Compaction:
  - For DBs older than a threshold, run `PRAGMA optimize` and optional `VACUUM` (guarded by a tight deletion/lock policy to avoid interfering with active runs).

- Content-addressed archive:
  - When exporting, compute sha256 of the archive stream and store it under `.agentfs/cas/<sha256>` plus a small manifest mapping runId->sha.
  - Provide a download route by sha, and allow restore by sha.

Acceptance:

- A deliberately corrupted DB is detected and quarantined.
- Exporting two identical runs stores only one CAS object.

## Concrete Steps

For each milestone:

1. Implement API/service changes.
2. Add/extend UI.
3. Add/extend tests.
4. Regenerate TanStack Router tree when adding routes:
   - `cd apps/web && bunx @tanstack/router-cli generate`

5. Run validators:
   - `bun scripts/test-bun.ts --timeout 60000 <relevant test files>`
   - `bun run typecheck:workspace --filter=@alfred/api --filter=@alfred/agent --filter=@alfred/runtime --filter=web`

## Validation and Acceptance

This effort is accepted when all milestones above are implemented and verifiable via:

- Web UI: Runs tab, Compare view, History/Blame sections, streaming updates, Export/Restore flows.
- Security: missing scope and policy violations are enforced for all new endpoints.
- Tests: router/service unit tests cover normal behavior and policy failures.
- Typecheck: `bun run typecheck:workspace` passes for affected packages/apps.

## Idempotence and Recovery

- Any background job that deletes or moves run directories must be gated behind an env flag and must be safe to run repeatedly.
- “Quarantine” must be reversible (move-only) so a mistaken classification does not destroy data.
- Export/restore flows must be resumable (streaming responses, bounded memory).

## Interfaces and Dependencies

- AgentFS DB reads: use `bun:sqlite` with bounded queries; never load large blobs unless requested by a chunked endpoint.
- Auth/session: reuse Better Auth session retrieval in Start server routes.
- Policy: enforce with `@alfred/policy` `evaluate()` and keep resource shapes consistent with existing `agentfs_file` usage.
- Router: extend `packages/api/src/routers/agentfs.ts` and keep heavy logic in `packages/api/src/services/agentfs.ts`.
