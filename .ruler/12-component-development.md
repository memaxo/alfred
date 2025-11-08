# Component Development Rules

## Core Principles

- **Composition.** Assemble small, single-purpose components into larger flows.
- **Purity.** Keep render functions deterministic and side-effect free; isolate effects in hooks.
- **Performance.** Minimise allocations, stabilise references, and honour hot-path budgets.
- **Accessibility.** Ship WCAG 2.1 AA interactions with full keyboard support and ARIA metadata.
- **Type Safety.** Share contracts via `@alfred/type`; never re-declare domain models.

## Required Practices

1. **Single-word filenames.** Components, hooks, and routes stay within the naming rules from `.ruler/01-naming-conventions.md`; UI ergonomic exceptions still apply (`chat-container.tsx`, `voice-btn.tsx`, etc.).
2. **Pure render logic.** No side effects, logging, or object creation inside JSX trees. Derive data before render and memoise computed values with `useMemo` when needed.
3. **Stable references.** Wrap components in `React.memo` when they receive props, and stabilise callbacks via `useCallback` so list renders stay constant. Prefer dependency arrays over inline lambdas.
4. **Null safety.** Guard optional data with early returns or conditional rendering. Use nullish coalescing for fallbacks and avoid throwing on missing props.
5. **Accessibility defaults.** Every interactive control exposes role/state/label, supports keyboard navigation, and hides decorative visuals with `aria-hidden="true"`.
6. **Performance budgets.** Target `<1 ms` message renders, `<5 ms` virtualised list mount, `<10 ms` form submissions, `<16 ms` animation frames. Profile hot components before optimising.
7. **Streaming alignment.** Components consuming assistant/workflow streams must rely on hooks such as `useAssistantStream`, handle incremental payloads, and surface error/progress states.
8. **Shared primitives.** Use the canonical primitives under `apps/web/src/components/ui/` for layout and inputs; introduce new foundations only when existing tokens or utilities fail the requirement.

9. **Error boundaries.** Use route-level error boundaries for error handling:
    ```typescript
    // Default error component in router.tsx
    import { createRouter, ErrorComponent } from '@tanstack/react-router';
    
    export function getRouter() {
      const router = createRouter({
        routeTree,
        defaultErrorComponent: ({ error, reset }) => (
          <div>
            <p>Error: {error.message}</p>
            <button onClick={reset}>Retry</button>
          </div>
        ),
      });
      return router;
    }
    
    // Per-route error component
    import { createFileRoute, ErrorComponent } from '@tanstack/react-router';
    import type { ErrorComponentProps } from '@tanstack/react-router';
    
    function RouteError({ error, reset }: ErrorComponentProps) {
      return (
        <div>
          <p>Route error: {error.message}</p>
          <button onClick={reset}>Retry</button>
        </div>
      );
    }
    
    export const Route = createFileRoute('/path')({
      component: Component,
      errorComponent: RouteError,
    });
    ```

10. **Loader error handling.** Loaders can throw errors that are caught by error boundaries:
    ```typescript
    loader: async () => {
      const data = await fetchData();
      if (!data) {
        throw new Error('Data not found');
      }
      return data;
    },
    ```

## Testing Expectations

- Exercise render, interaction, empty, and error states with React Testing Library.
- Verify accessibility with `axe-core` (or equivalent) for critical views.
- Mock streaming hooks deterministically; ensure memoisation keeps rerenders bounded.
