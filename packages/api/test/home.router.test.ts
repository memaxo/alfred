import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createTestCaller } from "./utils/trpc";
import { mockPolicyAudit, resetAllMocks, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["home.read", "home.control"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("home router", () => {
  describe("list", () => {
    it("lists home entities", async () => {
      const result = await caller.home.list();

      expect(result).toEqual([]);
    });
  });

  describe("status", () => {
    it("gets entity status", async () => {
      const result = await caller.home.status({
        entity: "light-1",
      });

      expect(result).toMatchObject({
        entity: "light-1",
        state: null,
      });
    });
  });

  describe("set", () => {
    it("sets entity state", async () => {
      const result = await caller.home.set({
        entity: "light-1",
        state: { on: true },
        authz: "token",
      });

      expect(result).toEqual({
        ok: true,
        entity: "light-1",
        state: { on: true },
      });
    });
  });
});

