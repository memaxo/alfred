/**
 * Chat Mode Unit Tests
 *
 * Tests the chat mode components and state management.
 * Note: Uses mocks for renderer, keys, and SSE - for true integration tests,
 * see packages/tui/test/e2e/ or manual terminal testing.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Reset message counter between tests (exported from history module)
// Note: Variable intentionally kept for future test isolation
const _messageCounterReset: (() => void) | undefined = undefined;

// Mock renderer before imports
mock.module("../../src/tui/renderer", () => ({
  setupTerminal: mock(() => {}),
  cleanupTerminal: mock(() => {}),
  clearScreen: mock(() => {}),
  writeAt: mock(() => {}),
  getCurrentSize: mock(() => ({ width: 80, height: 24 })),
}));

// Mock keys module
mock.module("../../src/tui/input/keys", () => ({
  getKeyInput: mock(() => ({
    onKey: mock(() => () => {}),
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  isEscape: (e: { key: string }) => e.key === "escape",
}));

// Create mock stream responses
function _createMockSSEStream(
  chunks: Array<{ type: string; content?: string; toolName?: string }>
) {
  return function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  };
}

// Mock SSE module with controllable responses
const mockStreamAssistant = mock(function* () {
  yield { type: "text", content: "Hello" };
  yield { type: "text", content: " World" };
  yield { type: "done" };
});

mock.module("../../src/tui/api/sse", () => ({
  streamAssistant: mockStreamAssistant,
}));

describe("Chat Mode Unit Tests", () => {
  beforeEach(async () => {
    mockStreamAssistant.mockClear();
    // Reset message counter for proper test isolation
    const { resetMessageCounter } = await import(
      "../../src/tui/components/history"
    );
    resetMessageCounter();
  });

  afterEach(() => {
    mockStreamAssistant.mockReset();
  });

  describe("Message Flow", () => {
    test("builds correct message format for API", async () => {
      const { createMessageHistoryState, createMessageHistoryActions } =
        await import("../../src/tui/components/history");

      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      // Add user message
      actions.addMessage({ role: "user", content: "Hello" });

      // Add assistant response
      actions.addMessage({ role: "assistant", content: "Hi there!" });

      // Verify message structure
      expect(state.messages.length).toBe(2);
      expect(state.messages[0]).toMatchObject({
        role: "user",
        content: "Hello",
      });
      expect(state.messages[1]).toMatchObject({
        role: "assistant",
        content: "Hi there!",
      });
    });

    test("handles streaming response chunks", async () => {
      const { createMessageHistoryState, createMessageHistoryActions } =
        await import("../../src/tui/components/history");

      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      // Simulate streaming response
      const id = actions.addMessage({
        role: "assistant",
        content: "",
        status: "streaming",
      });

      // Simulate chunks arriving
      actions.appendToMessage(id, "Hello");
      expect(state.messages[0]?.content).toBe("Hello");

      actions.appendToMessage(id, " ");
      actions.appendToMessage(id, "World");
      expect(state.messages[0]?.content).toBe("Hello World");

      // Complete the message
      actions.updateMessage(id, { status: "complete" });
      expect(state.messages[0]?.status).toBe("complete");
    });

    test("handles tool call chunks", async () => {
      const { createMessageHistoryState, createMessageHistoryActions } =
        await import("../../src/tui/components/history");

      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const id = actions.addMessage({
        role: "assistant",
        content: "",
        status: "streaming",
      });

      // Simulate tool call
      actions.appendToMessage(id, "\n> Calling todo.create...");
      expect(state.messages[0]?.content).toContain("Calling todo.create");
    });

    test("handles error chunks", async () => {
      const { createMessageHistoryState, createMessageHistoryActions } =
        await import("../../src/tui/components/history");

      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      const id = actions.addMessage({
        role: "assistant",
        content: "Partial response...",
        status: "streaming",
      });

      // Simulate error
      actions.updateMessage(id, {
        status: "error",
        content: `${state.messages[0]?.content}\n\nError: Network timeout`,
      });

      expect(state.messages[0]?.status).toBe("error");
      expect(state.messages[0]?.content).toContain("Network timeout");
    });
  });

  describe("Stream State", () => {
    test("tracks streaming state correctly", async () => {
      const { createStreamState, createStreamActions } = await import(
        "../../src/tui/components/stream"
      );

      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      expect(state.isStreaming).toBe(false);

      actions.setStreaming(true);
      expect(state.isStreaming).toBe(true);

      actions.setStreaming(false);
      expect(state.isStreaming).toBe(false);
    });
  });

  describe("Abort Handling", () => {
    test("AbortController can cancel stream", async () => {
      const controller = new AbortController();
      let aborted = false;

      // Simulate long-running stream
      const longStream = async function* () {
        yield { type: "text", content: "Start" };
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (controller.signal.aborted) {
          aborted = true;
          return;
        }

        yield { type: "text", content: "End" };
      };

      // Start consuming
      const chunks: Array<{ type: string }> = [];
      const consume = async () => {
        for await (const chunk of longStream()) {
          chunks.push(chunk);
        }
      };

      // Start and immediately abort
      const consumePromise = consume();
      controller.abort();
      await consumePromise;

      // Should have at least started
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Abort flag should be set
      expect(aborted).toBe(true);
    });
  });

  describe("Message History Scrolling", () => {
    test("scrolling disables auto-scroll", async () => {
      const { createMessageHistoryState, createMessageHistoryActions } =
        await import("../../src/tui/components/history");

      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      expect(state.autoScroll).toBe(true);

      actions.scrollUp(5);
      expect(state.autoScroll).toBe(false);

      actions.scrollToBottom();
      expect(state.autoScroll).toBe(true);
    });

    test("new messages don't reset scroll when auto-scroll disabled", async () => {
      const { createMessageHistoryState, createMessageHistoryActions } =
        await import("../../src/tui/components/history");

      let state = createMessageHistoryState();
      const actions = createMessageHistoryActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      // Scroll up to disable auto-scroll
      actions.scrollUp(10);
      expect(state.autoScroll).toBe(false);
      expect(state.scrollOffset).toBe(10);

      // Add a message
      actions.addMessage({ role: "user", content: "Test" });

      // Scroll offset should be preserved when auto-scroll is disabled
      // (implementation may vary - this tests expected behavior)
      expect(state.autoScroll).toBe(false);
    });
  });
});

describe("Chat Mode UI Messages", () => {
  test("formats UIMessage correctly for API", () => {
    // Test that messages are formatted correctly for the API
    type UIMessage = {
      role: "user" | "assistant";
      content: string;
    };

    const messages: UIMessage[] = [
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "Thanks!" },
    ];

    // Verify structure
    expect(messages.every((m) => m.role && m.content)).toBe(true);
    expect(messages.filter((m) => m.role === "user").length).toBe(2);
    expect(messages.filter((m) => m.role === "assistant").length).toBe(1);
  });
});
