# TanStack Start Patterns

1. **Routes.** Use `createFileRoute` for HTTP endpoints and UI routes. Keep route filenames single-word and lower case.
2. **Data fetching.** Interact with the API through the generated tRPC hooks (`useTRPC`, `useTRPCClient`). Avoid manual `fetch` unless crossing service boundaries.
3. **Auth.** Leverage `authClient` hooks for session-aware components. Guard pages by checking `session` in loaders or component-level redirects.
4. **Browser safety.** Never import server-only modules (db, metrics registry) in components that render on the client. Use API routes instead.
5. **Design system.** Reuse UI primitives from `@/components/ui/*`. Extend with Tailwind utility classes instead of bespoke CSS files.
