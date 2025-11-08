import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const createReminderMock = vi.fn();
const getRemindersMock = vi.fn();
const getDueRemindersMock = vi.fn();
const markReminderFiredMock = vi.fn();
const deleteReminderMock = vi.fn();

mock.module("@alfred/db/repo/assistant", () => ({
  createReminder: createReminderMock,
  getReminders: getRemindersMock,
  getDueReminders: getDueRemindersMock,
  markReminderFired: markReminderFiredMock,
  deleteReminder: deleteReminderMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
});

describe("remind router", () => {
  describe("create", () => {
    it("creates a reminder", async () => {
      const mockReminder = {
        id: "reminder-id",
        userId: "test-user",
        title: "test reminder",
        due: new Date(),
      };

      createReminderMock.mockResolvedValue(mockReminder);

      const result = await caller.remind.create({
        title: "test reminder",
        description: "test description",
        due: new Date().toISOString(),
        recurring: "daily",
      });

      expect(createReminderMock).toHaveBeenCalledWith(
        "test-user",
        "test reminder",
        expect.any(Date),
        "test description",
        "daily"
      );
      expect(result).toEqual(mockReminder);
    });

    it("validates required fields", async () => {
      await expect(
        caller.remind.create({
          title: "",
          due: new Date().toISOString(),
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("lists reminders with pagination", async () => {
      const mockReminders = [
        { id: "reminder-1", title: "reminder 1" },
        { id: "reminder-2", title: "reminder 2" },
      ];

      getRemindersMock.mockResolvedValue(mockReminders);

      const result = await caller.remind.list({
        limit: 10,
        offset: 0,
      });

      expect(getRemindersMock).toHaveBeenCalledWith("test-user", 10, 0);
      expect(result).toEqual(mockReminders);
    });
  });

  describe("due", () => {
    it("gets due reminders", async () => {
      const mockDue = [{ id: "reminder-1", title: "due reminder" }];
      getDueRemindersMock.mockResolvedValue(mockDue);

      const before = new Date().toISOString();
      const result = await caller.remind.due({ before });

      expect(getDueRemindersMock).toHaveBeenCalledWith(
        "test-user",
        expect.any(Date)
      );
      expect(result).toEqual(mockDue);
    });

    it("uses current date when before not provided", async () => {
      getDueRemindersMock.mockResolvedValue([]);

      await caller.remind.due({});

      expect(getDueRemindersMock).toHaveBeenCalledWith(
        "test-user",
        expect.any(Date)
      );
    });
  });

  describe("fire", () => {
    it("marks reminder as fired", async () => {
      const mockUpdated = { id: "reminder-id", fired: true };
      markReminderFiredMock.mockResolvedValue(mockUpdated);

      const result = await caller.remind.fire({
        id: "reminder-id",
      });

      expect(markReminderFiredMock).toHaveBeenCalledWith("reminder-id");
      expect(result).toEqual({ updated: mockUpdated });
    });
  });

  describe("delete", () => {
    it("deletes a reminder", async () => {
      deleteReminderMock.mockResolvedValue(true);

      const result = await caller.remind.delete({
        id: "reminder-id",
      });

      expect(deleteReminderMock).toHaveBeenCalledWith("reminder-id");
      expect(result).toEqual({ deleted: true });
    });
  });
});
