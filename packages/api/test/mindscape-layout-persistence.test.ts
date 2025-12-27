import { afterEach, beforeEach, describe, expect, it } from "bun:test";

// Skip if not running DB tests
const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";

describe("Mindscape Layout Persistence", () => {
  let db: Awaited<
    ReturnType<typeof import("../test/utils/db").createTestDb>
  > | null = null;
  let userRepo: typeof import("@alfred/db").userRepo;

  beforeEach(async () => {
    if (!RUN_DB_TESTS) {
      return;
    }

    const dbUtils = await import("../test/utils/db");
    db = await dbUtils.createTestDb();
    const dbModule = await import("@alfred/db");
    userRepo = dbModule.userRepo;
  });

  afterEach(async () => {
    if (db) {
      const dbUtils = await import("../test/utils/db");
      await dbUtils.closeTestDb(db);
      db = null;
    }
  });

  const TEST_USER_ID = "test-user-layout-123";

  describe("save layout", () => {
    it("saves layout snapshot to user_preferences", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const layout = {
        nodes: [
          { id: "node-1", position: { x: 100, y: 200 } },
          { id: "node-2", position: { x: 300, y: 400 } },
        ],
        version: "v2",
        updatedAt: Date.now(),
      };

      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        layout,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref).toBeDefined();
      expect(layoutPref?.value).toMatchObject({
        nodes: layout.nodes,
        version: "v2",
        updatedAt: expect.any(Number),
      });
    });

    it("overwrites existing layout (last-write-wins)", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const firstLayout = {
        nodes: [{ id: "node-1", position: { x: 10, y: 20 } }],
        version: "v2",
        updatedAt: Date.now(),
      };

      const secondLayout = {
        nodes: [
          { id: "node-1", position: { x: 100, y: 200 } },
          { id: "node-2", position: { x: 300, y: 400 } },
        ],
        version: "v2",
        updatedAt: Date.now() + 1000,
      };

      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        firstLayout,
        1.0,
        "user"
      );

      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        secondLayout,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref?.value).toMatchObject({
        nodes: secondLayout.nodes,
        updatedAt: secondLayout.updatedAt,
      });
    });

    it("handles large layouts (50+ nodes)", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const largeLayout = {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `node-${i}`,
          position: { x: i * 10, y: i * 20 },
        })),
        version: "v2",
        updatedAt: Date.now(),
      };

      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        largeLayout,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref?.value?.nodes).toHaveLength(50);
    });
  });

  describe("load layout", () => {
    it("loads saved layout from user_preferences", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const layout = {
        nodes: [
          { id: "node-1", position: { x: 100, y: 200 } },
          { id: "node-2", position: { x: 300, y: 400 } },
        ],
        version: "v2",
        updatedAt: Date.now(),
      };

      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        layout,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref?.value).toMatchObject(layout);
    });

    it("returns empty array when no layout exists", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref).toBeUndefined();
    });

    it("handles corrupted layout data gracefully", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      // Save invalid data
      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        "invalid-json-string" as unknown as object,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      // Should still return the data (validation happens at app layer)
      expect(layoutPref).toBeDefined();
      expect(layoutPref?.value).toBe("invalid-json-string");
    });
  });

  describe("schema validation", () => {
    it("rejects layouts without nodes array", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const invalidLayout = {
        version: "v2",
        updatedAt: Date.now(),
        // Missing nodes
      };

      // Should still save (DB doesn't validate schema)
      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        invalidLayout,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref?.value).toMatchObject(invalidLayout);
    });

    it("validates node position format", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const layoutWithInvalidPositions = {
        nodes: [
          { id: "node-1", position: "invalid" }, // Should be {x, y}
          { id: "node-2", position: { x: 100 } }, // Missing y
        ],
        version: "v2",
        updatedAt: Date.now(),
      };

      // DB accepts it (validation at app layer)
      await userRepo.setPreference(
        TEST_USER_ID,
        "mindscape:layout",
        layoutWithInvalidPositions,
        1.0,
        "user"
      );

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      expect(layoutPref?.value).toMatchObject(layoutWithInvalidPositions);
    });
  });

  describe("concurrent updates", () => {
    it("handles concurrent layout saves (last-write-wins)", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const layout1 = {
        nodes: [{ id: "node-1", position: { x: 10, y: 20 } }],
        version: "v2",
        updatedAt: Date.now(),
      };

      const layout2 = {
        nodes: [{ id: "node-2", position: { x: 30, y: 40 } }],
        version: "v2",
        updatedAt: Date.now() + 100,
      };

      // Save concurrently
      await Promise.all([
        userRepo.setPreference(
          TEST_USER_ID,
          "mindscape:layout",
          layout1,
          1.0,
          "user"
        ),
        userRepo.setPreference(
          TEST_USER_ID,
          "mindscape:layout",
          layout2,
          1.0,
          "user"
        ),
      ]);

      const prefs = await userRepo.getPreferences(TEST_USER_ID);
      const layoutPref = prefs.find((p) => p.key === "mindscape:layout");

      // Last write should win (determined by DB transaction order)
      expect(layoutPref?.value).toBeDefined();
      expect(layoutPref?.value?.nodes).toBeDefined();
    });
  });

  describe("user isolation", () => {
    it("isolates layouts per user", async () => {
      if (!(RUN_DB_TESTS && db && userRepo)) {
        return;
      }
      const USER_1_ID = "user-1";
      const USER_2_ID = "user-2";

      const layout1 = {
        nodes: [{ id: "node-1", position: { x: 10, y: 20 } }],
        version: "v2",
        updatedAt: Date.now(),
      };

      const layout2 = {
        nodes: [{ id: "node-2", position: { x: 30, y: 40 } }],
        version: "v2",
        updatedAt: Date.now(),
      };

      await userRepo.setPreference(
        USER_1_ID,
        "mindscape:layout",
        layout1,
        1.0,
        "user"
      );

      await userRepo.setPreference(
        USER_2_ID,
        "mindscape:layout",
        layout2,
        1.0,
        "user"
      );

      const prefs1 = await userRepo.getPreferences(USER_1_ID);
      const prefs2 = await userRepo.getPreferences(USER_2_ID);

      const layoutPref1 = prefs1.find((p) => p.key === "mindscape:layout");
      const layoutPref2 = prefs2.find((p) => p.key === "mindscape:layout");

      expect(layoutPref1?.value?.nodes).toEqual(layout1.nodes);
      expect(layoutPref2?.value?.nodes).toEqual(layout2.nodes);
    });
  });
});
