# Tool Validation Patterns

## Core Principle

Tool input must pass schema validation. Scope verification happens before execution. Reject early with clear error codes.

## Rules

1. **Schema validation.** Validate all tool inputs via Zod schema before execution. Throw validation errors immediately on failure.

2. **Zod descriptions.** Use `.describe()` on all schema fields. Descriptions must explain purpose for AI readability. Never leave fields without descriptions.

3. **Authz token validation.** Extract `authz` token from input. Must be `"Bearer <jwt>"` format. Reject `"unauthorized"` if missing.

4. **Scope verification.** Call `requireToolScopesAndPolicy(authz, requiredScopes, policyInput)` before execution. Must verify token and policy together.

5. **Elevation checks.** Verify `elevated: true` and `mfa: "passkey"` claims for high-autonomy actions. Reject policy denied if claims missing.

6. **Confirmation flags.** Validate `confirm: true` for dangerous operations (delete, code exec). Reject without confirmation.

7. **Content limits.** Validate content length/size constraints in schema. Use `.min()`/`.max()` on relevant fields.

8. **Error code format.** Throw errors with `<tool>_<reason>` pattern. Examples: `rag_content_too_large`, `rag_delete_confirmation_required`.

9. **Policy decision handling.** Check `decision.allow` from policy evaluation. Throw `decision.reason` or `"policy_denied"` if denied.

10. **Obligation handling.** Surface `decision.obligations` to caller. Handle `biometric`, `confirmation`, `audit` obligation types.

## See Also

- `.ruler/34-agent-tools.md` for tool development patterns
- `.ruler/autonomy-mapping.md` in `packages/policy` for autonomy mapping
