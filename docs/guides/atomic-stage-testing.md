# atomic-stage-testing

Owner: workflow, tui

Run ALFRED’s workflow pipeline **one stage at a time** over HTTP, while still using **real AgentFS executors inside Docker**. This is the recommended harness for validating the cognitive loop + executor integration without brittle ad‑hoc scripts.

## Prereqs

- **API server running**: `bun run dev` (or `bun run dev:web`) so `/api/trpc/*` is reachable.
- **Docker running** with the AgentFS image available:

```bash
docker image inspect alfred-agentfs:codex >/dev/null \
  || docker build -f docker/agentfs/Dockerfile -t alfred-agentfs:codex .
```

- **CLI/TUI pointing at your server** (all should typically be the same URL):
  - **CLI phase commands** use `--base-url` or `ALFRED_WEB_URL`
  - **TUI API client** uses `ALFRED_API_BASE_URL`
  - **Auth login** uses `ALFRED_API_URL`

```bash
export ALFRED_WEB_URL="http://localhost:3000"
export ALFRED_API_BASE_URL="http://localhost:3000"
export ALFRED_API_URL="http://localhost:3000"
```

## Quick start (CLI)

### 1) Authenticate (for API calls)

- **Dev-only shortcut**:

```bash
alfred auth local
```

- **Or device login**:

```bash
alfred auth login
```

### 2) Issue a tool token (for Docker + executors)

These scopes are a safe default for AgentFS + Codex execution:

```bash
alfred token issue \
  --scope droid.exec \
  --scope deploy.write \
  --scope repo.read \
  --scope repo.write \
  --ttl 900
```

This caches the tool JWT in CLI credentials so you don’t have to pass `--authz` repeatedly.

### 3) Plan → schedule (creates a runId)

```bash
alfred plan "Create hello.txt with the contents 'hello.'" --workspace "$PWD"
```

### 4) Prepare AgentFS (Docker container + DB)

```bash
alfred prepare --run-id "<runId-from-plan>"
```

### 5) Step atomically to a stage boundary

Run until `execute` (or any other stage in `init|context|plan|schedule|execute|review|learn|summarize`):

```bash
alfred step --run-id "<runId>" --until execute
```

### 6) Inspect cognitive artifacts (run-scoped)

```bash
alfred cognitive events --stream-id "<runId>" --limit 50
```

## Quick start (TUI)

1. Start the TUI dashboard:

```bash
alfred tui
```

2. In the **Workflow** panel:

- Select a run with `j/k` (or arrow keys).
- Press:
  - **`r`**: prepare AgentFS for the selected run (requires `alfred token issue ...`)
  - **`n`**: step to the next stage (will require tool authz when stepping into `execute`)
  - **`e`**: step until `execute` (requires tool authz)

3. Switch panels to inspect:

- **Cognitive**: shows run-scoped cognitive state + events once a run is selected.
- **AgentFS**: shows directory + KV snapshot (polling via `agentfs.snapshot`).
- **ToolCalls**: shows recent AgentFS tool calls for the connected run.

## Opt-in integration test (HTTP + Docker)

Runs `schedule → prepare → execute` over HTTP and asserts AgentFS + cognitive artifacts.

```bash
RUN_HTTP_DOCKER_TESTS=1 bun test packages/api/test/integration/workflow-phase.http-docker.integration.test.ts
```

## Troubleshooting

- **`docker_binary_not_found` / `docker info` fails**: start Docker Desktop / ensure `docker` is on `PATH`.
- **`image not found: alfred-agentfs:codex`**: build it with the command in Prereqs.
- **`No tool authz found`**:
  - Run `alfred token issue ...` (caches token), or
  - Set `ALFRED_TOOL_AUTHZ` to the raw JWT (CLI/TUI will add `Bearer ` automatically).
- **Workflow stepping fails at `execute`**:
  - Ensure the tool token includes at least `droid.exec` and `deploy.write`.
  - Ensure `CODEX_API_KEY` or `OPENAI_API_KEY` is available for the Codex executor.
