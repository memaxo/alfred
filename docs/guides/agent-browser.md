# agent-browser

Owner: agent

Purpose: Use `agent-browser` as ALFRED’s deterministic “web operator” for driving our web UI via accessibility snapshots + stable refs.

## What this is

ALFRED exposes an orchestrator tool named `browser` (implemented in `packages/agent/src/orchestrator/tool/browser.ts`) that shells out to the `agent-browser` CLI:

- **Primary loop**: `open` → `snapshot` (refs) → `click/fill/press` → re-`snapshot`
- **Why it works well for agents**: refs (`@e1`, `@e2`, …) from snapshots are deterministic and avoid brittle CSS selectors.

Upstream references:
- [`vercel-labs/agent-browser`](https://github.com/vercel-labs/agent-browser)
- [`agent-browser` agent mode docs](https://agent-browser.dev/agent-mode)
- [`agent-browser` snapshots docs](https://agent-browser.dev/snapshots)

## Install & prerequisites

- Install the CLI:
  - **Repo-local (recommended)**: `bun add -d agent-browser`
  - **Global**: `npm install -g agent-browser`
- Download Chromium once: `agent-browser install`
- Optional overrides:
  - `AGENT_BROWSER_BIN=/absolute/path/to/agent-browser` (or a repo-relative path) to force a specific binary.

## Tests

The `browser` tool ships an opt-in integration test that runs only when explicitly enabled:

```bash
ALFRED_TEST_AGENT_BROWSER=1 bun test packages/agent/test/browser-tool.integration.test.ts
```

## Tool contract (ALFRED)

The `browser` tool is intentionally small:

- **navigate**: `action: "open"`, `url`, optional `headers`
- **inspect**: `action: "snapshot"` (defaults: interactive + compact, depth 6, optional `snapshot.scope`)
- **act**: `click` / `fill` / `type` / `press`
- **assert**: `get.text` / `get.url` / `get.title` / `is.visible` / `is.enabled`
- **session**: pass `runId` (preferred) or `session` for isolation across parallel runs
- **auth**:
  - header-based: pass `headers` on `open` (origin-scoped per `agent-browser`)
  - state-based: `state.save` / `state.load`

Policy scopes:
- read-only actions require `web.read`
- state-changing actions require `web.write`

## Output + failure artifacts

The tool runs `agent-browser` in `--json` mode and returns the parsed `data` payload when available.

On failures it attempts to capture:
- a screenshot, and
- a compact interactive snapshot

Default artifact location:
- `.agent/artifacts/browser/<runIdOrSession>/`

## Best practices

- Prefer refs over selectors: always use `snapshot` output refs (`@eN`) for `click`/`fill` when possible.
- Re-snapshot after navigation or significant DOM changes.
- Scope snapshots to your app shell (usually `snapshot.scope: "#main"`) to keep outputs stable and small.
- Use per-run sessions (via `runId`) to avoid cross-run cookie/localStorage collisions.

