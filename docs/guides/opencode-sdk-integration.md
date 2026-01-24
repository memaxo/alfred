# OpenCode SDK Integration Guide

## Current Implementation

ALFRED currently integrates OpenCode via **ACP stdio** protocol:

- **Location**: `packages/agent/src/orchestrator/tool/opencode/exec.ts`
- **Approach**: Spawns `opencode acp` as a subprocess, communicates over stdio using JSON-RPC
- **Transport**: ACP protocol over stdio (standard input/output)
- **Execution profiles**: Supports both `default` (per-prompt) and `server` (long-lived) modes

### Current Architecture

```
ALFRED → spawn("opencode acp") → ACP stdio → OpenCode Agent
```

The implementation:

1. Spawns `opencode acp` command inside Docker containers (AgentFS)
2. Uses `ClientSideConnection` from `@alfred/protocol/acp` for protocol handling
3. Manages session lifecycle, file operations, and permission requests
4. Supports server profile for long-lived connections within the same container

## OpenCode SDK Approach

The [OpenCode SDK](https://opencode.ai/docs/sdk/) provides an HTTP-based client:

- **Package**: `@opencode-ai/sdk`
- **Transport**: HTTP/REST API
- **Use cases**: Long-lived servers, multi-process access, programmatic control

### SDK Architecture

```
ALFRED → createOpencodeClient() → HTTP → OpenCode Server
```

## When to Use Each Approach

### Use ACP stdio (current) when:

- ✅ Running inside Docker containers (AgentFS)
- ✅ Need process isolation per execution
- ✅ Want standard ACP protocol compliance
- ✅ Don't need to share sessions across processes
- ✅ Simpler deployment (no port management)

### Use SDK (HTTP) when:

- ✅ Need a long-lived server shared across multiple requests
- ✅ Want to connect from multiple processes/clients
- ✅ Prefer REST API semantics over stdio
- ✅ Need to manage OpenCode server lifecycle separately
- ✅ Building integrations outside Docker containers

## Adding SDK Support

To add SDK support alongside the existing stdio implementation:

### 1. Install SDK Dependency

```bash
cd packages/agent
bun add @opencode-ai/sdk
```

### 2. Add SDK Transport Option

Update `packages/agent/src/orchestrator/tool/opencode/definition.ts`:

```typescript
export const opencodeInputSchema = z.object({
  // ... existing fields ...
  transport: z
    .enum(["stdio", "http"])
    .default("stdio")
    .describe("Transport method: stdio (ACP) or http (SDK)"),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe("OpenCode server URL (required for http transport)"),
});
```

### 3. Create SDK Implementation

Create `packages/agent/src/orchestrator/tool/opencode/sdk-exec.ts`:

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk";
import type { ToolExecuteContext } from "../shared/context.js";
import type { OpenCodeToolInput, OpenCodeToolOutput } from "./definition.js";

export async function executeWithOpenCodeSDK({
  input,
  writer,
  signal,
}: ToolExecuteContext<OpenCodeToolInput>): Promise<OpenCodeToolOutput> {
  if (!input.baseUrl) {
    throw new Error("opencode_sdk_baseurl_required");
  }

  const client = createOpencodeClient({
    baseUrl: input.baseUrl,
    throwOnError: true,
  });

  // Create or reuse session
  let sessionId = input.sessionId;
  if (!sessionId) {
    const session = await client.session.create({
      body: {
        title: `ALFRED session ${Date.now()}`,
      },
    });
    sessionId = session.data.id;
  }

  // Send prompt
  const result = await client.session.prompt({
    path: { id: sessionId },
    body: {
      parts: [{ type: "text", text: input.prompt }],
      ...(input.model
        ? { model: { providerID: "anthropic", modelID: input.model } }
        : {}),
    },
  });

  // Extract artifacts from message parts
  const artifacts: Array<{ path: string; kind: string }> = [];
  if (result.data.parts) {
    for (const part of result.data.parts) {
      if (part.type === "file" && part.path) {
        artifacts.push({ path: part.path, kind: "file" });
      }
    }
  }

  // Extract text result
  const textParts = result.data.parts?.filter((p) => p.type === "text") || [];
  const resultText = textParts
    .map((p) => (p as { text?: string }).text || "")
    .join("\n");

  return {
    result: resultText,
    artifacts,
    stopReason: undefined,
  };
}
```

### 4. Update Main Executor

Update `packages/agent/src/orchestrator/tool/opencode/exec.ts`:

```typescript
export async function executeWithOpenCode({
  input,
  writer,
  signal,
}: ToolExecuteContext<OpenCodeToolInput>): Promise<OpenCodeToolOutput> {
  // Route to SDK if HTTP transport requested
  if (input.transport === "http") {
    const { executeWithOpenCodeSDK } = await import("./sdk-exec.js");
    return executeWithOpenCodeSDK({ input, writer, signal });
  }

  // Existing stdio implementation
  const profile = resolveExecProfile(input.execProfile, input.containerName);
  // ... rest of existing code ...
}
```

### 5. Start OpenCode Server (for SDK mode)

If using SDK mode, you need a running OpenCode server. Options:

**Option A: Start server via SDK**

```typescript
import { createOpencode } from "@opencode-ai/sdk";

const { client, server } = await createOpencode({
  port: 4096,
  config: {
    model: "anthropic/claude-3-5-sonnet-20241022",
  },
});

// Use client.baseUrl for input.baseUrl
// Call server.close() when done
```

**Option B: Start server separately**

```bash
opencode server --port 4096
```

Then connect via `createOpencodeClient({ baseUrl: "http://localhost:4096" })`.

## Migration Strategy

1. **Phase 1**: Add SDK support alongside stdio (feature flag)
2. **Phase 2**: Test SDK mode in non-critical workflows
3. **Phase 3**: Evaluate performance and reliability
4. **Phase 4**: Decide on default transport or keep both

## Considerations

### Container Environment

For AgentFS containers, stdio is simpler:

- No port forwarding needed
- Process isolation per execution
- Automatic cleanup on container exit

For SDK in containers:

- Need to expose ports or use Docker networking
- Server lifecycle management
- Potential port conflicts

### Performance

- **stdio**: Lower latency (no HTTP overhead), but process startup cost
- **SDK**: Higher latency (HTTP), but reusable connections

### Error Handling

- **stdio**: Process exit codes, stderr capture
- **SDK**: HTTP status codes, structured error responses

## Example Usage

### Current (stdio):

```typescript
await toolOpenCode.execute({
  input: {
    action: "exec",
    prompt: "Write a hello world function",
    containerName: "alfred-agentfs-123",
    execProfile: "server",
  },
});
```

### With SDK:

```typescript
// Start server first
const { client, server } = await createOpencode({ port: 4096 });

// Then use SDK transport
await toolOpenCode.execute({
  input: {
    action: "exec",
    prompt: "Write a hello world function",
    transport: "http",
    baseUrl: `http://localhost:${server.port}`,
    sessionId: "reuse-session-id", // Optional: reuse session
  },
});
```

## References

- [OpenCode SDK Documentation](https://opencode.ai/docs/sdk/)
- [ACP Protocol Specification](https://agentclientprotocol.com/)
- Current implementation: `packages/agent/src/orchestrator/tool/opencode/exec.ts`
