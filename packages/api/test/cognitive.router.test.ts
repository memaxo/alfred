import { beforeEach, describe, expect, it, vi } from "bun:test";

import { dbModuleStub } from "./utils/mock-db-client";
import { setupTestEnv } from "./utils/router-helpers";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

setupTestEnv();

describe("cognitive router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("autonomyGet", () => {
    it("returns default scopes when no preferences exist", async () => {
      dbModuleStub.userRepo.getPreferences.mockResolvedValue([]);

      const caller = await createTestCaller();
      const res = await caller.cognitive.autonomyGet();

      const levels = new Map<string, number>();
      for (const scope of res.scopes) {
        levels.set(scope.scope, scope.level);
      }

      expect(levels.get("code")).toBe(0.8);
      expect(levels.get("filesystem")).toBe(0.6);
      expect(levels.get("network")).toBe(0.5);
      expect(levels.get("system")).toBe(0.3);
      expect(levels.get("sensitive")).toBe(0.2);
    });

    it("rejects unauthenticated callers", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.cognitive.autonomyGet()).rejects.toThrow(
        /Authentication required/i
      );
    });
  });

  describe("autonomySet", () => {
    it("persists scope levels via user preferences", async () => {
      const prefs = new Map<string, unknown>();

      dbModuleStub.userRepo.getPreferences.mockImplementation(async () => {
        return [...prefs.entries()].map(([key, value]) => ({ key, value }));
      });

      dbModuleStub.userRepo.setPreference.mockImplementation(
        async (_userId: string, key: string, value: unknown) => {
          prefs.set(key, value);
          return { key, value } as any;
        }
      );

      const caller = await createTestCaller({ userId: "test-user" });

      await caller.cognitive.autonomySet({ scope: "network", level: 0.9 });

      expect(dbModuleStub.userRepo.setPreference).toHaveBeenCalledWith(
        "test-user",
        "cognitive.autonomy.network",
        0.9,
        1,
        "user"
      );

      const res = await caller.cognitive.autonomyGet();
      const network = res.scopes.find((s) => s.scope === "network");
      expect(network?.level).toBe(0.9);
    });

    it("rejects unauthenticated callers", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.cognitive.autonomySet({ scope: "code", level: 0.5 })
      ).rejects.toThrow(/Authentication required/i);
    });
  });
});
