import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: createAuditLogMock,
}));

const consumeRouteRateLimitMock = vi.fn().mockResolvedValue(undefined);
mock.module("@alfred/api/trpc", () => ({
  consumeRouteRateLimit: consumeRouteRateLimitMock,
}));

const policyDecisionIncMock = vi.fn();
const policyObligationIncMock = vi.fn();

mock.module("../src/metrics", () => ({
  policyDecisionsTotal: {
    labels: vi.fn(() => ({ inc: policyDecisionIncMock })),
  },
  policyObligationsTotal: {
    labels: vi.fn(() => ({ inc: policyObligationIncMock })),
  },
}));

const evaluateMock = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] as string[] });

mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: vi.fn(),
}));

const { enforceWorkflowPlanPolicy } = await import("../src/workflow/access");

const baseSession = {
  user: { id: "user-1", roles: ["owner"], scopes: ["workflow.plan"] },
} as any;

const baseInput = {
  requirement: "Test",
  auto: "low",
  mode: "sequential",
} as any;

describe("enforceWorkflowPlanPolicy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
  });

  it("throws when session is missing", async () => {
    await expect(
      enforceWorkflowPlanPolicy({ session: null, input: baseInput })
    ).rejects.toMatchObject({ message: "session_required", statusCode: 401 });
    expect(consumeRouteRateLimitMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("propagates policy denials with status 403", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: false,
      reason: "policy_denied",
      obligations: ["requireBio"],
    });

    await expect(
      enforceWorkflowPlanPolicy({ session: baseSession, input: baseInput })
    ).rejects.toMatchObject({ message: "policy_denied", statusCode: 403 });

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "deny" })
    );
    expect(policyObligationIncMock).toHaveBeenCalled();
  });

  it("returns obligations and consumes the shared rate limit when allowed", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: true,
      obligations: ["requireBio"],
    });

    const result = await enforceWorkflowPlanPolicy({
      session: baseSession,
      input: baseInput,
    });

    expect(result).toEqual({ obligations: ["requireBio"] });
    expect(consumeRouteRateLimitMock).toHaveBeenCalledWith(
      "user-1",
      "workflow.stream",
      "subscription"
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "allow" })
    );
    expect(policyDecisionIncMock).toHaveBeenCalled();
    expect(policyObligationIncMock).toHaveBeenCalled();
  });
});
