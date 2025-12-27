/**
 * ALFRED Personality Repository
 * CRUD operations for user personality traits
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  personalityCalibration,
  personalityEvents,
  userPersonality,
} from "../schema/personality";

// ============================================================================
// Types
// ============================================================================

export type UserPersonalityRow = typeof userPersonality.$inferSelect;
export type UserPersonalityInsert = typeof userPersonality.$inferInsert;
export type PersonalityCalibrationRow =
  typeof personalityCalibration.$inferSelect;
export type PersonalityEventRow = typeof personalityEvents.$inferSelect;

// ============================================================================
// User Personality Operations
// ============================================================================

/**
 * Get user personality
 */
export async function getPersonality(
  userId: string
): Promise<UserPersonalityRow | null> {
  const results = await db
    .select()
    .from(userPersonality)
    .where(eq(userPersonality.userId, userId))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Create or update user personality
 */
export async function upsertPersonality(
  userId: string,
  traits: unknown,
  effectiveAutonomy?: number
): Promise<UserPersonalityRow> {
  const existing = await getPersonality(userId);

  if (existing) {
    const results = await db
      .update(userPersonality)
      .set({
        traits,
        effectiveAutonomy: effectiveAutonomy ?? existing.effectiveAutonomy,
        traitsUpdated: new Date(),
        updated: new Date(),
      })
      .where(eq(userPersonality.userId, userId))
      .returning();

    return results[0]!;
  }

  const results = await db
    .insert(userPersonality)
    .values({
      userId,
      traits,
      effectiveAutonomy: effectiveAutonomy ?? 0.5,
    })
    .returning();

  return results[0]!;
}

/**
 * Update effective autonomy
 */
export async function updateEffectiveAutonomy(
  userId: string,
  effectiveAutonomy: number
): Promise<void> {
  await db
    .update(userPersonality)
    .set({
      effectiveAutonomy,
      updated: new Date(),
    })
    .where(eq(userPersonality.userId, userId));
}

/**
 * Delete user personality
 */
export async function deletePersonality(userId: string): Promise<boolean> {
  const result = await db
    .delete(userPersonality)
    .where(eq(userPersonality.userId, userId));

  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Calibration Operations
// ============================================================================

/**
 * Get calibration for a domain
 */
export async function getCalibration(
  userId: string,
  domain: string
): Promise<PersonalityCalibrationRow | null> {
  const results = await db
    .select()
    .from(personalityCalibration)
    .where(
      and(
        eq(personalityCalibration.userId, userId),
        eq(personalityCalibration.domain, domain)
      )
    )
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get all calibrations for a user
 */
export async function getAllCalibrations(
  userId: string
): Promise<PersonalityCalibrationRow[]> {
  return db
    .select()
    .from(personalityCalibration)
    .where(eq(personalityCalibration.userId, userId));
}

/**
 * Update calibration for a domain
 */
export async function updateCalibration(
  userId: string,
  domain: string,
  isCorrect: boolean
): Promise<PersonalityCalibrationRow> {
  const existing = await getCalibration(userId, domain);

  if (existing) {
    const newPredictionCount = (existing.predictionCount ?? 0) + 1;
    const newCorrectCount = (existing.correctCount ?? 0) + (isCorrect ? 1 : 0);
    const calibrationError = 1 - newCorrectCount / newPredictionCount;

    // Update recent counts (simple rolling window approximation)
    const recentPredictionCount = Math.min(
      (existing.recentPredictionCount ?? 0) + 1,
      100
    );
    const recentCorrectCount = Math.min(
      (existing.recentCorrectCount ?? 0) + (isCorrect ? 1 : 0),
      100
    );

    const results = await db
      .update(personalityCalibration)
      .set({
        predictionCount: newPredictionCount,
        correctCount: newCorrectCount,
        calibrationError,
        recentPredictionCount,
        recentCorrectCount,
        updated: new Date(),
      })
      .where(
        and(
          eq(personalityCalibration.userId, userId),
          eq(personalityCalibration.domain, domain)
        )
      )
      .returning();

    return results[0]!;
  }

  const results = await db
    .insert(personalityCalibration)
    .values({
      userId,
      domain,
      predictionCount: 1,
      correctCount: isCorrect ? 1 : 0,
      calibrationError: isCorrect ? 0 : 1,
      recentPredictionCount: 1,
      recentCorrectCount: isCorrect ? 1 : 0,
    })
    .returning();

  return results[0]!;
}

// ============================================================================
// Event Operations
// ============================================================================

/**
 * Record a personality event
 */
export async function recordEvent(
  userId: string,
  event: {
    eventType: string;
    trait: string;
    previousValue?: number;
    newValue?: number;
    reason?: string;
    metadata?: unknown;
  }
): Promise<PersonalityEventRow> {
  const results = await db
    .insert(personalityEvents)
    .values({
      userId,
      eventType: event.eventType,
      trait: event.trait,
      previousValue: event.previousValue,
      newValue: event.newValue,
      reason: event.reason,
      metadata: event.metadata,
    })
    .returning();

  return results[0]!;
}

/**
 * Get recent personality events
 */
export async function getRecentEvents(
  userId: string,
  limit = 50
): Promise<PersonalityEventRow[]> {
  return db
    .select()
    .from(personalityEvents)
    .where(eq(personalityEvents.userId, userId))
    .orderBy(desc(personalityEvents.timestamp))
    .limit(limit);
}

/**
 * Get events for a specific trait
 */
export async function getTraitEvents(
  userId: string,
  trait: string,
  limit = 20
): Promise<PersonalityEventRow[]> {
  return db
    .select()
    .from(personalityEvents)
    .where(
      and(
        eq(personalityEvents.userId, userId),
        eq(personalityEvents.trait, trait)
      )
    )
    .orderBy(desc(personalityEvents.timestamp))
    .limit(limit);
}
