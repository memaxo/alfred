import type { WorkflowEvent } from "@alfred/type";

// Install shared logger mock first
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

import {
  installWorkflowRepoMock,
  workflowRepoMocks,
} from "./workflow-repo.mock";

installLoggerMock();

const envelopeMock = {
  unwrapEventEnvelope: vi.fn((data: unknown) => data),
  wrapEventEnvelope: vi.fn((data: unknown) => ({
    wrapped: true,
    ...(data as object),
  })),
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

installWorkflowRepoMock();
mock.module("../../src/utils/envelope", () => envelopeMock);
mock.module("../../src/utils/normalize", () => normalizeMock);
mock.module("../../src/utils/redaction", () => redactionMock);

const { persistWorkflowEvent, persistEventSafe } =
  await import("../../src/workflow/event-persistence");

describe("event-persistence", () => {
  beforeEach(() => {
    installWorkflowRepoMock();
    workflowRepoMocks.appendEvent.mockReset().mockResolvedValue();
    loggerMocks.warn.mockClear();
    envelopeMock.unwrapEventEnvelope.mockClear();
    envelopeMock.wrapEventEnvelope.mockClear();
    normalizeMock.eventToUiMessages.mockReset().mockReturnValue(null);
    redactionMock.redactEventData.mockClear();
  });

  describe("persistWorkflowEvent", () => {
    it("persists event with redaction and envelope wrapping", async () => {
      // WorkflowEvent uses `_` as the discriminant field
      const event = {
        _: "progress",
        message: "starting",
        pct: 10,
      } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(redactionMock.redactEventData).toHaveBeenCalledWith(event);
      expect(envelopeMock.wrapEventEnvelope).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ redacted: true }),
          type: "progress",
          resource: "user",
        })
      );
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "progress",
          runId: "run-123",
        })
      );
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
        workflowRepoMocks.appendEvent.mockReset().mockResolvedValue();
        loggerMocks.warn.mockClear();
        envelopeMock.unwrapEventEnvelope.mockClear();
        envelopeMock.wrapEventEnvelope.mockClear();
        normalizeMock.eventToUiMessages.mockReset().mockReturnValue(null);
        redactionMock.redactEventData.mockClear();
        const event = { _: type } as WorkflowEvent;
        const result = await persistWorkflowEvent("run-123", event);
        expect(result.eventType).toBe(type);
      }
    });

    it("maps unknown event types to 'error'", async () => {
      // Implementation defaults unknown types to "error"
      const event = { _: "custom-unknown-type" } as unknown as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.eventType).toBe("error");
    });

    it("returns null uiMessages when eventToUiMessages returns null", async () => {
      normalizeMock.eventToUiMessages.mockReturnValue(null);
      const event = { _: "progress" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.uiMessages).toBeNull();
      // Should only call appendEvent once (for the main event)
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledTimes(1);
    });

    it("returns null uiMessages when eventToUiMessages returns empty array", async () => {
      normalizeMock.eventToUiMessages.mockReturnValue([]);
      const event = { _: "progress" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.uiMessages).toBeNull();
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledTimes(1);
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
      const event = { _: "assistant" } as WorkflowEvent;

      const result = await persistWorkflowEvent("run-123", event);

      expect(result.uiMessages).toEqual(uiMessages);
      // Should call appendEvent twice (main event + ui-message event)
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledTimes(2);

      const secondCall = workflowRepoMocks.appendEvent.mock.calls[1];
      expect(secondCall[0]).toMatchObject({
        eventType: "ui-message",
        runId: "run-123",
      });
    });

    it("generates separate eventId for UI messages", async () => {
      const uiMessages = [{ id: "msg-1", parts: [], role: "assistant" }];
      normalizeMock.eventToUiMessages.mockReturnValue(uiMessages);
      const event = { _: "assistant" } as WorkflowEvent;

      await persistWorkflowEvent("run-123", event);

      // appendEvent should be called twice: once for main event, once for ui-message
      expect(workflowRepoMocks.appendEvent).toHaveBeenCalledTimes(2);
      const uiCall = workflowRepoMocks.appendEvent.mock.calls[1];
      expect(uiCall[0].eventType).toBe("ui-message");
    });
  });

  describe("persistEventSafe", () => {
    it("returns result on success", async () => {
      const event = { _: "progress" } as WorkflowEvent;

      const result = await persistEventSafe("run-123", event);

      expect(result).not.toBeNull();
      expect(result?.eventType).toBe("progress");
    });

    it("returns null and logs warning on error", async () => {
      workflowRepoMocks.appendEvent.mockRejectedValue(new Error("db_error"));
      const event = { _: "progress" } as WorkflowEvent;

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
      workflowRepoMocks.appendEvent.mockRejectedValue(new Error("db_error"));
      const event = { _: "progress" } as WorkflowEvent;

      await expect(persistEventSafe("run-123", event)).resolves.toBeNull();
    });

    it("logs correct eventType for unknown types", async () => {
      workflowRepoMocks.appendEvent.mockRejectedValue(new Error("db_error"));
      const event = { _: "custom-type" } as unknown as WorkflowEvent;

      await persistEventSafe("run-123", event);

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "workflow_event_persistence_failed",
        expect.objectContaining({
          eventType: "error",
        })
      );
    });
  });
});
