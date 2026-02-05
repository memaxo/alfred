# Executor API Management Tests

## Purpose

This suite verifies the **Executor API Management** surfaces across:

- Type-level config contracts (`@alfred/type` Zod schemas)
- AgentFS router management + redaction (`packages/api`)
- Runtime dispatch precedence into tool inputs (`packages/runtime`)
- AI SDK v6 tool schema guards (`packages/agent`)

It is intentionally **hermetic** (mocks + contract tests only) and does **not** require Docker or a live AgentFS container.

## Running Locally

From the repository root:

```bash
bun test packages/type/test/executor.test.ts
bun test packages/api/test/agentfs.router.test.ts
bun test packages/runtime/test/executor.test.ts
bun test packages/agent/test/v6.test.ts
```

## Notes

- The runtime tests mock `WorkspaceFactory` and executor tools; they only assert **config → tool input** precedence wiring.
- The AgentFS router tests cover **scope gates**, **SSRF guard behavior** for OpenCode HTTP, and **secret redaction** for `executor:*` KV entries.
