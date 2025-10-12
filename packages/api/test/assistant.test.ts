import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../db/.env") });

const TEST_USER = "api-assistant-test-user";
let appRouter: typeof import("@alfred/api/routers/index").appRouter;
let db: typeof import("@alfred/db").db;

beforeAll(async () => {
  const [{ appRouter: router }, dbModule] = await Promise.all([
    import("@alfred/api/routers/index"),
    import("@alfred/db"),
  ]);
  appRouter = router;
  db = dbModule.db;
});

async function resetAssistantTables() {
  await db.execute(
    sql`TRUNCATE assistant_tasks, assistant_notes, assistant_reminders, assistant_bookmarks, assistant_timers RESTART IDENTITY CASCADE`,
  );
}

function createCaller() {
  return appRouter.createCaller({
    session: {
      user: {
        id: TEST_USER,
      },
    },
  } as any);
}

beforeEach(async () => {
  await resetAssistantTables();
});

describe("assistant routers", () => {
  it("creates and lists notes for the authenticated user", async () => {
    const caller = createCaller();
    await caller.note.create({ content: "hello router", title: "Greeting" });

    const notes = await caller.note.list({});
    expect(notes.length).toBe(1);
    expect(notes[0]?.content).toBe("hello router");
    expect(notes[0]?.userId).toBe(TEST_USER);
  });

  it("creates reminders and returns due reminders", async () => {
    const caller = createCaller();
    const now = new Date();
    const past = new Date(now.getTime() - 60_000);

    await caller.remind.create({
      title: "Router reminder",
      due: past.toISOString(),
    });

    const due = await caller.remind.due({ before: now.toISOString() });
    expect(due.length).toBe(1);
    expect(due[0]?.title).toBe("Router reminder");
  });

  it("creates timers and marks them completed", async () => {
    const caller = createCaller();
    const timer = await caller.timer.create({
      duration: 30,
      label: "Router timer",
    });
    expect(timer.userId).toBe(TEST_USER);

    const active = await caller.timer.active();
    expect(active.length).toBe(1);

    await caller.timer.done({ id: timer.id });
    const after = await caller.timer.active();
    expect(after.length).toBe(0);
  });
});
