/**
 * ALFRED User Repository
 * Profile, preferences, facts, events, autonomy, and feedback operations
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../index";
import { profiles, preferences, facts, events, autonomy, feedback } from "../schema/user";

type ProfileInsert = typeof profiles.$inferInsert;
type PreferenceInsert = typeof preferences.$inferInsert;
type ProfileRow = typeof profiles.$inferSelect;
type PreferenceRow = typeof preferences.$inferSelect;
type FactRow = typeof facts.$inferSelect;
type EventRow = typeof events.$inferSelect;

function sanitizeInsert<T extends Record<string, unknown>>(input: Partial<T>) {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      copy[key] = value;
    }
  }
  return copy as Partial<T>;
}

function cosineSimilarity(a: number[], b: number[]) {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;

  let dot = 0;
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < len; i += 1) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    sumA += ai * ai;
    sumB += bi * bi;
  }

  if (sumA === 0 || sumB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(sumA) * Math.sqrt(sumB));
}

// Profile operations
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertProfile(userId: string, data: Partial<ProfileInsert>): Promise<ProfileRow> {
  const insertPayload: ProfileInsert = {
    userId,
    name: data.name ?? null,
    email: data.email ?? null,
    avatar: data.avatar ?? null,
    timezone: data.timezone ?? null,
  };

  const updatePayload = sanitizeInsert<ProfileInsert>({
    name: data.name,
    email: data.email,
    avatar: data.avatar,
    timezone: data.timezone,
  });

  const [row] = await db
    .insert(profiles)
    .values(insertPayload)
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        ...updatePayload,
        updated: sql`NOW()` as unknown as Date,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert user profile");
  }

  return row;
}

// Preference operations
export async function getPreferences(userId: string): Promise<PreferenceRow[]> {
  const rows = await db
    .select()
    .from(preferences)
    .where(eq(preferences.userId, userId))
    .orderBy(desc(preferences.updated));

  return rows;
}

export async function setPreference(
  userId: string,
  key: string,
  value: unknown,
  confidence = 1.0,
  source = "user",
): Promise<PreferenceRow> {
  const [row] = await db
    .insert(preferences)
    .values({
      userId,
      key,
      value,
      confidence,
      source,
    })
    .onConflictDoUpdate({
      target: [preferences.userId, preferences.key],
      set: {
        value,
        confidence,
        source,
        updated: sql`NOW()` as unknown as Date,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to set preference");
  }

  return row;
}

export async function deletePreference(userId: string, key: string): Promise<number> {
  const rows = await db
    .delete(preferences)
    .where(and(eq(preferences.userId, userId), eq(preferences.key, key)))
    .returning({ id: preferences.id });

  return rows.length;
}

// Fact operations (with vector embeddings)
export async function addFact(
  userId: string,
  content: string,
  embedding?: number[],
  category?: string,
  confidence = 1.0,
  source = "user",
): Promise<FactRow> {
  const [row] = await db
    .insert(facts)
    .values({
      userId,
      content,
      embedding: embedding ?? null,
      category: category ?? null,
      confidence,
      source,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to add fact");
  }

  return row;
}

export type FactSearchResult = (typeof facts.$inferSelect) & { score: number };

export async function searchFacts(userId: string, embedding: number[], limit = 10, threshold = 0.7): Promise<FactSearchResult[]> {
  const rows = await db
    .select({
      id: facts.id,
      userId: facts.userId,
      content: facts.content,
      embedding: facts.embedding,
      category: facts.category,
      confidence: facts.confidence,
      source: facts.source,
      created: facts.created,
      updated: facts.updated,
    })
    .from(facts)
    .where(and(eq(facts.userId, userId), sql`embedding IS NOT NULL`));

  return rows
    .map(row => {
      const vector = Array.isArray(row.embedding) ? (row.embedding as number[]) : [];
      const score = cosineSimilarity(vector, embedding);
      return {
        ...row,
        score,
      } as FactSearchResult;
    })
    .filter(row => Number.isFinite(row.score) && row.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function listFacts(userId: string, limit = 100, offset = 0): Promise<FactRow[]> {
  const rows = await db
    .select()
    .from(facts)
    .where(eq(facts.userId, userId))
    .orderBy(desc(facts.created))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function deleteFact(factId: string): Promise<number> {
  const rows = await db.delete(facts).where(eq(facts.id, factId)).returning({ id: facts.id });
  return rows.length;
}

// Event operations
export async function addEvent(userId: string, type: string, data: unknown, metadata?: unknown): Promise<EventRow> {
  const [row] = await db
    .insert(events)
    .values({
      userId,
      type,
      data,
      metadata: metadata ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to add event");
  }

  return row;
}

export async function getEvents(userId: string, type?: string, limit = 100, offset = 0): Promise<EventRow[]> {
  const where = type ? and(eq(events.userId, userId), eq(events.type, type)) : eq(events.userId, userId);

  const rows = await db
    .select()
    .from(events)
    .where(where)
    .orderBy(desc(events.timestamp))
    .limit(limit)
    .offset(offset);

  return rows;
}

// Autonomy operations
export async function getAutonomy(userId: string, action: string) {
  // TODO: [Phase 9] SELECT * FROM user_autonomy WHERE user_id = ? AND action = ?
  throw new Error("Not implemented");
}

export async function setAutonomy(userId: string, action: string, level: string, requireBiometric = false, maxToolCalls = 10) {
  // TODO: [Phase 9] INSERT INTO user_autonomy ... ON CONFLICT (user_id, action) DO UPDATE
  throw new Error("Not implemented");
}

// Feedback operations
export async function addFeedback(userId: string, conversationId: string, messageId: string, rating?: number, comment?: string, tags?: string[]) {
  // TODO: [Phase 14] INSERT INTO user_feedback (user_id, conversation_id, message_id, rating, comment, tags)
  throw new Error("Not implemented");
}

export async function getFeedback(userId: string, limit = 50, offset = 0) {
  // TODO: [Phase 14] SELECT * FROM user_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  throw new Error("Not implemented");
}
