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
  createRun: createRunMock,
  getLatestRunBySession: getLatestRunBySessionMock,
  appendEventsBatch: appendEventsBatchMock,
  finalizeRun: finalizeRunMock,
}));

// Set environment to allow repo loading
const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  BUN_TEST: process.env.BUN_TEST,
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
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: "session-123",
        threadId: "thread-456",
        auto: "medium",
        model: "gpt-4",
        profile: "default",
        environmentKind: "host",
        workingDirectory: "/tmp/project",
        workspaceRoot: "/tmp",
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: { type: "object" },
      });

      expect(recorder.runId).toBe("run-123");
      expect(createRunMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-abc",
          sessionId: "session-123",
          threadId: "thread-456",
          auto: "medium",
          model: "gpt-4",
          environmentKind: "host",
        })
      );
    });

    it("looks up prior run for session resume chain", async () => {
      getLatestRunBySessionMock.mockResolvedValue({
        id: "prior-run",
        resumeCount: 2,
      });

      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: "session-resume",
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      expect(getLatestRunBySessionMock).toHaveBeenCalledWith({
        userId: "user-abc",
        sessionId: "session-resume",
      });
      expect(createRunMock).toHaveBeenCalledWith(
        expect.objectContaining({
          parentRunId: "prior-run",
          resumeCount: 3,
        })
      );
    });

    it("returns no-op recorder without userId", async () => {
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: undefined,
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      expect(recorder.runId).toBeNull();
      expect(createRunMock).not.toHaveBeenCalled();
    });

    it("returns no-op recorder in test environment", async () => {
      process.env.BUN_TEST = "1";

      // Re-import to pick up env change
      const mod = await import("../src/orchestrator/tool/codex/record");

      const recorder = await mod.CodexRunRecorder.start({
        userId: "user-test",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      expect(recorder.runId).toBeNull();
    });
  });

  describe("recordThreadEvent", () => {
    it("queues thread events for batch flush", async () => {
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      recorder.recordThreadEvent({ type: "thread.started", thread_id: "t1" });
      recorder.recordThreadEvent({ type: "turn.started" });

      await recorder.flush();

      expect(appendEventsBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: "run-123",
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: "thread_event", seq: 1 }),
            expect.objectContaining({ eventType: "thread_event", seq: 2 }),
          ]),
        })
      );
    });
  });

  describe("recordWriterChunk", () => {
    it("records stdout chunks with text", async () => {
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      recorder.recordWriterChunk({ type: "stdout", text: "output line" });
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
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      recorder.recordWriterChunk({
        type: "notice",
        message: "codex_turn_started",
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
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      recorder.recordWriterChunk({
        type: "codex_event",
        event: { type: "thought", content: "Analyzing..." },
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
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
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
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      recorder.setThreadId("new-thread-id");
      await recorder.finalizeSuccess({
        resultText: "done",
        artifacts: [],
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
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      await recorder.finalizeSuccess({
        resultText: "Task completed",
        artifacts: [{ path: "file.ts", kind: "add" }],
        structuredOutput: { result: "ok" },
        structuredOutputStatus: "valid",
      });

      expect(finalizeRunMock).toHaveBeenCalledWith(
        "run-123",
        expect.objectContaining({
          status: "completed",
          exitCode: 0,
          resultText: "Task completed",
        })
      );
    });
  });

  describe("finalizeError", () => {
    it("finalizes run with failed status", async () => {
      const { CodexRunRecorder } = await import(
        "../src/orchestrator/tool/codex/record"
      );

      const recorder = await CodexRunRecorder.start({
        userId: "user-abc",
        sessionId: undefined,
        threadId: undefined,
        auto: "read",
        model: undefined,
        profile: undefined,
        environmentKind: "host",
        workingDirectory: undefined,
        workspaceRoot: undefined,
        dockerContainerId: undefined,
        dockerImage: undefined,
        poofUpperDir: undefined,
        poofProfile: undefined,
        outputSchema: undefined,
      });

      await recorder.finalizeError({
        exitCode: 1,
        errorCode: "timeout",
        errorMessage: "Execution timed out",
      });

      expect(finalizeRunMock).toHaveBeenCalledWith(
        "run-123",
        expect.objectContaining({
          status: "failed",
          exitCode: 1,
          errorCode: "timeout",
          errorMessage: "Execution timed out",
        })
      );
    });
  });
});
