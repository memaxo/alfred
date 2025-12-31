import { beforeEach, describe, expect, it, vi } from "bun:test";
import type { Obligation } from "@alfred/type";

// Create fresh mocks for this test file
const createAuditLogMock = vi.fn().mockResolvedValue(undefined);
const consumeRouteRateLimitMock = vi.fn().mockResolvedValue(undefined);
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
  requirement: "test",
  auto: "low",
  mode: "sequential",
} as any;

describe("enforceWorkflowPlanPolicy", () => {
  let enforceWorkflowPlanPolicy: typeof import("../src/workflow/access").enforceWorkflowPlanPolicy;
  let policyIncMock: ReturnType<typeof vi.fn>;
  let obligationIncMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Dynamic import to bypass any global mocks from other tests
    const { enforceWorkflowPlanPolicy: efp } = await import(
      "../src/workflow/access"
    );
    enforceWorkflowPlanPolicy = efp;

    policyIncMock = vi.fn();
    obligationIncMock = vi.fn();
    policyLabelsMock.mockReturnValue({ inc: policyIncMock });
    obligationLabelsMock.mockReturnValue({ inc: obligationIncMock });

    // Reset mock state
    consumeRouteRateLimitMock.mockReset();
    createAuditLogMock.mockReset();
    evaluateMock.mockReset();
    policyLabelsMock.mockReset();
    obligationLabelsMock.mockReset();

    consumeRouteRateLimitMock.mockResolvedValue(undefined);
    createAuditLogMock.mockResolvedValue(undefined);
    evaluateMock.mockResolvedValue({ allow: true, obligations: [] });
  });

  it("throws when session is missing", async () => {
    await expect(
      enforceWorkflowPlanPolicy({
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
      enforceWorkflowPlanPolicy({
        session: baseSession,
        input: baseInput,
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
    expect(policyIncMock).toHaveBeenCalled();
    expect(obligationIncMock).toHaveBeenCalled();
  });
});
