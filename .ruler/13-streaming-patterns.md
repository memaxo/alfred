# Streaming Patterns

## Core Rules

1. **AI SDK v6 native streaming.** Use AI SDK v6 streaming utilities (`streamText`, `toUIMessageStreamResponse`, `useChat`) instead of custom streaming implementations. See `.ruler/15-ai-sdk-v6.md` for details.

2. **Typed events only.** Stream payloads must use the canonical `StreamEvent` discriminated unions from `@alfred/type/stream`; do not invent ad-hoc shapes.

3. **Pure handlers.** Transform events in pure functions. Keep side effects (logging, navigation, metrics) in dedicated callbacks and never inside render bodies.

4. **Stable consumers.** Wrap streaming hooks in `useCallback`/`useMemo` so handler identities stay stable across renders; avoid inline lambdas in JSX.

5. **Cache handoff first.** Handle `cache_handoff` events before other mutations and update TanStack Query via `setQueryData` without intermediate state.

6. **Error isolation.** Emit an explicit error state for `error` events and surface retry affordances. Never swallow errors silently.

7. **Progressive UI.** Update connection state on `status` events (`connecting` → `connected` → `disconnected`) and gate UI affordances accordingly.

8. **Zero-allocation hot paths.** Reuse buffers for message deltas, avoid spreading arrays on every chunk, and normalise payloads once per event.

9. **Resource scoping.** Streams require `thread`, `agent`, and `resource` identifiers. Ensure hooks memoise subscription args to prevent resubscribes.

10. **AbortSignal propagation.** Always propagate abort signals through async chains. Use `AbortController` and pass `signal` to async operations.

11. **AI SDK v6 abort handling.** Use `onAbort` callback in `streamText()` for cleanup when streams are aborted.

12. **UI message stream abort.** Always use `consumeStream` with `toUIMessageStreamResponse` to ensure `onFinish` is called on abort.

14. **Stream accumulation.** Use typed accumulators to segregate and buffer interleaved stream content (reasoning, artifacts, output) before processing, ensuring partial chunks do not corrupt state.

## Hook Checklist

- Subscribe via `trpc.<agent>.stream.useSubscription` (or the equivalent).  
- Provide `onData`, `onError`, `onStarted`, and `onComplete` handlers; forward errors to an error boundary or toast.  
- Return `{ messages, actions, status, send }` from hooks, keeping state updates batched.  
- Clean up subscriptions on unmount and when dependencies change (Bun/React handles this automatically when options are stable).  
- Surface offline cases: if the websocket drops, emit `status="disconnected"` and prompt the user to retry.
