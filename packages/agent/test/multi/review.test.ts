import { describe, expect, it } from "bun:test";
import { buildReviewPlan } from "@alfred/agent/orchestrator/multi/review";

describe("buildReviewPlan", () => {
  it("creates default checks even with no files", () => {
    const plan = buildReviewPlan({ files: [] });
    expect(plan.checks.map((c) => c.id)).toEqual(["tests", "lint", "static"]);
    expect(plan.summary).toContain("Review merged changes");
  });

  it("adds scenario check when files present", () => {
    const plan = buildReviewPlan({ files: ["src/a.ts", "src/b.ts"] });
    const ids = plan.checks.map((c) => c.id);
    expect(ids).toContain("scenario");
    expect(plan.summary).toContain("2 changed files");
  });

  it("deduplicates files", () => {
    const plan = buildReviewPlan({ files: ["a.ts", "a.ts", "b.ts"] });
    expect(plan.summary).toContain("2 changed files");
  });

  it("uses merged summary if provided", () => {
    const plan = buildReviewPlan({
      files: [],
      summary: "Merge completed.",
    });
    expect(plan.summary.startsWith("Merge completed.")).toBe(true);
  });
});

describe("generateReviewExecPlanSkeleton", () => {
  const {
    generateReviewExecPlanSkeleton,
  } = require("@alfred/agent/orchestrator/multi/review");

  it("generates expected markdown structure", () => {
    const plan = {
      summary: "Reviewing changes",
      checks: [{ id: "lint", type: "lint", description: "Run linter" }],
    };
    const md = generateReviewExecPlanSkeleton("run-xyz", plan);

    expect(md).toContain("# Review ExecPlan for run run-xyz");
    expect(md).toContain("Reviewing changes");
    expect(md).toContain("- (lint) Run linter");
    expect(md).toContain("## Plan");
    expect(md).toContain("- [ ] (pending) Review plan drafted.");
  });
});
