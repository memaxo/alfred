# Biometric Authentication Patterns

## Core Principle

Bio-tickets enforce MFA before elevated operations. Tickets expire within short TTL. Memory fallback when Redis unavailable.

## Rules

1. **Ticket issuance.** Call `setBiometricTicket(sessionId, ttlSec)` after successful MFA. Default TTL must be ≤ 120 seconds (2 minutes).

2. **Ticket verification.** Call `requireRecentBiometric(sessionId)` before elevated operations. Throw `"biometric_required"` when TTL exceeded.

3. **Dev bypass never in production.** `isBioBypassEnabled()` must return `false` when `NODE_ENV==="production"`. Never auto-grant bio-tickets in production.

4. **Memory fallback.** When Redis unavailable, store tickets in `Map<string,expiresAt>`. Set timer to evict expired entries. Call `.unref()` on timers.

5. **Redis TTL enforcement.** Store bio-tickets at `bio:${sessionId}` key with `EX` option. Check `redis.ttl(key)` ≤ 0 for validation.

6. **Hook placement.** Register bio-ticket hook in `betterAuth` plugins at `/sign-in/passkey` path. Auto-grant only when `BIO_AUTH_BYPASS=true`.

## See Also

- `.ruler/03-security.md` for overall security expectations
