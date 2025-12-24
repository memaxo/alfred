# TanStack Start Rules

1. **Routing and Layout.** Use `createFileRoute` for routes (exported as `Route`). Always export `getRouter()` for SSR isolation. Render `HeadContent` in `<head>` and `Scripts` in `<body>` of the root layout.

2. **Server and Isomorphic Logic.** Use `createServerFn()` with `.inputValidator()` for server-only operations. Use `createServerOnlyFn()` for server-only utilities (env, fs) and `createIsomorphicFn()` for environment-specific implementations. Access secrets only in server functions.

3. **Loaders and Protection.** Loaders are isomorphic (run on server and client); use server functions inside them for DB access. Use `beforeLoad` for route protection and auth (throws `redirect()`); return context data for child routes.

4. **SSR and Hydration.** Use `ssr: false` for browser-only APIs (WebGPU, Canvas) and `ssr: 'data-only'` for server loaders with client rendering. Avoid rendering non-deterministic content (time, random) in SSR; wrap in `ClientOnly` or use `useState` + `useEffect`.

5. **Error Handling.** Configure `defaultErrorComponent` at router level and `errorComponent` per-route. Server functions should throw `redirect()` or `notFound()` as needed; wrap calls in try/catch in components.

6. **Streaming.** Use async generators (`async function*`) for streaming data from server functions for type safety and simplicity.

7. **Middleware.** Compose middleware via `.middleware([...])`. Use `requireAuthMiddleware` for authenticated server functions. Global middleware (request/function) is configured in `src/start.ts`. Always validate client-sent context in middleware.

8. **Security and Imports.** Use variable-based dynamic imports for server packages in API routes (e.g., `const pkg = "@alfred/db"; await import(pkg)`). Browser-only libraries must be imported dynamically inside `useEffect`.

9. **Server Routes and Prerendering.** Use `server.handlers` for raw HTTP endpoints. Enable static prerendering via vite config, excluding dynamic and layout routes.

10. **Request Access.** Use `getRequest()` from `@tanstack/react-start/server` to access the request object in server functions.

