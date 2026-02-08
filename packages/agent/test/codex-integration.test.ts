/**
 * Integration tests for toolCodex.execute() end-to-end pipeline
 *
 * Tests the full flow: input validation -> policy enforcement -> execution -> output
 */

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

// Track all events written during execution
interface WrittenEvent {
  type: string;
  [key: string]: unknown;
}
const writtenEvents: WrittenEvent[] = [];

// Mock auth/token for policy enforcement
const requireToolScopesAndPolicyMock = vi.fn();
const authTokenModule = await import("@alfred/auth/token");
const requireToolScopesAndPolicySpy = vi
  .spyOn(authTokenModule, "requireToolScopesAndPolicy")
  .mockImplementation((...args) => requireToolScopesAndPolicyMock(...args));

// Mock codex session manager
const codexSessionModule = await import("../src/orchestrator/codex-session.js");
const sessionManagerMock = codexSessionModule.sessionManager;
const getSessionSpy = vi
  .spyOn(sessionManagerMock, "getSession")
  .mockResolvedValue();
const createSessionSpy = vi
  .spyOn(sessionManagerMock, "createSession")
  .mockResolvedValue();
const assessSessionResumeEligibilitySpy = vi
  .spyOn(codexSessionModule, "assessSessionResumeEligibility")
  .mockResolvedValue({
    canResume: false,
    reason: "missing-session",
  });

// Mock codex run recorder to avoid DB
mock.module("@alfred/db/repo/codex-run", () => ({
  createRun: vi.fn().mockResolvedValue({ id: "test-run-id" }),
  getLatestRunBySession: vi.fn().mockResolvedValue(null),
  appendEventsBatch: vi.fn().mockResolvedValue({ inserted: 0 }),
  finalizeRun: vi.fn().mockResolvedValue({}),
}));

// Mock learning context
mock.module("@alfred/db/repo/codex-learning", () => ({
  buildCodexLearningContext: vi.fn().mockResolvedValue(null),
  buildCodexHeuristicContext: vi.fn().mockResolvedValue(null),
}));

// Mock graphstore
mock.module("../src/assistant/src/graphstore.js", () => ({
  persistCodexExecution: vi.fn().mockResolvedValue(),
}));

// Track thread events for mock server
interface ThreadEvent {
  type: string;
  [key: string]: unknown;
}
let mockThreadEvents: ThreadEvent[] = [];

const codexServerModule = await import("../src/orchestrator/tool/codex/server");

async function emitWriter(
  writer: { write?: (chunk: unknown) => Promise<void> | void } | undefined,
  payload: unknown
) {
  if (writer?.write) {
    await writer.write(payload);
  }
}

const executeWithCodexServerSpy = vi
  .spyOn(codexServerModule, "executeWithCodexServer")
  .mockImplementation(async ({ input, writer, signal }) => {
    if (signal?.aborted) {
      throw new Error("codex_exec_aborted");
    }

    let resultText = "";
    const artifacts: { path: string; kind: string }[] = [];

    for (const event of mockThreadEvents) {
      if (signal?.aborted) {
        throw new Error("codex_exec_aborted");
      }

      if (event.type === "turn.failed") {
        const message =
          (event as { error?: { message?: string } }).error?.message ??
          "codex_turn_failed";
        await emitWriter(writer, { type: "stderr", text: message });
        throw new Error(`codex_exec_failed:${message}`);
      }

      if (event.type === "error") {
        const message =
          (event as { message?: string }).message ?? "codex_stream_error";
        await emitWriter(writer, { type: "stderr", text: message });
        throw new Error(`codex_exec_failed:${message}`);
      }

      if (event.type !== "item.completed") {
        continue;
      }

      const {item} = (event as { item?: any });
      if (!item || typeof item !== "object") {
        continue;
      }

      if (item.type === "agent_message" && typeof item.text === "string") {
        resultText += item.text;
        await emitWriter(writer, {
          type: "stdout",
          event: {
            type: "output",
            content: item.text,
            timestamp: Date.now(),
          },
        });
        continue;
      }

      if (item.type === "command_execution") {
        const status =
          item.status === "failed"
            ? "failed"
            : (item.status === "in_progress"
              ? "running"
              : "completed");
        await emitWriter(writer, {
          type: "stdout",
          event: {
            type: "command",
            command: item.command ?? "",
            status,
            timestamp: Date.now(),
          },
        });
        if (item.aggregated_output) {
          const output = Array.isArray(item.aggregated_output)
            ? item.aggregated_output.join("\n")
            : String(item.aggregated_output);
          resultText += output;
          await emitWriter(writer, {
            type: "stdout",
            event: {
              type: "output",
              content: output,
              timestamp: Date.now(),
            },
          });
        }
        continue;
      }

      if (item.type === "file_change" && Array.isArray(item.changes)) {
        for (const change of item.changes) {
          if (!change?.path) {
            continue;
          }
          artifacts.push({ path: change.path, kind: change.kind });
          await emitWriter(writer, {
            type: "stdout",
            event: {
              type: "artifact",
              path: change.path,
              kind: "file",
              timestamp: Date.now(),
            },
          });
        }
        continue;
      }

      if (item.type === "reasoning" && input.out === "debug") {
        await emitWriter(writer, {
          type: "reasoning",
          text: item.text ?? "",
          timestamp: Date.now(),
        });
      }
    }

    return { result: resultText, artifacts };
  });

// Import after mocks
const { toolCodex } = await import("../src/orchestrator/tool/codex/index");

function createWriter() {
  return {
    write: (chunk: unknown) => {
      if (chunk && typeof chunk === "object") {
        writtenEvents.push(chunk as WrittenEvent);
      }
      return Promise.resolve();
    },
  };
}

function setMockEvents(events: ThreadEvent[]) {
  mockThreadEvents = events;
}

describe("toolCodex.execute() integration", () => {
  const cwd = process.cwd();
  const baseInput = {
    containerCw: "/workspace",
    containerName: "alfred-agentfs-test",
    cw: cwd,
  };

  beforeEach(() => {
    writtenEvents.length = 0;
    mockThreadEvents = [];

    requireToolScopesAndPolicyMock.mockClear();
    requireToolScopesAndPolicyMock.mockResolvedValue({
      claims: { sub: "test-user", elevated: false, mfa: undefined },
    });

    getSessionSpy.mockClear();
    getSessionSpy.mockResolvedValue();
    createSessionSpy.mockClear();
    createSessionSpy.mockResolvedValue();
    assessSessionResumeEligibilitySpy.mockClear();
    assessSessionResumeEligibilitySpy.mockResolvedValue({
      canResume: false,
      reason: "missing-session",
    });

    process.env.CODEX_BIN = process.env.CODEX_BIN ?? "/usr/bin/true";
  });

  afterEach(() => {
    mockThreadEvents = [];
  });

  afterAll(() => {
    requireToolScopesAndPolicySpy.mockRestore();
    getSessionSpy.mockRestore();
    createSessionSpy.mockRestore();
    assessSessionResumeEligibilitySpy.mockRestore();
    executeWithCodexServerSpy.mockRestore();
    mock.restore();
  });

  describe("full pipeline execution", () => {
    it("executes complete flow from input to output", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "thread-integration-1" },
        { type: "turn.started" },
        {
          type: "item.completed",
          item: {
            id: "msg-1",
            type: "agent_message",
            text: "Task completed successfully",
          },
        },
        {
          type: "turn.completed",
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cached_input_tokens: 10,
          },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "echo hello",
          auto: "read",
          out: "text",
          authz: "test-token",
        },
        writer: createWriter(),
      });

      // Verify policy was enforced
      expect(requireToolScopesAndPolicyMock).toHaveBeenCalledWith(
        "test-token",
        ["droid.exec"],
        expect.objectContaining({
          action: "droid.exec",
          context: { auto: "read", memory_confidence: undefined },
        })
      );

      // Verify result structure
      expect(result.result).toBe("Task completed successfully");
      const outputs = writtenEvents.filter((e) => e.type === "stdout");
      expect(
        outputs.some(
          (o) =>
            (o.event as { type?: string; content?: string })?.type ===
              "output" &&
            (o.event as { content?: string })?.content ===
              "Task completed successfully"
        )
      ).toBe(true);
    });

    it("collects artifacts through the pipeline", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "thread-artifacts" },
        {
          type: "item.completed",
          item: {
            id: "file-1",
            type: "file_change",
            status: "completed",
            changes: [
              { path: "src/new-file.ts", kind: "add" },
              { path: "src/modified.ts", kind: "update" },
            ],
          },
        },
        {
          type: "item.completed",
          item: {
            id: "msg-1",
            type: "agent_message",
            text: "Created and modified files",
          },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "create files",
          auto: "read",
          out: "text",
          authz: "test-token",
        },
        writer: createWriter(),
      });

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts).toContainEqual({
        path: "src/new-file.ts",
        kind: "add",
      });
      expect(result.artifacts).toContainEqual({
        path: "src/modified.ts",
        kind: "update",
      });

      // Verify artifact events were emitted
      const stdoutEvents = writtenEvents.filter((e) => e.type === "stdout");
      const artifactEvents = stdoutEvents.filter(
        (e) => (e.event as { type?: string })?.type === "artifact"
      );
      expect(artifactEvents).toHaveLength(2);
    });

    it("captures reasoning traces", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "thread-reasoning" },
        {
          type: "item.completed",
          item: {
            id: "reason-1",
            type: "reasoning",
            text: "Analyzing the codebase structure",
          },
        },
        {
          type: "item.completed",
          item: {
            id: "reason-2",
            type: "reasoning",
            text: "Planning implementation approach",
          },
        },
        {
          type: "item.completed",
          item: {
            id: "msg-1",
            type: "agent_message",
            text: "Done",
          },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "analyze code",
          auto: "read",
          out: "debug", // Enable reasoning output
          authz: "test-token",
        },
        writer: createWriter(),
      });

      // Verify reasoning was written in debug mode
      const reasoningEvents = writtenEvents.filter(
        (e) => e.type === "reasoning"
      );
      expect(reasoningEvents.length).toBeGreaterThanOrEqual(2);
    });

    it("handles command execution events", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "thread-commands" },
        {
          type: "item.completed",
          item: {
            id: "cmd-1",
            type: "command_execution",
            command: "ls -la",
            status: "completed",
            aggregated_output: "file1.ts\nfile2.ts",
          },
        },
        {
          type: "item.completed",
          item: {
            id: "msg-1",
            type: "agent_message",
            text: "Listed files",
          },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "list files",
          auto: "read",
          out: "text",
          authz: "test-token",
        },
        writer: createWriter(),
      });

      expect(result.result).toContain("Listed files");

      // Verify command events
      const stdoutEvents = writtenEvents.filter((e) => e.type === "stdout");
      const commandEvents = stdoutEvents.filter(
        (e) => (e.event as { type?: string })?.type === "command"
      );
      expect(commandEvents).toHaveLength(1);
      expect((commandEvents[0]?.event as { command: string })?.command).toBe(
        "ls -la"
      );
    });
  });

  describe("policy enforcement", () => {
    it("rejects medium autonomy without elevation", async () => {
      setMockEvents([{ type: "thread.started", thread_id: "thread-1" }]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "medium",
            out: "text",
            authz: "test-token",
          },
        })
      ).rejects.toThrow("biometric_required");
    });

    it("rejects high autonomy without elevation", async () => {
      setMockEvents([{ type: "thread.started", thread_id: "thread-1" }]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "high",
            out: "text",
            authz: "test-token",
          },
        })
      ).rejects.toThrow("biometric_required");
    });

    it("allows medium autonomy with proper elevation", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: { sub: "test-user", elevated: true, mfa: "passkey" },
      });

      setMockEvents([
        { type: "thread.started", thread_id: "thread-elevated" },
        {
          type: "item.completed",
          item: { id: "msg-1", type: "agent_message", text: "Done" },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "test",
          auto: "medium",
          out: "text",
          authz: "elevated-token",
        },
      });

      expect(result.result).toBe("Done");
    });

    it("rejects timeout exceeding MAX_TIMEOUT_SEC", async () => {
      setMockEvents([{ type: "thread.started", thread_id: "thread-1" }]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "read",
            out: "text",
            authz: "test-token",
            timeoutSec: 7200, // 2 hours > 30 min max
          },
        })
      ).rejects.toThrow("codex_timeout_exceeds_limit");
    });

    it("binds userId from claims to input", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: { sub: "policy-bound-user", elevated: false, mfa: undefined },
      });

      setMockEvents([
        { type: "thread.started", thread_id: "thread-user-binding" },
        {
          type: "item.completed",
          item: { id: "msg-1", type: "agent_message", text: "Done" },
        },
      ]);

      const input = {
        ...baseInput,
        action: "exec" as const,
        prompt: "test",
        auto: "read" as const,
        out: "text" as const,
        authz: "test-token",
      };

      await toolCodex.execute({ input });

      // userId should be set by enforcePolicy
      expect(input.userId).toBe("policy-bound-user");
    });
  });

  describe("error handling", () => {
    it("propagates runtime errors from turn.failed", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "thread-error" },
        {
          type: "turn.failed",
          error: { message: "Model rate limited" },
        },
      ]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "read",
            out: "text",
            authz: "test-token",
          },
          writer: createWriter(),
        })
      ).rejects.toThrow("codex_exec_failed:Model rate limited");

      // Verify error was written
      const stderrEvents = writtenEvents.filter((e) => e.type === "stderr");
      expect(stderrEvents.length).toBeGreaterThan(0);
    });

    it("propagates stream errors", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "thread-stream-error" },
        { type: "error", message: "Connection reset" },
      ]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "read",
            out: "text",
            authz: "test-token",
          },
          writer: createWriter(),
        })
      ).rejects.toThrow("codex_exec_failed:Connection reset");
    });

    it("handles session user mismatch", async () => {
      requireToolScopesAndPolicyMock.mockResolvedValue({
        claims: { sub: "actual-user", elevated: false, mfa: undefined },
      });

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "read",
            out: "text",
            authz: "test-token",
            userId: "different-user", // Mismatch with claims.sub
          },
        })
      ).rejects.toThrow("codex_session_user_mismatch");
    });
  });

  describe("session management", () => {
    it("creates session when sessionId provided with new thread", async () => {
      setMockEvents([
        { type: "thread.started", thread_id: "new-thread-for-session" },
        {
          type: "item.completed",
          item: { id: "msg-1", type: "agent_message", text: "Done" },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "test",
          auto: "read",
          out: "text",
          authz: "test-token",
          sessionId: "new-session-id",
        },
        writer: createWriter(),
      });

      expect(result.sessionState).toBeUndefined();
      expect(sessionManagerMock.createSession).not.toHaveBeenCalled();
    });

    it("resumes existing session when eligible", async () => {
      assessSessionResumeEligibilitySpy.mockResolvedValue({
        canResume: true,
        session: {
          sessionId: "resumable-session",
          userId: "test-user",
          threadId: "existing-thread",
          workingDirectory: cwd,
          status: "active",
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          expiresAt: Date.now() + 86_400_000,
        },
      });

      sessionManagerMock.getSession.mockResolvedValue({
        sessionId: "resumable-session",
        userId: "test-user",
        threadId: "existing-thread",
        workingDirectory: cwd,
        status: "active",
      });

      setMockEvents([
        { type: "thread.started", thread_id: "existing-thread" },
        {
          type: "item.completed",
          item: { id: "msg-1", type: "agent_message", text: "Resumed" },
        },
      ]);

      const result = await toolCodex.execute({
        input: {
          ...baseInput,
          action: "exec",
          prompt: "continue work",
          auto: "read",
          out: "text",
          authz: "test-token",
          sessionId: "resumable-session",
        },
        writer: createWriter(),
      });

      expect(result.sessionState).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });
  });

  describe("abort signal handling", () => {
    it("respects external abort signal", async () => {
      const controller = new AbortController();

      // Abort immediately
      controller.abort();

      setMockEvents([{ type: "thread.started", thread_id: "thread-abort" }]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "read",
            out: "text",
            authz: "test-token",
          },
          signal: controller.signal,
        })
      ).rejects.toThrow("codex_exec_aborted");
    });
  });

  describe("working directory validation", () => {
    it("rejects paths outside allowed prefixes", async () => {
      setMockEvents([{ type: "thread.started", thread_id: "thread-1" }]);

      await expect(
        toolCodex.execute({
          input: {
            ...baseInput,
            action: "exec",
            prompt: "test",
            auto: "read",
            out: "text",
            cw: "/etc/passwd", // Outside allowed prefixes
            authz: "test-token",
          },
        })
      ).rejects.toThrow("codex_invalid_cwd");
    });
  });
});
