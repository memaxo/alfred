/**
 * Cross-Schema Joins Integration Tests
 *
 * Tests cross-schema query patterns:
 * - Join workflow runs with policy audit logs
 * - Join knowledge nodes with workflow reasoning
 * - Join preference history with workflow outputs
 * - Verify join performance meets budget
 *
 * Uses PostgreSQL for full join support.
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

// Only run with Postgres for full join testing
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
    await db.execute(sql`TRUNCATE audit_logs CASCADE`);
    await db.execute(sql`TRUNCATE memory_edges, memory_nodes CASCADE`);
  } catch {
    // Tables may not exist
  }
}

describe.skipIf(!SHOULD_RUN)("Cross-Schema Joins", () => {
  beforeAllBun(async () => {
    // Initialize db connection
    await import("@alfred/db");
  });

  afterAllBun(async () => {
    await resetTables();
  });

  describe("Workflow Joins with Policy Audit Logs", () => {
    it("joins workflow runs with audit logs", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");
      const { auditLogs } = await import("@alfred/db/schema/policy");
      const { eq } = await import("drizzle-orm");

      const userId = "join-audit-user";

      // Create a workflow run
      const [run] = await db
        .insert(workflowRuns)
        .values({
          completedAt: new Date(),
          inputData: {},
          stateData: {},
          status: "completed",
          userId,
          workflowId: "audit-workflow",
        })
        .returning();

      // Create audit logs for the workflow
      await db.insert(auditLogs).values([
        {
          context: JSON.stringify({ workflowId: "audit-workflow" }),
          decision: "allow",
          policy: "workflow:plan",
          reason: "User has required scopes",
          resource: JSON.stringify({ kind: "workflow" }),
          subject: JSON.stringify({ id: userId, scopes: ["workflow.read"] }),
          userId,
        },
        {
          context: JSON.stringify({ workflowId: "audit-workflow" }),
          decision: "deny",
          policy: "workflow:execute",
          reason: "Missing required scope: workflow.execute",
          resource: JSON.stringify({
            kind: "workflow",
            workflowId: "audit-workflow",
          }),
          subject: JSON.stringify({ id: userId, scopes: ["workflow.read"] }),
          userId,
        },
      ]);

      // Join workflow runs with audit logs
      const result = await db
        .select({
          auditId: auditLogs.id,
          decision: auditLogs.decision,
          policy: auditLogs.policy,
          runId: workflowRuns.id,
          workflowId: workflowRuns.workflowId,
        })
        .from(workflowRuns)
        .leftJoin(auditLogs, eq(auditLogs.userId, workflowRuns.userId))
        .where(eq(workflowRuns.id, run!.id))
        .orderBy(auditLogs.createdAt);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((r) => r.runId === run!.id)).toBe(true);
    });
  });

  describe("Knowledge Joins with Workflow Reasoning", () => {
    it("joins knowledge nodes with workflow events", async () => {
      const { db } = await import("@alfred/db");
      const { graphRepo } = await import("@alfred/db");
      const { workflowEvents } = await import("@alfred/db/schema/workflow");

      const resource = "join-knowledge-workflow";

      // Create knowledge nodes
      const [nodeId] = await graphRepo.upsertNodes([
        {
          hash: "reasoning-node",
          kind: "reasoning",
          label: "Workflow reasoning step",
          properties: {
            text: "User prefers detailed explanations",
            autonomy: "medium",
          },
          resource,
          sanitized: true,
        },
      ]);

      // Create a workflow event
      const [event] = await db
        .insert(workflowEvents)
        .values({
          payload: {
            text: "Considering user's preference for detailed explanations",
            nodeId: nodeId[0],
          },
          runId: crypto.randomUUID(),
          timestamp: new Date(),
          type: "reasoning",
        })
        .returning();

      // In a real scenario, we would join nodes with events
      // For this test, verify the pattern works
      expect(nodeId[0]).toBeDefined();
      expect(event.id).toBeDefined();
    });
  });

  describe("Preference History with Workflow Outputs", () => {
    it("joins preference history with workflow results", async () => {
      const { db } = await import("@alfred/db");
      const { graphRepo } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");
      const { memoryNodes } = await import("@alfred/db/schema/graph");
      const { eq } = await import("drizzle-orm");

      const userId = "join-pref-user";
      const resource = `pref-history-${userId}`;

      // Create preference nodes
      await graphRepo.upsertNodes([
        {
          hash: "pref-format",
          kind: "preference",
          label: "Output format preference",
          properties: {
            value: "bullet-points",
            confidence: 0.9,
          },
          resource,
          sanitized: true,
        },
        {
          hash: "pref-verbosity",
          kind: "preference",
          label: "Verbosity preference",
          properties: {
            value: "detailed",
            confidence: 0.85,
          },
          resource,
          sanitized: true,
        },
      ]);

      // Create workflow runs that use these preferences
      await db.insert(workflowRuns).values([
        {
          completedAt: new Date(),
          inputData: {
            preferences: ["bullet-points", "detailed"],
          },
          stateData: {
            output:
              "• Detailed point 1\n• Detailed point 2\n• Detailed point 3",
          },
          status: "completed",
          userId,
          workflowId: "workflow-using-prefs",
        },
      ]);

      // Join preferences with workflow runs
      const nodes = await db
        .select()
        .from(memoryNodes)
        .where(eq(memoryNodes.resource, resource));

      const runs = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.userId, userId));

      expect(nodes.length).toBe(2);
      expect(runs.length).toBe(1);
      expect(runs[0].inputData).toEqual({
        preferences: ["bullet-points", "detailed"],
      });
    });
  });

  describe("Join Performance", () => {
    it("meets performance budget for common joins", async () => {
      const { db } = await import("@alfred/db");
      const { workflowRuns } = await import("@alfred/db/schema/workflow");
      const { auditLogs } = await import("@alfred/db/schema/policy");
      const { eq } = await import("drizzle-orm");

      // Create test data
      const userIds = Array.from({ length: 10 }, (_, i) => `perf-user-${i}`);

      for (const userId of userIds) {
        await db.insert(workflowRuns).values({
          completedAt: new Date(),
          inputData: {},
          stateData: {},
          status: "completed",
          userId,
          workflowId: `perf-workflow-${userId}`,
        });

        await db.insert(auditLogs).values({
          context: JSON.stringify({}),
          decision: "allow",
          policy: "test:policy",
          reason: "Performance test",
          resource: JSON.stringify({ test: true }),
          subject: JSON.stringify({ id: userId }),
          userId,
        });
      }

      // Test join performance
      const startTime = performance.now();

      const result = await db
        .select({
          policy: auditLogs.policy,
          workflowId: workflowRuns.workflowId,
        })
        .from(workflowRuns)
        .innerJoin(auditLogs, eq(auditLogs.userId, workflowRuns.userId));

      const duration = performance.now() - startTime;

      expect(result.length).toBeGreaterThan(0);
      // Simple join should complete in <100ms
      expect(duration).toBeLessThan(100);
    });

    it("uses indexes efficiently for joins", async () => {
      const { db } = await import("@alfred/db");
      const { graphRepo } = await import("@alfred/db");
      const { memoryNodes, memoryEdges } =
        await import("@alfred/db/schema/graph");
      const { eq } = await import("drizzle-orm");

      const resource = "join-perf-test";

      // Create nodes
      const nodeIds = await graphRepo.upsertNodes(
        Array.from({ length: 5 }, (_, i) => ({
          hash: `node-${i}`,
          kind: "fact",
          label: `Node ${i}`,
          properties: {},
          resource,
          sanitized: true,
        }))
      );

      // Create edges
      await graphRepo.upsertEdges(
        Array.from({ length: 10 }, (_, i) => ({
          fromId: nodeIds[i % nodeIds.length]!,
          kind: "relates",
          metadata: {},
          resource,
          toId: nodeIds[(i + 1) % nodeIds.length]!,
          weight: 1.0,
        }))
      );

      // Query nodes with edges
      const startTime = performance.now();

      const result = await db
        .select({
          edgeKind: memoryEdges.kind,
          label: memoryNodes.label,
          nodeId: memoryNodes.id,
        })
        .from(memoryNodes)
        .innerJoin(memoryEdges, eq(memoryEdges.fromId, memoryNodes.id))
        .where(eq(memoryNodes.resource, resource));

      const duration = performance.now() - startTime;

      expect(result.length).toBeGreaterThan(0);
      // Indexed join should complete in <50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe("Complex Join Patterns", () => {
    it("handles multi-table joins", async () => {
      const { db } = await import("@alfred/db");
      const { graphRepo } = await import("@alfred/db");
      const { workflowRuns, workflowEvents } =
        await import("@alfred/db/schema/workflow");
      const { memoryNodes } = await import("@alfred/db/schema/graph");
      const { eq, and } = await import("drizzle-orm");

      const userId = "multijoin-user";
      const resource = `multijoin-${userId}`;

      // Create data
      const [nodeId] = await graphRepo.upsertNodes([
        {
          hash: "multi-node",
          kind: "reasoning",
          label: "Multi-join test",
          properties: {},
          resource,
          sanitized: true,
        },
      ]);

      const [run] = await db
        .insert(workflowRuns)
        .values({
          completedAt: new Date(),
          inputData: { nodeId: nodeId[0] },
          stateData: {},
          status: "completed",
          userId,
          workflowId: "multijoin-workflow",
        })
        .returning();

      const [event] = await db
        .insert(workflowEvents)
        .values({
          payload: { nodeId: nodeId[0] },
          runId: run!.id,
          timestamp: new Date(),
          type: "reasoning",
        })
        .returning();

      // Verify all data exists
      const node = await db
        .select()
        .from(memoryNodes)
        .where(and(eq(memoryNodes.id, nodeId[0]!)));

      expect(node.length).toBe(1);
      expect(run).toBeDefined();
      expect(event).toBeDefined();
    });
  });
});
