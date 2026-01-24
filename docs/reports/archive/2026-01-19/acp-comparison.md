# Agent Client Protocol (ACP) vs ALFRED Agent Runner Analysis

## Status: SDK Integrated

**Last Updated:** December 2025  
**SDK Version:** @agentclientprotocol/sdk@0.12.0  
**Schema Version:** v0.10.4

ALFRED now integrates the official ACP TypeScript SDK. The `@alfred/protocol` package re-exports SDK types, connection classes, and protocol constants while maintaining backwards compatibility with existing ALFRED code.

### Quick Start

```typescript
// Use SDK types directly
import {
  AgentSideConnection,
  ClientSideConnection,
  PROTOCOL_VERSION,
  type SessionUpdate,
  type Plan,
} from "@alfred/protocol";

// Or use ALFRED adapters for autonomy mapping
import { mapAutonomyToAcpMode, mapAcpModeToAutonomy } from "@alfred/protocol";
```

---

## Executive Summary

The Agent Client Protocol (ACP) is an open standard designed to standardize communication between code editors (clients) and AI coding agents. ALFRED implements a different approach through direct subprocess execution with tool-specific protocol parsing. This report compares both approaches and identifies potential integration opportunities.

---

## ACP Overview

### What is ACP?

ACP is a JSON-RPC 2.0 based protocol that enables bidirectional communication between:

- **Clients**: Code editors/IDEs (e.g., Zed, Cursor, VS Code)
- **Agents**: AI coding tools (e.g., Gemini CLI, Codex CLI, Claude Code, Goose)

### Supported Agents (as of Dec 2025)

| Agent           | Vendor       | ACP Support     |
| --------------- | ------------ | --------------- |
| Gemini CLI      | Google       | Native          |
| Codex CLI       | OpenAI       | Via adapter     |
| Claude Code     | Anthropic    | Via Zed adapter |
| Augment Code    | Augment      | Native          |
| Goose           | Block        | Native          |
| OpenHands       | All Hands AI | Native          |
| JetBrains Junie | JetBrains    | Coming soon     |
| Kimi CLI        | Moonshot AI  | Native          |
| Mistral Vibe    | Mistral      | Native          |
| Qwen Code       | Alibaba      | Native          |

### Core Architecture

```
┌──────────────┐      JSON-RPC/stdio      ┌──────────────┐
│    Client    │ ◄─────────────────────► │    Agent     │
│  (IDE/Editor)│                          │  (AI Tool)   │
└──────────────┘                          └──────────────┘
       │                                         │
       │ Capabilities                            │ LLM API
       │ - fs.readTextFile                       │
       │ - fs.writeTextFile                      │
       │ - terminal/*                            │
       └─────────────────────────────────────────┘
```

### Protocol Flow

1. **Initialization**: Version negotiation + capability exchange
2. **Session Setup**: `session/new` or `session/load`
3. **Prompt Turn**: `session/prompt` → `session/update` notifications → response
4. **Tool Calls**: Permission requests, status updates, content streaming

### Key Features

| Feature               | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| **Session Modes**     | `ask`, `architect`, `code` - different approval/tool behaviors          |
| **Permission System** | `allow_once`, `allow_always`, `reject_once`, `reject_always`            |
| **Tool Call Types**   | `read`, `edit`, `delete`, `move`, `search`, `execute`, `think`, `fetch` |
| **Terminal Support**  | Create, output, wait, kill, release lifecycle                           |
| **MCP Integration**   | Supports MCP servers via stdio, HTTP, SSE                               |
| **Extensibility**     | `_meta` fields + custom methods prefixed with `_`                       |

---

## ALFRED's Current Implementation

### Architecture

ALFRED wraps coding agents as orchestrator tools that spawn subprocesses:

```
┌─────────────────────────────────────────────────────────────┐
│                     ALFRED Orchestrator                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ toolCodex   │    │ toolDroid   │    │  toolGit    │     │
│  │             │    │             │    │             │     │
│  │ Bun.spawn() │    │ Bun.spawn() │    │ Bun.spawn() │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│    codex exec         droid exec          git CLI          │
│    --json             --json                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Codex Tool Implementation (`packages/agent/src/orchestrator/tool/codex.ts`)

**Input Schema:**

```typescript
{
  action: "exec",
  prompt: string,
  out: "text" | "json" | "debug",
  auto: "read" | "low" | "medium" | "high",
  cw: string,          // working directory
  model: string,
  profile: string,
  authz: string,       // authorization token
  timeoutSec: number,
  env: Record<string, string>,
  sessionId: string,
  context: {
    linearIssueId, linearSessionId, linearSpace, linearAuthz,
    relevantFiles, confidence
  }
}
```

**Event Parsing:**

- `turn.started`, `turn.completed`, `turn.failed`
- `item.completed` with types: `reasoning`, `command_execution`, `agent_message`
- `error` events

**Key Features:**

- Policy enforcement via `requireToolScopesAndPolicy`
- Biometric elevation for medium/high autonomy
- Sandbox modes: `read-only`, `workspace-write`
- Reasoning trace persistence
- Output accumulation with byte limits (5 MiB)
- Timeout management (30 min default, 2 hr max)

### Droid Tool Implementation (`packages/agent/src/orchestrator/tool/droid.ts`)

**Similar to Codex but:**

- Uses `spawnWithSecureCwd()` with file descriptor handles (TOCTOU protection)
- Different env allowlist (`FACTORY_API_KEY`, `DROID_*`)
- No reasoning trace extraction (simpler output)

### Protocol Layer (`packages/codex/src/protocol.ts`)

ALFRED has a dedicated Zod-validated protocol layer for Codex events:

```typescript
// Thread Items
-ReasoningItem -
  AgentMessageItem -
  CommandExecutionItem -
  FileChangeItem -
  McpToolCallItem -
  WebSearchItem -
  TodoListItem -
  ErrorItem -
  // Thread Events
  thread.started -
  turn.started / turn.completed / turn.failed -
  item.started / item.updated / item.completed -
  error;
```

---

## Comparison Matrix

| Aspect                 | ACP                                                        | ALFRED                                            |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| **Communication**      | JSON-RPC 2.0 over stdio                                    | Subprocess spawn + NDJSON parsing                 |
| **Session Management** | Explicit sessions with IDs                                 | Implicit per-execution                            |
| **State Persistence**  | `session/load` capability                                  | None (stateless tool calls)                       |
| **Permission Model**   | Interactive prompts to client                              | Policy-based (`requireToolScopesAndPolicy`)       |
| **Autonomy Levels**    | Session modes (`ask`/`architect`/`code`)                   | `read`/`low`/`medium`/`high` with biometric gates |
| **Tool Reporting**     | Real-time `session/update` notifications                   | Streaming via `ToolWriter` interface              |
| **File Operations**    | Client-side (`fs/*` methods)                               | Agent-side (agent manages files)                  |
| **Terminal Support**   | Rich lifecycle (`create`/`output`/`wait`/`kill`/`release`) | Direct subprocess, stderr streaming               |
| **MCP Support**        | Built-in (client provides servers)                         | N/A                                               |
| **Extensibility**      | `_meta` fields, custom methods                             | Env allowlists, context objects                   |
| **Security**           | Client-controlled permissions                              | Server-side policy + biometric elevation          |

---

## Key Differences

### 1. Control Flow Direction

**ACP**: Agent → Client (agent requests capabilities)

```
Agent: "I need to write a file"
  → session/request_permission
Client: "User approved"
  → Agent executes
```

**ALFRED**: Orchestrator → Agent (orchestrator delegates)

```
Orchestrator: "Execute this prompt with these constraints"
  → Policy pre-check
  → Agent executes autonomously within sandbox
  → Results returned to orchestrator
```

### 2. Session Model

**ACP**: Long-lived sessions

- Create once, use for multiple prompts
- Can persist and reload (`session/load`)
- Modes can change mid-session

**ALFRED**: Transient executions

- Each tool call is independent
- No explicit session state between calls
- Autonomy level set per-call

### 3. Permission Handling

**ACP**: Interactive, user-facing

- Client presents approval dialogs
- User can allow always/once, reject always/once
- Agent waits for permission before proceeding

**ALFRED**: Pre-flight policy checks

- `requireToolScopesAndPolicy()` validates before spawn
- Biometric elevation for sensitive operations
- No mid-execution permission prompts

### 4. Output Streaming

**ACP**: Typed session updates

```json
{
  "method": "session/update",
  "params": {
    "sessionId": "...",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": { "type": "text", "text": "..." }
    }
  }
}
```

**ALFRED**: Tool writer interface

```typescript
writer?.write?.({ type: "stdout", text: "..." });
writer?.write?.({ type: "reasoning", text: "..." });
writer?.write?.({ type: "notice", message: "..." });
```

---

## Multi-Agent Support Analysis

### How ACP Supports Multiple Agents

1. **Standardized Interface**: Any agent implementing ACP works with any client
2. **Adapter Pattern**: Non-native agents (Codex, Claude) use adapters
3. **Capability Negotiation**: Agents declare what they support during `initialize`
4. **MCP Pass-through**: Clients can provide MCP servers to any agent

### How ALFRED Supports Multiple Agents

1. **Tool Abstraction**: Each agent is a tool with shared utilities
2. **Protocol Parsing**: Per-agent protocol schemas (`protocol.ts`)
3. **Shared Infrastructure**:
   - `assertAllowedDirectory()` - path validation
   - `createTimeout()` - execution limits
   - `streamStderr()` - output capture
   - `startToolTimer()` - metrics
4. **Policy Layer**: Unified auth/policy regardless of underlying agent

---

## Integration Opportunities

### Option 1: ALFRED as ACP Client

ALFRED could act as an ACP client, enabling:

- Support for any ACP-compatible agent
- Leverage ACP's session management
- Use ACP's permission system (with policy overlay)

**Challenges:**

- ACP assumes interactive client (IDE)
- Permission prompts would need automation via policy
- Session persistence adds complexity

### Option 2: ACP-Compatible ALFRED Agent

Expose ALFRED's orchestrator as an ACP agent:

- Zed/Cursor could use ALFRED as their agent
- ALFRED's policy system → ACP permission responses
- Linear integration as ACP tool calls

**Challenges:**

- ALFRED is designed as a personal assistant, not IDE tool
- Would require significant architectural changes

### Option 3: Protocol Translation Layer

Create an adapter that:

- Speaks ACP to upstream agents (Gemini CLI, etc.)
- Wraps in ALFRED's policy/auth layer
- Maintains ALFRED's tool abstraction

```
┌─────────────────┐
│ ALFRED Orch.    │
├─────────────────┤
│ ACP Adapter Tool│ ◄─── Policy enforcement
│                 │
│ ┌─────────────┐ │
│ │ ACP Client  │ │ ◄─── JSON-RPC over stdio
│ └──────┬──────┘ │
└────────┼────────┘
         ▼
    Any ACP Agent
```

---

## Recommendations

### Short-term (Low effort)

1. **Extract Protocol Schemas**: ALFRED's `protocol.ts` already handles Codex events. Formalize this into a reusable schema library.

2. **Add Agent Metadata**: Include agent version, capabilities in tool responses for observability.

3. **Implement Session Resumption**: For long-running tasks, allow resuming Codex sessions via `resumeThreadId`.

### Medium-term (Moderate effort)

4. **ACP Adapter Tool**: Create a `toolAcp` that can invoke any ACP-compatible agent:

   ```typescript
   toolAcp.execute({
     agent: "gemini-cli", // or any ACP agent
     prompt: "...",
     auto: "medium",
   });
   ```

5. **Unified Event Schema**: Align ALFRED's internal events with ACP's `session/update` format for consistency.

### Long-term (Significant effort)

6. **Full ACP Client Implementation**: Make ALFRED a first-class ACP client capable of using any ACP agent interchangeably.

7. **ACP Server Mode**: Expose ALFRED as an ACP agent for IDE integration.

---

## SDK Integration Details

### What's Integrated (December 2025)

**Package:** `@agentclientprotocol/sdk@0.12.0`

**Re-exported from `@alfred/protocol`:**

| Category               | Exports                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Connection Classes** | `AgentSideConnection`, `ClientSideConnection`, `TerminalHandle`, `RequestError`                   |
| **Protocol Constants** | `AGENT_METHODS`, `CLIENT_METHODS`, `PROTOCOL_VERSION` (v1)                                        |
| **Session Types**      | `SessionId`, `SessionInfo`, `SessionNotification`, `SessionUpdate`, `SessionCapabilities`         |
| **Content Types**      | `ContentBlock`, `ContentChunk`, `TextContent`, `ImageContent`, `AudioContent`, `EmbeddedResource` |
| **Tool Types**         | `ToolCall`, `ToolCallContent`, `ToolCallId`, `AcpToolKind`, `AcpToolCallStatus`, `ToolCallUpdate` |
| **Plan Types**         | `Plan`, `PlanEntry`, `PlanEntryPriority`, `PlanEntryStatus`                                       |
| **Terminal Types**     | `CreateTerminalRequest/Response`, `TerminalOutputRequest/Response`, etc.                          |
| **File System Types**  | `ReadTextFileRequest/Response`, `WriteTextFileRequest/Response`                                   |
| **MCP Types**          | `McpServer`, `McpServerStdio`, `McpServerHttp`, `McpServerSse`, `McpCapabilities`                 |

**ALFRED Adapters:**

```typescript
// Convert ALFRED autonomy to ACP mode
mapAutonomyToAcpMode("high"); // → { id: "code", name: "Code", ... }

// Convert ACP mode back to ALFRED autonomy
mapAcpModeToAutonomy("code"); // → "high"
```

**Legacy Schemas (Deprecated):**

The following are still exported for backwards compatibility but marked deprecated:

- `toolCallStatusSchema` → Use `AcpToolCallStatus`
- `toolKindSchema` → Use `AcpToolKind`
- `permissionOptionKindSchema` → Use `AcpPermissionOptionKind`
- `sessionModeSchema` → Use `AcpSessionMode`
- `stopReasonSchema` → Use `AcpStopReason`

### What's NOT Integrated

- **Zod Schemas**: The SDK generates Zod schemas but doesn't export them from the main entry. ALFRED's existing Zod schemas remain authoritative for validation.
- **JSON-RPC Transport**: The SDK provides `ndJsonStream` but ALFRED uses subprocess spawning with NDJSON parsing.
- **Interactive Permissions**: ACP's permission system is designed for IDE prompts; ALFRED uses policy-based pre-flight checks.

---

## Appendix: ACP vs ALFRED Event Mapping

| ACP Event                            | ALFRED Equivalent              |
| ------------------------------------ | ------------------------------ |
| `session/update.agent_message_chunk` | `{ type: "stdout", text }`     |
| `session/update.tool_call`           | Tool execution metrics         |
| `session/update.plan`                | ExecPlan system                |
| `session/request_permission`         | `requireToolScopesAndPolicy()` |
| `turn.started`                       | `startToolTimer()`             |
| `turn.completed`                     | Tool return value              |
| `turn.failed`                        | Thrown error                   |
| `terminal/create`                    | `Bun.spawn()`                  |
| `fs/write_text_file`                 | Agent manages directly         |

---

## References

- [ACP Documentation](https://agentclientprotocol.com/)
- [ACP GitHub](https://github.com/agentclientprotocol/agent-client-protocol)
- [ACP Schema](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/schema/schema.json)
- ALFRED Codex Tool: `packages/agent/src/orchestrator/tool/codex.ts`
- ALFRED Droid Tool: `packages/agent/src/orchestrator/tool/droid.ts`
- ALFRED Protocol: `packages/codex/src/protocol.ts`
