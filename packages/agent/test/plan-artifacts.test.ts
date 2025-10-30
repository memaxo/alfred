import { describe, expect, it } from "bun:test";
import type {
  ContextBundle,
  ImplementationPlan,
  ModulePlan,
  PlanReportRun,
  SearchReceipt,
  Task,
} from "@alfred/type";
import { __workflowInternals } from "../src/orchestrator/flow/plan";

const { parseCodexArtifactsFromResult, buildCodexPlanningPrompt, buildReport, buildRunUrl } =
  __workflowInternals;

const sampleArtifacts = {
  report: {
    findings: [
      {
        id: "F1",
        summary: "Legacy planner lacks structured artifacts.",
        detail: "No JSON output exists for downstream consumers.",
        impact: "high",
        scope: "planner.orchestrator",
      },
    ],
    risks: [
      {
        id: "R1",
        summary: "Parsing failures when Codex deviates from schema.",
        mitigation: "Emit diagnostics and fallback when JSON is invalid.",
        likelihood: "medium",
        impact: "medium",
      },
    ],
    hotspots: [
      {
        id: "H1",
        path: "packages/agent/src/orchestrator/flow/plan.ts",
        reason: "New parsing and state propagation logic lives here.",
        score: 0.7,
      },
    ],
    time: {
      estimateHours: 4,
      confidence: "medium",
      breakdown: [
        { phase: "analysis", hours: 1.5 },
        { phase: "implementation", hours: 2 },
        { phase: "validation", hours: 0.5 },
      ],
    },
  },
  plan: {
    tasks: [
      {
        id: "T1",
        title: "Design structured artifacts",
        summary: "Define report/plan schemas and streaming contract.",
        owner: "planner",
        estimateHours: 1.5,
        kind: "analysis",
        dependencies: [],
        deliverables: ["docs/plan-schema.md"],
      },
      {
        id: "T2",
        title: "Implement parser",
        summary: "Parse Codex output and persist artifacts in workflow state.",
        owner: "planner",
        estimateHours: 1.5,
        kind: "implementation",
        dependencies: ["T1"],
        deliverables: ["packages/agent/src/orchestrator/flow/plan.ts"],
      },
    ],
    deps: [
      ["T1", "T2"],
    ],
    acceptanceChecks: [
      {
        id: "AC1",
        description: "Artifacts parse successfully with valid Codex output.",
        type: "test",
        owner: "planner",
      },
    ],
    branchStrategy: {
      base: "origin/main",
      feature: "feature/plan-1234-module-1",
      review: "Open draft PR with structured artifact summary.",
      notes: "Coordinate with Codex CLI owners for rollout.",
    },
  },
};

describe("plan workflow artifact parsing", () => {
  it("parses direct JSON payloads", () => {
    const raw = JSON.stringify(sampleArtifacts);
    const parsed = parseCodexArtifactsFromResult(raw);
    expect(parsed.report).toEqual(sampleArtifacts.report);
    expect(parsed.planArtifact).toEqual(sampleArtifacts.plan);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.candidateFound).toBe(true);
  });

  it("parses JSON within fenced code blocks", () => {
    const raw = ["```json", JSON.stringify(sampleArtifacts, null, 2), "```"].join("\n");
    const parsed = parseCodexArtifactsFromResult(raw);
    expect(parsed.report?.time.estimateHours).toBe(4);
    expect(parsed.planArtifact?.tasks.length).toBe(2);
  });

  it("emits diagnostics when schema fails", () => {
    const invalid = JSON.stringify({
      report: { findings: [], time: { estimateHours: "fast" } },
      plan: { branchStrategy: { base: "", feature: "" } },
    });
    const parsed = parseCodexArtifactsFromResult(invalid);
    expect(parsed.report).toBeUndefined();
    expect(parsed.planArtifact).toBeUndefined();
    expect(parsed.candidateFound).toBe(true);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});

describe("plan workflow prompt builder", () => {
  it("includes sanitized feature branch suggestion", () => {
    const prompt = buildCodexPlanningPrompt({
      requirement: "Add reporting artifacts.",
      planId: "12345678-abcdef",
      moduleId: "module-1",
      modulePath: "packages/agent/src",
    });
    expect(prompt).toContain("feature/12345678-module-1");
    expect(prompt).toContain("Add reporting artifacts.");
    expect(prompt).toContain("Respond with exactly one JSON object");
  });
});

describe("plan report builder", () => {
  const baseDate = new Date("2025-01-01T00:00:00Z");

  function task(id: string, status: "completed" | "failed"): Task {
    return {
      id,
      title: `Task ${id}`,
      description: `Description for ${id}`,
      status,
      assigned: undefined,
      dependencies: [],
      auto: "low",
      created: baseDate,
      started: status === "completed" ? baseDate : undefined,
      completed: status === "completed" ? new Date(baseDate.getTime() + 60_000) : undefined,
      error: status === "failed" ? "boom" : undefined,
    };
  }

  function plan(): ImplementationPlan {
    const module: ModulePlan = {
      id: "module-1",
      path: "src/module.ts",
      description: "Test module",
      tasks: [task("task-1", "completed"), task("task-2", "failed")],
      status: "completed",
      branch: "feature/module-1",
      worktree: "/tmp/module-1",
    };

    return {
      id: "plan-1",
      title: "Test Plan",
      description: "Validate report builder",
      ticket: undefined,
      modules: [module],
      strategy: "sequential",
      status: "completed",
      created: baseDate,
      started: new Date(baseDate.getTime() + 30_000),
      completed: new Date(baseDate.getTime() + 120_000),
      metadata: {},
    };
  }

  it("emits findings, risks, checklist, and context", () => {
    const receipt: SearchReceipt = {
      code: [
        {
          id: "code:src/module.ts",
          kind: "code",
          path: "src/module.ts",
          score: 0.9,
          reason: "Touched by module-1",
        },
      ],
      created: baseDate,
      summary: "Key module",
    };

    const bundle: ContextBundle = {
      maxTokens: 2000,
      estimatedTokens: 180,
      files: [
        {
          path: "src/module.ts",
          startLine: 10,
          endLine: 40,
          tokens: 120,
          content: "export const example = true;",
        },
      ],
    };

    const runMeta: PlanReportRun = {
      id: "run-1",
      workflowId: "plan",
      url: "https://dash.example/workflows/plan/runs/run-1",
    };

    const results = [
      {
        task: "Complete happy path",
        taskId: "task-1",
        outcome: "ok",
        module: "module-1",
        status: "completed" as const,
      },
      {
        task: "Handle edge case",
        taskId: "task-2",
        outcome: "boom",
        module: "module-1",
        status: "failed" as const,
      },
    ];

    const report = buildReport({
      summary: "Plan execution summary",
      plan: plan(),
      results,
      context: { receipts: receipt, bundle },
      run: runMeta,
    });

    expect(report.outcome.completed).toBe(1);
    expect(report.outcome.failed).toBe(1);
    expect(report.findings).toHaveLength(2);
    expect(report.risks).toHaveLength(1);
    const statuses = new Map(report.checklist.map(item => [item.taskId, item.status]));
    expect(statuses.get("task-1")).toBe("done");
    expect(statuses.get("task-2")).toBe("skipped");
    expect(report.context?.bundle?.files[0].path).toBe("src/module.ts");
    expect(report.run?.id).toBe("run-1");
  });

  it("builds run URLs when configured", () => {
    const original = process.env.ORCHESTRATOR_RUN_BASE_URL;
    process.env.ORCHESTRATOR_RUN_BASE_URL = "https://dash.example";
    expect(buildRunUrl("plan", "run-42")).toBe(
      "https://dash.example/workflows/plan/runs/run-42",
    );
    process.env.ORCHESTRATOR_RUN_BASE_URL = original;
  });
});
