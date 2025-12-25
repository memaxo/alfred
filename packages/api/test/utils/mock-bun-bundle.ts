import { mock } from "bun:test";

// Bun versions used in some environments may not support `bun:bundle`.
// Provide a stable stub for feature-flagged code paths in tests.
mock.module("bun:bundle", () => ({
  Registry: {
    features: [] as const,
  },
  feature: (_name: string) => false,
}));

