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

const createNoteMock = vi.fn();
const getNotesMock = vi.fn();
const updateNoteMock = vi.fn();
const deleteNoteMock = vi.fn();
const ingestMock = vi.fn().mockResolvedValue(undefined);
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

mock.module("@alfred/rag", () => ({
  ingest: ingestMock,
  embed: vi.fn().mockResolvedValue([]),
  embedMany: vi.fn().mockResolvedValue([]),
  retrieve: vi.fn().mockResolvedValue([]),
  chunk: vi.fn().mockReturnValue([]),
  setEmbeddingProvider: vi.fn(),
  evaluateRetrieval: vi.fn(),
  evaluateWithModel: vi.fn(),
  rerank: vi.fn(),
  EMBEDDING_DIM: 1536,
}));

mock.module("@alfred/db/repo/assistant", () => ({
  createNote: createNoteMock,
  getNotes: getNotesMock,
  updateNote: updateNoteMock,
  deleteNote: deleteNoteMock,
  createReminder: vi.fn(),
  getReminders: vi.fn(),
  getDueReminders: vi.fn(),
  markReminderFired: vi.fn(),
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

describe("noteRouter", () => {
  beforeEach(() => {
    createNoteMock.mockReset();
    getNotesMock.mockReset();
    updateNoteMock.mockReset();
    deleteNoteMock.mockReset();
    ingestMock.mockReset().mockResolvedValue(undefined);
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
        caller.note.create({
          content: "Test note content",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("creates note with valid input", async () => {
      const mockNote = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "test-user",
        title: "Test Note",
        content: "Test note content",
        tags: ["test"],
        created: new Date(),
        updated: new Date(),
      };

      createNoteMock.mockResolvedValue(mockNote);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.note.create({
        title: "Test Note",
        content: "Test note content",
        tags: ["test"],
      });

      expect(result).toEqual(mockNote);
      expect(createNoteMock).toHaveBeenCalledWith(
        "test-user",
        "Test note content",
        "Test Note",
        ["test"],
        undefined
      );
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({ kind: "note", id: mockNote.id }),
        ]),
        { projectId: undefined }
      );
    });

    it("creates note with projectId", async () => {
      const projectId = crypto.randomUUID();
      const mockNote = {
        id: crypto.randomUUID(),
        userId: "test-user",
        projectId,
        title: "Project Note",
        content: "Content",
        tags: null,
        created: new Date(),
        updated: new Date(),
      };

      createNoteMock.mockResolvedValue(mockNote);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.note.create({
        projectId,
        content: "Content",
        title: "Project Note",
      });

      expect(result).toEqual(mockNote);
      expect(createNoteMock).toHaveBeenCalledWith(
        "test-user",
        "Content",
        "Project Note",
        undefined,
        projectId
      );
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.any(Array),
        { projectId }
      );
    });

    it("creates note without optional fields", async () => {
      const mockNote = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        userId: "test-user",
        title: null,
        content: "Test note content",
        tags: null,
        created: new Date(),
        updated: new Date(),
      };

      createNoteMock.mockResolvedValue(mockNote);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.note.create({
        content: "Test note content",
      });

      expect(result).toEqual(mockNote);
      expect(createNoteMock).toHaveBeenCalledWith(
        "test-user",
        "Test note content",
        undefined,
        undefined,
        undefined
      );
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({ kind: "note", id: mockNote.id }),
        ]),
        { projectId: undefined }
      );
    });

    it("validates title length", async () => {
      const caller = await createTestCaller({ userId: "test-user" });
      const longTitle = "a".repeat(257);

      await expect(
        caller.note.create({
          title: longTitle,
          content: "Test content",
        })
      ).rejects.toThrow();
    });

    it("validates content is required", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.note.create({
          title: "Test Note",
          content: "",
        })
      ).rejects.toThrow();
    });

    it("validates tags count", async () => {
      const caller = await createTestCaller({ userId: "test-user" });
      const tooManyTags = Array.from({ length: 33 }, (_, i) => `tag-${i}`);

      await expect(
        caller.note.create({
          content: "Test content",
          tags: tooManyTags,
        })
      ).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.note.list({})).rejects.toThrow(TRPCError);
    });

    it("lists notes scoped to user", async () => {
      const mockNotes = [
        {
          id: "note-1",
          userId: "test-user",
          title: "Note 1",
          content: "Content 1",
          tags: null,
          created: new Date(),
          updated: new Date(),
        },
        {
          id: "note-2",
          userId: "test-user",
          title: "Note 2",
          content: "Content 2",
          tags: null,
          created: new Date(),
          updated: new Date(),
        },
      ];

      getNotesMock.mockResolvedValue(mockNotes);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.note.list({ limit: 100, offset: 0 });

      expect(result).toEqual(mockNotes);
      expect(getNotesMock).toHaveBeenCalledWith("test-user", 100, 0, undefined);
    });

    it("lists notes scoped to project", async () => {
      const projectId = crypto.randomUUID();
      getNotesMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: "test-user" });
      await caller.note.list({ projectId });

      expect(getNotesMock).toHaveBeenCalledWith("test-user", 100, 0, projectId);
    });

    it("uses default limit and offset", async () => {
      getNotesMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: "test-user" });
      await caller.note.list({});

      expect(getNotesMock).toHaveBeenCalledWith("test-user", 100, 0, undefined);
    });

    it("validates limit bounds", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(caller.note.list({ limit: 0 })).rejects.toThrow();
      await expect(caller.note.list({ limit: 201 })).rejects.toThrow();
    });

    it("validates offset is non-negative", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(caller.note.list({ offset: -1 })).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.note.update({
          id: "123e4567-e89b-12d3-a456-426614174000",
          content: "Updated content",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("updates note with valid input", async () => {
      const noteId = "123e4567-e89b-12d3-a456-426614174000";
      updateNoteMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.note.update({
        id: noteId,
        title: "Updated Title",
        content: "Updated content",
        tags: ["updated"],
      });

      expect(result).toEqual({ updated: 1 });
      expect(updateNoteMock).toHaveBeenCalledWith(noteId, {
        title: "Updated Title",
        content: "Updated content",
        tags: ["updated"],
      });
      expect(ensureMirrorNodesMock).toHaveBeenCalledTimes(1);
      expect(ensureMirrorNodesMock).toHaveBeenCalledWith(
        "user",
        expect.arrayContaining([
          expect.objectContaining({
            kind: "note",
            id: noteId,
            label: "Updated Title",
          }),
        ])
      );
    });

    it("requires at least one field to update", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.note.update({
          id: "123e4567-e89b-12d3-a456-426614174000",
        })
      ).rejects.toThrow();
    });

    it("validates UUID format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.note.update({
          id: "invalid-uuid",
          content: "Updated",
        })
      ).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("rejects unauthenticated requests", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.note.delete({ id: "123e4567-e89b-12d3-a456-426614174000" })
      ).rejects.toThrow(TRPCError);
    });

    it("deletes note", async () => {
      const noteId = "123e4567-e89b-12d3-a456-426614174000";
      deleteNoteMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: "test-user" });
      const result = await caller.note.delete({ id: noteId });

      expect(result).toEqual({ deleted: 1 });
      expect(deleteNoteMock).toHaveBeenCalledWith(noteId);
    });

    it("validates UUID format", async () => {
      const caller = await createTestCaller({ userId: "test-user" });

      await expect(
        caller.note.delete({ id: "invalid-uuid" })
      ).rejects.toThrow();
    });
  });
});
