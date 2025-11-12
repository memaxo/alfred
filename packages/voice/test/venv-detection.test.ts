import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { ModelProcess, type ProcessConfig } from "../src/process/base";
import { __internals } from "../src/process/base";
import {
  createTestVenv,
  cleanupTestVenv,
} from "./utils/python-helpers";

const { findVenvPython } = __internals;

describe("Virtual Environment Detection", () => {
  let tempVoiceDir: string;

  beforeEach(() => {
    tempVoiceDir = mkdtempSync(join(os.tmpdir(), "alfred-venv-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempVoiceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should find venv Python on Unix", async () => {
    if (process.platform === "win32") {
      return; // Skip on Windows
    }

    const venvPython = createTestVenv(tempVoiceDir);

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(tempVoiceDir);

    expect(result).toBe(venvPython);
    expect(result).toContain("bin");
    expect(result).not.toContain(".exe");
  });

  it("should find venv Python on Windows", async () => {
    if (process.platform !== "win32") {
      return; // Skip on non-Windows
    }

    const venvPython = createTestVenv(tempVoiceDir);

    const config: ProcessConfig = {
      scriptPath: "C:\\test\\script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(tempVoiceDir);

    expect(result).toBe(venvPython);
    expect(result).toContain("Scripts");
    expect(result).toContain(".exe");
  });

  it("should return null when .venv does not exist", async () => {
    // Ensure .venv directory missing
    cleanupTestVenv(tempVoiceDir);

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(tempVoiceDir);

    expect(result).toBeNull();
  });

  it("should return null when Python executable missing in venv", async () => {
    // Create .venv directory but no Python executable
    const venvDir = join(tempVoiceDir, ".venv");
    mkdirSync(venvDir, { recursive: true });

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const result = findVenvPython(processInstance)(tempVoiceDir);

    expect(result).toBeNull();
  });

  it("should handle file system errors gracefully", async () => {
    // Create .venv with invalid Python path (directory instead of file)
    const venvBinDir = process.platform === "win32"
      ? join(tempVoiceDir, ".venv", "Scripts")
      : join(tempVoiceDir, ".venv", "bin");
    mkdirSync(venvBinDir, { recursive: true });

    const pythonPath = process.platform === "win32"
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
    const result = findVenvPython(processInstance)(tempVoiceDir);

    expect(result).toBeNull();
  });
});

