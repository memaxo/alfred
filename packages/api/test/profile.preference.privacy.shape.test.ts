import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { resetAgentMocks } from "./utils/agent-mock";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../db/.env") });

const TEST_USER = "api-user-memory";

mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

let appRouter: typeof import("@alfred/api/routers/index").appRouter;
let userRepo: typeof import("@alfred/db").userRepo;
let db: typeof import("@alfred/db").db;

beforeAll(async () => {
  const [{ appRouter: router }, dbModule] = await Promise.all([
    import("@alfred/api/routers/index"),
    import("@alfred/db"),
  ]);

  appRouter = router;
  userRepo = dbModule.userRepo;
  db = dbModule.db;
});

function makeVector(seed: number) {
  return Array.from({ length: 1536 }, (_, index) => (index === 0 ? seed : 0));
}

async function resetUserTables() {
  await db.execute(
    sql`TRUNCATE user_profiles, user_preferences, user_facts, user_events RESTART IDENTITY CASCADE`,
  );
}

function createCaller(scopes: string[] = ["profile.write", "preference.write", "privacy.purge"]) {
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
    ["userRoles", ["owner"]],
    ["userScopes", scopes],
  ]);
  return appRouter.createCaller({
    session: {
      user: {
        id: TEST_USER,
        roles: ["owner"],
        scopes,
      },
    },
    runtime,
    runtimeContext,
  } as any);
}

beforeEach(async () => {
  await resetUserTables();
});

afterEach(() => {
  vi.clearAllMocks();
  resetAgentMocks();
});

describe("profileRouter", () => {
  it("retrieves and updates a profile", async () => {
    const caller = createCaller();

    const empty = await caller.profile.get();
    expect(empty).toBeNull();

    const updated = await caller.profile.update({
      name: "Personal Assistant",
      email: "assistant@example.com",
      timezone: "America/New_York",
    });

    expect(updated.name).toBe("Personal Assistant");

    const stored = await caller.profile.get();
    expect(stored?.email).toBe("assistant@example.com");
  });
});

describe("preferenceRouter", () => {
  it("sets, lists, and deletes preferences", async () => {
    const caller = createCaller();

    const initial = await caller.preference.list();
    expect(initial).toHaveLength(0);

    await caller.preference.set({ key: "theme", value: { mode: "dark" }, confidence: 0.9 });
    const afterSet = await caller.preference.list();
    expect(afterSet.length).toBe(1);
    expect(afterSet[0]?.key).toBe("theme");

    const removal = await caller.preference.delete({ key: "theme" });
    expect(removal.removed).toBe(1);

    const finalList = await caller.preference.list();
    expect(finalList.length).toBe(0);
  });
});

describe("privacyRouter", () => {
  it("lists and searches facts then deletes them", async () => {
    await userRepo.addFact(TEST_USER, "User loves espresso", makeVector(0.5));
    const distantFact = await userRepo.addFact(TEST_USER, "Irrelevant", makeVector(-0.5));

    const caller = createCaller();

    const facts = await caller.privacy.facts();
    expect(facts.length).toBe(2);

    const matches = await caller.privacy.facts({ embedding: makeVector(0.5), threshold: 0.1 });
    expect(matches.length).toBe(1);
    expect(matches[0]?.content).toBe("User loves espresso");

    const removal = await caller.privacy.deleteFact({ id: distantFact.id, scope: "fact" });
    expect(removal.removed).toBe(1);

    const remaining = await caller.privacy.facts();
    expect(remaining.length).toBe(1);
  });

  it("returns recent events", async () => {
    await userRepo.addEvent(TEST_USER, "conversation", { summary: "hello" });
    await userRepo.addEvent(TEST_USER, "tool_use", { tool: "note" });

    const caller = createCaller();
    const events = await caller.privacy.events({ type: "tool_use" });
    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe("tool_use");
  });
});
