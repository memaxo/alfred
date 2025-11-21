export type ReviewCheckType =
  | "tests"
  | "lint"
  | "static"
  | "scenario"
  | "smoke";

export type ReviewCheck = {
  id: string;
  description: string;
  type: ReviewCheckType;
};

export type ReviewPlan = {
  summary: string;
  checks: ReviewCheck[];
};

export function buildReviewPlan(mergedHint: {
  files: string[];
  summary?: string;
}): ReviewPlan {
  const uniqueFiles = Array.from(new Set(mergedHint.files ?? [])).sort();

  const checks: ReviewCheck[] = [];

  checks.push({
    id: "tests",
    type: "tests",
    description:
      "Run the project's test suite (bun test or equivalent) focusing on changed files.",
  });

  checks.push({
    id: "lint",
    type: "lint",
    description:
      "Run lint checks over the workspace to ensure style and static rules hold.",
  });

  checks.push({
    id: "static",
    type: "static",
    description:
      "Run static analysis / typechecking (tsc -b or bun run typecheck).",
  });

  if (uniqueFiles.length > 0) {
    checks.push({
      id: "scenario",
      type: "scenario",
      description:
        "Exercise critical scenarios that touch the changed files to confirm behavior.",
    });
  }

  const summaryBase =
    mergedHint.summary && mergedHint.summary.trim().length > 0
      ? mergedHint.summary.trim()
      : "Review merged changes with tests, lint, and static analysis.";

  const summary =
    uniqueFiles.length > 0
      ? `${summaryBase} Focus on ${uniqueFiles.length} changed files.`
      : summaryBase;

  return {
    summary,
    checks,
  };
}

export function generateReviewExecPlanSkeleton(
  runId: string,
  reviewPlan: ReviewPlan
): string {
  const lines: string[] = [];
  lines.push(`# Review ExecPlan for run ${runId}`);
  lines.push("");
  lines.push(
    "This ExecPlan defines how to validate merged changes for this workflow run."
  );
  lines.push("");
  lines.push("## Purpose");
  lines.push("");
  lines.push(
    "Plan and document the checks (tests, lint, static analysis, scenarios) needed to validate the merged result."
  );
  lines.push("");
  lines.push("## Context");
  lines.push("");
  lines.push(reviewPlan.summary);
  lines.push("");
  if (reviewPlan.checks.length > 0) {
    lines.push("Planned checks:");
    for (const check of reviewPlan.checks) {
      lines.push(`- (${check.type}) ${check.description}`);
    }
    lines.push("");
  }
  lines.push("## Plan");
  lines.push("");
  lines.push(
    "- For each check, specify the exact commands or tools to run (without executing them yet)."
  );
  lines.push(
    "- Identify any additional targeted tests needed for high-risk areas."
  );
  lines.push(
    "- Record outcomes and follow-ups clearly in Progress and Decision Log."
  );
  lines.push("");
  lines.push("## Progress");
  lines.push("");
  lines.push("- [ ] (pending) Review plan drafted.");
  lines.push("");
  lines.push("## Surprises & Discoveries");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  lines.push("## Decision Log");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  lines.push("## Outcomes & Retrospective");
  lines.push("");
  lines.push("- Pending.");
  lines.push("");
  return lines.join("\n");
}
