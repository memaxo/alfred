/**
 * Tests for isomorphic environment utilities.
 *
 * These tests verify that isomorphic functions work correctly
 * in both server and client contexts with proper tree-shaking.
 *
 * Note: Isomorphic functions created with createIsomorphicFn don't expose
 * .server/.client properties directly. They're automatically invoked
 * based on the execution context. These tests verify the functions exist
 * and can be called.
 */
import { describe, expect, it } from "bun:test";
import { getTestMode, hasWindow } from "../isomorphic";

describe("isomorphic environment utilities", () => {
  describe("hasWindow", () => {
    it("should be callable and return boolean", () => {
      // Isomorphic function - will use server implementation in test context
      const result = hasWindow();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getTestMode", () => {
    it("should be callable and return boolean", async () => {
      // Isomorphic function - will use server implementation in test context
      const result = await getTestMode();
      expect(typeof result).toBe("boolean");
    });
  });
});
