import { describe, expect, it, beforeEach, mock } from "bun:test";
import { ModelProcess, type ProcessConfig } from "../src/process/base";
import { __internals } from "../src/process/base";
import type { Subprocess } from "bun";

const { verifyDependencies } = __internals;

describe("Dependency Verification", () => {
  let mockSpawn: ReturnType<typeof mock.fn>;
  let originalSpawn: typeof import("bun").spawn;

  beforeEach(() => {
    // Save original spawn
    originalSpawn = require("bun").spawn;

    // Create mock subprocess
    const mockSubprocess = {
      exited: Promise.resolve(0),
      stdout: new ReadableStream(),
      stderr: new ReadableStream(),
    } as unknown as Subprocess;

    mockSpawn = mock.fn(() => mockSubprocess);

    // Mock Bun.spawn
    mock.module("bun", () => ({
      spawn: mockSpawn,
    }));
  });

  it("should skip verification for UV run commands", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["/path/to/uv", "run", "python", "script.py"];
    await verifyDependencies(processInstance)(cmd);

    // Should not call spawn for UV run
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("should verify dependencies for venv Python", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["/path/to/venv/bin/python", "/test/script.py"];

    // Mock successful verification
    const mockSubprocess = {
      exited: Promise.resolve(0),
      stdout: new ReadableStream(),
      stderr: new ReadableStream(),
    } as unknown as Subprocess;
    mockSpawn.mockReturnValue(mockSubprocess);

    await verifyDependencies(processInstance)(cmd);

    // Should call spawn with Python import check
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0];
    expect(callArgs[0]).toContain("-c");
    expect(callArgs[0]).toContain("import faster_whisper");
  });

  it("should verify dependencies for system Python", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["python3", "/test/script.py"];

    // Mock successful verification
    const mockSubprocess = {
      exited: Promise.resolve(0),
      stdout: new ReadableStream(),
      stderr: new ReadableStream(),
    } as unknown as Subprocess;
    mockSpawn.mockReturnValue(mockSubprocess);

    await verifyDependencies(processInstance)(cmd);

    // Should call spawn with Python import check
    expect(mockSpawn).toHaveBeenCalled();
    const callArgs = mockSpawn.mock.calls[0];
    expect(callArgs[0]).toContain("-c");
    expect(callArgs[0]).toContain("import faster_whisper");
  });

  it("should throw helpful error when dependencies missing", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["python3", "/test/script.py"];

    // Mock failed verification with ImportError
    const mockStderr = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Missing dependency: No module named 'faster_whisper'\n"));
        controller.close();
      },
    });

    const mockSubprocess = {
      exited: Promise.resolve(1),
      stdout: new ReadableStream(),
      stderr: mockStderr,
    } as unknown as Subprocess;
    mockSpawn.mockReturnValue(mockSubprocess);

    await expect(verifyDependencies(processInstance)(cmd)).rejects.toThrow(
      "Python dependencies not installed"
    );

    // Verify error message contains helpful instructions
    try {
      await verifyDependencies(processInstance)(cmd);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      if (error instanceof Error) {
        expect(error.message).toContain("Install with: cd packages/voice && ./scripts/install-deps.sh");
        expect(error.message).toContain("Or use: cd packages/voice && uv sync");
      }
    }
  });

  it("should handle verification command failures gracefully", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["python3", "/test/script.py"];

    // Mock spawn throwing error (not ImportError)
    mockSpawn.mockImplementation(() => {
      throw new Error("Command not found");
    });

    // Should not throw, just log warning
    await verifyDependencies(processInstance)(cmd);

    expect(mockSpawn).toHaveBeenCalled();
  });
});

