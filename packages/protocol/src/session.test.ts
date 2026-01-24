import { describe, expect, it } from "bun:test";

import {
  responseSessionStateSchema,
  sessionResumeResultSchema,
  sessionStateSchema,
  sessionStatusSchema,
} from "./session";

describe("sessionStatusSchema", () => {
  it("validates all status values", () => {
    for (const status of ["active", "completed", "failed"]) {
      const result = sessionStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = sessionStatusSchema.safeParse("pending");
    expect(result.success).toBe(false);
  });
});

describe("sessionStateSchema", () => {
  it("validates full session state", () => {
    const state = {
      sessionId: "session-123",
      userId: "user-456",
      threadId: "thread-789",
      workingDirectory: "/home/user/project",
      status: "active",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
    };
    const result = sessionStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("validates session state with linearIssueId", () => {
    const state = {
      sessionId: "session-123",
      userId: "user-456",
      threadId: "thread-789",
      workingDirectory: "/home/user/project",
      status: "active",
      linearIssueId: "ALF-123",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
    };
    const result = sessionStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const state = {
      sessionId: "session-123",
      // missing userId, threadId, etc.
    };
    const result = sessionStateSchema.safeParse(state);
    expect(result.success).toBe(false);
  });

  it("rejects empty strings for required fields", () => {
    const state = {
      sessionId: "",
      userId: "user-456",
      threadId: "thread-789",
      workingDirectory: "/home/user/project",
      status: "active",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + 86_400_000,
    };
    const result = sessionStateSchema.safeParse(state);
    expect(result.success).toBe(false);
  });
});

describe("sessionResumeResultSchema", () => {
  it("validates successful resume result", () => {
    const result = {
      canResume: true,
      session: {
        sessionId: "session-123",
        userId: "user-456",
        threadId: "thread-789",
        workingDirectory: "/home/user/project",
        status: "active",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        expiresAt: Date.now() + 86_400_000,
      },
    };
    const parsed = sessionResumeResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("validates failed resume with all reason types", () => {
    const reasons = [
      "missing-session",
      "missing-thread",
      "missing-working-directory",
      "directory-mismatch",
      "thread-invalid",
      "timeout",
    ] as const;

    for (const reason of reasons) {
      const result = { canResume: false, reason };
      const parsed = sessionResumeResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects invalid reason", () => {
    const result = { canResume: false, reason: "unknown-reason" };
    const parsed = sessionResumeResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });

  it("rejects canResume: true without session", () => {
    const result = { canResume: true };
    const parsed = sessionResumeResultSchema.safeParse(result);
    expect(parsed.success).toBe(false);
  });
});

describe("responseSessionStateSchema", () => {
  it("validates minimal response session state", () => {
    const state = {
      sessionId: "session-123",
      threadId: "thread-789",
      canResume: true,
    };
    const result = responseSessionStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("validates full response session state", () => {
    const state = {
      sessionId: "session-123",
      threadId: "thread-789",
      canResume: true,
      resumeReason: undefined,
      isResumed: true,
    };
    const result = responseSessionStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("validates failed resume state with reason", () => {
    const state = {
      sessionId: "session-123",
      threadId: "",
      canResume: false,
      resumeReason: "thread-invalid",
      isResumed: false,
    };
    const result = responseSessionStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it("allows empty threadId when canResume is false", () => {
    const state = {
      sessionId: "session-123",
      threadId: "",
      canResume: false,
    };
    const result = responseSessionStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });
});
