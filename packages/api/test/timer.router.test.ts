import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const createTimerMock = vi.fn();
const getActiveTimersMock = vi.fn();
const markTimerCompletedMock = vi.fn();
const cancelTimerMock = vi.fn();

mock.module("@alfred/db/repo/assistant", () => ({
  createTimer: createTimerMock,
  getActiveTimers: getActiveTimersMock,
  markTimerCompleted: markTimerCompletedMock,
  cancelTimer: cancelTimerMock,
  // Stubs for other exports to satisfy imports in appRouter
  createTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createNote: vi.fn(),
  getNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  createReminder: vi.fn(),
  getDueReminders: vi.fn(),
  getReminders: vi.fn(),
  getDueRemindersAll: vi.fn(),
  markReminderFired: vi.fn(),
  deleteReminder: vi.fn(),
  createBookmark: vi.fn(),
  getBookmarks: vi.fn(),
  deleteBookmark: vi.fn(),
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
});

describe("timer router", () => {
  describe("create", () => {
    it("creates a timer", async () => {
      const mockTimer = {
        id: "timer-id",
        userId: "test-user",
        duration: 60,
        label: "test timer",
      };

      createTimerMock.mockResolvedValue(mockTimer);

      const result = await caller.timer.create({
        duration: 60,
        label: "test timer",
      });

      expect(createTimerMock).toHaveBeenCalledWith(
        "test-user",
        60,
        "test timer"
      );
      expect(result).toEqual(mockTimer);
    });

    it("validates positive duration", async () => {
      await expect(
        caller.timer.create({
          duration: -1,
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("active", () => {
    it("gets active timers", async () => {
      const mockTimers = [
        { id: "timer-1", duration: 60 },
        { id: "timer-2", duration: 120 },
      ];

      getActiveTimersMock.mockResolvedValue(mockTimers);

      const result = await caller.timer.active();

      expect(getActiveTimersMock).toHaveBeenCalledWith("test-user");
      expect(result).toEqual(mockTimers);
    });
  });

  describe("done", () => {
    it("marks timer as completed", async () => {
      const mockUpdated = { id: "timer-id", completed: true };
      markTimerCompletedMock.mockResolvedValue(mockUpdated);

      const result = await caller.timer.done({
        id: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(markTimerCompletedMock).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000"
      );
      expect(result).toEqual({ updated: mockUpdated });
    });
  });

  describe("cancel", () => {
    it("cancels a timer", async () => {
      const mockUpdated = { id: "timer-id", cancelled: true };
      cancelTimerMock.mockResolvedValue(mockUpdated);

      const result = await caller.timer.cancel({
        id: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(cancelTimerMock).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000"
      );
      expect(result).toEqual({ updated: mockUpdated });
    });
  });
});
