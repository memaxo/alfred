import { afterEach, describe, expect, it, mock, vi } from "bun:test";
import "./utils/agent-mock";
import { policyStub } from "./utils/mock-metrics";

const getSessionMock = vi.fn();
mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

const evaluateMock = policyStub.evaluate;

const createAuditLogMock = vi.fn();
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: createAuditLogMock,
}));

const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerDebugMock = vi.fn();
mock.module("@alfred/logger", () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
    error: loggerErrorMock,
    debug: loggerDebugMock,
  },
}));

const { authorizeVoiceStreamRequest, VoiceStreamAuthError } = await import(
  "../src/voice/streaming"
);

afterEach(() => {
  getSessionMock.mockReset();
  evaluateMock.mockReset();
  evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
  createAuditLogMock.mockReset();
});

describe("authorizeVoiceStreamRequest", () => {
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
