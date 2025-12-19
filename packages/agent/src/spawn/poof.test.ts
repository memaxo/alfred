import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  POOF_EXIT_CODES,
  POOF_PROFILES,
  POOF_SANDBOX_ENV,
  buildPoofArgs,
  isCommandNotFound,
  isInsideSandbox,
  isPoofAvailable,
  isPoofTimeout,
  resetPoofCache,
  resolvePoofBinary,
} from "./poof.js";

describe("poof", () => {
  beforeEach(() => {
    resetPoofCache();
  });

  afterEach(() => {
    resetPoofCache();
    // Reset env vars
    delete process.env.POOF_BIN;
    delete process.env[POOF_SANDBOX_ENV];
  });

  describe("POOF_PROFILES", () => {
    test("minimal profile has correct values", () => {
      expect(POOF_PROFILES.minimal).toEqual({
        name: "minimal",
        memory: "256M",
        pids: 20,
        timeout: 60,
      });
    });

    test("standard profile has correct values", () => {
      expect(POOF_PROFILES.standard).toEqual({
        name: "standard",
        memory: "1G",
        pids: 100,
        timeout: 300,
      });
    });

    test("intensive profile has correct values", () => {
      expect(POOF_PROFILES.intensive).toEqual({
        name: "intensive",
        memory: "4G",
        pids: 500,
        timeout: 600,
      });
    });
  });

  describe("buildPoofArgs", () => {
    test("builds args for exec mode", () => {
      const args = buildPoofArgs({ mode: "exec" });
      expect(args).toEqual(["exec"]);
    });

    test("builds args for run mode with upper dir", () => {
      const args = buildPoofArgs({
        mode: "run",
        upperDir: "/tmp/upper",
      });
      expect(args).toEqual(["run", "--upper=/tmp/upper"]);
    });

    test("builds args with full profile", () => {
      const args = buildPoofArgs({
        mode: "run",
        upperDir: "/tmp/upper",
        profile: POOF_PROFILES.standard,
      });
      expect(args).toEqual([
        "run",
        "--upper=/tmp/upper",
        "--memory=1G",
        "--pids=100",
        "--timeout=300",
      ]);
    });

    test("builds args with verbose flag", () => {
      const args = buildPoofArgs({
        mode: "exec",
        verbose: true,
      });
      expect(args).toEqual(["exec", "--verbose"]);
    });

    test("builds args with partial profile", () => {
      const args = buildPoofArgs({
        mode: "exec",
        profile: { name: "custom", memory: "512M" },
      });
      expect(args).toEqual(["exec", "--memory=512M"]);
    });
  });

  describe("exit code helpers", () => {
    test("isPoofTimeout returns true for 124", () => {
      expect(isPoofTimeout(124)).toBe(true);
      expect(isPoofTimeout(0)).toBe(false);
      expect(isPoofTimeout(1)).toBe(false);
    });

    test("isCommandNotFound returns true for 127", () => {
      expect(isCommandNotFound(127)).toBe(true);
      expect(isCommandNotFound(0)).toBe(false);
      expect(isCommandNotFound(1)).toBe(false);
    });

    test("POOF_EXIT_CODES has correct values", () => {
      expect(POOF_EXIT_CODES.TIMEOUT).toBe(124);
      expect(POOF_EXIT_CODES.NOT_FOUND).toBe(127);
    });
  });

  describe("isInsideSandbox", () => {
    test("returns false when not in sandbox", () => {
      delete process.env[POOF_SANDBOX_ENV];
      expect(isInsideSandbox()).toBe(false);
    });

    test("returns true when IS_SANDBOX=1", () => {
      process.env[POOF_SANDBOX_ENV] = "1";
      expect(isInsideSandbox()).toBe(true);
    });

    test("returns false when IS_SANDBOX=0", () => {
      process.env[POOF_SANDBOX_ENV] = "0";
      expect(isInsideSandbox()).toBe(false);
    });
  });

  describe("isPoofAvailable", () => {
    test("returns false on non-Linux platforms", () => {
      // This test will pass on non-Linux, fail on Linux if poof not installed
      if (process.platform !== "linux") {
        expect(isPoofAvailable()).toBe(false);
      }
    });

    test("caches availability result", () => {
      const first = isPoofAvailable();
      const second = isPoofAvailable();
      expect(first).toBe(second);
    });

    test("respects POOF_BIN override for non-existent path", () => {
      process.env.POOF_BIN = "/nonexistent/path/to/poof";
      resetPoofCache();
      expect(resolvePoofBinary()).toBe(null);
    });
  });

  describe("resolvePoofBinary", () => {
    test("returns null when POOF_BIN points to non-executable", () => {
      process.env.POOF_BIN = "/dev/null";
      resetPoofCache();
      // /dev/null exists but is not executable
      const result = resolvePoofBinary();
      expect(result).toBe(null);
    });

    test("caches resolved binary path", () => {
      resetPoofCache();
      const first = resolvePoofBinary();
      const second = resolvePoofBinary();
      expect(first).toBe(second);
    });
  });
});
