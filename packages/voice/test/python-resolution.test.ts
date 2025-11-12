import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { join, delimiter as pathDelimiter } from "node:path";
import os from "node:os";
import { ModelProcess, type ProcessConfig } from "../src/process/base";
import { __internals } from "../src/process/base";
import {
  createTempDir,
  createFakeExecutable,
  saveEnvVars,
  restoreEnvVars,
  hasUv,
  createTestVenv,
  cleanupTestVenv,
} from "./utils/python-helpers";

const { resolvePythonExecutable } = __internals;

describe("Python Executable Resolution", () => {
  let tempVoiceDir: string;
  let originalCwd: string;
  let savedEnv: Record<string, string | undefined>;
  let processInstance: ModelProcess;

  beforeEach(() => {
    // Note: resolvePythonExecutable uses process.cwd() to find packages/voice
    // So we need to work with the actual project structure or mock it differently
    tempVoiceDir = join(process.cwd(), "packages", "voice");
    originalCwd = process.cwd();
    savedEnv = saveEnvVars(["VOICE_USE_UV", "PYTHON_PATH"]);

    const config: ProcessConfig = {
      scriptPath: join(tempVoiceDir, "scripts", "stt_server.py"),
      modelPath: "test-model",
    };
    processInstance = new ModelProcess(config);
  });

  afterEach(() => {
    restoreEnvVars(savedEnv);
    // Don't delete tempVoiceDir as it's the actual packages/voice directory
    // Cleanup is handled by individual tests if needed
  });

  describe("UV Run Path", () => {
    it("should use UV run when UV available and enabled", async () => {
      const uvAvailable = await hasUv();
      if (!uvAvailable) {
        // Create fake UV in temp bin
        const tempBin = join(tempVoiceDir, "bin");
        createFakeExecutable(tempBin, "uv");
        process.env.PATH = [tempBin, process.env.PATH].filter(Boolean).join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "true";
      delete process.env.PYTHON_PATH;

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
        process.env.PATH = [tempBin, process.env.PATH].filter(Boolean).join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "false";
      delete process.env.PYTHON_PATH;

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).not.toContain("uv");
    });

    it("should use relative script path for UV run", async () => {
      const uvAvailable = await hasUv();
      if (!uvAvailable) {
        const tempBin = join(tempVoiceDir, "bin");
        createFakeExecutable(tempBin, "uv");
        process.env.PATH = [tempBin, process.env.PATH].filter(Boolean).join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "true";
      delete process.env.PYTHON_PATH;

      const result = await resolvePythonExecutable(processInstance)();

      // Script path should be relative to voiceDir
      expect(result.cmd[3]).toBe("scripts/stt_server.py");
      expect(result.cwd).toBe(join(process.cwd(), "packages", "voice"));
    });
  });

  describe("Virtual Environment Path", () => {
    it("should use venv Python when .venv exists", async () => {
      process.env.VOICE_USE_UV = "false";
      delete process.env.PYTHON_PATH;

      const venvPython = createTestVenv(tempVoiceDir);

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).toBe(venvPython);
      expect(result.cmd[1]).toBe(join(tempVoiceDir, "scripts", "stt_server.py"));
      expect(result.cwd).toBe(originalCwd);
    });

    it("should skip venv when VOICE_USE_UV=false and venv missing", async () => {
      process.env.VOICE_USE_UV = "false";
      delete process.env.PYTHON_PATH;

      // Ensure .venv does not exist
      cleanupTestVenv(tempVoiceDir);

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).toBe("python3");
    });

    it("should handle platform-specific venv paths", async () => {
      process.env.VOICE_USE_UV = "false";
      delete process.env.PYTHON_PATH;

      const venvPython = createTestVenv(tempVoiceDir);

      const result = await resolvePythonExecutable(processInstance)();

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
    it("should use system Python when UV and venv unavailable", async () => {
      process.env.VOICE_USE_UV = "false";
      delete process.env.PYTHON_PATH;

      // Ensure UV not available and venv missing
      cleanupTestVenv(tempVoiceDir);
      const originalPath = process.env.PATH;
      process.env.PATH = ""; // Remove UV from PATH

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cmd[0]).toBe("python3");
      expect(result.cwd).toBe(originalCwd);

      process.env.PATH = originalPath;
    });

    it("should respect PYTHON_PATH override", async () => {
      process.env.VOICE_USE_UV = "false";
      process.env.PYTHON_PATH = "/custom/python";

      cleanupTestVenv(tempVoiceDir);

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
        process.env.PATH = [tempBin, process.env.PATH].filter(Boolean).join(pathDelimiter);
      }

      process.env.VOICE_USE_UV = "true";

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cwd).toBe(tempVoiceDir);
    });

    it("should set process.cwd() for venv/system Python", async () => {
      process.env.VOICE_USE_UV = "false";
      delete process.env.PYTHON_PATH;

      const venvPython = createTestVenv(tempVoiceDir);

      const result = await resolvePythonExecutable(processInstance)();

      expect(result.cwd).toBe(originalCwd);
    });
  });
});

