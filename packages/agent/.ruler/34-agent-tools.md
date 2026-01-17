# Agent Tool Development

## Rules

1. **Location.** Simple tools live in `packages/agent/src/orchestrator/tool/<name>.ts`; split into a folder only when the tool has multiple exec paths or substantial policy logic.
2. **Schemas.** Define Zod input/output schemas with `.describe()` on fields and export both schemas as named exports.
3. **Policy.** Enforce scopes via `requireToolScopesAndPolicy()` and validate user-confirmation/size limits before policy checks for clearer errors.
4. **Danger.** Destructive or code-execution tools must require explicit confirmation and elevated authorization.
5. **Registration.** Register tools in `packages/agent/src/v6.ts` using the standard wrapper pipeline.
6. **Tests.** Tool tests must cover success, validation failures, policy denial, and domain-specific edge cases.
7. **No reimplementation.** Tools wrap domain packages; they don’t duplicate business logic.
