/**
 * ALFRED User Repository
 * Profile, preferences, facts, events, autonomy, and feedback operations
 */

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, dbDriver } from "../client";
import {
  autonomy,
  events,
  facts,
  feedback,
  preferences,
  profiles,
} from "../schema/user";

type ProfileInsert = typeof profiles.$inferInsert;
// type PreferenceInsert = typeof preferences.$inferInsert;
type ProfileRow = typeof profiles.$inferSelect;
type PreferenceRow = typeof preferences.$inferSelect;
type FactRow = typeof facts.$inferSelect;
type EventRow = typeof events.$inferSelect;
type AutonomyRow = typeof autonomy.$inferSelect;
type FeedbackRow = typeof feedback.$inferSelect;

function sanitizeInsert<T extends Record<string, unknown>>(input: Partial<T>) {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      copy[key] = value;
    }
  }
  return copy as Partial<T>;
}

const usePreparedStatements = dbDriver === "postgres";

type PreparedQuery<TParams, TResult> = {
  execute(params: TParams): Promise<TResult>;
};

const getPreferencesStmt: PreparedQuery<{ userId: string }, PreferenceRow[]> =
  usePreparedStatements
    ? (db
        .select({
          id: preferences.id,
          userId: preferences.userId,
          key: preferences.key,
          value: preferences.value,
          confidence: preferences.confidence,
          source: preferences.source,
          created: preferences.created,
          updated: preferences.updated,
        })
        .from(preferences)
        .where(eq(preferences.userId, sql.placeholder("userId")))
        .prepare("get_user_preferences") as PreparedQuery<
        { userId: string },
        PreferenceRow[]
      >)
    : {
        execute: async ({ userId }) =>
          db
            .select({
              id: preferences.id,
              userId: preferences.userId,
              key: preferences.key,
              value: preferences.value,
              confidence: preferences.confidence,
              source: preferences.source,
              created: preferences.created,
              updated: preferences.updated,
            })
            .from(preferences)
            .where(eq(preferences.userId, userId)),
      };

// Profile operations
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertProfile(
  userId: string,
  data: Partial<ProfileInsert>
): Promise<ProfileRow> {
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
  return getPreferencesStmt.execute({ userId });
}

export async function setPreference(
  userId: string,
  key: string,
  value: unknown,
  confidence = 1.0,
  source = "user"
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

export async function deletePreference(
  userId: string,
  key: string
): Promise<number> {
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
  source = "user"
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

export type FactSearchResult = typeof facts.$inferSelect & { score: number };

export async function searchFacts(
  userId: string,
  embedding: number[],
  limit = 10,
  threshold = 0.7
): Promise<FactSearchResult[]> {
  // Format embedding array as PostgreSQL array constructor for vector cast
  const embeddingArrayExpr = `ARRAY[${embedding.join(",")}]`;

  // Use Drizzle with raw SQL only for vector operations
  const rows = await db
    .select({
      id: facts.id,
      userId: facts.userId,
      content: facts.content,
      category: facts.category,
      confidence: facts.confidence,
      source: facts.source,
      created: facts.created,
      updated: facts.updated,
      embedding: facts.embedding,
      score: sql<number>`1 - (embedding <=> ${sql.raw(embeddingArrayExpr)}::vector)`,
    })
    .from(facts)
    .where(and(eq(facts.userId, userId), isNotNull(facts.embedding)))
    .orderBy(sql`embedding <=> ${sql.raw(embeddingArrayExpr)}::vector ASC`)
    .limit(limit * 3);

  // Filter by threshold and limit
  return rows
    .filter((row) => Number.isFinite(row.score) && row.score >= threshold)
    .slice(0, limit);
}

export async function listFacts(
  userId: string,
  limit = 100,
  offset = 0
): Promise<FactRow[]> {
  const rows = await db
    .select()
    .from(facts)
    .where(eq(facts.userId, userId))
    .orderBy(desc(facts.created))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function deleteFact(userId: string, factId: string): Promise<number> {
  const rows = await db
    .delete(facts)
    .where(and(eq(facts.userId, userId), eq(facts.id, factId)))
    .returning({ id: facts.id });
  return rows.length;
}

// Event operations
export async function addEvent(
  userId: string,
  type: string,
  data: unknown,
  metadata?: unknown
): Promise<EventRow> {
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

export async function getEvents(
  userId: string,
  type?: string,
  limit = 100,
  offset = 0
): Promise<EventRow[]> {
  const where = type
    ? and(eq(events.userId, userId), eq(events.type, type))
    : eq(events.userId, userId);

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
export async function getAutonomy(
  userId: string,
  action: string
): Promise<AutonomyRow | null> {
  const rows = await db
    .select()
    .from(autonomy)
    .where(and(eq(autonomy.userId, userId), eq(autonomy.action, action)))
    .limit(1);

  return rows[0] ?? null;
}

export async function setAutonomy(
  userId: string,
  action: string,
  level: string,
  requireBiometric = false,
  maxToolCalls = 10
): Promise<AutonomyRow> {
  const [row] = await db
    .insert(autonomy)
    .values({
      userId,
      action,
      level,
      requireBiometric,
      maxToolCalls,
    })
    .onConflictDoUpdate({
      target: [autonomy.userId, autonomy.action],
      set: {
        level,
        requireBiometric,
        maxToolCalls,
        updated: sql`NOW()` as unknown as Date,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to set autonomy");
  }

  return row;
}

// Feedback operations
export async function addFeedback(
  userId: string,
  conversationId: string,
  messageId: string,
  rating?: number,
  comment?: string,
  tags?: string[]
): Promise<FeedbackRow> {
  const [row] = await db
    .insert(feedback)
    .values({
      userId,
      conversationId: conversationId ?? null,
      messageId: messageId ?? null,
      rating: rating ?? null,
      comment: comment ?? null,
      tags: tags ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to add feedback");
  }

  return row;
}

export async function getFeedback(
  userId: string,
  limit = 50,
  offset = 0
): Promise<FeedbackRow[]> {
  return db
    .select()
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.created))
    .limit(limit)
    .offset(offset);
}
