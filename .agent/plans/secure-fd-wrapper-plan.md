# Secure FD-Based Tool Spawning

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain it in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

Target: ALFRED itself. Today, high-privilege tools (git, docker, droid, generic runner) validate working directories via secure directory handles, but they revert to plain path strings when spawning child processes through Bun. That reopens the time-of-check-to-time-of-use race the handle was meant to close. After this change, all security-sensitive subprocesses will inherit their cwd directly from the validated directory file descriptor via a native wrapper that performs `fchdir`+`execvp`. Users (and policy) gain certainty that a malicious symlink swap cannot redirect tool execution after approval. The behavior is observable by running the existing `packages/agent/test/secure-working-directory.test.ts` suite: after the change, it asserts the wrapper is invoked with the fd environment variable rather than the swapped path while continuing to pass.

## Progress

- [x] (2025-11-27 23:05Z) Analyzed fd-based cwd limitations, selected the native wrapper strategy, and documented the ExecPlan.
- [x] (2025-11-27 23:20Z) Implemented native `securespawn.c` source under `packages/agent/native/` and added bin scaffolding + gitignore rules.
- [x] (2025-11-27 23:38Z) Added `packages/agent/src/security/secure-spawn.ts` with wrapper resolution, on-demand compilation, and env plumbing.
- [x] (2025-11-27 23:55Z) Swapped runner/git/docker/droid to `spawnWithSecureCwd` and documented the legacy `prepareCwdFromHandle` caveat.
- [x] (2025-11-28 00:05Z) Updated `secure-working-directory.test.ts` to assert wrapper/FD behavior and verified via `bun test test/secure-working-directory.test.ts`.
- [ ] (2025-11-28 00:12Z) Full `bun test` run blocked by missing optional deps and pre-existing suite failures; rerun end-to-end once the suite is green.

## Surprises & Discoveries

- Observation: Full `bun test` historically failed before our changes executed because several suites depended on optional modules and other pre-existing issues (missing `/repo`, preference prompts). Evidence: `cd packages/agent && bun test` at 2025-11-28 00:12Z raised missing-module errors plus downstream cascading failures in unrelated suites.

## Decision Log

- Decision: Use a tiny native wrapper binary that calls `fchdir(fd)` before `execvp` to eliminate the cwd TOCTOU gap instead of attempting `/dev/fd` or `bun:ffi` hacks.
  Rationale: `fchdir` guarantees the directory binding follows the validated fd on both macOS and Linux, keeps Bun usage simple, and confines native code to ~50 lines with stable POSIX semantics; `/dev/fd` fails on macOS and duplicating `posix_spawn` via FFI is brittle.
  Date/Author: 2025-11-27 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

Security-sensitive directory handling lives under `packages/agent/src/security/`. `filesystem.ts` provides `openDirectorySecure` (validates allowed prefixes and opens directories with `O_NOFOLLOW`) and `prepareCwdFromHandle`, which currently converts a `DirectoryHandle` back into a path string. `fd.ts` exposes `ensureFdInheritable`, `directoryFdPath`, and `pathFromFd` via `bun:ffi`. Tool invocations that must honor secure directories exist under `packages/agent/src/orchestrator/tool/`: `runner.ts` (generic command executor), `git.ts`, `docker.ts`, and `droid.ts`. Tests covering cwd pinning live in `packages/agent/test/secure-working-directory.test.ts`. No native helper or compile pipeline exists yet, so we will add one under `packages/agent/native/` plus a cache directory (e.g., `packages/agent/bin/`). All naming must stay single-word per repo conventions. The change solely affects ALFRED core tooling, not generated apps.

## Plan of Work

Introduce a new `packages/agent/native/securespawn.c` program that accepts `ALFRED_CWD_FD` from the environment, calls `fchdir(fd)`, unsets the env, closes the fd, and `execvp`s the target command (passed via argv). Emit clear exit codes: 125 for config errors, 126 for `fchdir` failures, 127 for `execvp` failures. The binary must build on macOS and Linux using `cc` (clang/gcc). Create `packages/agent/bin` (gitignored) to hold compiled artifacts, named `securespawn-<platform>-<arch>` so each host can cache its build.

Add `packages/agent/src/security/secure-spawn.ts` implementing `spawnWithSecureCwd`. This helper takes `{ cwdHandle, cmd, args, env, stdin, stdout, stderr, timeoutSec? }`, ensures the fd is inheritable via `ensureFdInheritable`, locates or builds the wrapper, injects `ALFRED_CWD_FD`, and runs `Bun.spawn`. Wrapper resolution should first honor `process.env.ORCH_SECURE_SPAWN_WRAPPER` (validated with `fs.accessSync(..., X_OK)`). Otherwise, derive the repo root via `import.meta.resolve` / `new URL` relative paths, compute `packages/agent/bin/securespawn-${platform}-${arch}`, and build it if missing or older than the source by invoking `Bun.spawnSync` with `cc`. Support `cc`, `clang`, or `gcc` (first available). Throw a descriptive error if compilation fails. Do not set `cwd` when calling `Bun.spawn`; the wrapper handles it. Return the subprocess so current callers continue consuming `.stdout`, `.stderr`, and `.exited`.

Update `prepareCwdFromHandle`’s documentation to warn that it must not feed `Bun.spawn` for security-critical paths; keep it available for logging or legacy paths. Replace every usage that launches subprocesses: in `packages/agent/src/orchestrator/tool/runner.ts`, detect `DirectoryHandle` inputs and use `spawnWithSecureCwd`, falling back to the old string-based spawn when the caller passed a literal path. In `tool/git.ts`, `tool/docker.ts`, and `tool/droid.ts`, swap the `Bun.spawn` invocation for the helper. Propagate stdin/stdout/stderr/env exactly as before so upstream logic (stream readers, timers) remains unchanged.

Extend `packages/agent/test/secure-working-directory.test.ts` to reflect the helper. Instead of checking `spawnOptions.cwd`, assert that `Bun.spawn` is called with the wrapper command as argv[0], the original tool as argv[1], and that `spawnOptions.env.ALFRED_CWD_FD` equals the handle’s fd while `spawnOptions.cwd` stays undefined. Inject `process.env.ORCH_SECURE_SPAWN_WRAPPER = process.execPath` within the tests to avoid compiling the real wrapper, and ensure spies confirm the helper cleared the env from child scope after spawn (if exposed). Add a new unit test for `spawnWithSecureCwd` if practical, using spies to verify `ensureFdInheritable` and wrapper resolution. Update snapshots/fixtures if necessary.

Finally, document the build expectation (e.g., README snippet or comment near the helper) so developers know to run `bun run agent:build-securespawn` if auto-build fails (provide script in `package.json` if needed). Mark plan progress after each milestone and record surprises/decisions as they arise.

## Concrete Steps

1. `cd /Users/jackmazac/Development/alfred && mkdir -p packages/agent/native packages/agent/bin` (bin will be gitignored). Add `packages/agent/native/securespawn.c` with the POSIX wrapper implementation and ensure it adheres to repo naming rules.
2. Update `.gitignore` (if needed) to ignore `packages/agent/bin/securespawn-*` artifacts.
3. Create `packages/agent/src/security/secure-spawn.ts` implementing wrapper resolution, optional compilation (via `cc`/`clang`/`gcc`), and the `spawnWithSecureCwd` export. Add any supporting helpers (e.g., `compileWrapperIfNeeded`).
4. Adjust `packages/agent/src/security/filesystem.ts` comments to deprecate `prepareCwdFromHandle` for spawning.
5. Modify `packages/agent/src/orchestrator/tool/runner.ts`, `tool/git.ts`, `tool/docker.ts`, and `tool/droid.ts` to import and use `spawnWithSecureCwd` for `DirectoryHandle` flows.
6. Update `packages/agent/test/secure-working-directory.test.ts` (and any additional helper tests) to assert wrapper/env behavior rather than cwd strings. Mock `Bun.spawn` to inspect arguments and set `ORCH_SECURE_SPAWN_WRAPPER` to a harmless executable (e.g., `process.execPath`).
7. Run `cd packages/agent && bun test packages/agent/test/secure-working-directory.test.ts` followed by `bun test` for full coverage. If wrapper compilation occurs during runtime, confirm `packages/agent/bin/securespawn-<platform>-<arch>` exists and is executable.
8. Document outcomes, surprises, and decisions inside this ExecPlan, then summarize results in the final response.

## Validation and Acceptance

Validation focuses on demonstrating that TOCTOU is eliminated and existing tool functionality remains intact. Acceptance criteria:

- Running `bun test packages/agent/test/secure-working-directory.test.ts` passes and the updated assertions confirm `Bun.spawn` receives the wrapper binary and `ALFRED_CWD_FD` rather than a derived path.
- Running `bun test` within `packages/agent` still succeeds, covering git/docker/droid flows.
- Manual spot check (optional) by compiling the wrapper (`bun run agent:build-securespawn` if added) and executing a simple command via `spawnWithSecureCwd` to ensure actual subprocesses inherit the directory (e.g., run `pwd` inside a swapped symlink workspace and observe original path).

## Idempotence and Recovery

Wrapper compilation writes to `packages/agent/bin/securespawn-<platform>-<arch>`; rerunning the compile step simply overwrites the binary. If `cc` is unavailable, the helper surfaces a clear error so developers can install a compiler and retry. Tests and helper code are additive, so re-running `bun test` is safe. No repository files are deleted per the Deletion Safeguards policy.

## Artifacts and Notes

- Pending actual implementation results; record compiler logs or test transcripts here if they expose noteworthy behavior (e.g., missing compiler, permission issues).

## Interfaces and Dependencies

Define the following exported helper in `packages/agent/src/security/secure-spawn.ts`:

    export type SecureSpawnOptions = {
        cwdHandle: DirectoryHandle;
        cmd: string;
        args?: string[];
        env?: Record<string, string | undefined>;
        stdin?: SpawnOptions["stdin"];
        stdout?: SpawnOptions["stdout"];
        stderr?: SpawnOptions["stderr"];
    };

    export function spawnWithSecureCwd(options: SecureSpawnOptions): Subprocess;

It must ensure `ensureFdInheritable` runs, set `ALFRED_CWD_FD`, and launch `[wrapper, cmd, ...args]` via `Bun.spawn` without a `cwd`. Provide an internal `resolveSecureSpawnWrapper(): string` that handles env override, cached binaries, and on-demand compilation from `packages/agent/native/securespawn.c`. The helper should throw descriptive errors when the wrapper cannot be located or compiled. Downstream tools (runner/git/docker/droid) must treat the returned `Subprocess` exactly as they do today.
