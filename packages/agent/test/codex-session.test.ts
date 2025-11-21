import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { sessionManager } from "../src/orchestrator/codex-session";

describe("CodexSessionManager", () => {
  const sessionId = "test-session-1";
  const threadId = "thread-123";

  beforeEach(() => {
    // Clean up any existing sessions
    sessionManager.terminateSession(sessionId);
  });

  afterEach(() => {
    sessionManager.terminateSession(sessionId);
  });

  it("creates a new session with active status", () => {
    const session = sessionManager.createSession(sessionId, threadId);
    expect(session.sessionId).toBe(sessionId);
    expect(session.threadId).toBe(threadId);
    expect(session.status).toBe("active");
    expect(session.createdAt).toBeGreaterThan(0);
    expect(session.lastAccessedAt).toBe(session.createdAt);
  });

  it("retrieves an existing session and updates lastAccessedAt", () => {
    const created = sessionManager.createSession(sessionId, threadId);
    const createdAt = created.lastAccessedAt;

    // Small delay to ensure timestamp difference
    const retrieved = sessionManager.getSession(sessionId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe(sessionId);
    expect(retrieved?.lastAccessedAt).toBeGreaterThanOrEqual(createdAt);
  });

  it("returns undefined for non-existent session", () => {
    const result = sessionManager.getSession("nonexistent");
    expect(result).toBeUndefined();
  });

  it("updates session status and thread", () => {
    sessionManager.createSession(sessionId, threadId);
    const updated = sessionManager.updateSession(sessionId, {
      status: "completed",
      threadId: "thread-456",
    });
    expect(updated?.status).toBe("completed");
    expect(updated?.threadId).toBe("thread-456");
  });

  it("terminates a session successfully", () => {
    sessionManager.createSession(sessionId, threadId);
    sessionManager.terminateSession(sessionId);
    const retrieved = sessionManager.getSession(sessionId);
    expect(retrieved).toBeUndefined();
  });

  it("handles linearIssueId in session state", () => {
    sessionManager.createSession(sessionId, threadId);
    const updated = sessionManager.updateSession(sessionId, {
      linearIssueId: "ISS-123",
    });
    expect(updated?.linearIssueId).toBe("ISS-123");
  });
});

