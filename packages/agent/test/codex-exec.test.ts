import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

type ThreadEvent = { type: string; [key: string]: unknown };

let pendingEvents: ThreadEvent[] = [];
let shouldInvokeSpawn = false;
let observedSpawnCmd: string | null = null;
let observedSpawnArgs: string[] | null = null;

function setMockEvents(events: ThreadEvent[]) {
  pendingEvents = events;
}

const noop = () => {};

const spawnWithSecureCwdMock = mock(
  ({
    cmd,
    args,
  }: {
    cmd: string;
    args: string[];
    env?: Record<string, string>;
  }) => {
    observedSpawnCmd = cmd;
    observedSpawnArgs = args;
    return {
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      kill: () => {},
    };
  }
);

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

// Capture docker exec args when container mode is active.
mock.module("../src/security/secure-spawn.js", () => ({
  spawnWithSecureCwd: (...args: Parameters<typeof spawnWithSecureCwdMock>) =>
    spawnWithSecureCwdMock(...args),
}));

mock.module("@alfred/codex", () => ({
  runStreamed: async function* (opts: {
    cmd: string;
    env?: Record<string, string>;
    spawn?: (args: { cmd: string; args: string[]; env?: Record<string, string> }) => unknown;
  }) {
    if (shouldInvokeSpawn) {
      // Exercise the tool-provided spawn wrapper (docker/poof/host selection).
      // This lets tests assert docker `--workdir` behavior deterministically.
      await opts.spawn?.({ cmd: opts.cmd, args: ["--version"], env: opts.env });
    }
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
  shouldInvokeSpawn = false;
  observedSpawnCmd = null;
  observedSpawnArgs = null;
  spawnWithSecureCwdMock.mockClear();

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

describe("executeWithCodex container workdir", () => {
  it("uses containerCw as docker exec --workdir when provided", async () => {
    // Provide a fake docker binary in PATH so resolveExecutable("docker") succeeds.
    const binDir = await mkdtemp(path.join(tmpdir(), "codex-docker-bin-"));
    const prevPath = process.env.PATH;
    try {
      const dockerPath = path.join(binDir, "docker");
      await writeFile(dockerPath, "#!/bin/sh\nexit 0\n", "utf8");
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

      expect(spawnWithSecureCwdMock).toHaveBeenCalled();
      expect(observedSpawnCmd).toBeTruthy();
      expect(observedSpawnArgs).toBeTruthy();
      expect(observedSpawnArgs).toContain("exec");
      expect(observedSpawnArgs).toContain("--workdir");
      expect(observedSpawnArgs).toContain("/workspace/.agent/worktrees/run/agent");
      expect(observedSpawnArgs).toContain("container-123");
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
