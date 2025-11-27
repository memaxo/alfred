import { and, eq, lte } from "drizzle-orm";

import { db } from "../client.js";
import {
  codexSessions,
  type CodexSessionRow,
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
      and(eq(codexSessions.sessionId, sessionId), eq(codexSessions.userId, userId))
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
