# Authentication System Security & Usability Review

**Date:** December 4, 2025  
**Reviewer:** Claude (Opus 4.5)  
**Context:** Single-tenant, single-user personal assistant for Jack

---

## 1. Executive Summary

The ALFRED authentication system is well-architected with Better Auth, Ed25519 tool tokens, and a sophisticated policy engine. However, several issues need attention:

- **No route-level protection** on protected routes (critical)
- **Dead code** in auth package needs cleanup (high)
- **Missing biometric bypass** for development (high)
- **Unnecessary complexity** for single-user context (medium)

---

## 2. Current Authentication Flow

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION LAYERS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Web App    │    │  Native App  │    │   External   │                   │
│  │ (TanStack)   │    │   (Expo)     │    │    Tools     │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                           │
│         ▼                   ▼                   │                           │
│  ┌──────────────────────────────────┐          │                           │
│  │         Better Auth Client        │          │                           │
│  │  • authClient.signIn.email()     │          │                           │
│  │  • authClient.signIn.passkey()   │          │                           │
│  │  • authClient.useSession()       │          │                           │
│  └──────────────┬───────────────────┘          │                           │
│                 │                               │                           │
│                 ▼                               ▼                           │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    Better Auth Server                         │          │
│  │  packages/auth/src/index.ts                                   │          │
│  │  • Session Management (cookie-based)                          │          │
│  │  • Passkey Plugin (WebAuthn)                                  │          │
│  │  • Bio-ticket hook (2-min TTL)                                │          │
│  │  • Expo plugin (native support)                               │          │
│  └──────────────┬───────────────────────────────────────────────┘          │
│                 │                                                           │
│                 ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    tRPC Context                               │          │
│  │  packages/api/src/context.ts                                  │          │
│  │  • Session extraction from headers                            │          │
│  │  • Test session bypass (x-alfred-test-session)                │          │
│  │  • RuntimeContext population                                  │          │
│  └──────────────┬───────────────────────────────────────────────┘          │
│                 │                                                           │
│                 ▼                                                           │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    Authorization Layer                        │ ◄────────┤
│  │                                                               │          │
│  │  ┌─────────────────┐  ┌─────────────────┐                    │          │
│  │  │ authedProcedure │  │  requirePolicy  │                    │          │
│  │  │  (session req)  │  │ (RBAC + ABAC)   │                    │          │
│  │  └─────────────────┘  └─────────────────┘                    │          │
│  │                                                               │          │
│  │  ┌─────────────────────────────────────────────────────────┐ │          │
│  │  │              Tool Token Layer (Ed25519)                  │ │          │
│  │  │  • issueAccessToken() - 5min TTL                         │ │          │
│  │  │  • verifyAccessToken() - JTI replay protection           │ │          │
│  │  │  • requireToolScopesAndPolicy() - scope + policy check   │ │          │
│  │  └─────────────────────────────────────────────────────────┘ │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PostgreSQL (via Drizzle)              Redis (optional)                     │
│  ├── user                              ├── bio:{sessionId} (2-min TTL)      │
│  ├── session                           └── jti:{tokenId} (token TTL)        │
│  ├── account                                                                 │
│  ├── verification                      Memory Fallback (development)        │
│  └── passkey                           ├── memoryTickets Map                │
│                                        └── memoryJti Map                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Web Authentication Flow (Step-by-Step)

**Initial Sign-Up (Jack's first time):**
1. Jack navigates to `/login` (defaults to sign-up form)
2. Enters name, email, password
3. `authClient.signUp.email()` sends POST to `/api/auth/sign-up/email`
4. Better Auth creates user + session + account records in PostgreSQL
5. Session cookie set (`better-auth.session_token`)
6. Redirect to `/mindscape`

**Subsequent Sign-In:**
1. Jack navigates to `/login` → clicks "Sign In"
2. Enters email, password
3. `authClient.signIn.email()` authenticates against account table
4. Session cookie refreshed
5. Redirect to `/mindscape`

**Passkey Authentication (for elevation):**
1. Sensitive action triggers `requireRecentBiometric()`
2. If no valid bio-ticket: `biometric_required` error
3. Client calls `authClient.signIn.passkey({ email })`
4. WebAuthn ceremony with platform authenticator
5. `bio-ticket` hook sets 2-min ticket in Redis/memory
6. Original action retried successfully

### 2.3 Native Authentication Flow

**Current Implementation:**
1. Email/password only (no passkey support yet)
2. Uses Expo SecureStore for token persistence
3. Same Better Auth backend via `EXPO_PUBLIC_SERVER_URL`

### 2.4 tRPC Session Flow

```typescript
// packages/api/src/context.ts
export async function createContext({ req }: { req: Request }): Promise<Context> {
  // 1. Check for test session header (development bypass)
  const testSession = parseTestSession(headers);
  
  // 2. Get real session from Better Auth
  const session = testSession 
    ? testSession 
    : await auth.api.getSession({ headers }).catch(() => null);
  
  // 3. Build runtime context
  return { session, runtime, runtimeContext };
}
```

---

## 3. Issues Found

### 3.1 Critical Issues

#### CRIT-1: No Route-Level Protection on Protected Routes

**Location:** `apps/web/src/routes/mindscape.tsx`, `apps/web/src/routes/settings.tsx`, etc.

**Problem:** Protected routes don't use `beforeLoad` guards to verify authentication. Users can navigate directly to protected routes without a session.

**Evidence:**
```typescript
// apps/web/src/routes/mindscape.tsx - NO AUTH CHECK
export const Route = createFileRoute("/mindscape")({
  component: MindscapeRoute,
  validateSearch: mindscapeSearchSchema,
  loader: () => getInitialMindscapeFrame(),
  // Missing: beforeLoad with session check
});
```

**Impact:** Any visitor can access the mindscape and other protected views. tRPC calls will fail, but the route still renders.

**Fix Required:** Add `beforeLoad` guards (see Section 5.1).

---

#### CRIT-2: Test Session Header Bypass in Production

**Location:** `packages/api/src/context.ts`

**Problem:** The `x-alfred-test-session` header bypass is always active, not just in test mode.

**Evidence:**
```typescript
// packages/api/src/context.ts:90-108
function parseTestSession(headers: Headers): AuthSession | null {
  const value = headers.get(TEST_SESSION_HEADER);
  // No check for NODE_ENV or VITE_TEST_MODE
  if (!value) return null;
  // ... parses and returns session
}
```

**Impact:** If deployed, any attacker can forge sessions by sending a base64-encoded session in the header.

**Fix Required:** Gate behind `VITE_TEST_MODE` check (see Section 5.2).

---

### 3.2 High Severity Issues

#### HIGH-1: Dead Code in Auth Package

**Location:** `packages/auth/src/auth.ts`, `packages/auth/src/key.ts`

**Problem:** These files contain placeholder functions that throw "Not implemented":

```typescript
// packages/auth/src/auth.ts - DEAD CODE
export function createAuth() {
  throw new Error("Not implemented");
}

// packages/auth/src/key.ts - DEAD CODE  
export async function loadKeys(): Promise<KeyPair> {
  throw new Error("Not implemented");
}
```

**Impact:** Confusing codebase, potential import errors if accidentally used.

**Fix Required:** Delete dead files or implement properly.

---

#### HIGH-2: No Biometric Bypass for Development

**Location:** `packages/auth/src/biometric.ts`, `packages/api/src/routers/token.ts`

**Problem:** When developing without a passkey (e.g., CI, remote dev), biometric-protected flows are blocked with no workaround.

**Current State:**
- `requireRecentBiometric()` always checks for valid ticket
- No environment variable to bypass
- Test mode bypasses entire auth, not just biometrics

**Fix Required:** Implement `BIO_AUTH_BYPASS` environment variable (see Section 4).

---

#### HIGH-3: No Session Expiration Handling on Client

**Location:** `apps/web/src/lib/auth-client.ts`

**Problem:** When session expires, user sees silent tRPC errors instead of being redirected to login.

**Impact:** Poor UX - Jack gets "UNAUTHORIZED" errors without understanding why.

**Fix Required:** Add session refresh logic or redirect on 401.

---

### 3.3 Medium Severity Issues

#### MED-1: Unnecessary Rate Limiter for Single-User

**Location:** `packages/api/src/trpc.ts:89-131`

**Problem:** In-memory rate limiter with per-user buckets is unnecessary for a single-user app.

```typescript
// Complexity not needed for Jack-only usage
const buckets = new Map<string, Bucket>();
function rateKey(userId: string | null, procedure?: string, type?: string) {
  return [userId ?? "anon", procedure ?? "unknown", type ?? "unknown"].join(":");
}
```

**Recommendation:** Remove or simplify to single bucket if needed for DoS protection.

---

#### MED-2: Multi-Role Complexity in Policy

**Location:** `config/policy.yaml`

**Problem:** Policy defines "owner" and "user" roles, but single-user app only needs "owner".

```yaml
roles:
  owner:
    scopes: [...50+ scopes...]
  user:
    scopes: [...subset of scopes...]
```

**Recommendation:** Collapse to single "owner" role or default all users to owner.

---

#### MED-3: Native App Lacks Passkey Support

**Location:** `apps/native/components/sign-in.tsx`

**Problem:** Only email/password authentication implemented. Passkeys would provide better security.

**Recommendation:** Implement `authClient.signIn.passkey()` for native app.

---

### 3.4 Low Severity Issues

#### LOW-1: Inconsistent Session Access Patterns

**Location:** `packages/api/src/routers/token.ts`, various routers

**Problem:** Session access uses unsafe casts:
```typescript
const sessionRecord = (ctx.session as any)?.session;
const sessionId = sessionRecord?.id ?? sessionRecord?.token;
```

**Recommendation:** Create typed helper functions.

---

#### LOW-2: Missing Session Refresh Before Expiry

**Problem:** Sessions expire after DB-configured TTL with no proactive refresh.

**Recommendation:** Implement background refresh or extend on activity.

---

## 4. Bio Auth Bypass Implementation Plan

### 4.1 Requirements

1. **Environment Variable Control:** `BIO_AUTH_BYPASS=true`
2. **No Code Changes When Enabled:** Same API surface
3. **Development Only:** Must not work in production
4. **Audit Trail:** Log when bypass is used

### 4.2 Implementation

**Step 1: Update `packages/auth/src/biometric.ts`**

```typescript
import { logger } from "@alfred/logger";
import { getRedis } from "./redis";

const memoryTickets = new Map<string, number>();

function isBioBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false; // Never in production
  }
  return process.env.BIO_AUTH_BYPASS === "true";
}

function memorySet(sessionId: string, ttlSec: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  memoryTickets.set(sessionId, expiresAt);
  const timer = setTimeout(() => {
    memoryTickets.delete(sessionId);
  }, ttlSec * 1000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

export async function setBiometricTicket(sessionId: string, ttlSec: number) {
  const redis = getRedis();
  if (redis) {
    await (redis.set as unknown as (
      key: string,
      value: string,
      options: { EX: number }
    ) => Promise<string>)(`bio:${sessionId}`, String(ttlSec), { EX: ttlSec });
  } else {
    memorySet(sessionId, ttlSec);
  }
}

export async function requireRecentBiometric(sessionId: string) {
  // Bypass for development
  if (isBioBypassEnabled()) {
    logger.warn("biometric_bypassed", { sessionId, reason: "BIO_AUTH_BYPASS=true" });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const redis = getRedis();
  
  if (redis) {
    const ttl = await redis.ttl(`bio:${sessionId}`);
    if (ttl <= 0) {
      throw new Error("biometric_required");
    }
    return;
  }

  const expiresAt = memoryTickets.get(sessionId);
  if (!expiresAt || expiresAt <= now) {
    throw new Error("biometric_required");
  }
}

/**
 * Auto-grant biometric ticket in bypass mode.
 * Call this after successful authentication to enable elevated operations.
 */
export async function autoGrantBiometricIfBypassed(sessionId: string) {
  if (isBioBypassEnabled()) {
    logger.warn("biometric_auto_granted", { sessionId, reason: "BIO_AUTH_BYPASS=true" });
    await setBiometricTicket(sessionId, 3600); // 1 hour in dev
  }
}
```

**Step 2: Update `packages/auth/src/index.ts`**

```typescript
import { autoGrantBiometricIfBypassed, setBiometricTicket } from "./biometric";

// In the bio-ticket hook:
{
  id: "bio-ticket",
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-in/passkey",
        handler: createAuthMiddleware(async (ctx) => {
          const session = ctx.context.newSession?.session ?? ctx.context.session?.session ?? null;
          const sessionId = session?.id || session?.token;
          if (!sessionId) return;
          await setBiometricTicket(sessionId, 120);
        }),
      },
      {
        // Auto-grant bio ticket for email sign-in when bypassed
        matcher: (ctx) => ctx.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const session = ctx.context.newSession?.session ?? ctx.context.session?.session ?? null;
          const sessionId = session?.id || session?.token;
          if (!sessionId) return;
          await autoGrantBiometricIfBypassed(sessionId);
        }),
      },
    ],
  },
},
```

**Step 3: Update `config/env.example`**

```bash
# ============================================
# Development Bypasses
# ============================================
# When true (development only), skips biometric verification.
# NEVER enable in production - enforced in code.
BIO_AUTH_BYPASS=false
```

### 4.3 Usage

```bash
# Development with bypass
BIO_AUTH_BYPASS=true bun run dev

# CI/CD
BIO_AUTH_BYPASS=true bun test

# Production - bypass disabled regardless of env var
NODE_ENV=production bun run start
```

---

## 5. Recommendations with Code Examples

### 5.1 Add Route Protection (CRIT-1 Fix)

**Create shared auth guard:**

```typescript
// apps/web/src/lib/require-auth.ts
import { redirect } from "@tanstack/react-router";
import { auth } from "@alfred/auth";

export async function requireAuth(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session) {
    throw redirect({
      to: "/login",
      search: { redirect: new URL(request.url).pathname },
    });
  }
  
  return session;
}
```

**Apply to protected routes:**

```typescript
// apps/web/src/routes/mindscape.tsx
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/require-auth";

export const Route = createFileRoute("/mindscape")({
  beforeLoad: async ({ context }) => {
    // Ensure we have the request from context
    const request = context.request;
    if (request) {
      await requireAuth(request);
    }
  },
  component: MindscapeRoute,
  loader: () => getInitialMindscapeFrame(),
});
```

**Alternative: Layout-level protection:**

```typescript
// apps/web/src/routes/_protected.tsx (layout route)
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_protected")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    return { user: session.data.user };
  },
  component: () => <Outlet />,
});

// Then nest protected routes under /_protected/
// apps/web/src/routes/_protected/mindscape.tsx
```

---

### 5.2 Gate Test Session Header (CRIT-2 Fix)

```typescript
// packages/api/src/context.ts

function isTestModeEnabled(): boolean {
  // Never in production
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  
  const testMode = process.env.TEST_MODE ?? process.env.VITE_TEST_MODE;
  return testMode === "true" || testMode === "1";
}

function parseTestSession(headers: Headers): AuthSession | null {
  // Only allow in test mode
  if (!isTestModeEnabled()) {
    return null;
  }
  
  const value = headers.get(TEST_SESSION_HEADER);
  if (!value) {
    return null;
  }
  
  try {
    const payload = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(payload) as AuthSession;
    if (!parsed?.user || !parsed?.session) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
```

---

### 5.3 Session Expiration Handling (HIGH-3 Fix)

**Option A: tRPC Error Handler**

```typescript
// apps/web/src/utils/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import { toast } from "sonner";

export const trpc = createTRPCReact<AppRouter>();

// In your tRPC provider setup:
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        }).then((response) => {
          // Check for auth errors
          if (response.status === 401) {
            toast.error("Session expired. Please sign in again.");
            window.location.href = "/login";
          }
          return response;
        });
      },
    }),
  ],
});
```

**Option B: React Query Global Error Handler**

```typescript
// apps/web/src/utils/query-client.ts
import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") {
          window.location.href = "/login";
        }
      },
    },
  },
});
```

---

### 5.4 Clean Up Dead Code (HIGH-1 Fix)

```bash
# Delete unused files
rm packages/auth/src/auth.ts
rm packages/auth/src/key.ts

# Or mark as deprecated if keeping for reference
# Add to each file:
# @deprecated This file is not used. See packages/auth/src/index.ts for actual auth configuration.
```

---

### 5.5 Simplify for Single-User (MED-1, MED-2)

**Simplify Rate Limiter:**

```typescript
// packages/api/src/trpc.ts
// Option 1: Remove entirely for single-user
export const rateLimit = t.middleware(({ next }) => next());

// Option 2: Simple global counter
let requestCount = 0;
let resetTime = Date.now() + 60000;

export const rateLimit = t.middleware(async ({ next }) => {
  const now = Date.now();
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 60000;
  }
  
  if (++requestCount > 1000) { // 1000 req/min is plenty for one user
    throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
  }
  
  return next();
});
```

**Simplify Policy:**

```yaml
# config/policy.yaml - Simplified for single-user
roles:
  owner:
    scopes:
      # All scopes - Jack owns everything
      - "*"

rules:
  # Default allow for owner
  - id: owner-allow-all
    actions: ["*"]
    roles: ["owner"]
    effect: "allow"
    
  # Sensitive actions still require biometric
  - id: require-bio-sensitive
    actions: ["deploy.promote", "proxmox.admin", "droid.exec"]
    roles: ["owner"]
    effect: "allow"
    conditions:
      - source: context
        field: auto
        in: ["medium", "high"]
    obligations:
      - type: biometric
        reason: sensitive_action_confirmation
```

---

## 6. Session Management Details

### 6.1 Session Creation

| Event | Method | Storage |
|-------|--------|---------|
| Sign-up | `authClient.signUp.email()` | PostgreSQL `session` table |
| Sign-in | `authClient.signIn.email()` | PostgreSQL `session` table |
| Passkey | `authClient.signIn.passkey()` | PostgreSQL `session` table + Redis bio-ticket |

### 6.2 Session Validation

| Layer | Check | On Failure |
|-------|-------|------------|
| tRPC Context | `auth.api.getSession()` | `ctx.session = null` |
| `authedProcedure` | `ctx.session !== null` | UNAUTHORIZED error |
| `requirePolicy()` | Role + scope check | FORBIDDEN error |
| Tool Token | Ed25519 + JTI + expiry | Error in verifyAccessToken |

### 6.3 Session Refresh

**Current:** No automatic refresh. Sessions expire based on Better Auth config.

**Recommended:** Add `reactStartCookies()` with `refreshSession` option or implement client-side polling.

---

## 7. Security Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Session cookies | ✅ | HttpOnly, Secure (via Better Auth) |
| CSRF protection | ✅ | SameSite cookies |
| Token signing | ✅ | Ed25519, 5-min TTL |
| Token replay | ✅ | JTI cache in Redis/memory |
| Password hashing | ✅ | Better Auth default (bcrypt/argon2) |
| Biometric elevation | ⚠️ | Works, needs bypass for dev |
| Route protection | ❌ | Missing beforeLoad guards |
| Test bypass safety | ❌ | Not gated behind NODE_ENV |
| Session expiration UX | ❌ | No client-side handling |
| Secrets in env | ✅ | All secrets via process.env |
| Rate limiting | ⚠️ | Overly complex for single-user |

---

## 8. Appendix: File Inventory

### Core Auth Files

| File | Purpose | Status |
|------|---------|--------|
| `packages/auth/src/index.ts` | Better Auth config + plugins | Active |
| `packages/auth/src/biometric.ts` | Bio-ticket management + bypass | Active |
| `packages/auth/src/token.ts` | Ed25519 tool token issuing | Active |
| `packages/auth/src/jwks.ts` | JWKS endpoint for token verification | Active |
| `packages/auth/src/redis.ts` | Redis client for tickets/JTI | Active |
| `packages/auth/src/auth.ts` | ~~Placeholder functions~~ | **DELETED** |
| `packages/auth/src/key.ts` | ~~Placeholder functions~~ | **DELETED** |

### Client Auth Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/auth-client.ts` | Better Auth React client |
| `apps/web/src/lib/test-auth.ts` | Test mode session bypass |
| `apps/web/src/lib/token.ts` | Tool token acquisition helpers |
| `apps/web/src/lib/obligation-retry.ts` | Auto-retry with biometric |
| `apps/native/lib/auth-client.ts` | Better Auth Expo client |

### API Auth Files

| File | Purpose |
|------|---------|
| `packages/api/src/context.ts` | tRPC context with session |
| `packages/api/src/trpc.ts` | Auth middleware + rate limiter |
| `packages/api/src/gate.ts` | Policy enforcement middleware |
| `packages/api/src/routers/token.ts` | Token issue/elevate endpoints |

---

## 9. Implementation Status

**Last Updated:** December 5, 2025

### Completed ✅

1. **CRIT-1: Route Protection**
   - Created `apps/web/src/routes/_protected.tsx` layout route
   - Moved protected routes under `_protected/` directory
   - All authenticated routes now redirect to `/login` if no session

2. **CRIT-2: Test Session Header Gate**
   - Added `isTestModeEnabled()` check in `packages/api/src/context.ts`
   - Test header only works when `TEST_MODE=true` AND not in production

3. **Biometric Bypass for Development**
   - Added `BIO_AUTH_BYPASS` environment variable
   - Auto-grants bio ticket on email sign-in when bypassed
   - Production guard prevents bypass in `NODE_ENV=production`
   - Updated `packages/auth/src/biometric.ts` and `packages/auth/src/index.ts`

4. **Session Expiration Handling**
   - Created `apps/web/src/lib/auth-error-handler.ts`
   - Integrated with React Query error handlers in `apps/web/src/router.tsx`
   - Auto-redirects to login on UNAUTHORIZED errors

5. **Dead Code Cleanup**
   - Deleted `packages/auth/src/auth.ts`
   - Deleted `packages/auth/src/key.ts`

6. **Rate Limiter Simplification**
   - Replaced per-user bucket system with global counter
   - 1000 req/min default, configurable via `ROUTE_RATE_LIMIT_PER_MINUTE`
   - Added backward-compatible `consumeRouteRateLimit()` function

7. **Policy Simplification**
   - Collapsed "user" role into "owner"
   - Added `owner-allow-all` wildcard rule
   - Retained biometric obligations for sensitive actions

8. **Native Passkey Support**
   - Added `passkeyClient()` plugin to `apps/native/lib/auth-client.ts`
   - Added passkey sign-in option to `apps/native/components/sign-in.tsx`
   - Added passkey management UI to `apps/native/app/(drawer)/(tabs)/profile.tsx`

9. **Session Helper Types**
   - Added `getSessionId()` helper in `packages/api/src/utils/session.ts`

### Environment Variables Added

```bash
# Development bypass for biometric auth (never enabled in production)
BIO_AUTH_BYPASS=false
```

### Files Changed

| File | Change |
|------|--------|
| `packages/api/src/context.ts` | Added test mode gate |
| `packages/api/src/trpc.ts` | Simplified rate limiter |
| `packages/auth/src/biometric.ts` | Added bypass logic |
| `packages/auth/src/index.ts` | Added bio auto-grant hook |
| `apps/web/src/routes/_protected.tsx` | **NEW** - Layout guard |
| `apps/web/src/lib/auth-error-handler.ts` | **NEW** - Error handler |
| `apps/web/src/router.tsx` | Added error handling |
| `apps/native/lib/auth-client.ts` | Added passkey plugin |
| `apps/native/components/sign-in.tsx` | Added passkey button |
| `apps/native/app/(drawer)/(tabs)/profile.tsx` | Added passkey management |
| `config/policy.yaml` | Simplified for single-user |
| `config/env.example` | Documented BIO_AUTH_BYPASS |

### Remaining Tasks

- [ ] Add session refresh logic (optional enhancement)
- [ ] Add passkey management to web profile node
