import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const createLinearBlockingRelationMock = mock(
  async (_args: {
    space: string;
    blockingIssueId: string;
    blockedIssueId: string;
    authz: string;
  }) => ({ id: "rel-1", ok: true as const })
);

mock.module("../../src/orchestrator/linear", () => ({
  createLinearBlockingRelation: createLinearBlockingRelationMock,
}));

const { syncDepsToLinear } =
  await import("../../src/orchestrator/multi/linear-sync");

describe("syncDepsToLinear", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    createLinearBlockingRelationMock.mockReset();
    createLinearBlockingRelationMock.mockResolvedValue({
      id: "rel-1",
      ok: true,
    });
  });

  it("creates blocks relations so deps block the task", async () => {
    const tasks = [
      {
        acceptance: [],
        deps: ["B"],
        filesHint: [],
        id: "A",
        priority: 1,
        requirement: "Do A",
        title: "Task A",
      },
      {
        acceptance: [],
        deps: [],
        filesHint: [],
        id: "B",
        priority: 1,
        requirement: "Do B",
        title: "Task B",
      },
    ] as any;

    const taskToIssueId = new Map([
      ["A", "ISSUE-A"],
      ["B", "ISSUE-B"],
    ]);

    const res = await syncDepsToLinear(tasks, taskToIssueId, {
      authz: "Bearer token",
      space: "workspace-1",
    });

    expect(res.synced).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.errors).toHaveLength(0);

    expect(createLinearBlockingRelationMock).toHaveBeenCalledTimes(1);
    expect(createLinearBlockingRelationMock).toHaveBeenCalledWith({
      authz: "Bearer token",
      blockedIssueId: "ISSUE-A",
      blockingIssueId: "ISSUE-B",
      space: "workspace-1",
    });
  });
});
