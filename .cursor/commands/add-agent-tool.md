# Add Agent Tool

## Overview
Add a new agent tool to the orchestrator following established patterns. This ensures consistency with existing tools like `rag_*`, `codex`, `ticket`, `web`.

## Prerequisites
- Clear understanding of what the tool should do
- Knowledge of which domain functions to wrap (e.g., from `@alfred/db`, `@alfred/rag`)

## File Structure Decision

### Simple Tool (single file)
Use when: straightforward execution, <10 schema fields, single execution path
```
packages/agent/src/orchestrator/tool/<name>.ts
```

### Complex Tool (folder)
Use when: >10 schema fields, multiple execution paths, elevation/biometric checks
```
packages/agent/src/orchestrator/tool/<name>/
├── definition.ts    # Zod input/output schemas
├── policy.ts        # Policy enforcement
├── exec.ts          # Execution logic
└── index.ts         # Tool exports
```

## Implementation Steps

### 1. Create Definition (definition.ts)
```typescript
import { z } from "zod";

export const <tool>InputSchema = z.object({
  // Required fields with .describe() for AI documentation
  field: z.string().min(1).describe("Purpose of this field"),
  // Always include authz for policy enforcement
  authz: z.string().optional().describe("Authorization token"),
});

export type <Tool>Input = z.infer<typeof <tool>InputSchema>;

export const <tool>OutputSchema = z.object({
  // Output fields
});
```

### 2. Create Policy (policy.ts)
```typescript
import { requireToolScopesAndPolicy } from "@alfred/auth/token";

export async function enforcePolicy(input: <Tool>Input) {
  // Validate input constraints FIRST
  if (/* invalid */) throw new Error("<tool>_validation_error");
  
  // Then enforce policy
  await requireToolScopesAndPolicy(input.authz, ["<domain>.read|write"], {
    action: "<domain>.<action>",
    resource: { kind: "<domain>", id: input.id },
  });
}
```

### 3. Create Execution (exec.ts)
```typescript
import { logger } from "@alfred/logger";
// Import domain functions to wrap

export async function execute(input: <Tool>Input): Promise<<Tool>Output> {
  // Wrap existing domain functions - don't reimplement
  const result = await domainFunction(input.field);
  
  logger.info("<tool>_complete", { /* structured data */ });
  return result;
}
```

### 4. Create Index (index.ts)
```typescript
import { withPolicyApproval } from "../approval.js";
// Import from other files

export const tool<Name> = {
  name: "<tool_name>",
  description: "Clear description for the AI to understand when to use this tool.",
  inputSchema: <tool>InputSchema,
  outputSchema: <tool>OutputSchema,
  execute: async ({ input }) => {
    await enforcePolicy(input);
    return execute(input);
  },
};

// AI SDK wrapper
const aiTool<Name>Base = {
  name: tool<Name>.name,
  description: tool<Name>.description,
  parameters: tool<Name>.inputSchema,
  inputSchema: tool<Name>.inputSchema,
  execute: async (input) => tool<Name>.execute({ input }),
};

export const aiTool<Name> = withPolicyApproval(aiTool<Name>Base, (input) => ({
  action: "<domain>.<action>",
  resource: { kind: "<domain>", id: input.id },
  scopes: ["<domain>.read|write"],
  authz: input.authz,
}));
```

### 5. Register Tool
Add to `packages/agent/src/v6.ts`:
```typescript
import { tool<Name> } from "./orchestrator/tool/<name>";

const orchestratorToolSources: LegacyTool[] = [
  // ... existing tools
  tool<Name>,
];
```

### 6. Add Tests
Create `packages/agent/test/<name>.test.ts`:
- Mock `@alfred/auth/token`, repos, `@alfred/logger`
- Test: successful execution, policy enforcement, schema validation, errors

### 7. Validate
- Run tests: `bun test packages/agent/test/<name>.test.ts`
- Check lints: ReadLints on the new files
- Commit with: `feat(agent): add <name> tool`

## Reference
See `.ruler/34-agent-tools.md` for complete patterns and conventions.
