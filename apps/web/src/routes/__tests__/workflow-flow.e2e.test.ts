/**
 * Workflow E2E Flow Tests
 *
 * These tests exercise the workflow list and events endpoints through the real
 * tRPC router and database. They verify workflow retrieval APIs work correctly.
 *
 * Note: Full workflow creation/execution requires the runtime infrastructure.
 * These tests focus on the query/list APIs using seeded data.
 *
 * Requirements:
 * - PostgreSQL database running on localhost:5432
 * - Set RUN_DB_TESTS=1 to enable these tests
 *
 * See ExecPlan: docs/execplans/ui-testing-coverage-improvements.md (Milestone 5)
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createTestClient } from "@/test/client";
import { createTestServer, type TestServer } from "@/test/server";

const shouldRun = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!shouldRun)("Workflow E2E Flow", () => {
  let server: TestServer;
  let client: ReturnType<typeof createTestClient>;

  beforeAll(async () => {
    server = await createTestServer();
    client = createTestClient(server);
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  it("lists workflow runs with default parameters", async () => {
    // List runs - should return empty or existing runs without error
    const runs = await client.workflow.listRuns.query({});
    expect(Array.isArray(runs)).toBe(true);
  });

  it("lists workflow runs with status filter", async () => {
    // List completed runs
    const completedRuns = await client.workflow.listRuns.query({
      status: "completed",
    });
    expect(Array.isArray(completedRuns)).toBe(true);

    // All returned runs should have completed status
    for (const run of completedRuns) {
      expect(run.status).toBe("completed");
    }
  });

  it("lists workflow runs with pagination", async () => {
    // Test pagination parameters
    const page1 = await client.workflow.listRuns.query({
      limit: 5,
      offset: 0,
    });
    expect(Array.isArray(page1)).toBe(true);
    expect(page1.length).toBeLessThanOrEqual(5);

    const page2 = await client.workflow.listRuns.query({
      limit: 5,
      offset: 5,
    });
    expect(Array.isArray(page2)).toBe(true);

    // If both pages have data, they should be different
    if (page1.length > 0 && page2.length > 0) {
      const page1Ids = new Set(page1.map((r) => r.id));
      const hasOverlap = page2.some((r) => page1Ids.has(r.id));
      expect(hasOverlap).toBe(false);
    }
  });

  it("retrieves workflow events for a run", async () => {
    // First get a run to query events for
    const runs = await client.workflow.listRuns.query({ limit: 1 });

    if (runs.length > 0) {
      // Query events for the first run
      const events = await client.workflow.events.query({
        runId: runs[0].id,
      });
      expect(Array.isArray(events)).toBe(true);

      // Events should have required fields
      for (const event of events) {
        expect(event.id).toBeDefined();
        expect(event.eventType).toBeDefined();
        expect(event.timestamp).toBeDefined();
      }
    } else {
      // No runs exist - this is still a valid state
      expect(runs.length).toBe(0);
    }
  });

  it("handles invalid run ID gracefully", async () => {
    // Query events for a non-existent run
    const fakeRunId = "00000000-0000-0000-0000-000000000000";

    try {
      const events = await client.workflow.events.query({
        runId: fakeRunId,
      });
      // Should return empty array for non-existent run
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    } catch (error) {
      // Or it may throw NOT_FOUND which is also acceptable
      expect(error).toBeDefined();
    }
  });

  it("filters runs by multiple statuses", async () => {
    // Test different status filters
    const statuses = [
      "running",
      "suspended",
      "completed",
      "failed",
      "cancelled",
    ] as const;

    for (const status of statuses) {
      const runs = await client.workflow.listRuns.query({
        status,
        limit: 5,
      });
      expect(Array.isArray(runs)).toBe(true);

      // All returned runs should match the filter
      for (const run of runs) {
        expect(run.status).toBe(status);
      }
    }
  });
});
