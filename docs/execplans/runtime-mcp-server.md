# runtime-mcp-server

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This repository defines ExecPlan requirements in `.agent/PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

ALFRED’s orchestrator currently relies on prompt compliance and best-effort streaming to detect “agent escalation” (an agent discovering an environment blocker and asking to stop + replan). That path is inherently nondeterministic: an executor may not follow prompt instructions, and the agent has no immediate “did my escalation succeed?” feedback.

After this change, any executor (Codex/OpenCode/Droid) will have access to a single, minimal, deterministic “runtime control plane” via MCP (Model Context Protocol). When an agent calls the runtime MCP tool `escalate`, it will receive an immediate structured receipt indicating success or failure. On success, the orchestrator will immediately abort the agent session so humans and UIs can react in real time.

The “path to success” must be extremely direct:

An agent hits a blocker → calls one tool (`escalate`) → receives an ack → stops.

The MCP tool surface must remain small to avoid context bloat, and we must not duplicate executor-native tools (filesystem, shell, git, browser, etc.).

## Progress

- [x] (2026-01-19) Drafted initial ExecPlan.
- [x] (2026-01-19) Defined the minimal Runtime MCP tool surface (MVP: `escalate` only).
- [x] (2026-01-19) Chosen MCP implementation approach for Bun (TypeScript SDK + Streamable HTTP + `node:http`).
- [x] (2026-01-19) Created new server-only package `packages/mcp` (`@alfred/mcp`) with a minimal MCP Streamable HTTP server and strict bearer auth.
- [x] (2026-01-19) Integrated `@alfred/mcp` into `packages/runtime/src/orchestrator/index.ts` (start per run, stop in finally).
- [x] (2026-01-19) Added per-agent session registration (token → { runId, agentId, abort() }) and per-agent abort controller wiring.
- [x] (2026-01-19) Wired OpenCode to include the runtime MCP server in `mcpServers` (ACP `McpServerHttp`) with bearer auth token.
- [x] (2026-01-19) Wired Codex to include the runtime MCP server via a per-agent `CODEX_HOME` config (Streamable HTTP + `enabled_tools = ["escalate"]`).
- [x] (2026-01-19) Droid integration: confirmed Droid supports MCP; configured per-agent `.factory/mcp.json` via isolated `HOME` and provided the same runtime MCP server + bearer token.
- [x] (2026-01-19) Ensured AgentFS containers can reach host runtime MCP server (Linux: add-host host.docker.internal:host-gateway).
- [x] (2026-01-19) Added tests proving: (a) tool call returns ack, (b) server invokes abort callback.
- [x] (2026-01-19) Updated prompts to mention only the single tool name and kept a short deprecated fallback note.
- [x] (2026-01-19) Added guide under `docs/guides/runtime-mcp-escalation.md` including curl transcript against `/mcp`.

## Surprises & Discoveries

- Observation: Droid supports MCP servers and stores config at `$HOME/.factory/mcp.json`; MCP tools follow `mcp__<server>__<tool>` naming.
  Evidence: `droid exec --help` (tool controls), vendor docs (`vendor/factory/docs/reference/hooks-reference.mdx`), and empirical config output.

## Decision Log

- Decision: Implement the Runtime MCP server as a new server-only package `@alfred/mcp`.
  Rationale: Centralizes deterministic orchestrator control-plane tools and avoids per-executor ad-hoc parsing.
  Date/Author: 2026-01-19 / assistant

- Decision: Keep the tool catalog intentionally tiny by default (MVP: one tool, `runtime.escalate`).
  Rationale: Tool catalogs (and their descriptions/schemas) are prompt context; keeping them tiny prevents executor context bloat and keeps agent behavior direct.
  Date/Author: 2026-01-19 / assistant

- Decision: Do not implement filesystem/shell/git/search/browser tools inside `@alfred/mcp`.
  Rationale: Executors already have native tools for these. Duplicating them creates confusion, splits policy/auditing semantics, and bloats prompts/tool lists.
  Date/Author: 2026-01-19 / assistant

- Decision: Use MCP over HTTP transport with bearer tokens per agent session.
  Rationale: HTTP transport is supported by ACP (`McpServerHttp`) and Codex streamable HTTP MCP servers; bearer tokens enable minimal tool arguments (no runId/agentId payload) while allowing strict server-side routing and authorization.
  Date/Author: 2026-01-19 / assistant

- Decision: Implement the runtime MCP server with the official TypeScript MCP SDK and Streamable HTTP server transport, running on Bun via `node:http`.
  Rationale: This keeps dependencies minimal, provides a deterministic tool-call ack path, and is compatible with OpenCode ACP’s `McpServerHttp` and Codex streamable HTTP MCP servers without introducing a web framework.
  Date/Author: 2026-01-19 / assistant

- Decision: For Droid, configure MCP servers per-agent via an isolated `HOME` directory containing `.factory/mcp.json` instead of mutating user/global config.
  Rationale: Keeps the runtime MCP server ephemeral per run, avoids tool/context bloat from accumulated servers, and does not pollute developer machines.
  Date/Author: 2026-01-19 / assistant

## Outcomes & Retrospective

- (fill in at milestone completion)

## Context and Orientation

### Terms (plain language)

MCP (Model Context Protocol) is a standard way for an agent to discover and call “tools” provided by external servers. MCP supports multiple “transports” (ways of connecting), including HTTP and stdio. A tool call returns a structured result; this gives us a deterministic “ack” channel.

An “executor” is the concrete agent runtime we run for subtasks (Codex, OpenCode, Droid). Executors already ship their own tools (like reading files, running commands, etc.). We must not duplicate those.

The “orchestrator” is ALFRED’s runtime code that plans work, spawns agents, streams their output, and decides what to do next. In this repo, that is primarily `packages/runtime/src/orchestrator/`.

AgentFSWorkspace is ALFRED’s Docker-based isolation system for agents. The repository is mounted into the container at `/workspace`. Host ↔ container connectivity must be explicit and reliable.

### MCP implementation choice (Bun + TypeScript)

We will implement the runtime MCP server using the official TypeScript MCP SDK:

- `@modelcontextprotocol/sdk`

We will serve it using the SDK’s Streamable HTTP server transport (the transport that supports `/mcp` over HTTP with MCP sessions), hosted by a small `node:http` server. Bun is compatible with `node:http` for this purpose.

We intentionally do not add a web framework (Hono/Express/etc.) for MVP. If we discover Bun incompatibilities with the Node-style transport, we will switch to a fetch-native transport via Hono, but only after recording that decision and evidence in `Surprises & Discoveries`.

### Networking (AgentFS containers must reach the host)

When agents run in AgentFS (Docker) containers, the executor process runs inside that container and must connect to the runtime MCP server over HTTP.

We standardize the “container URL” as:

- `http://host.docker.internal:<port>/mcp`

On Docker Desktop (macOS/Windows), `host.docker.internal` usually exists automatically. On Linux it does not unless we add it. Therefore we will ensure AgentFS containers are started with:

- `--add-host host.docker.internal:host-gateway`

The runtime MCP server must bind to an address reachable from containers (typically `0.0.0.0`) while still requiring a bearer token so it remains safe.

### Current state (why this is needed)

Right now, “escalation” is best-effort:

- The runtime builds an agent prompt that tells agents to write an `ESCALATION-{agentId}.md` file when blocked.
- The orchestrator reads that file after execution (late, non-real-time) and treats it as escalation.
- Separately, we have writer-stream interception of “escalate events”, but it is still prompt-dependent and not acked.

This is vulnerable to failure:

- Executors may not follow the instruction.
- The agent can’t tell whether escalation was received.
- The orchestrator only sees file escalation after the agent exits.

We already know OpenCode’s ACP supports MCP servers via `mcpServers` in its session configuration, and ACP defines `McpServerHttp` with `name`, `url`, and `headers`. We can use this to guarantee a tool call returns a tool result (success/failure).

Relevant files to orient yourself during implementation:

- `packages/runtime/src/orchestrator/index.ts`: main orchestrator entrypoint; ideal place to start/stop the runtime MCP server per run.
- `packages/runtime/src/orchestrator/agent.ts`: runs a single agent spec; ideal place to register a per-agent session token and to abort the agent upon escalation.
- `packages/agent/src/orchestrator/tool/opencode/exec.ts`: OpenCode ACP client; currently sets `mcpServers: []`.
- `packages/codex/src/runner.ts`: wraps `codex exec` CLI; MCP servers for Codex are configured via `CODEX_HOME/config.toml` (vendor Codex docs show `mcp_servers.<name>.url` and `bearer_token_env_var`).

## Plan of Work

This section is narrative-first: each milestone describes what will exist, what you run, and what you should observe.

### Milestone 1: Define the minimal Runtime MCP contract (no implementation yet)

At the end of this milestone, we have an explicit, written “runtime tool contract” and we will not add more tools until escalation is proven end-to-end.

Define the single MVP tool (single tool, single purpose):

`escalate`

Intent: an agent calls this once when blocked. If it returns `ok: true`, the agent must stop work immediately. If it returns an error, the agent must surface the error and stop (do not try to “keep going”).

Inputs (small and stable):

- `reason`: enum with a small set of values (missing_dependency, wrong_architecture, permission_denied, resource_exhausted, external_service_unavailable, conflicting_requirements, other)
- `details`: string (required, max ~2k chars)
- `severity`: enum (warning|blocking)
- `suggestions`: optional string array (max 5)

Context (not provided by tool args):

- `runId`, `agentId` come from the MCP bearer token (server-side session map).

Output (receipt):

- `ok: true`
- `receiptId: string`
- `receivedAt: number` (unix ms)
- `action: "abort"` (MVP hardcode; expand later)
- `message: string` (short; no long transcripts)

Errors:

- `401`/`403` for missing/invalid token
- `409` if the session is unknown (agent token not registered)
- `429` if repeated escalation spamming is detected (defensive)

### Milestone 2: Create `@alfred/mcp` package with a minimal MCP HTTP server

At the end of this milestone, we can start an HTTP MCP server that:

- Uses `@modelcontextprotocol/sdk` and the Streamable HTTP server transport.
- Implements MCP tool list/call for exactly one tool (`escalate`).
- Enforces bearer authentication.
- Returns a receipt for `escalate` tool calls.

Key constraint: do not add filesystem/shell/git/search tools. This package is only for orchestrator control-plane tools that executors do not already provide.

Repository work:

- Create `packages/mcp/` with `package.json`, `tsconfig.json`, `README.md`, `src/index.ts`, and `src/server.ts`.
- Add the package to root TypeScript project references (see existing packages for pattern).

Implementation shape (prescriptive):

In `packages/mcp/src/server.ts`, define:

  - `export type RuntimeMcpServerOptions = { bindHost: string; port: number; }`
  - `export type RuntimeMcpSession = { runId: string; agentId: string; abort: (reason: string) => void; }`
  - `export class RuntimeMcpServer {`
      - `start(): Promise<{ url: string }>`
      - `stop(): Promise<void>`
      - `registerSession(session: RuntimeMcpSession): { token: string }`
      - `unregisterToken(token: string): void`
    `}`

The server must store `token -> session` in memory and reject unknown tokens.

The server must call `session.abort(...)` when `runtime.escalate` is called, before returning `ok: true`. This is what makes the escalation deterministic: the receipt means the orchestrator has already been told to abort the agent.

### Milestone 3: Orchestrator integration (start server per run; issue per-agent tokens)

At the end of this milestone:

- `runOrchestrator` starts the Runtime MCP server at the beginning of a run and stops it in `finally`.
- Each agent execution registers a per-agent token and passes it into the executor environment/config.
- When an agent calls `runtime.escalate`, the server aborts that agent immediately.

Implementation approach:

- In `packages/runtime/src/orchestrator/index.ts`:
  - Start `RuntimeMcpServer` after `ctx` creation.
  - Store the server instance in a local variable and ensure `stop()` happens in the existing `finally` block (next to `stopAllServers` and workspace cleanup).

- In `packages/runtime/src/orchestrator/agent.ts`:
  - Create a per-agent `AbortController` (agent-local), wired so it aborts when either the parent `signal` aborts or MCP escalation triggers.
  - Register `{ runId, agentId, abort }` with the Runtime MCP server and get a bearer token.
  - Pass that token to executors (see next milestones).

### Milestone 4: OpenCode integration (ACP `mcpServers` + bearer header)

At the end of this milestone, OpenCode agents running via ACP can call the runtime MCP tool and get an immediate receipt.

Implementation:

- In `packages/agent/src/orchestrator/tool/opencode/definition.ts`, add optional input field `mcpServers?: McpServer[]`.
- In `packages/agent/src/orchestrator/tool/opencode/exec.ts`, use `input.mcpServers ?? []` instead of the hardcoded `mcpServers: []` when creating a new session.

Then, in `packages/runtime/src/orchestrator/agent.ts`, when calling `toolOpenCode.execute(...)`, pass (use container URL when `containerName` is present):

- `mcpServers: [{ name: "alfred_runtime", url: "<containerUrl>/mcp", headers: [{ name: "authorization", value: "Bearer <token>" }] }]`

Note: ACP schema requires `headers` to always be present (an array), even if empty.

### Milestone 5: Codex integration (per-agent `CODEX_HOME` config + bearer env var)

At the end of this milestone, Codex agents can call the runtime MCP tool and get an immediate receipt.

Codex loads MCP server config from `$CODEX_HOME/config.toml`. For orchestrated runs we must not mutate repo-level `.codex/config.toml` (that would be shared state and cause drift).

Implementation:

- In `packages/runtime/src/orchestrator/agent.ts`, create a per-agent CODEX_HOME directory that is visible inside AgentFS containers. Use the existing AgentFS host mount directory:
  - Host path: `<repo>/.agentfs/<runId>/codex-home/<agentId>/`
  - Container path: `/agentfs/codex-home/<agentId>/`
- Write `config.toml` into that directory with only one MCP server:

  - `[mcp_servers.alfred_runtime]`
    - `url = "<containerUrl>/mcp"`
    - `bearer_token_env_var = "MCP_AUTH_TOKEN"`
    - `startup_timeout_sec = 10`
    - `tool_timeout_sec = 30`
    - `enabled_tools = ["escalate"]`

- Set env vars for the Codex process:
  - `CODEX_HOME=<that directory>`
  - `MCP_AUTH_TOKEN=<token>`

This keeps Codex’s MCP tool list minimal (prevents context bloat) while making escalation deterministic.

### Milestone 6: Droid integration decision (no duplicated tools, still deterministic)

Goal: “any executor” includes Droid, but Droid’s MCP support is currently unknown.

Approach:

- Investigate whether Droid supports MCP servers natively (config file, env var, CLI flag).
- If Droid supports MCP over HTTP: mirror OpenCode and Codex integration.
- If Droid does not support MCP: implement a deterministic adapter that still provides immediate ack, without adding filesystem/shell/git duplication. Examples:
  - A minimal `droid`-native tool binding that calls the Runtime MCP HTTP endpoint directly with the bearer token and returns the receipt to the model.
  - If droid is not extensible, keep the old file fallback temporarily but require an “ack file” handshake: the agent writes a request file and waits for an orchestrator-written ack file before exiting. (This is strictly worse than MCP, so only do it if MCP is impossible.)

Record the outcome and decision in the Decision Log before implementing.

### Milestone 7: Tests + validation

At the end of this milestone we can prove, with tests and a small manual transcript, that escalation is deterministic.

Required tests:

- `packages/mcp/test/runtime.escalate.test.ts` (unit): calling `tools/call` with a valid token returns a receipt and invokes the registered abort callback exactly once.
- `packages/runtime/test/orchestrator/runtime-mcp-escalate.integration.test.ts` (integration, can be opt-in): start orchestrator + run a toy agent that calls `runtime.escalate`; assert:
  - agent is aborted quickly (bounded time)
  - orchestrator marks the run as escalated (not merely interrupted)

Manual validation (document in the plan when done):

- Start the orchestrator with AgentFS enabled.
- Use `curl` to call `tools/list` and `tools/call` against the Runtime MCP server `/mcp` endpoint with a token; show the receipt JSON.

## Concrete Steps

Use these commands while implementing. Update this section with short transcripts as you go.

From repo root:

  - Create package scaffold:
      bun --version
      mkdir -p packages/mcp/src
      (create package.json/tsconfig.json/README.md/src files following existing packages)

  - Run typecheck and tests:
      bun test packages/mcp
      bun test packages/runtime

  - Run a focused test:
      bun test packages/mcp/test/runtime.escalate.test.ts

## Validation and Acceptance

Acceptance is behavioral and observable:

1. When an agent calls `runtime.escalate`, it receives a structured receipt indicating success.
2. When the receipt indicates success, the orchestrator aborts the running agent session immediately (bounded time; no waiting for agent exit).
3. The orchestrator emits a pipeline event `agent:escalate-request` containing reason/details/severity, and the workflow transitions into an escalated/suspended state.
4. The default MCP tool catalog exposed to agents is minimal (MVP tool only) and does not include filesystem/shell/git duplicates.

## Idempotence and Recovery

Implementation steps must be safe to repeat:

- Starting/stopping the MCP server per run must not leak ports or keep background handles alive after completion.
- If a run is aborted, server shutdown must still happen in `finally`.
- Token registration/unregistration must be safe even if an agent crashes (use timeouts or `finally` cleanup).

If MCP connectivity fails (e.g. container cannot reach the host MCP URL), the tool call must fail fast with a clear error message so the agent can stop and surface diagnostics. Do not silently fall back to “best-effort” escalation without recording it.

## Artifacts and Notes

During implementation, paste short, indented evidence snippets here (no nested code fences), such as:

  - A `curl` transcript of `tools/list` and `tools/call`.
  - A log line showing the agent was aborted due to escalation.
  - The test output summary for the new tests.

- (2026-01-19) `bun test packages/mcp/test/escalate.test.ts` (pass)

## Interfaces and Dependencies

### New package: `@alfred/mcp` (server-only)

Dependencies (keep minimal):

- `@alfred/logger` for structured logs
- `@alfred/auth/token` for scope/policy checks (optional in MVP but required before widening tools)
- `@modelcontextprotocol/sdk` for MCP server + Streamable HTTP transport

Do not depend on `apps/*`. Avoid importing `@alfred/api` to prevent dependency cycles. Prefer `@alfred/type` for shared DTOs if needed.

### Integration packages

- `@alfred/runtime`: owns orchestrator lifecycle; starts/stops the MCP server and registers per-agent sessions.
- `@alfred/agent`: owns executor tool wrappers (OpenCode/Codex/Droid); must plumb `mcpServers` and env vars without expanding prompts.
- `@alfred/pipeline`: consumes emitted events; must remain thin. Do not move MCP server logic into pipeline.

