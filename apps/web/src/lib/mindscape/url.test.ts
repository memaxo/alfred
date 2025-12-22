import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { clearSearchParams, getSearchParam, setSearchParam } from "./url";

// Mock hasWindow to return true for tests
mock.module("@/lib/env/isomorphic", () => ({
  hasWindow: () => true,
}));

describe("URL Helpers", () => {
  let originalLocation: Location;
  let originalHistory: History;
  let mockUrl: URL;

  beforeEach(() => {
    // Save originals
    originalLocation = globalThis.window?.location;
    originalHistory = globalThis.window?.history;

    // Create mock URL
    mockUrl = new URL("http://localhost:3000/mindscape?nodeId=123&spawn=chat&other=value");

    // Mock window.location
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          href: mockUrl.toString(),
        },
        history: {
          state: {},
          replaceState: mock(() => {}),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore originals
    if (originalLocation) {
      Object.defineProperty(globalThis.window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
    if (originalHistory) {
      Object.defineProperty(globalThis.window, "history", {
        value: originalHistory,
        writable: true,
        configurable: true,
      });
    }
  });

  describe("clearSearchParams", () => {
    it("clears specified search params", () => {
      clearSearchParams(["nodeId"]);

      expect(window.history.replaceState).toHaveBeenCalled();
      const calls = (window.history.replaceState as ReturnType<typeof mock>).mock.calls;
      const lastCall = calls.at(-1);
      expect(lastCall?.[2]).toBe("/mindscape?spawn=chat&other=value");
    });

    it("clears multiple search params", () => {
      clearSearchParams(["nodeId", "spawn"]);

      const calls = (window.history.replaceState as ReturnType<typeof mock>).mock.calls;
      const lastCall = calls.at(-1);
      expect(lastCall?.[2]).toBe("/mindscape?other=value");
    });

    it("does nothing if params not present", () => {
      clearSearchParams(["notpresent"]);

      // replaceState should not be called if nothing changed
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it("handles empty array", () => {
      clearSearchParams([]);
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe("setSearchParam", () => {
    it("sets a search param", () => {
      setSearchParam("newParam", "newValue");

      const calls = (window.history.replaceState as ReturnType<typeof mock>).mock.calls;
      const lastCall = calls.at(-1);
      expect(lastCall?.[2]).toContain("newParam=newValue");
    });

    it("removes param when value is null", () => {
      setSearchParam("nodeId", null);

      const calls = (window.history.replaceState as ReturnType<typeof mock>).mock.calls;
      const lastCall = calls.at(-1);
      expect(lastCall?.[2]).not.toContain("nodeId");
    });

    it("overwrites existing param", () => {
      setSearchParam("nodeId", "456");

      const calls = (window.history.replaceState as ReturnType<typeof mock>).mock.calls;
      const lastCall = calls.at(-1);
      expect(lastCall?.[2]).toContain("nodeId=456");
      expect(lastCall?.[2]).not.toContain("nodeId=123");
    });
  });

  describe("getSearchParam", () => {
    it("returns param value", () => {
      const value = getSearchParam("nodeId");
      expect(value).toBe("123");
    });

    it("returns null for missing param", () => {
      const value = getSearchParam("notpresent");
      expect(value).toBeNull();
    });
  });
});
