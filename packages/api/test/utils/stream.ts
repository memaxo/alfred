export type Subscriber<T> = {
  next?: (v: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};

// Wraps different subscription return shapes into a common interface
export function toObservable<T>(candidate: unknown) {
  if (
    candidate &&
    typeof (candidate as Record<string, unknown>).subscribe === "function"
  ) {
    return candidate as { subscribe: (sub: Subscriber<T>) => void };
  }
  if (
    candidate &&
    typeof (candidate as Record<string, unknown>)[Symbol.asyncIterator] ===
      "function"
  ) {
    return {
      subscribe(sub: Subscriber<T>) {
        (async () => {
          try {
            for await (const ev of candidate as AsyncGenerator<T>) {
              sub.next?.(ev);
            }
            sub.complete?.();
          } catch (err) {
            sub.error?.(err);
          }
        })();
        return () => {};
      },
    };
  }
  // Fallback: treat as immediately completed
  return {
    subscribe(sub: Subscriber<T>) {
      sub.complete?.();
      return () => {};
    },
  };
}
