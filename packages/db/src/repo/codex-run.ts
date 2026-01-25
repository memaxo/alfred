import { and, asc, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "../client.js";
import { codexEvents, codexRuns } from "../schema/codex.js";

export type CodexRunStatus = "running" | "completed" | "failed" | "cancelled";

export type CodexRunRow = typeof codexRuns.$inferSelect;
export type NewCodexRunRow = typeof codexRuns.$inferInsert;
export type CodexEventRow = typeof codexEvents.$inferSelect;
export type NewCodexEventRow = typeof codexEvents.$inferInsert;

type RunInsert = typeof codexRuns.$inferInsert;
type EventInsert = typeof codexEvents.$inferInsert;

export async function createRun(args: {
  id?: string;
  userId: string;
  projectId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
  parentRunId?: string | null;
  resumeCount?: number;
  schemaVersion?: number;
  status?: CodexRunStatus;
  auto?: string | null;
  model?: string | null;
  profile?: string | null;
  environmentKind?: string;
  workingDirectory?: string | null;
  workspaceRoot?: string | null;
  dockerContainerId?: string | null;
  dockerImage?: string | null;
  /** @deprecated Use agentfsDbPath instead */
  poofUpperDir?: string | null;
  /** @deprecated No longer used */
  poofProfile?: string | null;
  /** AgentFS database path for audit trail */
  agentfsDbPath?: string | null;
  /** AgentFS run identifier */
  agentfsRunId?: string | null;
  outputSchema?: unknown;
  startedAt?: Date;
}): Promise<CodexRunRow> {
  const [row] = await db
    .insert(codexRuns)
    .values({
      id: args.id,
      userId: args.userId,
      projectId: args.projectId ?? null,
      sessionId: args.sessionId ?? null,
      threadId: args.threadId ?? null,
      parentRunId: args.parentRunId ?? null,
      resumeCount: args.resumeCount ?? 0,
      schemaVersion: args.schemaVersion ?? 1,
      status: args.status ?? "running",
      auto: args.auto ?? null,
      model: args.model ?? null,
      profile: args.profile ?? null,
      environmentKind: args.environmentKind ?? "host",
      workingDirectory: args.workingDirectory ?? null,
      workspaceRoot: args.workspaceRoot ?? null,
      dockerContainerId: args.dockerContainerId ?? null,
      dockerImage: args.dockerImage ?? null,
      poofUpperDir: args.poofUpperDir ?? null,
      poofProfile: args.poofProfile ?? null,
      agentfsDbPath: args.agentfsDbPath ?? null,
      agentfsRunId: args.agentfsRunId ?? null,
      outputSchema: (args.outputSchema ?? null) as RunInsert["outputSchema"],
      startedAt: args.startedAt ?? undefined,
    })
    .returning();

  if (!row) {
    throw new Error("failed_to_create_codex_run");
  }
  return row;
}

export async function getRun(runId: string): Promise<CodexRunRow | null> {
  const [row] = await db
    .select()
    .from(codexRuns)
    .where(eq(codexRuns.id, runId))
    .limit(1);
  return row ?? null;
}

export async function getLatestRunBySession(args: {
  userId: string;
  sessionId: string;
}): Promise<CodexRunRow | null> {
  const [row] = await db
    .select()
    .from(codexRuns)
    .where(
      and(
        eq(codexRuns.userId, args.userId),
        eq(codexRuns.sessionId, args.sessionId)
      )
    )
    .orderBy(desc(codexRuns.startedAt))
    .limit(1);
  return row ?? null;
}

export function listRuns(args: {
  userId: string;
  projectId?: string;
  status?: CodexRunStatus;
  sessionId?: string;
  threadId?: string;
  environmentKind?: string;
  startedAfter?: Date;
  startedBefore?: Date;
  limit?: number;
  offset?: number;
}): Promise<CodexRunRow[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 50, 200));
  const offset = Math.max(0, args.offset ?? 0);

  const conditions = [eq(codexRuns.userId, args.userId)];
  if (args.projectId) {
    conditions.push(eq(codexRuns.projectId, args.projectId));
  }
  if (args.status) {
    conditions.push(eq(codexRuns.status, args.status));
  }
  if (args.sessionId) {
    conditions.push(eq(codexRuns.sessionId, args.sessionId));
  }
  if (args.threadId) {
    conditions.push(eq(codexRuns.threadId, args.threadId));
  }
  if (args.environmentKind) {
    conditions.push(eq(codexRuns.environmentKind, args.environmentKind));
  }
  if (args.startedAfter) {
    conditions.push(gte(codexRuns.startedAt, args.startedAfter));
  }
  if (args.startedBefore) {
    conditions.push(lte(codexRuns.startedAt, args.startedBefore));
  }

  return db
    .select()
    .from(codexRuns)
    .where(and(...conditions))
    .orderBy(desc(codexRuns.startedAt))
    .limit(limit)
    .offset(offset);
}

export async function finalizeRun(
  runId: string,
  patch: Partial<{
    status: CodexRunStatus;
    threadId: string | null;
    exitCode: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    completedAt: Date | null;
    artifacts: unknown;
    resultText: string | null;
    structuredOutput: unknown;
    structuredOutputStatus: string | null;
  }>
): Promise<CodexRunRow | null> {
  const [row] = await db
    .update(codexRuns)
    .set({
      ...(patch.status ? { status: patch.status } : {}),
      ...(Object.hasOwn(patch, "threadId")
        ? { threadId: (patch.threadId ?? null) as RunInsert["threadId"] }
        : {}),
      ...(Object.hasOwn(patch, "exitCode")
        ? { exitCode: (patch.exitCode ?? null) as RunInsert["exitCode"] }
        : {}),
      ...(Object.hasOwn(patch, "errorCode")
        ? { errorCode: (patch.errorCode ?? null) as RunInsert["errorCode"] }
        : {}),
      ...(Object.hasOwn(patch, "errorMessage")
        ? {
            errorMessage: (patch.errorMessage ??
              null) as RunInsert["errorMessage"],
          }
        : {}),
      ...(Object.hasOwn(patch, "completedAt")
        ? {
            completedAt: (patch.completedAt ??
              null) as RunInsert["completedAt"],
          }
        : {}),
      ...(Object.hasOwn(patch, "artifacts")
        ? { artifacts: (patch.artifacts ?? null) as RunInsert["artifacts"] }
        : {}),
      ...(Object.hasOwn(patch, "resultText")
        ? { resultText: (patch.resultText ?? null) as RunInsert["resultText"] }
        : {}),
      ...(Object.hasOwn(patch, "structuredOutput")
        ? {
            structuredOutput: (patch.structuredOutput ??
              null) as RunInsert["structuredOutput"],
          }
        : {}),
      ...(Object.hasOwn(patch, "structuredOutputStatus")
        ? {
            structuredOutputStatus: (patch.structuredOutputStatus ??
              null) as RunInsert["structuredOutputStatus"],
          }
        : {}),
      updatedAt: sql`NOW()` as unknown as Date,
    })
    .where(eq(codexRuns.id, runId))
    .returning();

  return row ?? null;
}

export async function appendEventsBatch(args: {
  runId: string;
  events: {
    seq: number;
    eventType: string;
    eventData?: unknown;
    text?: string | null;
    createdAt?: Date;
    id?: string;
  }[];
}): Promise<{ inserted: number }> {
  if (args.events.length === 0) {
    return { inserted: 0 };
  }

  const values: EventInsert[] = args.events.map((event) => ({
    id: event.id,
    runId: args.runId,
    seq: event.seq,
    eventType: event.eventType,
    eventData: (event.eventData ?? null) as EventInsert["eventData"],
    text: event.text ?? null,
    createdAt: event.createdAt ?? undefined,
  }));

  const rows = await db
    .insert(codexEvents)
    .values(values)
    .onConflictDoNothing({ target: [codexEvents.runId, codexEvents.seq] })
    .returning({ id: codexEvents.id });

  return { inserted: rows.length };
}

export function listEvents(args: {
  runId: string;
  order?: "asc" | "desc";
  limit?: number;
  afterSeq?: number;
}): Promise<CodexEventRow[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 2000, 5000));
  const order = args.order === "desc" ? "desc" : "asc";

  const conditions = [eq(codexEvents.runId, args.runId)];
  if (typeof args.afterSeq === "number" && Number.isFinite(args.afterSeq)) {
    conditions.push(gt(codexEvents.seq, args.afterSeq));
  }

  const base = db
    .select()
    .from(codexEvents)
    .where(and(...conditions))
    .limit(limit);
  return order === "desc"
    ? base.orderBy(desc(codexEvents.seq))
    : base.orderBy(asc(codexEvents.seq));
}

export function searchEvents(args: {
  userId: string;
  query: string;
  runId?: string;
  eventTypes?: string[];
  limit?: number;
  offset?: number;
}): Promise<
  Pick<
    CodexEventRow,
    "id" | "runId" | "seq" | "eventType" | "eventData" | "text" | "createdAt"
  >[]
> {
  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const offset = Math.max(0, args.offset ?? 0);
  const q = args.query.trim();
  if (!q) {
    return Promise.resolve([]);
  }

  const conditions = [eq(codexRuns.userId, args.userId)];
  if (args.runId) {
    conditions.push(eq(codexEvents.runId, args.runId));
  }
  if (args.eventTypes && args.eventTypes.length > 0) {
    conditions.push(inArray(codexEvents.eventType, args.eventTypes));
  }

  const tsQuery = sql`plainto_tsquery('english', ${q})`;

  return db
    .select({
      id: codexEvents.id,
      runId: codexEvents.runId,
      seq: codexEvents.seq,
      eventType: codexEvents.eventType,
      eventData: codexEvents.eventData,
      text: codexEvents.text,
      createdAt: codexEvents.createdAt,
    })
    .from(codexEvents)
    .innerJoin(codexRuns, eq(codexRuns.id, codexEvents.runId))
    .where(
      and(...conditions, sql`${codexEvents.contentTsvector} @@ ${tsQuery}`)
    )
    .orderBy(desc(codexEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function pruneOldRuns(
  retentionDays = 30
): Promise<{ deletedRuns: number; deletedEvents: number }> {
  const days =
    Number.isFinite(retentionDays) && retentionDays >= 0 ? retentionDays : 30;
  const result = await db.execute(
    sql`SELECT * FROM prune_old_codex_data(${days}::integer)`
  );

  const row =
    (
      result as unknown as {
        rows?: { deleted_runs?: unknown; deleted_events?: unknown }[];
      }
    ).rows?.[0] ?? null;

  const deletedRuns = Number(row?.deleted_runs ?? 0);
  const deletedEvents = Number(row?.deleted_events ?? 0);

  return {
    deletedRuns: Number.isFinite(deletedRuns) ? deletedRuns : 0,
    deletedEvents: Number.isFinite(deletedEvents) ? deletedEvents : 0,
  };
}
