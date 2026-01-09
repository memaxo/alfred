import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

const managePatternLifecycleMock = vi.fn();

mock.module("@alfred/plan/pattern", () => ({
  managePatternLifecycle: (...args: unknown[]) =>
    managePatternLifecycleMock(...args),
}));

const { startPatternLifecycleScheduler, stopPatternLifecycleScheduler } =
  await import("../../src/scheduler/pattern-lifecycle");

describe("PatternLifecycleScheduler", () => {
  const originalEnv = process.env.SCHED_PATTERN_LIFECYCLE;
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    managePatternLifecycleMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    stopPatternLifecycleScheduler();
  });

  afterEach(() => {
    stopPatternLifecycleScheduler();
    process.env.SCHED_PATTERN_LIFECYCLE = originalEnv;
  });

  it("does not start when SCHED_PATTERN_LIFECYCLE is unset", async () => {
    process.env.SCHED_PATTERN_LIFECYCLE = undefined;
    startPatternLifecycleScheduler({ logger: loggerMock, intervalMs: 10 });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(managePatternLifecycleMock).not.toHaveBeenCalled();
  });

  it("runs pattern lifecycle tick", async () => {
    process.env.SCHED_PATTERN_LIFECYCLE = "1";
    managePatternLifecycleMock.mockResolvedValue(undefined);

    startPatternLifecycleScheduler({
      logger: loggerMock,
      intervalMs: 1000,
      jitterMs: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(managePatternLifecycleMock).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).toHaveBeenCalledWith(
      "pattern_lifecycle_tick_complete"
    );
  });
});
