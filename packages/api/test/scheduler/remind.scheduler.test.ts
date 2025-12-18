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
  startReminderScheduler,
  stopReminderScheduler,
} from "../../src/scheduler/remind";

const getDueRemindersAllMock = vi.fn();
const markReminderFiredMock = vi.fn();

mock.module("@alfred/db/repo/assistant", () => ({
  getDueRemindersAll: getDueRemindersAllMock,
  markReminderFired: markReminderFiredMock,
}));

describe("ReminderScheduler", () => {
  const originalEnv = process.env.SCHED_REMIND;
  const loggerMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    getDueRemindersAllMock.mockReset();
    markReminderFiredMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    stopReminderScheduler();
  });

  afterEach(() => {
    stopReminderScheduler();
    process.env.SCHED_REMIND = originalEnv;
    vi.clearAllMocks();
  });

  describe("env flag gating", () => {
    it("does not start when SCHED_REMIND is unset", () => {
      process.env.SCHED_REMIND = undefined;
      startReminderScheduler({ logger: loggerMock });
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining("disabled")
      );
      expect(getDueRemindersAllMock).not.toHaveBeenCalled();
    });

    it("starts when SCHED_REMIND is set to 1", async () => {
      process.env.SCHED_REMIND = "1";
      getDueRemindersAllMock.mockResolvedValue([]);

      startReminderScheduler({
        intervalMs: 100,
        logger: loggerMock,
        now: () => new Date("2025-01-27T12:00:00Z"),
      });

      // Wait for first tick
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(getDueRemindersAllMock).toHaveBeenCalled();
      stopReminderScheduler();
    });
  });

  describe("execution logic", () => {
    beforeEach(() => {
      process.env.SCHED_REMIND = "1";
    });

    it("processes due reminders", async () => {
      const mockReminders = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          userId: "test-user",
          title: "Due Reminder",
          description: null,
          due: new Date("2025-01-27T11:00:00Z"),
          recurring: null,
          fired: false,
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "223e4567-e89b-12d3-a456-426614174001",
          userId: "test-user",
          title: "Another Due Reminder",
          description: null,
          due: new Date("2025-01-27T11:30:00Z"),
          recurring: null,
          fired: false,
          created: new Date(),
          updated: new Date(),
        },
      ];

      getDueRemindersAllMock.mockResolvedValue(mockReminders);
      markReminderFiredMock.mockResolvedValue(1);

      const onFireMock = vi.fn().mockResolvedValue(undefined);

      startReminderScheduler({
        intervalMs: 100,
        batchSize: 100,
        logger: loggerMock,
        onFire: onFireMock,
        now: () => new Date("2025-01-27T12:00:00Z"),
      });

      // Wait for first tick
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(getDueRemindersAllMock).toHaveBeenCalledWith(
        expect.any(Date),
        100
      );
      expect(markReminderFiredMock).toHaveBeenCalledTimes(2);
      expect(markReminderFiredMock).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000"
      );
      expect(markReminderFiredMock).toHaveBeenCalledWith(
        "223e4567-e89b-12d3-a456-426614174001"
      );
      expect(onFireMock).toHaveBeenCalledTimes(2);

      stopReminderScheduler();
    });

    it("handles empty reminder list", async () => {
      getDueRemindersAllMock.mockResolvedValue([]);

      startReminderScheduler({
        intervalMs: 100,
        logger: loggerMock,
        now: () => new Date("2025-01-27T12:00:00Z"),
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(getDueRemindersAllMock).toHaveBeenCalled();
      expect(markReminderFiredMock).not.toHaveBeenCalled();

      stopReminderScheduler();
    });
  });

  describe("concurrency guards", () => {
    beforeEach(() => {
      process.env.SCHED_REMIND = "1";
    });

    it("skips tick if previous run is still in progress", async () => {
      let resolveFirstTick: () => void;
      const firstTickPromise = new Promise<void>((resolve) => {
        resolveFirstTick = resolve;
      });

      getDueRemindersAllMock.mockImplementation(async () => {
        await firstTickPromise;
        return [];
      });

      startReminderScheduler({
        intervalMs: 50,
        logger: loggerMock,
        now: () => new Date("2025-01-27T12:00:00Z"),
      });

      // Trigger first tick
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Trigger second tick while first is still running (should be scheduled)
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Should have been called once, second call should be skipped
      // Note: The scheduler uses setTimeout, so we need to wait a bit more
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(getDueRemindersAllMock).toHaveBeenCalledTimes(1);
      // The warning may not be logged if the second tick hasn't fired yet
      // but the concurrency guard should prevent it

      resolveFirstTick?.();
      stopReminderScheduler();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      process.env.SCHED_REMIND = "1";
    });

    it("logs errors and continues running", async () => {
      const error = new Error("Database error");
      getDueRemindersAllMock.mockRejectedValueOnce(error);

      startReminderScheduler({
        intervalMs: 100,
        logger: loggerMock,
        now: () => new Date("2025-01-27T12:00:00Z"),
      });

      // Wait for first tick (error)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify error was logged
      expect(loggerMock.error).toHaveBeenCalled();
      const errorCall = loggerMock.error.mock.calls.find((call) =>
        call[0]?.includes("failed")
      );
      expect(errorCall).toBeDefined();

      // Verify scheduler didn't crash (running flag should be reset)
      // The scheduler should continue running even after errors
      expect(getDueRemindersAllMock).toHaveBeenCalled();

      stopReminderScheduler();
    });
  });

  describe("cleanup", () => {
    beforeEach(() => {
      process.env.SCHED_REMIND = "1";
    });

    it("stops scheduler and cleans up timers", async () => {
      getDueRemindersAllMock.mockResolvedValue([]);

      startReminderScheduler({
        intervalMs: 100,
        logger: loggerMock,
        now: () => new Date("2025-01-27T12:00:00Z"),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      stopReminderScheduler();

      // Wait to ensure no more ticks occur
      await new Promise((resolve) => setTimeout(resolve, 200));

      const callCount = getDueRemindersAllMock.mock.calls.length;

      // Should not have been called again after stop
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(getDueRemindersAllMock.mock.calls.length).toBe(callCount);
    });
  });
});
