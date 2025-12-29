# Session Management Patterns

## Core Principle

Better Auth handles sessions via Drizzle adapter. Redis manages bio-tickets and JTI cache. Expo client uses SecureStore.

## Rules

1. **Redis initialization.** Use `getRedis()` for lazy client initialization. Call `getRedisAsync()` when async wait required. Never create direct Redis clients.

2. **Connection retry.** Retry connections with exponential backoff when `REDIS_RETRY_ENABLED=true`. Disable retries in tests to prevent event loop leaks.

3. **Connection cleanup.** Call `client.close()` in error handlers and `resetRedisState()` in test teardowns.

4. **Metrics tracking.** Record connection status via `redisConnectionStatus`, errors via `redisConnectionErrorsTotal`, reconnection attempts via `redisReconnectionAttemptsTotal`.

5. **Health checks.** Call `isRedisHealthy()` for readiness probes. Return `false` when client not connected or `ping()` fails.

6. **Expo integration.** Use `@better-auth/expo` plugin for native clients. Sessions persist via SecureStore through the Expo plugin.

7. **Session invalidation.** Invalidate sessions through Better Auth API. Never manipulate session data directly in database.

## See Also

- `.ruler/03-security.md` for session-related security expectations
