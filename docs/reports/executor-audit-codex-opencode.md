# executor-audit-codex-opencode

Purpose: Static audit of how consistently standardized ALFRED’s executor (“subagent”) interface is between **Codex** and **OpenCode**, whether each appears **runnable (static evidence only)**, and whether ALFRED is leveraging the major capabilities available in `vendor/codex` and `vendor/opencode`.

Scope: **ALFRED itself** (not apps ALFRED generates). Pure static analysis only.

## Executive Summary

- **High-level standardization exists**: `packages/runtime/src/orchestrator/agent.ts` dispatches by `AgentSpec.agentType` (`codex|droid|opencode`) and supports `execProfile` (`default|server`) with deterministic server fallback rules and strict-mode.
- **Executor server lifecycle is standardized** via a shared server registry keyed by `(containerName, executor, profile)` with deterministic cleanup on workflow completion (`stopAllServers("workflow_complete")`).
- **Major drift risk**: there are **two Codex tool entrypoints** (`packages/agent/src/orchestrator/tool/codex.ts` and `packages/agent/src/orchestrator/tool/codex/index.ts`) and `packages/agent/src/v6.ts` imports `./orchestrator/tool/codex` (which resolves to the legacy `codex.ts` file). This makes “Codex tool” behavior dependent on import site, and can silently drop newer features (server profile, output schema, AgentFS audit path, etc.).
- **OpenCode integration supports both ACP and HTTP**: ALFRED can run OpenCode over ACP stdio and (optionally) via the OpenCode HTTP server using `@opencode-ai/sdk` (`packages/agent/src/orchestrator/tool/opencode/http.ts`). Observability and event normalization gaps remain (thought/plan/diff → artifacts).
- **Executor management surface is missing**: there is no first-class, typed API for configuring, introspecting, and health-checking executors. See `docs/reports/executor-api-management.md` for the management-layer gap matrix and contract.

## What “Executor Interface” Means in ALFRED (today)

ALFRED’s executor interface is expressed through:

- **Runtime dispatch contract**: `AgentSpec.agentType` + `AgentSpec.profile` (execution profile) + container routing (`containerName`, `containerCw`) into executor tools.
- **Executor tool contract**: legacy tool objects with `{ name, description, inputSchema, outputSchema, execute }` registered in `packages/agent/src/v6.ts` and invoked by orchestration code.
- **Streaming/event contract**: tools emit events to a `writer.write(...)` sink using a shared-ish pattern (not formally typed across all executors).
- **Lifecycle contract**: server registry (`ensureServer`, `stopAllServers`) defines determinism and prevents container process leaks.

## Executor Interface Matrix (Codex vs OpenCode)

| Dimension                    | Codex (modern: `tool/codex/`)                                                                                                                                                     | OpenCode (`tool/opencode/`)                                                                                                              | Notes / Mismatches                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Primary dispatch**         | `packages/runtime/src/orchestrator/agent.ts` uses `toolCodex`                                                                                                                     | `packages/runtime/src/orchestrator/agent.ts` uses `toolOpenCode`                                                                         | Runtime dispatch treats both as peer executors.                                                                                                   |
| **Input schema**             | `execProfile`, `prompt`, `auto`, `cw`, `model`, `authz`, `timeoutSec`, `sessionId`, `userId`, `containerName`, `containerCw`, `agentfsDbPath`, `outputSchema`, `context`, `ralph` | `execProfile`, `prompt`, `auto`, `cw`, `model`, `authz`, `timeoutSec`, `env`, `sessionId`, `containerName`, `containerCw`, `cmd`, `args` | Codex supports structured `outputSchema`, session/user binding, and AgentFS audit path; OpenCode has command/args selection but no output schema. |
| **Policy gate**              | `requireToolScopesAndPolicy(authz, ["droid.exec"], …)` + elevation rules + session binding to `claims.sub`                                                                        | `requireToolScopesAndPolicy(authz, ["droid.exec"], …)`                                                                                   | Codex enforces elevation for `auto=medium                                                                                                         | high` and for long timeouts; OpenCode does not add executor-specific elevation checks beyond PDP. |
| **Execution profiles**       | `default` (spawn per prompt) + `server` (long-lived `codex app-server` inside AgentFS container) with fallback unless strict                                                      | `default` (spawn per prompt) + `server` (long-lived ACP stdio process inside AgentFS container) with fallback unless strict              | Standardized via `packages/agent/src/orchestrator/tool/shared/server.ts resolveExecProfile()` and executor-local fallbacks.                       |
| **Server container routing** | `docker exec -i --workdir <containerCw> <containerName> codex app-server`                                                                                                         | `docker exec -i -w <containerCw> <containerName> opencode …`                                                                             | Both require Docker on the host and AgentFS container name prefixing rules.                                                                       |
| **Writer event surface**     | Emits `stdout` events for `output`/`command`/`artifact`, `stderr`, and `notice`                                                                                                   | Emits `stdout` events for `output`/`command`, `stderr`, and `notice`                                                                     | OpenCode currently returns `artifacts: []` and does not emit artifact/file-change events in ALFRED.                                               |
| **Artifact detection**       | Codex server mode maps `fileChange` items into `{ path, kind }` artifacts                                                                                                         | OpenCode does not translate diffs/tool edits into artifacts (even though upstream can provide diffs)                                     | This affects `agentFileHints` and downstream merge/review heuristics.                                                                             |
| **Session continuity**       | Codex has explicit session persistence (`sessionId`, `userId`, thread resume checks; plus DB learning hooks)                                                                      | OpenCode passes `sessionId` through to ACP but no ALFRED-side persistence is evident                                                     | OpenCode continuity appears “best-effort via backend,” but ALFRED doesn’t persist or validate state similarly.                                    |

## Static Runnable State Assessment

### Codex (static evidence)

- **AgentFS image installs Codex**: `docker/agentfs/Dockerfile` builds `vendor/codex/codex-rs` and copies `/usr/local/bin/codex`.
- **Server profile uses `docker exec` into AgentFS container**: `packages/agent/src/orchestrator/tool/codex/server.ts` (requires host Docker + running AgentFS container).
- **Default mode can use host `codex`**:
  - `packages/agent/src/orchestrator/tool/codex/exec.ts` searches `CODEX_BIN`, `vendor/codex/target/...`, and `PATH`.
  - `scripts/verify-codex-live.ts` documents prerequisites for a real live run (informational evidence; not executed).

**Unknown / not statically provable**:

- Whether the pinned Codex binary built from `vendor/codex` matches the expectations of ALFRED’s app-server JSON-RPC client (protocol drift is possible without a pinned schema regeneration step).

### OpenCode (static evidence)

- **AgentFS image installs OpenCode**: `docker/agentfs/Dockerfile` downloads a pinned `OPENCODE_VERSION` release tarball and installs `/usr/local/bin/opencode`.
- **Server profile is container-only**: `packages/agent/src/orchestrator/tool/opencode/exec.ts` requires an AgentFS container name prefix (`alfred-agentfs-…`) and enforces `containerCw` under `/workspace`.
- **Default mode is host-spawned**: `packages/agent/src/orchestrator/tool/opencode/exec.ts` spawns `OPENCODE_ACP_CMD` (default `"opencode"`) with optional `OPENCODE_ACP_ARGS`.
- **Behavioral evidence exists via unit tests**: `packages/agent/src/orchestrator/tool/opencode/exec.test.ts` covers server profile constraints, reuse/restart, env allowlist, and abort propagation.

**Unknown / not statically provable**:

- Whether a developer environment actually has a compatible `opencode` binary in `PATH` for **default (host)** mode (ALFRED does not vend or build a host binary; only the AgentFS image is pinned/installed).

## Vendor Capability Inventory vs ALFRED Leverage

### `vendor/codex` (capabilities)

Notable modules present:

- **`codex-rs/app-server`**: JSON-RPC 2.0 over JSONL stdio, multi-turn threads, review start, thread listing, model list, config read/write, MCP server OAuth/login/status, etc. (`vendor/codex/codex-rs/app-server/README.md`)
- **`codex-rs/exec` / `exec-server`**: exec-mode and server-mode primitives.
- **`sdk/typescript`**: TypeScript bindings.
- **`mcp-server` + `shell-tool-mcp`**: MCP-related integrations.

ALFRED usage today (static evidence):

- **Uses Codex binary in AgentFS**: `docker/agentfs/Dockerfile`.
- **Implements a subset of app-server**: `packages/agent/src/orchestrator/tool/codex/server.ts` uses `initialize`, `thread/start`, `turn/start`, `turn/interrupt` and maps some notifications (`item/agentMessage/delta`, `commandExecution`, `fileChange`, etc.).
- **Uses Codex JSON event parsing** via `@alfred/codex` (wrapper around `@alfred/protocol`) for exec-mode streaming: `packages/codex/src/runner.ts`, `packages/codex/src/protocol.ts`.

Underutilized / not leveraged (likely high-value):

- **`review/start`** (Codex-side reviewer) is not surfaced via ALFRED’s Codex server client.
- **Thread history/listing** (`thread/list`, `thread/archive`) could power an ALFRED UI/ops surface but isn’t used.
- **MCP server status & OAuth endpoints** exist upstream; ALFRED is not currently using Codex’s built-in MCP server orchestration via app-server.

### `vendor/opencode` (capabilities)

Notable modules present:

- **ACP agent implementation**: `vendor/opencode/packages/opencode/src/acp/agent.ts` emits rich `sessionUpdate` events including:
  - `agent_message_chunk` (text deltas)
  - `agent_thought_chunk` (reasoning deltas)
  - `tool_call` + `tool_call_update` (with structured `content`, including diffs for edit-like tools)
  - `plan` (translates todo output to ACP plan entries)
- **MCP support**: ACP `initialize()` advertises MCP capabilities (`http`, `sse`), plus prompt capabilities like embedded context and image.
- **SDK + integrations**: additional packages (desktop/app/ui/sdk/plugins) not directly used by ALFRED.

ALFRED usage today (static evidence):

- **Does not consume vendor TypeScript SDK**; instead uses `@agentclientprotocol/sdk` via `@alfred/protocol/acp.ts`.
- **Runs OpenCode as an ACP stdio backend**: `packages/agent/src/orchestrator/tool/opencode/exec.ts` (host spawn or container spawn).
- **Consumes only a small subset of ACP events**:
  - Handles: `agent_message_chunk`, `tool_call`, `tool_call_update`
  - Does not handle: `agent_thought_chunk`, `plan`, and rich diff payloads.

Underutilized / not leveraged (likely high-value):

- **File system capabilities are stubbed**: ALFRED’s ACP client advertises `fs: { readTextFile: true, writeTextFile: true }` but implements:
  - `readTextFile → { content: "" }`
  - `writeTextFile → {}`
    This likely breaks OpenCode behaviors that rely on ACP filesystem APIs and may reduce agent quality.
- **Plan/thought streaming is dropped**: `agent_thought_chunk` and `plan` session updates emitted by OpenCode are ignored by ALFRED, losing valuable observability and progress structure.
- **Diff/artifact capture is missing**: OpenCode can send diffs in tool completion content; ALFRED does not translate those into `artifact` events or file hints.
- **MCP server wiring is unused**: ALFRED passes `mcpServers: []` in OpenCode ACP sessions and does not expose MCP configuration via ACP.

## Standardization Drift & Risks

### 1) Dual Codex tool entrypoints (likely highest risk)

- `packages/agent/src/orchestrator/tool/codex.ts` defines `toolCodex` with an older schema (no `execProfile`, no `containerCw`, no `agentfsDbPath`, no `outputSchema`) and uses `codex exec --json … --ask-for-approval …` style flags.
- `packages/agent/src/orchestrator/tool/codex/index.ts` defines a **different** `toolCodex` that supports `execProfile` (`server` via app-server), output schema validation, AgentFS audit integration, and richer session semantics.
- `packages/agent/src/v6.ts` imports `toolCodex` from `./orchestrator/tool/codex`, which resolves to the **file** `codex.ts` in standard module resolution (and not the folder `codex/index.ts`).

**Impact**:

- Call sites using `packages/runtime/...` and Ralph loop (`../tool/codex/index.js`) can behave differently than call sites using the AI SDK “tool registry” (`buildTools()` from `v6.ts`).
- This undermines “standardized subagent interface” because “Codex executor” is not a single, canonical implementation.

### 2) ACP capability mismatch for OpenCode

- **Status (updated)**: OpenCode ACP filesystem capabilities are implemented (read/write) with path allowlisting + container-aware resolution in `packages/agent/src/orchestrator/tool/opencode/exec.ts`. Remaining gaps are primarily event mapping and artifact capture rather than empty FS stubs.

### 3) Event normalization asymmetry

- Codex server mode explicitly maps file changes into artifacts; OpenCode does not.
- OpenCode produces tool call update details (including diffs) but ALFRED currently only turns them into “command” events.

## Recommendations (prioritized)

### P0 (correctness / standardization)

- **Make Codex tool canonical**:
  - Ensure `packages/agent/src/v6.ts` uses the same Codex tool implementation as `packages/runtime/src/orchestrator/agent.ts` (likely the folder-based `tool/codex/` with `execProfile`).
  - Remove module-resolution ambiguity by renaming one of `codex.ts` vs `codex/` (or at minimum, enforce explicit import paths everywhere).
  - Document the canonical entrypoint and update references consistently.

- **Fix ACP capability mismatch**:
  - Either implement `readTextFile`/`writeTextFile` for OpenCode ACP sessions (preferably backed by AgentFS workspace paths), or advertise `fs` capabilities as false/absent.

### P1 (observability / leverage)

- **Consume more OpenCode session updates**:
  - Map `agent_thought_chunk` → ALFRED “thought” events.
  - Map `plan` → ALFRED notices (or a structured progress event) so ExecPlan/status UIs can benefit.
  - Map `tool_call_update` with `diff` content → ALFRED artifacts/file hints (at least path-level).

- **Expose MCP servers to OpenCode when appropriate**:
  - Pass configured MCP servers into OpenCode ACP sessions instead of always `[]` (guarded by policy).

### P2 (feature leverage / parity)

- **Codex app-server “review/start”**:
  - Consider using upstream review mode for review phases (where it reduces custom logic).

- **OpenCode static verification script**:
  - Codex has `scripts/verify-codex-live.ts`; OpenCode has only unit tests. A similar “verify-opencode-live” script would improve operational certainty (still separate from this static audit).

## Appendix: Evidence Index (high-signal)

- `packages/runtime/src/orchestrator/agent.ts`: executor dispatch (`codex|droid|opencode`), execProfile defaults/fallback, writer mapping.
- `packages/agent/src/orchestrator/tool/shared/server.ts`: shared server registry, `resolveExecProfile()` (AgentFS default server), `stopAllServers()`.
- `packages/runtime/src/orchestrator/index.ts`: `stopAllServers("workflow_complete")` in `finally`.
- `packages/runtime/test/orchestrator.executor-cleanup.test.ts`: asserts cleanup on success/escalation/error paths.
- `packages/runtime/test/agentfs.test.ts`: asserts opencode dispatch, default execProfile=server in AgentFS, and fallback when server start fails.
- `packages/agent/src/orchestrator/tool/opencode/exec.ts`: ACP client implementation; event handling subset; filesystem stubs; container name/cwd enforcement.
- `packages/agent/src/orchestrator/tool/opencode/exec.test.ts`: server profile behavior (reuse, restart, abort, env allowlist) proven by tests.
- `packages/agent/src/v6.ts`: tool registry includes `toolCodex` and `toolOpenCode` (note Codex import ambiguity).
- `packages/agent/src/orchestrator/tool/codex.ts` vs `packages/agent/src/orchestrator/tool/codex/index.ts`: dual Codex tool implementations (drift).
- `docker/agentfs/Dockerfile`: pinned installation of `codex` and `opencode` into AgentFS image.
- `vendor/codex/codex-rs/app-server/README.md`: upstream app-server API surface (review, thread/list, MCP server oauth/status, etc.).
- `vendor/opencode/packages/opencode/src/acp/agent.ts`: upstream ACP event richness (plan/thought/tool diffs) vs ALFRED client subset.
