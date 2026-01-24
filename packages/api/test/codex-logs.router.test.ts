import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test";

import { dbModuleStub } from "./utils/mock-db-client";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const processForLearningMock = mock(async (_dbPath: string) => ({
  patterns: [],
  mistakes: [],
  insights: [],
}));

mock.module("@alfred/agent/agentfs/learning-bridge", () => ({
  processForLearning: processForLearningMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
  processForLearningMock.mockClear();
});

describe("codex router logs", () => {
  it("lists runs scoped to the session user", async () => {
    dbModuleStub.codexRunRepo.listRuns.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000001",
        userId: "test-user",
        sessionId: null,
        threadId: null,
        parentRunId: null,
        resumeCount: 0,
        schemaVersion: 1,
        status: "completed",
        exitCode: 0,
        errorCode: null,
        errorMessage: null,
        auto: "read",
        model: null,
        profile: null,
        environmentKind: "host",
        workingDirectory: null,
        workspaceRoot: null,
        dockerContainerId: null,
        dockerImage: null,
        agentfsDbPath: null,
        agentfsRunId: null,
        outputSchema: null,
        structuredOutput: null,
        structuredOutputStatus: null,
        artifacts: null,
        resultText: "ok",
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const runs = await caller.codex.listRuns({});
    expect(runs).toHaveLength(1);
    expect(dbModuleStub.codexRunRepo.listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "test-user" })
    );
  });

  it("returns FORBIDDEN when requesting another user's run", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000002",
      userId: "other-user",
      sessionId: null,
      threadId: null,
      parentRunId: null,
      resumeCount: 0,
      schemaVersion: 1,
      status: "completed",
      exitCode: 0,
      errorCode: null,
      errorMessage: null,
      auto: "read",
      model: null,
      profile: null,
      environmentKind: "host",
      workingDirectory: null,
      workspaceRoot: null,
      dockerContainerId: null,
      dockerImage: null,
      agentfsDbPath: null,
      agentfsRunId: null,
      outputSchema: null,
      structuredOutput: null,
      structuredOutputStatus: null,
      artifacts: null,
      resultText: "ok",
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      caller.codex.getRun({ runId: "00000000-0000-4000-8000-000000000002" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists events for a run (ownership enforced)", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      userId: "test-user",
      sessionId: null,
      threadId: null,
      parentRunId: null,
      resumeCount: 0,
      schemaVersion: 1,
      status: "completed",
      exitCode: 0,
      errorCode: null,
      errorMessage: null,
      auto: "read",
      model: null,
      profile: null,
      environmentKind: "host",
      workingDirectory: null,
      workspaceRoot: null,
      dockerContainerId: null,
      dockerImage: null,
      agentfsDbPath: null,
      agentfsRunId: null,
      outputSchema: null,
      structuredOutput: null,
      structuredOutputStatus: null,
      artifacts: null,
      resultText: "ok",
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    });
    dbModuleStub.codexRunRepo.listEvents.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000010",
        runId: "00000000-0000-4000-8000-000000000003",
        seq: 1,
        eventType: "stdout",
        eventData: { type: "stdout", text: "hello" },
        text: "hello",
        contentTsvector: null,
        createdAt: new Date(),
      },
    ]);

    const events = await caller.codex.events({
      runId: "00000000-0000-4000-8000-000000000003",
      order: "asc",
    });
    expect(events).toHaveLength(1);
    expect(dbModuleStub.codexRunRepo.listEvents).toHaveBeenCalled();
  });

  it("searches events via FTS (ownership enforced when runId provided)", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000004",
      userId: "test-user",
      sessionId: null,
      threadId: null,
      parentRunId: null,
      resumeCount: 0,
      schemaVersion: 1,
      status: "completed",
      exitCode: 0,
      errorCode: null,
      errorMessage: null,
      auto: "read",
      model: null,
      profile: null,
      environmentKind: "host",
      workingDirectory: null,
      workspaceRoot: null,
      dockerContainerId: null,
      dockerImage: null,
      agentfsDbPath: null,
      agentfsRunId: null,
      outputSchema: null,
      structuredOutput: null,
      structuredOutputStatus: null,
      artifacts: null,
      resultText: "ok",
      startedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    });
    dbModuleStub.codexRunRepo.searchEvents.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000011",
        runId: "00000000-0000-4000-8000-000000000004",
        seq: 2,
        eventType: "stdout",
        eventData: { type: "stdout", text: "hello world" },
        text: "hello world",
        createdAt: new Date(),
      },
    ]);

    const events = await caller.codex.searchEvents({
      query: "hello",
      runId: "00000000-0000-4000-8000-000000000004",
    });
    expect(events).toHaveLength(1);
    expect(dbModuleStub.codexRunRepo.searchEvents).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "test-user", query: "hello" })
    );
  });

  it("returns agentfs info for run (ownership enforced)", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000020",
      userId: "test-user",
      agentfsDbPath: "/tmp/agentfs.db",
      agentfsRunId: "agentfs-run-1",
      environmentKind: "agentfs",
    });

    const info = await caller.codex.getAgentFSInfo({
      runId: "00000000-0000-4000-8000-000000000020",
    });

    expect(info).toMatchObject({
      runId: "00000000-0000-4000-8000-000000000020",
      agentfsDbPath: "/tmp/agentfs.db",
      agentfsRunId: "agentfs-run-1",
      environmentKind: "agentfs",
      hasAgentFS: true,
    });
  });

  it("returns empty tool calls when run has no agentfs db path", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000021",
      userId: "test-user",
      agentfsDbPath: null,
      agentfsRunId: null,
      environmentKind: "host",
    });

    const result = await caller.codex.listAgentFSToolCalls({
      runId: "00000000-0000-4000-8000-000000000021",
      limit: 100,
      offset: 0,
    });

    expect(result).toEqual({ toolCalls: [], total: 0 });
    expect(processForLearningMock).not.toHaveBeenCalled();
  });

  it("lists agentfs tool calls summary (best-effort)", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000022",
      userId: "test-user",
      agentfsDbPath: "/tmp/agentfs.db",
      agentfsRunId: "agentfs-run-2",
      environmentKind: "agentfs",
    });

    processForLearningMock.mockResolvedValueOnce({
      patterns: [
        {
          toolName: "readFile",
          totalCalls: 3,
          successRate: 1,
          avgDurationMs: 12,
        },
        {
          toolName: "writeFile",
          totalCalls: 2,
          successRate: 0.5,
          avgDurationMs: 50,
        },
      ],
      mistakes: [],
      insights: [],
    });

    const result = await caller.codex.listAgentFSToolCalls({
      runId: "00000000-0000-4000-8000-000000000022",
      limit: 100,
      offset: 0,
    });

    expect(processForLearningMock).toHaveBeenCalledWith("/tmp/agentfs.db");
    expect(result.total).toBe(2);
    expect(result.toolCalls).toEqual([
      { name: "readFile", totalCalls: 3, successRate: 1, avgDurationMs: 12 },
      { name: "writeFile", totalCalls: 2, successRate: 0.5, avgDurationMs: 50 },
    ]);
  });

  it("returns empty tool calls when AgentFS processing throws (best-effort)", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000024",
      userId: "test-user",
      agentfsDbPath: "/tmp/agentfs-corrupt.db",
      agentfsRunId: "agentfs-run-4",
      environmentKind: "agentfs",
    });

    processForLearningMock.mockRejectedValueOnce(
      new Error("agentfs_db_corrupt")
    );

    const result = await caller.codex.listAgentFSToolCalls({
      runId: "00000000-0000-4000-8000-000000000024",
      limit: 100,
      offset: 0,
    });

    expect(processForLearningMock).toHaveBeenCalledWith(
      "/tmp/agentfs-corrupt.db"
    );
    expect(result.toolCalls).toEqual([]);
    expect(result.total).toBe(0);
    expect(result).toMatchObject({ error: "agentfs_db_corrupt" });
  });

  it("returns FORBIDDEN when requesting agentfs tool calls for another user's run", async () => {
    dbModuleStub.codexRunRepo.getRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000023",
      userId: "other-user",
      agentfsDbPath: "/tmp/agentfs.db",
      agentfsRunId: "agentfs-run-3",
      environmentKind: "agentfs",
    });

    await expect(
      caller.codex.listAgentFSToolCalls({
        runId: "00000000-0000-4000-8000-000000000023",
        limit: 100,
        offset: 0,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
