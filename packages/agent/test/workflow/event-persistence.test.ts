import type { WorkflowEvent } from "@alfred/type";

// Install shared logger mock first
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";
import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";

installLoggerMock();

// Create mocks with default exports pattern for better mock isolation
const workflowRepoMock = {
  appendEvent: vi.fn(),
  // Include other exports that might be expected
  getRun: vi.fn(),
  createRun: vi.fn(),
  updateRun: vi.fn(),
  listEvents: vi.fn(),
};

const envelopeMock = {
  unwrapEventEnvelope: vi.fn((data: unknown) => data),
  wrapEventEnvelope: vi.fn((data: unknown) => ({
    wrapped: true,
    ...(data as object),
  })),
};

const eventIdMock = {
  makeEventId: vi.fn(({ type }: { type: string }) => `${type}-generated-id`),
};

const normalizeMock = {
  eventToUiMessages: vi.fn(),
};

const redactionMock = {
  redactEventData: vi.fn((event: WorkflowEvent) => ({
    ...event,
    redacted: true,
  })),
};

// Register all mocks before importing the module under test
mock.module("@alfred/db/repo/workflow", () => workflowRepoMock);
mock.module("../../src/utils/envelope", () => envelopeMock);
mock.module("../../src/utils/event-id", () => eventIdMock);
mock.module("../../src/utils/normalize", () => normalizeMock);
mock.module("../../src/utils/redaction", () => redactionMock);

const { persistWorkflowEvent, persistEventSafe } =
  await import("../../src/workflow/event-persistence");

afterAll(() => {
  mock.restore();
});

describe("event-persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowRepoMock.appendEvent.mockResolvedValue();
    normalizeMock.eventToUiMessages.mockReturnValue(null);
  });

  describe("persistWorkflowEvent", () => {
    it("persists event with redaction and envelope wrapping", async () => {
      const event: WorkflowEvent = {
        message: "starting",
        pct: 10,
        type: "progress",
      } as any;

      const result = await persistWorkflowEvent("run-123", event);

      expect(redactionMock.redactEventData).toHaveBeenCalledWith(event);
      expect(eventIdMock.makeEventId).toHaveBeenCalledWith({
        data: expect.objectContaining({ redacted: true }),
        runId: "run-123",
        type: "progress",
      });
      expect(envelopeMock.wrapEventEnvelope).toHaveBeenCalledWith({
        data: expect.objectContaining({ redacted: true }),
        id: "progress-generated-id",
        resource: "user",
        type: "progress",
      });
      expect(workflowRepoMock.appendEvent).toHaveBeenCalledWith({
        eventData: expect.objectContaining({ wrapped: true }),
        eventId: "progress-generated-id",
        eventType: "progress",
        runId: "run-123",
      });
      expect(result.eventId).toBe("progress-generated-id");
      expect(result.eventType).toBe("progress");
    });

    it("maps valid event types correctly", async () => {
      const validTypes = [
        "run",
        "progress",
        "context",
        "require-scope",
        "notice",
        "error",
        "stdout",
        "stderr",
        "droid",
        "data-cache-handoff",
      ];

      for (const type of validTypes) {
        vi.clearAllMocks();
        const event = { type } as WorkflowEvent;
        const result = await persistWorkflowEvent("run-123", event);
        expect(result.eventType).toBe(type);
      }
    });

    it("maps unknown event types to 'event'", async () => {
      const event = { type: "custom-unknown-type" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.eventType).toBe("event");
      expect(eventIdMock.makeEventId).toHaveBeenCalledWith(
        expect.objectContaining({ type: "event" })
      );
    });

    it("returns null uiMessages when eventToUiMessages returns null", async () => {
      normalizeMock.eventToUiMessages.mockReturnValue(null);
      const event = { type: "progress" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.uiMessages).toBeNull();
      // Should only call appendEvent once (for the main event)
      expect(workflowRepoMock.appendEvent).toHaveBeenCalledTimes(1);
    });

    it("returns null uiMessages when eventToUiMessages returns empty array", async () => {
      normalizeMock.eventToUiMessages.mockReturnValue([]);
      const event = { type: "progress" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.uiMessages).toBeNull();
      expect(workflowRepoMock.appendEvent).toHaveBeenCalledTimes(1);
    });

    it("persists UI messages when available", async () => {
      const uiMessages = [
        {
          id: "msg-1",
          parts: [{ type: "text", text: "Hi" }],
          role: "assistant",
        },
      ];
      normalizeMock.eventToUiMessages.mockReturnValue(uiMessages);
      const event = { type: "assistant" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.uiMessages).toEqual(uiMessages);
      // Should call appendEvent twice (main event + ui-message event)
      expect(workflowRepoMock.appendEvent).toHaveBeenCalledTimes(2);

      const secondCall = workflowRepoMock.appendEvent.mock.calls[1];
      expect(secondCall[0]).toMatchObject({
        eventType: "ui-message",
        runId: "run-123",
      });
    });

    it("generates separate eventId for UI messages", async () => {
      const uiMessages = [{ id: "msg-1", parts: [], role: "assistant" }];
      normalizeMock.eventToUiMessages.mockReturnValue(uiMessages);
      const event = { type: "assistant" } as WorkflowEvent;

      await persistWorkflowEvent("run-123", event);

      // makeEventId should be called twice: once for main event, once for ui-message
      expect(eventIdMock.makeEventId).toHaveBeenCalledTimes(2);
      expect(eventIdMock.makeEventId).toHaveBeenCalledWith({
        data: uiMessages,
        runId: "run-123",
        type: "ui-message",
      });
    });
  });

  describe("persistEventSafe", () => {
    it("returns result on success", async () => {
      const event = { type: "progress" } as WorkflowEvent;

      const result = await persistEventSafe("run-123", event);

      expect(result).not.toBeNull();
      expect(result?.eventId).toBe("progress-generated-id");
    });

    it("returns null and logs warning on error", async () => {
      workflowRepoMock.appendEvent.mockRejectedValue(new Error("db_error"));
      const event = { type: "progress" } as WorkflowEvent;

      const result = await persistEventSafe("run-123", event);

      expect(result).toBeNull();
      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "workflow_event_persistence_failed",
        expect.objectContaining({
          error: "db_error",
          eventType: "progress",
          runId: "run-123",
        })
      );
    });

    it("does not throw on error", async () => {
      workflowRepoMock.appendEvent.mockRejectedValue(new Error("db_error"));
      const event = { type: "progress" } as WorkflowEvent;

      await expect(persistEventSafe("run-123", event)).resolves.toBeNull();
    });

    it("logs correct eventType for unknown types", async () => {
      workflowRepoMock.appendEvent.mockRejectedValue(new Error("db_error"));
      const event = { type: "custom-type" } as WorkflowEvent;

      await persistEventSafe("run-123", event);

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "workflow_event_persistence_failed",
        expect.objectContaining({
          eventType: "event",
        })
      );
    });
  });
});
