import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

const createRunMock = vi.fn().mockResolvedValue({ id: "run-123" });
const getLatestRunBySessionMock = vi.fn().mockResolvedValue(null);
const appendEventsBatchMock = vi.fn().mockResolvedValue({ inserted: 1 });
const finalizeRunMock = vi.fn().mockResolvedValue({});

mock.module("@alfred/db/repo/codex-run", () => ({
  appendEventsBatch: appendEventsBatchMock,
  createRun: createRunMock,
  finalizeRun: finalizeRunMock,
  getLatestRunBySession: getLatestRunBySessionMock,
}));

// Set environment to allow repo loading
const originalEnv = {
  BUN_TEST: process.env.BUN_TEST,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
};

describe("CodexRunRecorder", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test";
    process.env.BUN_TEST = undefined;
    process.env.NODE_ENV = "development";
    createRunMock.mockClear();
    getLatestRunBySessionMock.mockClear();
    appendEventsBatchMock.mockClear();
    finalizeRunMock.mockClear();
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.BUN_TEST = originalEnv.BUN_TEST;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  });

  describe("start", () => {
    it("creates a new run with provided options", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: "/tmp/agentfs.db",
        agentfsRunId: "agentfs-run-1",
        auto: "medium",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: "gpt-4",
        outputSchema: { type: "object" },
        profile: "default",
        sessionId: "session-123",
        threadId: "thread-456",
        userId: "user-abc",
        workingDirectory: "/tmp/project",
        workspaceRoot: "/tmp",
      });

      expect(recorder.runId).toBe("run-123");
      expect(createRunMock).toHaveBeenCalledWith(
        expect.objectContaining({
          agentfsDbPath: "/tmp/agentfs.db",
          agentfsRunId: "agentfs-run-1",
          auto: "medium",
          environmentKind: "agentfs",
          model: "gpt-4",
          sessionId: "session-123",
          threadId: "thread-456",
          userId: "user-abc",
        })
      );
    });

    it("looks up prior run for session resume chain", async () => {
      getLatestRunBySessionMock.mockResolvedValue({
        id: "prior-run",
        resumeCount: 2,
      });

      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: "session-resume",
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      expect(getLatestRunBySessionMock).toHaveBeenCalledWith({
        sessionId: "session-resume",
        userId: "user-abc",
      });
      expect(createRunMock).toHaveBeenCalledWith(
        expect.objectContaining({
          parentRunId: "prior-run",
          resumeCount: 3,
        })
      );
    });

    it("returns no-op recorder without userId", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: undefined,
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      expect(recorder.runId).toBeNull();
      expect(createRunMock).not.toHaveBeenCalled();
    });

    it("returns no-op recorder in test environment", async () => {
      process.env.BUN_TEST = "1";

      // Re-import to pick up env change
      const mod = await import("../src/orchestrator/tool/codex/record");

      const recorder = await mod.CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-test",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      expect(recorder.runId).toBeNull();
    });
  });

  describe("recordThreadEvent", () => {
    it("queues thread events for batch flush", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      recorder.recordThreadEvent({ thread_id: "t1", type: "thread.started" });
      recorder.recordThreadEvent({ type: "turn.started" });

      await recorder.flush();

      expect(appendEventsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: "thread_event", seq: 1 }),
            expect.objectContaining({ eventType: "thread_event", seq: 2 }),
          ]),
          runId: "run-123",
        })
      );
    });
  });

  describe("recordWriterChunk", () => {
    it("records stdout chunks with text", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      recorder.recordWriterChunk({ text: "output line", type: "stdout" });
      await recorder.flush();

      expect(appendEventsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              eventType: "stdout",
              text: "output line",
            }),
          ]),
        })
      );
    });

    it("records notice chunks", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      recorder.recordWriterChunk({
        message: "codex_turn_started",
        type: "notice",
      });
      await recorder.flush();

      expect(appendEventsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              eventType: "notice",
              text: "codex_turn_started",
            }),
          ]),
        })
      );
    });

    it("records alfred events from codex_event type", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      recorder.recordWriterChunk({
        event: { type: "thought", content: "Analyzing..." },
        type: "codex_event",
      });
      await recorder.flush();

      expect(appendEventsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({
              eventType: "alfred_event",
              text: "Analyzing...",
            }),
          ]),
        })
      );
    });

    it("ignores invalid payloads", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      // Clear the initial notice from start
      appendEventsBatchMock.mockClear();

      recorder.recordWriterChunk(null);
      recorder.recordWriterChunk({ noType: true });
      recorder.recordWriterChunk({ type: 123 });
      await recorder.flush();

      // No events should be recorded for invalid payloads
      expect(appendEventsBatchMock).not.toHaveBeenCalled();
    });
  });

  describe("setThreadId", () => {
    it("updates thread ID for finalization", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      recorder.setThreadId("new-thread-id");
      await recorder.finalizeSuccess({
        artifacts: [],
        resultText: "done",
        structuredOutput: null,
        structuredOutputStatus: "skipped",
      });

      expect(finalizeRunMock).toHaveBeenCalledWith(
        "run-123",
        expect.objectContaining({
          threadId: "new-thread-id",
        })
      );
    });
  });

  describe("finalizeSuccess", () => {
    it("finalizes run with completed status", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "agentfs",
        model: undefined,
        outputSchema: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      await recorder.finalizeSuccess({
        artifacts: [{ path: "file.ts", kind: "add" }],
        resultText: "Task completed",
        structuredOutput: { result: "ok" },
        structuredOutputStatus: "valid",
      });

      expect(finalizeRunMock).toHaveBeenCalledWith(
        "run-123",
        expect.objectContaining({
          exitCode: 0,
          resultText: "Task completed",
          status: "completed",
        })
      );
    });
  });

  describe("finalizeError", () => {
    it("finalizes run with failed status", async () => {
      const { CodexRunRecorder } =
        await import("../src/orchestrator/tool/codex/record");

      const recorder = await CodexRunRecorder.start({
        agentfsDbPath: undefined,
        agentfsRunId: undefined,
        auto: "read",
        dockerContainerId: undefined,
        dockerImage: undefined,
        environmentKind: "host",
        model: undefined,
        outputSchema: undefined,
        poofProfile: undefined,
        poofUpperDir: undefined,
        profile: undefined,
        sessionId: undefined,
        threadId: undefined,
        userId: "user-abc",
        workingDirectory: undefined,
        workspaceRoot: undefined,
      });

      await recorder.finalizeError({
        errorCode: "timeout",
        errorMessage: "Execution timed out",
        exitCode: 1,
      });

      expect(finalizeRunMock).toHaveBeenCalledWith(
        "run-123",
        expect.objectContaining({
          errorCode: "timeout",
          errorMessage: "Execution timed out",
          exitCode: 1,
          status: "failed",
        })
      );
    });
  });
});
