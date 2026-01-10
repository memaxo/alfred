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
  const originalRunRegistryBackend = process.env.RUN_REGISTRY_BACKEND;

  beforeEach(() => {
    workflowRepoMocks.listRunsByStatuses.mockReset().mockResolvedValue([]);
    workflowRepoMocks.updateRun.mockReset().mockResolvedValue(undefined);
    runRegistryMocks.register.mockReset().mockResolvedValue(undefined);
    runRegistryMocks.unregister.mockReset().mockResolvedValue(undefined);
    process.env.RUN_REGISTRY_BACKEND = originalRunRegistryBackend;
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

  it("marks orphaned running runs as failed on restart (memory registry)", async () => {
    process.env.RUN_REGISTRY_BACKEND = "memory";

    const now = Date.now();
    workflowRepoMocks.listRunsByStatuses.mockResolvedValue([
      {
        id: "run-running",
        userId: "user-1",
        workflowId: "plan",
        status: "running",
        created: new Date(now - 5 * 60 * 1000),
      },
    ] as any);

    const recovery = await import("../../src/workflow/session-recovery");
    const { failOrphanedRunningRuns } = recovery;

    await failOrphanedRunningRuns({ now, graceMs: 60_000 });

    expect(workflowRepoMocks.updateRun).toHaveBeenCalledWith(
      "run-running",
      expect.objectContaining({
        status: "failed",
        errorMessage: "workflow_interrupted_restart",
      })
    );
  });

  it("does not mark freshly started running runs within grace window", async () => {
    process.env.RUN_REGISTRY_BACKEND = "memory";

    const now = Date.now();
    workflowRepoMocks.listRunsByStatuses.mockResolvedValue([
      {
        id: "run-fresh",
        userId: "user-1",
        workflowId: "plan",
        status: "running",
        created: new Date(now - 1000),
      },
    ] as any);

    const recovery = await import("../../src/workflow/session-recovery");
    const { failOrphanedRunningRuns } = recovery;

    await failOrphanedRunningRuns({ now, graceMs: 60_000 });

    expect(workflowRepoMocks.updateRun).not.toHaveBeenCalled();
  });

  it("skips running-run cleanup when registry backend is redis", async () => {
    process.env.RUN_REGISTRY_BACKEND = "redis";

    workflowRepoMocks.listRunsByStatuses.mockResolvedValue([
      { id: "run-redis", status: "running" },
    ] as any);

    const recovery = await import("../../src/workflow/session-recovery");
    const { failOrphanedRunningRuns } = recovery;

    await failOrphanedRunningRuns({ graceMs: 0 });

    expect(workflowRepoMocks.updateRun).not.toHaveBeenCalled();
  });
});
