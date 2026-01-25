/**
 * Environment detection utilities.
 *
 * NOTE: We intentionally avoid `createIsomorphicFn()` here because Bun unit tests
 * execute these modules outside TanStack Start's bundler context, which can
 * cause `createIsomorphicFn` stubs to return `undefined` at runtime.
 *
 * Keeping these helpers "boring" ensures they work in:
 * - SSR runtime
 * - Client runtime
 * - Bun unit tests
 */

/**
 * Check if test mode is enabled.
 */
export function getTestMode(): Promise<boolean> {
  if (typeof process !== "undefined") {
    const viteTestMode = process.env?.VITE_TEST_MODE;
    const mindscapeTest = process.env?.MINDSCAPE_TEST;
    const bunTest = process.env?.BUN_TEST;
    const nodeEnv = process.env?.NODE_ENV;
    if (
      viteTestMode === "true" ||
      mindscapeTest === "1" ||
      bunTest === "1" ||
      nodeEnv === "test"
    ) {
      return Promise.resolve(true);
    }
  }
  if (typeof import.meta !== "undefined") {
    const { env } = import.meta as ImportMeta & {
      env?: Record<string, string>;
    };
    return Promise.resolve(
      env?.VITE_TEST_MODE === "true" || env?.MINDSCAPE_TEST === "1"
    );
  }
  return Promise.resolve(false);
}

/**
 * Check if window object is available.
 */
export function hasWindow(): boolean {
  return typeof window !== "undefined";
}
