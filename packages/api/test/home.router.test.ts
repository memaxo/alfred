import { afterEach, beforeAll, describe, expect, it } from "bun:test";

import {
  mockPolicyAudit,
  policyEvaluateMock,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["home.read", "home.control", "home.act"],
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

      expect(result).toMatchObject({
        ok: true,
        entity: "light-1",
        state: { on: true },
      });
      expect(typeof (result as { updatedAt?: unknown }).updatedAt).toBe(
        "number"
      );
    });

    it("uses home.act for lock/unlock/delete services", async () => {
      await caller.home.set({
        entity: "lock.front_door",
        state: { service: "unlock" },
        authz: "token",
      });

      expect(policyEvaluateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "home.act",
          resource: { kind: "home", id: "lock.front_door" },
          context: expect.objectContaining({
            entity: "lock",
            service: "unlock",
          }),
        })
      );
    });
  });
});
