import "@/test/reset-mocks";
import "@/test/dom";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { UIMessage } from "@alfred/type/stream";
import { useWorkflowSseStream } from "../use-workflow-sse-stream";

const realFetch = global.fetch;
const encoder = new TextEncoder();

describe("useWorkflowSseStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = realFetch;
    if (typeof window !== "undefined") {
      window.fetch = realFetch as typeof window.fetch;
    }
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (typeof window !== "undefined") {
      window.fetch = realFetch as typeof window.fetch;
    }
  });

  it("streams workflow events and ui messages", async () => {
    const chunks = [
      ": connected\n\n",
      'event: workflow-event\ndata: {"type":"run","eventId":"evt-1"}\n\n',
      'event: ui-message\ndata: {"messages":[{"id":"m1","role":"assistant","parts":[{"type":"text","text":"Hi"}]}],"meta":{"runId":"run-1","eventId":"evt-1","eventType":"run"}}\n\n',
      "event: complete\ndata: {}\n\n",
    ].map((chunk) => encoder.encode(chunk));
    const reader = createMockReader(chunks);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => reader,
      },
    });
    global.fetch = fetchMock as typeof fetch;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock as typeof window.fetch;
    }

    const workflowSpy = vi.fn();
    const uiSpy = vi.fn();

    const streamInput = {
      requirement: "Test",
      authz: "Bearer token",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const { result } = renderHook(() =>
      useWorkflowSseStream({
        input: streamInput,
        onWorkflowEvent: workflowSpy,
        onUiMessages: uiSpy,
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(workflowSpy).toHaveBeenCalled();
    });

    expect(workflowSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "run", eventId: "evt-1" })
    );
    expect(uiSpy).toHaveBeenCalledWith(
      expect.arrayContaining<UIMessage>([
        expect.objectContaining({ id: "m1" }),
      ]),
      expect.objectContaining({ runId: "run-1" })
    );
  });

  it("reports HTTP errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    });
    global.fetch = fetchMock as typeof fetch;
    if (typeof window !== "undefined") {
      window.fetch = fetchMock as typeof window.fetch;
    }
    const errorSpy = vi.fn();

    const errorInput = {
      requirement: "Broken",
      authz: "Bearer token",
      auto: "low" as const,
      mode: "sequential" as const,
    };

    const { result } = renderHook(() =>
      useWorkflowSseStream({
        input: errorInput,
        onError: errorSpy,
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

function createMockReader(chunks: Uint8Array[]) {
  const queue = [...chunks];
  return {
    async read() {
      if (queue.length === 0) {
        return { done: true, value: undefined };
      }
      const value = queue.shift()!;
      return { done: false, value };
    },
    cancel: () => {},
    releaseLock: () => {},
  } as ReadableStreamDefaultReader<Uint8Array>;
}
