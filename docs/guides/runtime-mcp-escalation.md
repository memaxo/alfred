# Runtime MCP Escalation

Deterministic agent escalation via a minimal, per-run MCP server (`/mcp`) started by the runtime orchestrator.

## What this is

When an agent discovers a blocker it cannot resolve (missing dependency, wrong architecture, permission denied, external service down, etc.), it should **escalate** instead of guessing.

With Runtime MCP escalation:

- The agent calls exactly **one tool**.
- The tool call returns an immediate **receipt** (ack).
- The orchestrator then aborts the agent session and surfaces the escalation.

This avoids prompt-only “write a file” escalation paths and keeps the tool surface tiny (no duplicated filesystem/shell/git tools).

## Tool names (per executor)

The runtime MCP server publishes a single MCP tool named `escalate`, but executors prefix it differently:

- **Codex**: `mcp__alfred_runtime__escalate`
- **OpenCode (ACP)**: `alfred_runtime_escalate`
- **Droid**: `mcp__alfred_runtime__escalate`

Agents must call the tool name their executor exposes.

## Escalation input

The tool expects:

- **reason**: `missing_dependency` | `wrong_architecture` | `permission_denied` | `resource_exhausted` | `external_service_unavailable` | `conflicting_requirements` | `other`
- **details**: required string (10–2000 chars)
- **severity**: `warning` | `blocking` (default: `blocking`)
- **suggestions**: optional string[] (max 5)

## Receipt output

The tool returns a JSON receipt (as text) shaped like:

- **ok**: `true`
- **receiptId**: string
- **receivedAt**: unix ms
- **action**: `"abort"`
- **message**: short text

If `ok: true`, the agent should stop immediately (the orchestrator is aborting the session).

## Debugging with curl (Streamable HTTP MCP)

Streamable HTTP MCP uses an MCP session header. First call creates a session; subsequent calls reuse it.

1. List tools (captures the `mcp-session-id` response header):

```bash
curl -i \
  -H "authorization: Bearer <TOKEN>" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  http://127.0.0.1:<PORT>/mcp
```

2. Call `escalate` using the session id:

```bash
curl -i \
  -H "authorization: Bearer <TOKEN>" \
  -H "mcp-session-id: <MCP_SESSION_ID>" \
  -H "content-type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"escalate",
      "arguments":{
        "reason":"missing_dependency",
        "details":"Need X installed to proceed. Verified it is not on PATH.",
        "severity":"blocking",
        "suggestions":["Install X","Provide PATH to X"]
      }
    }
  }' \
  http://127.0.0.1:<PORT>/mcp
```

## Runtime configuration knobs

Runtime orchestrator environment variables:

- **ORCH_MCP_BIND_HOST**: bind address for the MCP HTTP server (default: `0.0.0.0`)
- **ORCH_MCP_PORT**: port (default: `0`, random free port)
- **ORCH_MCP_HOST**: host name used by AgentFS containers to reach the server (default: `host.docker.internal`)
- **ORCH_MCP_ABORT_DELAY_MS**: delay (ms) between receipt and abort (default: `250`)
- **ALFRED_MCP_AUDIENCE**: JWT audience for MCP session tokens (default: `alfred:mcp`)
- **ALFRED_MCP_TOKEN_TTL_SEC**: TTL seconds for MCP session tokens (default: `900`)
