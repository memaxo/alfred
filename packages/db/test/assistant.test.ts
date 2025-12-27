import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN =
  process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const TEST_USER = "assistant-test-user";

let assistantRepo: typeof import("@alfred/db").assistantRepo;
let db: typeof import("@alfred/db").db;

async function resetAssistantTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE assistant_tasks, assistant_notes, assistant_reminders, assistant_bookmarks, assistant_timers RESTART IDENTITY CASCADE`
  );
}

const describeFn = SHOULD_RUN ? describe : describe.skip;

describeFn("assistantRepo", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "assistantRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
      );
    }
    const mod = await import("@alfred/db");
    assistantRepo = mod.assistantRepo;
    db = mod.db;
  });

  beforeEach(async () => {
    await resetAssistantTables();
  });

  afterAll(async () => {
    // Ensure the default pool created by importing `@alfred/db` is closed so Bun exits.
    const { shutdownDb } = await import("@alfred/db");
    await shutdownDb();
  });

  it("creates and lists notes in descending update order", async () => {
    const first = await assistantRepo.createNote(
      TEST_USER,
      "first note",
      "First"
    );
    await assistantRepo.createNote(TEST_USER, "second note", "Second");

    const notes = await assistantRepo.getNotes(TEST_USER, 10, 0);
    expect(notes.length).toBe(2);
    expect(notes[0]?.id).not.toBeUndefined();
    expect(notes[0]?.content).toBe("second note");

    await assistantRepo.updateNote(first.id, { content: "updated" });
    const refreshed = await assistantRepo.getNotes(TEST_USER, 10, 0);
    expect(refreshed[0]?.content).toBe("updated");
  });

  it("scans due reminders and marks them fired", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);
    const future = new Date(now.getTime() + 60_000);

    const dueReminder = await assistantRepo.createReminder(
      TEST_USER,
      "Due",
      past
    );
    await assistantRepo.createReminder(TEST_USER, "Future", future);

    const due = await assistantRepo.getDueReminders(TEST_USER, now);
    expect(due.length).toBe(1);
    expect(due[0]?.title).toBe("Due");

    const updated = await assistantRepo.markReminderFired(dueReminder.id);
    expect(updated).toBe(1);

    const after = await assistantRepo.getDueReminders(TEST_USER, now);
    expect(after.length).toBe(0);
  });

  it("creates timers and clears them when completed", async () => {
    await assistantRepo.createTimer(TEST_USER, 30, "Pomodoro");

    const active = await assistantRepo.getActiveTimers(TEST_USER);
    expect(active.length).toBe(1);
    const timerId = active[0]?.id;
    expect(timerId).not.toBeUndefined();

    if (timerId) {
      await assistantRepo.markTimerCompleted(timerId);
    }

    const afterComplete = await assistantRepo.getActiveTimers(TEST_USER);
    expect(afterComplete.length).toBe(0);
  });

  it("creates tasks and filters by status ordering by priority then due", async () => {
    await assistantRepo.createTask(TEST_USER, "Low priority", undefined, 0);
    await assistantRepo.createTask(TEST_USER, "High priority", undefined, 5);
    await assistantRepo.createTask(
      TEST_USER,
      "Medium priority due sooner",
      undefined,
      2,
      new Date(Date.now() + 3_600_000)
    );

    const tasks = await assistantRepo.getTasks(TEST_USER);
    expect(tasks.length).toBe(3);
    expect(tasks[0]?.title).toBe("High priority");
  });
});
