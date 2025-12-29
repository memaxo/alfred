# Poof Isolation Patterns

> **DEPRECATED**: Poof isolation is legacy. Production uses Docker containers exclusively. Poof code is only available when built with `--feature=LEGACY_POOF`. See `.ruler/37-bun-feature-flags.md` for feature flag patterns.

1. **Feature flag guard.** All poof code paths must be wrapped in `feature("LEGACY_POOF")` guards for tree-shaking in production builds.

2. **Linux-only guard.** Check `isPoofAvailable()` before using poof features. Fall back to container isolation on non-Linux platforms.

3. **Resource profiles.** Use predefined profiles (`minimal`, `standard`, `intensive`) from `POOF_PROFILES` instead of hardcoding limits.

4. **Upper directory lifecycle.** Always clean up upper directories via `cleanupUpperDir()` or `workspace.cleanup()`.

5. **Non-interactive mode.** Always use `--upper=<dir>` flag when spawning poof in automated contexts.

6. **Exit code handling.** Check for `isPoofTimeout()` (exit 124) and `isCommandNotFound()` (exit 127) after spawn.

7. **Sandbox detection.** Use `isInsideSandbox()` to detect when code runs inside poof. Avoid nested poof calls.

8. **Change review flow.** Capture changes with `parseUpperLayer()`, review with `formatChanges()`, then apply with `applyUpperLayer()`.

9. **Network not isolated.** Poof does NOT isolate network access. Use policy enforcement for network-sensitive operations.

10. **Docker compatibility.** When running in Docker, ensure `--device /dev/fuse --security-opt seccomp=unconfined` flags.
