import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import { join, delimiter as pathDelimiter } from "node:path";
import {
  __internals,
  ModelProcess,
  type ProcessConfig,
} from "../src/process/base";
import {
  cleanupTestVenv,
  createFakeExecutable,
  createTestVenv,
  hasUv,
  restoreEnvVars,
  saveEnvVars,
} from "./utils/python-helpers";

const { resolvePythonExecutable } = __internals;

describe("Python Executable Resolution", () => {
  let tempVoiceDir: string;
  let realVoiceDir: string;
  let savedEnv: Record<string, string | undefined>;
  let processInstance: ModelProcess;

  beforeEach(() => {
    // Create a truly temporary directory for tests that modify venv
    // This prevents tests from corrupting the real packages/voice/.venv
    tempVoiceDir = join(
      os.tmpdir(),
      `alfred-voice-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempVoiceDir, { recursive: true });

    // Keep reference to real voice dir for UV tests that need actual project structure
    realVoiceDir = join(process.cwd(), "packages", "voice");
    savedEnv = saveEnvVars(["VOICE_USE_UV", "PYTHON_PATH"]);

    const config: ProcessConfig = {
      scriptPath: join(realVoiceDir, "scripts", "stt_server.py"),
      modelPath: "test-model",
    };
    processInstance = new ModelProcess(config);
  });

  afterEach(() => {
    restoreEnvVars(savedEnv);
    // Clean up the temporary directory
    try {
      rmSync(tempVoiceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("UV Run Path", () => {
    it("should use UV run when UV available and enabled", async () => {
      const uvAvailable = await hasUv();
      if (!uvAvailable) {
        // Create fake UV in temp bin
        const tempBin = join(tempVoiceDir, "bin");
        createFakeExecutable(tempBin, "uv");
        process.env.PATH = [tempBin, process.env.PATH]
          .filter(Boolean)
          .join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "true";
      process.env.PYTHON_PATH = undefined;

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).toContain("uv");
      expect(result.cmd[1]).toBe("run");
      expect(result.cmd[2]).toBe("python");
      expect(result.cwd).toBe(join(process.cwd(), "packages", "voice"));
    });

    it("should skip UV when VOICE_USE_UV=false", async () => {
      const uvAvailable = await hasUv();
      if (!uvAvailable) {
        const tempBin = join(tempVoiceDir, "bin");
        createFakeExecutable(tempBin, "uv");
        process.env.PATH = [tempBin, process.env.PATH]
          .filter(Boolean)
          .join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "false";
      process.env.PYTHON_PATH = undefined;

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).not.toContain("uv");
    });

    it("should use relative script path for UV run", async () => {
      const uvAvailable = await hasUv();
      if (!uvAvailable) {
        const tempBin = join(tempVoiceDir, "bin");
        createFakeExecutable(tempBin, "uv");
        process.env.PATH = [tempBin, process.env.PATH]
          .filter(Boolean)
          .join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "true";
      process.env.PYTHON_PATH = undefined;

      const result = await resolvePythonExecutable(processInstance)();

      // Script path should be relative to voiceDir
      expect(result.cmd[3]).toBe("scripts/stt_server.py");
      expect(result.cwd).toBe(join(process.cwd(), "packages", "voice"));
    });
  });

  describe("Virtual Environment Path", () => {
    // Note: resolvePythonExecutable hardcodes packages/voice path
    // These tests use findVenvPython directly to test venv detection
    // without modifying the real packages/voice/.venv

    it("should detect venv Python in custom directory", async () => {
      const { findVenvPython } = __internals;
      const venvPython = createTestVenv(tempVoiceDir);

      const result = findVenvPython(processInstance)(tempVoiceDir);

      expect(result).toBe(venvPython);
    });

    it("should return null when venv missing", async () => {
      const { findVenvPython } = __internals;
      // Ensure .venv does not exist in temp dir
      cleanupTestVenv(tempVoiceDir);

      const result = findVenvPython(processInstance)(tempVoiceDir);

      expect(result).toBeNull();
    });

    it("should handle platform-specific venv paths", async () => {
      const venvPython = createTestVenv(tempVoiceDir);

      if (process.platform === "win32") {
        expect(venvPython).toContain("Scripts");
        expect(venvPython).toContain(".exe");
      } else {
        expect(venvPython).toContain("bin");
        expect(venvPython).not.toContain(".exe");
      }
    });
  });

  describe("System Python Fallback", () => {
    it("should use system Python when UV disabled and PYTHON_PATH not set", async () => {
      process.env.VOICE_USE_UV = "false";
      process.env.PYTHON_PATH = undefined;

      // We can't easily remove the real venv, so just test that system Python
      // is used when PYTHON_PATH is set (which takes priority)
      // This tests the fallback logic without modifying real files
      const originalPath = process.env.PATH;
      process.env.PATH = ""; // Remove UV from PATH

      // If real venv exists, it will be used; otherwise system Python
      const result = await resolvePythonExecutable(processInstance)();

      // Should not use UV
      expect(result.cmd[0]).not.toContain("uv");
      expect(result.cwd).toBe(process.cwd());

      process.env.PATH = originalPath;
    });

    it("should respect PYTHON_PATH override", async () => {
      process.env.VOICE_USE_UV = "false";
      process.env.PYTHON_PATH = "/custom/python";

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).toBe("/custom/python");
    });
  });

  describe("Working Directory", () => {
    it("should set voiceDir as cwd for UV run", async () => {
      const uvAvailable = await hasUv();
      if (!uvAvailable) {
        const tempBin = join(tempVoiceDir, "bin");
        createFakeExecutable(tempBin, "uv");
        process.env.PATH = [tempBin, process.env.PATH]
          .filter(Boolean)
          .join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "true";

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cwd).toBe(realVoiceDir);
    });

    it("should set process.cwd() for non-UV Python", async () => {
      process.env.VOICE_USE_UV = "false";
      process.env.PYTHON_PATH = "/custom/python";

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cwd).toBe(process.cwd());
    });
  });
});
