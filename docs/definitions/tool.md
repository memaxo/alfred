# Tool

A tool is a discrete capability exposed to agents. Tools have defined input and output schemas, execute functions, and metadata annotations. Tools are the verbs of ALFRED's vocabulary—the actions agents can take.

## Structure

Every tool has:

**name** — Unique identifier in snake_case. Examples: `rag_query`, `docker_exec`, `note_create`.

**description** — Human-readable explanation of what the tool does. This text is injected into agent prompts and should be concise but complete.

**inputSchema** — Zod schema validating tool inputs. Defines required and optional parameters with descriptions.

**outputSchema** — Zod schema typing tool outputs. Used for artifact persistence and type safety.

**annotations** — Metadata enabling ontology-aware behavior (see below).

**execute** — Async function that performs the action and returns typed output.

## Annotations

Tool annotations encode ontology metadata:

| Annotation | Type | Purpose |
|------------|------|---------|
| `category` | ToolCategory | Organization (knowledge, action, reflection, integration, system) |
| `readOnly` | boolean | True if tool has no side effects |
| `destructive` | boolean | True if tool could cause data loss |
| `idempotent` | boolean | True if same input always produces same output |
| `requiresApproval` | boolean | True if user confirmation needed |
| `outputFormat` | ToolOutputFormat | How to persist output (json, markdown, text, log) |
| `artifactPath` | string? | Where to persist output |
| `providesContext` | string? | Brief description of what context this tool provides |

Annotations drive:
- CATALOG.md generation (what agents read to discover tools)
- Artifact persistence (where outputs are written)
- Approval workflows (which tools need user confirmation)

## Categories

**knowledge** — Tools that query, extract, or connect information. Examples: `rag_query`, `knowledge_query`, `knowledge_extract`. Read-only, provide domain context.

**action** — Tools that perform operations with side effects. Examples: `docker_exec`, `git_commit`, `note_create`. May be destructive, often require approval.

**reflection** — Tools that observe and reason about current state. Examples: `cognitive_state`, `learning_pattern`. Read-only, provide environmental context.

**integration** — Tools that interface with external systems. Examples: MCP tools (`linear__create_issue`), `web_search`. Depend on external availability.

**system** — Tools that manage runtime and sessions. Examples: `runtime_status`, `session_create`, `router`. Infrastructure-level operations.

## Discovery

Agents discover tools by reading `CATALOG.md`. This file is generated from tool annotations and lists all tools with descriptions, categories, and capabilities.

The discovery flow:
1. Workspace initialization generates CATALOG.md
2. Agent reads CATALOG.md to understand available capabilities
3. Agent reasons about what tools to call based on task requirements
4. Agent calls tools, outputs persist as artifacts
5. Future agent iterations can read artifacts

This is organic discovery—agents reason about gaps, not hardcoded logic.

## Implementation

Tools are defined in:
- `packages/agent/src/orchestrator/tool/` — Orchestrator tools
- `packages/agent/assistant/src/tool/` — Assistant tools

Registration happens in `packages/agent/src/v6.ts`:
- Tools are collected into arrays
- Wrapped via `wrapLegacyToolToAISDK()` for AI SDK v6 compatibility
- Exported as `ToolMap` (Record<string, Tool>)

## Tool Definition Example

```typescript
export const toolRagQuery = {
  name: "rag_query",
  description: "Search documents using semantic similarity",
  inputSchema: ragQueryInputSchema,
  outputSchema: ragQueryOutputSchema,
  annotations: {
    category: "knowledge",
    readOnly: true,
    destructive: false,
    idempotent: true,
    requiresApproval: false,
    outputFormat: "json",
    artifactPath: ".agent/tools/rag/",
    providesContext: "Document search results",
  },
  execute: async ({ input }) => executeQuery(input),
};
```

## Related Concepts

- **entity** — The data objects tools operate on
- **artifact** — Persisted outputs from tool execution
- **ontology** — How tools relate to categories and domains
- **context** — What tools provide to agents
