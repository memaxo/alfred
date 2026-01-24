import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import {
  startProjectLifecycleScheduler,
  stopProjectLifecycleScheduler,
} from "../../src/scheduler/project-lifecycle";

const listInactiveProjectIdsMock = vi.fn();
const archiveProjectMock = vi.fn();

mock.module("@alfred/db/repo/project", () => ({
  listInactiveProjectIds: (...args: unknown[]) =>
    listInactiveProjectIdsMock(...args),
  archiveProject: (...args: unknown[]) => archiveProjectMock(...args),
}));

describe("ProjectLifecycleScheduler", () => {
  const originalEnv = process.env.SCHED_PROJECT_LIFECYCLE;
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    listInactiveProjectIdsMock.mockReset();
    archiveProjectMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    stopProjectLifecycleScheduler();
  });

  afterEach(() => {
    stopProjectLifecycleScheduler();
    process.env.SCHED_PROJECT_LIFECYCLE = originalEnv;
  });

  it("does not start when SCHED_PROJECT_LIFECYCLE is unset", async () => {
    process.env.SCHED_PROJECT_LIFECYCLE = undefined;
    startProjectLifecycleScheduler({ logger: loggerMock, intervalMs: 10 });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(listInactiveProjectIdsMock).not.toHaveBeenCalled();
  });

  it("archives inactive projects", async () => {
    process.env.SCHED_PROJECT_LIFECYCLE = "1";
    listInactiveProjectIdsMock.mockResolvedValue([
      "proj-1",
      "proj-2",
      "proj-3",
    ]);
    archiveProjectMock.mockResolvedValue(undefined);

    startProjectLifecycleScheduler({
      logger: loggerMock,
      intervalMs: 1000,
      jitterMs: 0,
      archiveAfterDays: 1,
      batchSize: 10,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(listInactiveProjectIdsMock).toHaveBeenCalledWith({
      olderThanMs: 1 * 24 * 60 * 60 * 1000,
      limit: 10,
    });
    expect(archiveProjectMock).toHaveBeenCalledTimes(3);
    expect(archiveProjectMock).toHaveBeenCalledWith("proj-1", "inactive");
    expect(archiveProjectMock).toHaveBeenCalledWith("proj-2", "inactive");
    expect(archiveProjectMock).toHaveBeenCalledWith("proj-3", "inactive");
  });
});
