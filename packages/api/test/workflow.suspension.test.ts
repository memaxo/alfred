import type { Obligation } from "@alfred/type";

import { createWorkflowSuspension } from "@alfred/api/workflow/suspension";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

import { metricsStub } from "./utils/mock-metrics";
import { mockRunRegistry, mockWorkflowRepo } from "./utils/router-helpers";

const workflowRepoMocks = mockWorkflowRepo();
const runRegistryMocks = mockRunRegistry();
const recordAuditMock = vi.fn().mockResolvedValue(undefined);

mock.module("@alfred/agent/utils/audit", () => ({
  recordAudit: recordAuditMock,
}));

const baseInput = {
  requirement: "Test requirement",
  auto: "medium",
  mode: "sequential",
};

const biometric: Obligation = {
  type: "biometric",
  reason: "workflow_autonomy_passkey",
  metadata: { code: "requireBio" },
};

describe("createWorkflowSuspension", () => {
  beforeEach(() => {
    workflowRepoMocks.createRun.mockClear();
    workflowRepoMocks.updateRun.mockClear();
    workflowRepoMocks.appendEvent.mockClear();
    runRegistryMocks.register.mockClear();
    runRegistryMocks.unregister.mockClear();
    recordAuditMock.mockClear();
    Object.values(metricsStub).forEach((metric: any) => {
      if (metric?.labels) {
        metric.labels.mockClear?.();
      }
      if (metric?.inc) {
        metric.inc.mockClear?.();
      }
      if (metric?.observe) {
        metric.observe.mockClear?.();
      }
    });
  });

  it("emits obligations with resume events and resumes when policy clears", async () => {
    const emitObligation = vi.fn();
    const startWorkflow = vi.fn().mockResolvedValue(undefined);
    const policyCheck = vi.fn().mockResolvedValue([]);

    const suspension = createWorkflowSuspension({
      sessionUserId: "user-1",
      input: baseInput as any,
      transport: "trpc",
      emitObligation,
      policyCheck,
      startWorkflow,
      onError: vi.fn(),
    });

    await suspension.suspend([biometric]);

    expect(workflowRepoMocks.createRun).toHaveBeenCalledTimes(1);
    expect(emitObligation).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: expect.any(String),
        obligations: [biometric],
        resumeEvents: ["bio-authz"],
      })
    );

    const [, handle] = runRegistryMocks.register.mock.calls[0];
    await handle.resume({
      resumeData: { event: "bio-authz", authz: "session-token" },
    });

    expect(startWorkflow).toHaveBeenCalledWith({
      runId: expect.any(String),
      obligations: [],
    });
    expect(runRegistryMocks.unregister).toHaveBeenCalled();
  });

  it("cancels suspended runs after timeout", async () => {
    const onCancelled = vi.fn();
    const suspension = createWorkflowSuspension({
      sessionUserId: "user-2",
      input: baseInput as any,
      transport: "trpc",
      timeoutMs: 50,
      emitObligation: vi.fn(),
      policyCheck: vi.fn().mockResolvedValue([]),
      startWorkflow: vi.fn(),
      onError: vi.fn(),
      onCancelled,
    });

    await suspension.suspend([biometric]);
    expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(onCancelled).toHaveBeenCalled();
    expect(runRegistryMocks.unregister).toHaveBeenCalled();
  });

  it("persists projectId from input in suspended run", async () => {
    const projectId = crypto.randomUUID();
    const suspension = createWorkflowSuspension({
      sessionUserId: "user-1",
      input: { ...baseInput, projectId } as any,
      transport: "trpc",
      emitObligation: vi.fn(),
      policyCheck: vi.fn().mockResolvedValue([]),
      startWorkflow: vi.fn(),
      onError: vi.fn(),
    });

    await suspension.suspend([biometric]);

    expect(workflowRepoMocks.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
      })
    );
  });
});
