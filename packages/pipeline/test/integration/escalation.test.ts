import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

// Mock that simulates file-based escalation (deprecated path)
mock.module("@alfred/runtime/orchestrator/agent", () => ({
  runAgent: async ({ spec, phaseId }: { spec: any; phaseId: string }) => {
    await mkdir(spec.workingDirectory, { recursive: true });
    const escalationPath = join(
      spec.workingDirectory,
      `ESCALATION-${spec.agentId}.md`
    );
    await Bun.write(escalationPath, "Need human help");
    return {
      agentId: spec.agentId,
      phaseId,
      stuck: false,
      status: "success",
      durationSeconds: 0,
      role: "agent",
      result: {
        summary: "mock agent success",
        artifacts: [],
        changes: [],
        notes: [],
      },
    };
  },
}));

const { createPipelineContext } = await import("../../src/context");
const { DEFAULT_CONFIG } = await import("../../src/pipeline");
const { ExecuteStage } = await import("../../src/stages/execute");

describe("ExecuteStage escalation", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-escalation"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  it("marks agent outcome as escalated when escalation file exists (deprecated path)", async () => {
    const runId = randomUUID();
    const ctx = createPipelineContext({
      runId,
      requirement: "Test escalation",
      workspace: testWorkspace,
      userId: "test-user",
      config: { ...DEFAULT_CONFIG, enableLearning: false },
      emit: () => {},
    });

    ctx.set("planOutput", {
      planId: "plan-1",
      structuredPlan: {
        id: "plan-1",
        title: "Test plan",
        intent: "Test escalation",
        workspace: testWorkspace,
        phases: [],
        resources: {
          agentCount: 1,
          strategy: "sequential",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      },
      subtasks: [
        {
          id: "t1",
          title: "Task 1",
          requirement: "Do thing",
          deps: [],
          priority: 1,
          acceptance: [],
          filesHint: [],
        },
      ],
      execPlans: new Map([
        ["t1", join(testWorkspace, ".agent", "plans", runId, "t1.md")],
      ]),
      rootPlanPath: join(testWorkspace, ".agent", "plans", runId, "root.md"),
    });

    const stage = new ExecuteStage();
    const out = await stage.execute(
      {
        waves: [{ id: "wave-0", agents: ["t1"], dependsOn: [] }],
        executionMode: "sequential",
        estimatedDuration: 1,
      },
      ctx
    );

    const outcome = out.outcomes.get("t1");
    expect(outcome?.status).toBe("escalated");
    expect(outcome?.escalation).toContain("Need human help");
  });
});

describe("ExecuteStage real-time escalation", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-escalation-realtime"
  );

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  it("marks agent outcome as escalated when runtime returns escalation data", async () => {
    // Reset mock to simulate real-time escalation
    mock.module("@alfred/runtime/orchestrator/agent", () => ({
      runAgent: async ({ spec, phaseId }: { spec: any; phaseId: string }) => {
        await mkdir(spec.workingDirectory, { recursive: true });
        return {
          agentId: spec.agentId,
          phaseId,
          stuck: false,
          status: "escalated",
          durationSeconds: 1,
          role: "codex",
          escalation: "Missing dependency: @acme/widget",
          escalationData: {
            type: "escalate",
            reason: "missing_dependency",
            details: "Missing dependency: @acme/widget",
            suggestions: ["Install @acme/widget", "Use alternative"],
            severity: "blocking",
          },
          result: {
            summary: "codex agent execution",
            artifacts: [],
            changes: [],
            notes: [],
          },
        };
      },
    }));

    // Re-import to get fresh module with new mock
    const { createPipelineContext: createCtx } = await import(
      "../../src/context"
    );
    const { DEFAULT_CONFIG: config } = await import("../../src/pipeline");
    const { ExecuteStage: Stage } = await import("../../src/stages/execute");

    const runId = randomUUID();
    const ctx = createCtx({
      runId,
      requirement: "Test real-time escalation",
      workspace: testWorkspace,
      userId: "test-user",
      config: { ...config, enableLearning: false },
      emit: () => {},
    });

    ctx.set("planOutput", {
      planId: "plan-2",
      structuredPlan: {
        id: "plan-2",
        title: "Test plan",
        intent: "Test real-time escalation",
        workspace: testWorkspace,
        phases: [],
        resources: {
          agentCount: 1,
          strategy: "sequential",
          isolation: "agentfs",
        },
        evaluationCriteria: [],
      },
      subtasks: [
        {
          id: "t2",
          title: "Task 2",
          requirement: "Do thing with escalation",
          deps: [],
          priority: 1,
          acceptance: [],
          filesHint: [],
        },
      ],
      execPlans: new Map([
        ["t2", join(testWorkspace, ".agent", "plans", runId, "t2.md")],
      ]),
      rootPlanPath: join(testWorkspace, ".agent", "plans", runId, "root.md"),
    });

    const stage = new Stage();
    const out = await stage.execute(
      {
        waves: [{ id: "wave-0", agents: ["t2"], dependsOn: [] }],
        executionMode: "sequential",
        estimatedDuration: 1,
      },
      ctx
    );

    const outcome = out.outcomes.get("t2");
    expect(outcome?.status).toBe("escalated");
    expect(outcome?.escalation).toContain("Missing dependency");
  });
});
