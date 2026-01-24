import {
  type CodexSession,
  cleanupExpiredSessions as cleanupExpiredSessionsRepo,
  createSession as createSessionRepo,
  deleteSession as deleteSessionRepo,
  getSessionById as getSessionByIdRepo,
  getSession as getSessionRepo,
  type NewCodexSession,
  updateSession as updateSessionRepo,
} from "@alfred/db/repo/codex-session";
import { logger } from "@alfred/logger";
import { LRUCache } from "lru-cache";

import { recordCodexSessionViolation } from "../metrics.js";

export type CodexSessionState = {
  sessionId: string;
  userId: string;
  threadId: string;
  workingDirectory: string;
  projectId?: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  status: "active" | "completed" | "failed";
  linearIssueId?: string;
};

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 60 * 60;
const HOURS_PER_DAY = 24;
const DEFAULT_SESSION_TTL_MS =
  MILLISECONDS_PER_SECOND * SECONDS_PER_HOUR * HOURS_PER_DAY;
const SESSION_TTL_MS = normalizePositiveNumber(
  process.env.CODEX_SESSION_TTL_MS,
  DEFAULT_SESSION_TTL_MS
);
const CACHE_MAX = normalizePositiveNumber(
  process.env.CODEX_SESSION_CACHE_SIZE,
  100
);
const CLEANUP_INTERVAL_MS = normalizePositiveNumber(
  process.env.CODEX_SESSION_CLEANUP_INTERVAL_MS,
  60 * 60 * 1000
);

function normalizePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toMillis(value: Date | string | number | null | undefined): number {
  if (!value) {
    return Date.now();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return new Date(value).getTime();
}

function toState(record: CodexSession): CodexSessionState {
  return {
    sessionId: record.sessionId,
    userId: record.userId,
    threadId: record.threadId,
    workingDirectory: record.workingDirectory,
    projectId: record.projectId ?? undefined,
    status: (record.status as CodexSessionState["status"]) ?? "active",
    linearIssueId: record.linearIssueId ?? undefined,
    createdAt: toMillis(record.createdAt),
    lastAccessedAt: toMillis(record.lastAccessedAt),
    expiresAt: toMillis(record.expiresAt),
  };
}

function isExpired(state: CodexSessionState, reference = Date.now()): boolean {
  return state.expiresAt <= reference;
}

export class CodexSessionManager {
  private readonly sessions: LRUCache<string, CodexSessionState>;
  private readonly ttlMs: number;
  private trackContinuity?: (status: "success" | "failure") => void;

  constructor({ ttlMs = SESSION_TTL_MS, max = CACHE_MAX } = {}) {
    this.ttlMs = ttlMs;
    this.sessions = new LRUCache({ max, ttl: ttlMs });
  }

  configureContinuityMetrics(
    track: (status: "success" | "failure") => void
  ): void {
    this.trackContinuity = track;
  }

  async getSession(
    sessionId: string,
    userId: string
  ): Promise<CodexSessionState | undefined> {
    if (!userId) {
      recordCodexSessionViolation("missing_user");
      this.trackContinuity?.("failure");
      throw new Error("codex_session_user_required");
    }

    const cached = this.sessions.get(sessionId);
    if (cached && cached.userId === userId && !isExpired(cached)) {
      this.trackContinuity?.("success");
      return this.refreshAccess(cached);
    }

    if (cached) {
      if (cached.userId !== userId) {
        recordCodexSessionViolation("user_mismatch_cache");
      }
      this.sessions.delete(sessionId);
    }

    const record = await getSessionRepo(sessionId, userId);
    if (!record) {
      const sessionForAnotherUser = await getSessionByIdRepo(sessionId);
      if (sessionForAnotherUser && sessionForAnotherUser.userId !== userId) {
        recordCodexSessionViolation("user_mismatch_repo");
        this.trackContinuity?.("failure");
        throw new Error("codex_session_forbidden");
      }
      this.trackContinuity?.("failure");
      return;
    }

    const state = toState(record);
    if (isExpired(state)) {
      await deleteSessionRepo(sessionId);
      this.trackContinuity?.("failure");
      return;
    }

    this.trackContinuity?.("success");
    return this.refreshAccess(state);
  }

  async createSession(
    sessionId: string,
    threadId: string,
    workingDirectory: string,
    userId: string,
    options: {
      status?: CodexSessionState["status"];
      linearIssueId?: string;
      projectId?: string;
    } = {}
  ): Promise<CodexSessionState> {
    if (!userId) {
      recordCodexSessionViolation("missing_user");
      throw new Error("codex_session_user_required");
    }

    const now = Date.now();
    const expiresAt = now + this.ttlMs;
    const record = await createSessionRepo({
      sessionId,
      threadId,
      userId,
      projectId: options.projectId ?? null,
      workingDirectory,
      status: options.status ?? "active",
      linearIssueId: options.linearIssueId ?? null,
      createdAt: new Date(now),
      lastAccessedAt: new Date(now),
      expiresAt: new Date(expiresAt),
    });

    const state = toState(record);
    this.sessions.set(sessionId, state);
    return state;
  }

  async updateSession(
    sessionId: string,
    patch: Partial<
      Pick<
        CodexSessionState,
        "threadId" | "linearIssueId" | "status" | "workingDirectory"
      >
    >
  ): Promise<CodexSessionState | undefined> {
    const now = Date.now();
    const expiresAt = now + this.ttlMs;
    const updatePayload: Record<string, unknown> = {
      lastAccessedAt: new Date(now),
      expiresAt: new Date(expiresAt),
    };

    if (typeof patch.threadId === "string") {
      updatePayload.threadId = patch.threadId;
    }
    if (typeof patch.status === "string") {
      updatePayload.status = patch.status;
    }
    if (typeof patch.linearIssueId !== "undefined") {
      updatePayload.linearIssueId = patch.linearIssueId ?? null;
    }
    if (typeof patch.workingDirectory === "string") {
      updatePayload.workingDirectory = patch.workingDirectory;
    }

    const updated = await updateSessionRepo(
      sessionId,
      updatePayload as Partial<Omit<NewCodexSession, "sessionId" | "id">>
    );

    if (!updated) {
      this.sessions.delete(sessionId);
      return;
    }

    const state = toState(updated);
    this.sessions.set(sessionId, state);
    return state;
  }

  async terminateSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await deleteSessionRepo(sessionId);
  }

  private async refreshAccess(
    state: CodexSessionState
  ): Promise<CodexSessionState> {
    const now = Date.now();
    const refreshed: CodexSessionState = {
      ...state,
      lastAccessedAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.sessions.set(refreshed.sessionId, refreshed);
    await updateSessionRepo(refreshed.sessionId, {
      lastAccessedAt: new Date(refreshed.lastAccessedAt),
      expiresAt: new Date(refreshed.expiresAt),
    } as Partial<Omit<NewCodexSession, "sessionId" | "id">>);
    return refreshed;
  }
}

export const sessionManager = new CodexSessionManager();

let cleanupHandle: ReturnType<typeof setInterval> | null = null;

export function startCodexSessionCleanupWorker(
  config: { intervalMs?: number } = {}
): void {
  if (cleanupHandle) {
    return;
  }
  const intervalMs = normalizePositiveNumber(
    config.intervalMs?.toString(),
    CLEANUP_INTERVAL_MS
  );

  const runCleanup = async () => {
    try {
      const deleted = await cleanupExpiredSessionsRepo();
      if (deleted > 0) {
        logger.info("codex_session_cleanup", { deleted });
      }
    } catch (error) {
      logger.error("codex_session_cleanup_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void runCleanup();
  cleanupHandle = setInterval(runCleanup, intervalMs);
}

export function stopCodexSessionCleanupWorker(): void {
  if (cleanupHandle) {
    clearInterval(cleanupHandle);
    cleanupHandle = null;
  }
}

export type SessionResumeAssessment =
  | { canResume: true; session: CodexSessionState }
  | {
      canResume: false;
      reason:
        | "missing-session"
        | "missing-thread"
        | "missing-working-directory"
        | "directory-mismatch"
        | "thread-invalid"
        | "timeout";
    };

type WarningLogger = (event: string, context: Record<string, unknown>) => void;

export async function assessSessionResumeEligibility(params: {
  session?: CodexSessionState;
  workingDirectory: string;
  validateThread?: (threadId: string) => Promise<boolean>;
  logWarning?: WarningLogger;
}): Promise<SessionResumeAssessment> {
  const { session, workingDirectory, validateThread, logWarning } = params;
  const warn: WarningLogger = logWarning ?? ((_event, _context) => {});

  if (!session) {
    return {
      canResume: false,
      reason: "missing-session",
    };
  }

  if (!session.threadId) {
    return {
      canResume: false,
      reason: "missing-thread",
    };
  }

  if (!session.workingDirectory) {
    warn("codex_session_missing_directory", {
      sessionId: session.sessionId,
    });
    return {
      canResume: false,
      reason: "missing-working-directory",
    };
  }

  if (session.workingDirectory !== workingDirectory) {
    warn("codex_session_directory_mismatch", {
      sessionId: session.sessionId,
      stored: session.workingDirectory,
      requested: workingDirectory,
    });
    return {
      canResume: false,
      reason: "directory-mismatch",
    };
  }

  if (validateThread) {
    const isValid = await validateThread(session.threadId);
    if (!isValid) {
      warn("codex_session_thread_invalid", {
        sessionId: session.sessionId,
        threadId: session.threadId,
      });
      return {
        canResume: false,
        reason: "thread-invalid",
      };
    }
  }

  return {
    canResume: true,
    session,
  };
}
