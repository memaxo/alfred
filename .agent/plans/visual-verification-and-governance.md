# Visual Verification and Governance Plan

This ExecPlan formalizes the implementation of Phase 6 (Visual Verification) from the Comprehensive Engineering Upgrade and adds Phase 7 (Resource Governance) for hardening.

## Purpose

1.  **Visual Verification**: Enable agents to "see" their work using headless browser automation. This allows for end-to-end UI testing and verification beyond code functionality.
2.  **Resource Governance**: Enforce resource limits (CPU/Memory) on agent containers to preventing runaway processes and ensuring system stability in multi-agent scenarios.

## Progress

- [ ] **Phase 1: Visual Verification**
  - [ ] Implement `toolBrowser` in `packages/agent/src/orchestrator/tool/browser.ts` using Playwright.
  - [ ] Add `screenshot`, `navigate` capabilities.
  - [ ] Expose `toolBrowser` to agents in `buildAgentSpec`.
- [ ] **Phase 2: Resource Governance**
  - [ ] Update `toolDocker` to support `cpus` and `memory` options.
  - [ ] Update `ContainerWorkspace` to apply default limits (e.g., 1.0 CPU, 1GB RAM).
  - [ ] Verify limits are enforced.

## Plan of Work

### Phase 1: Visual Verification

1.  **Update `packages/agent/src/orchestrator/tool/browser.ts`**:
    - Replace the stub with a real Playwright implementation.
    - Implement `execute` method to handle `screenshot` and `navigate` actions.
    - Use `bun:test` or `playwright` directly.
2.  **Update `AgentSpec`**:
    - Ensure agents with UI tasks have access to the browser tool (conceptually; currently tools are globally available or specific to `toolCodex` wrapper).
    - `toolCodex` wraps specific tools. We need to ensure `toolBrowser` is available if requested.

### Phase 2: Resource Governance

1.  **Update `toolDocker`**:
    - Modify `dockerInputSchema` to include `resources: { cpu?: number; memory?: string }`.
    - Update `executeRun` to pass `--cpus` and `--memory` flags to `docker run`.
2.  **Update `ContainerWorkspace`**:
    - In `initialize`, pass default resource limits when calling `toolDocker.execute`.
    - Defaults: `cpus: 1.0`, `memory: "1g"`.

## Verification

1.  **Visual Verification**:
    - Create a script `scripts/test-browser.ts` that uses `toolBrowser` to take a screenshot of a public URL (e.g., example.com) and verifies the file is created.
2.  **Resource Governance**:
    - Inspect `docker inspect` output of a created container to verify resource limits are set.

## Dependencies

- `playwright` (already in root package.json devDeps, check if installed in `packages/agent` or root).
- `docker` (cli).
