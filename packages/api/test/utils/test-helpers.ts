/**
 * Test Helpers for Integration Testing
 *
 * Common utilities used across integration tests:
 * - Audit log verification
 * - Time simulation
 * - Graph helpers
 */

import { db } from "@alfred/db";
import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import { auditLogs } from "@alfred/db/schema/policy";
import { and, eq, type SQL, sql } from "drizzle-orm";

export const isUsingSqlite =
  process.env.DATABASE_URL?.includes("sqlite") ?? false;
export const isUsingPostgres =
  process.env.DATABASE_URL?.includes("postgresql") ?? false;

/**
 * Verify audit logs match expected patterns
 */
export async function verifyAuditLogs(params: {
  userId?: string;
  policy?: string;
  decision?: "allow" | "deny";
  limit?: number;
}): Promise<{
  count: number;
  logs: (typeof auditLogs.$inferSelect)[];
}> {
  const conditions: SQL[] = [];

  if (params.userId) {
    conditions.push(eq(auditLogs.userId, params.userId));
  }
  if (params.policy) {
    conditions.push(sql`${auditLogs.policy} = ${params.policy}`);
  }
  if (params.decision) {
    conditions.push(sql`${auditLogs.decision} = ${params.decision}`);
  }

  const query =
    conditions.length > 0
      ? db
          .select()
          .from(auditLogs)
          .where(and(...conditions))
      : db.select().from(auditLogs);

  const logs = await query.limit(params.limit ?? 100);

  return {
    count: logs.length,
    logs,
  };
}

/**
 * Verify audit log was created for a specific action
 */
export async function verifyAuditLogExists(params: {
  userId: string;
  action: string;
  decision: "allow" | "deny";
}): Promise<boolean> {
  const logs = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, params.userId),
        sql`${auditLogs.policy} LIKE ${`%${params.action}%`}`,
        sql`${auditLogs.decision} = ${params.decision}`
      )
    )
    .limit(1);

  return logs.length > 0;
}

/**
 * Time simulator for deterministic time-based tests
 *
 * Usage:
 * ```typescript
 * const timeSim = createTimeSimulator();
 * await timeSim.advance(1000); // advance by 1 second
 * await timeSim.advance(60000); // advance by 1 minute
 * ```
 */
export function createTimeSimulator() {
  let currentTime = Date.now();

  return {
    now: () => currentTime,

    /**
     * Advance time by milliseconds
     */
    advance: (ms: number) => {
      currentTime += ms;
      return Promise.resolve();
    },

    /**
     * Set absolute time
     */
    set: (timestamp: number) => {
      currentTime = timestamp;
    },

    /**
     * Reset to current system time
     */
    reset: () => {
      currentTime = Date.now();
    },
  };
}

/**
 * Graph helpers for knowledge graph testing
 */
export const graphHelpers = {
  /**
   * Count nodes by resource
   */
  async countNodesByResource(resource: string): Promise<number> {
    const nodes = await db
      .select()
      .from(memoryNodes)
      .where(eq(memoryNodes.resource, resource));

    return nodes.length;
  },

  /**
   * Count edges by kind
   */
  async countEdgesByKind(kind: string): Promise<number> {
    const edges = await db
      .select()
      .from(memoryEdges)
      .where(eq(memoryEdges.kind, kind));

    return edges.length;
  },

  /**
   * Verify graph structure exists
   */
  async verifyGraphStructure(params: {
    kind: string;
    minNodes?: number;
    minEdges?: number;
  }): Promise<boolean> {
    const nodeCount = await graphHelpers.countNodesByResource(params.kind);
    const edgeCount = await graphHelpers.countEdgesByKind(params.kind);

    if (params.minNodes && nodeCount < params.minNodes) {
      return false;
    }
    if (params.minEdges && edgeCount < params.minEdges) {
      return false;
    }
    return true;
  },

  /**
   * Clear graph by resource
   */
  async clearByResource(resource: string): Promise<void> {
    await db.delete(memoryEdges).where(eq(memoryEdges.resource, resource));

    await db.delete(memoryNodes).where(eq(memoryNodes.resource, resource));
  },
};

/**
 * Schedule test harness helper (placeholder)
 *
 * This is a stub for future scheduler integration tests.
 * Real implementation would require background worker infrastructure.
 */
export function createSchedulerTestHarness() {
  return {
    /**
     * Start a scheduler
     */
    start: () => {
      // Placeholder for starting scheduler
      return Promise.resolve();
    },

    /**
     * Stop a scheduler
     */
    stop: () => {
      // Placeholder for stopping scheduler
      return Promise.resolve();
    },

    /**
     * Trigger a scheduled task
     */
    trigger: (_taskName: string) => {
      // Placeholder for triggering tasks
      return Promise.resolve();
    },

    /**
     * Get scheduled task state
     */
    getState: (_taskName: string) => {
      // Placeholder for getting task state
      return Promise.resolve(null);
    },
  };
}
