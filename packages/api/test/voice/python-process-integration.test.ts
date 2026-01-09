import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { ModelProcess, type ProcessConfig } from "@alfred/voice/process/base";
import {
  cleanupTestVenv,
  createFakeExecutable,
  createTestVenv,
  restoreEnvVars,
  saveEnvVars,
} from "@alfred/voice/test/utils/python-helpers";
import type { Subprocess } from "bun";

describe("Python Process Integration", () => {
  let mockSpawn: ReturnType<typeof mock.fn>;
  let tempVoiceDir: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    tempVoiceDir = mkdtempSync(join(os.tmpdir(), "alfred-process-test-"));
    savedEnv = saveEnvVars(["VOICE_USE_UV", "PYTHON_PATH"]);

    // Create mock subprocess
    const mockSubprocess = {
      exited: Promise.resolve(0),
      stdout: {
        on: mock.fn(),
      },
      stderr: {
        on: mock.fn(),
      },
      on: mock.fn(),
      kill: mock.fn(),
    } as unknown as Subprocess;

    mockSpawn = mock.fn(() => mockSubprocess);

    // Mock Bun.spawn
    mock.module("bun", () => ({
      spawn: mockSpawn,
    }));
  });

  afterEach(() => {
    restoreEnvVars(savedEnv);
    try {
      rmSync(tempVoiceDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should spawn process with UV run command", async () => {
    // Set up UV available
    const tempBin = join(tempVoiceDir, "bin");
    const _uvPath = createFakeExecutable(tempBin, "uv");
    process.env.PATH = [tempBin, process.env.PATH].filter(Boolean).join(":");

    process.env.VOICE_USE_UV = "true";
    process.env.PYTHON_PATH = undefined;

    const scriptsDir = join(tempVoiceDir, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = join(scriptsDir, "stt_server.py");
    writeFileSync(scriptPath, "# STT server\n");

    const config: ProcessConfig = {
      scriptPath,
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // Mock the waitForReady to avoid hanging
    const _originalWaitForReady =
      processInstance.waitForReady.bind(processInstance);
    processInstance.waitForReady = () => {
      // Simulate ready signal
      const mockResponse = {
        id: "init",
        type: "status",
        payload: { message: "STT server ready" },
      };
      processInstance.ipc.handleResponse(mockResponse as any);
      return Promise.resolve();
    };

    await processInstance.start();

    // Verify spawn was called with UV run command
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0][0];
    expect(callArgs.cmd[0]).toContain("uv");
    expect(callArgs.cmd[1]).toBe("run");
    expect(callArgs.cmd[2]).toBe("python");
    expect(callArgs.cwd).toBe(tempVoiceDir);
  });

  it("should spawn process with venv Python", async () => {
    process.env.VOICE_USE_UV = "false";
    process.env.PYTHON_PATH = undefined;

    const venvPython = createTestVenv(tempVoiceDir);

    const scriptsDir = join(tempVoiceDir, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = join(scriptsDir, "stt_server.py");
    writeFileSync(scriptPath, "# STT server\n");

    const config: ProcessConfig = {
      scriptPath,
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // Mock waitForReady
    processInstance.waitForReady = () => {
      const mockResponse = {
        id: "init",
        type: "status",
        payload: { message: "STT server ready" },
      };
      processInstance.ipc.handleResponse(mockResponse as any);
      return Promise.resolve();
    };

    await processInstance.start();

    // Verify spawn was called with venv Python
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0][0];
    expect(callArgs.cmd[0]).toBe(venvPython);
    expect(callArgs.cwd).toBe(process.cwd());
  });

  it("should spawn process with system Python", async () => {
    process.env.VOICE_USE_UV = "false";
    process.env.PYTHON_PATH = undefined;

    // Ensure no UV and no venv
    cleanupTestVenv(tempVoiceDir);
    const originalPath = process.env.PATH;
    process.env.PATH = "";

    const scriptsDir = join(tempVoiceDir, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = join(scriptsDir, "stt_server.py");
    writeFileSync(scriptPath, "# STT server\n");

    const config: ProcessConfig = {
      scriptPath,
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // Mock waitForReady
    processInstance.waitForReady = () => {
      const mockResponse = {
        id: "init",
        type: "status",
        payload: { message: "STT server ready" },
      };
      processInstance.ipc.handleResponse(mockResponse as any);
      return Promise.resolve();
    };

    await processInstance.start();

    // Verify spawn was called with system Python
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0][0];
    expect(callArgs.cmd[0]).toBe("python3");
    expect(callArgs.cwd).toBe(process.cwd());

    process.env.PATH = originalPath;
  });

  it("should propagate environment variables correctly", async () => {
    process.env.VOICE_USE_UV = "false";
    process.env.PYTHON_PATH = undefined;

    const _venvPython = createTestVenv(tempVoiceDir);

    const scriptsDir = join(tempVoiceDir, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = join(scriptsDir, "stt_server.py");
    writeFileSync(scriptPath, "# STT server\n");

    const config: ProcessConfig = {
      scriptPath,
      modelPath: "test-model",
      device: "cpu",
      computeType: "int8",
    };
    const processInstance = new ModelProcess(config);

    // Mock waitForReady
    processInstance.waitForReady = () => {
      const mockResponse = {
        id: "init",
        type: "status",
        payload: { message: "STT server ready" },
      };
      processInstance.ipc.handleResponse(mockResponse as any);
      return Promise.resolve();
    };

    await processInstance.start();

    // Verify environment variables are set
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0][0];
    expect(callArgs.env.WHISPER_MODEL_PATH).toBe("test-model");
    expect(callArgs.env.WHISPER_DEVICE).toBe("cpu");
    expect(callArgs.env.WHISPER_COMPUTE_TYPE).toBe("int8");
  });

  it("should set correct working directory", async () => {
    process.env.VOICE_USE_UV = "false";
    process.env.PYTHON_PATH = undefined;

    const _venvPython = createTestVenv(tempVoiceDir);

    const scriptsDir = join(tempVoiceDir, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = join(scriptsDir, "stt_server.py");
    writeFileSync(scriptPath, "# STT server\n");

    const config: ProcessConfig = {
      scriptPath,
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    // Mock waitForReady
    processInstance.waitForReady = () => {
      const mockResponse = {
        id: "init",
        type: "status",
        payload: { message: "STT server ready" },
      };
      processInstance.ipc.handleResponse(mockResponse as any);
      return Promise.resolve();
    };

    await processInstance.start();

    // Verify working directory
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0][0];
    expect(callArgs.cwd).toBe(process.cwd());
  });
});
