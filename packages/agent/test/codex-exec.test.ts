import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

type ThreadEvent = { type: string; [key: string]: unknown };

let pendingEvents: ThreadEvent[] = [];

function setMockEvents(events: ThreadEvent[]) {
  pendingEvents = events;
}

function createEventStream(events: ThreadEvent[]) {
  return (function* () {
    for (const event of events) {
      yield event;
    }
  })();
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
    canResume: false,
    reason: "missing-session",
  })
);

const getSessionMock = mock(() => undefined as any);
const createSessionMock = mock(() => {});

mock.module("../src/orchestrator/codex-session.js", () => ({
  assessSessionResumeEligibility: assessSessionResumeEligibilityMock,
  sessionManager: {
    getSession: (...args: Parameters<typeof getSessionMock>) =>
      getSessionMock(...args),
    createSession: (
      ...args: Parameters<typeof createSessionMock>
    ): ReturnType<typeof createSessionMock> => createSessionMock(...args),
  },
}));

const definitionModule = await import(
  "../src/orchestrator/tool/codex/definition.ts"
);
mock.module(
  "../src/orchestrator/tool/codex/definition.js",
  () => definitionModule
);

mock.module("@openai/codex-sdk", () => {
  class MockThread {
    id = "thread-mock";

    runStreamed() {
      const events = pendingEvents.map((event) => ({ ...event }));
      return {
        events: createEventStream(events),
      };
    }
  }

  class Codex {
    startThread() {
      return new MockThread();
    }

    resumeThread() {
      return new MockThread();
    }
  }

  return { Codex };
});

const { executeWithSdk } = await import(
  "@alfred/agent/orchestrator/tool/codex/exec"
);

beforeEach(() => {
  assessSessionResumeEligibilityMock.mockReset();
  assessSessionResumeEligibilityMock.mockResolvedValue({
    canResume: false,
    reason: "missing-session",
  });
  getSessionMock.mockReset();
  getSessionMock.mockImplementation(() => {});
  createSessionMock.mockReset();
  createSessionMock.mockImplementation(() => {});
});

describe("executeWithSdk artifacts", () => {
  const originalCodexKey = process.env.CODEX_API_KEY;

  beforeEach(() => {
    process.env.CODEX_API_KEY = "test-key";
  });

  afterEach(() => {
    pendingEvents = [];
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
          type: "agent_message",
          text: "File update complete",
        },
      },
      {
        type: "item.completed",
        item: {
          type: "file_change",
          changes: [
            { path: "src/app.ts", kind: "modified" },
            { path: "README.md", kind: "created" },
          ],
        },
      },
    ]);

    const result = await executeWithSdk({
      input: {
        action: "exec",
        prompt: "summarize updates",
        auto: "read",
        out: "text",
        cw: process.cwd(),
      },
    });

    expect(result.artifacts).toEqual([
      { path: "src/app.ts", kind: "modified" },
      { path: "README.md", kind: "created" },
    ]);

    expect(result.reasoning).toBeDefined();
    const summary = result.reasoning?.[result.reasoning.length - 1]?.text ?? "";
    expect(summary).toContain("artifacts_collected");
    expect(summary).toContain("src/app.ts");
  });
});

describe("executeWithSdk session security", () => {
  const cwd = process.cwd();

  it("throws when sessionId is provided without a userId", async () => {
    await expect(
      executeWithSdk({
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

    await expect(
      executeWithSdk({
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
    const createSpy = createSessionMock;
    await executeWithSdk({
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

    expect(createSpy).toHaveBeenCalledWith(
      "fresh-session",
      expect.any(String),
      cwd,
      "owner-123"
    );
  });
});
