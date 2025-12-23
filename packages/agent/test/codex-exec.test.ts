import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type ThreadEvent = { type: string; [key: string]: unknown };

let pendingEvents: ThreadEvent[] = [];
let shouldInvokeSpawn = false;
let observedPrompt: string | null = null;

function setMockEvents(events: ThreadEvent[]) {
  pendingEvents = events;
}

const noop = () => {};

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
  runStreamed: async function* (opts: {
    cmd: string;
    prompt: string;
    env?: Record<string, string>;
    spawn?: (args: { cmd: string; args: string[]; env?: Record<string, string> }) => unknown;
  }) {
    observedPrompt = opts.prompt;
    if (shouldInvokeSpawn) {
      // Exercise the tool-provided spawn wrapper (docker/poof/host selection).
      // This lets tests assert docker `--workdir` behavior deterministically.
      const spawned = opts.spawn?.({ cmd: opts.cmd, args: ["--version"], env: opts.env });
      if (
        spawned &&
        typeof spawned === "object" &&
        "exited" in spawned &&
        (spawned as { exited?: unknown }).exited instanceof Promise
      ) {
        await (spawned as { exited: Promise<unknown> }).exited;
      }
    }
    for (const event of pendingEvents) {
      yield { ...event };
    }
  },
}));

const buildCodexLearningContextMock = mock(() => Promise.resolve<string | null>(null));
const buildCodexHeuristicContextMock = mock(() => Promise.resolve<string | null>(null));

mock.module("@alfred/db/repo/codex-learning", () => ({
  buildCodexLearningContext: (
    ...args: Parameters<typeof buildCodexLearningContextMock>
  ) => buildCodexLearningContextMock(...args),
  buildCodexHeuristicContext: (
    ...args: Parameters<typeof buildCodexHeuristicContextMock>
  ) => buildCodexHeuristicContextMock(...args),
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
  shouldInvokeSpawn = false;
  observedPrompt = null;
  buildCodexLearningContextMock.mockReset();
  buildCodexLearningContextMock.mockResolvedValue(null);
  buildCodexHeuristicContextMock.mockReset();
  buildCodexHeuristicContextMock.mockResolvedValue(null);

  // Avoid depending on an installed codex binary during tests.
  process.env.CODEX_BIN = process.env.CODEX_BIN ?? "/usr/bin/true";
});

afterEach(() => {
  pendingEvents = [];
});

afterAll(() => {
  mock.restore();
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

describe("executeWithCodex prompt enrichment", () => {
  it("prepends heuristics context ahead of similar executions context", async () => {
    buildCodexLearningContextMock.mockResolvedValue("SIMILAR_CONTEXT");
    buildCodexHeuristicContextMock.mockResolvedValue("HEURISTICS_CONTEXT");

    setMockEvents([{ type: "thread.started", thread_id: "thread-event" }]);

    const prompt = "resolve merge conflict markers";
    await executeWithCodex({
      input: {
        action: "exec",
        prompt,
        auto: "read",
        out: "text",
        cw: process.cwd(),
      },
    });

    expect(observedPrompt).toBeTruthy();
    const finalPrompt = observedPrompt ?? "";
    expect(finalPrompt).toContain("HEURISTICS_CONTEXT");
    expect(finalPrompt).toContain("SIMILAR_CONTEXT");
    expect(finalPrompt).toContain(prompt);
    expect(finalPrompt.indexOf("HEURISTICS_CONTEXT")).toBeLessThan(
      finalPrompt.indexOf("SIMILAR_CONTEXT")
    );
  });
});

describe("executeWithCodex container workdir", () => {
  it("uses containerCw as docker exec --workdir when provided", async () => {
    // Provide a fake docker binary in PATH so resolveExecutable("docker") succeeds.
    const binDir = await mkdtemp(path.join(tmpdir(), "codex-docker-bin-"));
    const prevPath = process.env.PATH;
    try {
      const dockerPath = path.join(binDir, "docker");
      const argsPath = path.join(binDir, "args.txt");
      await writeFile(
        dockerPath,
        `#!/bin/sh\nprintf '%s\\n' \"$@\" > \"${argsPath}\"\nexit 0\n`,
        "utf8"
      );
      await chmod(dockerPath, 0o755);

      process.env.PATH = `${binDir}${path.delimiter}${prevPath ?? ""}`;

      shouldInvokeSpawn = true;
      setMockEvents([{ type: "thread.started", thread_id: "thread-event" }]);

      await executeWithCodex({
        input: {
          action: "exec",
          prompt: "noop",
          auto: "read",
          out: "text",
          cw: process.cwd(),
          containerId: "container-123",
          containerCw: "/workspace/.agent/worktrees/run/agent",
        },
      });

      const argsText = await Bun.file(argsPath).text();
      expect(argsText).toContain("exec");
      expect(argsText).toContain("--workdir");
      expect(argsText).toContain("/workspace/.agent/worktrees/run/agent");
      expect(argsText).toContain("container-123");
    } finally {
      process.env.PATH = prevPath;
      await rm(binDir, { recursive: true, force: true });
    }
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

describe("executeWithCodex metadata and sessionState", () => {
  const cwd = process.cwd();

  it("returns metadata in the result", async () => {
    setMockEvents([
      { type: "thread.started", thread_id: "thread-meta-123" },
      { type: "turn.started" },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 150,
          cached_input_tokens: 25,
          output_tokens: 200,
        },
      },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        prompt: "test metadata",
        auto: "medium",
        out: "text",
        cw: cwd,
      },
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.agentName).toBe("codex");
    expect(result.metadata?.threadId).toBe("thread-meta-123");
    expect(result.metadata?.autonomyLevel).toBe("medium");
    expect(result.metadata?.tokenUsage).toEqual({
      inputTokens: 150,
      outputTokens: 200,
      cachedInputTokens: 25,
    });
    expect(result.metadata?.turnDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns sessionState in the result", async () => {
    assessSessionResumeEligibilityMock.mockResolvedValue({
      canResume: false,
      reason: "missing-session",
    });
    setMockEvents([
      { type: "thread.started", thread_id: "thread-session-456" },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        prompt: "test session state",
        auto: "low",
        out: "text",
        cw: cwd,
        sessionId: "session-xyz",
        userId: "user-abc",
      },
    });

    expect(result.sessionState).toBeDefined();
    expect(result.sessionState?.sessionId).toBe("session-xyz");
    expect(result.sessionState?.threadId).toBe("thread-session-456");
    // canResume is based on whether we have a valid threadId, not the resume eligibility check
    expect(result.sessionState?.canResume).toBe(true);
    // isResumed is false since the session wasn't actually resumed (no prior session)
    expect(result.sessionState?.isResumed).toBe(false);
  });

  it("returns isResumed true when session was resumed", async () => {
    assessSessionResumeEligibilityMock.mockResolvedValue({
      canResume: true,
      session: {
        sessionId: "resumable-session",
        userId: "user-resume",
        threadId: "existing-thread",
        workingDirectory: cwd,
        status: "active" as const,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    setMockEvents([
      { type: "thread.started", thread_id: "existing-thread" },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        prompt: "resume session",
        auto: "low",
        out: "text",
        cw: cwd,
        sessionId: "resumable-session",
        userId: "user-resume",
      },
    });

    expect(result.sessionState).toBeDefined();
    expect(result.sessionState?.sessionId).toBe("resumable-session");
    expect(result.sessionState?.isResumed).toBe(true);
    expect(result.sessionState?.canResume).toBe(true);
  });

  it("handles missing token usage gracefully", async () => {
    setMockEvents([
      { type: "thread.started", thread_id: "thread-no-usage" },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        prompt: "no usage data",
        auto: "read",
        out: "text",
        cw: cwd,
      },
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.agentName).toBe("codex");
    expect(result.metadata?.tokenUsage).toBeUndefined();
  });
});
