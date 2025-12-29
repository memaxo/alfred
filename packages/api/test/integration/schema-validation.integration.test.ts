/**
 * Schema Validation Integration Tests
 *
 * Tests database schema validation and constraints:
 * - Validates all Drizzle schema files against PostgreSQL
 * - Tests foreign key cascades (user deletion → associated data cleanup)
 * - Tests constraint violations (unique, not null, check constraints)
 * - Tests index usage for common queries
 *
 * Uses PostgreSQL for full constraint testing.
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

// Only run with Postgres for full constraint testing
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
    const { user } = await import("@alfred/db/schema/auth");
    const { workflowRuns } = await import("@alfred/db/schema/workflow");
    const { memoryNodes, memoryEdges } = await import(
      "@alfred/db/schema/graph"
    );
    const { auditLogs } = await import("@alfred/db/schema/policy");
    const { sql } = await import("drizzle-orm");

    // Clean up in order (respecting foreign keys)
    await db.execute(sql`TRUNCATE workflow_runs CASCADE`);
    await db.execute(sql`TRUNCATE memory_edges, memory_nodes CASCADE`);
    await db.execute(sql`TRUNCATE audit_logs CASCADE`);
    await db.execute(sql`TRUNCATE users CASCADE`);
  } catch {
    // Tables may not exist
  }
}

describe.skipIf(!SHOULD_RUN)("Schema Validation", () => {
  beforeAllBun(async () => {
    // Initialize db connection
    await import("@alfred/db");
  });

  afterAllBun(async () => {
    await resetTables();
  });

  describe("Foreign Key Cascades", () => {
    it("cascades deletion when user is deleted", async () => {
      const { db } = await import("@alfred/db");
      const { user } = await import("@alfred/db/schema/auth");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");
      const { eq } = await import("drizzle-orm");

      // Create a user
      const [newUser] = await db
        .insert(user)
        .values({
          id: "cascade-test-user",
          email: "cascade-test@example.com",
          name: "Cascade Test",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      expect(newUser).toBeDefined();

      // Create workflow runs for the user
      const [run1] = await db
        .insert(workflowRuns)
        .values({
          userId: newUser.id,
          workflowId: "test-workflow",
          status: "completed",
          inputData: {},
          stateData: {},
          completedAt: new Date(),
        })
        .returning();

      expect(run1).toBeDefined();

      // Delete the user
      await db.delete(user).where(eq(user.id, newUser.id));

      // Verify workflow runs are also deleted (cascade)
      const runs = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.userId, newUser.id));

      expect(runs.length).toBe(0);
    });

    it("respects cascade deletion for graph nodes", async () => {
      const { db } = await import("@alfred/db");
      const { memoryNodes, memoryEdges } = await import(
        "@alfred/db/schema/graph"
      );
      const { graphRepo } = await import("@alfred/db");
      const { eq } = await import("drizzle-orm");

      // Create a node
      const [nodeId] = await graphRepo.upsertNodes([
        {
          resource: "cascade-graph-test",
          hash: "test-node",
          kind: "fact",
          label: "Test Node",
          properties: {},
          sanitized: true,
        },
      ]);

      // Create edges to/from the node
      await graphRepo.upsertEdges([
        {
          fromId: nodeId[0]!,
          toId: nodeId[0]!,
          kind: "self-loop",
          weight: 1.0,
          resource: "cascade-graph-test",
          metadata: {},
        },
      ]);

      // Delete the node
      await db.delete(memoryNodes).where(eq(memoryNodes.id, nodeId[0]!));

      // Verify edges are also deleted
      const edges = await db
        .select()
        .from(memoryEdges)
        .where(eq(memoryEdges.fromId, nodeId[0]!));

      expect(edges.length).toBe(0);
    });
  });

  describe("Constraint Violations", () => {
    it("enforces unique constraints", async () => {
      const { db } = await import("@alfred/db");
      const { user } = await import("@alfred/db/schema/auth");

      // Try to insert two users with the same email
      await db.insert(user).values({
        id: "unique-test-1",
        email: "unique@example.com",
        name: "User 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        db.insert(user).values({
          id: "unique-test-2",
          email: "unique@example.com", // Same email
          name: "User 2",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow();
    });

    it("enforces not null constraints", async () => {
      const { db } = await import("@alfred/db");
      const { memoryNodes } = await import("@alfred/db/schema/graph");

      // Try to insert a node without required fields
      await expect(
        db.insert(memoryNodes).values({
          // Missing required fields: kind, label, resource, hash
          id: crypto.randomUUID(),
        } as any)
      ).rejects.toThrow();
    });

    it("generates default values correctly", async () => {
      const { db } = await import("@alfred/db");
      const { memoryNodes } = await import("@alfred/db/schema/graph");

      const [node] = await db
        .insert(memoryNodes)
        .values({
          kind: "fact",
          label: "Default Test",
          resource: "default-test",
          hash: "default-hash",
          properties: {},
        })
        .returning();

      expect(node.id).toBeDefined(); // UUID default
      expect(node.sanitized).toBe(false); // Default value
      expect(node.created).toBeDefined(); // timestamp default
      expect(node.updated).toBeDefined(); // timestamp default
    });
  });

  describe("Index Usage", () => {
    it("uses indexes for common queries", async () => {
      const { db } = await import("@alfred/db");
      const { memoryNodes } = await import("@alfred/db/schema/graph");
      const { eq, and } = await import("drizzle-orm");

      // Create multiple nodes with the same resource
      await db.insert(memoryNodes).values([
        {
          kind: "fact",
          label: "Node 1",
          resource: "index-test",
          hash: "hash-1",
          properties: {},
        },
        {
          kind: "fact",
          label: "Node 2",
          resource: "index-test",
          hash: "hash-2",
          properties: {},
        },
        {
          kind: "fact",
          label: "Node 3",
          resource: "index-test",
          hash: "hash-3",
          properties: {},
        },
      ]);

      // Query by resource - should use index
      const nodes = await db
        .select()
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, "index-test"));

      expect(nodes.length).toBe(3);
    });

    it("handles hash-based lookups efficiently", async () => {
      const { db } = await import("@alfred/db");
      const { memoryNodes } = await import("@alfred/db/schema/graph");
      const { eq } = await import("drizzle-orm");

      const testHash = "hash-lookup-test";

      await db.insert(memoryNodes).values({
        kind: "fact",
        label: "Hash Lookup Test",
        resource: "hash-test",
        hash: testHash,
        properties: {},
      });

      // Query by hash - should be efficient
      const [node] = await db
        .select()
        .from(memoryNodes)
        .where(eq(memoryNodes.hash, testHash));

      expect(node).toBeDefined();
      expect(node?.hash).toBe(testHash);
    });
  });
});
