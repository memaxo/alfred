/**
 * ALFRED Budget Repository
 * CRUD operations for user budgets and usage tracking
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../client";
import { usageEvents, usageTracking, userBudgets } from "../schema/budget";

// ============================================================================
// User Budget Operations
// ============================================================================

export type UserBudget = typeof userBudgets.$inferSelect;
export type UserBudgetInsert = typeof userBudgets.$inferInsert;

/**
 * Get user budget settings
 */
export async function getUserBudget(
  userId: string
): Promise<UserBudget | null> {
  const results = await db
    .select()
    .from(userBudgets)
    .where(eq(userBudgets.userId, userId))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Create or update user budget settings
 */
export async function upsertUserBudget(
  userId: string,
  budget: Partial<Omit<UserBudgetInsert, "id" | "userId" | "created">>
): Promise<UserBudget> {
  const existing = await getUserBudget(userId);

  if (existing) {
    const results = await db
      .update(userBudgets)
      .set({
        ...budget,
        updated: new Date(),
      })
      .where(eq(userBudgets.userId, userId))
      .returning();
    return results[0]!;
  }

  const results = await db
    .insert(userBudgets)
    .values({
      userId,
      ...budget,
    })
    .returning();
  return results[0]!;
}

/**
 * Delete user budget settings
 */
export async function deleteUserBudget(userId: string): Promise<boolean> {
  const result = await db
    .delete(userBudgets)
    .where(eq(userBudgets.userId, userId));
  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Usage Tracking Operations
// ============================================================================

export type UsageTrackingRow = typeof usageTracking.$inferSelect;
export type UsageTrackingInsert = typeof usageTracking.$inferInsert;

/**
 * Get start of day in UTC
 */
function getDateKey(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get or create today's usage tracking record
 */
export async function getOrCreateDailyUsage(
  userId: string
): Promise<UsageTrackingRow> {
  const dateKey = getDateKey();

  const existing = await db
    .select()
    .from(usageTracking)
    .where(
      and(eq(usageTracking.userId, userId), eq(usageTracking.date, dateKey))
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const results = await db
    .insert(usageTracking)
    .values({
      userId,
      date: dateKey,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalCostCents: 0,
      requestCount: 0,
      blockedCount: 0,
      providerBreakdown: {},
      roleBreakdown: {},
    })
    .onConflictDoNothing()
    .returning();

  // Handle race condition - if conflict, fetch existing
  if (!results[0]) {
    const fetched = await db
      .select()
      .from(usageTracking)
      .where(
        and(eq(usageTracking.userId, userId), eq(usageTracking.date, dateKey))
      )
      .limit(1);
    return fetched[0]!;
  }

  return results[0];
}

/**
 * Get daily usage for a specific date
 */
export async function getDailyUsage(
  userId: string,
  date?: Date
): Promise<UsageTrackingRow | null> {
  const dateKey = getDateKey(date);

  const results = await db
    .select()
    .from(usageTracking)
    .where(
      and(eq(usageTracking.userId, userId), eq(usageTracking.date, dateKey))
    )
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get usage history for a date range
 */
export async function getUsageHistory(
  userId: string,
  days = 30
): Promise<UsageTrackingRow[]> {
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days);

  return db
    .select()
    .from(usageTracking)
    .where(
      and(eq(usageTracking.userId, userId), gte(usageTracking.date, startDate))
    )
    .orderBy(desc(usageTracking.date));
}

/**
 * Increment daily usage counters
 */
export async function incrementDailyUsage(
  userId: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    costCents: number;
    provider: string;
    role: string;
    blocked?: boolean;
  }
): Promise<UsageTrackingRow> {
  // Ensure record exists
  await getOrCreateDailyUsage(userId);
  const dateKey = getDateKey();

  // Increment counters atomically
  const results = await db
    .update(usageTracking)
    .set({
      inputTokens: sql`COALESCE(${usageTracking.inputTokens}, 0) + ${usage.inputTokens}`,
      outputTokens: sql`COALESCE(${usageTracking.outputTokens}, 0) + ${usage.outputTokens}`,
      cachedTokens: sql`COALESCE(${usageTracking.cachedTokens}, 0) + ${usage.cachedTokens ?? 0}`,
      totalCostCents: sql`COALESCE(${usageTracking.totalCostCents}, 0) + ${usage.costCents}`,
      requestCount: sql`COALESCE(${usageTracking.requestCount}, 0) + 1`,
      blockedCount: usage.blocked
        ? sql`COALESCE(${usageTracking.blockedCount}, 0) + 1`
        : usageTracking.blockedCount,
      // Update provider breakdown
      providerBreakdown: sql`
        COALESCE(${usageTracking.providerBreakdown}, '{}'::jsonb) ||
        jsonb_build_object(
          ${usage.provider},
          jsonb_build_object(
            'inputTokens', COALESCE((${usageTracking.providerBreakdown}->>${usage.provider}->>'inputTokens')::int, 0) + ${usage.inputTokens},
            'outputTokens', COALESCE((${usageTracking.providerBreakdown}->>${usage.provider}->>'outputTokens')::int, 0) + ${usage.outputTokens},
            'costCents', COALESCE((${usageTracking.providerBreakdown}->>${usage.provider}->>'costCents')::int, 0) + ${usage.costCents}
          )
        )
      `,
      // Update role breakdown
      roleBreakdown: sql`
        COALESCE(${usageTracking.roleBreakdown}, '{}'::jsonb) ||
        jsonb_build_object(
          ${usage.role},
          jsonb_build_object(
            'inputTokens', COALESCE((${usageTracking.roleBreakdown}->>${usage.role}->>'inputTokens')::int, 0) + ${usage.inputTokens},
            'outputTokens', COALESCE((${usageTracking.roleBreakdown}->>${usage.role}->>'outputTokens')::int, 0) + ${usage.outputTokens},
            'costCents', COALESCE((${usageTracking.roleBreakdown}->>${usage.role}->>'costCents')::int, 0) + ${usage.costCents}
          )
        )
      `,
      updated: new Date(),
    })
    .where(
      and(eq(usageTracking.userId, userId), eq(usageTracking.date, dateKey))
    )
    .returning();

  return results[0]!;
}

// ============================================================================
// Usage Events Operations
// ============================================================================

export type UsageEvent = typeof usageEvents.$inferSelect;
export type UsageEventInsert = typeof usageEvents.$inferInsert;

/**
 * Record a usage event
 */
export async function recordUsageEvent(
  event: Omit<UsageEventInsert, "id" | "timestamp">
): Promise<UsageEvent> {
  const results = await db.insert(usageEvents).values(event).returning();
  return results[0]!;
}

/**
 * Get recent usage events for a user
 */
export async function getRecentUsageEvents(
  userId: string,
  limit = 100
): Promise<UsageEvent[]> {
  return db
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .orderBy(desc(usageEvents.timestamp))
    .limit(limit);
}
