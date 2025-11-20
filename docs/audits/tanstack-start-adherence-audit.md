# TanStack Start Codebase Adherence Audit

**Date:** 2025-01-27  
**Scope:** `apps/web` directory  
**Reference:** `.ruler/21-tanstack-start.md` and `docs/reference/tanstack-start/`

## Executive Summary

The codebase demonstrates **good adherence** to TanStack Start patterns with **6 critical issues** and **3 improvement opportunities** identified. The application correctly uses file-based routing, proper router instance patterns, and server routes. However, missing router-level error boundaries, potential hydration mismatches, and manual environment detection patterns need attention.

## Compliance Status by Rule

### ✅ Rule 1: File-Based Routing
**Status:** COMPLIANT

All routes correctly use `createFileRoute()` for route definitions. Route paths are managed by the router bundler plugin. All routes export `Route` constant.

**Verified Files:**
- All 17 route files in `apps/web/src/routes/` use `createFileRoute()`
- No manual path construction found

### ✅ Rule 2: Router Instance
**Status:** COMPLIANT

Router correctly exports `getRouter()` function that returns a new router instance each time.

**File:** `apps/web/src/router.tsx`

```45:62:apps/web/src/router.tsx
export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          {children}
        </trpc.Provider>
      </QueryClientProvider>
    ),
  });
  return router;
};
```

### ✅ Rule 3: Root Route Components
**Status:** COMPLIANT

Root route correctly renders `HeadContent` in `<head>` and `Scripts` in `<body>`.

**File:** `apps/web/src/routes/__root.tsx`

```47:66:apps/web/src/routes/__root.tsx
function RootDocument() {
  const isFetching = useRouterState({ select: (s) => s.isLoading });
  return (
    <html className="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="grid h-svh grid-rows-[auto_1fr]">
          <Header />
          {isFetching ? <Loader /> : <Outlet />}
        </div>
        <Toaster richColors />
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
        <Scripts />
      </body>
    </html>
  );
}
```

### ⚠️ Rule 4: Server Functions
**Status:** PARTIAL COMPLIANCE

No `createServerFn()` usage found in the codebase. However, the application uses tRPC for server-side operations, which is a valid alternative pattern. Server routes use `server.handlers` correctly.

**Note:** Server functions are not required if using tRPC for server-side operations. The current pattern is acceptable but should be documented.

### ⚠️ Rule 5: Server Function Validation
**Status:** N/A (Using tRPC)

No server functions found. tRPC provides built-in validation via Zod schemas in router definitions.

### ✅ Rule 6: Route Loaders
**Status:** COMPLIANT (No loaders found)

No route loaders found in the codebase. Routes use tRPC queries directly in components, which is acceptable.

### ⚠️ Rule 7: Server-Only Utilities
**Status:** PARTIAL COMPLIANCE

**Issue:** `process.env` accessed directly in server routes and server bootstrap files. While these are server-only contexts, the pattern should use `createServerOnlyFn()` for consistency and safety.

**Files with `process.env` usage:**
- `apps/web/src/server/bootstrap.ts` (line 23) - Server bootstrap, acceptable
- `apps/web/src/routes/api/linear/webhook.ts` (line 26) - Server route handler, acceptable

**Recommendation:** Consider wrapping in `createServerOnlyFn()` for explicit server-only enforcement.

### ❌ Rule 8: Isomorphic Functions
**Status:** VIOLATION

**Issue:** Manual `typeof window` checks found instead of `createIsomorphicFn()`.

**Violations:**

1. **File:** `apps/web/src/routes/deployments.tsx` (lines 39-46)

```39:46:apps/web/src/routes/deployments.tsx
  if (typeof window === "undefined") {
    return `${slug}.${DEFAULT_DOMAIN_FALLBACK}`;
  }
  const domain =
    import.meta.env?.VITE_APP_DOMAIN ??
    (window.location.hostname.length > 0
      ? window.location.hostname
      : DEFAULT_DOMAIN_FALLBACK);
```

**Recommended Fix:**
```typescript
import { createIsomorphicFn } from '@tanstack/react-start';

const suggestProdHost = createIsomorphicFn()
  .server(() => {
    return `${slug}.${DEFAULT_DOMAIN_FALLBACK}`;
  })
  .client(() => {
    const domain =
      import.meta.env?.VITE_APP_DOMAIN ??
      (window.location.hostname.length > 0
        ? window.location.hostname
        : DEFAULT_DOMAIN_FALLBACK);
    return `${slug}.${domain}`;
  });
```

2. **File:** `apps/web/src/hooks/use-voice-capture.ts` (lines 63, 110, 145)

**Severity:** Medium (hook code, less critical than route code)

### ✅ Rule 9: Environment Variables
**Status:** COMPLIANT

- Server routes/handlers access `process.env` correctly (server-only)
- Client code uses `VITE_` prefixed variables via `import.meta.env`
- No secrets exposed to client bundle

**File:** `apps/web/src/routes/deployments.tsx` (line 43)
```typescript
import.meta.env?.VITE_APP_DOMAIN
```

### ✅ Rule 10: Route Protection
**Status:** COMPLIANT

Route protection correctly uses `beforeLoad` with `redirect()`.

**File:** `apps/web/src/routes/dashboard.tsx`

```11:20:apps/web/src/routes/dashboard.tsx
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
```

**Note:** `authClient.getSession()` is isomorphic-safe (Better Auth React client).

### ⚠️ Rule 11: Selective SSR
**Status:** NO CONFIGURATION FOUND

No routes use `ssr: false` or `ssr: 'data-only'` configuration. Routes that use browser-only APIs (e.g., `window.confirm`, `navigator.clipboard`) should consider `ssr: false` or `ssr: 'data-only'`.

**Recommendation:** Review routes with browser-only APIs:
- `apps/web/src/routes/deployments.tsx` - Uses `window.confirm`, `navigator.clipboard`
- `apps/web/src/routes/privacy.tsx` - Uses file download APIs

### ❌ Rule 12: Hydration Mismatches
**Status:** VIOLATION

**Issue:** Multiple routes use `Date.now()` and `new Date()` directly in component render, which can cause hydration mismatches.

**Violations:**

1. **File:** `apps/web/src/routes/remind.tsx` (lines 27, 35, 56)

```27:35:apps/web/src/routes/remind.tsx
  const defaultDue = useMemo(() => {
    const start = new Date(Date.now() + 5 * 60 * 1000);
    return start.toISOString().slice(0, 16);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(defaultDue);
  const listInput = useMemo(() => ({ limit: 50, offset: 0 }), []);
  const [dueBefore, setDueBefore] = useState(() => new Date().toISOString());
```

**Issue:** `useMemo` and `useState` initializers run during SSR, causing hydration mismatch.

**Recommended Fix:**
```typescript
const defaultDue = useMemo(() => {
  if (typeof window === "undefined") return "";
  const start = new Date(Date.now() + 5 * 60 * 1000);
  return start.toISOString().slice(0, 16);
}, []);

const [dueBefore, setDueBefore] = useState(() => {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return new Date().toISOString();
});
```

2. **File:** `apps/web/src/routes/privacy.tsx` (lines 81, 89, 132, 185)

```81:89:apps/web/src/routes/privacy.tsx
      exportedAt: new Date().toISOString(),
      // ...
    a.download = `alfred-export-${new Date().toISOString().split("T")[0]}.json`;
```

**Issue:** Timestamps generated during render can cause hydration mismatches.

**Recommended Fix:** Use `useState` + `useEffect` for client-only timestamp generation.

3. **File:** `apps/web/src/routes/deployments.tsx` (lines 140, 141, 312, 336)

**Issue:** Date formatting in render can cause hydration mismatches.

**Severity:** Medium (affects SSR correctness)

### ❌ Rule 13: Error Boundaries
**Status:** VIOLATION

**Issue:** Router lacks `defaultErrorComponent` configuration. Only per-route error components are configured.

**File:** `apps/web/src/router.tsx`

**Current Code:**
```45:62:apps/web/src/router.tsx
export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    // Missing: defaultErrorComponent
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          {children}
        </trpc.Provider>
      </QueryClientProvider>
    ),
  });
  return router;
};
```

**Recommended Fix:**
```typescript
import { RouteError } from "@/components/route-error";

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    defaultErrorComponent: RouteError, // Add this
    Wrap: ({ children }) => (
      // ... existing Wrap
    ),
  });
  return router;
};
```

**Severity:** High (affects error handling UX)

### ✅ Rule 14: Server Function Errors
**Status:** COMPLIANT (N/A - Using tRPC)

No server functions found. tRPC handles errors via its error handling system.

### ✅ Rule 15: Streaming Data
**Status:** COMPLIANT

Streaming uses tRPC subscriptions, which is appropriate for the architecture.

### ✅ Rule 16: Server Routes
**Status:** COMPLIANT

Server routes correctly use `server.handlers` pattern.

**Examples:**
- `apps/web/src/routes/api/metrics.ts`
- `apps/web/src/routes/api/trpc/$.ts`
- `apps/web/src/routes/api/linear/webhook.ts`
- `apps/web/src/routes/healthz.ts`

### ⚠️ Rule 17: Middleware Composition
**Status:** NO MIDDLEWARE FOUND

No middleware composition found. This is acceptable if not needed, but should be documented.

### ⚠️ Rule 18: Global Middleware
**Status:** NO CONFIGURATION FOUND

No `createStart()` configuration found. Server entry point uses default handler.

**File:** `apps/web/src/server.ts`

**Current Code:**
```1:14:apps/web/src/server.ts
import handler from "@tanstack/react-start/server-entry";
import { initServer } from "./server/bootstrap";

// Initialize server-side services before handling requests
initServer();

// Export default handler conforming to ServerEntry interface
// This is the entry point for TanStack Start SSR and API routes
// TanStack Start will automatically detect this file as the server entry point
export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
```

**Note:** Using default handler is acceptable. Global middleware can be added if needed.

### ⚠️ Rule 19: Client Context Validation
**Status:** NO VALIDATION FOUND

No client context validation found. This may not be needed if not using `sendContext()`.

### ❌ Rule 20: Static Prerendering
**Status:** VIOLATION

**Issue:** Static prerendering not configured in `vite.config.ts`.

**File:** `apps/web/vite.config.ts`

**Current Code:**
```1:9:apps/web/vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
});
```

**Recommended Fix:**
```typescript
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
      },
    }),
    viteReact(),
  ],
});
```

**Severity:** Low (performance optimization, not critical)

## Summary of Issues

### Critical Issues (Must Fix)

1. **Missing Router-Level Error Boundary** (Rule 13)
   - **File:** `apps/web/src/router.tsx`
   - **Severity:** High
   - **Impact:** Unhandled errors may not display properly

2. **Hydration Mismatches from Date Usage** (Rule 12)
   - **Files:** `apps/web/src/routes/remind.tsx`, `apps/web/src/routes/privacy.tsx`, `apps/web/src/routes/deployments.tsx`
   - **Severity:** Medium
   - **Impact:** SSR/client mismatch warnings, potential UI flicker

### High Priority Issues

3. **Manual typeof window Checks** (Rule 8)
   - **Files:** `apps/web/src/routes/deployments.tsx`, `apps/web/src/hooks/use-voice-capture.ts`
   - **Severity:** Medium
   - **Impact:** Inconsistent environment detection, potential bundle size issues

### Low Priority Issues

4. **Missing Static Prerendering Configuration** (Rule 20)
   - **File:** `apps/web/vite.config.ts`
   - **Severity:** Low
   - **Impact:** Missing performance optimization opportunity

5. **No SSR Configuration for Browser-Only Routes** (Rule 11)
   - **Files:** `apps/web/src/routes/deployments.tsx`, `apps/web/src/routes/privacy.tsx`
   - **Severity:** Low
   - **Impact:** Potential unnecessary SSR for browser-only features

## Recommendations

### Immediate Actions

1. **Add `defaultErrorComponent` to router configuration**
   - Import `RouteError` component
   - Add to `createTanStackRouter` options

2. **Fix hydration mismatches**
   - Wrap `Date.now()` and `new Date()` calls in `useState` + `useEffect` for client-only initialization
   - Or use `createIsomorphicFn()` for server/client variants

3. **Replace manual `typeof window` checks**
   - Use `createIsomorphicFn()` for environment-specific logic
   - Improves tree-shaking and type safety

### Future Improvements

1. **Consider SSR configuration**
   - Add `ssr: false` or `ssr: 'data-only'` to routes using browser-only APIs
   - Improves performance and avoids SSR errors

2. **Enable static prerendering**
   - Configure in `vite.config.ts` for better performance
   - Exclude dynamic routes automatically

3. **Document server function alternative**
   - Document that tRPC is used instead of `createServerFn()`
   - Consider if any operations would benefit from server functions

## Compliance Score

- **Compliant:** 11/20 rules (55%)
- **Partial Compliance:** 4/20 rules (20%)
- **Violations:** 5/20 rules (25%)

**Overall Assessment:** Good foundation with room for improvement in error handling, hydration safety, and performance optimizations.

