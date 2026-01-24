import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

interface ThreadEvent {
  type: string;
  [key: string]: unknown;
}

let pendingEvents: ThreadEvent[] = [];
let shouldInvokeSpawn = false;
let observedPrompt: string | null = null;

function setMockEvents(events: ThreadEvent[]) {
  pendingEvents = events;
}

const _noop = () => {};

const assessSessionResumeEligibilityMock = mock(() =>
  Promise.resolve({
    canResume: false as const,
    reason: "missing-session" as const,
  })
);

const getSessionMock = mock(() => {});
const createSessionMock = mock(() => {});

// Ensure the exec.ts dependency on definition.js is resolved to the TS module.
const definitionModule =
  await import("../src/orchestrator/tool/codex/definition.ts");
beforeAll(() => {
  // Keep module mocks inside beforeAll so we don't poison unrelated test files
  // during Bun's initial module load pass.
  mock.module("../src/orchestrator/codex-session.js", () => ({
    assessSessionResumeEligibility: assessSessionResumeEligibilityMock,
    sessionManager: {
      createSession: (...args: Parameters<typeof createSessionMock>) =>
        createSessionMock(...args),
      getSession: (...args: Parameters<typeof getSessionMock>) =>
        getSessionMock(...args),
    },
  }));

  mock.module(
    "../src/orchestrator/tool/codex/definition.js",
    () => definitionModule
  );

  mock.module("@alfred/codex", () => ({
    async *runStreamed(opts: {
      cmd: string;
      prompt: string;
      env?: Record<string, string>;
      spawn?: (args: {
        cmd: string;
        args: string[];
        env?: Record<string, string>;
      }) => unknown;
    }) {
      observedPrompt = opts.prompt;
      if (shouldInvokeSpawn) {
        // Exercise the tool-provided spawn wrapper (docker/poof/host selection).
        // This lets tests assert docker `--workdir` behavior deterministically.
        const spawned = opts.spawn?.({
          args: ["--version"],
          cmd: opts.cmd,
          env: opts.env,
        });
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
});

const buildCodexLearningContextMock = mock(() =>
  Promise.resolve<string | null>(null)
);
const buildCodexHeuristicContextMock = mock(() =>
  Promise.resolve<string | null>(null)
);

let executeWithCodex: typeof import("@alfred/agent/orchestrator/tool/codex/exec").executeWithCodex;
let codexServerInternals: typeof import("@alfred/agent/orchestrator/tool/codex/server").__internals;

beforeAll(async () => {
  mock.module("@alfred/db/repo/codex-learning", () => ({
    buildCodexHeuristicContext: (
      ...args: Parameters<typeof buildCodexHeuristicContextMock>
    ) => buildCodexHeuristicContextMock(...args),
    buildCodexLearningContext: (
      ...args: Parameters<typeof buildCodexLearningContextMock>
    ) => buildCodexLearningContextMock(...args),
  }));

  ({ executeWithCodex } =
    await import("@alfred/agent/orchestrator/tool/codex/exec"));

  ({ __internals: codexServerInternals } =
    await import("@alfred/agent/orchestrator/tool/codex/server"));
});

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
      { thread_id: "thread-event", type: "thread.started" },
      {
        item: {
          id: "item-1",
          type: "agent_message",
          text: "File update complete",
        },
        type: "item.completed",
      },
      {
        item: {
          id: "item-2",
          type: "file_change",
          status: "completed",
          changes: [
            { path: "src/app.ts", kind: "update" },
            { path: "README.md", kind: "add" },
          ],
        },
        type: "item.completed",
      },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        auto: "read",
        cw: process.cwd(),
        out: "text",
        prompt: "summarize updates",
      },
    });

    expect(result.artifacts).toEqual([
      { kind: "update", path: "src/app.ts" },
      { kind: "add", path: "README.md" },
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

    setMockEvents([{ thread_id: "thread-event", type: "thread.started" }]);

    const prompt = "resolve merge conflict markers";
    await executeWithCodex({
      input: {
        action: "exec",
        auto: "read",
        cw: process.cwd(),
        out: "text",
        prompt,
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
        `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\nexit 0\n`,
        "utf8"
      );
      await chmod(dockerPath, 0o755);

      process.env.PATH = `${binDir}${path.delimiter}${prevPath ?? ""}`;

      shouldInvokeSpawn = true;
      setMockEvents([{ thread_id: "thread-event", type: "thread.started" }]);

      await executeWithCodex({
        input: {
          action: "exec",
          auto: "read",
          containerCw: "/workspace/.agent/worktrees/run/agent",
          containerName: "alfred-agentfs-container-123",
          cw: process.cwd(),
          execProfile: "default",
          out: "text",
          prompt: "noop",
        },
      });

      const argsText = await Bun.file(argsPath).text();
      expect(argsText).toContain("exec");
      expect(argsText).toContain("--workdir");
      expect(argsText).toContain("/workspace/.agent/worktrees/run/agent");
      expect(argsText).toContain("alfred-agentfs-container-123");
    } finally {
      process.env.PATH = prevPath;
      await rm(binDir, { force: true, recursive: true });
    }
  });
});

describe("executeWithCodex execProfile defaults", () => {
  it("falls back to default when server start fails and strict is off", async () => {
    // Provide a fake docker binary in PATH so resolveExecutable("docker") succeeds.
    const binDir = await mkdtemp(path.join(tmpdir(), "codex-docker-bin-"));
    const prevPath = process.env.PATH;
    try {
      const dockerPath = path.join(binDir, "docker");
      await writeFile(dockerPath, "#!/bin/sh\nexit 0\n", "utf8");
      await chmod(dockerPath, 0o755);

      process.env.PATH = `${binDir}${path.delimiter}${prevPath ?? ""}`;
      process.env.ORCH_EXEC_PROFILE_STRICT = "0";

      // Force server start failure while allowing default mode to proceed.
      codexServerInternals.setSpawn(() => {
        throw new Error("spawn_failed");
      });

      setMockEvents([{ thread_id: "thread-event", type: "thread.started" }]);

      const notices: string[] = [];
      const writer = {
        write: (chunk: unknown) => {
          if (!chunk || typeof chunk !== "object") {
            return;
          }
          const msg = (chunk as any).message;
          if (typeof msg === "string") {
            notices.push(msg);
          }
        },
      };

      await executeWithCodex({
        input: {
          action: "exec",
          auto: "read",
          containerCw: "/workspace",
          containerName: "alfred-agentfs-container-123",
          cw: process.cwd(),
          out: "text",
          prompt: "noop",
        },
        writer,
      });

      expect(notices).toContain("executor_server_fallback_default");
    } finally {
      process.env.PATH = prevPath;
      process.env.ORCH_EXEC_PROFILE_STRICT = undefined;
      codexServerInternals.resetSpawn();
      await rm(binDir, { force: true, recursive: true });
    }
  });

  it("throws when server start fails and strict is on", async () => {
    const binDir = await mkdtemp(path.join(tmpdir(), "codex-docker-bin-"));
    const prevPath = process.env.PATH;
    try {
      const dockerPath = path.join(binDir, "docker");
      await writeFile(dockerPath, "#!/bin/sh\nexit 0\n", "utf8");
      await chmod(dockerPath, 0o755);

      process.env.PATH = `${binDir}${path.delimiter}${prevPath ?? ""}`;
      process.env.ORCH_EXEC_PROFILE_STRICT = "1";

      codexServerInternals.setSpawn(() => {
        throw new Error("spawn_failed");
      });

      setMockEvents([{ thread_id: "thread-event", type: "thread.started" }]);

      await expect(
        executeWithCodex({
          input: {
            action: "exec",
            auto: "read",
            containerCw: "/workspace",
            containerName: "alfred-agentfs-container-123",
            cw: process.cwd(),
            out: "text",
            prompt: "noop",
          },
        })
      ).rejects.toThrow("codex_server_start_failed");
    } finally {
      process.env.PATH = prevPath;
      process.env.ORCH_EXEC_PROFILE_STRICT = undefined;
      codexServerInternals.resetSpawn();
      await rm(binDir, { force: true, recursive: true });
    }
  });
});

describe("executeWithCodex session security", () => {
  const cwd = process.cwd();

  it("throws when sessionId is provided without a userId", async () => {
    setMockEvents([{ thread_id: "thread-event", type: "thread.started" }]);

    await expect(
      executeWithCodex({
        input: {
          action: "exec",
          auto: "read",
          cw: cwd,
          out: "text",
          prompt: "ls",
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

    setMockEvents([{ thread_id: "thread-event", type: "thread.started" }]);

    await expect(
      executeWithCodex({
        input: {
          action: "exec",
          auto: "read",
          cw: cwd,
          out: "text",
          prompt: "resume",
          sessionId: "shared-session",
          userId: "intruder",
        },
      })
    ).rejects.toThrow("codex_session_forbidden");

    expect(getSessionMock).toHaveBeenCalledWith("shared-session", "intruder");
  });

  it("binds new sessions to the requesting user", async () => {
    setMockEvents([{ thread_id: "thread-created", type: "thread.started" }]);

    await executeWithCodex({
      input: {
        action: "exec",
        auto: "read",
        cw: cwd,
        out: "text",
        prompt: "new session",
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
      { thread_id: "thread-meta-123", type: "thread.started" },
      { type: "turn.started" },
      {
        type: "turn.completed",
        usage: {
          cached_input_tokens: 25,
          input_tokens: 150,
          output_tokens: 200,
        },
      },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        auto: "medium",
        cw: cwd,
        out: "text",
        prompt: "test metadata",
      },
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.agentName).toBe("codex");
    expect(result.metadata?.threadId).toBe("thread-meta-123");
    expect(result.metadata?.autonomyLevel).toBe("medium");
    expect(result.metadata?.tokenUsage).toEqual({
      cachedInputTokens: 25,
      inputTokens: 150,
      outputTokens: 200,
    });
    expect(result.metadata?.turnDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns sessionState in the result", async () => {
    assessSessionResumeEligibilityMock.mockResolvedValue({
      canResume: false,
      reason: "missing-session",
    });
    setMockEvents([
      { thread_id: "thread-session-456", type: "thread.started" },
    ]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        auto: "low",
        cw: cwd,
        out: "text",
        prompt: "test session state",
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
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        lastAccessedAt: new Date(),
        sessionId: "resumable-session",
        status: "active" as const,
        threadId: "existing-thread",
        userId: "user-resume",
        workingDirectory: cwd,
      },
    });
    setMockEvents([{ thread_id: "existing-thread", type: "thread.started" }]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        auto: "low",
        cw: cwd,
        out: "text",
        prompt: "resume session",
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
    setMockEvents([{ thread_id: "thread-no-usage", type: "thread.started" }]);

    const result = await executeWithCodex({
      input: {
        action: "exec",
        auto: "read",
        cw: cwd,
        out: "text",
        prompt: "no usage data",
      },
    });

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.agentName).toBe("codex");
    expect(result.metadata?.tokenUsage).toBeUndefined();
  });
});
