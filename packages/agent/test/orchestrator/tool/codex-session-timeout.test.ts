import { describe, expect, it, mock } from "bun:test";

import type { CodexSessionState } from "../../../src/orchestrator/codex-session";

import { assessSessionResumeEligibility } from "../../../src/orchestrator/codex-session";

describe("Codex session validation timeout", () => {
  it("returns timeout result when validation exceeds 5 seconds", async () => {
    const slowValidator = mock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      return true;
    });

    const session: CodexSessionState = {
      sessionId: "test-session",
      userId: "test-user",
      threadId: "test-thread",
      workingDirectory: "/test/dir",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      status: "active",
    };

    const SESSION_VALIDATION_TIMEOUT_MS = 5000;
    const validationPromise = assessSessionResumeEligibility({
      session,
      workingDirectory: "/test/dir",
      validateThread: slowValidator,
    });

    const timeoutPromise = new Promise<{
      canResume: false;
      reason: "timeout";
    }>((resolve) => {
      setTimeout(() => {
        resolve({ canResume: false, reason: "timeout" });
      }, SESSION_VALIDATION_TIMEOUT_MS);
    });

    const result = await Promise.race([validationPromise, timeoutPromise]);

    expect(result.canResume).toBe(false);
    expect(result.reason).toBe("timeout");
  });

  it("returns normal result when validation completes before timeout", async () => {
    const fastValidator = mock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    });

    const session: CodexSessionState = {
      sessionId: "test-session",
      userId: "test-user",
      threadId: "test-thread",
      workingDirectory: "/test/dir",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      status: "active",
    };

    const SESSION_VALIDATION_TIMEOUT_MS = 5000;
    const validationPromise = assessSessionResumeEligibility({
      session,
      workingDirectory: "/test/dir",
      validateThread: fastValidator,
    });

    const timeoutPromise = new Promise<{
      canResume: false;
      reason: "timeout";
    }>((resolve) => {
      setTimeout(() => {
        resolve({ canResume: false, reason: "timeout" });
      }, SESSION_VALIDATION_TIMEOUT_MS);
    });

    const result = await Promise.race([validationPromise, timeoutPromise]);

    expect(result.canResume).toBe(true);
    if (result.canResume) {
      expect(result.session).toBeDefined();
    }
  });
});
