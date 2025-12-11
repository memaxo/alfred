# Agent Tool Development

## File Structure

1. **Simple tools (single file).** Tools with straightforward execution logic use a single file: `packages/agent/src/orchestrator/tool/<name>.ts`. Include input/output schemas, policy enforcement, and execute function in one module.

2. **Complex tools (folder structure).** Tools requiring multiple execution paths, extensive schemas, or sophisticated policy logic use a folder:
   ```
   packages/agent/src/orchestrator/tool/<name>/
   ├── definition.ts    # Zod input/output schemas and types
   ├── policy.ts        # Policy enforcement functions
   ├── exec.ts          # Execution logic (wraps domain functions)
   └── index.ts         # Tool exports with AI SDK integration
   ```

3. **Threshold for complexity.** Use folder structure when: (a) input schema exceeds 10 fields, (b) multiple execution paths exist, (c) policy logic requires elevation/biometric checks, or (d) tool wraps multiple domain functions.

## Schema Design

4. **Zod with descriptions.** All schema fields must include `.describe()` for AI-readable documentation. Descriptions should explain purpose, not just type.

5. **Separate input/output schemas.** Export both `<tool>InputSchema` and `<tool>OutputSchema` as named exports. Infer types with `z.infer<typeof schema>`.

6. **Required authz field.** Include `authz: z.string().optional()` in all tool input schemas to support policy enforcement.

7. **Validation constraints.** Use `.min()`, `.max()`, `.int()` on numeric fields. Use `.min(1)` on required strings. Document limits in descriptions.

## Policy Enforcement

8. **Scope naming convention.** Use `<domain>.read` for query operations, `<domain>.write` for mutations. Example: `rag.read`, `rag.write`.

9. **Autonomy levels.** Map operations to autonomy bands: read-only (0.0-0.3), suggest (0.3-0.5), cautious execute (0.5-0.7), supervised execute (0.7-0.9), full (0.9-1.0).

10. **Dangerous operations.** Tools that delete data or execute code must require `confirm: true` in input and check for elevated authorization and biometric MFA.

11. **Policy enforcement order.** Validate content limits and confirmation flags before calling `requireToolScopesAndPolicy`. This ensures clear error messages for input violations.

## Tool Registration

12. **Legacy tool interface.** Export tools with the legacy interface: `{ name, description, inputSchema, outputSchema, execute }`. The `execute` function receives `{ input }` and returns the output.

13. **AI SDK wrapper.** Create an `aiTool<Name>Base` object and wrap with `withPolicyApproval()` for automatic approval flow integration.

14. **Registration in v6.ts.** Add tools to `orchestratorToolSources` array in `packages/agent/src/v6.ts`. Tools are automatically wrapped with `wrapLegacyToolToAISDK`.

## Testing

15. **Mock dependencies first.** Use `mock.module()` before imports. Mock `@alfred/auth/token`, domain repos, `@alfred/logger`, and any external services.

16. **Test categories.** Every tool test file must cover: (a) successful execution, (b) policy enforcement, (c) input validation via schema, (d) error handling, (e) edge cases specific to the domain.

17. **Reset mocks in beforeEach.** Call `.mockReset()` on all mocks and set up default successful responses for policy checks.

## Domain Integration

18. **Wrap, don't reimplement.** Tools should wrap existing domain functions (e.g., `@alfred/rag`, `@alfred/db/repo/*`). Never duplicate business logic in tool execution.

19. **Logging conventions.** Use `logger.info()` for successful operations with structured data: `{ documentId, source, chunks }`. Use `logger.debug()` for progress updates.

20. **Error codes.** Throw errors with descriptive codes: `<tool>_<reason>` (e.g., `rag_content_too_large`, `rag_delete_confirmation_required`).
