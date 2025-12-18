import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { workflowMetricsStub } from "@alfred/test-kit/workflow/runtime-fixture";

// Mock workflow metrics BEFORE importing registry
mock.module("@alfred/agent/workflow/metrics", () => workflowMetricsStub);

// Get references to the specific metric mocks we need to assert on
const runRegistryEventsTotalMock = workflowMetricsStub.runRegistryEventsTotal;
const runRegistryDispatchDurationSecondsMock =
  workflowMetricsStub.runRegistryDispatchDurationSeconds;

// Import registry AFTER mocking metrics
import {
  MemoryRunRegistry,
  type ResumePayload,
  type RunHandle,
} from "@alfred/agent/workflow/registry";

const loggerWarnMock = vi.fn();

mock.module("@alfred/logger", () => ({
  logger: {
    warn: loggerWarnMock,
  },
}));

describe("MemoryRunRegistry", () => {
  let registry: MemoryRunRegistry;

  beforeEach(() => {
    // Clear mocks before each test
    runRegistryEventsTotalMock.inc.mockClear();
    runRegistryDispatchDurationSecondsMock.startTimer.mockClear();
    registry = new MemoryRunRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("register", () => {
    it("registers a run handle", () => {
      const runId = "test-run-id";
      const handle: RunHandle = {
        resume: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);

      expect(runRegistryEventsTotalMock.inc).toHaveBeenCalledWith({
        event: "register",
        backend: "memory",
        outcome: "ok",
      });
    });
  });

  describe("unregister", () => {
    it("unregisters an existing run", () => {
      const runId = "test-run-id";
      const handle: RunHandle = {
        resume: vi.fn(),
        cancel: vi.fn(),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);
      registry.unregister(runId);

      expect(runRegistryEventsTotalMock.inc).toHaveBeenCalledWith({
        event: "unregister",
        backend: "memory",
        outcome: "ok",
      });
    });

    it("handles unregister of non-existent run", () => {
      registry.unregister("nonexistent");

      expect(runRegistryEventsTotalMock.inc).toHaveBeenCalledWith({
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
      const handle: RunHandle = {
        resume: resumeMock,
        cancel: vi.fn(),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);

      const payload: ResumePayload = {
        event: "bio-authz",
        authz: "token-123",
      };

      const result = await registry.dispatchResume(runId, payload);

      expect(resumeMock).toHaveBeenCalledWith({ resumeData: payload });
      expect(result).toBe(true);
      expect(runRegistryEventsTotalMock.inc).toHaveBeenCalledWith({
        event: "dispatch",
        backend: "memory",
        outcome: "local",
      });
    });

    it("returns false when run not found", async () => {
      const payload: ResumePayload = {
        event: "bio-authz",
        authz: "token",
      };

      const result = await registry.dispatchResume("nonexistent", payload);

      expect(result).toBe(false);
      expect(runRegistryEventsTotalMock.inc).toHaveBeenCalledWith({
        event: "dispatch",
        backend: "memory",
        outcome: "miss",
      });
    });

    it("handles resume errors", async () => {
      const runId = "test-run-id";
      const resumeMock = vi.fn().mockRejectedValue(new Error("resume failed"));
      const handle: RunHandle = {
        resume: resumeMock,
        cancel: vi.fn(),
        abortController: new AbortController(),
      };

      registry.register(runId, handle);

      const payload: ResumePayload = {
        event: "bio-authz",
        authz: "token",
      };

      await expect(registry.dispatchResume(runId, payload)).rejects.toThrow();
      expect(runRegistryEventsTotalMock.inc).toHaveBeenCalledWith({
        event: "dispatch",
        backend: "memory",
        outcome: "error",
      });
    });
  });
});
