import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../client";
import {
  type WorkflowEventType,
  workflowEvents,
  workflowRuns,
  workflowSnapshots,
} from "../schema/workflow";

export type WorkflowStatus =
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowRun = typeof workflowRuns.$inferSelect;

type WorkflowRunInsert = typeof workflowRuns.$inferInsert;
type WorkflowEventInsert = typeof workflowEvents.$inferInsert;

export async function createRun(args: {
  id?: string;
  userId: string;
  projectId?: string;
  planId?: string;
  requirement?: string;
  workflowId: string;
  status?: WorkflowStatus;
  inputData?: unknown;
  stateData?: unknown;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  linearSessionId?: string;
  linearSpace?: string;
  linearIssueId?: string;
  linearIssueUrl?: string;
}): Promise<typeof workflowRuns.$inferSelect | undefined> {
  const [row] = await db
    .insert(workflowRuns)
    .values({
      id: args.id,
      userId: args.userId,
      projectId: args.projectId,
      planId: args.planId,
      requirement: args.requirement,
      workflowId: args.workflowId,
      status: args.status ?? "running",
      inputData: args.inputData as WorkflowRunInsert["inputData"],
      stateData: args.stateData as WorkflowRunInsert["stateData"],
      webhookUrl: args.webhookUrl ?? null,
      webhookSecret: args.webhookSecret ?? null,
      linearSessionId: args.linearSessionId ?? null,
      linearSpace: args.linearSpace ?? null,
      linearIssueId: args.linearIssueId ?? null,
      linearIssueUrl: args.linearIssueUrl ?? null,
    })
    .returning();
  return row;
}

export async function updateRun(
  runId: string,
  patch: Partial<{
    status: WorkflowStatus;
    inputData: unknown;
    stateData: unknown;
    errorMessage: string | null;
    suspendedAt: Date | null;
    resumedAt: Date | null;
    completedAt: Date | null;
    linearSessionId: string | null;
    linearSpace: string | null;
    linearIssueId: string | null;
    linearIssueUrl: string | null;
  }>
): Promise<typeof workflowRuns.$inferSelect | undefined> {
  const [row] = await db
    .update(workflowRuns)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(Object.hasOwn(patch, "inputData")
        ? {
            inputData: patch.inputData as WorkflowRunInsert["inputData"],
          }
        : {}),
      ...(Object.hasOwn(patch, "stateData")
        ? {
            stateData: patch.stateData as WorkflowRunInsert["stateData"],
          }
        : {}),
      ...(Object.hasOwn(patch, "errorMessage")
        ? {
            errorMessage: (patch.errorMessage ??
              null) as WorkflowRunInsert["errorMessage"],
          }
        : {}),
      ...(Object.hasOwn(patch, "suspendedAt")
        ? {
            suspendedAt: (patch.suspendedAt ??
              null) as WorkflowRunInsert["suspendedAt"],
          }
        : {}),
      ...(Object.hasOwn(patch, "resumedAt")
        ? {
            resumedAt: (patch.resumedAt ??
              null) as WorkflowRunInsert["resumedAt"],
          }
        : {}),
      ...(Object.hasOwn(patch, "completedAt")
        ? {
            completedAt: (patch.completedAt ??
              null) as WorkflowRunInsert["completedAt"],
          }
        : {}),
      ...(Object.hasOwn(patch, "linearSessionId")
        ? {
            linearSessionId: (patch.linearSessionId ??
              null) as WorkflowRunInsert["linearSessionId"],
          }
        : {}),
      ...(Object.hasOwn(patch, "linearSpace")
        ? {
            linearSpace: (patch.linearSpace ??
              null) as WorkflowRunInsert["linearSpace"],
          }
        : {}),
      ...(Object.hasOwn(patch, "linearIssueId")
        ? {
            linearIssueId: (patch.linearIssueId ??
              null) as WorkflowRunInsert["linearIssueId"],
          }
        : {}),
      ...(Object.hasOwn(patch, "linearIssueUrl")
        ? {
            linearIssueUrl: (patch.linearIssueUrl ??
              null) as WorkflowRunInsert["linearIssueUrl"],
          }
        : {}),
    })
    .where(eq(workflowRuns.id, runId))
    .returning();
  return row;
}

export async function appendEvent(args: {
  runId: string;
  eventType: WorkflowEventType;
  eventData?: unknown;
  stepId?: string | null;
  timestamp?: Date;
  eventId?: string; // Optional explicit event identity; DB default fills if omitted
  parentId?: string | null; // NEW: parent event for causal linking
  seq?: number | null; // NEW: sequence number for ordering
}): Promise<typeof workflowEvents.$inferSelect | undefined> {
  const [row] = await db
    .insert(workflowEvents)
    .values({
      runId: args.runId,
      eventId: args.eventId,
      eventType: args.eventType,
      eventData: (args.eventData ?? null) as WorkflowEventInsert["eventData"],
      stepId: args.stepId ?? null,
      timestamp: args.timestamp ?? undefined,
      parentId: args.parentId ?? null,
      seq: args.seq ?? null,
    })
    .returning();
  return row;
}

export async function listEvents(
  runId: string
): Promise<(typeof workflowEvents.$inferSelect)[]> {
  const rows = await db
    .select()
    .from(workflowEvents)
    .where(eq(workflowEvents.runId, runId))
    .orderBy(desc(workflowEvents.timestamp));
  // Return newest-first list (UI can reverse if needed)
  return rows;
}

export async function listEventsByType(
  runId: string,
  eventType: WorkflowEventType
): Promise<(typeof workflowEvents.$inferSelect)[]> {
  const rows = await db
    .select()
    .from(workflowEvents)
    .where(
      and(
        eq(workflowEvents.runId, runId),
        eq(workflowEvents.eventType, eventType)
      )
    )
    .orderBy(workflowEvents.timestamp);
  // Return oldest-first for replay consumers
  return rows;
}

export async function listEventsByTypePaged(args: {
  runId: string;
  eventType: WorkflowEventType;
  page?: number;
  pageSize?: number;
  order?: "asc" | "desc";
}): Promise<(typeof workflowEvents.$inferSelect)[]> {
  const page = Math.max(0, args.page ?? 0);
  const pageSize = Math.min(Math.max(1, args.pageSize ?? 500), 2000);
  const base = db
    .select()
    .from(workflowEvents)
    .where(
      and(
        eq(workflowEvents.runId, args.runId),
        eq(workflowEvents.eventType, args.eventType)
      )
    )
    .limit(pageSize)
    .offset(page * pageSize);
  const rows = await (args.order === "desc"
    ? base.orderBy(desc(workflowEvents.timestamp))
    : base.orderBy(workflowEvents.timestamp));
  return rows;
}

export async function countEventsByType(
  runId: string,
  eventType: WorkflowEventType
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(workflowEvents)
    .where(
      and(
        eq(workflowEvents.runId, runId),
        eq(workflowEvents.eventType, eventType)
      )
    );
  return Number(rows?.[0]?.count ?? 0);
}

export async function getRun(
  runId: string
): Promise<typeof workflowRuns.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, runId))
    .limit(1);
  return row ?? null;
}

export async function findRunByLinearSession(
  sessionId: string
): Promise<WorkflowRun | null> {
  const [row] = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.linearSessionId, sessionId))
    .limit(1);
  return row ?? null;
}

export async function listRuns(args: {
  userId: string;
  projectId?: string;
  status?: WorkflowStatus;
  limit?: number;
  offset?: number;
}): Promise<WorkflowRun[]> {
  const conditions = [eq(workflowRuns.userId, args.userId)];

  if (args.projectId) {
    conditions.push(eq(workflowRuns.projectId, args.projectId));
  }

  if (args.status) {
    conditions.push(eq(workflowRuns.status, args.status));
  }

  const rows = await db
    .select()
    .from(workflowRuns)
    .where(and(...conditions))
    .orderBy(desc(workflowRuns.created))
    .limit(args.limit ?? 20)
    .offset(args.offset ?? 0);

  return rows;
}

type ToolCallRow = {
  eventId: string;
  toolName?: string;
  args?: Record<string, unknown>;
  timestamp: Date;
};

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function unwrapEnvelopeData(val: unknown): unknown {
  const record = coerceRecord(val);
  // We store workflow event payloads as EventEnvelope<T> most of the time.
  // Keep this intentionally loose here to avoid a schema dependency in @alfred/db.
  if (
    typeof record.v === "number" &&
    typeof record.id === "string" &&
    typeof record.type === "string" &&
    Object.hasOwn(record, "data")
  ) {
    return record.data;
  }
  return val;
}

export async function getToolCalls(
  userId: string,
  options: { days?: number; limit?: number } = {}
): Promise<ToolCallRow[]> {
  const { days, limit = 200 } = options;
  const cutoff =
    typeof days === "number" && Number.isFinite(days) && days > 0
      ? (() => {
          const date = new Date();
          date.setDate(date.getDate() - days);
          return date;
        })()
      : null;

  const conditions = [
    eq(workflowRuns.userId, userId),
    // Use portable SQL (works in Postgres + SQLite test DBs).
    eq(workflowEvents.eventType, "tool-call"),
  ];

  if (cutoff) {
    conditions.push(gte(workflowEvents.timestamp, cutoff));
  }

  const rows = await db
    .select({
      eventId: workflowEvents.eventId,
      eventData: workflowEvents.eventData,
      timestamp: workflowEvents.timestamp,
    })
    .from(workflowEvents)
    .innerJoin(workflowRuns, eq(workflowRuns.id, workflowEvents.runId))
    .where(and(...conditions))
    .orderBy(desc(workflowEvents.timestamp))
    .limit(limit);

  return rows.map((row) => {
    const raw = unwrapEnvelopeData(row.eventData);
    const data = coerceRecord(raw);
    const toolName =
      typeof data.toolName === "string" && data.toolName.length > 0
        ? data.toolName
        : undefined;
    const args =
      typeof data.args === "object" && data.args !== null
        ? coerceRecord(data.args)
        : typeof data.input === "object" && data.input !== null
          ? coerceRecord(data.input)
          : undefined;
    return {
      eventId: row.eventId,
      toolName,
      args,
      timestamp: row.timestamp ?? new Date(),
    } satisfies ToolCallRow;
  });
}

export async function listSuspendedRunsBefore(
  cutoff: Date,
  limit = 100
): Promise<WorkflowRun[]> {
  const rows = await db
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.status, "suspended"),
        lt(workflowRuns.suspendedAt, cutoff)
      )
    )
    .orderBy(workflowRuns.suspendedAt)
    .limit(Math.max(1, Math.min(limit, 500)));

  return rows;
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

export async function listRunsByStatuses(
  statuses: WorkflowStatus[],
  options?: { limit?: number; order?: "asc" | "desc" }
): Promise<WorkflowRun[]> {
  if (statuses.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));
  const order = options?.order === "asc" ? "asc" : "desc";

  const rows = await db
    .select()
    .from(workflowRuns)
    .where(inArray(workflowRuns.status, statuses))
    .orderBy(
      order === "desc" ? desc(workflowRuns.created) : workflowRuns.created
    )
    .limit(limit);

  return rows;
}

/**
 * Checkpoint storage implementation using Postgres.
 * Follows the CheckpointStorage interface from @alfred/pipeline.
 */
export class PostgresCheckpointStorage {
  async save(runId: string, snapshot: any): Promise<void> {
    await db
      .insert(workflowSnapshots)
      .values({
        runId,
        state: snapshot,
        lastEventId: (snapshot as any).lastEventId ?? null,
      })
      .onConflictDoUpdate({
        target: workflowSnapshots.runId,
        set: {
          state: snapshot,
          lastEventId: (snapshot as any).lastEventId ?? null,
          createdAt: new Date(),
        },
      });
  }

  async load(runId: string): Promise<any | null> {
    const [row] = await db
      .select()
      .from(workflowSnapshots)
      .where(eq(workflowSnapshots.runId, runId))
      .limit(1);

    return (row?.state ?? null) as any;
  }

  async delete(runId: string): Promise<void> {
    await db
      .delete(workflowSnapshots)
      .where(eq(workflowSnapshots.runId, runId));
  }
}
