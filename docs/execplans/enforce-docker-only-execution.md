# Enforce Docker-Only Agent Execution

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. This document must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Today, ALFRED's agent executors (Codex, OpenCode, Droid) can run on the host filesystem. This violates the mandated architecture: all agent execution must happen inside Docker containers with AgentFS providing the audit trail. The host path exists because `containerName` is optional in tool schemas, `process.cwd()` fallbacks are scattered through executor code, and `persistArtifact` writes directly to the host. The result: runtime state files (`.agent/tools/codex/codex.json`) pollute the repository, temp files leak (`.opencode.json.tmp-*`), and no audit trail exists for executions that bypass Docker.

After this work, there is exactly one execution path: Docker + AgentFS. No fallback. No optional container. No host spawn. Every agent invocation creates or reuses a Docker container, every file operation goes through AgentFS, and every artifact persists inside the container volume. Tests that exercised the host path are rewritten to use Docker mocks or the real AgentFS workspace. The `persistArtifact` function and all its call sites are deleted.

Scope boundary: this plan covers **executor tools** (Codex, OpenCode, Droid) and their direct callers. Non-executor orchestrator tools (`git.ts`, `browser.ts`, `docker.ts`, `context.ts`) use `process.cwd()` and `openDirectorySecure` legitimately — they are infrastructure tools that operate on the host, not agent execution environments. They are explicitly out of scope.

To verify: run `rg 'process\.cwd\(\)' packages/agent/src/orchestrator/tool/` and get zero matches in executor files. Run `bun test packages/agent packages/runtime packages/api` and all tests pass. Attempt to invoke `toolCodex.execute` without a `containerName` and get a Zod validation error.

## Progress

- [x] Milestone 1: Make `containerName` required at the schema boundary
- [x] Milestone 2: Route direct API callers through Docker
- [x] Milestone 3: Remove host spawn paths from Codex executor
- [x] Milestone 4: Remove host spawn paths from OpenCode executor
- [x] Milestone 5: Remove host spawn path from Droid executor
- [x] Milestone 6: Delete `persistArtifact` and all call sites
- [x] Milestone 7: Remove `process.cwd()` fallbacks from all executor code
- [ ] Milestone 8: Fix tests
- [ ] Milestone 9: Clean up handoff route and dead code
- [ ] Milestone 10: Validation sweep

## Surprises & Discoveries

- Typecheck surfaced additional containerName omissions in runtime/flow/test-kit call sites beyond the five listed direct callers.
- `persistArtifact` had already been removed from the Codex executor during Milestone 3, so only OpenCode + Droid still referenced it in Milestone 6.

## Decision Log

- Decision: Delete `persistArtifact` entirely. Do not replace it with anything.
  Rationale: `persistArtifact` writes fire-and-forget debugging JSON to `.agent/tools/` on the host. Every call site wraps it in `void ... .catch()`. The executor result is already returned to the caller, logged by the pipeline observer, and persisted in `workflow_runs.stateData`. Writing it a second time is redundant. Deleting the call sites is simpler, safer, and eliminates the host write path without introducing a new one.
  Date: 2026-02-08

- Decision: Make `containerName` required (non-optional) in Zod schemas, not just validated at runtime.
  Rationale: Runtime checks ("throw if missing") leave the type system lying — callers still see `containerName?` and can omit it. Making it required in the schema means TypeScript enforces it at compile time and Zod rejects it at parse time. No ambiguity.
  Date: 2026-02-08

- Decision: Droid executor gets containerized using the same pattern as Codex/OpenCode.
  Rationale: Droid currently has zero container support — it always spawns on host. It must be brought to parity. The same `docker exec` pattern used by Codex server mode applies.
  Date: 2026-02-08

- Decision: Non-executor tools (git, browser, docker, context) are out of scope.
  Rationale: These tools operate on the host legitimately as infrastructure (running git commands, launching browsers, managing Docker containers). They are not agent execution environments and do not need containerization. Scope creep here would delay the critical executor fix without architectural benefit.
  Date: 2026-02-08

- Decision: Direct API callers must route through Docker, not just add a string.
  Rationale: The codex tRPC router, codex-intent router, conflict arbiter, and TDD loop all call `toolCodex.execute` directly without creating a Docker container. When `containerName` becomes required, they cannot just pass a fake string — they must either create an `AgentFSWorkspace` or route through the runtime orchestrator. This is a separate milestone because it restructures caller code, not executor code.
  Date: 2026-02-08

## Outcomes & Retrospective

(to be filled upon completion)

## Context and Orientation

ALFRED is a monorepo at `/Users/jackmazac/Development/alfred`. Agent executors live in `packages/agent/src/orchestrator/tool/`. There are three executors:

- **Codex** (`packages/agent/src/orchestrator/tool/codex/`) — wraps the OpenAI Codex CLI. Has two modes: "default" (host spawn) and "server" (Docker `docker exec`). The mode is chosen by `resolveExecProfile()` in `packages/agent/src/orchestrator/tool/shared/server.ts`, which returns `"default"` when `containerName` is absent.

- **OpenCode** (`packages/agent/src/orchestrator/tool/opencode/`) — wraps the OpenCode CLI. Same dual-path: `resolveSpawnSpec()` in `exec.ts` line 567 checks `input.containerName` and falls back to host spawn. File I/O helpers (`readTextFileImpl`, `writeTextFileImpl`) also branch on `containerName`.

- **Droid** (`packages/agent/src/orchestrator/tool/droid.ts`) — wraps a generic CLI tool. Has zero container support; always calls `openDirectorySecure(candidate ?? process.cwd())` and spawns directly on host.

The runtime orchestrator (`packages/runtime/src/orchestrator/agent.ts`) correctly creates `AgentFSWorkspace` (Docker) and passes `containerName` to tool inputs. But because the tool schemas mark `containerName` as optional, any direct caller can bypass Docker. There are five known direct callers that bypass the runtime orchestrator:

- **`packages/api/src/routers/codex.ts`** — three call sites (lines 227, 407, 805). The main web app codex API. No `containerName`.
- **`packages/api/src/routers/codex-intent.ts`** — one call site (line 138). Mobile intent-based codex API. No `containerName`.
- **`packages/agent/src/orchestrator/conflict.ts`** — one call site (line 142). Merge conflict arbiter. No `containerName`.
- **`packages/agent/src/orchestrator/loops/tdd.ts`** — one call site (line 68). TDD loop. No `containerName`.
- **`packages/agent/src/orchestrator/loops/ralph.ts`** — marks `containerName` as optional in its own schema (line 611) and passes it through. Its test (`ralph.test.ts` line 87) explicitly tests the host fallback path ("retries with execProfile=default when server start fails").

`persistArtifact` (`packages/agent/src/artifact/persist.ts`) writes JSON state to `{repoRoot}/.agent/tools/{category}/{tool}.json` on the host filesystem. It uses atomic rename with `.tmp-` prefix files. It is called from four sites: `codex/exec.ts:900`, `opencode/exec.ts:915`, `opencode/exec.ts:997`, and `droid.ts:342`.

`AgentFSWorkspace` (`packages/agent/src/environment/agentfs.ts`) is the Docker workspace implementation. It exposes `containerName`, `containerCw`, `dbPath`, and an AgentFS SQLite interface with KV store, audit trail, and checkpoint support.

The handoff route (`apps/web/src/routes/api/agentfs/handoff.ts` lines 185-196) tars `.agent/tools` from the host filesystem into a handoff archive. This assumes artifacts live on the host.

## Plan of Work

### Milestone 1: Make `containerName` required at the schema boundary

The Zod schemas are the contract. Making `containerName` required here means every caller — runtime orchestrator, tests, direct API — must provide it.

Edit `packages/agent/src/orchestrator/tool/codex/definition.ts` line 255: change `containerName: z.string().min(1).max(255).optional()` to `containerName: z.string().min(1).max(255)`. Also make `containerCw` required (line 257) since it's always needed when running in Docker.

Edit the OpenCode input schema (find it in `packages/agent/src/orchestrator/tool/opencode/definition.ts` or `packages/agent/src/opencode.types.ts`) and make `containerName` required.

Edit the Droid input schema in `packages/agent/src/orchestrator/tool/droid.ts` to add a required `containerName` field.

Update the TypeScript interfaces that mirror these schemas: `SpawnInput` in `codex/spawn-process.ts:27`, `OpenCodeServerConfig` in `opencode/server.ts:115`, the tmux type in `opencode/tmux.ts:17`, and `opencode.types.ts:6`.

After this milestone, `bun run typecheck` will produce errors everywhere a caller omits `containerName`. That is the point — those errors are the map of every host-execution call site.

### Milestone 2: Route direct API callers through Docker

After Milestone 1, `bun run typecheck` surfaces every caller that omits `containerName`. Five production callers need to be fixed — they currently call `toolCodex.execute` (or `toolOpencode.execute`) directly without creating a Docker container.

**Direct API callers (tRPC routers):**

Edit `packages/api/src/routers/codex.ts` (three call sites) and `packages/api/src/routers/codex-intent.ts` (one call site). Each must either:

- Create an `AgentFSWorkspace` and pass its `containerName`/`containerCw` to the tool input, or
- Delegate to the runtime orchestrator (which already creates Docker containers).

The runtime orchestrator path is preferred when the caller doesn't need fine-grained control. For the codex router, which manages session resumption and streaming, creating a workspace inline may be necessary.

**Agent loops:**

Edit `packages/agent/src/orchestrator/conflict.ts` (one call site) and `packages/agent/src/orchestrator/loops/tdd.ts` (one call site). These run inside the orchestrator but bypass the standard tool dispatch. They should receive `containerName` from their caller context (the orchestrator already has it).

**Ralph loop:**

Edit `packages/agent/src/orchestrator/loops/ralph.ts`:

- Make `containerName` required in its input schema (line 611).
- Remove the host fallback logic.
- Delete or rewrite the test in `ralph.test.ts` (line 87) that tests the host fallback path ("retries with execProfile=default when server start fails"). The correct test should verify retry within Docker, not fallback to host.

### Milestone 3: Remove host spawn paths from Codex executor

In `packages/agent/src/orchestrator/tool/codex/exec.ts`:

1. `executeWithCodex` (line 358): Remove the `if (profile === "server")` branch and its fallback. Since `containerName` is now required, `resolveExecProfile` always returns `"server"`. The function should unconditionally call `executeWithCodexServer`. Remove the `runCodexWithCodex` function entirely (lines 403-937) — it is the host path.

2. Remove `resolveCodexBin()` (lines 234-273) — it locates the Codex binary on the host. In Docker, the binary is always at `codex` (line 516 already handles this).

3. In `packages/agent/src/orchestrator/tool/codex/spawn-process.ts`: Delete `createHostSpawn` (lines 118-140). In `createCodexSpawn` (lines 142-167), remove the non-container branch — the function should unconditionally create a Docker spawn.

4. In `resolveExecProfile` (`packages/agent/src/orchestrator/tool/shared/server.ts`): Remove the `"default"` return path. The function should always return `"server"`. Better yet, delete the function and the `ExecProfile` type — there is only one profile now.

### Milestone 4: Remove host spawn paths from OpenCode executor

In `packages/agent/src/orchestrator/tool/opencode/exec.ts`:

1. `resolveSpawnSpec` (line 567): Remove the non-container branch. The function should require `input.containerName` and always produce a Docker spawn spec.

2. `readTextFileImpl` (line 438) and `writeTextFileImpl` (line 490): Remove the `else` branches that use `openDirectorySecure` on the host. Only the `if (args.containerName)` Docker path remains.

3. Remove all `process.cwd()` fallbacks (lines 462, 525, 598, 701, 932, 996, 1033, 1035). Replace with explicit errors if `cw` is missing — though with required schemas, this should be unreachable.

4. In `packages/agent/src/orchestrator/tool/opencode/http.ts` line 532: Same — remove `"default"` profile path.

5. In `packages/agent/src/orchestrator/tool/opencode/tmux.ts`: Delete `spawnDirect()` (lines 154-177) — it spawns directly on the host. In `spawnOpencode()` (line 270), remove the fallback to `spawnDirect` — if tmux fails, the function should throw, not silently fall back to host. In `buildOpencodeArgv()` (line 216), delete the bare-command branch at line 266 (`return [cmd, ...args]`) — with `containerName` required, only the `docker exec` branch is reachable.

### Milestone 5: Remove host spawn path from Droid executor

In `packages/agent/src/orchestrator/tool/droid.ts`:

1. Add `containerName` to the input schema (required).
2. Replace `acquireWorkingDirectoryHandle` (line 156) — instead of `openDirectorySecure(candidate ?? process.cwd())`, validate the container path.
3. Replace the `spawnWithSecureCwd` host spawn with `docker exec` into the container, following the same pattern as Codex server mode.
4. The `persistArtifact` call at line 342 will be removed in Milestone 6.

### Milestone 6: Delete `persistArtifact` and all call sites

Delete `packages/agent/src/artifact/persist.ts` and its test `packages/agent/src/artifact/persist.test.ts`.

At each former call site (`codex/exec.ts:900`, `opencode/exec.ts:915`, `opencode/exec.ts:997`, `droid.ts:342`), simply delete the `void persistArtifact(...)` statement. Do not replace it with anything. The data is redundant — executor results are already returned to callers, logged by the pipeline observer, and persisted in `workflow_runs.stateData`. Every call site wraps `persistArtifact` in `void ... .catch()`, confirming it was always optional debugging output.

Remove the import of `persistArtifact` from each file. Remove the `packages/agent/src/artifact/` directory if empty after deletion.

### Milestone 7: Remove `process.cwd()` fallbacks from all executor code

Run `rg 'process\.cwd\(\)' packages/agent/src/orchestrator/tool/` and eliminate every remaining hit. Each should be replaced by either:

- The container working directory (`containerCw`, which is now required)
- An explicit error ("cw is required")

Also check `packages/agent/src/security/filesystem.ts` for `DEFAULT_ALLOW_PREFIXES` — if it references `process.cwd()`, update it to validate container paths instead.

### Milestone 8: Fix tests

Tests that break fall into three categories:

**Category A: Tests that omit `containerName` in tool inputs.** These are `packages/agent/test/codex-integration.test.ts` and `packages/runtime/test/executor.test.ts`. Fix by adding `containerName: "alfred-agentfs-test"` and `containerCw: "/workspace"` to all test inputs. Mock the Docker exec path.

**Category B: Tests that exercise the host spawn path.** The "host mode" tests in `packages/agent/test/codex-spawn-process.test.ts` (lines 69-125) test `createHostSpawn`. Delete these tests — the function no longer exists.

**Category C: Tests for `persistArtifact`.** Delete `packages/agent/src/artifact/persist.test.ts` since `persistArtifact` is deleted.

**Category D: Tests for `resolveExecProfile` returning "default".** In `packages/agent/src/orchestrator/tool/shared/server.test.ts`, update tests to reflect that there is only one profile.

**Category E: Tests for ralph host fallback.** In `packages/agent/test/orchestrator/loops/ralph.test.ts`, delete the "retries with execProfile=default when server start fails" test. Replace with a test that verifies retry within Docker (e.g., container restart or reconnect).

**Category F: Tests for direct API callers.** Any tests in `packages/api/test/codex*.test.ts` that invoke the codex router without `containerName` need the container fields added to their inputs.

Run `bun test packages/agent packages/runtime packages/api` and fix any remaining failures.

### Milestone 9: Clean up handoff route and dead code

In `apps/web/src/routes/api/agentfs/handoff.ts` lines 185-196: Remove the code that tars `.agent/tools` from the host. The handoff archive should only contain the AgentFS run directory (`.agentfs/{runId}/`), which is where artifacts now live.

Delete `.agent/tools/` directory from the repository and add `.agent/tools/` to `.gitignore` as a safety net.

Remove any remaining imports of `persistArtifact` across the codebase.

Remove `packages/agent/src/artifact/persist.d.ts` if it exists.

### Milestone 10: Validation sweep

Run the following commands and verify zero issues:

    rg 'process\.cwd\(\)' packages/agent/src/orchestrator/tool/
    # Expected: zero matches

    rg 'persistArtifact' packages/
    # Expected: zero matches

    rg '\.optional\(\)' packages/agent/src/orchestrator/tool/codex/definition.ts | rg containerName
    # Expected: zero matches

    rg 'createHostSpawn' packages/
    # Expected: zero matches

    rg '\.agent/tools' packages/ apps/
    # Expected: only .gitignore entries

    bun run typecheck
    # Expected: zero errors

    ALFRED_TEST_SCOPE=unit bun test packages/agent packages/runtime packages/api
    # Expected: all tests pass

## Concrete Steps

All commands run from repository root `/Users/jackmazac/Development/alfred`.

1. Make schemas required (Milestone 1):

   # Edit definition files — change .optional() to required

   # Then verify the type errors surface:

   bun run typecheck 2>&1 | head -50

2. Route direct callers through Docker (Milestone 2):

   # Fix each caller surfaced by typecheck. Verify after each:

   bun run typecheck 2>&1 | rg 'containerName'

3. Remove host paths (Milestones 3-5):

   # After each milestone, verify typecheck still runs (errors expected but decreasing):

   bun run typecheck 2>&1 | wc -l

4. Delete persistArtifact (Milestone 6):

   # After deletion, verify no remaining imports:

   rg 'persistArtifact' packages/

5. Fix tests (Milestone 8):

   bun test packages/agent --timeout 120000
   bun test packages/runtime --timeout 120000
   bun test packages/api --timeout 120000

6. Final validation (Milestone 10):

   rg 'process\.cwd\(\)' packages/agent/src/orchestrator/tool/
   rg 'persistArtifact' packages/
   rg 'createHostSpawn' packages/
   bun run typecheck
   ALFRED_TEST_SCOPE=unit bun test packages/agent packages/runtime packages/api

## Validation and Acceptance

Success is defined by three observable behaviors:

1. **Schema enforcement.** Calling `codexInputSchema.parse({ auto: "low", prompt: "test" })` without `containerName` throws a Zod validation error. This proves the schema rejects host execution at parse time.

2. **No host writes.** After running the full test suite, `git status` shows zero modifications in `.agent/tools/`. No `.tmp-*` files appear anywhere in the repository. This proves executors no longer write to the host.

3. **All tests pass.** `ALFRED_TEST_SCOPE=unit bun test packages/agent packages/runtime` passes with zero failures. This proves the Docker-only path is fully functional and tested.

## Idempotence and Recovery

Every step is an edit-and-verify cycle. If a milestone breaks tests, the fix is contained to that milestone. The milestones are ordered by dependency: schemas first (surfacing all callers), then implementation removal (guided by type errors), then test fixes (guided by test failures), then cleanup.

To roll back: `git checkout -- packages/agent packages/runtime apps/web/src/routes/api/agentfs/handoff.ts`.

## Artifacts and Notes

Key files to modify (by milestone):

    Milestone 1 (schemas):
      packages/agent/src/orchestrator/tool/codex/definition.ts
      packages/agent/src/orchestrator/tool/opencode/definition.ts (or opencode.types.ts)
      packages/agent/src/orchestrator/tool/droid.ts
      packages/agent/src/orchestrator/tool/codex/spawn-process.ts
      packages/agent/src/orchestrator/tool/opencode/server.ts
      packages/agent/src/orchestrator/tool/opencode/tmux.ts
      packages/agent/src/orchestrator/loops/ralph.ts (containerName schema)

    Milestone 2 (direct API callers):
      packages/api/src/routers/codex.ts
      packages/api/src/routers/codex-intent.ts
      packages/agent/src/orchestrator/conflict.ts
      packages/agent/src/orchestrator/loops/tdd.ts
      packages/agent/src/orchestrator/loops/ralph.ts (fallback logic)

    Milestone 3 (codex host removal):
      packages/agent/src/orchestrator/tool/codex/exec.ts
      packages/agent/src/orchestrator/tool/codex/spawn-process.ts
      packages/agent/src/orchestrator/tool/shared/server.ts

    Milestone 4 (opencode host removal):
      packages/agent/src/orchestrator/tool/opencode/exec.ts
      packages/agent/src/orchestrator/tool/opencode/http.ts
      packages/agent/src/orchestrator/tool/opencode/tmux.ts

    Milestone 5 (droid containerization):
      packages/agent/src/orchestrator/tool/droid.ts

    Milestone 6 (persistArtifact deletion):
      packages/agent/src/artifact/persist.ts (DELETE)
      packages/agent/src/artifact/persist.test.ts (DELETE)
      packages/agent/src/artifact/persist.d.ts (DELETE if exists)

    Milestone 8 (test fixes):
      packages/agent/test/codex-integration.test.ts
      packages/agent/test/codex-spawn-process.test.ts
      packages/runtime/test/executor.test.ts
      packages/agent/src/orchestrator/tool/shared/server.test.ts
      packages/agent/test/orchestrator/loops/ralph.test.ts
      packages/api/test/codex*.test.ts

    Milestone 9 (cleanup):
      apps/web/src/routes/api/agentfs/handoff.ts
      .gitignore

    Out of scope (non-executor tools — no changes needed):
      packages/agent/src/orchestrator/tool/git.ts
      packages/agent/src/orchestrator/tool/browser.ts
      packages/agent/src/orchestrator/tool/docker.ts
      packages/agent/src/orchestrator/tool/context.ts

## Interfaces and Dependencies

After completion, the following interfaces must exist:

In `packages/agent/src/orchestrator/tool/codex/definition.ts`:

    // containerName is REQUIRED — no .optional()
    export const codexInputSchema = z.object({
      // ...existing fields...
      containerName: z.string().min(1).max(255),
      containerCw: z.string().min(1).max(1024),
      // ...
    });

In `packages/agent/src/orchestrator/tool/shared/server.ts`:

    // ExecProfile type is deleted. Only one mode exists.
    // resolveExecProfile is deleted.
    // serverKey, ensureServer, stopServer remain for Docker server lifecycle.

In `packages/agent/src/orchestrator/tool/codex/spawn-process.ts`:

    // createHostSpawn is deleted.
    // createCodexSpawn always returns a Docker spawn.
    export async function createCodexSpawn(
      input: SpawnInput,  // containerName is required in SpawnInput
      cwdHandle: AllowedDirectoryHandle
    ): Promise<SpawnFn>;

`packages/agent/src/artifact/persist.ts` does not exist. No function named `persistArtifact` exists anywhere in the codebase. No `void persistArtifact(...)` call exists in any executor.
