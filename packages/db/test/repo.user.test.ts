import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER = "repo-user-test";

let userRepo: typeof import("@alfred/db").userRepo;
let db: typeof import("@alfred/db").db;

async function resetUserTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE user_profiles, user_preferences, user_facts, user_events RESTART IDENTITY CASCADE`
  );
}

function makeVector(seed: number) {
  return Array.from({ length: 1536 }, (_, index) => (index === 0 ? seed : 0));
}

describeFn("userRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "userRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    userRepo = mod.userRepo;
    db = mod.db;
  });

  beforeEach(async () => {
    await resetUserTables();
  });

  it("upserts and retrieves a profile", async () => {
    const initial = await userRepo.upsertProfile(TEST_USER, {
      name: "Test User",
      email: "user@example.com",
      timezone: "America/Los_Angeles",
    });

    expect(initial.userId).toBe(TEST_USER);
    expect(initial.name).toBe("Test User");

    const updated = await userRepo.upsertProfile(TEST_USER, {
      name: "Updated User",
    });

    expect(updated.name).toBe("Updated User");

    const profile = await userRepo.getProfile(TEST_USER);
    expect(profile?.name).toBe("Updated User");
    expect(profile?.email).toBe("user@example.com");
  });

  it("sets, lists, and deletes preferences", async () => {
    await userRepo.setPreference(TEST_USER, "theme", { mode: "dark" });
    await userRepo.setPreference(
      TEST_USER,
      "language",
      "en-US",
      0.8,
      "inferred"
    );

    const preferences = await userRepo.getPreferences(TEST_USER);
    expect(preferences.length).toBe(2);

    await userRepo.setPreference(
      TEST_USER,
      "theme",
      { mode: "light" },
      0.9,
      "user"
    );
    const afterUpdate = await userRepo.getPreferences(TEST_USER);
    const theme = afterUpdate.find((pref) => pref.key === "theme");
    expect(theme?.value).toEqual({ mode: "light" });

    const removed = await userRepo.deletePreference(TEST_USER, "language");
    expect(removed).toBe(1);

    const finalPreferences = await userRepo.getPreferences(TEST_USER);
    expect(finalPreferences.some((pref) => pref.key === "language")).toBe(
      false
    );
  });

  it("adds facts and returns semantic matches above threshold", async () => {
    const referenceVector = makeVector(0.5);
    await userRepo.addFact(
      TEST_USER,
      "User likes coffee",
      makeVector(0.5),
      "personal",
      0.9,
      "user"
    );
    await userRepo.addFact(
      TEST_USER,
      "Unrelated fact",
      makeVector(-0.5),
      "other",
      0.4,
      "inferred"
    );

    const matches = await userRepo.searchFacts(
      TEST_USER,
      referenceVector,
      5,
      0.2
    );
    expect(matches.length).toBe(1);
    expect(matches[0]?.content).toBe("User likes coffee");

    const listed = await userRepo.listFacts(TEST_USER, 10, 0);
    expect(listed.length).toBe(2);
  });

  it("records and filters timeline events", async () => {
    await userRepo.addEvent(TEST_USER, "conversation", { summary: "Greeted" });
    await userRepo.addEvent(
      TEST_USER,
      "tool_use",
      { tool: "note" },
      { result: "created" }
    );

    const allEvents = await userRepo.getEvents(TEST_USER);
    expect(allEvents.length).toBe(2);
    expect(allEvents[0]?.type).toBeDefined();

    const filtered = await userRepo.getEvents(TEST_USER, "tool_use", 10, 0);
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.data).toEqual({ tool: "note" });
  });
});
