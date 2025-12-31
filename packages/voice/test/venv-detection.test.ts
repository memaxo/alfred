import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  __internals,
  ModelProcess,
  type ProcessConfig,
} from "../src/process/base";
import {
  cleanupTestVenv,
  createIsolatedTestDir,
  createTestVenv,
} from "./utils/python-helpers";

const { findVenvPython } = __internals;

describe("Virtual Environment Detection", () => {
  let testDir: ReturnType<typeof createIsolatedTestDir>;

  beforeEach(() => {
    // Use isolated test directory (safe - writes only to temp)
    testDir = createIsolatedTestDir("venv-detection-");
  });

  afterEach(() => {
    testDir.cleanup();
  });

  it("should find venv Python on Unix", () => {
    if (process.platform === "win32") {
      return; // Skip on Windows
    }

    const venvPython = createTestVenv(testDir.voiceDir);

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(testDir.voiceDir);

    expect(result).toBe(venvPython);
    expect(result).toContain("bin");
    expect(result).not.toContain(".exe");
  });

  it("should find venv Python on Windows", () => {
    if (process.platform !== "win32") {
      return; // Skip on non-Windows
    }

    const venvPython = createTestVenv(testDir.voiceDir);

    const config: ProcessConfig = {
      scriptPath: "C:\\test\\script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(testDir.voiceDir);

    expect(result).toBe(venvPython);
    expect(result).toContain("Scripts");
    expect(result).toContain(".exe");
  });

  it("should return null when .venv does not exist", () => {
    // Ensure .venv directory missing
    cleanupTestVenv(testDir.voiceDir);

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(testDir.voiceDir);

    expect(result).toBeNull();
  });

  it("should return null when Python executable missing in venv", () => {
    // Create .venv directory but no Python executable
    const venvDir = join(testDir.voiceDir, ".venv");
    mkdirSync(venvDir, { recursive: true });

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(testDir.voiceDir);

    expect(result).toBeNull();
  });

  it("should handle file system errors gracefully", () => {
    // Create .venv with invalid Python path (directory instead of file)
    const venvBinDir =
      process.platform === "win32"
        ? join(testDir.voiceDir, ".venv", "Scripts")
        : join(testDir.voiceDir, ".venv", "bin");
    mkdirSync(venvBinDir, { recursive: true });

    const pythonPath =
      process.platform === "win32"
        ? join(venvBinDir, "python.exe")
        : join(venvBinDir, "python");

    // Create directory instead of file
    mkdirSync(pythonPath, { recursive: true });

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // Should return null (accessSync will fail for directory)
    const result = findVenvPython(processInstance)(testDir.voiceDir);

    expect(result).toBeNull();
  });
});
