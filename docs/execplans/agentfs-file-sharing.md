# agentfs file management and sharing

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

After this work, a user can open the AgentFS Viewer, click a file changed in an agent run, preview its contents (when safe), and download the exact bytes produced by that run. Tool outputs produced during agent execution will also be persisted as durable artifacts under `.agent/tools/…`, enabling context handoff between runs. Historical AgentFS runs will be retained for a bounded period (with a clear retention policy) and optionally share context through an overlay “base” so new runs can build on previous run state without mutating the host repository.

## Progress

- [x] (2026-01-23) Create `docs/execplans/agentfs-file-sharing.md` and align with `.agent/PLANS.md` formatting and section requirements.
- [x] (2026-01-23) Implement Phase 1 (UI file preview): API `agentfs.fileContent` + UI integration in `apps/web/src/components/apps/agentfs/`.
- [x] (2026-01-23) Implement Phase 2 (download): HTTP route under `apps/web/src/routes/api/agentfs/` that streams a file out of the AgentFS DB.
- [x] (2026-01-23) Implement cross-cutting security hardening for AgentFS file access (policy audit, strict path normalization, payload limits).
- [x] (2026-01-23) Implement Phase 3 (artifact persistence): create `packages/agent/src/artifact/persist.ts` and integrate with Codex/OpenCode/Droid execution paths.
- [x] (2026-01-23) Implement Phase 4 (retention): scheduler in `packages/api/src/scheduler/` + server bootstrap wiring + env documentation in `config/env.example`.
- [x] (2026-01-23) Implement Phase 5 (overlay sharing): “base run” semantics and a safe materialization strategy.
- [x] (2026-01-23) Run validators (typecheck + relevant tests) for implemented phases.

## Surprises & Discoveries

- Observation: `agentfs-sdk` supports `Filesystem.readFile(path, options?)` returning `Buffer | string`, but ALFRED’s `AgentFSInterface` and wrapper currently type `readFile()` as `Promise<string>`.
  Evidence: `node_modules/agentfs-sdk/dist/filesystem.d.ts` shows `readFile(...): Promise<Buffer | string>`.

- Observation: The installed `agentfs-sdk` does not support the planned `base` option (only `{ id, path }`), so “overlay base directory” semantics are not currently available through the SDK.
  Evidence: `node_modules/agentfs-sdk/dist/agentfs.d.ts` defines `AgentFSOptions` as `{ id?: string; path?: string }`.

- Observation: Path shapes in AgentFS are not guaranteed to be under `/workspace` from the host API’s perspective.
  Implication: File path validation must be “absolute + no `..`”, not “must start with `/workspace`”.

- Observation: Adding a new TanStack Start server route requires updating `apps/web/src/routeTree.gen.ts` so `createFileRoute()` accepts the new path.
  Implication: If the route tree isn’t regenerated, `tsc` fails with `FileRoutesByPath` type errors.

## Decision Log

- Decision: Return file previews as UTF-8 text only, with a size cap, and require explicit download for binary or oversized content.
  Rationale: The UI must be safe and fast; large/binary payloads are better handled by a streaming download endpoint.
  Date/Author: 2026-01-23 / Droid

- Decision: Treat artifact persistence (`.agent/tools/...`) as a boundary concern in `@alfred/agent` (tool execution) rather than in `@alfred/api` or UI.
  Rationale: Artifacts are produced at tool execution time, and must exist even if the web UI is not running.
  Date/Author: 2026-01-23 / Droid

- Decision: Implement `agentfs.fileContent` by reading file bytes directly from the AgentFS SQLite tables (`fs_dentry`, `fs_inode`, `fs_data`) instead of relying on SDK overlay behavior.
  Rationale: Keeps previews bounded and avoids future base-directory fallback reads if the SDK adds overlay support.
  Date/Author: 2026-01-23 / Droid

- Decision: Implement Phase 5 “base runs” by copying the base run’s `.agentfs/<runId>/agentfs.db` into the new run’s DB before first open, surfaced via `RuntimeInput.agentfsBaseRunId`.
  Rationale: The current `agentfs-sdk` does not support a `base` option, but a DB clone provides a practical run-to-run context sharing mechanism with clear security boundaries.
  Date/Author: 2026-01-23 / Droid

## Outcomes & Retrospective

- (empty; fill in as milestones land)

## Context and Orientation

AgentFS is ALFRED’s SQLite-backed virtual filesystem and audit trail for agent execution. Every run persists a database file (by default `.agentfs/<runId>/agentfs.db`) that stores file contents and a tool call timeline.

Key terms used in this plan:

“runId” is the orchestration run identifier. It is used to locate a persisted AgentFS database under `.agentfs/<runId>/…`.

“dbPath” is a repository-relative path to the AgentFS database file. The API validates it with `isSafeAgentfsDbPath()` in `packages/api/src/routers/agentfs.ts`.

“overlay mode” in agentfs-sdk means a database provides a copy-on-write overlay on top of a “base directory” (a real directory on disk). ALFRED stores the host base directory path in the AgentFS KV store under key `baseDir` in `packages/agent/src/environment/agentfs.ts` and re-opens AgentFS with that base in `packages/api/src/routers/agentfs.ts`.

“artifact” means a durable file under `.agent/tools/{category}/…` used as the handoff mechanism between agent iterations. ALFRED documents this in `docs/definitions/artifact.md` and `docs/definitions/handoff.md`, but the persistence wrapper is not currently implemented.

Relevant code locations:

- AgentFS workspace lifecycle (Docker + DB path + KV baseDir): `packages/agent/src/environment/agentfs.ts`.
- AgentFS wrapper around `agentfs-sdk` (metrics/logging): `packages/agent/src/agentfs/wrapper.ts`.
- Existing AgentFS API router (snapshot/diff/timeline/applyChanges/stream): `packages/api/src/routers/agentfs.ts`.
- AgentFS Viewer UI: `apps/web/src/components/apps/agentfs/` (`index.tsx`, `file-audit.tsx`, `call-timeline.tsx`, `checkpoint-browser.tsx`, `kv-viewer.tsx`).
- Existing scheduler pattern and gating: `packages/api/src/scheduler/remind.ts`, server bootstrap: `apps/web/src/server/bootstrap.ts`.

## Plan of Work

This effort is split into five phases. Security hardening is cross-cutting and must be implemented alongside (or immediately after) Phase 1 and Phase 2 so we do not accidentally expose arbitrary file reads via AgentFS.

### Phase 1: View file content in the AgentFS Viewer

Goal: In the AgentFS Viewer “Files” tab, clicking a file shows a preview panel of the current content from that AgentFS run.

Work:

1. Add a new tRPC query procedure `agentfs.fileContent` in `packages/api/src/routers/agentfs.ts`.

   The input must include `runId`, `dbPath`, and `filePath`.

   The implementation must:
   - Validate `{ runId, dbPath }` using the existing `isSafeAgentfsDbPath()` helper.
   - Validate `filePath` as a normalized posix path:
     - must start with `/`.
     - must not contain `..` segments.
     - must be under `/workspace` (default), unless explicitly widened later.
   - Open the DB via the existing `loadAgentfs()` helper.
   - Read content using the underlying SDK’s capability to return bytes:
     - Update `packages/agent/src/agentfs/types.ts` so `AgentFSInterface.fs.readFile` returns `Promise<string | Buffer>`.
     - Update `packages/agent/src/agentfs/wrapper.ts` `fs.readFile` to preserve that return type (do not coerce to string).
   - Enforce a preview size cap (default 1 MiB) to prevent UI lockups. Suggested env var: `ALFRED_AGENTFS_PREVIEW_MAX_BYTES`.
   - Return a shape suitable for UI rendering:
     - `encoding`: `"utf8" | "base64"`.
     - `content`: UTF-8 string (for text) or base64 string (for binary/unknown).
     - `isBinary`: boolean.
     - `sizeBytes`: number.
     - `truncated`: boolean.

2. Update `apps/web/src/components/apps/agentfs/file-audit.tsx` to support selecting a file row and fetching `agentfs.fileContent` for preview.

   The UI change should be minimal:
   - Keep the existing summary list.
   - Add a split view: left list, right preview.
   - On row click, set selected `filePath` and run the query.
   - Render text previews in a scrollable monospace area.
   - For `isBinary === true` or `truncated === true`, show a clear message and a “Download” button (wired in Phase 2).

Acceptance:

From the desktop UI, open AgentFS Viewer, select a workspace, open “Files”, click a changed file, and see a preview without applying any changes to the host repo.

### Phase 2: Download files from an AgentFS run

Goal: A user can download the exact bytes for a given `filePath` from a given AgentFS run.

Work:

1. Add an HTTP endpoint under TanStack Start routes at `apps/web/src/routes/api/agentfs/download.ts` (route `/api/agentfs/download`).

   The handler must:
   - Require a valid session (use the same session check pattern as `apps/web/src/routes/api/conversation/$.ts` via `@alfred/auth` `auth.api.getSession`).
   - Parse query parameters: `runId`, `dbPath`, `filePath`.
   - Reuse the same validation rules as Phase 1 (`isSafeAgentfsDbPath`, strict `filePath` normalization).
   - Open AgentFS using `@alfred/agent/agentfs/index` and read using `fs.readFile` with no encoding (bytes).
   - Stream the response (or return a single `Response` body) with:
     - `Content-Type: application/octet-stream`.
     - `Content-Disposition: attachment; filename="<basename>"`.
     - `Cache-Control: no-store`.

2. In `apps/web/src/components/apps/agentfs/file-audit.tsx`, wire the “Download” button to open `/api/agentfs/download?...` in a new navigation (or use `fetch` + `blob` if preferred by existing patterns).

Acceptance:

Clicking “Download” yields a file whose contents match the AgentFS DB value (not the host file) even if the host file differs.

### Cross-cutting: Security hardening (required)

Goal: Ensure that “AgentFS file content” and “download” endpoints cannot be used to read arbitrary host files, bypass scopes/policy, or overload the server.

Work:

1. Add policy checks (in addition to scope checks):
   - In `packages/api/src/routers/agentfs.ts`, new file-content procedures should use `requirePolicy(...)` similarly to `packages/api/src/routers/fs.ts`, mapping the policy resource to the _virtual_ file path (e.g. `{ kind: "file", id: filePath }`).
   - In `apps/web` download route handlers, require a session and (if feasible) perform a policy evaluation using the same policy engine used by tRPC (do not duplicate policy logic in UI code).

2. Enforce strict normalization for `runId`, `dbPath`, and `filePath`:
   - Keep using `isSafeAgentfsDbPath()` as the primary guard.
   - Add a dedicated helper in `packages/api/src/routers/agentfs.ts` for `filePath` validation (posix normalization, `..` rejection, and `/workspace` prefix restriction).

3. Enforce payload limits and safe response headers:
   - Preview responses must cap bytes and return `Cache-Control: no-store`.
   - Download responses must set `Content-Disposition` safely (filename should be a sanitized basename only) and must not reflect unsanitized paths into headers.

Acceptance:

Attempts to pass `filePath=/etc/passwd` (or containing `..`) must fail with `BAD_REQUEST`, and the download endpoint must return `401` when no session is present.

### Phase 3: Persist tool artifacts under `.agent/tools/…`

Goal: Tool runs persist human- and agent-readable outputs to a stable directory structure so later agent runs can read them as handoff context.

Work:

1. Create a new module `packages/agent/src/artifact/persist.ts` that exports a small boundary API, for example:
   - `persistArtifact(args: { repoRoot: string; category: string; tool: string; format: "json" | "md" | "txt" | "log"; content: string | Uint8Array; filename?: string; }): Promise<{ path: string }>`

   The implementation must:
   - Write under `<repoRoot>/.agent/tools/<category>/`.
   - Create directories as needed.
   - Write atomically (write temp + rename) to avoid partial files on crash.
   - Never follow symlinks when creating/writing (reuse the security helpers pattern in `packages/api/src/fs/security.ts`, but keep this implementation local to `@alfred/agent`).
   - Return the final relative path (for storing in run outcomes and/or AgentFS KV if needed).

2. Integrate artifact persistence into tool execution paths:
   - Codex: `packages/agent/src/orchestrator/tool/codex/exec.ts` already collects `artifacts: CodexArtifactSummary[]`. Extend the code path after successful completion to persist:
     - a “last run result” artifact (e.g. `.agent/tools/codex/result.md` or `.json`) containing `{ sessionId, threadId, resultText, artifacts, metadata }`.
   - OpenCode: `packages/agent/src/orchestrator/tool/opencode/exec.ts` (and related output structures) should persist the same style of summary.
   - Droid: whichever orchestrator tool returns file-like artifacts should persist a summary.

3. (Optional, but recommended for discoverability) Add a single artifact describing available tools (CATALOG) only if there is already a canonical place generating it. Do not introduce import-time work; do it during workspace initialization or first tool execution.

Acceptance:

After running any agent tool, `.agent/tools/` exists and contains a durable summary artifact for that tool. Deleting the web UI state does not remove these artifacts.

### Phase 4: Retention policy for historical AgentFS runs

Goal: `.agentfs/<runId>/…` directories are retained for a bounded time and cleaned up automatically, with a safe opt-out for pinned runs.

Work:

1. Add a new scheduler module `packages/api/src/scheduler/agentfs-cleanup.ts` following the pattern in `packages/api/src/scheduler/remind.ts`:
   - Must be gated behind `SCHED_AGENTFS_CLEANUP=1`.
   - Must `.unref()` timers.
   - Must guard against overlapping runs (`running` flag).
   - Must use a safe default retention window (72 hours) controlled by `AGENTFS_RETENTION_HOURS`.

2. The cleanup logic should:
   - Enumerate `.agentfs/` subdirectories.
   - For each `<runId>` dir, find `agentfs.db` and use its mtime as last activity.
   - Skip deletion if a pin marker exists, for example a file `.agentfs/<runId>/.keep`.
   - Delete directories older than retention (recursive delete) and log what was deleted.

3. Wire the scheduler in `apps/web/src/server/bootstrap.ts` similarly to other schedulers, using a server-only env getter function. Add a new getter in `apps/web/src/lib/env/server-only.ts`.

4. Update `config/env.example` to include `SCHED_AGENTFS_CLEANUP`, `AGENTFS_RETENTION_HOURS`, and `ALFRED_AGENTFS_PREVIEW_MAX_BYTES` with brief descriptions.

Acceptance:

With `SCHED_AGENTFS_CLEANUP=1` and a low `AGENTFS_RETENTION_HOURS`, an old `.agentfs/<runId>/` directory is deleted automatically, while a directory containing `.keep` is preserved.

### Phase 5: Overlay sharing between runs (base runs)

Goal: A new run can be created “based on” a previous run’s virtual filesystem state without applying changes to the host repo.

Constraints:

The agentfs-sdk “base” is a real directory, not another AgentFS DB. Therefore, “base run” sharing requires materializing a previous run’s filesystem state into a directory, then using that directory as the base for the next run.

Work:

1. Define a materialization strategy:
   - Create a directory `.agentfs/<runId>/materialized/`.
   - Copy the host base as the starting point is not acceptable (too expensive). Instead, create only the changed files for a run under that materialized directory, plus a manifest describing “fall through to host baseDir for anything else”.
   - If agentfs-sdk requires a fully materialized base directory, then this phase must explicitly accept the cost (and gate it behind a user-driven action).

2. Add an API procedure `agentfs.materialize` (write-scoped) that:
   - Computes `fsdb.diff()`.
   - Writes changed files into `.agentfs/<runId>/materialized/<relativePath>` using `fs.readFile` bytes.
   - Writes a metadata file `.agentfs/<runId>/materialized.json` with `baseDir`, `runId`, `createdAt`, and a file list.

3. Update `WorkspaceFactory` / `AgentFSWorkspace` creation path to accept an optional `baseDirOverride` or `baseMaterializedDir` and store it in KV `baseDir` so both container and UI readers reopen with consistent overlay semantics.

Acceptance:

Given run A with changes, materialize it, then start run B with base = run A materialized directory. Files created/modified in run A appear as the starting view in run B without mutating the host repo.

## Concrete Steps

These steps are written for a contributor implementing this plan.

1. Implement Phase 1 (API + UI), then run:
   - From repo root:
     - `bunx biome check --write packages/api/src/routers/agentfs.ts apps/web/src/components/apps/agentfs/file-audit.tsx`
     - `bun scripts/test-bun.ts --timeout 60000 packages/api/test/agentfs.router.test.ts`
     - (if you changed `@alfred/agent` types) `bun scripts/test-bun.ts --timeout 60000 packages/agent/test/agentfs-workspace.test.ts`

2. Implement Phase 2 (download route), then validate by opening the UI and clicking “Download”. Also add a focused route test under `apps/web/src/routes/api/__tests__/` if this repo’s patterns support it.

3. Implement Phase 3 (artifact persistence), then validate by running a tool and checking `.agent/tools/…` is written.

4. Implement Phase 4 (scheduler), then validate by setting `SCHED_AGENTFS_CLEANUP=1` and a low retention and observing deletion of old directories.

5. Implement Phase 5 (overlay sharing) only after Phase 1-4 are stable.

## Validation and Acceptance

Phase 1:

In the desktop UI AgentFS Viewer, selecting a file shows its content preview. Preview does not hang for large files (it truncates) and does not attempt to render binary content as text.

Phase 2:

Downloading a file yields a byte-identical payload to the content stored in the AgentFS DB for that run.

Phase 3:

After a tool run completes, `.agent/tools/<category>/...` contains an updated artifact summarizing the result in the configured format.

Phase 4:

With cleanup enabled, stale runs are deleted automatically and pinned runs are preserved.

Phase 5:

A new run started with a prior run base sees the base run’s changed files without applying changes to the host repo.

## Idempotence and Recovery

All API procedures in this plan must be safe to call repeatedly:

- `fileContent` and download are read-only.
- Artifact persistence should overwrite “latest” artifact files atomically.
- Cleanup must be conservative: default to not deleting anything unless retention is exceeded and no pin marker exists.
- Materialization should be safe to rerun by clearing and rebuilding the materialized directory for a run.

## Artifacts and Notes

Key evidence files to capture during implementation:

- A short UI screenshot or log proving `agentfs.fileContent` returns truncated previews for large files.
- A hash comparison (e.g. SHA-256) proving download payload matches the AgentFS DB content.
- A directory listing proving `.agent/tools/…` was created and updated.

## Interfaces and Dependencies

- Use `agentfs-sdk` via the existing lazy loader in `packages/agent/src/agentfs/wrapper.ts`.
- Keep security boundaries at the API layer (`packages/api`) and tool execution layer (`packages/agent`). Do not import `apps/web` into packages.
- Prefer existing scheduler patterns (gated env vars, `.unref()` timers) and existing auth patterns (`@alfred/auth` session checks in route handlers).
