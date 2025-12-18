import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import type { CodexSessionState } from "../src/orchestrator/codex-session";

type RepoRecord = {
  sessionId: string;
  userId: string;
  threadId: string;
  workingDirectory: string;
  status: "active" | "completed" | "failed";
  linearIssueId: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
};

const repoStore = new Map<string, RepoRecord>();

function cloneRecord(record: RepoRecord): RepoRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    lastAccessedAt: new Date(record.lastAccessedAt),
    expiresAt: new Date(record.expiresAt),
  };
}

const createSessionRepoMock = vi.fn((record: unknown) => {
  const r = record as RepoRecord;
  const stored: RepoRecord = {
    sessionId: r.sessionId,
    userId: r.userId,
    threadId: r.threadId,
    workingDirectory: r.workingDirectory,
    status: r.status,
    linearIssueId: r.linearIssueId ?? null,
    createdAt: new Date(r.createdAt),
    lastAccessedAt: new Date(r.lastAccessedAt),
    expiresAt: new Date(r.expiresAt),
  };
  repoStore.set(stored.sessionId, stored);
  return Promise.resolve(cloneRecord(stored));
});

const getSessionRepoMock = vi.fn((sessionId: string, userId: string) => {
  const stored = repoStore.get(sessionId);
  if (!stored || stored.userId !== userId) {
    return Promise.resolve(null);
  }
  return Promise.resolve(cloneRecord(stored));
});

const getSessionByIdRepoMock = vi.fn((sessionId: string) => {
  const stored = repoStore.get(sessionId);
  return Promise.resolve(stored ? cloneRecord(stored) : null);
});

const updateSessionRepoMock = vi.fn(
  (sessionId: string, patch: Record<string, unknown>) => {
    const stored = repoStore.get(sessionId);
    if (!stored) {
      return Promise.resolve(null);
    }
    const next: RepoRecord = {
      ...stored,
      threadId: (patch.threadId as string | undefined) ?? stored.threadId,
      status:
        (patch.status as RepoRecord["status"] | undefined) ?? stored.status,
      linearIssueId:
        (patch.linearIssueId as string | null | undefined) ??
        stored.linearIssueId,
      workingDirectory:
        (patch.workingDirectory as string | undefined) ??
        stored.workingDirectory,
      lastAccessedAt: patch.lastAccessedAt
        ? new Date(patch.lastAccessedAt as Date)
        : stored.lastAccessedAt,
      expiresAt: patch.expiresAt
        ? new Date(patch.expiresAt as Date)
        : stored.expiresAt,
    };
    repoStore.set(sessionId, next);
    return Promise.resolve(cloneRecord(next));
  }
);

const deleteSessionRepoMock = vi.fn((sessionId: string) => {
  repoStore.delete(sessionId);
  return Promise.resolve(undefined);
});

const cleanupExpiredSessionsRepoMock = vi.fn(() => {
  const now = Date.now();
  let deleted = 0;
  for (const [sessionId, record] of repoStore.entries()) {
    if (record.expiresAt.getTime() <= now) {
      repoStore.delete(sessionId);
      deleted += 1;
    }
  }
  return Promise.resolve(deleted);
});

mock.module("@alfred/db/repo/codex-session", () => ({
  createSession: createSessionRepoMock,
  getSession: getSessionRepoMock,
  getSessionById: getSessionByIdRepoMock,
  updateSession: updateSessionRepoMock,
  deleteSession: deleteSessionRepoMock,
  cleanupExpiredSessions: cleanupExpiredSessionsRepoMock,
}));

const recordCodexSessionViolationMock = vi.fn();

mock.module("../src/metrics.js", () => ({
  recordCodexSessionViolation: recordCodexSessionViolationMock,
}));

let CodexSessionManagerClass:
  | typeof import("../src/orchestrator/codex-session").CodexSessionManager
  | null = null;
let sessionManager: import("../src/orchestrator/codex-session").CodexSessionManager;
let assessSessionResumeEligibility:
  | typeof import("../src/orchestrator/codex-session").assessSessionResumeEligibility
  | null = null;

beforeAll(async () => {
  const mod = await import("../src/orchestrator/codex-session");
  CodexSessionManagerClass = mod.CodexSessionManager;
  assessSessionResumeEligibility = mod.assessSessionResumeEligibility;
  sessionManager = new CodexSessionManagerClass();
});

beforeEach(() => {
  if (!CodexSessionManagerClass) {
    throw new Error("CodexSessionManagerClass not loaded");
  }
  repoStore.clear();
  createSessionRepoMock.mockClear();
  getSessionRepoMock.mockClear();
  getSessionByIdRepoMock.mockClear();
  updateSessionRepoMock.mockClear();
  deleteSessionRepoMock.mockClear();
  cleanupExpiredSessionsRepoMock.mockClear();
  recordCodexSessionViolationMock.mockClear();
  sessionManager = new CodexSessionManagerClass();
  sessionManager.configureContinuityMetrics(() => {});
});

afterEach(() => {
  sessionManager.configureContinuityMetrics(() => {});
});

function getAssessSessionResumeEligibility() {
  if (!assessSessionResumeEligibility) {
    throw new Error("assessSessionResumeEligibility not loaded");
  }
  return assessSessionResumeEligibility;
}

describe("CodexSessionManager", () => {
  const sessionId = "test-session-1";
  const threadId = "thread-123";
  const workingDirectory = "/tmp/project";
  const userId = "user-123";
  const otherUserId = "user-456";

  it("creates a new session with active status", async () => {
    const session = await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    expect(session.sessionId).toBe(sessionId);
    expect(session.threadId).toBe(threadId);
    expect(session.userId).toBe(userId);
    expect(session.workingDirectory).toBe(workingDirectory);
    expect(session.status).toBe("active");
  });

  it("retrieves an existing session and updates lastAccessedAt", async () => {
    const created = await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    const createdAt = created.lastAccessedAt;

    const retrieved = await sessionManager.getSession(sessionId, userId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe(sessionId);
    expect(retrieved?.lastAccessedAt).toBeGreaterThanOrEqual(createdAt);
  });

  it("returns undefined for non-existent session", async () => {
    const result = await sessionManager.getSession("nonexistent", userId);
    expect(result).toBeUndefined();
  });

  it("hydrates sessions from persistent storage when cache is cold", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );

    if (!CodexSessionManagerClass) {
      throw new Error("CodexSessionManagerClass not loaded");
    }
    const freshManager = new CodexSessionManagerClass();
    freshManager.configureContinuityMetrics(() => {});

    const hydrated = await freshManager.getSession(sessionId, userId);
    expect(hydrated).toBeDefined();
    expect(hydrated?.sessionId).toBe(sessionId);
    expect(getSessionRepoMock).toHaveBeenCalledTimes(1);
    expect(updateSessionRepoMock).toHaveBeenCalled();
  });

  it("updates session status and thread", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    const updated = await sessionManager.updateSession(sessionId, {
      status: "completed",
      threadId: "thread-456",
    });
    expect(updated?.status).toBe("completed");
    expect(updated?.threadId).toBe("thread-456");
  });

  it("terminates a session successfully", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    await sessionManager.terminateSession(sessionId);
    const retrieved = await sessionManager.getSession(sessionId, userId);
    expect(retrieved).toBeUndefined();
  });

  it("handles linearIssueId in session state", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    const updated = await sessionManager.updateSession(sessionId, {
      linearIssueId: "ISS-123",
    });
    expect(updated?.linearIssueId).toBe("ISS-123");
  });

  it("requires a userId when creating a session", async () => {
    await expect(
      sessionManager.createSession(sessionId, threadId, workingDirectory, "")
    ).rejects.toThrow("codex_session_user_required");
  });

  it("prevents different users from accessing each other's sessions", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    const tracker = vi.fn();
    sessionManager.configureContinuityMetrics(tracker);
    await expect(
      sessionManager.getSession(sessionId, otherUserId)
    ).rejects.toThrow("codex_session_forbidden");
    expect(tracker).toHaveBeenCalledWith("failure");
  });

  it("records failures for session ID enumeration attempts", async () => {
    const tracker = vi.fn();
    sessionManager.configureContinuityMetrics(tracker);

    await sessionManager.getSession("unknown-session-a", userId);
    await sessionManager.getSession("unknown-session-b", userId);

    expect(tracker).toHaveBeenCalledTimes(2);
    expect(tracker).toHaveBeenNthCalledWith(1, "failure");
    expect(tracker).toHaveBeenNthCalledWith(2, "failure");
  });

  it("records repository user mismatches as violations", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );

    if (!CodexSessionManagerClass) {
      throw new Error("CodexSessionManagerClass not loaded");
    }
    const freshManager = new CodexSessionManagerClass();
    freshManager.configureContinuityMetrics(() => {});

    await expect(
      freshManager.getSession(sessionId, otherUserId)
    ).rejects.toThrow("codex_session_forbidden");
    expect(recordCodexSessionViolationMock).toHaveBeenCalledWith(
      "user_mismatch_repo"
    );
    expect(getSessionByIdRepoMock).toHaveBeenCalledWith(sessionId);
  });

  it("keeps sessions isolated under concurrent access", async () => {
    await sessionManager.createSession(
      sessionId,
      threadId,
      workingDirectory,
      userId
    );
    const timestamps: number[] = [];

    await Promise.all(
      Array.from(
        { length: 5 },
        (_, idx) =>
          new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              sessionManager
                .getSession(sessionId, userId)
                .then((session) => {
                  expect(session).toBeDefined();
                  timestamps.push(session?.lastAccessedAt);
                  resolve();
                })
                .catch(reject);
            }, idx * 5);
          })
      )
    );

    expect(timestamps.length).toBe(5);
    for (let i = 1; i < timestamps.length; i += 1) {
      const prev = timestamps[i - 1];
      const curr = timestamps[i];
      if (prev !== undefined && curr !== undefined) {
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    }
  });

  describe("assessSessionResumeEligibility", () => {
    it("allows resume when working directories match", async () => {
      const session = await sessionManager.createSession(
        sessionId,
        threadId,
        workingDirectory,
        userId
      );

      const result = await getAssessSessionResumeEligibility()({
        session,
        workingDirectory,
      });

      expect(result.canResume).toBe(true);
      expect(result.session.threadId).toBe(threadId);
    });

    it("prevents resume when working directories mismatch", async () => {
      const logger = mock(() => {});
      const session = await sessionManager.createSession(
        sessionId,
        threadId,
        workingDirectory,
        userId
      );

      const result = await getAssessSessionResumeEligibility()({
        session,
        workingDirectory: "/tmp/other",
        logWarning: (event, context) => logger(event, context),
      });

      expect(result.canResume).toBe(false);
      expect(result.reason).toBe("directory-mismatch");
      expect(logger).toHaveBeenCalledWith(
        "codex_session_directory_mismatch",
        expect.objectContaining({
          sessionId,
          stored: workingDirectory,
          requested: "/tmp/other",
        })
      );
    });

    it("logs warning when legacy session lacks working directory", async () => {
      const logger = mock(() => {});
      const legacySession: CodexSessionState = {
        sessionId,
        userId,
        threadId,
        workingDirectory: undefined as unknown as string,
        status: "active",
        linearIssueId: undefined,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        expiresAt: Date.now() + 1000,
      };

      const result = await getAssessSessionResumeEligibility()({
        session: legacySession,
        workingDirectory,
        logWarning: (event, context) => logger(event, context),
      });

      expect(result.canResume).toBe(false);
      expect(result.reason).toBe("missing-working-directory");
      expect(logger).toHaveBeenCalledWith(
        "codex_session_missing_directory",
        expect.objectContaining({ sessionId })
      );
    });

    it("logs warning when validateThread reports invalid thread", async () => {
      const logger = mock(() => {});
      const session = await sessionManager.createSession(
        sessionId,
        threadId,
        workingDirectory,
        userId
      );

      const result = await getAssessSessionResumeEligibility()({
        session,
        workingDirectory,
        validateThread: async () => false,
        logWarning: (event, context) => logger(event, context),
      });

      expect(result.canResume).toBe(false);
      expect(result.reason).toBe("thread-invalid");
      expect(logger).toHaveBeenCalledWith(
        "codex_session_thread_invalid",
        expect.objectContaining({
          sessionId,
          threadId,
        })
      );
    });
  });
});
