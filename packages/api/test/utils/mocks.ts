/**
 * Common mock patterns for test utilities
 * Reusable patterns extracted from test files
 */

/**
 * Mock fetch with recorded response
 */
export function mockFetch(response: unknown, status = 200) {
  return async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    });
}

/**
 * Mock fetch with error
 */
export function mockFetchError(message: string, status = 500) {
  return async () =>
    new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { "content-type": "application/json" },
    });
}

/**
 * Restore original fetch
 */
export function restoreFetch(originalFetch: typeof global.fetch) {
  global.fetch = originalFetch;
}

/**
 * Mock environment variable
 */
export function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => T | Promise<T>
): Promise<T> {
  const originalEnv = process.env;
  const newEnv = { ...originalEnv, ...env };
  process.env = newEnv;
  return Promise.resolve(fn()).finally(() => {
    process.env = originalEnv;
  });
}

/**
 * Mock tRPC subscription callbacks
 */
export interface MockSubscriptionCallbacks {
  onStarted?: (unsubscribe: () => void) => void;
  onData?: (chunk: unknown) => void;
  onError?: (error: unknown) => void;
  onComplete?: () => void;
}

/**
 * Create mock tRPC subscription
 */
export function createMockSubscription(
  mockFn: (input: unknown, options: unknown) => unknown
): MockSubscriptionCallbacks {
  let callbacks: MockSubscriptionCallbacks = {};

  mockFn = ((_input: unknown, options: unknown) => {
    const opts = options as {
      onStarted?: (unsubscribe: () => void) => void;
      onData?: (chunk: unknown) => void;
      onError?: (error: unknown) => void;
      onComplete?: () => void;
      enabled?: boolean;
    };
    callbacks = {
      onStarted: opts?.onStarted,
      onData: opts?.onData,
      onError: opts?.onError,
      onComplete: opts?.onComplete,
    };
    if (opts?.enabled) {
      setTimeout(() => {
        callbacks.onStarted?.(() => {
          callbacks.onComplete?.();
        });
      }, 0);
    }
    return;
  }) as typeof mockFn;

  return callbacks;
}

/**
 * Deterministic embedding vector generator
 */
export function makeVector(seed: number, dim = 1536): number[] {
  return Array.from({ length: dim }, (_, i) => (i === 0 ? seed : 0));
}

/**
 * Wait for async operation with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 10
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}
