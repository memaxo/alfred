import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import type { Obligation } from "@alfred/type";

const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
const consumeRouteRateLimitMock = vi.fn().mockResolvedValue(undefined);
const policyDecisionIncMock = vi.fn();
const policyObligationIncMock = vi.fn();

const evaluateMock = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] as Obligation[] });

beforeAll(() => {
  mock.module("@alfred/db/repo/policy", () => ({
    createAuditLog: createAuditLogMock,
  }));

  mock.module("@alfred/api/trpc", () => ({
    consumeRouteRateLimit: consumeRouteRateLimitMock,
  }));

  mock.module("../src/metrics", () => ({
    policyDecisionsTotal: {
      labels: vi.fn(() => ({ inc: policyDecisionIncMock })),
    },
    policyObligationsTotal: {
      labels: vi.fn(() => ({ inc: policyObligationIncMock })),
    },
  }));

  mock.module("@alfred/policy", () => ({
    evaluate: evaluateMock,
    registerCacheObs: vi.fn(),
  }));
});

let enforceModule: any;

const baseSession = {
  user: { id: "user-1", roles: ["owner"], scopes: ["workflow.plan"] },
} as any;

const baseInput = {
  requirement: "Test",
  auto: "low",
  mode: "sequential",
} as any;

describe("enforceWorkflowPlanPolicy", () => {
  beforeEach(async () => {
    // Re-import to ensure we get the latest mock
    enforceModule = await import("../src/workflow/access");

    vi.clearAllMocks();
    // Ensure mock behavior is reset to default
    evaluateMock.mockReset();
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
  });

  it("throws when session is missing", async () => {
    await expect(
      enforceModule.enforceWorkflowPlanPolicy({
        session: null,
        input: baseInput,
      })
    ).rejects.toMatchObject({ message: "session_required", statusCode: 401 });
    expect(consumeRouteRateLimitMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  const bioObligation: Obligation = {
    type: "biometric",
    reason: "biometric_required",
    metadata: { code: "requireBio" },
  };

  it("propagates policy denials with status 403", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: false,
      reason: "policy_denied",
      obligations: [bioObligation],
    });

    await expect(
      enforceModule.enforceWorkflowPlanPolicy({
        session: baseSession,
        input: baseInput,
      })
    ).rejects.toMatchObject({ message: "policy_denied", statusCode: 403 });

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "deny" })
    );
    expect(policyObligationIncMock).toHaveBeenCalled();
  });

  it("returns obligations and consumes the shared rate limit when allowed", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: true,
      obligations: [bioObligation],
    });

    const result = await enforceModule.enforceWorkflowPlanPolicy({
      session: baseSession,
      input: baseInput,
    });

    expect(result).toEqual({ obligations: [bioObligation] });
    expect(consumeRouteRateLimitMock).toHaveBeenCalledWith(
      "workflow.stream",
      "user-1"
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "allow" })
    );
    expect(policyDecisionIncMock).toHaveBeenCalled();
    expect(policyObligationIncMock).toHaveBeenCalled();
  });
});
