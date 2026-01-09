import { eq } from "drizzle-orm";
import { db } from "../client";
import { clarificationRequests } from "../schema/clarification";

export type ClarificationRequest = typeof clarificationRequests.$inferSelect;
export type ClarificationRequestInsert =
  typeof clarificationRequests.$inferInsert;

export async function createRequest(
  data: ClarificationRequestInsert
): Promise<ClarificationRequest> {
  const [row] = await db.insert(clarificationRequests).values(data).returning();
  if (!row) {
    throw new Error("Failed to create clarification request");
  }
  return row;
}

export async function getRequest(
  id: string
): Promise<ClarificationRequest | null> {
  const [row] = await db
    .select()
    .from(clarificationRequests)
    .where(eq(clarificationRequests.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateResponse(
  id: string,
  response: string
): Promise<ClarificationRequest> {
  const [row] = await db
    .update(clarificationRequests)
    .set({
      response,
      respondedAt: new Date(),
    })
    .where(eq(clarificationRequests.id, id))
    .returning();
  if (!row) {
    throw new Error("Failed to update clarification response");
  }
  return row;
}

export function listRequestsByRunId(
  runId: string
): Promise<ClarificationRequest[]> {
  return db
    .select()
    .from(clarificationRequests)
    .where(eq(clarificationRequests.runId, runId));
}
