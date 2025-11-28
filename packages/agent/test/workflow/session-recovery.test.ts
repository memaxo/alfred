import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const workflowRepoMocks = {
  listRunsByStatuses: vi.fn().mockResolvedValue([]),
  updateRun: vi.fn().mockResolvedValue(undefined),
};

mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);

const runRegistryMocks = {
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
};

mock.module("../../src/workflow/registry", () => ({
  runRegistry: runRegistryMocks,
}));

describe("workflow session recovery", () => {
  beforeEach(() => {
    workflowRepoMocks.listRunsByStatuses.mockReset().mockResolvedValue([]);
    workflowRepoMocks.updateRun.mockReset().mockResolvedValue(undefined);
    runRegistryMocks.register.mockReset().mockResolvedValue(undefined);
    runRegistryMocks.unregister.mockReset().mockResolvedValue(undefined);
  });

  it("registers placeholder handles that reject resume until stream reconnects", async () => {
    workflowRepoMocks.listRunsByStatuses.mockResolvedValue([
      {
        id: "run-placeholder",
        userId: "user-1",
        workflowId: "plan",
        status: "suspended",
      },
    ] as any);

    const recovery = await import("../../src/workflow/session-recovery");
    recovery.__resetWorkflowRecoveryStateForTests();
    const { rehydrateSuspendedRuns, StreamNotAttachedError } = recovery;

    await rehydrateSuspendedRuns({ limit: 5 });

    expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);
    const placeholderHandle = runRegistryMocks.register.mock.calls[0]?.[1];
    expect(placeholderHandle).toBeDefined();

    await expect(
      placeholderHandle.resume({
        resumeData: { event: "bio-authz", authz: "token" },
      })
    ).rejects.toBeInstanceOf(StreamNotAttachedError);

    await placeholderHandle.cancel();
    expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith(
      "run-placeholder",
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("swaps placeholder for real handle when stream registers", async () => {
    workflowRepoMocks.listRunsByStatuses.mockResolvedValue([
      {
        id: "run-real",
        userId: "user-2",
        workflowId: "plan",
        status: "suspended",
      },
    ] as any);

    const recovery = await import("../../src/workflow/session-recovery");
    recovery.__resetWorkflowRecoveryStateForTests();
    const { rehydrateSuspendedRuns, registerRunHandle } = recovery;

    await rehydrateSuspendedRuns({ limit: 5 });
    expect(runRegistryMocks.register).toHaveBeenCalledTimes(1);

    const delegateHandle = {
      abortController: new AbortController(),
      resume: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
    };

    await registerRunHandle("run-real", delegateHandle);
    expect(runRegistryMocks.register).toHaveBeenCalledTimes(2);
    const registeredHandle = runRegistryMocks.register.mock.calls[1]?.[1];
    expect(registeredHandle).toBe(delegateHandle);

    await registeredHandle.resume({
      resumeData: { event: "bio-authz", authz: "token" },
    });
    expect(delegateHandle.resume).toHaveBeenCalledTimes(1);
  });
});
