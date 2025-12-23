import { and, desc, eq, gt, lte } from "drizzle-orm";

import { db } from "../client.js";
import {
  type CodexSessionRow,
  codexSessions,
  type NewCodexSessionRow,
} from "../schema/codex.js";

export type CodexSession = CodexSessionRow;
export type NewCodexSession = NewCodexSessionRow;

export async function getSession(
  sessionId: string,
  userId: string
): Promise<CodexSession | null> {
  const [row] = await db
    .select()
    .from(codexSessions)
    .where(
      and(
        eq(codexSessions.sessionId, sessionId),
        eq(codexSessions.userId, userId)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function createSession(
  session: NewCodexSession
): Promise<CodexSession> {
  const [row] = await db.insert(codexSessions).values(session).returning();
  if (!row) {
    throw new Error("failed_to_create_codex_session");
  }
  return row;
}

export async function getSessionById(
  sessionId: string
): Promise<CodexSession | null> {
  const [row] = await db
    .select()
    .from(codexSessions)
    .where(eq(codexSessions.sessionId, sessionId))
    .limit(1);
  return row ?? null;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<Omit<NewCodexSession, "sessionId" | "id">>
): Promise<CodexSession | null> {
  const [row] = await db
    .update(codexSessions)
    .set(patch)
    .where(eq(codexSessions.sessionId, sessionId))
    .returning();

  return row ?? null;
}

export async function deleteSession(sessionId: string): Promise<number> {
  const rows = await db
    .delete(codexSessions)
    .where(eq(codexSessions.sessionId, sessionId))
    .returning({ id: codexSessions.id });
  return rows.length;
}

export async function cleanupExpiredSessions(
  now: Date = new Date()
): Promise<number> {
  const rows = await db
    .delete(codexSessions)
    .where(lte(codexSessions.expiresAt, now))
    .returning({ id: codexSessions.id });
  return rows.length;
}

export type ListSessionsOptions = {
  userId: string;
  status?: "active" | "completed" | "failed";
  limit?: number;
  offset?: number;
};

export async function listSessions(
  options: ListSessionsOptions
): Promise<CodexSession[]> {
  const { userId, status, limit = 50, offset = 0 } = options;
  const now = new Date();

  const conditions = [eq(codexSessions.userId, userId)];

  // Only filter by expiry for active sessions or when no status specified
  // This allows querying historical completed/failed sessions
  if (!status || status === "active") {
    conditions.push(gt(codexSessions.expiresAt, now));
  }

  if (status) {
    conditions.push(eq(codexSessions.status, status));
  }

  return db
    .select()
    .from(codexSessions)
    .where(and(...conditions))
    .orderBy(desc(codexSessions.lastAccessedAt))
    .limit(limit)
    .offset(offset);
}
