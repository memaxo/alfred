/**
 * ALFRED Assistant Repository
 * Tasks, notes, reminders, bookmarks, and timers operations
 */

import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "../index";
import {
  bookmarks,
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
  due?: Date
) {
  const [row] = await db
    .insert(tasks)
    .values({
      userId,
      title,
      description: description ?? null,
      priority,
      due: due ?? null,
    })
    .returning();
  return row;
}

export async function getTasks(userId: string, status?: string, limit = 100) {
  const where = status
    ? and(eq(tasks.userId, userId), eq(tasks.status, status))
    : eq(tasks.userId, userId);

  return db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.priority), asc(tasks.due))
    .limit(limit);
}

export async function updateTask(taskId: string, updates: Partial<TaskInsert>) {
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

export async function deleteTask(taskId: string) {
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
  tagsInput?: string[]
) {
  const [row] = await db
    .insert(notes)
    .values({
      userId,
      content,
      title: title ?? null,
      tags: tagsInput ?? null,
    })
    .returning();
  return row;
}

export async function getNotes(userId: string, limit = 100, offset = 0) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updated))
    .limit(limit)
    .offset(offset);
}

export async function updateNote(noteId: string, updates: Partial<NoteInsert>) {
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

export async function deleteNote(noteId: string) {
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
  recurring?: string
) {
  const [row] = await db
    .insert(reminders)
    .values({
      userId,
      title,
      description: description ?? null,
      due,
      recurring: recurring ?? null,
    })
    .returning();
  return row;
}

export async function getDueReminders(userId: string, before: Date) {
  return db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        eq(reminders.fired, false),
        lte(reminders.due, before)
      )
    )
    .orderBy(asc(reminders.due));
}

export async function getReminders(userId: string, limit = 100, offset = 0) {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(asc(reminders.due))
    .limit(limit)
    .offset(offset);
}

export async function getDueRemindersAll(before: Date, limit = 100) {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.fired, false), lte(reminders.due, before)))
    .orderBy(asc(reminders.due))
    .limit(limit);
}

export async function markReminderFired(reminderId: string) {
  const rows = await db
    .update(reminders)
    .set({ fired: true, firedAt: sql`NOW()` })
    .where(eq(reminders.id, reminderId))
    .returning({ id: reminders.id });
  return rows.length;
}

export async function deleteReminder(reminderId: string) {
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
  tagsInput?: string[]
) {
  const [row] = await db
    .insert(bookmarks)
    .values({
      userId,
      url,
      title: title ?? null,
      description: description ?? null,
      tags: tagsInput ?? null,
    })
    .returning();
  return row;
}

export async function getBookmarks(userId: string, limit = 100, offset = 0) {
  return db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.created))
    .limit(limit)
    .offset(offset);
}

export async function deleteBookmark(bookmarkId: string) {
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
  label?: string
) {
  const [row] = await db
    .insert(timers)
    .values({
      userId,
      label: label ?? null,
      duration: durationSec,
      start: sql<Date>`NOW()`,
      end: sql<Date>`NOW() + (${durationSec}::int * interval '1 second')`,
      cancelled: false,
      completed: false,
    })
    .returning();
  return row;
}

export async function getActiveTimers(userId: string) {
  return db
    .select()
    .from(timers)
    .where(
      and(
        eq(timers.userId, userId),
        eq(timers.cancelled, false),
        eq(timers.completed, false)
      )
    )
    .orderBy(asc(timers.end));
}

export async function markTimerCompleted(timerId: string) {
  const rows = await db
    .update(timers)
    .set({ completed: true, completedAt: sql`NOW()` })
    .where(eq(timers.id, timerId))
    .returning({ id: timers.id });
  return rows.length;
}

export async function cancelTimer(timerId: string) {
  const rows = await db
    .update(timers)
    .set({ cancelled: true, cancelledAt: sql`NOW()` })
    .where(eq(timers.id, timerId))
    .returning({ id: timers.id });
  return rows.length;
}
