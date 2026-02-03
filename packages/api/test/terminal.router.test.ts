import { TRPCError } from "@trpc/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { nodePtySpawnMock } from "./utils/mock-node-pty";
import { toObservable } from "./utils/stream";
import { createTestCaller } from "./utils/trpc";

describe("terminal router", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  const originalPlatform = process.platform;
  const bun = Bun as unknown as {
    spawn: (...args: unknown[]) => Bun.Subprocess;
  };

  interface TerminalSpawnOptions {
    terminal?: {
      cols?: number;
      rows?: number;
      data?: (term: unknown, data: string | Uint8Array) => void;
    };
  }

  const pendingExit = () => new Promise<number>(() => {});

  beforeEach(async () => {
    caller = await createTestCaller();
    nodePtySpawnMock.mockClear();
    // Reset platform for each test
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
    // Clear sessions between tests
    const _terminalModule = await import("../src/routers/terminal");
    // Access the sessions map via a test helper or clear it
    // Since sessions is not exported, we'll rely on each test creating unique sessionIds
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSession", () => {
    it("prefers Bun.Terminal on POSIX hosts", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const subscribers = new Set<(chunk: string) => void>();
      let _dataCallback:
        | ((term: unknown, data: string | Uint8Array) => void)
        | null = null;

      const mockProc = {
        terminal: {
          write: vi.fn(),
          resize: vi.fn(),
          close: vi.fn(),
        },
        exited: pendingExit(),
        kill: vi.fn(),
      };

      const spawnImpl: unknown = (...args: unknown[]) => {
        const options = (args.length > 1 ? args[1] : args[0]) as
          | TerminalSpawnOptions
          | undefined;
        if (options?.terminal?.data) {
          _dataCallback = options.terminal.data;
          subscribers.add(() => {});
        }
        return mockProc as unknown as Bun.Subprocess;
      };
      vi.spyOn(bun, "spawn").mockImplementation(spawnImpl as typeof bun.spawn);

      const result = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      expect(result.sessionId).toBeDefined();
      expect(bun.spawn).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(String)]),
        expect.objectContaining({
          terminal: expect.objectContaining({
            cols: 80,
            rows: 24,
            data: expect.any(Function),
          }),
        })
      );
    });

    it("falls back to node-pty when Bun PTY fails on POSIX", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const spawnSpy = vi.fn().mockImplementation(() => {
        throw new Error("PTY not available");
      });
      const throwImpl: unknown = (..._args: unknown[]) => spawnSpy();
      vi.spyOn(bun, "spawn").mockImplementation(throwImpl as typeof bun.spawn);

      const result = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      expect(result.sessionId).toBeDefined();
      // Should have attempted Bun.spawn first
      expect(bun.spawn).toHaveBeenCalled();
      expect(nodePtySpawnMock).toHaveBeenCalled();
    });

    it("uses node-pty on Windows", async () => {
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      const spawnSpy = vi.spyOn(bun, "spawn").mockImplementation(() => {
        throw new Error("Should not be called on Windows");
      });

      const result = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      expect(result.sessionId).toBeDefined();
      // Bun.spawn should not be called on Windows (falls back to node-pty)
      expect(spawnSpy).not.toHaveBeenCalled();
      expect(nodePtySpawnMock).toHaveBeenCalled();
      spawnSpy.mockRestore();
    });

    it("returns PRECONDITION_FAILED when no PTY backend available", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      // Ensure Bun PTY path also fails so we reach node-pty fallback.
      const bunFailImpl: unknown = (..._args: unknown[]) => {
        throw new Error("Bun PTY unavailable");
      };
      vi.spyOn(bun, "spawn").mockImplementation(
        bunFailImpl as typeof bun.spawn
      );

      // Create a caller without the global node-pty test mock, and force node-pty to be unusable.
      mock.module("node-pty", () => ({ default: {} }));
      const { createTestCallerNoPty } = await import("./utils/trpc-nopty");
      const noPtyCaller = await createTestCallerNoPty();

      await expect(
        noPtyCaller.terminal.createSession({ cols: 80, rows: 24 })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    });
  });

  describe("events subscription", () => {
    it("emits data from Bun PTY session", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const _subscribers = new Set<(chunk: string) => void>();
      let dataCallback:
        | ((term: unknown, data: string | Uint8Array) => void)
        | null = null;

      const mockProc = {
        terminal: {
          write: vi.fn(),
          resize: vi.fn(),
          close: vi.fn(),
        },
        exited: pendingExit(),
        kill: vi.fn(),
      };

      const bunSpawnImpl: unknown = (...args: unknown[]) => {
        const options = (args.length > 1 ? args[1] : args[0]) as
          | TerminalSpawnOptions
          | undefined;
        if (options?.terminal?.data) {
          dataCallback = options.terminal.data;
        }
        return mockProc as unknown as Bun.Subprocess;
      };
      vi.spyOn(bun, "spawn").mockImplementation(
        bunSpawnImpl as typeof bun.spawn
      );

      const { sessionId } = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      const chunks: string[] = [];
      const observable = await caller.terminal.events({ sessionId });
      const subscription = toObservable(observable);

      await new Promise<void>((resolve) => {
        subscription.subscribe({
          next: (chunk: string) => {
            chunks.push(chunk);
          },
          error: () => resolve(),
          complete: () => resolve(),
        });

        // Simulate terminal output after subscription is set up
        setTimeout(() => {
          if (dataCallback) {
            dataCallback(null, "test output");
          }
          // Give it time to process
          setTimeout(() => resolve(), 50);
        }, 10);
      });

      expect(chunks).toContain("test output");
      await caller.terminal.kill({ sessionId });
    });

    it("emits NOT_FOUND for invalid sessionId", async () => {
      let error: TRPCError | null = null;
      const observable = await caller.terminal.events({
        sessionId: "invalid-id",
      });
      const subscription = toObservable(observable);

      await new Promise<void>((resolve) => {
        subscription.subscribe({
          next: () => {},
          error: (err) => {
            error = err as TRPCError;
            resolve();
          },
          complete: () => resolve(),
        });
      });

      if (!error) {
        throw new Error("Expected subscription to error");
      }
      if (!(error instanceof TRPCError)) {
        throw new Error("Expected TRPCError");
      }
      expect(error.code).toBe("NOT_FOUND");
    });
  });

  describe("write", () => {
    it("writes to Bun PTY session", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const mockTerminal = {
        write: vi.fn(),
        resize: vi.fn(),
        close: vi.fn(),
      };

      const mockProc = {
        terminal: mockTerminal,
        exited: pendingExit(),
        kill: vi.fn(),
      };

      const spawnSpy = vi
        .spyOn(bun, "spawn")
        .mockImplementation(() => mockProc as unknown as Bun.Subprocess);

      const { sessionId } = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      // Verify spawn was called
      expect(spawnSpy).toHaveBeenCalled();

      await caller.terminal.write({ sessionId, data: "test input" });

      expect(mockTerminal.write).toHaveBeenCalledWith("test input");
      await caller.terminal.kill({ sessionId });
      spawnSpy.mockRestore();
    });

    it("throws NOT_FOUND for invalid sessionId", async () => {
      let caught: unknown;
      try {
        await caller.terminal.write({
          sessionId: "invalid-id",
          data: "test",
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeDefined();
      expect(caught).toBeInstanceOf(TRPCError);
      expect((caught as TRPCError).code).toBe("NOT_FOUND");
    });
  });

  describe("resize", () => {
    it("resizes Bun PTY session", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const mockTerminal = {
        write: vi.fn(),
        resize: vi.fn(),
        close: vi.fn(),
      };

      const mockProc = {
        terminal: mockTerminal,
        exited: pendingExit(),
        kill: vi.fn(),
      };

      const spawnSpy = vi
        .spyOn(bun, "spawn")
        .mockImplementation(() => mockProc as unknown as Bun.Subprocess);

      const { sessionId } = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      // Verify spawn was called
      expect(spawnSpy).toHaveBeenCalled();

      await caller.terminal.resize({ sessionId, cols: 120, rows: 40 });

      expect(mockTerminal.resize).toHaveBeenCalledWith(120, 40);
      await caller.terminal.kill({ sessionId });
      spawnSpy.mockRestore();
    });

    it("silently ignores resize for invalid sessionId", async () => {
      await caller.terminal.resize({
        sessionId: "invalid-id",
        cols: 120,
        rows: 40,
      });
      // Should not throw
    });
  });

  describe("kill", () => {
    it("kills Bun PTY session", async () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const mockTerminal = {
        write: vi.fn(),
        resize: vi.fn(),
        close: vi.fn(),
      };

      const mockKill = vi.fn();
      const mockProc = {
        terminal: mockTerminal,
        exited: pendingExit(),
        kill: mockKill,
      };

      const spawnSpy = vi
        .spyOn(bun, "spawn")
        .mockImplementation(() => mockProc as unknown as Bun.Subprocess);

      const { sessionId } = await caller.terminal.createSession({
        cols: 80,
        rows: 24,
      });

      // Verify spawn was called
      expect(spawnSpy).toHaveBeenCalled();

      await caller.terminal.kill({ sessionId });

      expect(mockTerminal.close).toHaveBeenCalled();
      expect(mockKill).toHaveBeenCalled();
      spawnSpy.mockRestore();
    });

    it("silently ignores kill for invalid sessionId", async () => {
      await caller.terminal.kill({ sessionId: "invalid-id" });
      // Should not throw
    });
  });

  describe("listContainers", () => {
    it("returns empty array when docker is not available", async () => {
      const dockerFailSpawn = vi.fn().mockImplementation(() => {
        throw new Error("docker not found");
      });
      vi.spyOn(bun, "spawn").mockImplementation(
        dockerFailSpawn as unknown as typeof bun.spawn
      );

      const result = await caller.terminal.listContainers();

      expect(result).toEqual([]);
    });

    it("returns empty array when docker returns no containers", async () => {
      const mockProc = {
        stdout: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(""));
            controller.close();
          },
        }),
        stderr: new ReadableStream(),
        exited: Promise.resolve(0),
      };

      vi.spyOn(bun, "spawn").mockImplementation(
        () => mockProc as unknown as Bun.Subprocess
      );

      const result = await caller.terminal.listContainers();

      expect(result).toEqual([]);
    });

    it("parses docker ps output correctly", async () => {
      const dockerOutput = [
        "abc123|my-app|nginx:latest|Up 2 hours|running",
        "def456|my-db|postgres:15|Exited (0) 1 hour ago|exited",
        "ghi789|my-redis|redis:7|Up 5 minutes|running",
      ].join("\n");

      const mockProc = {
        stdout: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(dockerOutput));
            controller.close();
          },
        }),
        stderr: new ReadableStream(),
        exited: Promise.resolve(0),
      };

      vi.spyOn(bun, "spawn").mockImplementation(
        () => mockProc as unknown as Bun.Subprocess
      );

      const result = await caller.terminal.listContainers();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: "abc123",
        name: "my-app",
        image: "nginx:latest",
        status: "Up 2 hours",
        state: "running",
      });
      expect(result[1]).toEqual({
        id: "def456",
        name: "my-db",
        image: "postgres:15",
        status: "Exited (0) 1 hour ago",
        state: "exited",
      });
      expect(result[2]).toEqual({
        id: "ghi789",
        name: "my-redis",
        image: "redis:7",
        status: "Up 5 minutes",
        state: "running",
      });
    });

    it("calls docker with correct format arguments", async () => {
      const spawnSpy = vi.fn().mockImplementation(() => ({
        stdout: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        stderr: new ReadableStream(),
        exited: Promise.resolve(0),
      }));

      vi.spyOn(bun, "spawn").mockImplementation(
        spawnSpy as unknown as typeof bun.spawn
      );

      await caller.terminal.listContainers();

      expect(spawnSpy).toHaveBeenCalledWith(
        [
          "docker",
          "ps",
          "-a",
          "--format",
          "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}",
        ],
        expect.objectContaining({
          stdout: "pipe",
          stderr: "pipe",
        })
      );
    });
  });
});
