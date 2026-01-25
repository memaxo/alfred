import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";

import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const listSessionsMock = vi.fn();
const getSessionMock = vi.fn();
const getSessionRepoMock = vi.fn();

mock.module("@alfred/agent/orchestrator/codex-session", () => ({
  sessionManager: {
    getSession: getSessionMock,
    terminateSession: vi.fn().mockResolvedValue(),
  },
}));

// Mock only the specific repos used by the codex router
// Other repos are stubbed as empty objects to prevent import errors
mock.module("@alfred/db", () => ({
  codexSessionRepo: {
    listSessions: listSessionsMock,
    getSession: getSessionRepoMock,
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    getSessionById: vi.fn(),
    cleanupExpiredSessions: vi.fn(),
  },
  codexRunRepo: {
    createRun: vi.fn(),
    getRunById: vi.fn(),
    getRunsByUser: vi.fn(),
    listEvents: vi.fn(),
    searchEvents: vi.fn(),
    appendEvents: vi.fn(),
  },
  // Stub other repos that might be transitively imported
  assistantRepo: {},
  codexLearningRepo: {},
  cognitiveRepo: {},
  conversationRepo: {},
  deployRepo: {},
  evalRepo: {},
  graphRepo: {},
  linearRepo: {},
  policyRepo: {},
  ragRepo: {},
  userRepo: {},
  workflowRepo: {},
  // Stub schemas
  assistantSchema: {},
  codexSchema: {},
  conversationSchema: {},
  deploySchema: {},
  evalSchema: {},
  graphSchema: {},
  linearSchema: {},
  policySchema: {},
  ragSchema: {},
  userSchema: {},
  workflowSchema: {},
}));

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: vi.fn().mockResolvedValue({ result: "", artifacts: [] }),
  },
}));

mock.module("@alfred/agent/src/metrics", () => ({
  recordCodexExecRun: vi.fn(),
  recordCodexError: vi.fn(),
  recordCodexWriterError: vi.fn(),
  recordCodexSessionViolation: vi.fn(),
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
  listSessionsMock.mockReset();
  getSessionMock.mockReset();
  getSessionRepoMock.mockReset();
});

describe("codex session router", () => {
  describe("listSessions", () => {
    it("returns empty list when no sessions", async () => {
      listSessionsMock.mockResolvedValueOnce([]);

      const result = await caller.codex.listSessions({});

      expect(result).toEqual([]);
      expect(listSessionsMock).toHaveBeenCalledTimes(1);
      expect(listSessionsMock).toHaveBeenCalledWith({
        userId: expect.any(String),
        status: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it("returns sessions with status filter", async () => {
      const sessions = [
        {
          sessionId: "session-1",
          userId: "test-user",
          threadId: "thread-1",
          workingDirectory: "/project",
          status: "active",
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      ];
      listSessionsMock.mockResolvedValueOnce(sessions);

      const result = await caller.codex.listSessions({ status: "active" });

      expect(result).toEqual(sessions);
      expect(listSessionsMock).toHaveBeenCalledWith({
        userId: expect.any(String),
        status: "active",
        limit: undefined,
        offset: undefined,
      });
    });

    it("applies pagination parameters", async () => {
      listSessionsMock.mockResolvedValueOnce([]);

      await caller.codex.listSessions({ limit: 10, offset: 20 });

      expect(listSessionsMock).toHaveBeenCalledWith({
        userId: expect.any(String),
        status: undefined,
        limit: 10,
        offset: 20,
      });
    });
  });

  describe("getSession", () => {
    it("returns session when found", async () => {
      const session = {
        sessionId: "session-123",
        userId: "test-user",
        threadId: "thread-456",
        workingDirectory: "/project",
        status: "active",
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      };
      getSessionMock.mockResolvedValueOnce(session);

      const result = await caller.codex.getSession({
        sessionId: "session-123",
      });

      expect(result).toEqual(session);
      expect(getSessionMock).toHaveBeenCalledWith(
        "session-123",
        expect.any(String)
      );
    });

    it("throws NOT_FOUND when session does not exist", async () => {
      getSessionMock.mockResolvedValueOnce(null);

      await expect(
        caller.codex.getSession({ sessionId: "nonexistent" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "codex_session_not_found",
      });
    });
  });

  describe("terminateSession", () => {
    it("terminates session when found", async () => {
      const session = {
        sessionId: "session-123",
        userId: "test-user",
        threadId: "thread-456",
        workingDirectory: "/project",
        status: "active",
      };
      getSessionRepoMock.mockResolvedValueOnce(session);

      const result = await caller.codex.terminateSession({
        sessionId: "session-123",
      });

      expect(result).toEqual({ success: true });
      expect(getSessionRepoMock).toHaveBeenCalledWith(
        "session-123",
        expect.any(String)
      );
    });

    it("throws NOT_FOUND when session does not exist", async () => {
      getSessionRepoMock.mockResolvedValueOnce(null);

      await expect(
        caller.codex.terminateSession({ sessionId: "nonexistent" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "codex_session_not_found",
      });
    });
  });
});
