import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockGetPlanById = mock();
const mockUpdatePlanStatus = mock();
const mockCreateRun = mock();

mock.module("@alfred/db", () => ({
  planRepo: {
    getPlanById: mockGetPlanById,
    updatePlanStatus: mockUpdatePlanStatus,
    updatePlan: mock(),
  },
  workflowRepo: {
    createRun: mockCreateRun,
  },
}));

import { approvePlan, rejectPlan } from "../persist/approve.js";
import { exportPlanToYAML } from "../serialize/yaml.js";

describe("Plan Persistence & Approval", () => {
  const mockPlan = {
    id: "plan-123",
    userId: "user-123",
    intent: "Test intent",
    status: "pending",
    plan: {
      id: "plan-123",
      title: "Test Plan",
      intent: "Test intent",
      phases: [
        {
          id: "p1",
          name: "Phase 1",
          tasks: [],
          dependsOn: [],
          estimatedDurationMs: 100,
          agentType: "codex",
        },
      ],
      resources: {
        agentCount: 1,
        strategy: "parallel",
        isolation: "container",
      },
      evaluationCriteria: [],
    },
  };

  beforeEach(() => {
    mockGetPlanById.mockReset();
    mockUpdatePlanStatus.mockReset();
    mockCreateRun.mockReset();
  });

  it("should approve a plan and create a run", async () => {
    mockGetPlanById.mockResolvedValue(mockPlan);
    mockUpdatePlanStatus.mockImplementation(async (_id, status) => ({
      ...mockPlan,
      status,
    }));
    mockCreateRun.mockResolvedValue({ id: "run-123" });

    const result = await approvePlan("plan-123", "user-123");

    expect(result.runId).toBeDefined();
    expect(mockUpdatePlanStatus).toHaveBeenCalledWith(
      "plan-123",
      "approved",
      "user-123"
    );
    expect(mockUpdatePlanStatus).toHaveBeenCalledWith("plan-123", "executed");
    expect(mockCreateRun).toHaveBeenCalled();
  });

  it("should reject a plan", async () => {
    mockUpdatePlanStatus.mockResolvedValue({ ...mockPlan, status: "rejected" });

    const result = await rejectPlan("plan-123", "user-123", "Too complex");

    expect(result.status).toBe("rejected");
    expect(mockUpdatePlanStatus).toHaveBeenCalledWith("plan-123", "rejected");
  });

  it("should export plan to YAML", () => {
    const yaml = exportPlanToYAML(mockPlan.plan as any);
    expect(yaml).toContain("title: Test Plan");
    expect(yaml).toContain("intent: Test intent");
  });
});
