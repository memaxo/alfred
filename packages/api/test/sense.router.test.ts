import type { Bundle, Capture, Receipt, WorkingSet } from "@alfred/type/sense";

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

import { metricsStub } from "./utils/mock-metrics";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

mock.module("@alfred/api/metrics", () => metricsStub);

const createCaptureMock = vi.fn();
const createBundleMock = vi.fn();
const getWorkingSetMock = vi.fn();
const upsertReceiptMock = vi.fn();
const listInboxMock = vi.fn();
const getInboxItemMock = vi.fn();
const getBundleByCaptureMock = vi.fn();
const getReceiptByCaptureMock = vi.fn();
const setWorkingSetMock = vi.fn();
const updateCaptureStatusMock = vi.fn();
const createNoteMock = vi.fn();
const createReminderMock = vi.fn();

mock.module("@alfred/db/repo/sense", () => ({
  createCapture: createCaptureMock,
  createBundle: createBundleMock,
  getWorkingSet: getWorkingSetMock,
  upsertReceipt: upsertReceiptMock,
  listInbox: listInboxMock,
  getInboxItem: getInboxItemMock,
  getBundleByCapture: getBundleByCaptureMock,
  getReceiptByCapture: getReceiptByCaptureMock,
  setWorkingSet: setWorkingSetMock,
  updateCaptureStatus: updateCaptureStatusMock,
}));

mock.module("@alfred/db/repo/assistant", () => ({
  createNote: createNoteMock,
  getNotes: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  createReminder: createReminderMock,
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
  ensureMirrorNodes: vi.fn().mockResolvedValue(new Map()),
}));

mock.module("@alfred/rag", () => ({
  ingest: vi.fn().mockResolvedValue(),
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

describe("sense routers", () => {
  beforeEach(() => {
    createCaptureMock.mockReset();
    createBundleMock.mockReset();
    getWorkingSetMock.mockReset();
    upsertReceiptMock.mockReset();
    listInboxMock.mockReset();
    getInboxItemMock.mockReset();
    getBundleByCaptureMock.mockReset();
    getReceiptByCaptureMock.mockReset();
    setWorkingSetMock.mockReset();
    updateCaptureStatusMock.mockReset();
    createNoteMock.mockReset();
    createReminderMock.mockReset();
  });

  it("rejects unauthenticated capture.create", async () => {
    const caller = await createUnauthedCaller();
    await expect(
      caller.capture.create({
        payload: { kind: "text", text: "hello" },
      } as never)
    ).rejects.toThrow(TRPCError);
  });

  it("creates capture and persists initial receipt", async () => {
    const capture: Capture = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "test-user",
      kind: "text",
      status: "new",
      evidence: { capturedAt: new Date("2025-01-01T00:00:00.000Z") },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const bundle: Bundle = {
      id: "223e4567-e89b-12d3-a456-426614174000",
      captureId: capture.id,
      text: "hello",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const receipt: Receipt = {
      id: "323e4567-e89b-12d3-a456-426614174000",
      captureId: capture.id,
      decision: "route",
      summary: "Suggested note as a durable capture.",
      evidence: [{ key: "payload.text", label: "Derived text available" }],
      outcome: { kind: "note" },
      alternatives: [{ kind: "reminder" }],
      confidence: 0.6,
      corrections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const workingSet: WorkingSet = {
      userId: "test-user",
      items: [],
      updatedAt: new Date(),
    };

    createCaptureMock.mockResolvedValue(capture);
    createBundleMock.mockResolvedValue(bundle);
    getWorkingSetMock.mockResolvedValue(workingSet);
    upsertReceiptMock.mockResolvedValue(receipt);

    const caller = await createTestCaller({ userId: "test-user" });
    const result = await caller.capture.create({
      payload: { kind: "text", text: "hello" },
      evidence: { capturedAt: "2025-01-01T00:00:00.000Z" },
    });

    expect(result.capture.id).toBe(capture.id);
    expect(result.bundle.id).toBe(bundle.id);
    expect(result.receipt.id).toBe(receipt.id);
    expect(upsertReceiptMock).toHaveBeenCalled();
  });

  it("lists inbox via inbox.list", async () => {
    listInboxMock.mockResolvedValue([]);
    const caller = await createTestCaller({ userId: "test-user" });
    const rows = await caller.inbox.list({});
    expect(rows).toEqual([]);
    expect(listInboxMock).toHaveBeenCalled();
  });

  it("supports working set set/get", async () => {
    setWorkingSetMock.mockResolvedValue({
      userId: "test-user",
      items: [{ kind: "project", id: "p1", label: "Project" }],
      focus: { kind: "project", id: "p1", label: "Project" },
      updatedAt: new Date(),
    });

    const caller = await createTestCaller({ userId: "test-user" });
    const ws = await caller.workingset.set({
      items: [{ kind: "project", id: "p1", label: "Project" }],
      focus: { kind: "project", id: "p1", label: "Project" },
    });

    expect(ws.items.length).toBe(1);
    expect(setWorkingSetMock).toHaveBeenCalled();
  });

  it("applies receipt correction", async () => {
    const bundle: Bundle = {
      id: "223e4567-e89b-12d3-a456-426614174000",
      captureId: "123e4567-e89b-12d3-a456-426614174000",
      text: "hello",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getBundleByCaptureMock.mockResolvedValue(bundle);
    getWorkingSetMock.mockResolvedValue({
      userId: "test-user",
      items: [],
      updatedAt: new Date(),
    });
    getReceiptByCaptureMock.mockResolvedValue(null);

    const receipt: Receipt = {
      id: "323e4567-e89b-12d3-a456-426614174000",
      captureId: bundle.captureId,
      decision: "route",
      summary: "x",
      evidence: [{ key: "payload.text", label: "Derived text available" }],
      outcome: { kind: "note" },
      alternatives: [{ kind: "reminder" }],
      confidence: 0.6,
      corrections: [
        {
          correctedAt: new Date(),
          outcome: { kind: "note" },
          note: "keep as note",
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    upsertReceiptMock.mockResolvedValue(receipt);
    getInboxItemMock.mockResolvedValue({
      capture: {
        id: bundle.captureId,
        userId: "test-user",
        kind: "text",
        status: "new",
        evidence: { capturedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      bundle,
      receipt,
    });

    const caller = await createTestCaller({ userId: "test-user" });
    const result = await caller.receipt.correct({
      captureId: bundle.captureId,
      outcome: { kind: "note" },
      note: "keep as note",
    });

    expect(result.id).toBe(receipt.id);
    expect(upsertReceiptMock).toHaveBeenCalled();
  });

  it("triages capture to note and updates receipt", async () => {
    const captureId = "123e4567-e89b-12d3-a456-426614174000";
    const userId = "test-user";

    const initialBundle: Bundle = {
      id: "223e4567-e89b-12d3-a456-426614174000",
      captureId,
      text: "hello",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const initialReceipt: Receipt = {
      id: "323e4567-e89b-12d3-a456-426614174000",
      captureId,
      decision: "route",
      summary: "Suggested note as a durable capture.",
      evidence: [{ key: "payload.text", label: "Derived text available" }],
      outcome: { kind: "note" },
      alternatives: [{ kind: "reminder" }],
      confidence: 0.6,
      corrections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getInboxItemMock
      .mockResolvedValueOnce({
        bundle: initialBundle,
        capture: {
          id: captureId,
          userId,
          kind: "text",
          status: "new",
          evidence: { capturedAt: new Date() },
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Capture,
        receipt: initialReceipt,
      })
      .mockResolvedValueOnce({
        bundle: initialBundle,
        capture: {
          id: captureId,
          userId,
          kind: "text",
          status: "converted",
          evidence: { capturedAt: new Date() },
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Capture,
        receipt: {
          ...initialReceipt,
          outcome: { kind: "note", targetId: "note-1" },
        } satisfies Receipt,
      });

    createNoteMock.mockResolvedValue({
      id: "note-1",
      title: "Note title",
      content: "hello",
      userId,
      created: new Date(),
      updated: new Date(),
    });

    upsertReceiptMock.mockResolvedValue(initialReceipt);

    const caller = await createTestCaller({ userId });
    const result = await caller.capture.triage({
      captureId,
      destination: "note",
    });

    expect(createNoteMock).toHaveBeenCalledWith(
      userId,
      "hello",
      undefined,
      undefined,
      undefined
    );
    expect(updateCaptureStatusMock).toHaveBeenCalledWith({
      id: captureId,
      status: "converted",
      userId,
    });
    expect(result).toEqual({ id: "note-1", kind: "note" });
  });
});
