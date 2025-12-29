# Tool Token Patterns

## Core Principle

Tool tokens use Ed25519 with short TTL. JTI caching prevents replay. Tokens integrate with policy evaluation for authorization.

## Rules

1. **Token issuance.** Call `issueAccessToken(sub, scopes, audience, options)`. Must include non-empty `scopes` array. Default TTL must be ≤ 300 seconds (5 minutes).

2. **Ed25519 signing.** Use `importPKCS8` for private key, `importSPKI` for public key. Token algorithm must be `"EdDSA"`. Set `kid` from `AGENT_JWK_KID` env.

3. **Token structure.** Include claims: `sub`, `scopes`, `roles?`, `elevated?`, `mfa?`, `iat`, `exp`, `jti`, `aud`, `iss`. Set `mfa="passkey"` for MFA-authenticated tokens.

4. **Token verification.** Call `verifyAccessToken(token, audience, requiredScopes)`. Throw `"token_invalid_subject"`, `"token_missing_exp"`, `"token_missing_jti"`, `"token_missing_scope"`, `"token_expired"`, `"token_replayed"`.

5. **JTI caching.** Call `cacheJTI(jti, ttlSec)` after verification. Store at `jti:${jti}` with `EX` option and `NX=true`. Throw `"token_replayed"` if key exists.

6. **Memory JTI fallback.** When Redis unavailable, store JTI in `Map<string,expiresAt>` with LRU eviction (max 10,000 entries). Set eviction timers with `.unref()`.

7. **Policy integration.** Call `requireToolScopesAndPolicy(authz, requiredScopes, policyInput)`. Verify Bearer token prefix. Throw `"unauthorized"` for missing authz, `"policy_denied"` for failed policy.

8. **Nanoid JTI.** Generate unique identifiers with `nanoid()` for `jti` claim. Never use sequential or predictable IDs.

## See Also

- `.ruler/03-security.md` for security expectations
- `.ruler/policy.md` in `packages/policy` for PDP patterns
