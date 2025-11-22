import { afterAll, mock } from "bun:test";

/**
 * Ensures Bun's module mocks are cleared after each test suite so mocks
 * declared with `mock.module` do not leak into other files when tests run
 * in parallel.
 */
afterAll(() => {
  mock.restore();
});
