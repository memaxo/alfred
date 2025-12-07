# TanStack Start Patterns

**Owner:** web  
**Last Updated:** 2025-01-27

This document describes TanStack Start patterns and best practices used in the ALFRED web application. It covers environment variable access, SSR configuration, middleware usage, and server function patterns.

## Environment Variable Access

### Server-Only Utilities

All server-only environment variable access must use `createServerOnlyFn` wrappers from `@/lib/env/server-only`. This provides runtime protection against accidental client calls and prevents server code leakage into client bundles.

**Pattern:**
```typescript
import { getDatabaseUrl, getNodeEnv } from '@/lib/env/server-only'

// In server functions or server-only code
const dbUrl = getDatabaseUrl()
const env = getNodeEnv()
```

**Rationale:**
- Runtime protection: Throws error if called from client
- Tree-shaking: Server code automatically excluded from client bundles
- Type safety: Centralized access with consistent typing
- Security: Prevents accidental exposure of secrets

**Available Utilities:**
- `getDatabaseUrl()` - DATABASE_URL
- `getNodeEnv()` - NODE_ENV
- `getSchedRemind()` - SCHED_REMIND
- `getSchedPreferenceInference()` - SCHED_PREFERENCE_INFERENCE
- `getViteTestMode()` - VITE_TEST_MODE
- `getMindscapeTest()` - MINDSCAPE_TEST
- `getBunTest()` - BUN_TEST

### Isomorphic Utilities

For environment detection that works in both server and client contexts, use `createIsomorphicFn` from `@/lib/env/isomorphic`.

**Pattern:**
```typescript
import { hasWindow, getTestMode } from '@/lib/env/isomorphic'

// Works in both server and client
if (hasWindow()) {
  // Client-only code
}

const isTest = await getTestMode()
```

**Rationale:**
- Automatic tree-shaking: Server code removed from client bundle, client code removed from server bundle
- Type-safe: Proper TypeScript inference
- No manual checks: Eliminates `typeof window` and `typeof process` checks

**Available Utilities:**
- `hasWindow()` - Check if window object is available
- `getTestMode()` - Check if test mode is enabled (async)

## SSR Configuration

### When to Disable SSR

Routes that use browser-only APIs should set `ssr: false` to prevent hydration errors and improve performance.

**Routes with `ssr: false`:**
- `/` - Uses WebGPU Canvas (MindscapeEngine)
- `/_protected/mindscape` - Uses ReactFlow and WebGPU
- `/_protected/settings/visual` - Uses Cortex Canvas
- `/demo/cortex` - Uses Cortex Canvas

**Pattern:**
```typescript
export const Route = createFileRoute("/route")({
  ssr: false, // Uses WebGPU/Canvas - browser-only
  component: MyComponent,
  loader: () => getData(), // Keep loader for data fetching
})
```

**Rationale:**
- Prevents SSR of browser-only APIs (WebGPU, Canvas, localStorage)
- Avoids hydration mismatches
- Improves initial load performance
- Loaders still run on server for data fetching

### When to Use `ssr: 'data-only'`

Routes that need server-side data fetching but don't need server-side rendering should use `ssr: 'data-only'`.

**Pattern:**
```typescript
export const Route = createFileRoute("/route")({
  ssr: 'data-only', // Fetch data on server, render on client
  component: MyComponent,
  loader: () => getData(),
})
```

**Use Cases:**
- Routes with client-only state management
- Routes that depend on browser APIs for rendering but need server data
- Routes with complex client-side interactivity

## Middleware Patterns

### Global Middleware

Global middleware is configured in `src/start.ts` and runs for all requests and server functions.

**Request Middleware:**
- Runs before every request (SSR, server routes, server functions)
- Use for: logging, error handling, request modification

**Function Middleware:**
- Runs before every server function
- Use for: function-specific logging, input validation, authentication

**Pattern:**
```typescript
// src/start.ts
export const startInstance = createStart(() => ({
  requestMiddleware: [requestLoggingMiddleware],
  functionMiddleware: [functionLoggingMiddleware],
}))
```

### Authentication Middleware

Use `requireAuthMiddleware` from `@/lib/middleware/auth` for server functions that require authentication.

**Pattern:**
```typescript
import { requireAuthMiddleware } from '@/lib/middleware/auth'

export const myServerFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    // context.user is available here
    const userId = context.user.id
    // ...
  })
```

**Rationale:**
- Reusable authentication logic
- Consistent error handling (redirects to login)
- Type-safe user context

## Server Function Patterns

### Request Access

Use `getRequest()` from `@tanstack/react-start/server` to access the request object in server functions.

**Pattern:**
```typescript
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

export const myServerFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getRequest()
    const header = request.headers.get('x-custom-header')
    // ...
  })
```

### Input Validation

Always validate server function inputs using Zod schemas.

**Pattern:**
```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const createUser = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
    })
  )
  .handler(async ({ data }) => {
    // data is fully typed and validated
    // ...
  })
```

### Error Handling

Server functions can throw errors, redirects, and not-found responses that are handled automatically.

**Pattern:**
```typescript
import { redirect } from '@tanstack/react-router'
import { notFound } from '@tanstack/react-router'

export const getPost = createServerFn()
  .handler(async ({ data }) => {
    const post = await db.findPost(data.id)
    
    if (!post) {
      throw notFound()
    }
    
    if (!post.published) {
      throw redirect({ to: '/login' })
    }
    
    return post
  })
```

## File Organization

### Environment Utilities

- `apps/web/src/lib/env/server-only.ts` - Server-only environment access
- `apps/web/src/lib/env/isomorphic.ts` - Isomorphic environment detection

### Middleware

- `apps/web/src/lib/middleware/auth.ts` - Authentication middleware
- `apps/web/src/start.ts` - Global middleware configuration

### Server Functions

- `apps/web/src/lib/**/*.server.ts` - Server function definitions
- `apps/web/src/lib/**/*.fn.ts` - Server function definitions (alternative naming)

## Best Practices

1. **Never use `process.env` directly** - Always use server-only utilities
2. **Never use `typeof window` checks** - Use isomorphic utilities instead
3. **Always validate server function inputs** - Use Zod schemas
4. **Disable SSR for browser-only routes** - Set `ssr: false` for WebGPU/Canvas routes
5. **Use middleware for shared logic** - Don't duplicate authentication/logging code
6. **Access request via `getRequest()`** - Don't rely on handler parameters for GET requests
7. **Document SSR decisions** - Add comments explaining why SSR is disabled

## Migration Checklist

When refactoring existing code:

- [ ] Replace `process.env` with server-only utilities
- [ ] Replace `typeof window` with isomorphic utilities
- [ ] Add `ssr: false` to routes using browser-only APIs
- [ ] Add middleware to server functions that need authentication
- [ ] Update tests to mock new environment utilities
- [ ] Verify build passes (no server code leakage)

## References

- [TanStack Start Documentation](../../reference/tanstack-start/)
- [Environment Functions Guide](../../reference/tanstack-start/guide/environment-functions.md)
- [Selective SSR Guide](../../reference/tanstack-start/guide/selective-ssr.md)
- [Middleware Guide](../../reference/tanstack-start/guide/middleware.md)
- [Server Functions Guide](../../reference/tanstack-start/guide/server-functions.md)
