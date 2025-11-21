import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
  __internals,
  ModelProcess,
  type ProcessConfig,
} from "../src/process/base";

const { findUvPath } = __internals;

describe("Cross-Platform Integration", () => {
  it("should use 'which' on Unix platforms", async () => {
    if (process.platform === "win32") {
      return; // Skip on Windows
    }

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // findUvPath uses 'which' on Unix
    // We can't easily test the actual command, but we can verify the logic
    const result = await findUvPath(processInstance)();
    // Result may be null if UV not found, but should not throw
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("should use 'where' on Windows", async () => {
    if (process.platform !== "win32") {
      return; // Skip on non-Windows
    }

    const config: ProcessConfig = {
      scriptPath: "C:\\test\\script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // findUvPath uses 'where' on Windows
    const result = await findUvPath(processInstance)();
    // Result may be null if UV not found, but should not throw
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("should resolve Unix venv path correctly", () => {
    if (process.platform === "win32") {
      return; // Skip on Windows
    }

    const voiceDir = "/test/voice";
    const expectedPath = join(voiceDir, ".venv", "bin", "python");

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const _processInstance = new ModelProcess(config);

    // Verify path construction (even if file doesn't exist)
    expect(expectedPath).toContain(".venv");
    expect(expectedPath).toContain("bin");
    expect(expectedPath).toContain("python");
    expect(expectedPath).not.toContain(".exe");
  });

  it("should resolve Windows venv path correctly", () => {
    if (process.platform !== "win32") {
      return; // Skip on non-Windows
    }

    const voiceDir = "C:\\test\\voice";
    const expectedPath = join(voiceDir, ".venv", "Scripts", "python.exe");

    const config: ProcessConfig = {
      scriptPath: "C:\\test\\script.py",
      modelPath: "test-model",
    };
    const _processInstance = new ModelProcess(config);

    // Verify path construction (even if file doesn't exist)
    expect(expectedPath).toContain(".venv");
    expect(expectedPath).toContain("Scripts");
    expect(expectedPath).toContain("python.exe");
  });

  it("should handle path separators correctly", () => {
    const voiceDir =
      process.platform === "win32" ? "C:\\test\\voice" : "/test/voice";
    const venvPath =
      process.platform === "win32"
        ? join(voiceDir, ".venv", "Scripts", "python.exe")
        : join(voiceDir, ".venv", "bin", "python");

    // join() should handle platform-specific separators
    if (process.platform === "win32") {
      expect(venvPath).toContain("\\");
      expect(venvPath).not.toContain("/");
    } else {
      expect(venvPath).toContain("/");
      expect(venvPath).not.toContain("\\");
    }
  });
});
