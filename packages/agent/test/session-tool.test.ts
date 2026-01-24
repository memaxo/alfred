import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  __sessionInternals,
  toolSession,
} from "../src/orchestrator/tool/session";

describe("session tool", () => {
  let mockRunner: ReturnType<typeof mock>;

  beforeEach(() => {
    mockRunner = mock(() => Promise.resolve(""));
    __sessionInternals.setRunner(mockRunner);
  });

  afterEach(() => {
    __sessionInternals.resetRunner();
  });

  describe("input schema validation", () => {
    it("requires action and sessionId", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const result = sessionInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid start action", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const result = sessionInputSchema.safeParse({
        action: "start",
        command: "npm run dev",
        sessionId: "test-session",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid stop action", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const result = sessionInputSchema.safeParse({
        action: "stop",
        sessionId: "test-session",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid list action", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const result = sessionInputSchema.safeParse({
        action: "list",
        sessionId: "any",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid peek action with lines", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const result = sessionInputSchema.safeParse({
        action: "peek",
        lines: 50,
        sessionId: "test-session",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid send action", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const result = sessionInputSchema.safeParse({
        action: "send",
        sessionId: "test-session",
        text: "ls -la",
      });
      expect(result.success).toBe(true);
    });

    it("validates sessionId length", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const tooShort = sessionInputSchema.safeParse({
        action: "start",
        command: "test",
        sessionId: "",
      });
      expect(tooShort.success).toBe(false);

      const tooLong = sessionInputSchema.safeParse({
        action: "start",
        command: "test",
        sessionId: "a".repeat(51),
      });
      expect(tooLong.success).toBe(false);
    });

    it("validates lines range for peek", async () => {
      const { sessionInputSchema } =
        await import("../src/orchestrator/tool/session");
      const tooFew = sessionInputSchema.safeParse({
        action: "peek",
        lines: 0,
        sessionId: "test",
      });
      expect(tooFew.success).toBe(false);

      const tooMany = sessionInputSchema.safeParse({
        action: "peek",
        lines: 1001,
        sessionId: "test",
      });
      expect(tooMany.success).toBe(false);
    });
  });

  describe("execute", () => {
    describe("start action", () => {
      it("creates detached tmux session", async () => {
        const result = await toolSession.execute({
          input: {
            action: "start",
            command: "npm run dev",
            sessionId: "dev-server",
          },
        });

        expect(result.ok).toBe(true);
        expect(result.output).toContain("dev-server");
        expect(result.output).toContain("npm run dev");
        expect(mockRunner).toHaveBeenCalledWith([
          "new-session",
          "-d",
          "-s",
          "dev-server",
          "npm run dev",
        ]);
      });

      it("requires command for start", async () => {
        await expect(
          toolSession.execute({
            input: {
              action: "start",
              sessionId: "test",
            },
          })
        ).rejects.toThrow("command required for start");
      });
    });

    describe("stop action", () => {
      it("kills tmux session", async () => {
        const result = await toolSession.execute({
          input: {
            action: "stop",
            sessionId: "dev-server",
          },
        });

        expect(result.ok).toBe(true);
        expect(result.output).toContain("stopped");
        expect(mockRunner).toHaveBeenCalledWith([
          "kill-session",
          "-t",
          "dev-server",
        ]);
      });
    });

    describe("list action", () => {
      it("returns list of sessions", async () => {
        mockRunner.mockResolvedValueOnce("session1\nsession2\nsession3");

        const result = await toolSession.execute({
          input: {
            action: "list",
            sessionId: "any",
          },
        });

        expect(result.ok).toBe(true);
        expect(result.sessions).toEqual(["session1", "session2", "session3"]);
        expect(mockRunner).toHaveBeenCalledWith([
          "list-sessions",
          "-F",
          "#{session_name}",
        ]);
      });

      it("returns empty array when no sessions", async () => {
        mockRunner.mockRejectedValueOnce(new Error("no sessions"));

        const result = await toolSession.execute({
          input: {
            action: "list",
            sessionId: "any",
          },
        });

        expect(result.ok).toBe(true);
        expect(result.sessions).toEqual([]);
      });
    });

    describe("peek action", () => {
      it("captures pane content with default lines", async () => {
        mockRunner.mockResolvedValueOnce("line1\nline2\nline3");

        const result = await toolSession.execute({
          input: {
            action: "peek",
            sessionId: "dev-server",
          },
        });

        expect(result.ok).toBe(true);
        expect(result.output).toBe("line1\nline2\nline3");
        expect(mockRunner).toHaveBeenCalledWith([
          "capture-pane",
          "-t",
          "dev-server",
          "-p",
          "-S",
          "-20",
        ]);
      });

      it("captures specified number of lines", async () => {
        mockRunner.mockResolvedValueOnce("output");

        await toolSession.execute({
          input: {
            action: "peek",
            lines: 100,
            sessionId: "dev-server",
          },
        });

        expect(mockRunner).toHaveBeenCalledWith([
          "capture-pane",
          "-t",
          "dev-server",
          "-p",
          "-S",
          "-100",
        ]);
      });
    });

    describe("send action", () => {
      it("sends text with carriage return", async () => {
        const result = await toolSession.execute({
          input: {
            action: "send",
            sessionId: "dev-server",
            text: "echo hello",
          },
        });

        expect(result.ok).toBe(true);
        expect(result.output).toContain("Sent input");
        expect(mockRunner).toHaveBeenCalledWith([
          "send-keys",
          "-t",
          "dev-server",
          "echo hello",
          "C-m",
        ]);
      });

      it("requires text for send", async () => {
        await expect(
          toolSession.execute({
            input: {
              action: "send",
              sessionId: "test",
            },
          })
        ).rejects.toThrow("text required for send");
      });
    });

    describe("error handling", () => {
      it("throws on unknown action", async () => {
        await expect(
          toolSession.execute({
            input: {
              action: "unknown" as any,
              sessionId: "test",
            },
          })
        ).rejects.toThrow("Unknown action");
      });

      it("propagates tmux errors", async () => {
        mockRunner.mockRejectedValueOnce(
          new Error("tmux_failed: session not found")
        );

        await expect(
          toolSession.execute({
            input: {
              action: "stop",
              sessionId: "nonexistent",
            },
          })
        ).rejects.toThrow("tmux_failed");
      });
    });
  });

  describe("output schema", () => {
    it("validates successful output", async () => {
      const { toolSession } = await import("../src/orchestrator/tool/session");
      const result = toolSession.outputSchema.safeParse({
        ok: true,
        output: "Session started",
      });
      expect(result.success).toBe(true);
    });

    it("validates output with sessions array", async () => {
      const { toolSession } = await import("../src/orchestrator/tool/session");
      const result = toolSession.outputSchema.safeParse({
        ok: true,
        sessions: ["session1", "session2"],
      });
      expect(result.success).toBe(true);
    });
  });
});
