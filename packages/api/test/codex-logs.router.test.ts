import { afterEach, beforeAll, describe, expect, it } from "bun:test";
import { dbModuleStub } from "./utils/mock-db-client";
import { mockPolicyAudit, resetAllMocks, setupTestEnv } from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller();
});

afterEach(() => {
  resetAllMocks();
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
        poofUpperDir: null,
        poofProfile: null,
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
      poofUpperDir: null,
      poofProfile: null,
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
      poofUpperDir: null,
      poofProfile: null,
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
      poofUpperDir: null,
      poofProfile: null,
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
});

