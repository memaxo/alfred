/**
 * ALFRED Task Queue Repository
 * CRUD operations for background task queue
 */

import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../client";
import { taskDependencies, taskExecutionLog, taskQueue } from "../schema/queue";

// ============================================================================
// Types
// ============================================================================

export type TaskQueueRow = typeof taskQueue.$inferSelect;
export type TaskQueueInsert = typeof taskQueue.$inferInsert;
export type TaskExecutionLogRow = typeof taskExecutionLog.$inferSelect;

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type TaskType =
  | "reminder"
  | "webhook"
  | "improvement"
  | "consolidation"
  | "dreaming";

// ============================================================================
// Task Queue Operations
// ============================================================================

/**
 * Add a task to the queue
 */
export async function addTask(
  task: Omit<TaskQueueInsert, "id" | "created" | "updated">
): Promise<TaskQueueRow> {
  const results = await db.insert(taskQueue).values(task).returning();
  return results[0]!;
}

/**
 * Get a task by ID
 */
export async function getTask(taskId: string): Promise<TaskQueueRow | null> {
  const results = await db
    .select()
    .from(taskQueue)
    .where(eq(taskQueue.id, taskId))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Get pending tasks for a user, ordered by priority and scheduled time
 */
export async function getPendingTasks(
  userId: string,
  limit = 10
): Promise<TaskQueueRow[]> {
  const now = new Date();

  return db
    .select()
    .from(taskQueue)
    .where(
      and(
        eq(taskQueue.userId, userId),
        eq(taskQueue.status, "pending"),
        or(isNull(taskQueue.scheduledFor), lt(taskQueue.scheduledFor, now))
      )
    )
    .orderBy(desc(taskQueue.priority), asc(taskQueue.created))
    .limit(limit);
}

/**
 * Get ready tasks (pending + not blocked + scheduled time passed)
 */
export async function getReadyTasks(
  userId: string,
  limit = 10
): Promise<TaskQueueRow[]> {
  const now = new Date();

  // First get pending tasks
  const pending = await db
    .select()
    .from(taskQueue)
    .where(
      and(
        eq(taskQueue.userId, userId),
        eq(taskQueue.status, "pending"),
        or(isNull(taskQueue.scheduledFor), lt(taskQueue.scheduledFor, now))
      )
    )
    .orderBy(desc(taskQueue.priority), asc(taskQueue.created))
    .limit(limit * 2); // Get extra in case some are blocked

  // Filter out blocked tasks
  const readyTasks: TaskQueueRow[] = [];
  for (const task of pending) {
    if (task.blockedBy) {
      // Check if blocking task is completed
      const blocker = await getTask(task.blockedBy);
      if (blocker && blocker.status !== "completed") {
        continue; // Still blocked
      }
    }

    // Check task_dependencies table
    const deps = await db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, task.id));

    let allDepsComplete = true;
    for (const dep of deps) {
      const depTask = await getTask(dep.dependsOnId);
      if (depTask && depTask.status !== "completed") {
        allDepsComplete = false;
        break;
      }
    }

    if (allDepsComplete) {
      readyTasks.push(task);
      if (readyTasks.length >= limit) break;
    }
  }

  return readyTasks;
}

/**
 * Claim a task for processing (atomic update)
 */
export async function claimTask(taskId: string): Promise<TaskQueueRow | null> {
  const results = await db
    .update(taskQueue)
    .set({
      status: "running",
      started: new Date(),
      attempts: sql`COALESCE(${taskQueue.attempts}, 0) + 1`,
      updated: new Date(),
    })
    .where(and(eq(taskQueue.id, taskId), eq(taskQueue.status, "pending")))
    .returning();

  return results[0] ?? null;
}

/**
 * Complete a task
 */
export async function completeTask(
  taskId: string,
  result?: unknown,
  usage?: { tokens: number; costCents: number }
): Promise<TaskQueueRow | null> {
  const results = await db
    .update(taskQueue)
    .set({
      status: "completed",
      completed: new Date(),
      result: result ?? null,
      actualTokens: usage?.tokens,
      costCents: usage?.costCents,
      updated: new Date(),
    })
    .where(eq(taskQueue.id, taskId))
    .returning();

  return results[0] ?? null;
}

/**
 * Fail a task
 */
export async function failTask(
  taskId: string,
  error: string
): Promise<TaskQueueRow | null> {
  const task = await getTask(taskId);
  if (!task) return null;

  const maxAttempts = task.maxAttempts ?? 3;
  const attempts = (task.attempts ?? 0) + 1;

  // If we haven't exceeded max attempts, set back to pending for retry
  const newStatus = attempts >= maxAttempts ? "failed" : "pending";

  const results = await db
    .update(taskQueue)
    .set({
      status: newStatus,
      lastError: error,
      updated: new Date(),
    })
    .where(eq(taskQueue.id, taskId))
    .returning();

  return results[0] ?? null;
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<TaskQueueRow | null> {
  const results = await db
    .update(taskQueue)
    .set({
      status: "cancelled",
      updated: new Date(),
    })
    .where(eq(taskQueue.id, taskId))
    .returning();

  return results[0] ?? null;
}

/**
 * Get task count by status for a user
 */
export async function getTaskCounts(
  userId: string
): Promise<Record<TaskStatus, number>> {
  const results = await db
    .select({
      status: taskQueue.status,
      count: sql<number>`count(*)::int`,
    })
    .from(taskQueue)
    .where(eq(taskQueue.userId, userId))
    .groupBy(taskQueue.status);

  const counts: Record<TaskStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const row of results) {
    const status = row.status as TaskStatus;
    if (status in counts) {
      counts[status] = row.count;
    }
  }

  return counts;
}

/**
 * Clean up old completed/failed/cancelled tasks
 */
export async function cleanupOldTasks(olderThanDays = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await db
    .delete(taskQueue)
    .where(
      and(
        or(
          eq(taskQueue.status, "completed"),
          eq(taskQueue.status, "failed"),
          eq(taskQueue.status, "cancelled")
        ),
        lt(taskQueue.updated, cutoff)
      )
    );

  return result.rowCount ?? 0;
}

// ============================================================================
// Task Dependencies
// ============================================================================

/**
 * Add a dependency between tasks
 */
export async function addDependency(
  taskId: string,
  dependsOnId: string
): Promise<void> {
  await db
    .insert(taskDependencies)
    .values({ taskId, dependsOnId })
    .onConflictDoNothing();
}

/**
 * Get dependencies for a task
 */
export async function getDependencies(taskId: string): Promise<string[]> {
  const results = await db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId));

  return results.map((r) => r.dependsOnId);
}

// ============================================================================
// Execution Log
// ============================================================================

/**
 * Log a task execution attempt
 */
export async function logExecution(
  log: Omit<typeof taskExecutionLog.$inferInsert, "id" | "timestamp">
): Promise<TaskExecutionLogRow> {
  const results = await db.insert(taskExecutionLog).values(log).returning();

  return results[0]!;
}

/**
 * Get execution history for a task
 */
export async function getExecutionHistory(
  taskId: string
): Promise<TaskExecutionLogRow[]> {
  return db
    .select()
    .from(taskExecutionLog)
    .where(eq(taskExecutionLog.taskId, taskId))
    .orderBy(desc(taskExecutionLog.timestamp));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get stale running tasks (for recovery)
 */
export async function getStaleRunningTasks(
  staleAfterMinutes = 30
): Promise<TaskQueueRow[]> {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - staleAfterMinutes);

  return db
    .select()
    .from(taskQueue)
    .where(and(eq(taskQueue.status, "running"), lt(taskQueue.started, cutoff)));
}

/**
 * Reset stale running tasks to pending
 */
export async function resetStaleTasks(staleAfterMinutes = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - staleAfterMinutes);

  const result = await db
    .update(taskQueue)
    .set({
      status: "pending",
      lastError: "Task timed out and was reset",
      updated: new Date(),
    })
    .where(and(eq(taskQueue.status, "running"), lt(taskQueue.started, cutoff)));

  return result.rowCount ?? 0;
}
