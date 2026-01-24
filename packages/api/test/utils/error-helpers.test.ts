import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "bun:test";

import { assertResourceAccess } from "../../src/utils/error-helpers";

describe("assertResourceAccess", () => {
  test("throws NOT_FOUND when resource is null", () => {
    expect(() => {
      assertResourceAccess(null, "user-1", "focus_set");
    }).toThrow(TRPCError);
    try {
      assertResourceAccess(null, "user-1", "focus_set");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("NOT_FOUND");
      expect((error as TRPCError).message).toBe("focus_set_not_found");
    }
  });

  test("throws FORBIDDEN when resource belongs to different user", () => {
    const resource = { userId: "user-2", id: "set-1" };
    expect(() => {
      assertResourceAccess(resource, "user-1", "focus_set");
    }).toThrow(TRPCError);
    try {
      assertResourceAccess(resource, "user-1", "focus_set");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
      expect((error as TRPCError).message).toBe("focus_set_access_denied");
    }
  });

  test("does not throw when resource exists and belongs to user", () => {
    const resource = { userId: "user-1", id: "set-1" };
    expect(() => {
      assertResourceAccess(resource, "user-1", "focus_set");
    }).not.toThrow();
  });

  test("narrows type after assertion", () => {
    const resource: { userId: string; id: string } | null = {
      userId: "user-1",
      id: "set-1",
    };
    assertResourceAccess(resource, "user-1", "focus_set");
    // TypeScript should narrow resource to non-null here
    expect(resource.id).toBe("set-1");
  });
});
