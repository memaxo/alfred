import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { mcpServers } from "../schema/mcp";

type Insert = typeof mcpServers.$inferInsert;

function clean<T extends Record<string, unknown>>(
  updates: Partial<T>,
  immutable: string[] = []
) {
  const copy = { ...updates } as Record<string, unknown>;
  for (const key of Object.keys(copy)) {
    if (copy[key] === undefined || immutable.includes(key)) {
      delete copy[key];
    }
  }
  return copy;
}

export function listMcpServers(userId: string) {
  return db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.userId, userId))
    .orderBy(asc(mcpServers.label), desc(mcpServers.createdAt));
}

export function listEnabledMcpServers(userId: string) {
  return db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.userId, userId), eq(mcpServers.enabled, true)))
    .orderBy(asc(mcpServers.label), desc(mcpServers.createdAt));
}

export async function createMcpServer(
  userId: string,
  input: Omit<Insert, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<typeof mcpServers.$inferSelect> {
  const rows = await db
    .insert(mcpServers)
    .values({ ...input, userId })
    .returning();
  return rows[0] as unknown as typeof mcpServers.$inferSelect;
}

export async function updateMcpServer(
  userId: string,
  id: string,
  updates: Partial<Insert>
): Promise<typeof mcpServers.$inferSelect | null> {
  const patch = clean<Insert>(updates, ["id", "userId", "createdAt"]);
  if (Object.keys(patch).length === 0) {
    return null;
  }
  patch.updatedAt = sql`NOW()`;

  const rows = await db
    .update(mcpServers)
    .set(patch)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
    .returning();
  return (rows[0] as unknown as typeof mcpServers.$inferSelect) ?? null;
}

export async function deleteMcpServer(
  userId: string,
  id: string
): Promise<number> {
  const rows = await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
    .returning({ id: mcpServers.id });
  return rows.length;
}
