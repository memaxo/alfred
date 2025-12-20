import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

type ThreadEvent = { type: string; [key: string]: unknown };

let pendingEvents: ThreadEvent[] = [];

function setMockEvents(events: ThreadEvent[]) {
  pendingEvents = events;
}

const noop = () => {};

mock.module("../src/metrics.js", () => ({
  recordCodexError: noop,
  recordCodexExecRun: noop,
  recordDroidExecRun: noop,
  recordCodexWriterError: noop,
  recordCodexSessionViolation: noop,
  startCodexExecTimer: () => noop,
  startDroidExecTimer: () => noop,
  startCodexSessionValidationTimer: () => () => {},
}));

const assessSessionResumeEligibilityMock = mock(() =>
  Promise.resolve({
    canResume: false as const,
    reason: "missing-session" as const,
  })
);

const getSessionMock = mock(() => undefined);
const createSessionMock = mock(() => undefined);

mock.module("../src/orchestrator/codex-session.js", () => ({
  assessSessionResumeEligibility: assessSessionResumeEligibilityMock,
  sessionManager: {
    getSession: (...args: Parameters<typeof getSessionMock>) =>
      getSessionMock(...args),
    createSession: (...args: Parameters<typeof createSessionMock>) =>
      createSessionMock(...args),
  },
}));

// Ensure the exec.ts dependency on definition.js is resolved to the TS module.
const definitionModule = await import("../src/orchestrator/tool/codex/definition.ts");
mock.module("../src/orchestrator/tool/codex/definition.js", () => definitionModule);

mock.module("@alfred/codex", () => ({
  runStreamed: async function* () {
    for (const event of pendingEvents) {
      yield { ...event };
    }
  },
}));

const { executeWithCodex } = await import(
  "@alfred/agent/orchestrator/tool/codex/exec"
);

beforeEach(() => {
  assessSessionResumeEligibilityMock.mockReset();
  assessSessionResumeEligibilityMock.mockResolvedValue({
    canResume: false,
    reason: "missing-session",
  });
  getSessionMock.mockReset();
  getSessionMock.mockImplementation(() => undefined);
  createSessionMock.mockReset();
  createSessionMock.mockImplementation(() => undefined);

  // Avoid depending on an installed codex binary during tests.
  process.env.CODEX_BIN = process.env.CODEX_BIN ?? "/usr/bin/true";
});

afterEach(() => {
  pendingEvents = [];
});

describe("executeWithCodex artifacts", () => {
  const originalCodexKey = process.env.CODEX_API_KEY;

  beforeEach(() => {
    process.env.CODEX_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalCodexKey === undefined) {
      process.env.CODEX_API_KEY = undefined;
    } else {
      process.env.CODEX_API_KEY = originalCodexKey;
    }
  });

  it("returns collected artifacts and surfaces them in reasoning traces", async () => {
    setMockEvents([
      { type: "thread.started", thread_id: "thread-event" },
      {
        type: "item.completed",
        item: {
          id: "item-1",
          type: "agent_message",
          text: "File update complete",
        },
      },
      {
        type: "item.completed",
        item: {
          id: "item-2",
          type: "file_change",
          status: "completed",
          changes: [
            { path: "src/app.ts", kind: "update" },
            { path: "README.md", kind: "add" },
          ],
        },
      },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        prompt: "summarize updates",
        auto: "read",
        out: "text",
        cw: process.cwd(),
      },
    });

    expect(result.artifacts).toEqual([
      { path: "src/app.ts", kind: "update" },
      { path: "README.md", kind: "add" },
    ]);

    expect(result.reasoning).toBeDefined();
    const summary = result.reasoning?.at(-1)?.text ?? "";
    expect(summary).toContain("artifacts_collected");
    expect(summary).toContain("src/app.ts");
  });
});

describe("executeWithCodex session security", () => {
  const cwd = process.cwd();

  it("throws when sessionId is provided without a userId", async () => {
    setMockEvents([{ type: "thread.started", thread_id: "thread-event" }]);

    await expect(
      executeWithCodex({
        input: {
          action: "exec",
          prompt: "ls",
          auto: "read",
          out: "text",
          cw: cwd,
          sessionId: "sess-no-user",
        },
      })
    ).rejects.toThrow("codex_session_user_required");

    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it("prevents different users from resuming another user's session", async () => {
    getSessionMock.mockImplementation(() => {
      throw new Error("codex_session_forbidden");
    });

    setMockEvents([{ type: "thread.started", thread_id: "thread-event" }]);

    await expect(
      executeWithCodex({
        input: {
          action: "exec",
          prompt: "resume",
          auto: "read",
          out: "text",
          cw: cwd,
          sessionId: "shared-session",
          userId: "intruder",
        },
      })
    ).rejects.toThrow("codex_session_forbidden");

    expect(getSessionMock).toHaveBeenCalledWith("shared-session", "intruder");
  });

  it("binds new sessions to the requesting user", async () => {
    setMockEvents([{ type: "thread.started", thread_id: "thread-created" }]);

    await executeWithCodex({
      input: {
        action: "exec",
        prompt: "new session",
        auto: "read",
        out: "text",
        cw: cwd,
        sessionId: "fresh-session",
        userId: "owner-123",
      },
    });

    expect(createSessionMock).toHaveBeenCalledWith(
      "fresh-session",
      "thread-created",
      cwd,
      "owner-123"
    );
  });
});
