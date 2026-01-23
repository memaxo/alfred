/**
 * Real Database Fixture Helper
 *
 * Provides utilities for integration tests that need real database access.
 * Uses SQLite in-memory by default for fast tests, Postgres when RUN_DB_TESTS=1.
 *
 * @see docs/architecture/test-dependency-injection.md
 */

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "@alfred/db";

type DbFixture = {
  db: typeof db;
  reset: () => Promise<void>;
  cleanup: () => Promise<void>;
};

/**
 * Creates a real database fixture for integration tests.
 * Uses SQLite in-memory by default, Postgres when RUN_DB_TESTS=1.
 */
export async function createDbFixture(): Promise<DbFixture> {
  // Use real db instance (already initialized)
  const testDb = db;

  async function reset(): Promise<void> {
    // Reset common tables used in router tests
    const tables = [
      "assistant_messages",
      "assistant_threads",
      "user_preferences",
      "user_profiles",
      "workflow_runs",
      "memory_edges",
      "memory_nodes",
    ];

    try {
      for (const table of tables) {
        await testDb.execute(sql.raw(`DELETE FROM ${table}`));
      }
    } catch {
      // Tables may not exist in test mode
    }
  }

  async function cleanup(): Promise<void> {
    await reset();
  }

  return {
    db: testDb,
    reset,
    cleanup,
  };
}

/**
 * Creates test data for common scenarios
 */
export const dbTestData = {
  async createUser(userId = "test-user", email?: string) {
    const { userProfiles } = await import("@alfred/db/schema/auth");
    const { db } = await import("@alfred/db");
    await db
      .insert(userProfiles)
      .values({
        id: userId,
        email: email ?? `${userId}@test.local`,
        name: `Test User ${userId}`,
      })
      .onConflictDoNothing();
    return userId;
  },

  async createThread(userId = "test-user", agent = "assistant") {
    const { assistantThreads } = await import("@alfred/db/schema/workflow");
    const { db } = await import("@alfred/db");
    const [thread] = await db
      .insert(assistantThreads)
      .values({
        userId,
        agent,
      })
      .returning();
    return thread.id;
  },
};
