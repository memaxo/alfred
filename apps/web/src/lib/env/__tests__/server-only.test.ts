/**
 * Tests for server-only environment utilities.
 *
 * These tests verify that server-only functions work correctly
 * and provide runtime protection against client calls.
 */
import { describe, expect, it } from "bun:test";
import {
  getBunTest,
  getDatabaseUrl,
  getMindscapeTest,
  getNodeEnv,
  getSchedPreferenceInference,
  getSchedRemind,
  getViteTestMode,
} from "../server-only";

describe("server-only environment utilities", () => {
  describe("getDatabaseUrl", () => {
    it("should return DATABASE_URL from process.env", () => {
      const original = process.env.DATABASE_URL;
      process.env.DATABASE_URL = "postgres://test:5432/db";
      try {
        const result = getDatabaseUrl();
        expect(result).toBe("postgres://test:5432/db");
      } finally {
        if (original) {
          process.env.DATABASE_URL = original;
        } else {
          delete process.env.DATABASE_URL;
        }
      }
    });

    it("should return undefined if DATABASE_URL is not set", () => {
      const original = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;
      try {
        const result = getDatabaseUrl();
        expect(result).toBeUndefined();
      } finally {
        if (original) {
          process.env.DATABASE_URL = original;
        }
      }
    });
  });

  describe("getNodeEnv", () => {
    it("should return NODE_ENV from process.env", () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";
      try {
        const result = getNodeEnv();
        expect(result).toBe("test");
      } finally {
        if (original) {
          process.env.NODE_ENV = original;
        } else {
          delete process.env.NODE_ENV;
        }
      }
    });
  });

  describe("getSchedRemind", () => {
    it("should return SCHED_REMIND from process.env", () => {
      const original = process.env.SCHED_REMIND;
      process.env.SCHED_REMIND = "1";
      try {
        const result = getSchedRemind();
        expect(result).toBe("1");
      } finally {
        if (original) {
          process.env.SCHED_REMIND = original;
        } else {
          delete process.env.SCHED_REMIND;
        }
      }
    });
  });

  describe("getSchedPreferenceInference", () => {
    it("should return SCHED_PREFERENCE_INFERENCE from process.env", () => {
      const original = process.env.SCHED_PREFERENCE_INFERENCE;
      process.env.SCHED_PREFERENCE_INFERENCE = "1";
      try {
        const result = getSchedPreferenceInference();
        expect(result).toBe("1");
      } finally {
        if (original) {
          process.env.SCHED_PREFERENCE_INFERENCE = original;
        } else {
          delete process.env.SCHED_PREFERENCE_INFERENCE;
        }
      }
    });
  });

  describe("getViteTestMode", () => {
    it("should return VITE_TEST_MODE from process.env", () => {
      const original = process.env.VITE_TEST_MODE;
      process.env.VITE_TEST_MODE = "true";
      try {
        const result = getViteTestMode();
        expect(result).toBe("true");
      } finally {
        if (original) {
          process.env.VITE_TEST_MODE = original;
        } else {
          delete process.env.VITE_TEST_MODE;
        }
      }
    });
  });

  describe("getMindscapeTest", () => {
    it("should return MINDSCAPE_TEST from process.env", () => {
      const original = process.env.MINDSCAPE_TEST;
      process.env.MINDSCAPE_TEST = "1";
      try {
        const result = getMindscapeTest();
        expect(result).toBe("1");
      } finally {
        if (original) {
          process.env.MINDSCAPE_TEST = original;
        } else {
          delete process.env.MINDSCAPE_TEST;
        }
      }
    });
  });

  describe("getBunTest", () => {
    it("should return BUN_TEST from process.env", () => {
      const original = process.env.BUN_TEST;
      process.env.BUN_TEST = "1";
      try {
        const result = getBunTest();
        expect(result).toBe("1");
      } finally {
        if (original) {
          process.env.BUN_TEST = original;
        } else {
          delete process.env.BUN_TEST;
        }
      }
    });
  });
});
