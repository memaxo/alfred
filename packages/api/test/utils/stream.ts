export type Subscriber<T> = {
  next?: (v: T) => void;
  error?: (err: unknown) => void;
  complete?: () => void;
};

// Wraps different subscription return shapes into a common interface
export function toObservable<T>(candidate: any) {
  if (candidate && typeof candidate.subscribe === "function") {
    return candidate;
  }
  if (candidate && typeof candidate[Symbol.asyncIterator] === "function") {
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

