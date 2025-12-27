import { afterAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
// Install shared logger mock first
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";
import type { WorkflowEvent } from "@alfred/type";

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
  wrapEventEnvelope: vi.fn((data: unknown) => ({
    wrapped: true,
    ...(data as object),
  })),
  unwrapEventEnvelope: vi.fn((data: unknown) => data),
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

const { persistWorkflowEvent, persistEventSafe } = await import(
  "../../src/workflow/event-persistence"
);

afterAll(() => {
  mock.restore();
});

describe("event-persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowRepoMock.appendEvent.mockResolvedValue(undefined);
    normalizeMock.eventToUiMessages.mockReturnValue(null);
  });

  describe("persistWorkflowEvent", () => {
    it("persists event with redaction and envelope wrapping", async () => {
      const event: WorkflowEvent = {
        type: "progress",
        pct: 10,
        message: "starting",
      } as any;

      const result = await persistWorkflowEvent("run-123", event);

      expect(redactionMock.redactEventData).toHaveBeenCalledWith(event);
      expect(eventIdMock.makeEventId).toHaveBeenCalledWith({
        runId: "run-123",
        type: "progress",
        data: expect.objectContaining({ redacted: true }),
      });
      expect(envelopeMock.wrapEventEnvelope).toHaveBeenCalledWith({
        id: "progress-generated-id",
        type: "progress",
        resource: "user",
        data: expect.objectContaining({ redacted: true }),
      });
      expect(workflowRepoMock.appendEvent).toHaveBeenCalledWith({
        runId: "run-123",
        eventId: "progress-generated-id",
        eventType: "progress",
        eventData: expect.objectContaining({ wrapped: true }),
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
          role: "assistant",
          parts: [{ type: "text", text: "Hi" }],
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
        runId: "run-123",
        eventType: "ui-message",
      });
    });

    it("generates separate eventId for UI messages", async () => {
      const uiMessages = [{ id: "msg-1", role: "assistant", parts: [] }];
      normalizeMock.eventToUiMessages.mockReturnValue(uiMessages);
      const event = { type: "assistant" } as WorkflowEvent;

      await persistWorkflowEvent("run-123", event);

      // makeEventId should be called twice: once for main event, once for ui-message
      expect(eventIdMock.makeEventId).toHaveBeenCalledTimes(2);
      expect(eventIdMock.makeEventId).toHaveBeenCalledWith({
        runId: "run-123",
        type: "ui-message",
        data: uiMessages,
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
          runId: "run-123",
          eventType: "progress",
          error: "db_error",
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
