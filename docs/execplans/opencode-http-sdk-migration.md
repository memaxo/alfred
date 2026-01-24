# opencode-http-sdk-migration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

## Purpose / Big Picture

ALFRED’s OpenCode executor currently runs OpenCode as an **ACP stdio** backend (`opencode acp`) and implements an ACP client in `packages/agent/src/orchestrator/tool/opencode/exec.ts`. This work replaces that transport with the **OpenCode HTTP server** (`opencode serve`) and the type-safe **`@opencode-ai/sdk`** client, while preserving ALFRED’s existing executor contract: `execProfile` semantics, streaming writer events, abort/timeout propagation, policy enforcement, filesystem safety, and MCP server wiring.

After this change, ALFRED clients still talk only to the ALFRED backend; the ALFRED backend talks server-to-server to an OpenCode HTTP server; and the OpenCode server runs inside the AgentFS container so all file and shell actions happen in the AgentFS copy-on-write workspace.

You can see it working by running:

- The existing OpenCode executor tests (updated to cover HTTP transport): `bun test packages/agent/src/orchestrator/tool/opencode/*.test.ts`.
- A gated live verification script that starts an AgentFS workspace, runs an OpenCode prompt via HTTP transport, and prints streamed output: `bun scripts/verify-executors-live.ts --opencode-http` (added in this plan).

## Architecture Contract

### Single-sentence responsibility

Provide a secure, deterministic ALFRED executor implementation that drives OpenCode via its HTTP server API (SDK), emitting ALFRED writer events in real time and enforcing ALFRED policy.

### In scope

1. Starting/stopping (or connecting to) an OpenCode HTTP server.
2. Mapping ALFRED tool inputs (`prompt`, `execProfile`, `auto`, `sessionId`, `model`, `mcpServers`, `timeoutSec`) into OpenCode sessions and prompts.
3. Streaming OpenCode SSE events into ALFRED writer events (stdout/stderr/notice/artifact/command equivalents).
4. Abort/timeout propagation into OpenCode (`/session/:id/abort`) and into the SSE subscription.
5. MCP server wiring by registering remote MCP servers with OpenCode (`/mcp`) so OpenCode can call ALFRED’s runtime MCP tools (notably `runtime.escalate`).
6. Preserving AgentFS filesystem safety (OpenCode runs in-container against `/workspace`), plus optional `.env`/secret read protection.
7. Incremental rollout and fallback: run HTTP alongside ACP until parity and reliability are proven, then flip default and later remove ACP.

### Out of scope

1. ALFRED clients talking directly to OpenCode server (no client→OpenCode traffic).
2. Multi-tenant OpenCode server hosting (ALFRED is single-user; each orchestration run is isolated).
3. Rewriting the broader executor/tool interface across the system.
4. Any new UI features (this work is backend + executor plumbing).

### Boundary and topology (server → server → client)

ALFRED Clients (web/native)
|
| (tRPC / HTTP, SSE)
v
ALFRED Backend (packages/api + packages/runtime)
|
| toolOpenCode.execute(...) (server-to-server)
v
AgentFS Docker container (alfred-agentfs-<runId>)
|
| OpenCode HTTP server (opencode serve) 127.0.0.1:<port>
v
OpenCode runtime

Streaming path:

OpenCode server SSE (/event) -> ALFRED toolOpenCode -> writer -> runtime -> clients

### Deployment topology options

Option A (chosen): In-container server + “docker exec fetch” (no published ports)

- Start `opencode serve` inside the AgentFS container bound to `127.0.0.1:<port>`.
- ALFRED backend communicates with the server by executing `curl` inside the same container (`docker exec ... curl http://127.0.0.1:<port>/...`).
- The SDK is still used by providing a custom `fetch` implementation to `@opencode-ai/sdk` that proxies requests via `docker exec curl`.
- Pros: works with current AgentFS networking (no port publishing), never exposes OpenCode on host network, preserves AgentFS copy-on-write semantics.
- Cons: extra overhead per HTTP request (docker exec + curl), slightly more complex debugging.

Option B: In-container server + published host port

- Modify AgentFS container creation to publish a random host port for OpenCode, then connect directly from the ALFRED backend via HTTP.
- Pros: simplest HTTP transport; no docker exec per request; easiest to debug.
- Cons: requires AgentFS runtime changes (port allocation + tracking), introduces port collision concerns, increases attack surface if misconfigured.

Option C: Host/sidecar OpenCode server (not recommended for ALFRED executor)

- Running OpenCode on the host breaks AgentFS copy-on-write guarantees unless every file/shell action is re-proxied back into the container.
- Only consider for non-AgentFS dev tooling.

This plan implements Option A first for correctness and isolation, and leaves Option B as a performance improvement milestone once parity is established.

## Progress

- [x] (2026-01-23) Audit current ACP OpenCode tool implementation and tests to capture required parity behaviors.
- [x] (2026-01-23) Choose deployment topology (Option A: in-container server + docker-exec fetch) that fits AgentFS constraints.
- [x] (2026-01-23) Implement HTTP transport alongside ACP with a feature flag (transport switch) and keep ACP as fallback.
- [x] (2026-01-23) Implement OpenCode server lifecycle for `execProfile=server` and disposable lifecycle for `execProfile=default`.
- [x] (2026-01-23) Implement SSE event mapping to ALFRED writer events + artifacts.
- [x] (2026-01-23) Implement abort + timeout propagation.
- [x] (2026-01-23) Implement MCP server registration (`mcpServers`) for HTTP transport.
- [x] (2026-01-23) Extend OpenCode tests to cover HTTP transport and preserve legacy ACP behavior until removal.
- [x] (2026-01-23) Update `config/env.example` with OpenCode HTTP transport env vars.
- [x] (2026-01-23) Add/extend a gated live verification script for HTTP transport (`bun scripts/verify-executors-live.ts --opencode-http`).
- [ ] Flip the default transport to HTTP (with a one-line rollback env switch).
- [ ] Remove ACP transport code only after sustained green runs and with explicit deletion approval.

## Surprises & Discoveries

- Observation: `packages/agent/src/orchestrator/tool/opencode/definition.ts` includes `env`, but `packages/agent/src/orchestrator/tool/opencode/exec.ts` never reads `input.env`.
  Evidence: no `input.env` references in `exec.ts`.
- Observation: MCP servers are only passed through in the server-profile path today; the default-profile fallback path still hardcodes `mcpServers: []`.
  Evidence: `executeWithOpenCode` server-profile `runPrompt` uses `input.mcpServers ?? []`, but `execOnce()` uses `mcpServers: []`.
- Observation: Several docs are stale and claim OpenCode ACP filesystem operations are stubbed, but they are implemented.
  Evidence: `docs/reports/executor-audit-codex-opencode.md` and `docs/execplans/executor-acp-parity.md` vs `packages/agent/src/orchestrator/tool/opencode/exec.ts`.

## Decision Log

- Decision: Implement HTTP transport using an in-container OpenCode server accessed via a custom SDK `fetch` that proxies requests with `docker exec ... curl`.
  Rationale: AgentFS containers do not publish ports by default, and we must keep file/shell actions inside the AgentFS copy-on-write workspace; this approach avoids AgentFS runtime changes and avoids exposing OpenCode on the host network.
  Date/Author: 2026-01-23 / assistant

- Decision: Treat `execProfile` as process lifecycle only (default vs server) and add a separate `transport` concept (acp vs http).
  Rationale: `execProfile` is already part of ALFRED’s executor standardization and is reused by Codex; transport is an implementation detail that must be switchable during rollout.
  Date/Author: 2026-01-23 / assistant

- Decision: Preserve ALFRED `sessionId` input by maintaining an internal mapping from ALFRED session key → OpenCode server session id for the lifetime of a server handle.
  Rationale: OpenCode HTTP sessions are server-assigned IDs; ALFRED’s deterministic `AgentSpec.sessionId` must still provide continuity across prompts in server mode.
  Date/Author: 2026-01-23 / assistant

## Outcomes & Retrospective

- TBD (fill during implementation).

## Context and Orientation

### Current OpenCode executor entrypoints (ACP stdio)

Primary code:

- `packages/agent/src/orchestrator/tool/opencode/index.ts`: tool entrypoint; calls policy enforcement and execution.
- `packages/agent/src/orchestrator/tool/opencode/definition.ts`: Zod input/output schemas.
- `packages/agent/src/orchestrator/tool/opencode/policy.ts`: calls `requireToolScopesAndPolicy` for `droid.exec`.
- `packages/agent/src/orchestrator/tool/opencode/exec.ts`: ACP stdio implementation (server + default profiles).

Callers:

- `packages/runtime/src/orchestrator/agent.ts`: runtime dispatch for `agentType === "opencode"`.
- `packages/agent/src/orchestrator/loops/ralph.ts`: loop integration.
- `scripts/verify-executors-live.ts`: live verification script.
- `packages/agent/test/opencode-zen.integration.test.ts`: gated integration test.

Executor lifecycle:

- `packages/agent/src/orchestrator/tool/shared/server.ts`: shared server registry (`ensureServer`, `stopAllServers`, `resolveExecProfile`).
- `packages/runtime/src/orchestrator/index.ts`: stops all executor servers in `finally`.

### Relevant concepts and terms

ACP (Agent Client Protocol): a stdio protocol ALFRED currently uses to communicate with OpenCode via `ClientSideConnection`.

OpenCode HTTP server: a long-lived HTTP+SSE server started via `opencode serve` exposing endpoints like `/session`, `/event`, `/session/:id/prompt_async`.

Writer events: ALFRED executors stream progress back to the runtime via `writer.write({ type: "stdout" | "stderr" | "notice", ... })` (plus embedded `data` payloads like `output`, `command`, `artifact`).

AgentFS: ALFRED’s required execution environment; agents run inside a Docker container with a copy-on-write workspace mounted at `/workspace`.

MCP (Model Context Protocol): ALFRED runs an MCP server during workflows; executors pass it into agents so the agent can call tools like `runtime.escalate`.

## Plan of Work

### Milestone 1: Add HTTP transport switch (no behavior change by default)

Goal: Introduce a transport selector so we can run ACP and HTTP in parallel, with ACP remaining the default until parity is proven.

Edits:

1. In `packages/agent/src/orchestrator/tool/opencode/definition.ts`:
   - Add an optional `transport` field:
     - Type: `"acp" | "http"`
     - Default: `"acp"` initially.
     - Description: selects the OpenCode integration transport.

   - Add optional HTTP server connection fields (minimal surface):
     - `baseUrl?: string` (only used for non-container / external server debugging).
     - `username?: string`, `password?: string` (HTTP basic auth for external server mode).

   Keep all existing fields unchanged so existing callers compile.

2. In `packages/agent/src/orchestrator/tool/opencode/index.ts`:
   - Route execution based on `input.transport`.
   - Keep the existing policy call before the route.

3. In `packages/runtime/src/orchestrator/agent.ts`:
   - Do not change call sites initially (transport defaults to ACP).
   - Add a single env override hook to force transport for all OpenCode runs (for rollout):
     - `ORCH_OPENCODE_TRANSPORT=http|acp`

Acceptance:

- Typecheck passes with no functional behavior changes when env var is unset.

### Milestone 2: Add OpenCode HTTP server lifecycle (AgentFS container)

Goal: Create a server manager for starting/stopping OpenCode’s HTTP server inside the AgentFS container, compatible with ALFRED’s shared server registry and `execProfile` semantics.

New code (suggested file layout):

- `packages/agent/src/orchestrator/tool/opencode/http.ts`: HTTP transport executor implementation (prompt + SSE mapping).
- `packages/agent/src/orchestrator/tool/opencode/server.ts`: OpenCode HTTP server lifecycle helpers (start/stop/health; create SDK client).
- `packages/agent/src/orchestrator/tool/opencode/fetch.ts`: container-proxy `fetch` implementation used by the SDK.

Server profile semantics to preserve:

- `execProfile=server` means: one long-lived OpenCode server per `(containerName, executor="opencode", profile="server")`.
- The server is started lazily and reused for subsequent prompts.
- If the server crashes or becomes unhealthy, restart it and continue.
- On workflow completion, `stopAllServers("workflow_complete")` stops it.

Implementation notes (Option A topology):

1. Start server inside container:
   - Command: `opencode serve --hostname 127.0.0.1 --port 4096` (port configurable).
   - Use `docker exec` with `-w <containerCw>` so the server project root is `/workspace`.
   - Pass through the existing OpenCode env allowlist plus server auth env vars (see below).

2. Health check:
   - Poll `GET /global/health` via the SDK client until HTTP 200 or timeout.
   - If health never becomes OK, stop/dispose and throw `opencode_server_start_failed`.

3. Stop server:
   - Prefer `POST /instance/dispose` via SDK.
   - Fallback: `docker exec <container> pkill -f "opencode serve"` if dispose fails.

4. Auth (basic auth) support:
   - If `OPENCODE_SERVER_PASSWORD` is set, OpenCode requires basic auth.
   - For in-container-only mode, still generate a random password and set it to ensure we can safely enable port publishing later.
   - Store credentials only in memory in the server handle.

5. Env allowlist updates:
   - Extend the container env allowlist in `packages/agent/src/orchestrator/tool/opencode/exec.ts` (or the new `server.ts`) to include:
     - `OPENCODE_SERVER_USERNAME`
     - `OPENCODE_SERVER_PASSWORD`

Acceptance:

- A unit test can start a fake server handle (mocked) and `ensureServer` caches it.
- `stopAllServers` calls the handle stop method and does not leak.

### Milestone 3: Implement HTTP prompt execution with streaming parity

Goal: Replace the ACP session-update streaming with OpenCode’s SSE event stream (`/event`) and emit equivalent ALFRED writer events.

Core flow per prompt:

1. Resolve profile: `resolveExecProfile(input.execProfile, input.containerName)`.

2. Acquire a server + SDK client:
   - `server` profile: use `ensureServer` to get a long-lived server handle.
   - `default` profile: start a disposable server for this prompt and dispose it after.

3. Determine session:
   - If `input.sessionId` exists:
     - Look up `alfredSessionId -> opencodeSessionId` in the server handle map.
     - If missing, create an OpenCode session (`POST /session`) and record mapping.

   - If `input.sessionId` is absent:
     - Create a one-off OpenCode session for this prompt and do not store mapping.

4. Register MCP servers (see Milestone 5) before prompting.

5. Start SSE subscription:
   - Call `client.event.subscribe()` and consume events as an async iterator.
   - Use an `AbortController` linked to the tool `signal` and to `timeoutSec`.

6. Fire prompt:
   - Use `client.session.promptAsync({ path: { id: sessionId }, body: { messageID, parts: [{ type: "text", text: input.prompt }], model? } })`.
   - Set `messageID` to a deterministic value for filtering events (e.g. `${input.sessionId}:${Date.now()}`; any collision-safe scheme is acceptable).
   - If `input.model` is present and is of the form `<provider>/<model>`, map to `{ providerID, modelID }`.

7. Stream events and map to ALFRED writer events until completion:
   - Stop condition: receive `session.idle` for this session id after the prompt was accepted.
   - Error condition: receive `session.error` for this session id; throw.
   - Abort condition: `signal` aborts or timeout triggers; call `POST /session/:id/abort` and throw `opencode_prompt_aborted` or `opencode_prompt_timeout`.

Event mapping (minimum parity target):

- `message.part.updated`:
  - For `TextPart` deltas: emit `writer.write({ type: "stdout", data: { type: "output", content: <delta> }, ... })`.
  - For `ReasoningPart` deltas: emit `writer.write({ type: "stdout", data: { type: "thought", content: <delta> }, ... })` (or keep as notice if ALFRED expects).
  - For `ToolPart`: emit `writer.write({ type: "stdout", data: { type: "command", content: <summary> } })` and capture tool errors into stderr.

- `file.edited`:
  - Emit an `artifact` event and add `{ path, kind: "file" }` to `artifacts`.

- `todo.updated`:
  - Emit a `notice` event carrying a normalized plan structure (match existing `opencode_plan` notice format).

- `permission.updated`:
  - If `input.auto` is `"medium" | "high"`: auto-approve once or always (match current ACP behavior which allows).
  - If `input.auto` is `"read" | "low"`: auto-deny.
  - Always log/emit a command-style writer event so the runtime transcript shows permission decisions.

Output extraction:

- Accumulate emitted text deltas into `result`.
- At completion, optionally fetch the final assistant message (`GET /session/:id/message/:messageID`) to validate consistency.

Acceptance:

- Existing OpenCode tests can assert that streamed output arrives incrementally and that abort/timeout stop streaming.
- `artifacts` contains edited file paths when edits occur.

### Milestone 4: Abort/timeout propagation parity

Goal: Preserve the cancellation behavior tested today.

Implementation requirements:

- `AbortSignal` must terminate the SSE subscription and trigger OpenCode session abort.
- `timeoutSec` must abort OpenCode session and return a deterministic error (`opencode_prompt_timeout`).
- Server-profile crash recovery must still work:
  - If the OpenCode server becomes unhealthy, restart and retry the prompt once (same as current strict/fallback semantics).

Acceptance:

- Port the existing `exec.test.ts` abort test to the HTTP transport.

### Milestone 5: MCP server wiring parity

Goal: Ensure `input.mcpServers` is honored in HTTP transport and that runtime MCP tools remain reachable from OpenCode.

Implementation:

1. Convert ALFRED’s `mcpServers` shape to OpenCode’s `/mcp` config shape:
   - ALFRED: `{ name, url, headers: Array<{ name, value }> }`
   - OpenCode: `{ name, type: "remote", url, headers: Record<string, string> }` (SDK types: `McpRemoteConfig`).

2. Before prompt, call `client.mcp.add` (POST `/mcp`) for each server.

3. Avoid repeated adds:
   - Track installed MCP server names in the server handle state.
   - If headers/token change, re-add to update.

Acceptance:

- Add a unit test proving that when `input.mcpServers` is provided, `client.mcp.add` is called with expected header mapping.

### Milestone 6: Filesystem safety and secret protection

Goal: Ensure OpenCode cannot read or write outside intended boundaries and does not exfiltrate `.env` secrets by default.

Baseline safety (already provided by topology):

- Because OpenCode server runs in the AgentFS container, its file and shell actions occur in the container’s `/workspace` copy-on-write view.

Optional but recommended guardrails:

1. Add an OpenCode plugin that denies reads of `.env`, `.env.*`, and other secret files.
   - Preferred location: generated per-run config directory inside AgentFS mount (`/agentfs/opencode-config/<runId>/plugins/alfred.ts`) to avoid touching the repo.
   - Set `OPENCODE_CONFIG_DIR` for the server process to that directory.
   - Plugin approach: in `tool.execute.before`, if tool is a file-read tool and path matches protected patterns, throw.

2. Consider also denying `bash` tool use when `auto=read|low` by auto-denying `permission.updated`.

Acceptance:

- A unit test shows the plugin rejects `.env` read attempts.
- A live verify run cannot read `.env` even if the model asks.

### Milestone 7: Tests, rollout, and cleanup

#### Test updates (must preserve/extend existing files)

Update these existing tests to cover HTTP transport, keeping ACP coverage until removal:

- `packages/agent/src/orchestrator/tool/opencode/exec.test.ts`
  - Parameterize key cases across `transport=acp` and `transport=http` (or duplicate cases for HTTP).
  - Preserve assertions: server reuse, restart on crash/unhealthy, abort propagation, env allowlist behavior.

- `packages/agent/src/orchestrator/tool/opencode/acp.test.ts`
  - Keep ACP-specific assertions while ACP exists.
  - Add parallel HTTP parity assertions either in this file (recommended: split into sections) or add a new `http.test.ts` while keeping this file.

- `packages/agent/test/opencode-zen.integration.test.ts`
  - Add a new gated test case that runs HTTP transport against a real OpenCode server in AgentFS.

#### Live verification

Extend `scripts/verify-executors-live.ts`:

- Add a new mode `--opencode-http` that:
  - Starts an AgentFS workspace
  - Runs `toolOpenCode.execute` with `transport=http` and `execProfile=server`
  - Prints streamed output
  - Verifies at least one artifact is produced (optional)

#### Rollout plan

Phase 1 (ship both):

- Default: ACP.
- Opt-in: HTTP via `ORCH_OPENCODE_TRANSPORT=http`.

Phase 2 (canary):

- Default: HTTP for local dev + internal workflows.
- Keep a one-line rollback: set `ORCH_OPENCODE_TRANSPORT=acp`.

Phase 3 (flip default):

- Default: HTTP.
- ACP still supported behind explicit override for one release window.

Phase 4 (remove ACP):

- Remove ACP-only code paths and dependencies.
- This is a destructive change and requires explicit deletion approval in-session before removing files.

#### Doc fix checklist (identify stale docs; update separately)

Do not update docs as part of the code migration unless explicitly requested, but track required fixes:

- `docs/guides/opencode-sdk-integration.md`: stale command (`opencode server`), stale schema suggestions (`transport`/`baseUrl`), and incorrect assumptions about current filesystem ops.
- `docs/reports/executor-audit-codex-opencode.md`: stale assertions about Codex duplicate entrypoint and OpenCode ACP stubs.
- `docs/execplans/executor-acp-parity.md`: contains outdated “stubs filesystem calls” statement.
- `docs/execplans/runtime-mcp-server.md`: OpenCode MCP wiring description no longer matches current code (default profile still hardcodes empty MCP list).

## Concrete Steps

All commands run from repo root (`/Users/jackmazac/Development/alfred`) unless otherwise noted.

1. Add dependency:
   - In `packages/agent/`:
     - `bun add @opencode-ai/sdk`

2. Document new env toggles:
   - Update `config/env.example` to include:
     - `ORCH_OPENCODE_TRANSPORT` (values: `acp|http`)
     - Optional: `OPENCODE_SERVER_BASE_URL`, `OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD` (external-server mode)

3. Implement transport switch + HTTP modules (files listed above).

4. Run validators:
   - `bun run typecheck`
   - `bun test packages/agent/src/orchestrator/tool/opencode/exec.test.ts packages/agent/src/orchestrator/tool/opencode/acp.test.ts`
   - `bun run test -- packages/agent/test/opencode-zen.integration.test.ts` (only if its gating env is enabled).

5. Run the live verify script (opt-in):
   - `ORCH_OPENCODE_TRANSPORT=http bun scripts/verify-executors-live.ts --opencode-http`

Expected proof transcript (example):

- Output includes streamed text chunks (not a single final blob).
- No hanging processes after completion (`docker ps` shows no extra containers; `stopAllServers` cleans up).

## Validation and Acceptance

Acceptance is:

1. With `ORCH_OPENCODE_TRANSPORT=http`, OpenCode execution succeeds in AgentFS and streams output to the ALFRED writer.
2. `execProfile=server` reuses a long-lived OpenCode server per container and survives a simulated crash/unhealthy restart.
3. `AbortSignal` and `timeoutSec` propagate to OpenCode (session abort) and stop SSE streaming deterministically.
4. `mcpServers` are registered and OpenCode can call runtime MCP tools when configured.
5. The existing OpenCode test files listed above still exist and are extended to cover HTTP transport.
6. There is a single rollback switch to restore ACP transport without code changes.

## Idempotence and Recovery

- Starting the server is idempotent: if `GET /global/health` is already healthy in the container, reuse instead of starting a second server.
- If server start fails, stop/clean up and fall back to `execProfile=default` unless strict mode is enabled (match current behavior).
- If port collisions occur (unexpected), switch to a per-container random port stored in the server handle; this does not affect the external interface (Option A).

## Interfaces and Dependencies

New dependencies:

- `@opencode-ai/sdk` (TypeScript OpenAPI client + SSE support).

Key APIs to use (SDK):

- `createOpencodeClient({ baseUrl, fetch, throwOnError })`
- `client.global.health()`
- `client.event.subscribe()` (SSE)
- `client.session.create()` / `client.session.promptAsync()` / `client.session.abort()`
- `client.mcp.add()`
- `client.instance.dispose()`

Key ALFRED interfaces to preserve:

- `packages/agent/src/orchestrator/tool/opencode/index.ts` tool signature and schemas.
- `packages/agent/src/orchestrator/tool/shared/server.ts` server registry contract.
- Writer event contract used by `packages/runtime/src/orchestrator/agent.ts`.
