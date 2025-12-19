# Poof Isolation Patterns

1. **Linux-only guard.** Always check `isPoofAvailable()` before using poof features. Fall back to worktree isolation on non-Linux platforms.

2. **Resource profiles.** Use predefined profiles (`minimal`, `standard`, `intensive`) from `POOF_PROFILES` instead of hardcoding limits. Custom profiles should be rare and documented.

3. **Upper directory lifecycle.** Always clean up upper directories via `cleanupUpperDir()` or `workspace.cleanup()`. Orphan upper directories waste disk space.

4. **Non-interactive mode.** Always use `--upper=<dir>` flag when spawning poof in automated contexts to skip the interactive y/n/d prompt.

5. **Exit code handling.** Check for `isPoofTimeout()` (exit 124) and `isCommandNotFound()` (exit 127) after spawn. These indicate resource limits or missing binaries.

6. **Sandbox detection.** Use `isInsideSandbox()` to detect when code runs inside poof. Avoid nested poof calls.

7. **Change review flow.** For coder agents, capture changes with `parseUpperLayer()`, review with `formatChanges()`, then apply with `applyUpperLayer()`. Never auto-apply without review in production.

8. **Wave handoff.** Use `WaveHandoff` to track changes across parallel agents. Call `detectConflicts()` before applying changes from multiple agents to the same files.

9. **Network not isolated.** Remember poof does NOT isolate network access. Agents can still make HTTP requests. Use policy enforcement for network-sensitive operations.

10. **Docker compatibility.** When running in Docker, ensure `--device /dev/fuse --security-opt seccomp=unconfined` flags or `--cap-add=SYS_ADMIN`. Test with `poof exec echo test` before relying on isolation.
