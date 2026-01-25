// Reset metrics registry between test runs to avoid re-registration errors
import { metricsRegistry } from "@alfred/metrics/registry";
import { afterAll } from "bun:test";

import { shutdownPool } from "../src/pool.js";

metricsRegistry.clear();

// Shutdown worker pool after all tests complete
afterAll(() => {
  shutdownPool();
});
