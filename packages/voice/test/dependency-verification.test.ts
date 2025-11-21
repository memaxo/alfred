import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { Subprocess } from "bun";
import {
  __internals,
  ModelProcess,
  type ProcessConfig,
} from "../src/process/base";

const { verifyDependencies } = __internals;

describe("Dependency Verification", () => {
  let mockSpawn: ReturnType<typeof vi.fn>;
  let spawnSpy: ReturnType<typeof vi.spyOn>;

  const createMockStream = (text = "") =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        if (text) {
          controller.enqueue(new TextEncoder().encode(text));
        }
        controller.close();
      },
    });

  const createMockSubprocess = (options?: {
    exitCode?: number;
    stderr?: string;
    stdout?: string;
  }) =>
    ({
      exited: Promise.resolve(options?.exitCode ?? 0),
      stdout: createMockStream(options?.stdout),
      stderr: createMockStream(options?.stderr),
    }) as unknown as Subprocess;

  beforeEach(() => {
    const mockSubprocess = createMockSubprocess();
    mockSpawn = vi.fn(() => mockSubprocess);
    spawnSpy = vi
      .spyOn(Bun, "spawn")
      .mockImplementation((...args) => mockSpawn(...args));
  });

  afterEach(() => {
    spawnSpy.mockRestore();
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
    mockSpawn.mockReturnValue(createMockSubprocess());

    await verifyDependencies(processInstance)(cmd);

    // Should call spawn with Python import check
    expect(mockSpawn).toHaveBeenCalled();
    const [cmdArgs] = mockSpawn.mock.calls[0];
    expect(Array.isArray(cmdArgs)).toBe(true);
    const args = cmdArgs as string[];
    expect(args.includes("-c")).toBe(true);
    expect(args.at(-1)).toContain("import faster_whisper");
  });

  it("should verify dependencies for system Python", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["python3", "/test/script.py"];

    // Mock successful verification
    mockSpawn.mockReturnValue(createMockSubprocess());

    await verifyDependencies(processInstance)(cmd);

    // Should call spawn with Python import check
    expect(mockSpawn).toHaveBeenCalled();
    const [cmdArgs] = mockSpawn.mock.calls[0];
    expect(Array.isArray(cmdArgs)).toBe(true);
    const args = cmdArgs as string[];
    expect(args.includes("-c")).toBe(true);
    expect(args.at(-1)).toContain("import faster_whisper");
  });

  it("should throw helpful error when dependencies missing", async () => {
    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    const processInstance = new ModelProcess(config);

    const cmd = ["python3", "/test/script.py"];

    // Mock failed verification with ImportError
    mockSpawn.mockReturnValue(
      createMockSubprocess({
        exitCode: 1,
        stderr: "Missing dependency: No module named 'faster_whisper'\n",
      })
    );

    const promise = verifyDependencies(processInstance)(cmd);
    await expect(promise).rejects.toThrow("Python dependencies not installed");

    // Verify error message contains helpful instructions
    const error = (await promise.catch((err) => err)) as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(
      "Install with: cd packages/voice && ./scripts/install-deps.sh"
    );
    expect(error.message).toContain("Or use: cd packages/voice && uv sync");
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
