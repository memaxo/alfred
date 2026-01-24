import { buildReviewPlan } from "@alfred/agent/orchestrator/multi/review";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import path from "node:path";

let existsSpy: ReturnType<typeof spyOn> | null = null;

const enableVerifyScripts = () => {
  const verifyPaths = new Set(
    [
      "scripts/verify-orchestrator.ts",
      "scripts/verify-resilience.ts",
      "scripts/verify-cognitive-pipeline.ts",
      "scripts/verify-build.ts",
    ].map((script) => path.resolve(process.cwd(), script))
  );
  existsSpy = spyOn(fs, "existsSync").mockImplementation((target) => {
    if (typeof target !== "string") {
      return false;
    }
    return verifyPaths.has(target);
  });
};

beforeEach(() => {
  existsSpy?.mockRestore();
  existsSpy = null;
});

afterEach(() => {
  existsSpy?.mockRestore();
  existsSpy = null;
});

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

  it("adds verify checks when matching scripts exist", () => {
    enableVerifyScripts();
    const plan = buildReviewPlan({
      files: [
        "packages/agent/src/orchestrator/multi/spawn.ts",
        "apps/web/src/app/page.tsx",
        "packages/runtime/src/core.ts",
      ],
    });
    const verifyScripts = plan.checks
      .filter((check) => check.type === "verify")
      .map((check) => check.script);

    expect(verifyScripts).toEqual(
      expect.arrayContaining([
        "scripts/verify-orchestrator.ts",
        "scripts/verify-resilience.ts",
        "scripts/verify-build.ts",
      ])
    );
  });

  it("only adds scenario checks when files are present", () => {
    const planWithoutFiles = buildReviewPlan({ files: [] });
    expect(planWithoutFiles.checks.some((c) => c.id === "scenario")).toBe(
      false
    );

    const planWithFiles = buildReviewPlan({ files: ["src/app.ts"] });
    expect(planWithFiles.checks.some((c) => c.id === "scenario")).toBe(true);
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
    expect(md).toContain("- [ ] [lint] Pending");
  });
});
