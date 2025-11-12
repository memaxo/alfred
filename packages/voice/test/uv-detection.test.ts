import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join, delimiter as pathDelimiter } from "node:path";
import os from "node:os";
import { ModelProcess, type ProcessConfig } from "../src/process/base";
import { __internals } from "../src/process/base";
import {
  createFakeExecutable,
  saveEnvVars,
  restoreEnvVars,
} from "./utils/python-helpers";

const { findUvPath } = __internals;

describe("UV Path Detection", () => {
  let tempBinDir: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    tempBinDir = mkdtempSync(join(os.tmpdir(), "alfred-uv-test-"));
    originalPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = originalPath ?? "";
    try {
      rmSync(tempBinDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should find UV in PATH on Unix", async () => {
    if (process.platform === "win32") {
      return; // Skip on Windows
    }

    const uvPath = createFakeExecutable(tempBinDir, "uv");
    process.env.PATH = [tempBinDir, originalPath ?? ""]
      .filter(Boolean)
      .join(pathDelimiter);

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

    const uvPath = createFakeExecutable(tempBinDir, "uv");
    process.env.PATH = [tempBinDir, originalPath ?? ""]
      .filter(Boolean)
      .join(pathDelimiter);

    const config: ProcessConfig = {
      scriptPath: "C:\\test\\script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = await findUvPath(processInstance)();

    expect(result).toBe(uvPath);
  });

  it("should return null when UV not in PATH", async () => {
    process.env.PATH = tempBinDir; // Only temp dir, no UV

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
    const uvPath = createFakeExecutable(tempBinDir, "uv");
    process.env.PATH = [tempBinDir, originalPath ?? ""]
      .filter(Boolean)
      .join(pathDelimiter);

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
    const bin1 = join(tempBinDir, "bin1");
    const bin2 = join(tempBinDir, "bin2");
    const uvPath1 = createFakeExecutable(bin1, "uv");
    createFakeExecutable(bin2, "uv");

    process.env.PATH = [bin1, bin2, originalPath ?? ""]
      .filter(Boolean)
      .join(pathDelimiter);

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

