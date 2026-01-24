/**
 * Workflow trajectory persistence (e.g., Harbor ATIF export).
 */

import { and, desc, eq, sql } from "drizzle-orm";

import type { WorkflowTrajectoryFormat } from "../schema/workflow";

import { db } from "../client";
import { workflowEvents, workflowTrajectories } from "../schema/workflow";

export type WorkflowTrajectoryRow = typeof workflowTrajectories.$inferSelect;

export async function getTrajectoryByRunId(args: {
  runId: string;
  format: WorkflowTrajectoryFormat;
}): Promise<WorkflowTrajectoryRow | null> {
  const rows = await db
    .select()
    .from(workflowTrajectories)
    .where(
      and(
        eq(workflowTrajectories.runId, args.runId),
        eq(workflowTrajectories.format, args.format)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getRunEventMarker(runId: string): Promise<{
  lastEventId: string | null;
  lastSeq: number | null;
}> {
  const rows = await db
    .select({
      lastEventId: workflowEvents.eventId,
      lastSeq: workflowEvents.seq,
    })
    .from(workflowEvents)
    .where(eq(workflowEvents.runId, runId))
    .orderBy(desc(workflowEvents.timestamp), desc(workflowEvents.seq))
    .limit(1);

  const row = rows[0];
  return {
    lastEventId: row?.lastEventId ?? null,
    lastSeq: row?.lastSeq ?? null,
  };
}

export async function upsertTrajectory(args: {
  runId: string;
  format: WorkflowTrajectoryFormat;
  schemaVersion: string;
  data: unknown;
  lastEventId: string | null;
  lastSeq: number | null;
  valid: boolean;
  errors: unknown | null;
}): Promise<WorkflowTrajectoryRow> {
  type TrajectoryInsert = typeof workflowTrajectories.$inferInsert;
  const payload: TrajectoryInsert = {
    runId: args.runId,
    format: args.format,
    schemaVersion: args.schemaVersion,
    data: args.data,
    lastEventId: args.lastEventId,
    lastSeq: args.lastSeq,
    valid: args.valid,
    errors: args.errors ?? null,
  };

  const [row] = await db
    .insert(workflowTrajectories)
    .values(payload)
    .onConflictDoUpdate({
      target: [workflowTrajectories.runId, workflowTrajectories.format],
      set: {
        schemaVersion: payload.schemaVersion,
        data: payload.data,
        lastEventId: payload.lastEventId,
        lastSeq: payload.lastSeq,
        valid: payload.valid,
        errors: payload.errors,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  if (!row) {
    throw new Error("trajectory_upsert_failed");
  }
  return row;
}
