# AgentFS Workspace Development

1. **Single execution path.** All agent execution uses `AgentFSWorkspace` inside Docker. No alternative workspace types (container-only, worktree, poof) exist.

2. **Docker is mandatory.** Every `AgentFSWorkspace.initialize()` creates or reuses a Docker container. Do not bypass Docker for testing - use auth mocking instead.

3. **Container naming convention.** Containers are named `alfred-agentfs-{runId}` to enable sharing across multiple agents in the same orchestration run.

4. **Volume mount pattern.** Repository is mounted at `/workspace` inside the container. All `exec()` calls run with cwd `/workspace`.

5. **Auth mocking for tests.** Install auth mock BEFORE other imports:
   ```typescript
   import { installAuthTokenMock } from "@alfred/test-kit";
   installAuthTokenMock();
   // ... then other imports
   ```

6. **Test directories under repo.** Docker security validates paths against `DEFAULT_ALLOW_PREFIXES` (repo root). Use `.agent/test-workspaces/` for test directories, not `os.tmpdir()`.

7. **Cleanup containers.** `workspace.cleanup()` removes the Docker container. Always call cleanup in `afterEach` to avoid container leaks.

8. **AgentFS provides audit.** Docker provides process isolation; AgentFS provides audit trail, checkpoints, KV store. Don't conflate their responsibilities.

9. **Factory always returns AgentFSWorkspace.** `WorkspaceFactory.create()` ignores the `kind` parameter - it exists only for API compatibility.

10. **Access container metadata.** Use `workspace.containerId`, `workspace.containerName`, and `workspace.containerCw` getters after initialization.
