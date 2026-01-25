import type { Obligation } from "@alfred/type";

import { beforeEach, describe, expect, it, vi } from "bun:test";

// Create fresh mocks for this test file
const createAuditLogMock = vi.fn().mockResolvedValue();
const consumeRouteRateLimitMock = vi.fn().mockResolvedValue();
const evaluateMock = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] });
const policyLabelsMock = vi.fn();
const obligationLabelsMock = vi.fn();

// Mock all heavy modules BEFORE any imports to prevent side effects
vi.mock("@alfred/db/repo/policy", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("@alfred/api/trpc", () => ({
  consumeRouteRateLimit: consumeRouteRateLimitMock,
}));

vi.mock("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: vi.fn(),
}));

vi.mock("../src/metrics", () => ({
  metricsRegistry: { registerMetric: vi.fn() },
  policyDecisionsTotal: {
    labels: policyLabelsMock,
  },
  policyObligationsTotal: {
    labels: obligationLabelsMock,
  },
}));

const baseSession = {
  user: { id: "user-1", roles: ["owner"], scopes: ["workflow.plan"] },
} as any;

const baseInput = {
  auto: "low",
  mode: "sequential",
  requirement: "test",
} as any;

describe("enforceWorkflowPlanPolicy", () => {
  let enforceWorkflowPlanPolicy: typeof import("../src/workflow/access").enforceWorkflowPlanPolicy;
  let policyIncMock: ReturnType<typeof vi.fn>;
  let obligationIncMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Dynamic import to bypass any global mocks from other tests
    const { enforceWorkflowPlanPolicy: efp } =
      await import("../src/workflow/access");
    enforceWorkflowPlanPolicy = efp;

    policyIncMock = vi.fn();
    obligationIncMock = vi.fn();

    // Reset mock state
    consumeRouteRateLimitMock.mockReset();
    createAuditLogMock.mockReset();
    evaluateMock.mockReset();
    policyLabelsMock.mockReset();
    obligationLabelsMock.mockReset();

    // Set return values after resetting
    policyLabelsMock.mockReturnValue({ inc: policyIncMock });
    obligationLabelsMock.mockReturnValue({ inc: obligationIncMock });
    consumeRouteRateLimitMock.mockResolvedValue();
    createAuditLogMock.mockResolvedValue();
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
  });

  it("throws when session is missing", async () => {
    await expect(
      enforceWorkflowPlanPolicy({
        input: baseInput,
        session: null,
      })
    ).rejects.toMatchObject({ message: "session_required", statusCode: 401 });
    expect(consumeRouteRateLimitMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  const bioObligation: Obligation = {
    metadata: { code: "requireBio" },
    reason: "biometric_required",
    type: "biometric",
  };

  it("propagates policy denials with status 403", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: false,
      obligations: [bioObligation],
      reason: "policy_denied",
    });

    await expect(
      enforceWorkflowPlanPolicy({
        input: baseInput,
        session: baseSession,
      })
    ).rejects.toMatchObject({ message: "policy_denied", statusCode: 403 });

    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "deny" })
    );
    expect(obligationIncMock).toHaveBeenCalled();
  });

  it("returns obligations and consumes the shared rate limit when allowed", async () => {
    evaluateMock.mockResolvedValueOnce({
      allow: true,
      obligations: [bioObligation],
    });

    const result = await enforceWorkflowPlanPolicy({
      input: baseInput,
      session: baseSession,
    });

    expect(result).toEqual({ obligations: [bioObligation] });
    expect(consumeRouteRateLimitMock).toHaveBeenCalledWith(
      "workflow.streamPipeline",
      "user-1"
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "allow" })
    );
    expect(policyIncMock).toHaveBeenCalled();
    expect(obligationIncMock).toHaveBeenCalled();
  });
});
