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

import { metricsStub } from "./utils/mock-metrics";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

mock.module("@alfred/api/metrics", () => metricsStub);

const createTimerMock = vi.fn();
const getActiveTimersMock = vi.fn();
const markTimerCompletedMock = vi.fn();
const cancelTimerMock = vi.fn();

mock.module("@alfred/db/repo/assistant", () => ({
  createTimer: createTimerMock,
  getActiveTimers: getActiveTimersMock,
  markTimerCompleted: markTimerCompletedMock,
  cancelTimer: cancelTimerMock,
  createNote: vi.fn(),
  getNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  createReminder: vi.fn(),
  getReminders: vi.fn(),
  getDueReminders: vi.fn(),
  markReminderFired: vi.fn(),
  deleteReminder: vi.fn(),
  createBookmark: vi.fn(),
  getBookmarks: vi.fn(),
  deleteBookmark: vi.fn(),
  createTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

describe("timerRouter", () => {
  beforeEach(() => {
    createTimerMock.mockReset();
    getActiveTimersMock.mockReset();
    markTimerCompletedMock.mockReset();
    cancelTimerMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.timer.create({
          duration: 60,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("creates timer with valid input", async () => {
      const mockTimer = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "test-user",
        duration: 60,
        label: "Test Timer",
        started: new Date(),
        completed: false,
        cancelled: false,
        created: new Date(),
        updated: new Date(),
      };

      createTimerMock.mockResolvedValue(mockTimer);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.timer.create({
        duration: 60,
        label: "Test Timer",
      });

      expect(result).toEqual(mockTimer);
      expect(createTimerMock).toHaveBeenCalledWith(
        "test-user",
        60,
        "Test Timer",
        undefined
      );
    });

    it("creates timer with projectId", async () => {
      const projectId = crypto.randomUUID();
      const mockTimer = {
        id: crypto.randomUUID(),
        userId: "test-user",
        projectId,
        duration: 60,
        label: "Project Timer",
        started: new Date(),
        completed: false,
        cancelled: false,
        created: new Date(),
        updated: new Date(),
      };

      createTimerMock.mockResolvedValue(mockTimer);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.timer.create({
        projectId,
        duration: 60,
        label: "Project Timer",
      });

      expect(result).toEqual(mockTimer);
      expect(createTimerMock).toHaveBeenCalledWith(
        "test-user",
        60,
        "Project Timer",
        projectId
      );
    });

    it("creates timer without optional label", async () => {
      const mockTimer = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "test-user",
        duration: 30,
        label: null,
        started: new Date(),
        completed: false,
        cancelled: false,
        created: new Date(),
        updated: new Date(),
      };

      createTimerMock.mockResolvedValue(mockTimer);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.timer.create({
        duration: 30,
      });

      expect(result).toEqual(mockTimer);
      expect(createTimerMock).toHaveBeenCalledWith(
        "test-user",
        30,
        undefined,
        undefined
      );
    });

    it("validates duration is positive", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.create({
          duration: 0,
        })
      ).rejects.toThrow();

      await expect(
        caller.timer.create({
          duration: -1,
        })
      ).rejects.toThrow();
    });

    it("validates duration is an integer", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.create({
          duration: 1.5,
        })
      ).rejects.toThrow();
    });

    it("validates label length", async () => {
      const caller = await createTestCaller({ userId: "test-user" });
      const longLabel = "a".repeat(129);

      await expect(
        caller.timer.create({
          duration: 60,
          label: longLabel,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects invalid projectId UUID", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.create({
          duration: 60,
          projectId: "not-a-uuid",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects zero duration", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.create({
          duration: 0,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects negative duration", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.create({
          duration: -1,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects empty label", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.create({
          duration: 60,
          label: "",
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("active", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.timer.active()).rejects.toThrow(TRPCError);
    });

    it("gets active timers scoped to user", async () => {
      const mockTimers = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          userId: "test-user",
          duration: 60,
          label: "Timer 1",
          started: new Date(),
          completed: false,
          cancelled: false,
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "223e4567-e89b-12d3-a456-426614174001",
          userId: "test-user",
          duration: 30,
          label: "Timer 2",
          started: new Date(),
          completed: false,
          cancelled: false,
          created: new Date(),
          updated: new Date(),
        },
      ];

      getActiveTimersMock.mockResolvedValue(mockTimers);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.timer.active();

      expect(result).toEqual(mockTimers);
      expect(getActiveTimersMock).toHaveBeenCalledWith("test-user", undefined);
    });

    it("gets active timers scoped to project", async () => {
      const projectId = crypto.randomUUID();
      getActiveTimersMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: "test-user" });
      await caller.timer.active({ projectId });

      expect(getActiveTimersMock).toHaveBeenCalledWith("test-user", projectId);
    });

    it("rejects invalid projectId UUID", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.active({ projectId: "not-a-uuid" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("done", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.timer.done({
          id: "123e4567-e89b-12d3-a456-426614174000",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("marks timer as completed", async () => {
      const timerId = "123e4567-e89b-12d3-a456-426614174000";
      markTimerCompletedMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.timer.done({ id: timerId });

      expect(result).toEqual({ updated: 1 });
      expect(markTimerCompletedMock).toHaveBeenCalledWith(timerId);
    });

    it("validates UUID format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(caller.timer.done({ id: "invalid-uuid" })).rejects.toThrow();
    });
  });

  describe("cancel", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.timer.cancel({
          id: "123e4567-e89b-12d3-a456-426614174000",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("cancels timer", async () => {
      const timerId = "123e4567-e89b-12d3-a456-426614174000";
      cancelTimerMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.timer.cancel({ id: timerId });

      expect(result).toEqual({ updated: 1 });
      expect(cancelTimerMock).toHaveBeenCalledWith(timerId);
    });

    it("rejects invalid UUID format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.timer.cancel({ id: "invalid-uuid" })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });
});
