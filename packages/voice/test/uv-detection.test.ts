import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";
import { join, delimiter as pathDelimiter } from "node:path";
import {
  __internals,
  ModelProcess,
  type ProcessConfig,
} from "../src/process/base";
import {
  createFakeExecutable,
  createIsolatedTestDir,
} from "./utils/python-helpers";

const { findUvPath } = __internals;

describe("UV Path Detection", () => {
  let testDir: ReturnType<typeof createIsolatedTestDir>;
  let originalPath: string | undefined;

  beforeEach(() => {
    // Use isolated test directory (safe - writes only to temp)
    testDir = createIsolatedTestDir("uv-detection-");
    originalPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = originalPath ?? "";
    testDir.cleanup();
  });

  it("should find UV in PATH on Unix", async () => {
    if (process.platform === "win32") {
      return; // Skip on Windows
    }

    const uvPath = createFakeExecutable(testDir.rootDir, "uv");
    process.env.PATH = testDir.rootDir;

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = await findUvPath(processInstance)();

    expect(result).toBe(uvPath);
  });

  it("should find UV in PATH on Windows", async () => {
    if (process.platform !== "win32") {
      return; // Skip on non-Windows
    }

    const uvPath = createFakeExecutable(testDir.rootDir, "uv");
    process.env.PATH = testDir.rootDir;

    const config: ProcessConfig = {
      scriptPath: "C:\\test\\script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = await findUvPath(processInstance)();

    expect(result).toBe(uvPath);
  });

  it("should return null when UV not in PATH", async () => {
    process.env.PATH = testDir.rootDir; // Only temp dir, no UV

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = await findUvPath(processInstance)();

    expect(result).toBeNull();
  });

  it("should handle which/where command failures", async () => {
    // Set invalid PATH to cause command failure
    process.env.PATH = "/nonexistent/path";

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = await findUvPath(processInstance)();

    expect(result).toBeNull();
  });

  it("should verify UV path exists", async () => {
    const uvPath = createFakeExecutable(testDir.rootDir, "uv");
    process.env.PATH = testDir.rootDir;

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // First check should succeed
    const result1 = await findUvPath(processInstance)();
    expect(result1).toBe(uvPath);

    // Delete the executable
    rmSync(uvPath, { force: true });

    // Second check should return null
    const result2 = await findUvPath(processInstance)();
    expect(result2).toBeNull();
  });

  it("should take first result when multiple UV paths found", async () => {
    const bin1 = join(testDir.rootDir, "bin1");
    const bin2 = join(testDir.rootDir, "bin2");
    const uvPath1 = createFakeExecutable(bin1, "uv");
    createFakeExecutable(bin2, "uv");

    process.env.PATH = [bin1, bin2].join(pathDelimiter);

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = await findUvPath(processInstance)();

    // Should return first valid path
    expect(result).toBe(uvPath1);
  });
});
