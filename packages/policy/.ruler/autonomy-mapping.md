# Autonomy Mapping Patterns

## Core Principle

Authorization decisions map to autonomy bands. High-risk actions require elevated/mfa tokens. Escalate when band changes.

## Rules

1. **Scope mapping.** Map read operations to `0.0-0.3` (read-only band). Map write operations to `0.3-0.5` (suggest band). Map admin operations to `0.5-0.7` (cautious execute band).

2. **Elevated requirement.** Require `elevated: true` claim for operations with autonomy ≥ 0.7. Throw policy denied when claim missing.

3. **MFA requirement.** Require `mfa: "passkey"` claim for operations with autonomy ≥ 0.9. Throw policy denied when claim missing.

4. **Tool token checks.** Call `requireToolScopesAndPolicy()` in tool handlers. Verify `claims.elevated` and `claims.mfa` against autonomy threshold.

5. **Escalation trigger.** When autonomy band changes from previous decision, require re-authorization. Never silently upgrade autonomy.

6. **Band constants.** Define autonomy bands: `READ_ONLY=0.3`, `SUGGEST=0.5`, `CAUTIOUS_EXECUTE=0.7`, `SUPERVISED_EXECUTE=0.9`, `FULL=1.0`.

7. **Context mapping.** Include `mfa` and `elevated` claims in policy evaluation context. PDP must read these from token claims.

## See Also

- `.ruler/03-security.md` for security expectations
- `.ruler/tool-token-patterns.md` in `packages/auth` for token claims
