import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

import * as assistantRepo from "../src/repo/assistant";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER = "repo-assistant-test";

let db: typeof import("@alfred/db").db;

async function resetAssistantTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE assistant_notes, assistant_reminders, assistant_timers, assistant_bookmarks, assistant_tasks RESTART IDENTITY CASCADE`
  );
}

describeFn("assistantRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "assistantRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ db } = mod);
  });

  beforeEach(async () => {
    await resetAssistantTables();
  });

  describe("notes", () => {
    it("creates and retrieves a note", async () => {
      const start = performance.now();
      const note = await assistantRepo.createNote(
        TEST_USER,
        "Test note content",
        "Test Title",
        ["tag1", "tag2"]
      );
      const createTime = performance.now() - start;

      expect(note.userId).toBe(TEST_USER);
      expect(note.content).toBe("Test note content");
      expect(note.title).toBe("Test Title");
      expect(note.tags).toEqual(["tag1", "tag2"]);
      // First operation may be slower due to connection setup, allow up to 50ms
      expect(createTime).toBeLessThan(50);

      const start2 = performance.now();
      const notes = await assistantRepo.getNotes(TEST_USER, 100, 0);
      const queryTime = performance.now() - start2;

      expect(notes).toHaveLength(1);
      expect(notes[0]?.id).toBe(note.id);
      expect(queryTime).toBeLessThan(10); // <10ms budget for subsequent queries
    });

    it("creates note without optional fields", async () => {
      const note = await assistantRepo.createNote(TEST_USER, "Content only");

      expect(note.title).toBeNull();
      expect(note.tags).toBeNull();
      expect(note.content).toBe("Content only");
    });

    it("scopes notes to user", async () => {
      await assistantRepo.createNote(TEST_USER, "User 1 note");
      await assistantRepo.createNote("other-user", "User 2 note");

      const notes = await assistantRepo.getNotes(TEST_USER);

      expect(notes).toHaveLength(1);
      expect(notes[0]?.userId).toBe(TEST_USER);
    });

    it("updates note", async () => {
      const note = await assistantRepo.createNote(
        TEST_USER,
        "Original content",
        "Original title"
      );

      const start = performance.now();
      const updated = await assistantRepo.updateNote(note.id, {
        title: "Updated title",
        content: "Updated content",
        tags: ["updated"],
      });
      const updateTime = performance.now() - start;

      expect(updated).toBe(1);
      expect(updateTime).toBeLessThan(10); // <10ms budget

      const notes = await assistantRepo.getNotes(TEST_USER);
      expect(notes[0]?.title).toBe("Updated title");
      expect(notes[0]?.content).toBe("Updated content");
      expect(notes[0]?.tags).toEqual(["updated"]);
    });

    it("deletes note", async () => {
      const note = await assistantRepo.createNote(TEST_USER, "To delete");

      const start = performance.now();
      const deleted = await assistantRepo.deleteNote(note.id);
      const deleteTime = performance.now() - start;

      expect(deleted).toBe(1);
      expect(deleteTime).toBeLessThan(10); // <10ms budget

      const notes = await assistantRepo.getNotes(TEST_USER);
      expect(notes).toHaveLength(0);
    });

    it("handles pagination", async () => {
      // Create multiple notes
      for (let i = 0; i < 5; i++) {
        await assistantRepo.createNote(TEST_USER, `Note ${i}`);
      }

      const firstPage = await assistantRepo.getNotes(TEST_USER, 2, 0);
      expect(firstPage).toHaveLength(2);

      const secondPage = await assistantRepo.getNotes(TEST_USER, 2, 2);
      expect(secondPage).toHaveLength(2);
      expect(secondPage[0]?.id).not.toBe(firstPage[0]?.id);
    });
  });

  describe("reminders", () => {
    it("creates and retrieves a reminder", async () => {
      const due = new Date("2025-12-31T12:00:00Z");
      const start = performance.now();
      const reminder = await assistantRepo.createReminder(
        TEST_USER,
        "Test Reminder",
        due,
        "Test description",
        "daily"
      );
      const createTime = performance.now() - start;

      expect(reminder.userId).toBe(TEST_USER);
      expect(reminder.title).toBe("Test Reminder");
      expect(reminder.due).toEqual(due);
      expect(reminder.description).toBe("Test description");
      expect(reminder.recurring).toBe("daily");
      expect(createTime).toBeLessThan(10); // <10ms budget

      const start2 = performance.now();
      const reminders = await assistantRepo.getReminders(TEST_USER);
      const queryTime = performance.now() - start2;

      expect(reminders).toHaveLength(1);
      expect(queryTime).toBeLessThan(10); // <10ms budget
    });

    it("gets due reminders", async () => {
      const past = new Date("2025-01-01T12:00:00Z");
      const future = new Date("2026-01-01T12:00:00Z");
      const now = new Date("2025-06-01T12:00:00Z");

      await assistantRepo.createReminder(TEST_USER, "Past", past);
      await assistantRepo.createReminder(TEST_USER, "Future", future);

      const start = performance.now();
      const due = await assistantRepo.getDueReminders(TEST_USER, now);
      const queryTime = performance.now() - start;

      expect(due).toHaveLength(1);
      expect(due[0]?.title).toBe("Past");
      expect(queryTime).toBeLessThan(10); // <10ms budget
    });

    it("marks reminder as fired", async () => {
      const reminder = await assistantRepo.createReminder(
        TEST_USER,
        "To fire",
        new Date("2025-01-01T12:00:00Z")
      );

      const start = performance.now();
      const updated = await assistantRepo.markReminderFired(reminder.id);
      const updateTime = performance.now() - start;

      expect(updated).toBe(1);
      expect(updateTime).toBeLessThan(10); // <10ms budget

      const reminders = await assistantRepo.getReminders(TEST_USER);
      expect(reminders[0]?.fired).toBe(true);
    });

    it("advances reminder with CAS semantics", async () => {
      const due = new Date("2025-01-27T11:00:00Z");
      const reminder = await assistantRepo.createReminder(
        TEST_USER,
        "Recurring",
        due,
        undefined,
        "daily"
      );

      const nextDue = new Date("2025-01-28T11:00:00Z");

      // Succeeds when due_at matches and fired=false.
      const updated1 = await assistantRepo.advanceReminder(
        reminder.id,
        due,
        nextDue
      );
      expect(updated1).toBe(1);

      const rows1 = await assistantRepo.getReminders(TEST_USER);
      expect(rows1).toHaveLength(1);
      expect(rows1[0]?.fired).toBe(false);
      expect(rows1[0]?.due).toEqual(nextDue);

      // Fails when due_at no longer matches (CAS prevents double-processing).
      const updated2 = await assistantRepo.advanceReminder(
        reminder.id,
        due,
        new Date("2025-01-29T11:00:00Z")
      );
      expect(updated2).toBe(0);

      const rows2 = await assistantRepo.getReminders(TEST_USER);
      expect(rows2[0]?.due).toEqual(nextDue);

      // Mark as fired only when current due_at matches.
      const updated3 = await assistantRepo.advanceReminder(
        reminder.id,
        nextDue,
        null
      );
      expect(updated3).toBe(1);

      const rows3 = await assistantRepo.getReminders(TEST_USER);
      expect(rows3[0]?.fired).toBe(true);
    });

    it("deletes reminder", async () => {
      const reminder = await assistantRepo.createReminder(
        TEST_USER,
        "To delete",
        new Date("2025-12-31T12:00:00Z")
      );

      const start = performance.now();
      const deleted = await assistantRepo.deleteReminder(reminder.id);
      const deleteTime = performance.now() - start;

      expect(deleted).toBe(1);
      expect(deleteTime).toBeLessThan(10); // <10ms budget

      const reminders = await assistantRepo.getReminders(TEST_USER);
      expect(reminders).toHaveLength(0);
    });
  });

  describe("timers", () => {
    it("creates and retrieves active timers", async () => {
      const start = performance.now();
      const timer = await assistantRepo.createTimer(
        TEST_USER,
        60,
        "Test Timer"
      );
      const createTime = performance.now() - start;

      expect(timer.userId).toBe(TEST_USER);
      expect(timer.duration).toBe(60);
      expect(timer.label).toBe("Test Timer");
      expect(timer.completed).toBe(false);
      expect(createTime).toBeLessThan(10); // <10ms budget

      const start2 = performance.now();
      const active = await assistantRepo.getActiveTimers(TEST_USER);
      const queryTime = performance.now() - start2;

      expect(active).toHaveLength(1);
      expect(active[0]?.id).toBe(timer.id);
      expect(queryTime).toBeLessThan(10); // <10ms budget
    });

    it("marks timer as completed", async () => {
      const timer = await assistantRepo.createTimer(TEST_USER, 30);

      const start = performance.now();
      const updated = await assistantRepo.markTimerCompleted(timer.id);
      const updateTime = performance.now() - start;

      expect(updated).toBe(1);
      expect(updateTime).toBeLessThan(10); // <10ms budget

      const active = await assistantRepo.getActiveTimers(TEST_USER);
      expect(active).toHaveLength(0);
    });

    it("cancels timer", async () => {
      const timer = await assistantRepo.createTimer(TEST_USER, 30);

      const start = performance.now();
      const updated = await assistantRepo.cancelTimer(timer.id);
      const updateTime = performance.now() - start;

      expect(updated).toBe(1);
      expect(updateTime).toBeLessThan(10); // <10ms budget

      const active = await assistantRepo.getActiveTimers(TEST_USER);
      expect(active).toHaveLength(0);
    });
  });

  describe("bookmarks", () => {
    it("creates and retrieves a bookmark", async () => {
      const start = performance.now();
      const bookmark = await assistantRepo.createBookmark(
        TEST_USER,
        "https://example.com",
        "Example",
        "Test description",
        ["web", "test"]
      );
      const createTime = performance.now() - start;

      expect(bookmark.userId).toBe(TEST_USER);
      expect(bookmark.url).toBe("https://example.com");
      expect(bookmark.title).toBe("Example");
      expect(bookmark.description).toBe("Test description");
      expect(bookmark.tags).toEqual(["web", "test"]);
      expect(createTime).toBeLessThan(10); // <10ms budget

      const start2 = performance.now();
      const bookmarks = await assistantRepo.getBookmarks(TEST_USER);
      const queryTime = performance.now() - start2;

      expect(bookmarks).toHaveLength(1);
      expect(queryTime).toBeLessThan(10); // <10ms budget
    });

    it("deletes bookmark", async () => {
      const bookmark = await assistantRepo.createBookmark(
        TEST_USER,
        "https://example.com"
      );

      const start = performance.now();
      const deleted = await assistantRepo.deleteBookmark(bookmark.id);
      const deleteTime = performance.now() - start;

      expect(deleted).toBe(1);
      expect(deleteTime).toBeLessThan(10); // <10ms budget

      const bookmarks = await assistantRepo.getBookmarks(TEST_USER);
      expect(bookmarks).toHaveLength(0);
    });
  });

  describe("tasks", () => {
    it("creates and retrieves a task", async () => {
      const due = new Date("2025-12-31T12:00:00Z");
      const start = performance.now();
      const task = await assistantRepo.createTask(
        TEST_USER,
        "Test Task",
        "Task description",
        5,
        due
      );
      const createTime = performance.now() - start;

      expect(task.userId).toBe(TEST_USER);
      expect(task.title).toBe("Test Task");
      expect(task.description).toBe("Task description");
      expect(task.priority).toBe(5);
      expect(task.due).toEqual(due);
      expect(createTime).toBeLessThan(10); // <10ms budget

      const start2 = performance.now();
      const tasks = await assistantRepo.getTasks(TEST_USER);
      const queryTime = performance.now() - start2;

      expect(tasks).toHaveLength(1);
      expect(queryTime).toBeLessThan(10); // <10ms budget
    });

    it("filters tasks by status", async () => {
      const task1 = await assistantRepo.createTask(TEST_USER, "Task 1");
      await assistantRepo.updateTask(TEST_USER, task1.id, {
        status: "completed",
      });
      await assistantRepo.createTask(TEST_USER, "Task 2");

      const completed = await assistantRepo.getTasks(TEST_USER, "completed");
      expect(completed).toHaveLength(1);
      expect(completed[0]?.id).toBe(task1.id);

      const all = await assistantRepo.getTasks(TEST_USER);
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it("updates task", async () => {
      const task = await assistantRepo.createTask(TEST_USER, "Original");

      const start = performance.now();
      const updated = await assistantRepo.updateTask(TEST_USER, task.id, {
        title: "Updated",
        priority: 10,
      });
      const updateTime = performance.now() - start;

      expect(updated).toBe(1);
      expect(updateTime).toBeLessThan(10); // <10ms budget

      const tasks = await assistantRepo.getTasks(TEST_USER);
      expect(tasks[0]?.title).toBe("Updated");
      expect(tasks[0]?.priority).toBe(10);
    });

    it("deletes task", async () => {
      const task = await assistantRepo.createTask(TEST_USER, "To delete");

      const start = performance.now();
      const deleted = await assistantRepo.deleteTask(TEST_USER, task.id);
      const deleteTime = performance.now() - start;

      expect(deleted).toBe(1);
      expect(deleteTime).toBeLessThan(10); // <10ms budget

      const tasks = await assistantRepo.getTasks(TEST_USER);
      expect(tasks).toHaveLength(0);
    });
  });
});
