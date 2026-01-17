// SKIP: This test uses mock.module() at the top level which causes Bun's module
// cache pollution when run with other tests. The test passes in isolation.
// NOTE: Refactor to use dependency injection instead of mock.module().
import { afterEach, describe, expect, it, mock, vi } from "bun:test";

const SHOULD_RUN = process.env.RUN_VOICE_STREAMING_TESTS === "1";

// Dynamic variables to be set when test runs
let getSessionMock: ReturnType<typeof vi.fn>;
let evaluateMock: ReturnType<typeof vi.fn>;
let createAuditLogMock: ReturnType<typeof vi.fn>;
let authorizeVoiceStreamRequest: any;
let VoiceStreamAuthError: any;

// Only setup mocks and imports when tests should run
if (SHOULD_RUN) {
  await import("./utils/agent-mock");
  const { policyStub } = await import("./utils/mock-metrics");

  getSessionMock = vi.fn();
  mock.module("@alfred/auth", () => ({
    auth: {
      api: {
        getSession: getSessionMock,
      },
    },
  }));

  evaluateMock = policyStub.evaluate;

  createAuditLogMock = vi.fn();
  mock.module("@alfred/db/repo/policy", () => ({
    createAuditLog: createAuditLogMock,
  }));

  const streaming = await import("../src/voice/streaming");
  authorizeVoiceStreamRequest = streaming.authorizeVoiceStreamRequest;
  VoiceStreamAuthError = streaming.VoiceStreamAuthError;
}

const describeFn = SHOULD_RUN ? describe : describe.skip;

describeFn("authorizeVoiceStreamRequest", () => {
  afterEach(() => {
    getSessionMock.mockReset();
    evaluateMock.mockReset();
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
    createAuditLogMock.mockReset();
  });

  it("rejects when session is missing", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    await expect(
      authorizeVoiceStreamRequest(new Request("http://localhost/voice/stream"))
    ).rejects.toThrowError(VoiceStreamAuthError);

    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("allows authorized sessions and evaluates both policies", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: { id: "user-123", roles: ["owner"], scopes: ["voice"] },
    });
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });

    const result = await authorizeVoiceStreamRequest(
      new Request("http://localhost/voice/stream")
    );

    expect(result).toEqual({ userId: "user-123" });
    expect(evaluateMock).toHaveBeenCalledTimes(2);
    expect(createAuditLogMock).toHaveBeenCalledTimes(2);
  });

  it("rejects when policy denies access", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    evaluateMock.mockResolvedValueOnce({
      allow: false,
      reason: "denied",
      obligations: [],
    });

    await expect(
      authorizeVoiceStreamRequest(new Request("http://localhost/voice/stream"))
    ).rejects.toThrowError(VoiceStreamAuthError);

    expect(evaluateMock).toHaveBeenCalledTimes(1);
    expect(createAuditLogMock).toHaveBeenCalledTimes(1);
  });
});
