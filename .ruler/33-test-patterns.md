# Test Patterns

## Session Construction

1. **Use test-kit session factory.** Create test sessions using `createTestSession` from `@alfred/test-kit/auth` instead of inline object construction. This ensures type safety and proper Better Auth session structure.

2. **No double assertions for sessions.** Never use `as unknown as AuthSession` patterns. If the test-kit factory doesn't meet your needs, extend `createTestSession` with new overrides.

3. **TestSession branding.** Test sessions are branded with `__test: true` to prevent accidental production use. Use `isTestSession()` guard when debugging.

4. **Session serialization.** Use `serializeTestSession` / `deserializeTestSession` for header transport in integration tests.

## Headers Handling

5. **Use headers utility.** When extracting headers from `HeadersInit` variants (Headers, array tuples, or Record), use `getHeaderValue` from `@alfred/api/utils/headers` instead of inline branching.

## Type Guards

6. **Part type guards return unknown.** Type guards for ALFRED's custom UIMessage parts (tool-call, tool-result) must accept `unknown` and return proper type predicates since AI SDK types don't include these custom types.

7. **Cast after guard.** After a type guard narrows a part, use explicit cast (`as unknown as ToolCallPart`) with a comment explaining why. This is necessary due to ALFRED's extended UIMessage format.

8. **Export narrowed types.** Export `ToolCallPart`, `ToolResultPart`, and similar types from `@alfred/ui/chat/parts` so consumers can cast correctly after guards.

## Workflow Test Harness

9. **Use WorkflowTestHarness.** For workflow integration tests, use `WorkflowTestHarness` from `@alfred/api/test/utils/workflow-server` which handles session patching, header construction, and cleanup.

10. **withWorkflowHarness pattern.** Prefer `withWorkflowHarness(async (harness) => { ... })` for automatic cleanup over manual harness construction.
