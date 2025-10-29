import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join, delimiter as pathDelimiter, resolve, isAbsolute } from "node:path";
import os from "node:os";
import { __internals } from "../src/orchestrator/tool/codex";

const { isWithinBase, pickEnvCodex, resolveExecutable, mapAutoToCodex } = __internals;

describe("codex tool sandbox helpers", () => {
  describe("isWithinBase", () => {
    it("accepts directories nested under the base", () => {
      const base = resolve(os.tmpdir(), "alfred-codex-base");
      const nested = resolve(base, "packages/service");
      mkdirSync(nested, { recursive: true });
      expect(isWithinBase(base, nested)).toBe(true);
      rmSync(base, { recursive: true, force: true });
    });

    it("rejects sibling directories even if they share the prefix", () => {
      const base = resolve(os.tmpdir(), "alfred-codex-prefix");
      const sibling = `${base}-other`;
      mkdirSync(base, { recursive: true });
      mkdirSync(sibling, { recursive: true });
      expect(isWithinBase(base, sibling)).toBe(false);
      rmSync(base, { recursive: true, force: true });
      rmSync(sibling, { recursive: true, force: true });
    });

    it("rejects symlink escapes", () => {
      const base = mkdtempSync(join(os.tmpdir(), "alfred-codex-symlink-"));
      const outside = mkdtempSync(join(os.tmpdir(), "alfred-codex-outside-"));
      const linkPath = join(base, "link");
      symlinkSync(outside, linkPath);
      expect(isWithinBase(base, linkPath)).toBe(false);
      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });
  });

  describe("pickEnvCodex", () => {
    const original = {
      PATH: process.env.PATH,
      CODEX_API_KEY: process.env.CODEX_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ORCH_CODEX_ALLOW_OPENAI_KEY: process.env.ORCH_CODEX_ALLOW_OPENAI_KEY,
    };

    beforeEach(() => {
      process.env.PATH = original.PATH ?? "";
      process.env.CODEX_API_KEY = "codex-key";
      process.env.OPENAI_API_KEY = "openai-key";
      process.env.ORCH_CODEX_ALLOW_OPENAI_KEY = "1";
    });

    afterEach(() => {
      process.env.PATH = original.PATH ?? "";
      if (original.CODEX_API_KEY === undefined) delete process.env.CODEX_API_KEY;
      else process.env.CODEX_API_KEY = original.CODEX_API_KEY;
      if (original.OPENAI_API_KEY === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = original.OPENAI_API_KEY;
      if (original.ORCH_CODEX_ALLOW_OPENAI_KEY === undefined)
        delete process.env.ORCH_CODEX_ALLOW_OPENAI_KEY;
      else process.env.ORCH_CODEX_ALLOW_OPENAI_KEY = original.ORCH_CODEX_ALLOW_OPENAI_KEY;
    });

    it("retains PATH and forwards only CODEX_* overrides (plus optional OPENAI)", () => {
      const result = pickEnvCodex({
        CODEX_REGION: "us-east-1",
        PATH: "/tmp/malicious",
        RANDOM: "value",
        OPENAI_API_KEY: "secondary-openai",
      });

      expect(result.PATH).toBe(original.PATH ?? "");
      expect(result.CODEX_API_KEY).toBe("codex-key");
      expect(result.CODEX_REGION).toBe("us-east-1");
      expect(result.OPENAI_API_KEY).toBe("secondary-openai");
      expect(result.RANDOM).toBeUndefined();
    });

    it("omits OPENAI_API_KEY when the allow flag is disabled", () => {
      process.env.CODEX_API_KEY = "";
      process.env.ORCH_CODEX_ALLOW_OPENAI_KEY = "0";

      const result = pickEnvCodex({ OPENAI_API_KEY: "should-not-forward" });
      expect(result.OPENAI_API_KEY).toBeUndefined();
    });
  });

  describe("resolveExecutable", () => {
    let tempDir: string;
    let originalPath: string | undefined;

    beforeEach(() => {
      tempDir = mkdtempSync(join(os.tmpdir(), "alfred-codex-bin-"));
      originalPath = process.env.PATH;
    });

    afterEach(() => {
      process.env.PATH = originalPath ?? "";
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("finds binaries on the PATH", () => {
      const binDir = join(tempDir, "bin");
      mkdirSync(binDir);
      const executable = join(binDir, "codex");
      writeFileSync(executable, "#!/usr/bin/env bash\necho ok\n");
      chmodSync(executable, 0o755);

      process.env.PATH = [binDir, originalPath ?? ""].filter(Boolean).join(pathDelimiter);

      const resolved = resolveExecutable("codex");
      expect(resolved).toBe(executable);
      expect(isAbsolute(resolved)).toBe(true);
    });

    it("throws when the binary is missing", () => {
      process.env.PATH = tempDir;
      expect(() => resolveExecutable("missing-codex")).toThrowError("codex_binary_not_found");
    });
  });

  describe("mapAutoToCodex", () => {
    it("uses read-only sandbox for read autonomy", () => {
      expect(mapAutoToCodex("read")).toEqual({ sandbox: "read-only", approval: "on-request" });
    });

    it("upgrades to workspace-write for non-read autonomy", () => {
      expect(mapAutoToCodex("low")).toEqual({ sandbox: "workspace-write", approval: "on-request" });
      expect(mapAutoToCodex("medium")).toEqual({ sandbox: "workspace-write", approval: "on-request" });
      expect(mapAutoToCodex("high")).toEqual({ sandbox: "workspace-write", approval: "on-request" });
    });
  });
});
