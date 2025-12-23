import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { createTestSession } from "@alfred/test-kit/auth";
import { RuntimeContext } from "@alfred/type/runtime-context";
import { sql } from "drizzle-orm";
import { shutdownApiServices } from "../src/init";
import { shutdownVoicePools } from "../src/voice/pools";
import { resetAgentMocks } from "./utils/agent-mock";
import { closeTestDb, createTestDb } from "./utils/db";

const SHOULD_RUN =
  process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const describeFn = SHOULD_RUN ? describe : describe.skip;

const TEST_USER = "api-assistant-test-user";
let appRouter: typeof import("@alfred/api/routers/index").appRouter;
let testDbHarness: Awaited<ReturnType<typeof createTestDb>>;

async function resetAssistantTables() {
  if (!testDbHarness) {
    return;
  }
  await testDbHarness.db.execute(
    sql`TRUNCATE assistant_tasks, assistant_notes, assistant_reminders, assistant_bookmarks, assistant_timers RESTART IDENTITY CASCADE`
  );
}

function createCaller() {
  const receivedAt = new Date();
  const runtime = {
    requestId: "test-request",
    receivedAt,
    method: "POST",
    url: "http://localhost/test",
    ip: null,
    forwardedFor: [] as string[],
    userAgent: null,
    referer: null,
  };
  const runtimeContext = new RuntimeContext([
    ["requestId", runtime.requestId],
    ["receivedAt", receivedAt.toISOString()],
    ["method", runtime.method],
    ["url", runtime.url],
    ["ip", runtime.ip],
    ["forwardedFor", runtime.forwardedFor],
    ["userId", TEST_USER],
    ["scanContext", null],
  ]);
  const session = createTestSession({ id: TEST_USER });
  return appRouter.createCaller({
    session,
    runtime,
    runtimeContext,
  } as Parameters<typeof appRouter.createCaller>[0]);
}

describeFn("assistant routers", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "assistant router tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
      );
    }
    const [{ appRouter: router }] = await Promise.all([
      import("@alfred/api/routers/index"),
    ]);
    appRouter = router;
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
