import { and, desc, eq } from "drizzle-orm";
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
  }>,
) {
  const [row] = await db
    .update(workflowRuns)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "stateData")
        ? { stateData: patch.stateData as any }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "errorMessage")
        ? { errorMessage: (patch.errorMessage ?? null) as any }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "suspendedAt")
        ? { suspendedAt: (patch.suspendedAt ?? null) as any }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "resumedAt")
        ? { resumedAt: (patch.resumedAt ?? null) as any }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(patch, "completedAt")
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

