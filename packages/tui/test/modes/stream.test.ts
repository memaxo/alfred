import { describe, expect, test } from "bun:test";
import {
  createStreamActions,
  createStreamState,
  renderToolCalls,
} from "../../src/tui/components/stream";

describe("Stream Component", () => {
  describe("StreamState", () => {
    test("creates initial state", () => {
      const state = createStreamState();
      expect(state.chunks).toEqual([]);
      expect(state.currentText).toBe("");
      expect(state.activeToolCalls.size).toBe(0);
      expect(state.isStreaming).toBe(false);
      expect(state.error).toBeUndefined();
    });

    test("handles text chunks", () => {
      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.addChunk({ type: "text", content: "Hello" });
      expect(state.currentText).toBe("Hello");

      actions.addChunk({ type: "text", content: " World" });
      expect(state.currentText).toBe("Hello World");
    });

    test("handles tool call start", () => {
      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.addChunk({
        type: "tool-call-start",
        toolCallId: "call_123",
        toolName: "search",
      });

      expect(state.activeToolCalls.size).toBe(1);
      expect(state.activeToolCalls.get("call_123")).toEqual({
        name: "search",
        status: "pending",
      });
    });

    test("handles tool call result", () => {
      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.addChunk({
        type: "tool-call-start",
        toolCallId: "call_123",
        toolName: "search",
      });

      actions.addChunk({
        type: "tool-call-result",
        toolCallId: "call_123",
        isError: false,
      });

      expect(state.activeToolCalls.get("call_123")?.status).toBe("complete");
    });

    test("handles error chunks", () => {
      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.setStreaming(true);
      actions.addChunk({ type: "error", content: "Something went wrong" });

      expect(state.error).toBe("Something went wrong");
      expect(state.isStreaming).toBe(false);
    });

    test("handles done chunks", () => {
      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.setStreaming(true);
      actions.addChunk({ type: "done" });

      expect(state.isStreaming).toBe(false);
    });

    test("resets state", () => {
      let state = createStreamState();
      const actions = createStreamActions(
        () => state,
        (s) => {
          state = s;
        }
      );

      actions.addChunk({ type: "text", content: "Hello" });
      actions.setStreaming(true);

      actions.reset();

      expect(state.currentText).toBe("");
      expect(state.isStreaming).toBe(false);
      expect(state.chunks).toEqual([]);
    });
  });

  describe("Tool Call Rendering", () => {
    test("renders pending tool call", () => {
      const toolCalls = new Map([
        ["call_1", { name: "search", status: "pending" as const }],
      ]);

      const lines = renderToolCalls(toolCalls);
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("search");
      expect(lines[0]).toContain("Calling");
    });

    test("renders complete tool call", () => {
      const toolCalls = new Map([
        ["call_1", { name: "search", status: "complete" as const }],
      ]);

      const lines = renderToolCalls(toolCalls);
      expect(lines[0]).toContain("Done");
    });

    test("renders error tool call", () => {
      const toolCalls = new Map([
        ["call_1", { name: "search", status: "error" as const }],
      ]);

      const lines = renderToolCalls(toolCalls);
      expect(lines[0]).toContain("Failed");
    });

    test("renders multiple tool calls", () => {
      const toolCalls = new Map([
        ["call_1", { name: "search", status: "complete" as const }],
        ["call_2", { name: "write", status: "pending" as const }],
      ]);

      const lines = renderToolCalls(toolCalls);
      expect(lines.length).toBe(2);
    });
  });
});
