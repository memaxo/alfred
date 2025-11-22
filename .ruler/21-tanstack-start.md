# TanStack Start Rules

1. **File-based routing.** Always use `createFileRoute` for route definitions. Route paths are automatically managed by the router bundler plugin - never manually construct paths. Export routes as `Route` constant.

2. **Router instance.** Always export a `getRouter` function that returns a new router instance. Never export a singleton router directly. This ensures proper SSR and request isolation.

3. **Root route components.** Always render `HeadContent` in `<head>` and `Scripts` in `<body>` of the root route layout. These are required for SSR and client hydration.

4. **Server functions for server-only logic.** Use `createServerFn()` for all server-only operations (database access, environment variables, file system). Never assume route loaders are server-only - they run on both server and client. Use server functions for operations that must only run on the server.

5. **Server function validation.** Always validate server function inputs using `.inputValidator()` with Zod schemas. Never trust unvalidated data from the client. Input validation ensures type safety and prevents runtime errors.

6. **Route loaders are isomorphic.** Route loaders run on both server (SSR) and client (navigation). Never assume loaders are server-only. Use server functions inside loaders for server-only operations. Access loader data via `Route.useLoaderData()`.

7. **Server-only utilities.** Use `createServerOnlyFn()` for server-only utilities (environment variables, file system access). Never access `process.env` directly in isomorphic code - it exposes secrets to the client bundle. Use `createServerOnlyFn` to ensure server-only code crashes if accidentally called from client.

8. **Isomorphic functions.** Use `createIsomorphicFn()` when you need different server/client implementations. Prefer this over manual `typeof window` checks - the framework handles environment detection and tree-shaking. Always provide both `.server()` and `.client()` implementations.

9. **Environment variables.** Server functions can access any `process.env` variable. Client code can only access variables prefixed with `VITE_`. Never use `VITE_` prefix for secrets, API keys, or database URLs. Access secrets only in server functions via `process.env`.

10. **Route protection.** Use `beforeLoad` for route protection and authentication checks. Throw `redirect()` from `@tanstack/react-router` to redirect unauthorized users. Return context data from `beforeLoad` to pass to child routes via `Route.useRouteContext()`. `beforeLoad` runs on both server (SSR) and client (navigation).

11. **Selective SSR.** Use `ssr: false` for routes requiring browser-only APIs (localStorage, canvas). Use `ssr: 'data-only'` to run loaders on server but render components on client. Child routes inherit parent SSR config but can only make it more restrictive (true → data-only/false, data-only → false).

12. **Hydration mismatches.** Never render time-dependent, random, or locale-dependent content directly in SSR components. Use `useState` + `useEffect` for client-only updates or wrap in `ClientOnly` component. Use cookies to pass client context (timezone, locale) to server for deterministic rendering.

13. **Error boundaries.** Always configure error boundaries at the router level with `defaultErrorComponent` and override per-route with `errorComponent` when needed. Use `beforeLoad`/`loader` to throw errors that will be caught by error boundaries. Call `reset()` to retry rendering after fixing state.

14. **Server function errors.** Throw `redirect()` from `@tanstack/react-router` for authentication redirects. Throw `notFound()` for missing resources. Errors are serialized to the client automatically. Always wrap server function calls in try/catch when called from components.

15. **Streaming data.** Use async generators (`async function*`) for streaming data from server functions - they're cleaner and maintain type safety. Stream chunks are typed based on the yield type. Prefer async generators over ReadableStream for simpler streaming patterns.

16. **Server routes.** Use server routes (`server.handlers`) for HTTP endpoints that need raw request/response handling. Use `json()` helper for JSON responses. Server routes can coexist with route components in the same file. Apply middleware via `server.middleware` for all handlers or use `createHandlers` for handler-specific middleware.

17. **Middleware composition.** Compose middleware using `.middleware([...])` to create dependency chains. Always call `next()` in `.server()` methods to progress the chain. Use `next({ context: {...} })` to pass data to nested middleware. Request middleware cannot depend on server function middleware, but server function middleware can depend on request middleware.

18. **Global middleware.** Use global middleware (`requestMiddleware`, `functionMiddleware`) in `createStart()` for cross-cutting concerns. Request middleware runs before every request (server routes, SSR, server functions). Server function middleware runs before every server function.

19. **Client context validation.** Always validate client-sent context in server-side middleware before using it. Client context is type-safe but not runtime-validated. Use Zod validators via `zodValidator()` to validate dynamic user-generated data sent via `sendContext`. Never trust unvalidated client context for security-sensitive operations.

20. **Static prerendering.** Enable static prerendering via `prerender.enabled` in vite config. Use `autoStaticPathsDiscovery` to automatically discover static routes. Use `crawlLinks` to prerender linked pages. Exclude dynamic routes (with `$` params) and layout routes (prefixed with `_`) from automatic discovery.

21. **Variable-Based Dynamic Imports.** To prevent server-only code leakage into client bundles, imports of server packages (db, agent, policy) in API routes MUST use variable-based dynamic imports:
    ```typescript
    // ✅ CORRECT
    const dbPkg = "@alfred/db";
    const { db } = await import(dbPkg);

    // ❌ INCORRECT (Vite will bundle this)
    const { db } = await import("@alfred/db");
    ```

22. **Browser-Only Libraries.** Libraries that access `window` or `document` on import (e.g., `xterm`, `canvas-confetti`) MUST be imported dynamically inside `useEffect` or `componentDidMount`. Never import them at the top level of a component file.

