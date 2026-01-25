import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import {
  isAbsolute,
  join,
  delimiter as pathDelimiter,
  resolve,
} from "node:path";

import { __internals } from "../src/orchestrator/tool/droid";

const { isWithinBase, pickEnv, resolveExecutable } = __internals;

describe("droid tool sandbox helpers", () => {
  describe("isWithinBase", () => {
    it("treats nested directories as within base", () => {
      const base = resolve(os.tmpdir(), "alfred-base-nested");
      const nested = resolve(base, "packages/service");
      mkdirSync(nested, { recursive: true });
      expect(isWithinBase(base, nested)).toBe(true);
      rmSync(base, { recursive: true, force: true });
    });

    it("rejects sibling paths that merely share a prefix", () => {
      const base = resolve(os.tmpdir(), "alfred-base-prefix");
      const sibling = `${base}-evil`;
      mkdirSync(base, { recursive: true });
      mkdirSync(sibling, { recursive: true });
      expect(isWithinBase(base, sibling)).toBe(false);
      rmSync(base, { recursive: true, force: true });
      rmSync(sibling, { recursive: true, force: true });
    });

    it("rejects symlink escapes", () => {
      const base = mkdtempSync(join(os.tmpdir(), "alfred-base-symlink-"));
      const outside = mkdtempSync(join(os.tmpdir(), "alfred-outside-"));
      const linkPath = join(base, "link");
      symlinkSync(outside, linkPath);
      expect(isWithinBase(base, linkPath)).toBe(false);
      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });
  });

  describe("pickEnv", () => {
    it("keeps PATH fixed and only accepts DROID_* overrides", () => {
      const result = pickEnv({
        DROID_FOO: "bar",
        PATH: "/tmp/malicious",
        NODE_OPTIONS: "--inspect",
        RANDOM: "value",
      });

      expect(result.PATH).not.toBe("/tmp/malicious");
      expect(result.DROID_FOO).toBe("bar");
      expect(result.NODE_OPTIONS).toBeUndefined();
      expect(result.RANDOM).toBeUndefined();
    });

    it("returns base env when no overrides provided", () => {
      const result = pickEnv();
      expect(result.PATH).toBeDefined();
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(["PATH", "FACTORY_API_KEY"])
      );
    });
  });

  describe("resolveExecutable", () => {
    let tempDir: string;
    let originalPath: string | undefined;

    beforeEach(() => {
      tempDir = mkdtempSync(join(os.tmpdir(), "alfred-droid-tool-"));
      originalPath = process.env.PATH;
    });

    afterEach(() => {
      process.env.PATH = originalPath;
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("resolves binaries via PATH entries", () => {
      const binDir = join(tempDir, "bin");
      mkdirSync(binDir);
      const executable = join(binDir, "droid");
      writeFileSync(executable, "#!/usr/bin/env bash\necho ok\n");
      chmodSync(executable, 0o755);

      process.env.PATH = [binDir, originalPath ?? ""]
        .filter(Boolean)
        .join(pathDelimiter);

      const resolved = resolveExecutable("droid");
      expect(resolved).toBe(executable);
      expect(isAbsolute(resolved)).toBe(true);
    });

    it("throws for missing binaries", () => {
      process.env.PATH = tempDir;
      expect(() => resolveExecutable("missing-droid")).toThrowError(
        "droid_binary_not_found"
      );
    });
  });
});
