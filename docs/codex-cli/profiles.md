# Profiles

Codex profiles bundle configuration toggles so you can swap entire setups with a single flag or environment variable. Profiles are ideal for enabling optional Model Context Protocol (MCP) servers—keep the defaults lean, then opt in to heavier integrations only when you need them.

## Selecting a profile

- `codex --profile context7` runs Codex with the named profile from `config.toml`.
- `CODEX_PROFILE=context7 codex exec …` sets a default profile for non-interactive runs.
- ALFRED’s orchestrator now forwards a `profile` value to the Codex tool, so workflow callers can request a profile (for example, from `tool.handoff` context payloads) without changing environment-wide defaults.

## Sample MCP-focused profiles

Each profile below scopes its MCP servers so the baseline configuration stays clean. None are enabled unless you pass their profile name.

### Context7 documentation search

```toml
[profiles.context7]

[profiles.context7.mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
# Export CONTEXT7_API_KEY before invoking Codex. It will be forwarded automatically.
env_vars = ["CONTEXT7_API_KEY"]
startup_timeout_sec = 20
```

- `@upstash/context7-mcp` accepts either an `--api-key` flag or the `CONTEXT7_API_KEY` environment variable. Prefer the environment variable so you never commit credentials.

### Playwright automation tooling

```toml
[profiles.playwright]

[profiles.playwright.mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest", "--headless"]
# Optional: keep an authenticated browser context handy.
env_vars = ["PLAYWRIGHT_SERVICE_ACCESS_TOKEN", "PLAYWRIGHT_BROWSERS_PATH"]
tool_timeout_sec = 120
```

- The Playwright MCP server reads optional service tokens and cached browser paths when present. Leaving them unset falls back to anonymous, transient sessions.

### GitHub operations

```toml
[profiles.github]

[profiles.github.mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
env_http_headers = { Authorization = "GITHUB_PERSONAL_ACCESS_TOKEN" }
```

For self-hosted runs, swap the remote `url` with a local launcher:

```toml
[profiles.github-local]

[profiles.github-local.mcp_servers.github]
command = "docker"
args = [
  "run",
  "-i",
  "--rm",
  "-e",
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "ghcr.io/github/github-mcp-server",
  "stdio"
]
env_vars = [
  "GITHUB_PERSONAL_ACCESS_TOKEN",
  "GITHUB_HOST",
  "GITHUB_TOOLSETS",
  "GITHUB_DYNAMIC_TOOLSETS",
  "GITHUB_READ_ONLY"
]
```

## Environment hand-off

The Codex tool only propagates a narrow allowlist of environment variables. For MCP profiles, ensure you export whichever of the following apply before invoking Codex (or set them in the orchestrator auth context):

- `CONTEXT7_API_KEY`, `CONTEXT7_BASE_URL`
- `PLAYWRIGHT_SERVICE_ACCESS_TOKEN`, `PLAYWRIGHT_BROWSERS_PATH`, `PLAYWRIGHT_WS_ENDPOINT`, `PLAYWRIGHT_HEADLESS`
- `GITHUB_PERSONAL_ACCESS_TOKEN`, `GITHUB_PAT`, `GITHUB_TOKEN`, `GITHUB_HOST`, `GITHUB_TOOLSETS`, `GITHUB_DYNAMIC_TOOLSETS`, `GITHUB_READ_ONLY`
- `MCP_AUTH_TOKEN` (generic bearer token some servers expect)

The orchestrator forwards these automatically when present, so profiles can rely on environment-driven secrets without baking them into `config.toml`.

## Recommended workflow

1. Define profiles in `~/.codex/config.toml` (or repository-local config).
2. Export the required environment variables in your shell, secret manager, or CI runner.
3. Pick the profile per run:
   - CLI: `codex exec --profile playwright --json --sandbox workspace-write "…"`
   - Orchestrator: include `profile: "github"` in the workflow input payload.
4. Keep `profile` unset to fall back to the lean defaults.

This keeps optional MCP integrations off the hot path, while still allowing one-command access whenever you need richer tooling.
