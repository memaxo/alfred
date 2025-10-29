# Streaming Patterns

## Core Rules

1. **Typed events only.** Stream payloads must use the canonical `StreamEvent` discriminated unions from `@alfred/type/stream`; do not invent ad-hoc shapes.
2. **Pure handlers.** Transform events in pure functions. Keep side effects (logging, navigation, metrics) in dedicated callbacks and never inside render bodies.
3. **Stable consumers.** Wrap streaming hooks in `useCallback`/`useMemo` so handler identities stay stable across renders; avoid inline lambdas in JSX.
4. **Cache handoff first.** Handle `cache_handoff` events before other mutations and update TanStack Query via `setQueryData` without intermediate state.
5. **Error isolation.** Emit an explicit error state for `error` events and surface retry affordances. Never swallow errors silently.
6. **Progressive UI.** Update connection state on `status` events (`connecting` → `connected` → `disconnected`) and gate UI affordances accordingly.
7. **Zero-allocation hot paths.** Reuse buffers for message deltas, avoid spreading arrays on every chunk, and normalise payloads once per event.
8. **Resource scoping.** Streams require `thread`, `agent`, and `resource` identifiers. Ensure hooks memoise subscription args to prevent resubscribes.

## Hook Checklist

- Subscribe via `trpc.<agent>.stream.useSubscription` (or the equivalent).  
- Provide `onData`, `onError`, `onStarted`, and `onComplete` handlers; forward errors to an error boundary or toast.  
- Return `{ messages, actions, status, send }` from hooks, keeping state updates batched.  
- Clean up subscriptions on unmount and when dependencies change (Bun/React handles this automatically when options are stable).  
- Surface offline cases: if the websocket drops, emit `status="disconnected"` and prompt the user to retry.
