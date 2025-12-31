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

// Use shared policy and rate limit mocks from router-helpers
import {
  consumeRouteRateLimitMock,
  createAuditLogMock,
  mockPolicyAudit,
  mockRateLimit,
  policyEvaluateMock,
} from "./utils/router-helpers";

// Additional metrics mocks specific to this test
const policyDecisionIncMock = vi.fn();
const policyObligationIncMock = vi.fn();

beforeAll(() => {
  mockPolicyAudit();
  mockRateLimit();

  // Metrics mocks
  mock.module("../src/metrics", () => ({
    policyDecisionsTotal: {
      labels: vi.fn(() => ({ inc: policyDecisionIncMock })),
    },
    policyObligationsTotal: {
      labels: vi.fn(() => ({ inc: policyObligationIncMock })),
    },
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
    // Reset mock calls but keep the mock definitions
    consumeRouteRateLimitMock.mockClear();
    createAuditLogMock.mockClear();
    policyEvaluateMock.mockClear();

    // Re-apply default mock behavior
    consumeRouteRateLimitMock.mockResolvedValue(undefined);
    createAuditLogMock.mockResolvedValue(undefined);
    policyEvaluateMock.mockResolvedValue({ allow: true, obligations: [] });

    // Re-import the module under test to get fresh references
    enforceModule = await import("../src/workflow/access");
  });

  it("throws when session is missing", async () => {
    await expect(
      enforceModule.enforceWorkflowPlanPolicy({
        session: null,
        input: baseInput,
      })
    ).rejects.toMatchObject({ message: "session_required", statusCode: 401 });
    expect(consumeRouteRateLimitMock).not.toHaveBeenCalled();
    expect(policyEvaluateMock).not.toHaveBeenCalled();
  });

  const bioObligation: Obligation = {
    type: "biometric",
    reason: "biometric_required",
    metadata: { code: "requireBio" },
  };

  it("propagates policy denials with status 403", async () => {
    policyEvaluateMock.mockResolvedValueOnce({
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
    policyEvaluateMock.mockResolvedValueOnce({
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
