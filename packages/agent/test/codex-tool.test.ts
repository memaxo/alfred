import * as graphRepo from "@alfred/db/repo/graph";
import { logger } from "@alfred/metrics";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
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
  basename,
  dirname,
  isAbsolute,
  join,
  delimiter as pathDelimiter,
  resolve,
} from "node:path";

import type { CodexToolInput } from "../src/orchestrator/tool/codex/index";

import { __internals } from "../src/orchestrator/tool/codex/index";
import {
  DirectoryAccessError,
  openDirectorySecure,
  safeRealpath,
} from "../src/security/filesystem";

const {
  isWithinBase,
  pickEnvCodex,
  resolveExecutable,
  mapAutoToCodex,
  validateOutputSchema,
  buildTurnOptions,
} = __internals;

const getGraphClientSpy = vi
  .spyOn(graphRepo, "getGraphClient")
  .mockImplementation(() => ({}) as any);
const upsertNodesSpy = vi
  .spyOn(graphRepo, "upsertNodes")
  .mockResolvedValue(new Map());
const upsertEdgesSpy = vi.spyOn(graphRepo, "upsertEdges").mockResolvedValue();

function createTempDir(prefix: string) {
  return mkdtempSync(join(os.tmpdir(), prefix));
}

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

    it("rejects ../../../etc/passwd style traversal", () => {
      const base = createTempDir("alfred-codex-traverse-base-");
      const escapeDir = createTempDir("alfred-codex-traverse-escape-");
      const secret = join(escapeDir, "passwd");
      writeFileSync(secret, "root:x:0:0");

      const traversal = resolve(base, "..", basename(escapeDir), "passwd");
      expect(isWithinBase(base, traversal)).toBe(false);

      rmSync(base, { recursive: true, force: true });
      rmSync(escapeDir, { recursive: true, force: true });
    });

    it("rejects null-byte injection attempts", () => {
      const base = createTempDir("alfred-codex-null-byte-");
      const malicious = `${base}\0/etc/passwd`;
      expect(isWithinBase(base, malicious)).toBe(false);
      rmSync(base, { recursive: true, force: true });
    });

    it("rejects Unicode normalization traversal tricks", () => {
      const base = createTempDir("alfred-codex-unicode-base-");
      const parent = dirname(base);
      const outsideName = "alfred-codex-unicode-escape";
      const outside = join(parent, outsideName);
      mkdirSync(outside, { recursive: true });

      const fullWidthDots = "\uFF0E\uFF0E"; // becomes .. under NFKC
      const raw = `${base}/${fullWidthDots}/${outsideName}`;
      const normalized = raw.normalize("NFKC");
      expect(normalized.includes("..")).toBe(true);
      expect(isWithinBase(base, normalized)).toBe(false);

      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });

    it("rejects symlinks pointing at parent directories", () => {
      const base = createTempDir("alfred-codex-symlink-parent-");
      const link = join(base, "parent-link");
      symlinkSync(dirname(base), link);
      expect(isWithinBase(base, link)).toBe(false);
      rmSync(base, { recursive: true, force: true });
    });

    it("re-evaluates paths after TOCTOU symlink swaps", () => {
      const base = createTempDir("alfred-codex-symlink-toctou-");
      const sandboxDir = join(base, "workspace");
      mkdirSync(sandboxDir);
      expect(isWithinBase(base, sandboxDir)).toBe(true);

      const outside = createTempDir("alfred-codex-symlink-toctou-escape-");
      rmSync(sandboxDir, { recursive: true, force: true });
      symlinkSync(outside, sandboxDir);

      expect(isWithinBase(base, sandboxDir)).toBe(false);
      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });

    it("rejects nested symlink chains escaping the base", () => {
      const base = createTempDir("alfred-codex-symlink-chain-base-");
      const outside = createTempDir("alfred-codex-symlink-chain-out-");
      const linkB = join(base, "link-b");
      const linkA = join(base, "link-a");
      symlinkSync(outside, linkB);
      symlinkSync(linkB, linkA);
      expect(isWithinBase(base, linkA)).toBe(false);
      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });
  });

  describe("pickEnvCodex", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    const original = {
      PATH: process.env.PATH,
      CODEX_API_KEY: process.env.CODEX_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ORCH_CODEX_ALLOW_OPENAI_KEY: process.env.ORCH_CODEX_ALLOW_OPENAI_KEY,
    };

    beforeEach(() => {
      warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
      process.env.PATH = original.PATH ?? "";
      process.env.CODEX_API_KEY = "codex-key";
      process.env.OPENAI_API_KEY = "openai-key";
      process.env.ORCH_CODEX_ALLOW_OPENAI_KEY = "1";
    });

    afterEach(() => {
      warnSpy.mockRestore();
      process.env.PATH = original.PATH ?? "";
      if (original.CODEX_API_KEY === undefined) {
        process.env.CODEX_API_KEY = undefined;
      } else {
        process.env.CODEX_API_KEY = original.CODEX_API_KEY;
      }
      if (original.OPENAI_API_KEY === undefined) {
        process.env.OPENAI_API_KEY = undefined;
      } else {
        process.env.OPENAI_API_KEY = original.OPENAI_API_KEY;
      }
      if (original.ORCH_CODEX_ALLOW_OPENAI_KEY === undefined) {
        process.env.ORCH_CODEX_ALLOW_OPENAI_KEY = undefined;
      } else {
        process.env.ORCH_CODEX_ALLOW_OPENAI_KEY =
          original.ORCH_CODEX_ALLOW_OPENAI_KEY;
      }
    });

    it("retains PATH and forwards only allowlisted CODEX_* overrides (plus optional OPENAI)", () => {
      // Clear any warnings from module initialization
      warnSpy.mockClear();

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
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("omits OPENAI_API_KEY when the allow flag is disabled", () => {
      process.env.CODEX_API_KEY = "";
      process.env.ORCH_CODEX_ALLOW_OPENAI_KEY = "0";

      const result = pickEnvCodex({ OPENAI_API_KEY: "should-not-forward" });
      expect(result.OPENAI_API_KEY).toBeUndefined();
    });

    it("blocks non-allowlisted CODEX variables and logs a warning", () => {
      const result = pickEnvCodex({ CODEX_DEBUG_FLAG: "1" });

      expect(result.CODEX_DEBUG_FLAG).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "codex_env_blocked",
        expect.objectContaining({
          keys: ["CODEX_DEBUG_FLAG"],
          count: 1,
        })
      );
    });

    it("blocks dangerous CODEX_SANDBOX_* overrides", () => {
      const result = pickEnvCodex({ CODEX_SANDBOX_DISABLED: "1" });

      expect(result.CODEX_SANDBOX_DISABLED).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "codex_env_blocked",
        expect.objectContaining({
          keys: ["CODEX_SANDBOX_DISABLED"],
        })
      );
    });

    it("drops dangerous env injection attempts like LD_PRELOAD without warning", () => {
      const result = pickEnvCodex({
        LD_PRELOAD: "/tmp/libhack.so",
        CODEX_REGION: "us-east-1",
      });

      expect(result.CODEX_REGION).toBe("us-east-1");
      expect(result.LD_PRELOAD).toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
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

      process.env.PATH = [binDir, originalPath ?? ""]
        .filter(Boolean)
        .join(pathDelimiter);

      const resolved = resolveExecutable("codex");
      expect(resolved).toBe(executable);
      expect(isAbsolute(resolved)).toBe(true);
    });

    it("throws when the binary is missing", () => {
      process.env.PATH = tempDir;
      expect(() => resolveExecutable("missing-codex")).toThrowError(
        "codex_binary_not_found"
      );
    });
  });

  describe("mapAutoToCodex", () => {
    it("uses read-only sandbox for read autonomy", () => {
      expect(mapAutoToCodex("read")).toEqual({
        sandbox: "read-only",
        approval: "on-request",
      });
    });

    it("upgrades to workspace-write for non-read autonomy", () => {
      expect(mapAutoToCodex("low")).toEqual({
        sandbox: "workspace-write",
        approval: "on-request",
      });
      expect(mapAutoToCodex("medium")).toEqual({
        sandbox: "workspace-write",
        approval: "on-request",
      });
      expect(mapAutoToCodex("high")).toEqual({
        sandbox: "workspace-write",
        approval: "on-request",
      });
    });
  });

  describe("openDirectorySecure", () => {
    it("rejects symlinks when noFollowSymlinks is true", () => {
      const base = mkdtempSync(join(os.tmpdir(), "alfred-codex-secure-"));
      const outside = mkdtempSync(join(os.tmpdir(), "alfred-codex-outside-"));
      const linkPath = join(base, "link");
      symlinkSync(outside, linkPath);

      // Legacy behavior would have resolved the path successfully.
      expect(safeRealpath(linkPath)).toBeTruthy();

      expect(() =>
        openDirectorySecure(linkPath, {
          allowedPrefixes: [base],
          noFollowSymlinks: true,
        })
      ).toThrow(DirectoryAccessError);

      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });

    it("detects a symlink swap after an initial stat", () => {
      const base = mkdtempSync(join(os.tmpdir(), "alfred-codex-race-"));
      const workspace = join(base, "workspace");
      const target = join(workspace, "subdir");
      const outside = mkdtempSync(join(os.tmpdir(), "alfred-codex-escape-"));

      mkdirSync(workspace, { recursive: true });
      mkdirSync(target);

      const initialResolved = safeRealpath(target);
      expect(initialResolved).toBeTruthy();

      rmSync(target, { recursive: true, force: true });
      symlinkSync(outside, target);

      expect(() =>
        openDirectorySecure(target, {
          allowedPrefixes: [base],
          noFollowSymlinks: true,
        })
      ).toThrow(DirectoryAccessError);

      rmSync(base, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    });
  });

  describe("validateOutputSchema", () => {
    it("accepts a simple valid schema", () => {
      const schema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          summary: { type: "string" },
        },
        required: ["summary"],
        additionalProperties: false,
      } as const;

      expect(validateOutputSchema(schema)).toBe(true);
    });

    it("rejects invalid schema keywords", () => {
      const schema = {
        type: "object",
        properties: {
          count: { type: "not-a-real-type" },
        },
      } as const;

      expect(validateOutputSchema(schema)).toBe(false);
    });

    it("rejects schemas that exceed property limits", () => {
      const properties = Object.fromEntries(
        Array.from({ length: 105 }, (_, idx) => [
          `field${idx}`,
          { type: "string" },
        ])
      );
      const schema = {
        type: "object",
        properties,
        additionalProperties: false,
      } as const;

      expect(validateOutputSchema(schema)).toBe(false);
    });

    it("rejects external $ref URLs", () => {
      const schema = {
        $ref: "https://malicious.example/schema.json",
      } as const;

      expect(validateOutputSchema(schema)).toBe(false);
    });
  });

  describe("buildTurnOptions", () => {
    const baseInput: CodexToolInput = {
      action: "exec",
      prompt: "echo hi",
      out: "text",
      auto: "read",
    };

    it("forwards valid schemas to the SDK", () => {
      const schema = {
        type: "object",
        properties: {
          value: { type: "string" },
        },
      } as const;

      const options = buildTurnOptions(
        { ...baseInput, outputSchema: schema },
        new AbortController().signal
      );

      expect(options.outputSchema).toBe(schema);
    });

    it("throws when the schema is invalid", () => {
      const invalidSchema = {
        type: "object",
        properties: {
          data: { type: "bogus" },
        },
      } as const;

      expect(() =>
        buildTurnOptions(
          { ...baseInput, outputSchema: invalidSchema },
          new AbortController().signal
        )
      ).toThrowError("invalid_output_schema");
    });
  });
});

afterAll(() => {
  getGraphClientSpy.mockRestore();
  upsertNodesSpy.mockRestore();
  upsertEdgesSpy.mockRestore();
});
