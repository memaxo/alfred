import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { TRPCError } from "@trpc/server";
import { metricsStub } from "./utils/mock-metrics";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

mock.module("@alfred/api/metrics", () => metricsStub);

const createReminderMock = vi.fn();
const getRemindersMock = vi.fn();
const getDueRemindersMock = vi.fn();
const markReminderFiredMock = vi.fn();
const deleteReminderMock = vi.fn();
const ensureMirrorNodesMock = vi.fn().mockResolvedValue(new Map());
const graphWriteStub = {
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  upsertNodes: vi.fn(),
  createEdge: vi.fn(),
  deleteEdge: vi.fn(),
  upsertEdges: vi.fn(),
  archiveNodes: vi.fn(),
  deleteArchivedNodes: vi.fn(),
  updateNodeConfidence: vi.fn(),
  updateNodeConfidenceBatch: vi.fn(),
  touchNodes: vi.fn(),
  deleteNodesBatch: vi.fn(),
};

mock.module("@alfred/db/repo/assistant", () => ({
  createReminder: createReminderMock,
  getReminders: getRemindersMock,
  getDueReminders: getDueRemindersMock,
  markReminderFired: markReminderFiredMock,
  deleteReminder: deleteReminderMock,
  createNote: vi.fn(),
  getNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  createTimer: vi.fn(),
  getActiveTimers: vi.fn(),
  markTimerCompleted: vi.fn(),
  cancelTimer: vi.fn(),
  createBookmark: vi.fn(),
  getBookmarks: vi.fn(),
  deleteBookmark: vi.fn(),
  createTask: vi.fn(),
  getTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

mock.module("@alfred/db/repo/graph/write", () => ({
  ...graphWriteStub,
  ensureMirrorNodes: ensureMirrorNodesMock,
}));

describe("remindRouter", () => {
  beforeEach(() => {
    createReminderMock.mockReset();
    getRemindersMock.mockReset();
    getDueRemindersMock.mockReset();
    markReminderFiredMock.mockReset();
    deleteReminderMock.mockReset();
    ensureMirrorNodesMock.mockReset().mockResolvedValue(new Map());
    graphWriteStub.createNode.mockReset();
    graphWriteStub.updateNode.mockReset();
    graphWriteStub.deleteNode.mockReset();
    graphWriteStub.upsertNodes.mockReset();
    graphWriteStub.createEdge.mockReset();
    graphWriteStub.deleteEdge.mockReset();
    graphWriteStub.upsertEdges.mockReset();
    graphWriteStub.archiveNodes.mockReset();
    graphWriteStub.deleteArchivedNodes.mockReset();
    graphWriteStub.updateNodeConfidence.mockReset();
    graphWriteStub.updateNodeConfidenceBatch.mockReset();
    graphWriteStub.touchNodes.mockReset();
    graphWriteStub.deleteNodesBatch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.remind.create({
          title: "Test Reminder",
          due: new Date().toISOString(),
        })
      ).rejects.toThrow(TRPCError);
    });

    it("creates reminder with valid input", async () => {
      const dueDate = new Date("2025-12-31T12:00:00Z");
      const mockReminder = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "test-user",
        title: "Test Reminder",
        description: "Test description",
        due: dueDate,
        recurring: null,
        fired: false,
        created: new Date(),
        updated: new Date(),
      };

      createReminderMock.mockResolvedValue(mockReminder);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.create({
        title: "Test Reminder",
        due: dueDate.toISOString(),
        description: "Test description",
      });

      expect(result).toEqual(mockReminder);
      expect(createReminderMock).toHaveBeenCalledWith(
        "test-user",
        "Test Reminder",
        dueDate,
        "Test description",
        undefined,
        undefined
      );
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({ kind: "reminder", id: mockReminder.id }),
        ]),
        { projectId: undefined }
      );
    });

    it("creates reminder with projectId", async () => {
      const dueDate = new Date("2025-12-31T12:00:00Z");
      const projectId = crypto.randomUUID();
      const mockReminder = {
        id: crypto.randomUUID(),
        userId: "test-user",
        projectId,
        title: "Project Reminder",
        due: dueDate,
        fired: false,
        created: new Date(),
        updated: new Date(),
      };

      createReminderMock.mockResolvedValue(mockReminder);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.create({
        projectId,
        title: "Project Reminder",
        due: dueDate.toISOString(),
      });

      expect(result).toEqual(mockReminder);
      expect(createReminderMock).toHaveBeenCalledWith(
        "test-user",
        "Project Reminder",
        dueDate,
        undefined,
        undefined,
        projectId
      );
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.any(Array),
        { projectId }
      );
    });

    it("creates reminder without optional fields", async () => {
      const dueDate = new Date("2025-12-31T12:00:00Z");
      const mockReminder = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "test-user",
        title: "Test Reminder",
        description: null,
        due: dueDate,
        recurring: null,
        fired: false,
        created: new Date(),
        updated: new Date(),
      };

      createReminderMock.mockResolvedValue(mockReminder);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.create({
        title: "Test Reminder",
        due: dueDate.toISOString(),
      });

      expect(result).toEqual(mockReminder);
      expect(createReminderMock).toHaveBeenCalledWith(
        "test-user",
        "Test Reminder",
        dueDate,
        undefined,
        undefined,
        undefined
      );
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({ kind: "reminder", id: mockReminder.id }),
        ]),
        { projectId: undefined }
      );
    });

    it("validates title is required", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.remind.create({
          title: "",
          due: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it("validates title length", async () => {
      const caller = await createTestCaller({ userId: "test-user" });
      const longTitle = "a".repeat(257);

      await expect(
        caller.remind.create({
          title: longTitle,
          due: new Date().toISOString(),
        })
      ).rejects.toThrow();
    });

    it("validates due date format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.remind.create({
          title: "Test Reminder",
          due: "invalid-date",
        })
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.remind.list({})).rejects.toThrow(TRPCError);
    });

    it("lists reminders scoped to user", async () => {
      const mockReminders = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          userId: "test-user",
          title: "Reminder 1",
          description: null,
          due: new Date("2025-12-31T12:00:00Z"),
          recurring: null,
          fired: false,
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "223e4567-e89b-12d3-a456-426614174001",
          userId: "test-user",
          title: "Reminder 2",
          description: null,
          due: new Date("2025-12-31T13:00:00Z"),
          recurring: null,
          fired: false,
          created: new Date(),
          updated: new Date(),
        },
      ];

      getRemindersMock.mockResolvedValue(mockReminders);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.list({ limit: 100, offset: 0 });

      expect(result).toEqual(mockReminders);
      expect(getRemindersMock).toHaveBeenCalledWith(
        "test-user",
        100,
        0,
        undefined
      );
    });

    it("lists reminders scoped to project", async () => {
      const projectId = crypto.randomUUID();
      getRemindersMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: "test-user" });
      await caller.remind.list({ projectId });

      expect(getRemindersMock).toHaveBeenCalledWith(
        "test-user",
        100,
        0,
        projectId
      );
    });

    it("uses default limit and offset", async () => {
      getRemindersMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: "test-user" });
      await caller.remind.list({});

      expect(getRemindersMock).toHaveBeenCalledWith(
        "test-user",
        100,
        0,
        undefined
      );
    });

    it("validates limit bounds", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(caller.remind.list({ limit: 0 })).rejects.toThrow();
      await expect(caller.remind.list({ limit: 201 })).rejects.toThrow();
    });
  });

  describe("due", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.remind.due({})).rejects.toThrow(TRPCError);
    });

    it("gets due reminders", async () => {
      const beforeDate = new Date("2025-12-31T12:00:00Z");
      const mockReminders = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          userId: "test-user",
          title: "Due Reminder",
          description: null,
          due: new Date("2025-12-31T11:00:00Z"),
          recurring: null,
          fired: false,
          created: new Date(),
          updated: new Date(),
        },
      ];

      getDueRemindersMock.mockResolvedValue(mockReminders);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.due({
        before: beforeDate.toISOString(),
      });

      expect(result).toEqual(mockReminders);
      expect(getDueRemindersMock).toHaveBeenCalledWith(
        "test-user",
        beforeDate,
        undefined
      );
    });

    it("uses current date when before is not provided", async () => {
      getDueRemindersMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: "test-user" });
      await caller.remind.due({});

      expect(getDueRemindersMock).toHaveBeenCalled();
      const callArg = getDueRemindersMock.mock.calls[0]?.[1];
      expect(callArg).toBeInstanceOf(Date);
    });
  });

  describe("fire", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.remind.fire({
          id: "123e4567-e89b-12d3-a456-426614174000",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("marks reminder as fired", async () => {
      const reminderId = "123e4567-e89b-12d3-a456-426614174000";
      markReminderFiredMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.fire({ id: reminderId });

      expect(result).toEqual({ updated: 1 });
      expect(markReminderFiredMock).toHaveBeenCalledWith(reminderId);
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({ kind: "reminder", id: reminderId }),
        ])
      );
    });

    it("validates UUID format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.remind.fire({ id: "invalid-uuid" })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.remind.delete({
          id: "123e4567-e89b-12d3-a456-426614174000",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("deletes reminder", async () => {
      const reminderId = "123e4567-e89b-12d3-a456-426614174000";
      deleteReminderMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.remind.delete({ id: reminderId });

      expect(result).toEqual({ deleted: 1 });
      expect(deleteReminderMock).toHaveBeenCalledWith(reminderId);
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({ kind: "reminder", id: reminderId }),
        ])
      );
    });

    it("validates UUID format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.remind.delete({ id: "invalid-uuid" })
      ).rejects.toThrow();
    });
  });
});
