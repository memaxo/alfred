import { describe, expect, it, mock, vi } from "bun:test";

process.env.DATABASE_URL ??= "sqlite::memory:";

const queryAuditLogsMock = vi.fn();
mock.module("@alfred/db/repo/policy", () => ({
  createAuditLog: async () => {},
  queryAuditLogs: queryAuditLogsMock,
  createApproval: async () => {},
  getApproval: async () => null,
  getPendingApprovals: async () => [],
  approveApproval: async () => null,
  denyApproval: async () => null,
  expireApprovals: async () => [],
  getAuditLogs: async () => [],
  getAuditLogsByTrace: async () => [],
}));

describe("agentfs audit (db-backed)", () => {
  it("maps op audit rows and extracts runId/sha from context", async () => {
    queryAuditLogsMock.mockResolvedValueOnce({
      totalCount: 1,
      rows: [
        {
          id: "row-1",
          userId: "u1",
          projectId: null,
          traceId: null,
          action: "agentfs.op.cas_export",
          resource: "agentfs_run:run-1",
          decision: "allow",
          obligations: null,
          context: { success: true, runId: "run-1", sha: "a".repeat(64) },
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const { queryAuditLog } = await import("../src/services/agentfs-audit");
    const result = await queryAuditLog({ userId: "u1", limit: 10 });
    expect(result.totalCount).toBe(1);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]).toMatchObject({
      id: "row-1",
      userId: "u1",
      action: "cas_export",
      runId: "run-1",
      casSha: "a".repeat(64),
      success: true,
    });
  });

  it("normalizes action filter and always uses agentfs.op. prefix", async () => {
    queryAuditLogsMock.mockResolvedValueOnce({ rows: [], totalCount: 0 });
    const { queryAuditLog } = await import("../src/services/agentfs-audit");
    await queryAuditLog({ userId: "u1", action: "pin_set", limit: 5 });

    expect(queryAuditLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        actionPrefix: "agentfs.op.",
        action: "agentfs.op.pin_set",
        limit: 5,
      })
    );
  });

  it("uses resourceAll when runId + resource filters are both provided", async () => {
    queryAuditLogsMock.mockResolvedValueOnce({ rows: [], totalCount: 0 });
    const { queryAuditLog } = await import("../src/services/agentfs-audit");
    await queryAuditLog({
      userId: "u1",
      runId: "run-1",
      resource: "/tmp/file.txt",
      limit: 5,
    });

    expect(queryAuditLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceAll: ["run-1", "/tmp/file.txt"],
      })
    );
  });

  it("filters out unknown agentfs.op actions", async () => {
    queryAuditLogsMock.mockResolvedValueOnce({
      totalCount: 1,
      rows: [
        {
          id: "row-1",
          userId: "u1",
          projectId: null,
          traceId: null,
          action: "agentfs.op.unknown_action",
          resource: "agentfs_run:run-1",
          decision: "allow",
          obligations: null,
          context: { success: true },
          timestamp: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    const { queryAuditLog } = await import("../src/services/agentfs-audit");
    const result = await queryAuditLog({ userId: "u1", limit: 10 });
    expect(result.totalCount).toBe(1);
    expect(result.entries.length).toBe(0);
  });
});
