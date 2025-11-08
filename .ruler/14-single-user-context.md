# Single-User Context

## Core Principle

ALFRED is a personal assistant for a single user. Design decisions must reflect this context: no rate limiting, obvious defaults, minimal ceremony, and direct user benefit.

## Rules

1. **No rate limiting.** Single-user apps don't need rate limits. If a user exhausts resources, fix the resource limits, not the user's access.

2. **Obvious defaults.** Hardcode sensible defaults for timeouts, retries, and limits. Only add configuration when the default fails in practice. Examples:
   - Workflow step timeout: 5 minutes
   - Overall workflow timeout: 30 minutes
   - Token expiry: 5 minutes
   - Bio-ticket TTL: 2 minutes

3. **No feature flags for core functionality.** Feature flags are for gradual rollouts in multi-user systems. In single-user apps, enable features by default or remove them. Background schedulers may be gated for multi-instance deployments (see `.ruler/02-architecture.md` rule 5).

4. **Minimal ceremony.** Skip boilerplate that serves no purpose:
   - No "owner" role fallbacks (user is always the user)
   - No multi-tenancy abstractions
   - No user-scoped queries when there's only one user
   - No permission checks beyond security boundaries (biometric elevation, MFA)

5. **Direct user benefit.** Every feature must directly benefit the user. Avoid abstractions that serve hypothetical future needs. If a feature doesn't improve the user's experience, remove it.

6. **Personal data management.** Since all data belongs to one user, focus on:
   - Data hygiene (retention policies, pruning)
   - PII redaction (protect user's privacy)
   - Performance (user's time matters)
   - Reliability (user's workflows must work)

7. **No user-facing configuration.** The user shouldn't need to configure timeouts, retries, or limits. These are implementation details. Expose only what the user needs to control (e.g., AI model selection, API keys).

## Examples

```typescript
// ❌ Rate limiting for single user
if (rateLimitExceeded(userId)) throw new RateLimitError();

// ✅ Resource limits (if needed)
if (memoryUsage > MAX_MEMORY) throw new ResourceExhaustedError();

// ❌ Feature flag for core functionality
if (process.env.ENABLE_PERSIST) await persist();

// ✅ Always persist (or remove feature)
await persist();

// ❌ Multi-user abstraction
const user = await getUser(userId);
const data = await getDataForUser(userId);

// ✅ Direct query (single user)
const data = await getData();
```

