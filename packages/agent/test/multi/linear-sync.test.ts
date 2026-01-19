import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const createLinearBlockingRelationMock = mock(
  async (_args: {
    space: string;
    blockingIssueId: string;
    blockedIssueId: string;
    authz: string;
  }) => ({ ok: true as const, id: "rel-1" })
);

mock.module("../../src/orchestrator/linear", () => ({
  createLinearBlockingRelation: createLinearBlockingRelationMock,
}));

const { syncDepsToLinear } = await import(
  "../../src/orchestrator/multi/linear-sync"
);

describe("syncDepsToLinear", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    createLinearBlockingRelationMock.mockReset();
    createLinearBlockingRelationMock.mockResolvedValue({
      ok: true,
      id: "rel-1",
    });
  });

  it("creates blocks relations so deps block the task", async () => {
    const tasks = [
      {
        id: "A",
        title: "Task A",
        requirement: "Do A",
        deps: ["B"],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
      {
        id: "B",
        title: "Task B",
        requirement: "Do B",
        deps: [],
        priority: 1,
        acceptance: [],
        filesHint: [],
      },
    ] as any;

    const taskToIssueId = new Map([
      ["A", "ISSUE-A"],
      ["B", "ISSUE-B"],
    ]);

    const res = await syncDepsToLinear(tasks, taskToIssueId, {
      space: "workspace-1",
      authz: "Bearer token",
    });

    expect(res.synced).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.errors).toHaveLength(0);

    expect(createLinearBlockingRelationMock).toHaveBeenCalledTimes(1);
    expect(createLinearBlockingRelationMock).toHaveBeenCalledWith({
      space: "workspace-1",
      authz: "Bearer token",
      blockingIssueId: "ISSUE-B",
      blockedIssueId: "ISSUE-A",
    });
  });
});
