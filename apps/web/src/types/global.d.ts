/**
 * Global type augmentations for web app
 */

declare global {
  // oxlint-disable lint: Required for TypeScript declaration merging
  interface Window {
    __perf?: Record<string, unknown>;
  }
}

export {};
