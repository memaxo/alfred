# Development Environment Guard

## Rules

1. **Use the guarded launcher.** Prefer `bun run dev` over raw `turbo dev`.
2. **One dev session.** Never run multiple concurrent dev sessions; kill or reuse the existing one.
3. **Kill before restart.** When switching branches or recovering from crashes, run `bun run dev:guard:kill` before starting dev again.
4. **Automation uses `--fix`.** Non-interactive scripts should use the guard’s auto-fix mode to resolve conflicts without prompts.
5. **Detect leaks early.** Run the guard’s check mode in hooks/CI to catch leaked processes and port conflicts.
