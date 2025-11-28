# Redis Usage Audit

**Date:** 2025-01-27  
**Scope:** Complete audit of Redis usage across the ALFRED codebase

## Executive Summary

Redis is used as an **optional** caching and coordination layer across multiple subsystems. The implementation follows a graceful degradation pattern—all Redis-dependent features fall back to in-memory alternatives when Redis is unavailable. This audit identifies 6 primary use cases, connection management patterns, and areas for improvement.

## Use Cases

### 1. Token Replay Protection (`packages/auth/src/token.ts`)

**Purpose:** Prevent JWT token replay attacks using JTI (JWT ID) tracking.

**Implementation:**
- Key pattern: `jti:{jti}`
- TTL: Matches token expiration (default 300s)
- Operation: `SET` with `NX` flag (only set if not exists)
- Fallback: In-memory `Map` with `setTimeout` cleanup

**Code Reference:**
```209:241:packages/auth/src/token.ts
export async function cacheJTI(jti: string, ttlSec: number) {
  const redis = getRedis();
  if (redis) {
    const saved = await (
      redis.set as unknown as (
        key: string,
        value: string,
        options: { EX: number; NX: boolean }
      ) => Promise<string>
    )(`jti:${jti}`, "1", {
      EX: ttlSec,
      NX: true,
    });
    if (saved !== "OK") {
      throw new Error("token_replayed");
    }
    return;
  }

  const now = Date.now();
  const expiresAt = now + ttlSec * 1000;
  const existing = memoryJti.get(jti);
  if (existing && existing > now) {
    throw new Error("token_replayed");
  }
  memoryJti.set(jti, expiresAt);
  const timer = setTimeout(() => {
    memoryJti.delete(jti);
  }, ttlSec * 1000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}
```

**Status:** ✅ Well-implemented with proper fallback

---

### 2. Workflow Run Registry (`packages/agent/src/workflow/registry.ts`)

**Purpose:** Distributed run registry for multi-instance deployments. Enables workflow resume across different API instances.

**Implementation:**
- Key patterns:
  - `rr:run:{runId}` - Owner instance ID (TTL: 120s)
  - `rr:ack:{corrId}` - Acknowledgment status (TTL: 60s)
- Pub/Sub channels: `rr:inst:{instanceId}:resume`
- Operations: `SET`, `GET`, `DEL`, `EXPIRE`, `PUBLISH`, `SUBSCRIBE`
- Heartbeat: Periodic `EXPIRE` refresh (default 30s interval)

**Code Reference:**
```163:431:packages/agent/src/workflow/registry.ts
export class RedisRunRegistry implements RunRegistry {
  private readonly runs = new Map<string, RunHandle>();
  private readonly backend = BACKEND_REDIS;
  private readonly instanceId: string;
  private readonly cmd: RedisClient;
  private readonly sub: RedisClient;
  private readonly ready: Promise<void>;
  private readonly ackTimeoutMs: number;
  private readonly ownerTtlSec: number;
  private readonly heartbeatMs: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(opts?: {
    url?: string;
    ackTimeoutMs?: number;
    ownerTtlSec?: number;
    heartbeatMs?: number;
  }) {
    this.instanceId = getInstanceId();
    this.ackTimeoutMs = opts?.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
    this.ownerTtlSec = opts?.ownerTtlSec ?? DEFAULT_OWNER_TTL_SEC;
    this.heartbeatMs = opts?.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    const url = opts?.url ?? process.env.REDIS_URL ?? undefined;
    this.cmd = url ? new RedisClient(url) : defaultRedis;
    this.sub = url ? new RedisClient(url) : new RedisClient();
    this.ready = this.initialize();
  }
```

**Configuration:**
- `RUN_REGISTRY_BACKEND=redis` to enable
- `RUN_REGISTRY_ACK_TIMEOUT_MS` (default: 2000ms)
- `RUN_REGISTRY_OWNER_TTL_SEC` (default: 120s)
- `RUN_REGISTRY_HEARTBEAT_MS` (default: 30000ms)

**Status:** ✅ Robust implementation with proper error handling and metrics

---

### 3. Voice Session Registry (`packages/api/src/voice/session-registry.ts`)

**Purpose:** Track active voice sessions across instances for multi-device coordination.

**Implementation:**
- Key patterns:
  - `voice:session:{sessionId}` - Session data (TTL: 3600s)
  - `voice:user:{userId}:sessions` - Set of session IDs (TTL: 3600s)
- Operations: `SET`, `GET`, `DEL`, `SADD`, `SREM`, `SMEMBERS`
- Fallback: In-memory `Map` and `Set` structures

**Code Reference:**
```78:172:packages/api/src/voice/session-registry.ts
export async function claimVoiceSession(params: {
  userId: string;
  sessionId?: string;
  surface?: string | null;
  mode: VoiceSessionMode;
  thread?: string;
  resource?: string;
  codec?: { input?: string; output?: string };
}): Promise<VoiceSessionSnapshot> {
  const redis = getRedis();
  const surface = normalizeSurface(params.surface);
  const sessionId = params.sessionId ?? randomUUID();

  const timestamp = now();

  if (redis) {
    const existingJson = await redis.get(keySession(sessionId));
    let record: MutableSession;

    if (existingJson) {
      const existing = JSON.parse(existingJson) as MutableSession;
      if (existing.userId !== params.userId) {
        throw new Error("voice_session_conflict");
      }
      record = {
        ...existing,
        surface,
        mode: params.mode,
        thread: params.thread ?? existing.thread,
        resource: params.resource ?? existing.resource,
        codec: params.codec ?? existing.codec,
        updatedAt: timestamp,
      };
    } else {
      record = {
        id: sessionId,
        userId: params.userId,
        surface,
        mode: params.mode,
        status: "idle",
        createdAt: timestamp,
        updatedAt: timestamp,
        thread: params.thread,
        resource: params.resource,
        codec: params.codec,
      };
    }

    await redis.set(
      keySession(sessionId),
      JSON.stringify(record),
      "EX",
      SESSION_TTL_SECONDS
    );
    await redis.sadd(keyUserSessions(params.userId), sessionId);
    await redis.expire(keyUserSessions(params.userId), SESSION_TTL_SECONDS);

    return record;
  }
```

**Status:** ✅ Well-structured with proper conflict detection

---

### 4. Preference Cache (`packages/agent/src/preference/loader.ts`)

**Purpose:** Two-tier cache (L1: LRU in-memory, L2: Redis) with pub/sub invalidation.

**Implementation:**
- Key pattern: `pref:{userId}`
- TTL: 600s (10 minutes)
- Pub/Sub channel: `preference:invalidate`
- Operations: `GET`, `SET`, `DEL`, `PUBLISH`, `SUBSCRIBE`

**Code Reference:**
```107:191:packages/agent/src/preference/loader.ts
export async function loadPreferences(
  userId: string
): Promise<Map<PreferenceKey, PreferenceDetail>> {
  await initializeRedis().catch(() => {
    // Initialization failures are logged inside initializeRedis(); fallback to L1/DB
  });

  const cached = l1Cache.get(userId);
  if (cached) {
    return cached;
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const serialized = await redis.get(redisKey(userId));
      if (serialized) {
        const prefs = deserializePreferences(serialized);
        if (prefs) {
          l1Cache.set(userId, prefs);
          return prefs;
        }
      }
    } catch (error) {
      logger.warn("preference_redis_get_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const rows = await getUserPreferences(userId);
  const prefs = new Map<PreferenceKey, PreferenceDetail>();

  for (const row of rows) {
    const keyResult = preferenceKeySchema.safeParse(row.key);
    if (!keyResult.success) {
      logger.warn("preference_key_invalid", {
        userId,
        key: row.key,
      });
      continue;
    }

    const valueResult = preferenceValueSchema.safeParse(row.value);
    if (!valueResult.success) {
      logger.warn("preference_value_invalid", {
        userId,
        key: row.key,
      });
      continue;
    }

    const sourceResult = preferenceSourceSchema.safeParse(row.source);
    const confidenceValue =
      typeof row.confidence === "number" ? clampConfidence(row.confidence) : 1;

    prefs.set(keyResult.data, {
      value: valueResult.data,
      source: sourceResult.success ? sourceResult.data : "user",
      confidence: confidenceValue,
      evidence: undefined,
    });
  }

  l1Cache.set(userId, prefs);

  if (redis && prefs.size > 0) {
    try {
      await redis.set(
        redisKey(userId),
        serializePreferences(prefs),
        "EX",
        L2_TTL_SECONDS
      );
    } catch (error) {
      logger.warn("preference_redis_set_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return prefs;
}
```

**Status:** ✅ Sophisticated caching strategy with invalidation

---

### 5. Droid Pending Runs (`packages/api/src/routers/droids.ts`)

**Purpose:** Persist pending droid execution runs for resume after biometric authorization.

**Implementation:**
- Key patterns:
  - `droid:pending:{runId}` - Pending run record (TTL: 1800s)
  - `droid:resume:{runId}:result` - Resume result (TTL: 900s)
- Operations: `SET`, `GET`, `DEL`
- Fallback: In-memory `Map` with expiration tracking

**Code Reference:**
```139:242:packages/api/src/routers/droids.ts
async function persistPendingRecord(runId: string, record: PendingRunRecord) {
  const redis = getRedis();
  const encoded = JSON.stringify(record);
  if (redis) {
    try {
      await (
        redis.set as unknown as (
          key: string,
          value: string,
          options: { EX: number }
        ) => Promise<string>
      )(KEY_PENDING_ENTRY(runId), encoded, { EX: PENDING_ENTRY_TTL_SEC });
      return;
    } catch {
      // fallback
    }
  }
  localPendingRecords.set(runId, {
    record,
    expiresAt: Date.now() + PENDING_ENTRY_TTL_SEC * 1000,
  });
}
```

**Status:** ✅ Simple and effective with cleanup worker

---

### 6. Droid Cleanup Worker (`packages/api/src/workers/droid-pending-cleanup.ts`)

**Purpose:** Periodic cleanup of stale pending droid runs using `SCAN`.

**Implementation:**
- Uses `SCAN` with pattern matching: `droid:pending:*`
- Configurable scan count (default: 200)
- Max age: 30 minutes (configurable via `DROID_PENDING_MAX_AGE_MS`)

**Code Reference:**
```19:36:packages/api/src/workers/droid-pending-cleanup.ts
async function scanKeys(redis: ReturnType<typeof getRedis>): Promise<string[]> {
  if (!redis) {
    return [];
  }
  let cursor = "0";
  const keys: string[] = [];
  do {
    const [nextCursor, batch] = (await redis.scan(cursor, {
      MATCH: `${KEY_PREFIX}*`,
      COUNT: SCAN_COUNT,
    })) as [string, string[]];
    cursor = nextCursor;
    if (Array.isArray(batch)) {
      keys.push(...batch);
    }
  } while (cursor !== "0");
  return keys;
}
```

**Status:** ✅ Proper use of `SCAN` for production-safe key iteration

---

## Connection Management

### Central Redis Client (`packages/auth/src/redis.ts`)

**Pattern:** Singleton client with lazy initialization and graceful degradation.

**Issues Identified:**

1. **No Retry Logic:** Once `status === "err"`, the client never retries initialization. The comment says "simplistic retry" but no retry is implemented.

2. **Race Condition:** `getRedis()` can return a client before `connect()` completes, leading to potential errors on first use.

3. **Missing Error Handler:** The `onerror` handler is commented out, so connection errors may go unlogged.

4. **Type Suppression:** Uses `@ts-expect-error` for Bun-specific options, but the types may be incomplete.

**Code Reference:**
```6:61:packages/auth/src/redis.ts
export function getRedis(): RedisClient | null {
  const url = process.env.REDIS_URL;
  if (!url || url === "false") {
    return null;
  }

  if (client && status === "ok") {
    return client;
  }

  if (status === "err") {
    // Retry init after failure if requested (simplistic retry)
    // For now, stick to returning null to fallback to in-memory
    return null;
  }

  try {
    // Bun's RedisClient is built on top of ioredis but optimized
    // It handles connection pooling internally
    client = url
      ? new RedisClient(url, {
          // @ts-expect-error - Bun Redis options might differ from types
          connectTimeout: 5000,
          // enableOfflineQueue: false, // Not supported in Bun types?
        })
      : defaultRedis;

    client.onclose = () => {
      status = "err";
      client = null; // Allow reconnection attempt next time
    };
    client.onconnect = () => {
      status = "ok";
    };
    // client.onerror = (err) => {
    //   console.error("[redis] connection error:", err);
    //   status = "err";
    // };

    // Initial connection check (fire and forget to not block startup)
    void client.connect().then(
      () => {
        status = "ok";
      },
      (_err) => {
        status = "err";
        client = null;
      }
    );
    return client;
  } catch (_error) {
    status = "err";
    client = null;
    return null;
  }
}
```

**Recommendations:**
- Implement exponential backoff retry on `status === "err"`
- Await `connect()` before returning client (or use `ready` promise pattern)
- Uncomment and properly implement `onerror` handler with structured logging
- Consider connection health checks before returning client

---

### Custom Redis Initialization (`packages/agent/src/preference/loader.ts`)

**Pattern:** Separate initialization for pub/sub with dedicated `cmd` and `sub` clients.

**Status:** ✅ Well-implemented with proper cleanup and error handling

---

### Workflow Registry (`packages/agent/src/workflow/registry.ts`)

**Pattern:** Creates separate `cmd` and `sub` clients directly, bypassing `getRedis()`.

**Status:** ✅ Appropriate for pub/sub pattern, but duplicates connection logic

---

## Health Checks

**Location:** `apps/web/src/routes/healthz/deps.ts`

**Implementation:**
- Checks Redis availability via `ping()` if client exists
- Non-blocking: Redis failure doesn't fail health check (optional dependency)

**Status:** ✅ Appropriate for optional dependency

---

## Configuration

**Environment Variables:**
- `REDIS_URL` - Connection string (default: none, falls back to in-memory)
- `RUN_REGISTRY_BACKEND` - `memory` (default) or `redis`
- `RUN_REGISTRY_ACK_TIMEOUT_MS` - Default: 2000ms
- `RUN_REGISTRY_OWNER_TTL_SEC` - Default: 120s
- `RUN_REGISTRY_HEARTBEAT_MS` - Default: 30000ms
- `DROID_PENDING_MAX_AGE_MS` - Default: 1800000ms (30 min)
- `DROID_PENDING_SCAN_COUNT` - Default: 200

**Status:** ✅ Well-documented in `config/env.example`

---

## Key Patterns Summary

| Use Case | Key Pattern | TTL | Operations | Fallback |
|----------|------------|-----|------------|----------|
| Token Replay | `jti:{jti}` | Token TTL | SET NX | In-memory Map |
| Run Registry | `rr:run:{runId}`, `rr:ack:{corrId}` | 120s, 60s | SET, GET, DEL, EXPIRE, PUBLISH, SUBSCRIBE | Memory registry |
| Voice Sessions | `voice:session:{id}`, `voice:user:{userId}:sessions` | 3600s | SET, GET, DEL, SADD, SREM, SMEMBERS | In-memory Map/Set |
| Preferences | `pref:{userId}` | 600s | GET, SET, DEL, PUBLISH, SUBSCRIBE | LRU cache + DB |
| Droid Pending | `droid:pending:{runId}`, `droid:resume:{runId}:result` | 1800s, 900s | SET, GET, DEL | In-memory Map |
| Droid Cleanup | `droid:pending:*` | N/A | SCAN | N/A (skips if no Redis) |

---

## Issues & Recommendations

### Critical

1. **No Retry Logic in `getRedis()`**
   - **Impact:** Once Redis connection fails, it never retries until process restart
   - **Recommendation:** Implement exponential backoff retry with configurable max attempts
   - **Priority:** High

2. **Race Condition in `getRedis()`**
   - **Impact:** Client may be returned before connection is established
   - **Recommendation:** Return a `ready` promise or await `connect()` before returning
   - **Priority:** Medium

### Medium

3. **Missing Error Handler**
   - **Impact:** Connection errors may go unlogged
   - **Recommendation:** Uncomment and implement `onerror` with structured logging
   - **Priority:** Medium

4. **Duplicate Connection Logic**
   - **Impact:** Workflow registry creates clients directly instead of using `getRedis()`
   - **Recommendation:** Consider standardizing on `getRedis()` or extracting connection factory
   - **Priority:** Low

5. **Type Suppressions**
   - **Impact:** `@ts-expect-error` hides potential type issues
   - **Recommendation:** Improve Bun Redis type definitions or use proper type assertions
   - **Priority:** Low

### Low

6. **No Connection Pooling Metrics**
   - **Impact:** Cannot monitor connection pool health
   - **Recommendation:** Add Prometheus metrics for connection pool size, active connections, errors
   - **Priority:** Low

7. **No Key Namespace Isolation**
   - **Impact:** All keys share the same namespace (though patterns are distinct)
   - **Recommendation:** Consider prefixing all keys with `alfred:` for easier management
   - **Priority:** Low

---

## Best Practices Observed

✅ **Graceful Degradation:** All Redis-dependent features have in-memory fallbacks  
✅ **Proper TTL Usage:** All keys have appropriate expiration times  
✅ **Pub/Sub Pattern:** Correct use of Redis pub/sub for cache invalidation  
✅ **SCAN Usage:** Proper use of `SCAN` instead of `KEYS` for production safety  
✅ **Error Handling:** Most operations wrap Redis calls in try/catch with fallbacks  
✅ **Structured Logging:** Errors are logged with context using structured logger  

---

## Testing Considerations

- Redis is mocked in tests (`packages/api/test/droid.cleanup.test.ts`)
- No integration tests found for Redis-dependent features
- **Recommendation:** Add integration tests that exercise Redis fallback paths

---

## Security Considerations

✅ **No Secrets in Keys:** All keys use IDs/UUIDs, no sensitive data  
✅ **TTL Enforcement:** All keys expire, preventing unbounded growth  
✅ **Token Replay Protection:** Proper use of `SET NX` for idempotency  
⚠️ **Connection String:** `REDIS_URL` should be validated to prevent SSRF if user-controlled (not applicable here)

---

## Performance Considerations

✅ **Connection Pooling:** Bun's RedisClient handles pooling internally  
✅ **Pipelining:** Bun automatically pipelines commands  
✅ **Efficient Key Patterns:** All keys use simple string patterns (no complex hashing)  
⚠️ **SCAN Performance:** Droid cleanup uses `SCAN` which is O(N) but production-safe

---

## Conclusion

Redis usage in ALFRED is **well-architected** with proper fallbacks and error handling. The primary concerns are:

1. **Connection retry logic** in `getRedis()` needs implementation
2. **Race condition** in client initialization should be addressed
3. **Error logging** should be enabled for better observability

The codebase demonstrates good understanding of Redis best practices (TTL, SCAN, pub/sub) and maintains operational flexibility through graceful degradation patterns.

