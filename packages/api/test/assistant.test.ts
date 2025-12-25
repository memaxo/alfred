import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { resetTables } from "@alfred/test-kit/repo";
import { createAuthedCaller } from "@alfred/test-kit/router";
import { shutdownApiServices } from "../src/init";
import { shutdownVoicePools } from "../src/voice/pools";
import { resetAgentMocks } from "./utils/agent-mock";
import { closeTestDb, createTestDb } from "./utils/db";

const SHOULD_RUN =
  process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const describeFn = SHOULD_RUN ? describe : describe.skip;

const TEST_USER = "api-assistant-test-user";
let testDbHarness: Awaited<ReturnType<typeof createTestDb>>;

async function resetAssistantTables() {
  if (!testDbHarness) {
    return;
  }
  await resetTables(testDbHarness.db, [
    "assistant_tasks",
    "assistant_notes",
    "assistant_reminders",
    "assistant_bookmarks",
    "assistant_timers",
  ]);
}

async function createCaller() {
  return createAuthedCaller(TEST_USER, { roles: [], scopes: [] });
}

describeFn("assistant routers", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "assistant router tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
      );
    }
    testDbHarness = await createTestDb();
  });

  beforeEach(async () => {
    await resetAssistantTables();
  });

  afterEach(() => {
    resetAgentMocks();
  });

  afterAll(async () => {
    if (testDbHarness) {
      await closeTestDb(testDbHarness);
    }
    shutdownApiServices();
    await shutdownVoicePools();
    // Ensure the default pool created by importing `@alfred/api` (and thus `@alfred/db`) is closed.
    const { shutdownDb } = await import("@alfred/db");
    await shutdownDb();
  });

  it("creates and lists notes for the authenticated user", async () => {
    const caller = await createCaller();
    await caller.note.create({ content: "hello router", title: "Greeting" });

    const notes = await caller.note.list({});
    expect(notes.length).toBe(1);
    expect(notes[0]?.content).toBe("hello router");
    expect(notes[0]?.userId).toBe(TEST_USER);
  });

  it("creates reminders and returns due reminders", async () => {
    const caller = await createCaller();
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
    const caller = await createCaller();
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
