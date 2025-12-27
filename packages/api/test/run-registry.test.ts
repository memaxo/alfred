import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

// Create inline metric mocks to avoid module caching issues with fixture imports
const incMock = vi.fn();
const startTimerMock = vi.fn(() => vi.fn());

const metricsMock = {
  runRegistryEventsTotal: {
    inc: incMock,
    labels: vi.fn(() => ({ inc: incMock })),
  },
  runRegistryDispatchDurationSeconds: {
    startTimer: startTimerMock,
    observe: vi.fn(),
    labels: vi.fn(() => ({ observe: vi.fn() })),
  },
};

// Mock workflow metrics BEFORE any imports that use them
mock.module("@alfred/agent/workflow/metrics", () => metricsMock);

// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";

// Install shared mocks
installLoggerMock();

// Use shared mocks for assertions
const loggerWarnMock = loggerMocks.warn;
const loggerInfoMock = loggerMocks.info;
const loggerErrorMock = loggerMocks.error;
const loggerDebugMock = loggerMocks.debug;

// Types for the dynamically imported module
type MemoryRunRegistryType =
  import("@alfred/agent/workflow/registry").MemoryRunRegistry;
type ResumePayloadType =
  import("@alfred/agent/workflow/registry").ResumePayload;
type RunHandleType = import("@alfred/agent/workflow/registry").RunHandle;

let MemoryRunRegistry: new () => MemoryRunRegistryType;

describe("MemoryRunRegistry", () => {
  let registry: MemoryRunRegistryType;

  beforeAll(async () => {
    // Dynamic import AFTER mocks are set up
    const registryModule = await import("@alfred/agent/workflow/registry");
    MemoryRunRegistry = registryModule.MemoryRunRegistry;
  });

  beforeEach(() => {
    // Clear all mocks before each test
    incMock.mockClear();
    startTimerMock.mockClear();
    loggerWarnMock.mockClear();
    loggerInfoMock.mockClear();
    loggerErrorMock.mockClear();
    loggerDebugMock.mockClear();

    // Create new registry instance for each test
    registry = new MemoryRunRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("registers a run handle", () => {
      const runId = "test-run-id";
      const handle: RunHandleType = {
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);

      expect(incMock).toHaveBeenCalledWith({
        event: "register",
        backend: "memory",
        outcome: "ok",
      });
    });
  });

  describe("unregister", () => {
    it("unregisters an existing run", () => {
      const runId = "test-run-id";
      const handle: RunHandleType = {
        resume: vi.fn(),
        cancel: vi.fn(),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);
      registry.unregister(runId);

      expect(incMock).toHaveBeenCalledWith({
        event: "unregister",
        backend: "memory",
        outcome: "ok",
      });
    });

    it("handles unregister of non-existent run", () => {
      registry.unregister("nonexistent");

      expect(incMock).toHaveBeenCalledWith({
        event: "unregister",
        backend: "memory",
        outcome: "miss",
      });
    });
  });

  describe("dispatchResume", () => {
    it("dispatches resume to registered handle", async () => {
      const runId = "test-run-id";
      const resumeMock = vi.fn().mockResolvedValue(undefined);
      const handle: RunHandleType = {
        resume: resumeMock,
        cancel: vi.fn(),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);

      const payload: ResumePayloadType = {
        event: "bio-authz",
        authz: "token-123",
      };

      const result = await registry.dispatchResume(runId, payload);

      expect(resumeMock).toHaveBeenCalledWith({ resumeData: payload });
      expect(result).toBe(true);
      expect(incMock).toHaveBeenCalledWith({
        event: "dispatch",
        backend: "memory",
        outcome: "local",
      });
    });

    it("returns false when run not found", async () => {
      const payload: ResumePayloadType = {
        event: "bio-authz",
        authz: "token",
      };

      const result = await registry.dispatchResume("nonexistent", payload);

      expect(result).toBe(false);
      expect(incMock).toHaveBeenCalledWith({
        event: "dispatch",
        backend: "memory",
        outcome: "miss",
      });
    });

    it("handles resume errors", async () => {
      const runId = "test-run-id";
      const resumeMock = vi.fn().mockRejectedValue(new Error("resume failed"));
      const handle: RunHandleType = {
        resume: resumeMock,
        cancel: vi.fn(),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);

      const payload: ResumePayloadType = {
        event: "bio-authz",
        authz: "token",
      };

      await expect(registry.dispatchResume(runId, payload)).rejects.toThrow();
      expect(incMock).toHaveBeenCalledWith({
        event: "dispatch",
        backend: "memory",
        outcome: "error",
      });
    });
  });
});
