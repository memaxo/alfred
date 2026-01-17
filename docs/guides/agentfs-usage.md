# AgentFS Usage Guide

AgentFS is ALFRED's SQLite-based filesystem for agent execution. It provides audit trails, state management, and learning integration for all agent operations.

## Overview

AgentFS replaces the deprecated poof system with a portable, queryable solution:

| Feature | Poof (Deprecated) | AgentFS |
|---------|-------------------|---------|
| Platform | Linux only | Cross-platform |
| State Storage | overlayfs | SQLite |
| Audit Trail | File diffs | Structured DB |
| Learning | Manual extraction | Automatic |
| Checkpoint | File copy | DB snapshot |
| Query | Shell commands | SQL/API |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Docker Container (RO Isolation + CoW)              │
│  ┌───────────────────────────────────────────────┐  │
│  │  Agent Process (Codex CLI)                    │  │
│  │  └── /workspace (CoW view of host repo)       │  │
│  │      └── backed by AgentFS session DB         │  │
│  └───────────────────────────────────────────────┘  │
│  Volumes:                                           │
│    - /workspace.base ← host repo (READ-ONLY)        │
│    - /agentfs/agentfs.db ← session DB (READ-WRITE)  │
└─────────────────────────────────────────────────────┘
```

- **Docker** provides: process isolation, read-only host protection, FUSE mount capability.
- **AgentFS** provides: copy-on-write filesystem, audit trail, queryable state, diff/timeline APIs.

## Quick Start

### 1. Create a Workspace

```typescript
import { WorkspaceFactory } from "@alfred/agent/environment/factory";

const workspace = await WorkspaceFactory.create(
  "agentfs",        // workspace kind
  "my-agent",       // agent ID
  "run-123",        // run ID
  "/path/to/repo",  // repository path
  {
    agentfsOverlay: true,  // enable copy-on-write
  }
);

await workspace.initialize();
```

### 2. Use the Workspace

```typescript
// Record tool calls
await workspace.recordToolCall(
  "file_edit",
  Date.now() / 1000,
  Date.now() / 1000 + 0.5,
  { path: "/src/main.ts", action: "modify" },
  { linesChanged: 10 }
);

// Store context in KV
await workspace.setKV("agent:config", { model: "gpt-4" });
const config = await workspace.getKV("agent:config");

// Read/write files
await workspace.writeFile("/output/result.json", JSON.stringify(data));
const content = await workspace.readFile("/output/result.json");
```

### 3. Checkpoint and Restore

```typescript
// Create checkpoint before risky operation
await workspace.checkpoint("pre-refactor");

try {
  // Perform operation
  await riskyOperation();
} catch (error) {
  // Restore on failure
  await workspace.restore("pre-refactor");
}
```

### 4. Cleanup

```typescript
await workspace.cleanup();
```

## API Reference

### AgentFSWorkspace

The main workspace class implementing the `Workspace` interface.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `kind` | `"agentfs"` | Workspace type identifier |
| `root` | `string` | Absolute path to workspace root |
| `branch` | `string \| null` | Git branch (always null for agentfs) |
| `dbPath` | `string` | Path to SQLite database |
| `isOverlay` | `boolean` | Whether overlay mode is enabled |

#### Methods

##### `initialize(): Promise<void>`
Initialize the workspace and create the database.

##### `cleanup(): Promise<void>`
Close the database connection and clean up resources.

##### `checkpoint(label: string): Promise<void>`
Create a named checkpoint for later restoration.

##### `restore(label: string): Promise<void>`
Restore state from a named checkpoint.

##### `recordToolCall(name, startedAt, completedAt, params?, result?, error?): Promise<number>`
Record a tool invocation to the audit trail.

##### `getToolCalls(since?, limit?): Promise<ToolCall[]>`
Retrieve recent tool calls.

##### `diff(): Promise<Change[]>`
Get filesystem changes for this session.

##### `getToolStats(): Promise<ToolStats[]>`
Get aggregated tool usage statistics.

##### `setKV<T>(key: string, value: T): Promise<void>`
Store a value in the key-value store.

##### `getKV<T>(key: string): Promise<T | undefined>`
Retrieve a value from the key-value store.

##### `writeFile(path: string, content: string): Promise<void>`
Write content to a virtual file.

##### `readFile(path: string): Promise<string>`
Read content from a virtual file.

##### `readdir(path: string): Promise<string[]>`
List files in a directory.

### Wrapper Functions

```typescript
import {
  createEphemeralAgentFS,
  createRunAgentFS,
  isAgentFSAvailable,
} from "@alfred/agent/agentfs";

// In-memory database (testing)
const ephemeral = await createEphemeralAgentFS();

// Persistent database (production)
const persistent = await createRunAgentFS("run-123", "agent-1", "/workspace");

// Check SDK availability
const available = await isAgentFSAvailable();
```

## Learning Integration

AgentFS automatically captures data for the learning system.

### Extracting Patterns

```typescript
import { processForLearning } from "@alfred/agent/agentfs/learning-bridge";

const result = await processForLearning("/path/to/agent.db");
console.log(result.patterns);   // Tool usage patterns
console.log(result.mistakes);   // Failed operations
console.log(result.insights);   // Generated insights
```

### Pattern Structure

```typescript
interface ToolCallPattern {
  toolName: string;
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
  commonParameters: Record<string, unknown>;
  commonErrors: string[];
  timeRange: { earliest: number; latest: number };
}
```

## Policy Audit Integration

Record policy decisions to the audit trail:

```typescript
import { createPolicyAuditLogger } from "@alfred/agent/agentfs/policy-audit";

const logger = createPolicyAuditLogger(workspace.getAgent());

await logger.recordDecision({
  policyType: "file_access",
  resource: "/etc/passwd",
  action: "read",
  decision: "deny",
  reason: "Sensitive system file",
  matchedRule: "block_system_files",
});
```

## Metrics

AgentFS exports Prometheus metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `agentfs_executions_total` | Counter | Total workspace executions |
| `agentfs_tool_calls_total` | Counter | Tool calls by name/status |
| `agentfs_db_size_bytes` | Gauge | Database size |
| `agentfs_operation_latency_ms` | Histogram | Operation latency |
| `agentfs_active_workspaces` | Gauge | Currently open workspaces |
| `agentfs_checkpoints_total` | Counter | Checkpoint operations |
| `agentfs_kv_ops_total` | Counter | KV store operations |
| `agentfs_errors` | Counter | Error count by type |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTFS_DB_PATH` | `.agentfs/{runId}/{agentId}.db` | Database path |
| `ORCH_USE_AGENTFS` | `0` | Enable AgentFS in orchestrator |

### WorkspaceFactory Options

```typescript
const options = {
  agentfsOverlay: true,      // Enable copy-on-write overlay
  agentfsDbPath: "/custom/path.db",  // Custom database path
};
```

## Migration from Poof

If you have code using the deprecated poof system:

### Before (Poof)

```typescript
// Deprecated
const workspace = await WorkspaceFactory.create(
  "poof",
  agentId,
  runId,
  repoBase,
  { poofProfile: "standard" }
);
```

### After (AgentFS)

```typescript
// Current
const workspace = await WorkspaceFactory.create(
  "agentfs",
  agentId,
  runId,
  repoBase,
  { agentfsOverlay: true }
);
```

### Key Differences

1. **No Linux requirement**: AgentFS works on all platforms
2. **No FUSE mount**: Uses SQLite virtual filesystem
3. **No profile selection**: Single consistent behavior
4. **Queryable history**: Use SQL or API instead of file diffs
5. **Automatic learning**: Tool calls feed the learning system

## Troubleshooting

### Database Not Created

Ensure the parent directory exists and is writable:

```typescript
// AgentFS creates: .agentfs/{runId}/{agentId}.db
// Parent directories are created automatically
```

### SDK Not Available

Install the AgentFS SDK:

```bash
bun add agentfs-sdk
```

### Checkpoint Not Found

Checkpoints are stored alongside the database:
- Database: `.agentfs/run-123/agent-1.db`
- Checkpoint: `.agentfs/run-123/agent-1.db.checkpoint-v1`

### Tool Calls Not Recording

Ensure the workspace is initialized:

```typescript
await workspace.initialize();  // Required before recording
await workspace.recordToolCall(...);
```

## Testing

### Test Setup

AgentFS runs inside real Docker containers in tests. Mock the auth layer, not Docker:

```typescript
// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";
installAuthTokenMock();

import { describe, it, expect, afterEach } from "bun:test";
import { AgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import path from "node:path";
import { mkdirSync, rmSync } from "node:fs";
```

### Test Directory Location

Docker security validates paths against allowed prefixes (repo root). Use `.agent/test-workspaces/`:

```typescript
// ✅ Correct - under repo root
const REPO_ROOT = process.cwd();
const testDir = path.join(REPO_ROOT, ".agent", "test-workspaces", `test-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

// ❌ Wrong - os.tmpdir() is outside allowed paths
const testDir = mkdtempSync(path.join(os.tmpdir(), "test-"));  // Docker rejects this
```

### Complete Test Example

```typescript
import { installAuthTokenMock } from "@alfred/test-kit";
installAuthTokenMock();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const TEST_BASE = path.join(process.cwd(), ".agent", "test-workspaces");

describe("AgentFS", () => {
  let testDir: string;
  let workspace: AgentFSWorkspace;

  beforeEach(() => {
    const id = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    testDir = path.join(TEST_BASE, id);
    mkdirSync(testDir, { recursive: true });

    workspace = new AgentFSWorkspace("test-agent", "test-run", testDir);
  });

  afterEach(async () => {
    await workspace.cleanup();  // Removes Docker container
    rmSync(testDir, { recursive: true, force: true });
  });

  it("initializes with Docker container", async () => {
    await workspace.initialize();
    
    expect(workspace.containerId).toBeTruthy();
    expect(workspace.containerCw).toBe("/workspace");
  });
});
```

### Why Real Docker?

- Tests validate actual behavior, not mocks
- Container lifecycle issues caught early
- Volume mount paths tested correctly
- Resource limits apply in tests

### Test Timing

Docker operations add latency (~150-200ms per operation). Expected test durations:

| Operation | Typical Duration |
|-----------|------------------|
| `initialize()` (first) | 2-4 seconds |
| `initialize()` (reuse) | 150-200ms |
| `exec()` | 100-200ms |
| `cleanup()` | 100-200ms |

## Best Practices

1. **Always call cleanup**: Prevents database corruption and container leaks
2. **Use checkpoints before risky operations**: Enables rollback
3. **Record tool calls with timing**: Enables performance analysis
4. **Store context in KV**: Enables state reconstruction
5. **Let learning system process**: Don't delete databases immediately
6. **Use auth mocking in tests**: Real Docker, mocked auth tokens
