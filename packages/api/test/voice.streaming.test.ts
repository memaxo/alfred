import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { resetAgentMocks } from "./utils/agent-mock";
import { policyStub } from "./utils/mock-metrics";

describe("authorizeVoiceStreamRequest", () => {
  let getSessionMock: ReturnType<typeof vi.fn>;
  let evaluateMock: ReturnType<typeof vi.fn>;
  let createAuditLogMock: ReturnType<typeof vi.fn>;
  let authorizeVoiceStreamRequest: typeof import("../src/voice/streaming").authorizeVoiceStreamRequest;
  let VoiceStreamAuthError: typeof import("../src/voice/streaming").VoiceStreamAuthError;

  beforeEach(async () => {
    // Setup mocks inside beforeEach to avoid module cache pollution
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

    // Import after mocks are set up
    const streaming = await import("../src/voice/streaming");
    authorizeVoiceStreamRequest = streaming.authorizeVoiceStreamRequest;
    VoiceStreamAuthError = streaming.VoiceStreamAuthError;
  });

  afterEach(() => {
    getSessionMock.mockReset();
    evaluateMock.mockReset();
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
    createAuditLogMock.mockReset();
    resetAgentMocks();
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
