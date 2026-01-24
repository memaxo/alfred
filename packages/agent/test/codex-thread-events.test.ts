// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Install shared mocks
installLoggerMock();

// Use shared mock for assertions
const warnSpy = loggerMocks.warn;

import { parseThreadEvent } from "../src/orchestrator/tool/codex/definition";

describe("parseThreadEvent", () => {
  beforeEach(() => {
    loggerMocks.warn.mockClear();
  });

  it("parses direct thread.started events", () => {
    const payload = { type: "thread.started", thread_id: "thread_1" };

    const result = parseThreadEvent(payload);
    expect(result).toEqual(payload);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("unwraps nested event payloads", () => {
    const payload = { event: { type: "turn.started" } };

    const result = parseThreadEvent(payload);
    expect(result).toEqual({ type: "turn.started" });
  });

  it("normalizes aggregated output arrays for command executions", () => {
    const payload = {
      type: "item.completed",
      item: {
        id: "item_1",
        type: "command_execution" as const,
        command: "bash -lc ls",
        aggregated_output: ["line1", "line2"],
        status: "completed" as const,
      },
    };

    const result = parseThreadEvent(payload);
    expect(result).not.toBeNull();
    if (!result || result.type !== "item.completed") {
      throw new Error("expected item.completed event");
    }
    if (result.item.type !== "command_execution") {
      throw new Error("expected command_execution item");
    }
    expect(result.item.aggregated_output).toBe("line1\nline2");
  });

  it("logs and returns null when required fields are missing", () => {
    const result = parseThreadEvent({ type: "thread.started" });
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "codex_invalid_thread_event",
      expect.objectContaining({
        issues: expect.any(Array),
      })
    );
  });

  it("rejects unknown event types", () => {
    const result = parseThreadEvent({ type: "unknown.event" });
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});

afterAll(() => {
  mock.restore();
});
