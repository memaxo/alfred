import { describe, expect, it } from "bun:test";
import type { AgentOutcome } from "@alfred/agent/orchestrator/multi/merge";
import { buildMergePlan } from "@alfred/agent/orchestrator/multi/merge";

const makeOutcome = (overrides: Partial<AgentOutcome> = {}): AgentOutcome => ({
  agentId: (overrides.agentId ?? "agent-1") as any,
  subTaskId: (overrides.subTaskId ?? "T1") as any,
  status: overrides.status ?? "completed",
  result:
    overrides.result ??
    ({
      summary: "ok",
      artifacts: [],
      changes: [],
      notes: [],
    } as any),
  error: overrides.error,
  metrics:
    overrides.metrics ??
    ({
      durationMs: 10,
    } as any),
});

describe("buildMergePlan", () => {
  it("returns direct strategy with empty outcomes", () => {
    const plan = buildMergePlan([]);
    expect(plan.strategy).toBe("direct");
    expect(plan.expectedFiles).toEqual([]);
    expect(plan.summary).toContain("No agent outcomes");
  });

  it("collects expected files from changes and artifacts", () => {
    const outcomes: AgentOutcome[] = [
      makeOutcome({
        result: {
          summary: "a",
          artifacts: [{ path: "src/a.ts", kind: "file" }],
          changes: ["src/b.ts"],
          notes: [],
        },
      }),
      makeOutcome({
        agentId: "agent-2" as any,
        subTaskId: "T2" as any,
        result: {
          summary: "b",
          artifacts: [{ path: "src/a.ts", kind: "file" }],
          changes: ["src/c.ts"],
          notes: [],
        },
      }),
    ];

    const plan = buildMergePlan(outcomes);
    expect(plan.expectedFiles).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(plan.summary).toContain("Merge results from 2 agents");
  });

  it("notes when agents failed or stuck", () => {
    const outcomes: AgentOutcome[] = [
      makeOutcome({ status: "completed" }),
      makeOutcome({ agentId: "agent-2" as any, status: "failed" }),
      makeOutcome({ agentId: "agent-3" as any, status: "stuck" }),
    ];

    const plan = buildMergePlan(outcomes);
    expect(plan.summary).toContain("3 agents");
    expect(plan.summary).toContain("1 completed");
    expect(plan.summary).toContain("1 failed");
    expect(plan.summary).toContain("1 stuck");
  });
});

describe("generateMergeExecPlanSkeleton", () => {
  const { generateMergeExecPlanSkeleton } = require("@alfred/agent/orchestrator/multi/merge");

  it("generates expected markdown structure", () => {
    const plan = {
      summary: "Merging 2 files",
      expectedFiles: ["a.ts", "b.ts"],
      strategy: "direct",
    };
    const md = generateMergeExecPlanSkeleton("run-abc", plan);
    
    expect(md).toContain("# Merge ExecPlan for run run-abc");
    expect(md).toContain("Merging 2 files");
    expect(md).toContain("- a.ts");
    expect(md).toContain("- b.ts");
    expect(md).toContain("## Plan");
    expect(md).toContain("- [ ] (pending) Merge analysis started.");
  });
});
