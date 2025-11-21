export type ReviewCheckType = "tests" | "lint" | "static" | "scenario";

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
