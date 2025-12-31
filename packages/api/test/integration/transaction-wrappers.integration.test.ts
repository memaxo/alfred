/**
 * Transaction Wrappers Integration Tests
 *
 * Tests database transaction patterns:
 * - Single-query transaction patterns
 * - Batch atomic operations
 * - Transaction rollback on error
 * - Nested transaction handling (savepoints)
 *
 * Uses PostgreSQL for full transaction support.
 */

process.env.DATABASE_URL = process.env.DATABASE_URL ?? "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import {
  afterAll as afterAllBun,
  beforeAll as beforeAllBun,
  describe,
  expect,
  it,
} from "bun:test";

// Only run with Postgres for full transaction testing
const SHOULD_RUN =
  process.env.RUN_DB_TESTS === "1" &&
  !process.env.DATABASE_URL?.includes("sqlite");

// Table cleanup
async function resetTables() {
  if (!SHOULD_RUN) {
    return;
  }
  try {
    const { db } = await import("@alfred/db");
    const { sql } = await import("drizzle-orm");

    await db.execute(sql`TRUNCATE workflow_runs CASCADE`);
    await db.execute(sql`TRUNCATE memory_nodes CASCADE`);
  } catch {
    // Tables may not exist
  }
}

describe.skipIf(!SHOULD_RUN)("Transaction Wrappers", () => {
  beforeAllBun(async () => {
    // Initialize db connection
    await import("@alfred/db");
  });

  afterAllBun(async () => {
    await resetTables();
  });

  describe("Single-Query Transactions", () => {
    it("executes single query in transaction", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");

      await db.transaction(async (tx) => {
        await tx.insert(workflowRuns).values({
          userId: "tx-single-user",
          workflowId: "test-workflow",
          status: "running",
          inputData: {},
          stateData: {},
        });
      });

      // Verify the insert succeeded
      const runs = await db
        .select()
        .from(workflowRuns)
        .where((cols) => cols.userId === "tx-single-user");

      expect(runs.length).toBe(1);
    });
  });

  describe("Batch Atomic Operations", () => {
    it("commits multiple operations atomically", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");
      const { memoryNodes } = await import("@alfred/db/schema/graph");

      const userId = "tx-batch-user";

      // Both inserts should succeed together
      await db.transaction(async (tx) => {
        await tx.insert(workflowRuns).values({
          userId,
          workflowId: "batch-workflow",
          status: "completed",
          inputData: {},
          stateData: {},
          completedAt: new Date(),
        });

        await tx.insert(memoryNodes).values({
          kind: "fact",
          label: "Batch Node",
          resource: `tx-test-${userId}`,
          hash: `batch-hash-${userId}`,
          properties: {},
        });
      });

      // Verify both inserts succeeded
      const runs = await db
        .select()
        .from(workflowRuns)
        .where((cols) => cols.userId === userId);

      const nodes = await db
        .select()
        .from(memoryNodes)
        .where((cols) => cols.resource === `tx-test-${userId}`);

      expect(runs.length).toBe(1);
      expect(nodes.length).toBe(1);
    });
  });

  describe("Transaction Rollback on Error", () => {
    it("rolls back all operations on error", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");
      const { memoryNodes } = await import("@alfred/db/schema/graph");

      const userId = "tx-rollback-user";

      // First insert should succeed
      await db.insert(workflowRuns).values({
        userId,
        workflowId: "initial-workflow",
        status: "completed",
        inputData: {},
        stateData: {},
        completedAt: new Date(),
      });

      try {
        // This transaction should fail and rollback
        await db.transaction(async (tx) => {
          // Insert a workflow run
          await tx.insert(workflowRuns).values({
            userId,
            workflowId: "should-rollback",
            status: "running",
            inputData: {},
            stateData: {},
          });

          // Insert a node
          await tx.insert(memoryNodes).values({
            kind: "fact",
            label: "Should Rollback",
            resource: "tx-rollback-test",
            hash: "rollback-hash",
            properties: {},
          });

          // Trigger an error to cause rollback
          throw new Error("Intentional rollback");
        });

        expect.unreachable("Transaction should have thrown");
      } catch (error: any) {
        expect(error.message).toBe("Intentional rollback");
      }

      // Verify rollback: only the first insert should exist
      const runs = await db
        .select()
        .from(workflowRuns)
        .where((cols) => cols.userId === userId);

      const nodes = await db
        .select()
        .from(memoryNodes)
        .where((cols) => cols.resource === "tx-rollback-test");

      expect(runs.length).toBe(1); // Only the initial insert
      expect(runs[0].workflowId).toBe("initial-workflow");
      expect(nodes.length).toBe(0); // Rolled back
    });

    it("handles unique constraint violations gracefully", async () => {
      const { db } = await import("@alfred/db");
      const { memoryNodes } = await import("@alfred/db/schema/graph");

      const hash = "unique-hash-violation";

      // Create a node with specific hash
      await db.insert(memoryNodes).values({
        kind: "fact",
        label: "Original",
        resource: "violation-test",
        hash,
        properties: {},
      });

      // Try to create duplicate hash in transaction
      try {
        await db.transaction(async (tx) => {
          await tx.insert(memoryNodes).values({
            kind: "fact",
            label: "Duplicate",
            resource: "violation-test",
            hash, // Same hash
            properties: {},
          });
        });

        expect.unreachable("Should have thrown unique constraint error");
      } catch (error: any) {
        // Unique constraint error
        expect(error).toBeDefined();
      }

      // Verify only one node exists
      const nodes = await db
        .select()
        .from(memoryNodes)
        .where((cols) => cols.hash === hash);

      expect(nodes.length).toBe(1);
      expect(nodes[0].label).toBe("Original");
    });
  });

  describe("Nested Transactions (Savepoints)", () => {
    it("uses savepoints for nested operations", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");

      const userId = "tx-nested-user";

      // Outer transaction
      await db.transaction(async (tx) => {
        // First insert
        await tx.insert(workflowRuns).values({
          userId,
          workflowId: "outer-workflow",
          status: "completed",
          inputData: {},
          stateData: {},
          completedAt: new Date(),
        });

        // Nested transaction (savepoint)
        try {
          await db.transaction(async (innerTx) => {
            await innerTx.insert(workflowRuns).values({
              userId,
              workflowId: "inner-workflow",
              status: "completed",
              inputData: {},
              stateData: {},
              completedAt: new Date(),
            });

            throw new Error("Inner transaction error");
          });
        } catch {
          // Inner transaction rolled back, outer continues
        }

        // This should still succeed
        await tx.insert(workflowRuns).values({
          userId,
          workflowId: "outer-workflow-2",
          status: "completed",
          inputData: {},
          stateData: {},
          completedAt: new Date(),
        });
      });

      // Verify: outer inserts succeeded, inner insert failed
      const runs = await db
        .select()
        .from(workflowRuns)
        .where((cols) => cols.userId === userId);

      expect(runs.length).toBe(2);
      expect(runs.map((r) => r.workflowId).sort()).toEqual([
        "outer-workflow",
        "outer-workflow-2",
      ]);
    });
  });

  describe("Transaction Isolation", () => {
    it("maintains isolation between transactions", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");

      const userId = "tx-isolation-user";

      // Transaction 1: Read before write
      const tx1 = db.transaction(async (tx) => {
        const initial = await tx
          .select()
          .from(workflowRuns)
          .where((cols) => cols.userId === userId);

        await tx.insert(workflowRuns).values({
          userId,
          workflowId: "tx1-workflow",
          status: "running",
          inputData: {},
          stateData: {},
        });

        return initial.length;
      });

      // Transaction 2: Read concurrently
      const tx2 = db.transaction(
        async (tx) =>
          await tx
            .select()
            .from(workflowRuns)
            .where((cols) => cols.userId === userId)
      );

      const [countBefore, runs] = await Promise.all([tx1, tx2]);

      expect(countBefore).toBe(0); // No rows initially
      expect(runs.length).toBeGreaterThanOrEqual(1); // At least the one from tx1
    });
  });
});
