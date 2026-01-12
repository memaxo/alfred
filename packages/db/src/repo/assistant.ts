/**
 * ALFRED Assistant Repository
 * Tasks, notes, reminders, bookmarks, and timers operations
 */

import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../client";
import {
  bookmarks,
  events,
  notes,
  reminders,
  tasks,
  timers,
} from "../schema/assistant";

type TaskInsert = typeof tasks.$inferInsert;
type NoteInsert = typeof notes.$inferInsert;
// type ReminderInsert = typeof reminders.$inferInsert;
// type BookmarkInsert = typeof bookmarks.$inferInsert;
// type TimerInsert = typeof timers.$inferInsert;

function cleanUpdates<T extends Record<string, unknown>>(
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

// Task operations
export async function createTask(
  userId: string,
  title: string,
  description?: string,
  priority = 0,
  due?: Date,
  projectId?: string
): Promise<typeof tasks.$inferSelect> {
  const res = await db
    .insert(tasks)
    .values({
      userId,
      projectId,
      title,
      description: description ?? null,
      priority,
      due: due ?? null,
    })
    .returning();

  const row = Array.isArray(res)
    ? res[0]
    : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
      (res as any).rows
      ? // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any).rows[0]
      : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any)[0];
  return row;
}

export function getTasks(
  userId: string,
  status?: string,
  limit = 100,
  projectId?: string
): Promise<(typeof tasks.$inferSelect)[]> {
  const conditions = [eq(tasks.userId, userId)];
  if (status) {
    conditions.push(eq(tasks.status, status));
  }
  if (projectId) {
    conditions.push(eq(tasks.projectId, projectId));
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.priority), asc(tasks.due))
    .limit(limit);
}

export async function updateTask(
  taskId: string,
  updates: Partial<TaskInsert>
): Promise<number> {
  const patch = cleanUpdates<TaskInsert>(updates, ["id", "userId", "created"]);
  if (Object.keys(patch).length === 0) {
    return 0;
  }
  patch.updated = sql`NOW()`;

  const rows = await db
    .update(tasks)
    .set(patch)
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id });
  return rows.length;
}

export async function deleteTask(taskId: string): Promise<number> {
  const rows = await db
    .delete(tasks)
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id });
  return rows.length;
}

// Note operations
export async function createNote(
  userId: string,
  content: string,
  title?: string,
  tagsInput?: string[],
  projectId?: string
): Promise<typeof notes.$inferSelect> {
  const res = await db
    .insert(notes)
    .values({
      userId,
      projectId,
      content,
      title: title ?? null,
      tags: tagsInput ?? null,
    })
    .returning();

  const row = Array.isArray(res)
    ? res[0]
    : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
      (res as any).rows
      ? // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any).rows[0]
      : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any)[0];
  return row;
}

export function getNotes(
  userId: string,
  limit = 100,
  offset = 0,
  projectId?: string
): Promise<(typeof notes.$inferSelect)[]> {
  const conditions = [eq(notes.userId, userId)];
  if (projectId) {
    conditions.push(eq(notes.projectId, projectId));
  }

  return db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.updated))
    .limit(limit)
    .offset(offset);
}

export async function getNote(
  userId: string,
  noteId: string
): Promise<typeof notes.$inferSelect | null> {
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateNote(
  noteId: string,
  updates: Partial<NoteInsert>
): Promise<number> {
  const patch = cleanUpdates<NoteInsert>(updates, ["id", "userId", "created"]);
  if (Object.keys(patch).length === 0) {
    return 0;
  }
  patch.updated = sql`NOW()`;

  const rows = await db
    .update(notes)
    .set(patch)
    .where(eq(notes.id, noteId))
    .returning({ id: notes.id });
  return rows.length;
}

export async function deleteNote(noteId: string): Promise<number> {
  const rows = await db
    .delete(notes)
    .where(eq(notes.id, noteId))
    .returning({ id: notes.id });
  return rows.length;
}

// Reminder operations
export async function createReminder(
  userId: string,
  title: string,
  due: Date,
  description?: string,
  recurring?: string,
  projectId?: string
): Promise<typeof reminders.$inferSelect> {
  const res = await db
    .insert(reminders)
    .values({
      userId,
      projectId,
      title,
      description: description ?? null,
      due,
      recurring: recurring ?? null,
    })
    .returning();

  const row = Array.isArray(res)
    ? res[0]
    : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
      (res as any).rows
      ? // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any).rows[0]
      : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any)[0];
  return row;
}

export function getDueReminders(
  userId: string,
  before: Date,
  projectId?: string
): Promise<(typeof reminders.$inferSelect)[]> {
  const conditions = [
    eq(reminders.userId, userId),
    eq(reminders.fired, false),
    lte(reminders.due, before),
  ];
  if (projectId) {
    conditions.push(eq(reminders.projectId, projectId));
  }

  return db
    .select()
    .from(reminders)
    .where(and(...conditions))
    .orderBy(asc(reminders.due));
}

export function getReminders(
  userId: string,
  limit = 100,
  offset = 0,
  projectId?: string
): Promise<(typeof reminders.$inferSelect)[]> {
  const conditions = [eq(reminders.userId, userId)];
  if (projectId) {
    conditions.push(eq(reminders.projectId, projectId));
  }

  return db
    .select()
    .from(reminders)
    .where(and(...conditions))
    .orderBy(asc(reminders.due))
    .limit(limit)
    .offset(offset);
}

export function getDueRemindersAll(
  before: Date,
  limit = 100
): Promise<(typeof reminders.$inferSelect)[]> {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.fired, false), lte(reminders.due, before)))
    .orderBy(asc(reminders.due))
    .limit(limit);
}

export async function markReminderFired(reminderId: string): Promise<number> {
  const rows = await db
    .update(reminders)
    .set({ fired: true, firedAt: sql`NOW()` })
    .where(eq(reminders.id, reminderId))
    .returning({ id: reminders.id });
  return rows.length;
}

/**
 * Conditional reminder fire/reschedule to prevent duplicate processing across scheduler instances.
 *
 * - If `nextDueAt` is null: mark as fired (one-shot).
 * - If `nextDueAt` is provided: keep `fired=false` and move `due_at` forward.
 *
 * Update succeeds only if the row is still unfired AND `due_at` still matches the value the
 * scheduler read (CAS on `due_at`).
 */
export async function advanceReminder(
  reminderId: string,
  dueAt: Date,
  nextDueAt: Date | null
): Promise<number> {
  const patch = nextDueAt
    ? { fired: false, firedAt: sql`NOW()`, due: nextDueAt }
    : { fired: true, firedAt: sql`NOW()` };

  const rows = await db
    .update(reminders)
    .set(patch)
    .where(
      and(
        eq(reminders.id, reminderId),
        eq(reminders.fired, false),
        eq(reminders.due, dueAt)
      )
    )
    .returning({ id: reminders.id });

  return rows.length;
}

export async function deleteReminder(reminderId: string): Promise<number> {
  const rows = await db
    .delete(reminders)
    .where(eq(reminders.id, reminderId))
    .returning({ id: reminders.id });
  return rows.length;
}

// Bookmark operations
export async function createBookmark(
  userId: string,
  url: string,
  title?: string,
  description?: string,
  tagsInput?: string[],
  projectId?: string
): Promise<typeof bookmarks.$inferSelect> {
  const res = await db
    .insert(bookmarks)
    .values({
      userId,
      projectId,
      url,
      title: title ?? null,
      description: description ?? null,
      tags: tagsInput ?? null,
    })
    .returning();

  const row = Array.isArray(res)
    ? res[0]
    : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
      (res as any).rows
      ? // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any).rows[0]
      : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any)[0];
  return row;
}

export function getBookmarks(
  userId: string,
  limit = 100,
  offset = 0,
  projectId?: string
): Promise<(typeof bookmarks.$inferSelect)[]> {
  const conditions = [eq(bookmarks.userId, userId)];
  if (projectId) {
    conditions.push(eq(bookmarks.projectId, projectId));
  }

  return db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(desc(bookmarks.created))
    .limit(limit)
    .offset(offset);
}

export async function deleteBookmark(bookmarkId: string): Promise<number> {
  const rows = await db
    .delete(bookmarks)
    .where(eq(bookmarks.id, bookmarkId))
    .returning({ id: bookmarks.id });
  return rows.length;
}

// Timer operations
export async function createTimer(
  userId: string,
  durationSec: number,
  label?: string,
  projectId?: string
): Promise<typeof timers.$inferSelect> {
  const res = await db
    .insert(timers)
    .values({
      userId,
      projectId,
      label: label ?? null,
      duration: durationSec,
      start: sql<Date>`NOW()`,
      end: sql<Date>`NOW() + (${durationSec}::int * interval '1 second')`,
      cancelled: false,
      completed: false,
    })
    .returning();

  const row = Array.isArray(res)
    ? res[0]
    : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
      (res as any).rows
      ? // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any).rows[0]
      : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any)[0];
  return row;
}

export function getActiveTimers(
  userId: string,
  projectId?: string
): Promise<(typeof timers.$inferSelect)[]> {
  const conditions = [
    eq(timers.userId, userId),
    eq(timers.cancelled, false),
    eq(timers.completed, false),
  ];
  if (projectId) {
    conditions.push(eq(timers.projectId, projectId));
  }

  return db
    .select()
    .from(timers)
    .where(and(...conditions))
    .orderBy(asc(timers.end));
}

export async function markTimerCompleted(timerId: string): Promise<number> {
  const rows = await db
    .update(timers)
    .set({ completed: true, completedAt: sql`NOW()` })
    .where(eq(timers.id, timerId))
    .returning({ id: timers.id });
  return rows.length;
}

export async function cancelTimer(timerId: string): Promise<number> {
  const rows = await db
    .update(timers)
    .set({ cancelled: true, cancelledAt: sql`NOW()` })
    .where(eq(timers.id, timerId))
    .returning({ id: timers.id });
  return rows.length;
}

// Event operations
export async function createEvent(
  userId: string,
  title: string,
  start: Date,
  end?: Date,
  description?: string,
  location?: string,
  projectId?: string
): Promise<typeof events.$inferSelect> {
  const res = await db
    .insert(events)
    .values({
      userId,
      projectId,
      title,
      start,
      end: end ?? null,
      description: description ?? null,
      location: location ?? null,
    })
    .returning();

  const row = Array.isArray(res)
    ? res[0]
    : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
      (res as any).rows
      ? // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any).rows[0]
      : // biome-ignore lint/suspicious/noExplicitAny: Drizzle return type normalization
        (res as any)[0];
  return row;
}

export function getEvents(
  userId: string,
  startAfter?: Date,
  endBefore?: Date,
  projectId?: string
): Promise<(typeof events.$inferSelect)[]> {
  const conditions = [eq(events.userId, userId)];
  if (startAfter) {
    conditions.push(sql`${events.start} >= ${startAfter}`);
  }
  if (endBefore) {
    conditions.push(sql`${events.start} <= ${endBefore}`);
  }
  if (projectId) {
    conditions.push(eq(events.projectId, projectId));
  }

  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.start));
}

export async function deleteEvent(eventId: string): Promise<number> {
  const rows = await db
    .delete(events)
    .where(eq(events.id, eventId))
    .returning({ id: events.id });
  return rows.length;
}
