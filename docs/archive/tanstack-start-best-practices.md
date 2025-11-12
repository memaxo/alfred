# TanStack Start Best Practices for Agent Rules

## Best Practice 1: Use File-Based Routing with createFileRoute

**Explanation:** TanStack Start uses file-based routing where route paths are automatically managed by the router bundler plugin, ensuring proper code-splitting and type safety.

**Example:**
```typescript
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  component: PostComponent,
})
```

**Agent Rule:** Always use `createFileRoute` for route definitions. Never manually construct route paths - the router automatically manages paths based on file structure. Route paths are automatically written and updated by the TanStack Router Bundler Plugin.

## Best Practice 2: Always Export getRouter Function

**Explanation:** The router must be created fresh on each request by exporting a `getRouter` function that returns a new router instance.

**Example:**
```typescript
// src/router.tsx
export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  })
  return router
}
```

**Agent Rule:** Always export a `getRouter` function that returns a new router instance. Never export a singleton router instance directly. This ensures proper SSR and request isolation.

## Best Practice 3: Include HeadContent and Scripts in Root Route

**Explanation:** The root route must include `HeadContent` in the `<head>` and `Scripts` in the `<body>` for proper SSR and client hydration.

**Example:**
```typescript
export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

**Agent Rule:** Always render `HeadContent` in the `<head>` and `Scripts` in the `<body>` of the root route layout. These components are required for proper SSR functionality and client-side JavaScript loading.

## Best Practice 4: Use Server Functions for Server-Only Logic

**Explanation:** Server functions provide type-safe RPC calls that execute on the server but can be called from anywhere in the application, maintaining type safety across the network boundary.

**Example:**
```typescript
import { createServerFn } from '@tanstack/react-start'

export const getServerTime = createServerFn().handler(async () => {
  return new Date().toISOString()
})

// Call from anywhere - components, loaders, hooks
const time = await getServerTime()
```

**Agent Rule:** Use `createServerFn()` for all server-only operations (database access, environment variables, file system). Never assume route loaders are server-only - they run on both server and client. Use server functions for operations that must only run on the server.

## Best Practice 5: Validate Server Function Inputs with Zod

**Explanation:** Server functions accept a single data parameter that must be validated since they cross the network boundary, ensuring type safety and runtime correctness.

**Example:**
```typescript
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
})

export const createUser = createServerFn({ method: 'POST' })
  .inputValidator(UserSchema)
  .handler(async ({ data }) => {
    // data is fully typed and validated
    return `Created user: ${data.name}, age ${data.age}`
  })
```

**Agent Rule:** Always validate server function inputs using `.inputValidator()` with Zod schemas. Never trust unvalidated data from the client. Input validation ensures type safety and prevents runtime errors.

## Best Practice 6: Use Route-Level Error Boundaries

**Explanation:** TanStack Start uses TanStack Router's route-level error boundaries. Set a default error component via the router and override per-route with `errorComponent`.

**Example:**
```typescript
// src/router.tsx
export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultErrorComponent: ({ error, reset }) => (
      <div>
        <p>Error: {error.message}</p>
        <button onClick={reset}>Retry</button>
      </div>
    ),
  })
  return router
}

// Per-route override
export const Route = createFileRoute('/posts/$postId')({
  component: PostComponent,
  errorComponent: PostError,
})
```

**Agent Rule:** Always configure error boundaries at the router level with `defaultErrorComponent` and override per-route with `errorComponent` when needed. Use `beforeLoad`/`loader` to throw errors that will be caught by error boundaries. Call `reset()` to retry rendering after fixing state.

## Best Practice 7: Compose Middleware Hierarchically

**Explanation:** Middleware is composable - one middleware can depend on another, creating a chain that executes hierarchically and in order. Always call `next()` to progress the middleware chain.

**Example:**
```typescript
import { createMiddleware } from '@tanstack/react-start'

const loggingMiddleware = createMiddleware().server(() => {
  // ...
})

const authMiddleware = createMiddleware()
  .middleware([loggingMiddleware])
  .server(async ({ next }) => {
    const result = await next()
    return result
  })
```

**Agent Rule:** Compose middleware using `.middleware([...])` to create dependency chains. Always call `next()` in `.server()` methods to progress the chain. Use `next({ context: {...} })` to pass data to nested middleware. Request middleware cannot depend on server function middleware, but server function middleware can depend on request middleware.

## Best Practice 8: Use Selective SSR for Browser-Only Routes

**Explanation:** Configure which routes execute `beforeLoad`/`loader` on the server and which route components render on the server using the `ssr` property.

**Example:**
```typescript
export const Route = createFileRoute('/canvas')({
  ssr: false, // Disable SSR for browser-only APIs
  component: CanvasComponent,
})

// Or use functional form for dynamic decisions
export const Route = createFileRoute('/docs/$docType/$docId')({
  ssr: ({ params, search }) => {
    if (params.value.docType === 'sheet') return false
    if (search.value.details) return 'data-only'
    return true
  },
})
```

**Agent Rule:** Use `ssr: false` for routes requiring browser-only APIs (localStorage, canvas). Use `ssr: 'data-only'` to run loaders on server but render components on client. Child routes inherit parent SSR config but can only make it more restrictive (true → data-only/false, data-only → false). Never assume all routes are SSR'd by default.

## Best Practice 9: Stream Data with Typed ReadableStreams or Async Generators

**Explanation:** Server functions can return typed `ReadableStream` or async generators for streaming data to clients, maintaining type safety throughout the stream.

**Example:**
```typescript
// Using ReadableStream
const streamingResponseFn = createServerFn().handler(async () => {
  const messages: Message[] = generateMessages()
  const stream = new ReadableStream({
    async start(controller) {
      for (const message of messages) {
        controller.enqueue(message)
      }
      controller.close()
    },
  })
  return stream
})

// Using async generator (cleaner)
const streamingWithGeneratorFn = createServerFn().handler(
  async function* () {
    const messages: Message[] = generateMessages()
    for (const msg of messages) {
      await sleep(500)
      yield msg // Typed as Message
    }
  },
)
```

**Agent Rule:** Use async generators (`async function*`) for streaming data from server functions - they're cleaner and maintain type safety. Stream chunks are typed based on the yield type. Prefer async generators over ReadableStream for simpler streaming patterns.

## Best Practice 10: Use Server Routes for HTTP Endpoints

**Explanation:** Server routes allow creating server-side endpoints alongside TanStack Router routes in the same file structure, useful for raw HTTP requests, form submissions, and API endpoints.

**Example:**
```typescript
// routes/hello.ts
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return json({ message: 'Hello, World!' })
      },
      POST: async ({ request }) => {
        const body = await request.json()
        return json({ message: `Hello, ${body.name}!` })
      },
    },
  },
})
```

**Agent Rule:** Use server routes (`server.handlers`) for HTTP endpoints that need raw request/response handling. Use `json()` helper for JSON responses. Server routes can coexist with route components in the same file. Apply middleware via `server.middleware` for all handlers or use `createHandlers` for handler-specific middleware.

## Best Practice 11: Protect Routes with beforeLoad

**Explanation:** Use `beforeLoad` in route definitions to check authentication and authorization before rendering, throwing redirects for unauthorized access.

**Example:**
```typescript
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { user }
  },
})
```

**Agent Rule:** Use `beforeLoad` for route protection and authentication checks. Throw `redirect()` from `@tanstack/react-router` to redirect unauthorized users. Return context data from `beforeLoad` to pass to child routes via `Route.useRouteContext()`. `beforeLoad` runs on both server (SSR) and client (navigation).

## Best Practice 12: Use createServerOnlyFn for Server Utilities

**Explanation:** Use `createServerOnlyFn` for utility functions that must only run on the server and should crash if called from the client, preventing accidental exposure of server-only code.

**Example:**
```typescript
import { createServerOnlyFn } from '@tanstack/react-start'

const getSecret = createServerOnlyFn(() => process.env.API_SECRET)

// Usage in server function
const getData = createServerFn().handler(async () => {
  const secret = getSecret() // ✅ Works
  return fetch(`/api/data?key=${secret}`)
})
```

**Agent Rule:** Use `createServerOnlyFn()` for server-only utilities (environment variables, file system access). Never access `process.env` directly in isomorphic code - it exposes secrets to the client bundle. Use `createServerOnlyFn` to ensure server-only code crashes if accidentally called from client.

## Best Practice 13: Use createIsomorphicFn for Environment-Specific Logic

**Explanation:** Use `createIsomorphicFn` when you need different implementations for server and client environments, maintaining type safety while allowing environment-specific behavior.

**Example:**
```typescript
import { createIsomorphicFn } from '@tanstack/react-start'

const storage = createIsomorphicFn()
  .server((key: string) => {
    const fs = require('node:fs')
    return JSON.parse(fs.readFileSync('.cache', 'utf-8'))[key]
  })
  .client((key: string) => {
    return JSON.parse(localStorage.getItem(key) || 'null')
  })
```

**Agent Rule:** Use `createIsomorphicFn()` when you need different server/client implementations. Prefer this over manual `typeof window` checks - the framework handles environment detection and tree-shaking. Always provide both `.server()` and `.client()` implementations.

## Best Practice 14: Prevent Hydration Mismatches

**Explanation:** Ensure server-rendered HTML matches client render to prevent hydration errors. Use deterministic values, cookies for client context, or `ClientOnly` wrapper for inherently dynamic content.

**Example:**
```typescript
// ❌ Causes hydration mismatch
function CurrentTime() {
  return <div>{new Date().toLocaleString()}</div>
}

// ✅ Consistent rendering
function CurrentTime() {
  const [time, setTime] = useState<string>()
  useEffect(() => {
    setTime(new Date().toLocaleString())
  }, [])
  return <div>{time || 'Loading...'}</div>
}

// ✅ Or use ClientOnly
import { ClientOnly } from '@tanstack/react-router'
function CurrentTime() {
  return (
    <ClientOnly>
      {() => <div>{new Date().toLocaleString()}</div>}
    </ClientOnly>
  )
}
```

**Agent Rule:** Never render time-dependent, random, or locale-dependent content directly in SSR components. Use `useState` + `useEffect` for client-only updates or wrap in `ClientOnly` component. Use cookies to pass client context (timezone, locale) to server for deterministic rendering. Use `suppressHydrationWarning` sparingly and only for known-different nodes.

## Best Practice 15: Secure Environment Variables

**Explanation:** Server functions can access any `process.env` variable, but client code can only access variables prefixed with `VITE_`. Never expose secrets to the client bundle.

**Example:**
```typescript
// ✅ Server function - can access any env var
const getData = createServerFn().handler(async () => {
  const secret = process.env.SECRET_API_KEY // Server-only
  return fetch(`/api/data?key=${secret}`)
})

// ✅ Client code - only VITE_ prefixed
export function AppHeader() {
  const appName = import.meta.env.VITE_APP_NAME // Client-safe
  return <h1>{appName}</h1>
}

// ❌ WRONG - Secret exposed to client bundle
const config = {
  apiKey: import.meta.env.VITE_SECRET_API_KEY, // This will be in JS bundle!
}
```

**Agent Rule:** Never use `VITE_` prefix for secrets, API keys, or database URLs. Access secrets only in server functions via `process.env`. Use `VITE_` prefix only for public configuration needed by client code. Validate required environment variables at startup using Zod schemas.

## Best Practice 16: Use Route Loaders for Data Fetching

**Explanation:** Route loaders are isomorphic - they run on both server (during SSR) and client (during navigation). Use them for data fetching that should happen on both environments.

**Example:**
```typescript
export const Route = createFileRoute('/posts')({
  loader: async () => {
    // Runs on server during SSR AND on client during navigation
    const response = await fetch('/api/posts')
    return response.json()
  },
  component: PostList,
})

function PostList() {
  const posts = Route.useLoaderData()
  return <div>{/* render posts */}</div>
}
```

**Agent Rule:** Use route `loader` for isomorphic data fetching. Loaders run on both server (SSR) and client (navigation). Access loader data via `Route.useLoaderData()`. Never assume loaders are server-only - they're isomorphic by default. Use server functions inside loaders for server-only operations.

## Best Practice 17: Configure Static Prerendering Properly

**Explanation:** Use static prerendering to generate static HTML files at build time. Configure `prerender` options in `vite.config.ts` to control which routes are prerendered.

**Example:**
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
        concurrency: 14,
        filter: ({ path }) => !path.startsWith('/do-not-render-me'),
      },
    }),
  ],
})
```

**Agent Rule:** Enable static prerendering via `prerender.enabled` in vite config. Use `autoStaticPathsDiscovery` to automatically discover static routes. Use `crawlLinks` to prerender linked pages. Exclude dynamic routes (with `$` params) and layout routes (prefixed with `_`) from automatic discovery. Use `filter` function to exclude specific paths.

## Best Practice 18: Handle Server Function Errors Properly

**Explanation:** Server functions can throw errors, redirects, and not-found responses that are automatically handled when called from route lifecycles or components using `useServerFn()`.

**Example:**
```typescript
import { createServerFn } from '@tanstack/react-start'
import { redirect, notFound } from '@tanstack/react-router'

export const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw redirect({ to: '/login' })
  }
  return user
})

export const getPost = createServerFn()
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const post = await db.findPost(data.id)
    if (!post) {
      throw notFound()
    }
    return post
  })
```

**Agent Rule:** Throw `redirect()` from `@tanstack/react-router` for authentication redirects. Throw `notFound()` for missing resources. Errors are serialized to the client automatically. Always wrap server function calls in try/catch when called from components. Use `useServerFn()` hook for server functions called from components.

## Best Practice 19: Use Middleware for Cross-Cutting Concerns

**Explanation:** Use middleware for authentication, logging, observability, and other cross-cutting concerns that apply to multiple routes or server functions.

**Example:**
```typescript
// Global request middleware
const loggingMiddleware = createMiddleware().server(async ({ next, request }) => {
  const start = Date.now()
  const result = await next()
  const duration = Date.now() - start
  console.log(`${request.method} ${request.url} - ${duration}ms`)
  return result
})

// Global server function middleware
const authMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next, context }) => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    return next({ context: { ...context, user } })
  })

// In src/start.ts
export const startInstance = createStart(() => ({
  requestMiddleware: [loggingMiddleware],
  functionMiddleware: [authMiddleware],
}))
```

**Agent Rule:** Use global middleware (`requestMiddleware`, `functionMiddleware`) in `createStart()` for cross-cutting concerns. Request middleware runs before every request (server routes, SSR, server functions). Server function middleware runs before every server function. Compose middleware hierarchically using `.middleware([...])`. Always call `next()` to progress the middleware chain.

## Best Practice 20: Validate Client-Sent Context in Middleware

**Explanation:** When sending context from client to server via `sendContext`, validate it in server-side middleware before using it, as client-sent context is not automatically validated.

**Example:**
```typescript
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const requestLogger = createMiddleware({ type: 'function' })
  .client(async ({ next, context }) => {
    return next({
      sendContext: {
        workspaceId: context.workspaceId,
      },
    })
  })
  .server(async ({ next, data, context }) => {
    // Validate the workspace ID before using it
    const workspaceId = zodValidator(z.string().uuid()).parse(context.workspaceId)
    console.log('Workspace ID:', workspaceId)
    return next()
  })
```

**Agent Rule:** Always validate client-sent context in server-side middleware before using it. Client context is type-safe but not runtime-validated. Use Zod validators via `zodValidator()` to validate dynamic user-generated data sent via `sendContext`. Never trust unvalidated client context for security-sensitive operations.

