import { describe, expect, it } from "bun:test";
import type { AlfredCodexEvent } from "@alfred/agent/orchestrator/tool/codex/index";
import {
  codexEventsToUiMessage,
  codexEventToUiMessagePart,
} from "../src/ai/codex-stream";

describe("codex-stream", () => {
  describe("codexEventToUiMessagePart", () => {
    it("converts thought event to reasoning part", () => {
      const event: AlfredCodexEvent = {
        type: "thought",
        content: "Analyzing the problem",
        timestamp: Date.now(),
      };

      const part = codexEventToUiMessagePart(event);
      expect(part).toBeDefined();
      expect(part?.type).toBe("reasoning");
      if (part?.type === "reasoning") {
        expect(part.text).toBe("Analyzing the problem");
        expect(part.state).toBe("streaming");
      }
    });

    it("converts command event to text part", () => {
      const event: AlfredCodexEvent = {
        type: "command",
        command: "npm test",
        status: "completed",
      };

      const part = codexEventToUiMessagePart(event);
      expect(part).toBeDefined();
      expect(part?.type).toBe("text");
      if (part?.type === "text") {
        expect(part.text).toContain("npm test");
        expect(part.text).toContain("completed");
      }
    });

    it("converts output event to text part", () => {
      const event: AlfredCodexEvent = {
        type: "output",
        content: "Test results: 42 passed",
      };

      const part = codexEventToUiMessagePart(event);
      expect(part).toBeDefined();
      expect(part?.type).toBe("text");
      if (part?.type === "text") {
        expect(part.text).toBe("Test results: 42 passed");
      }
    });

    it("converts artifact event to file part", () => {
      const event: AlfredCodexEvent = {
        type: "artifact",
        path: "/tmp/report.md",
        kind: "file",
      };

      const part = codexEventToUiMessagePart(event);
      expect(part).toBeDefined();
      expect(part?.type).toBe("file");
      if (part?.type === "file") {
        expect(part.filename).toBe("/tmp/report.md");
        expect(part.url).toContain("/tmp/report.md");
      }
    });
  });

  describe("codexEventsToUiMessage", () => {
    it("batches multiple events into single message", () => {
      const events: AlfredCodexEvent[] = [
        { type: "thought", content: "Planning", timestamp: Date.now() },
        { type: "command", command: "ls", status: "completed" },
        { type: "output", content: "file1.ts\nfile2.ts" },
      ];

      const message = codexEventsToUiMessage(events);
      expect(message).toBeDefined();
      expect(message?.role).toBe("assistant");
      expect(message?.parts.length).toBe(3);
    });

    it("returns null for empty event array", () => {
      const message = codexEventsToUiMessage([]);
      expect(message).toBeNull();
    });

    it("uses provided message ID", () => {
      const events: AlfredCodexEvent[] = [{ type: "output", content: "test" }];

      const message = codexEventsToUiMessage(events, { messageId: "custom-id" });
      expect(message?.id).toBe("custom-id");
    });

    it("appends notices as text parts", () => {
      const events: AlfredCodexEvent[] = [{ type: "output", content: "result" }];
      const message = codexEventsToUiMessage(events, {
        notices: [
          { code: "limit_exceeded", message: "Timeout capped", correlationId: "abc" },
        ],
      });
      expect(message?.parts.at(-1)).toEqual({
        type: "text",
        text: "[limit_exceeded] Timeout capped (ref=abc)",
      });
    });
  });
});
