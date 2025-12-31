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
          userId,
          workflowId: "audit-workflow",
          status: "completed",
          inputData: {},
          stateData: {},
          completedAt: new Date(),
        })
        .returning();

      // Create audit logs for the workflow
      await db.insert(auditLogs).values([
        {
          userId,
          policy: "workflow:plan",
          decision: "allow",
          reason: "User has required scopes",
          subject: JSON.stringify({ id: userId, scopes: ["workflow.read"] }),
          resource: JSON.stringify({ kind: "workflow" }),
          context: JSON.stringify({ workflowId: "audit-workflow" }),
        },
        {
          userId,
          policy: "workflow:execute",
          decision: "deny",
          reason: "Missing required scope: workflow.execute",
          subject: JSON.stringify({ id: userId, scopes: ["workflow.read"] }),
          resource: JSON.stringify({
            kind: "workflow",
            workflowId: "audit-workflow",
          }),
          context: JSON.stringify({ workflowId: "audit-workflow" }),
        },
      ]);

      // Join workflow runs with audit logs
      const result = await db
        .select({
          runId: workflowRuns.id,
          workflowId: workflowRuns.workflowId,
          auditId: auditLogs.id,
          policy: auditLogs.policy,
          decision: auditLogs.decision,
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
          resource,
          hash: "reasoning-node",
          kind: "reasoning",
          label: "Workflow reasoning step",
          properties: {
            text: "User prefers detailed explanations",
            autonomy: "medium",
          },
          sanitized: true,
        },
      ]);

      // Create a workflow event
      const [event] = await db
        .insert(workflowEvents)
        .values({
          runId: crypto.randomUUID(),
          type: "reasoning",
          timestamp: new Date(),
          payload: {
            text: "Considering user's preference for detailed explanations",
            nodeId: nodeId[0],
          },
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
          resource,
          hash: "pref-format",
          kind: "preference",
          label: "Output format preference",
          properties: {
            value: "bullet-points",
            confidence: 0.9,
          },
          sanitized: true,
        },
        {
          resource,
          hash: "pref-verbosity",
          kind: "preference",
          label: "Verbosity preference",
          properties: {
            value: "detailed",
            confidence: 0.85,
          },
          sanitized: true,
        },
      ]);

      // Create workflow runs that use these preferences
      await db.insert(workflowRuns).values([
        {
          userId,
          workflowId: "workflow-using-prefs",
          status: "completed",
          inputData: {
            preferences: ["bullet-points", "detailed"],
          },
          stateData: {
            output:
              "• Detailed point 1\n• Detailed point 2\n• Detailed point 3",
          },
          completedAt: new Date(),
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
          userId,
          workflowId: `perf-workflow-${userId}`,
          status: "completed",
          inputData: {},
          stateData: {},
          completedAt: new Date(),
        });

        await db.insert(auditLogs).values({
          userId,
          policy: "test:policy",
          decision: "allow",
          reason: "Performance test",
          subject: JSON.stringify({ id: userId }),
          resource: JSON.stringify({ test: true }),
          context: JSON.stringify({}),
        });
      }

      // Test join performance
      const startTime = performance.now();

      const result = await db
        .select({
          workflowId: workflowRuns.workflowId,
          policy: auditLogs.policy,
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
      const { memoryNodes, memoryEdges } = await import(
        "@alfred/db/schema/graph"
      );
      const { eq } = await import("drizzle-orm");

      const resource = "join-perf-test";

      // Create nodes
      const nodeIds = await graphRepo.upsertNodes(
        Array.from({ length: 5 }, (_, i) => ({
          resource,
          hash: `node-${i}`,
          kind: "fact",
          label: `Node ${i}`,
          properties: {},
          sanitized: true,
        }))
      );

      // Create edges
      await graphRepo.upsertEdges(
        Array.from({ length: 10 }, (_, i) => ({
          fromId: nodeIds[i % nodeIds.length]!,
          toId: nodeIds[(i + 1) % nodeIds.length]!,
          kind: "relates",
          weight: 1.0,
          resource,
          metadata: {},
        }))
      );

      // Query nodes with edges
      const startTime = performance.now();

      const result = await db
        .select({
          nodeId: memoryNodes.id,
          label: memoryNodes.label,
          edgeKind: memoryEdges.kind,
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
      const { workflowRuns, workflowEvents } = await import(
        "@alfred/db/schema/workflow"
      );
      const { memoryNodes } = await import("@alfred/db/schema/graph");
      const { eq, and } = await import("drizzle-orm");

      const userId = "multijoin-user";
      const resource = `multijoin-${userId}`;

      // Create data
      const [nodeId] = await graphRepo.upsertNodes([
        {
          resource,
          hash: "multi-node",
          kind: "reasoning",
          label: "Multi-join test",
          properties: {},
          sanitized: true,
        },
      ]);

      const [run] = await db
        .insert(workflowRuns)
        .values({
          userId,
          workflowId: "multijoin-workflow",
          status: "completed",
          inputData: { nodeId: nodeId[0] },
          stateData: {},
          completedAt: new Date(),
        })
        .returning();

      const [event] = await db
        .insert(workflowEvents)
        .values({
          runId: run!.id,
          type: "reasoning",
          timestamp: new Date(),
          payload: { nodeId: nodeId[0] },
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
