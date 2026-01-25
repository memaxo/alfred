import type { ThreadItem } from "@alfred/protocol";

import { parseThreadEvent } from "@alfred/protocol";
import { describe, expect, it } from "bun:test";

import { mockThreadEvents, mockThreadItems } from "./test-harness";

// Test the event normalization and ACP integration directly
// without mocking the full tRPC subscription

describe("Codex stream client event normalization", () => {
  describe("parseThreadEvent integration", () => {
    it("parses turn.started events", () => {
      const event = parseThreadEvent(mockThreadEvents.turnStarted);
      expect(event).not.toBeNull();
      expect(event?.type).toBe("turn.started");
    });

    it("parses turn.completed events with usage", () => {
      const event = parseThreadEvent(mockThreadEvents.turnCompleted);
      expect(event).not.toBeNull();
      expect(event?.type).toBe("turn.completed");
      if (event?.type === "turn.completed") {
        expect(event.usage.input_tokens).toBe(100);
        expect(event.usage.output_tokens).toBe(200);
      }
    });

    it("parses item.started events", () => {
      const event = parseThreadEvent(
        mockThreadEvents.itemStarted(mockThreadItems.reasoning)
      );
      expect(event).not.toBeNull();
      expect(event?.type).toBe("item.started");
    });

    it("parses item.updated events", () => {
      const event = parseThreadEvent(
        mockThreadEvents.itemUpdated(mockThreadItems.commandInProgress)
      );
      expect(event).not.toBeNull();
      expect(event?.type).toBe("item.updated");
    });

    it("parses item.completed events", () => {
      const event = parseThreadEvent(
        mockThreadEvents.itemCompleted(mockThreadItems.commandCompleted)
      );
      expect(event).not.toBeNull();
      expect(event?.type).toBe("item.completed");
    });

    it("returns null for invalid events", () => {
      const event = parseThreadEvent({ type: "invalid_event" });
      expect(event).toBeNull();
    });

    it("unwraps wrapped events", () => {
      const event = parseThreadEvent({
        event: mockThreadEvents.turnStarted,
      });
      expect(event).not.toBeNull();
      expect(event?.type).toBe("turn.started");
    });
  });

  describe("thread item extraction", () => {
    it("extracts item from item.started event", () => {
      const event = parseThreadEvent(
        mockThreadEvents.itemStarted(mockThreadItems.reasoning)
      );
      expect(event?.type).toBe("item.started");
      if (event?.type === "item.started") {
        expect(event.item.type).toBe("reasoning");
        expect(event.item.id).toBe(mockThreadItems.reasoning.id);
      }
    });

    it("extracts item from item.completed event", () => {
      const event = parseThreadEvent(
        mockThreadEvents.itemCompleted(mockThreadItems.commandCompleted)
      );
      expect(event?.type).toBe("item.completed");
      if (event?.type === "item.completed") {
        expect(event.item.type).toBe("command_execution");
      }
    });
  });

  describe("all thread item types via protocol", () => {
    const itemTypes: { name: string; item: ThreadItem }[] = [
      { name: "reasoning", item: mockThreadItems.reasoning },
      { name: "agent_message", item: mockThreadItems.agentMessage },
      { name: "command_execution", item: mockThreadItems.commandCompleted },
      { name: "file_change", item: mockThreadItems.fileChange },
      { name: "mcp_tool_call", item: mockThreadItems.mcpToolCall },
      { name: "web_search", item: mockThreadItems.webSearch },
      { name: "todo_list", item: mockThreadItems.todoList },
      { name: "error", item: mockThreadItems.error },
    ];

    for (const { name, item } of itemTypes) {
      it(`parses ${name} items correctly`, () => {
        const event = parseThreadEvent(mockThreadEvents.itemCompleted(item));
        expect(event).not.toBeNull();
        expect(event?.type).toBe("item.completed");
        if (event?.type === "item.completed") {
          expect(event.item.type).toBe(name);
        }
      });
    }
  });

  describe("thread event types", () => {
    it("parses thread.started", () => {
      const event = parseThreadEvent(mockThreadEvents.threadStarted);
      expect(event?.type).toBe("thread.started");
      if (event?.type === "thread.started") {
        expect(event.thread_id).toBe("thread-123");
      }
    });

    it("parses turn.failed", () => {
      const event = parseThreadEvent(mockThreadEvents.turnFailed);
      expect(event?.type).toBe("turn.failed");
      if (event?.type === "turn.failed") {
        expect(event.error.message).toBe("Model error");
      }
    });

    it("parses error events", () => {
      const event = parseThreadEvent(mockThreadEvents.error);
      expect(event?.type).toBe("error");
      if (event?.type === "error") {
        expect(event.message).toBe("Stream error occurred");
      }
    });
  });
});
