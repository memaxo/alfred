import { LRUCache } from "lru-cache";

export type CodexSessionState = {
  sessionId: string;
  threadId: string;
  createdAt: number;
  lastAccessedAt: number;
  status: "active" | "completed" | "failed";
  linearIssueId?: string;
};

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 60 * 60;
const HOURS_PER_DAY = 24;
const SESSION_TTL_MS =
  MILLISECONDS_PER_SECOND * SECONDS_PER_HOUR * HOURS_PER_DAY;

export class CodexSessionManager {
  private readonly sessions: LRUCache<string, CodexSessionState>;
  private trackContinuity?: (status: "success" | "failure") => void;
  // In a real implementation, we would persist this map to a DB or file.
  // For now, we use an in-memory LRU cache.

  constructor() {
    this.sessions = new LRUCache({
      max: 100,
      ttl: SESSION_TTL_MS,
    });
  }

  configureContinuityMetrics(
    track: (status: "success" | "failure") => void
  ): void {
    this.trackContinuity = track;
  }

  getSession(sessionId: string): CodexSessionState | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.trackContinuity?.("failure");
      return;
    }
    this.trackContinuity?.("success");
    const next: CodexSessionState = {
      ...session,
      lastAccessedAt: Date.now(),
    };
    this.sessions.set(sessionId, next);
    return next;
  }

  createSession(sessionId: string, threadId: string): CodexSessionState {
    const now = Date.now();
    const session: CodexSessionState = {
      sessionId,
      threadId,
      createdAt: now,
      lastAccessedAt: now,
      status: "active",
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  updateSession(
    sessionId: string,
    patch: Partial<
      Pick<CodexSessionState, "threadId" | "linearIssueId" | "status">
    >
  ): CodexSessionState | undefined {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return;
    }
    const next: CodexSessionState = {
      ...existing,
      ...patch,
      lastAccessedAt: Date.now(),
    };
    this.sessions.set(sessionId, next);
    return next;
  }

  terminateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export const sessionManager = new CodexSessionManager();
