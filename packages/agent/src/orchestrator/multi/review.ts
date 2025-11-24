import { existsSync } from "node:fs";
import path from "node:path";

export type ReviewCheckType =
  | "tests"
  | "lint"
  | "static"
  | "scenario"
  | "smoke"
  | "verify";

export type ReviewCheck = {
  id: string;
  description: string;
  type: ReviewCheckType;
  script?: string;
};

export type ReviewPlan = {
  summary: string;
  checks: ReviewCheck[];
};

type VerifyRule = {
  script: string;
  description: string;
  pattern: (file: string) => boolean;
};

const VERIFY_RULES: VerifyRule[] = [
  {
    script: "scripts/verify-orchestrator.ts",
    description: "Validate orchestrator flows",
    pattern: (file) =>
      file.startsWith("packages/agent/") || file.startsWith("packages/runtime/"),
  },
  {
    script: "scripts/verify-resilience.ts",
    description: "Run resilience checks",
    pattern: (file) =>
      file.startsWith("packages/agent/") || file.startsWith("packages/runtime/"),
  },
  {
    script: "scripts/verify-voice-runtime.ts",
    description: "Exercise voice runtime flows",
    pattern: (file) => file.includes("voice"),
  },
  {
    script: "scripts/verify-cognitive-pipeline.ts",
    description: "Verify cognitive pipelines",
    pattern: (file) =>
      file.includes("cognitive") || file.startsWith("packages/knowledge/"),
  },
  {
    script: "scripts/verify-cognitive-health.ts",
    description: "Verify cognition health checks",
    pattern: (file) =>
      file.startsWith("packages/cognitive/") || file.includes("learning"),
  },
  {
    script: "scripts/verify-build.ts",
    description: "Validate bundle/build outputs",
    pattern: (file) =>
      file.startsWith("apps/") || file.startsWith("packages/web/"),
  },
];

function selectVerifyChecks(files: string[]): ReviewCheck[] {
  const matches = new Map<string, ReviewCheck>();

  for (const file of files) {
    for (const rule of VERIFY_RULES) {
      if (!rule.pattern(file)) {
        continue;
      }
      const scriptPath = path.isAbsolute(rule.script)
        ? rule.script
        : path.resolve(process.cwd(), rule.script);
      if (!existsSync(scriptPath)) {
        continue;
      }
      if (matches.has(scriptPath)) {
        continue;
      }
      matches.set(scriptPath, {
        id: `verify-${pathToId(rule.script)}`,
        type: "verify",
        description: `${rule.description} (${rule.script})`,
        script: rule.script,
      });
    }
  }

  return Array.from(matches.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function pathToId(script: string) {
  return script.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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

  checks.push(...selectVerifyChecks(uniqueFiles));

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
  if (reviewPlan.checks.length > 0) {
    for (const check of reviewPlan.checks) {
      lines.push(`- [ ] [${check.id}] Pending`);
    }
  } else {
    lines.push("- [ ] [plan] Review plan drafted.");
  }
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
