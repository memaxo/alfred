import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../client";
import { workflowEvents, workflowRuns } from "../schema/workflow";

export type WorkflowStatus =
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled";

export async function createRun(args: {
  id?: string;
  userId: string;
  workflowId: string;
  status?: WorkflowStatus;
  inputData?: unknown;
  stateData?: unknown;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
}) {
  const [row] = await db
    .insert(workflowRuns)
    .values({
      id: args.id,
      userId: args.userId,
      workflowId: args.workflowId,
      status: args.status ?? "running",
      inputData: args.inputData as any,
      stateData: args.stateData as any,
      webhookUrl: args.webhookUrl ?? null,
      webhookSecret: args.webhookSecret ?? null,
    })
    .returning();
  return row;
}

export async function updateRun(
  runId: string,
  patch: Partial<{
    status: WorkflowStatus;
    stateData: unknown;
    errorMessage: string | null;
    suspendedAt: Date | null;
    resumedAt: Date | null;
    completedAt: Date | null;
  }>
) {
  const [row] = await db
    .update(workflowRuns)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(Object.hasOwn(patch, "stateData")
        ? { stateData: patch.stateData as any }
        : {}),
      ...(Object.hasOwn(patch, "errorMessage")
        ? { errorMessage: (patch.errorMessage ?? null) as any }
        : {}),
      ...(Object.hasOwn(patch, "suspendedAt")
        ? { suspendedAt: (patch.suspendedAt ?? null) as any }
        : {}),
      ...(Object.hasOwn(patch, "resumedAt")
        ? { resumedAt: (patch.resumedAt ?? null) as any }
        : {}),
      ...(Object.hasOwn(patch, "completedAt")
        ? { completedAt: (patch.completedAt ?? null) as any }
        : {}),
    })
    .where(eq(workflowRuns.id, runId))
    .returning();
  return row;
}

export async function appendEvent(args: {
  runId: string;
  eventType: string;
  eventData?: unknown;
  stepId?: string | null;
  timestamp?: Date;
}) {
  const [row] = await db
    .insert(workflowEvents)
    .values({
      runId: args.runId,
      eventType: args.eventType,
      eventData: (args.eventData ?? null) as any,
      stepId: args.stepId ?? null,
      timestamp: args.timestamp ?? undefined,
    })
    .returning();
  return row;
}

export async function listEvents(runId: string) {
  const rows = await db
    .select()
    .from(workflowEvents)
    .where(eq(workflowEvents.runId, runId))
    .orderBy(desc(workflowEvents.timestamp));
  // Return newest-first list (UI can reverse if needed)
  return rows;
}

export async function getRun(runId: string) {
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);
  return row ?? null;
}

/**
 * Prunes old workflow data based on retention policy.
 * Should be called by a scheduler gated behind env flag per .ruler/02-architecture.md
 */
export async function pruneOldRuns(
  retentionDays = 90
): Promise<{ deletedRuns: number; deletedEvents: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Delete old events first (cascade will handle run cleanup if needed)
  const eventsResult = await db.execute(
    sql`DELETE FROM workflow_events WHERE timestamp < ${cutoffDate}`
  );

  // Delete completed/failed/cancelled runs older than retention period
  const runsResult = await db
    .delete(workflowRuns)
    .where(
      and(
        eq(workflowRuns.status, "completed"),
        lt(workflowRuns.created, cutoffDate)
      )
    )
    .returning();

  // Also delete failed and cancelled runs
  const failedResult = await db
    .delete(workflowRuns)
    .where(
      and(
        eq(workflowRuns.status, "failed"),
        lt(workflowRuns.created, cutoffDate)
      )
    )
    .returning();

  const cancelledResult = await db
    .delete(workflowRuns)
    .where(
      and(
        eq(workflowRuns.status, "cancelled"),
        lt(workflowRuns.created, cutoffDate)
      )
    )
    .returning();

  return {
    deletedRuns:
      runsResult.length + failedResult.length + cancelledResult.length,
    deletedEvents: eventsResult.rowCount ?? 0,
  };
}
