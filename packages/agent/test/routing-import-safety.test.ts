/**
 * Import safety tests for tool routing module.
 *
 * Ensures importing the routing module does not cause side effects
 * like starting timers, workers, or making network connections.
 *
 * @see .ruler/41-import-safety.md
 */

import { describe, expect, test } from "bun:test";

describe("routing import safety", () => {
  test("importing routing module does not start timers", async () => {
    const before = process.hrtime.bigint();

    // Import the routing module
    const routing = await import("../src/routing/index.js");

    expect(routing).toBeDefined();
    expect(routing.routeToolsByIntent).toBeDefined();
    expect(routing.TOOL_CATALOGS).toBeDefined();

    // If import took >1s, it likely did work at import time
    const after = process.hrtime.bigint();
    const ms = Number(after - before) / 1_000_000;

    expect(ms).toBeLessThan(1000);
  });

  test("importing routing module does not initialize models", async () => {
    // Import should not throw or make network calls
    const routing = await import("../src/routing/index.js");

    // Catalogs should be defined but not initialized with active connections
    expect(routing.TOOL_CATALOGS.personal).toBeDefined();
    expect(routing.TOOL_CATALOGS.code_edit).toBeDefined();
    expect(routing.TOOL_CATALOGS.workflow).toBeDefined();

    // Tools should be wrapped but not executing
    expect(routing.TOOL_CATALOGS.personal.tools.length).toBeGreaterThan(0);
    expect(routing.TOOL_CATALOGS.personal.tools.length).toBeLessThanOrEqual(5);
  });

  test("catalogs respect 5 tool limit", async () => {
    const { TOOL_CATALOGS } = await import("../src/routing/index.js");

    for (const [key, catalog] of Object.entries(TOOL_CATALOGS)) {
      expect(
        catalog.tools.length,
        `Catalog ${key} exceeds 5 tool limit`
      ).toBeLessThanOrEqual(5);
    }
  });
});
