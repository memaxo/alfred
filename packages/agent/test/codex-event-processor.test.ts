import type { ThreadEvent } from "@alfred/codex";

import { describe, expect, it } from "bun:test";

import {
  type EventProcessorContext,
  formatArtifactReasoning,
  processThreadEvent,
} from "../src/orchestrator/tool/codex/event-processor";
import { createReasoningAccumulator } from "../src/orchestrator/tool/shared/reasoning";

function createContext(outputDebug = false): EventProcessorContext {
  return {
    outputDebug,
    reasoningAccumulator: createReasoningAccumulator(),
  };
}

describe("processThreadEvent", () => {
  describe("thread.started", () => {
    it("extracts thread ID", () => {
      const event: ThreadEvent = {
        type: "thread.started",
        thread_id: "thread-abc-123",
      };
      const result = processThreadEvent(event, createContext());
      expect(result.threadId).toBe("thread-abc-123");
      expect(result.alfredEvents).toEqual([]);
    });

    it("ignores empty thread ID", () => {
      const event = {
        type: "thread.started",
        thread_id: "",
      } as ThreadEvent;
      const result = processThreadEvent(event, createContext());
      expect(result.threadId).toBeUndefined();
    });
  });

  describe("turn.started", () => {
    it("sets turnStarted flag", () => {
      const event: ThreadEvent = { type: "turn.started" };
      const result = processThreadEvent(event, createContext());
      expect(result.turnStarted).toBe(true);
      expect(result.alfredEvents).toEqual([]);
    });
  });

  describe("turn.completed", () => {
    it("sets turnCompleted flag and extracts token usage", () => {
      const event: ThreadEvent = {
        type: "turn.completed",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cached_input_tokens: 25,
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.turnCompleted).toBe(true);
      expect(result.tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cachedInputTokens: 25,
      });
    });

    it("handles missing usage", () => {
      const event = { type: "turn.completed" } as ThreadEvent;
      const result = processThreadEvent(event, createContext());
      expect(result.turnCompleted).toBe(true);
      expect(result.tokenUsage).toBeUndefined();
    });
  });

  describe("turn.failed", () => {
    it("extracts error details", () => {
      const event: ThreadEvent = {
        type: "turn.failed",
        error: { message: "Rate limit exceeded" },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.error).toEqual({
        message: "Rate limit exceeded",
        stage: "turn.failed",
      });
    });

    it("provides default message when missing", () => {
      const event = {
        type: "turn.failed",
        error: {},
      } as unknown as ThreadEvent;
      const result = processThreadEvent(event, createContext());
      expect(result.error?.message).toBe("codex_turn_failed");
    });
  });

  describe("error", () => {
    it("extracts stream error", () => {
      const event: ThreadEvent = { type: "error", message: "Connection lost" };
      const result = processThreadEvent(event, createContext());
      expect(result.error).toEqual({
        message: "Connection lost",
        stage: "stream.error",
      });
    });

    it("provides default message when missing", () => {
      const event = { type: "error" } as unknown as ThreadEvent;
      const result = processThreadEvent(event, createContext());
      expect(result.error?.message).toBe("codex_stream_error");
    });
  });

  describe("item.completed - reasoning", () => {
    it("extracts reasoning text and emits thought event", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "reasoning",
          text: "Analyzing the codebase structure",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.reasoning).toBe("Analyzing the codebase structure");
      expect(result.alfredEvents).toHaveLength(1);
      expect(result.alfredEvents[0]).toMatchObject({
        type: "thought",
        content: "Analyzing the codebase structure",
      });
    });

    it("handles empty reasoning text", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "reasoning",
          text: "",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.reasoning).toBeUndefined();
      expect(result.alfredEvents).toEqual([]);
    });
  });

  describe("item.completed - command_execution", () => {
    it("emits command event with running status", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "command_execution",
          command: "ls -la",
          status: "in_progress",
          aggregated_output: "",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.alfredEvents).toContainEqual({
        type: "command",
        command: "ls -la",
        status: "running",
      });
    });

    it("emits command and output events on completion", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "command_execution",
          command: "cat file.txt",
          status: "completed",
          aggregated_output: "file contents here",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.outputChunk).toBe("file contents here");
      expect(result.alfredEvents).toContainEqual({
        type: "command",
        command: "cat file.txt",
        status: "completed",
      });
      expect(result.alfredEvents).toContainEqual({
        type: "output",
        content: "file contents here",
      });
    });

    it("handles failed status", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "command_execution",
          command: "invalid-cmd",
          status: "failed",
          aggregated_output: "",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.alfredEvents).toContainEqual({
        type: "command",
        command: "invalid-cmd",
        status: "failed",
      });
    });
  });

  describe("item.completed - agent_message", () => {
    it("extracts message text as output", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "agent_message",
          text: "Task completed successfully",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.outputChunk).toBe("Task completed successfully");
      expect(result.alfredEvents).toContainEqual({
        type: "output",
        content: "Task completed successfully",
      });
    });

    it("handles empty message", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "agent_message",
          text: "",
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.outputChunk).toBeUndefined();
      expect(result.alfredEvents).toEqual([]);
    });
  });

  describe("item.completed - file_change", () => {
    it("collects artifacts from file changes", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "file_change",
          status: "completed",
          changes: [
            { path: "src/index.ts", kind: "update" },
            { path: "README.md", kind: "add" },
          ],
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.artifacts).toEqual([
        { path: "src/index.ts", kind: "update" },
        { path: "README.md", kind: "add" },
      ]);
      expect(result.alfredEvents).toContainEqual({
        type: "artifact",
        path: "src/index.ts",
        kind: "file",
      });
      expect(result.alfredEvents).toContainEqual({
        type: "artifact",
        path: "README.md",
        kind: "file",
      });
    });

    it("skips changes without path", () => {
      const event: ThreadEvent = {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "file_change",
          status: "completed",
          changes: [
            { path: "valid.ts", kind: "add" },
            { path: "", kind: "update" },
          ],
        },
      };
      const result = processThreadEvent(event, createContext());
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts?.[0]?.path).toBe("valid.ts");
    });
  });

  describe("unknown events", () => {
    it("returns empty result for unhandled event types", () => {
      const event = { type: "unknown.event" } as unknown as ThreadEvent;
      const result = processThreadEvent(event, createContext());
      expect(result.alfredEvents).toEqual([]);
      expect(result.threadId).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });
});

describe("formatArtifactReasoning", () => {
  it("formats single artifact", () => {
    const artifacts = [{ path: "src/app.ts", kind: "update" }];
    const result = formatArtifactReasoning(artifacts);
    expect(result).toBe("artifacts_collected (1):\n- update src/app.ts");
  });

  it("formats multiple artifacts", () => {
    const artifacts = [
      { path: "src/app.ts", kind: "update" },
      { path: "README.md", kind: "add" },
      { path: "old.ts", kind: "delete" },
    ];
    const result = formatArtifactReasoning(artifacts);
    expect(result).toContain("artifacts_collected (3)");
    expect(result).toContain("- update src/app.ts");
    expect(result).toContain("- add README.md");
    expect(result).toContain("- delete old.ts");
  });

  it("handles missing kind with default", () => {
    const artifacts = [{ path: "test.ts", kind: "" }];
    const result = formatArtifactReasoning(artifacts);
    expect(result).toContain("- file test.ts");
  });

  it("handles missing path", () => {
    const artifacts = [{ path: "", kind: "add" }];
    const result = formatArtifactReasoning(artifacts);
    expect(result).toContain("(unknown)");
  });

  it("handles empty array", () => {
    const result = formatArtifactReasoning([]);
    expect(result).toBe("artifacts_collected (0):\n");
  });
});
