import { createHash } from "node:crypto";
import type { SubTask } from "./decompose";

export type ExecPlanSnapshot = {
  title: string;
  progressSection: string;
  surprisesSection: string;
  decisionLogSection: string;
  outcomesSection: string;
};

function sliceSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`^## ${heading}\\s*$`, "m");
  const match = pattern.exec(markdown);
  if (!match) return "";

  const start = match.index;
  const rest = markdown.slice(start + match[0].length);
  const nextHeadingIndex = rest.search(/^##\s+/m);
  if (nextHeadingIndex === -1) {
    return rest.trim();
  }
  return rest.slice(0, nextHeadingIndex).trim();
}

export function interpretExecPlan(markdown: string): ExecPlanSnapshot {
  const titleMatch = /^#\s+(.+)$/m.exec(markdown);
  const title = titleMatch ? titleMatch[1]?.trim() ?? "" : "";

  return {
    title,
    progressSection: sliceSection(markdown, "Progress"),
    surprisesSection: sliceSection(markdown, "Surprises & Discoveries"),
    decisionLogSection: sliceSection(markdown, "Decision Log"),
    outcomesSection: sliceSection(markdown, "Outcomes & Retrospective"),
  };
}

export type PlanProgressUpdate = {
  timestampIso: string;
  message: string;
  completed: boolean;
};

export function planProgressUpdate(
  existing: string,
  update: PlanProgressUpdate
): string {
  const line = `- [${update.completed ? "x" : " "}] (${update.timestampIso}) ${update.message}`;
  const trimmed = existing.trim();
  if (!trimmed) {
    return `${line}`;
  }
  return `${trimmed}\n${line}`;
}

function stableRunId(runId: string): string {
  return runId.trim();
}

function subTaskSlug(subTask: SubTask): string {
  const hash = createHash("sha256");
  hash.update(subTask.id);
  hash.update("|");
  hash.update(subTask.title);
  return hash.digest("hex").slice(0, 8);
}

export function generateSubtaskExecPlanSkeleton(
  subTask: SubTask,
  runId: string
): string {
  const run = stableRunId(runId);
  const slug = subTaskSlug(subTask);
  const title = `${subTask.title} (Run ${run}, ${subTask.id})`;

  const purpose =
    subTask.requirement.trim().length > 0
      ? subTask.requirement.trim()
      : "Implement the requested change for this subtask.";

  const acceptance =
    subTask.acceptance.length > 0
      ? subTask.acceptance.join(" ")
      : "Changes implemented and tests passing.";

  const filesHint =
    subTask.filesHint.length > 0
      ? subTask.filesHint.join(", ")
      : "See repository root for relevant files.";

  return [
    `# ${title}`,
    "",
    "This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.",
    "",
    "This document follows the ExecPlan methodology defined in `.agent/PLANS.md` and must be maintained in accordance with those requirements.",
    "",
    "## Purpose / Big Picture",
    "",
    `Implement the following subtask for workflow run ${run}: ${purpose}`,
    "",
    "The work must satisfy these acceptance conditions:",
    "",
    `- ${acceptance}`,
    "",
    "Relevant file prefixes or areas:",
    "",
    `- ${filesHint}`,
    "",
    "## Progress",
    "",
    "- [ ] (pending) Initialised ExecPlan skeleton.",
    "",
    "## Surprises & Discoveries",
    "",
    "- None recorded yet.",
    "",
    "## Decision Log",
    "",
    "- Decision: ExecPlan skeleton created.",
    `  Rationale: Bootstrap for subtask ${subTask.id} (${slug}).`,
    "  Date/Author: (pending)",
    "",
    "## Outcomes & Retrospective",
    "",
    "- Pending.",
    "",
    "## Context and Orientation",
    "",
    "This ExecPlan is self-contained. It assumes only access to the current repository working tree and this document.",
    "",
    `Subtask id: ${subTask.id}. Run id: ${run}.`,
    "",
    "## Plan of Work",
    "",
    "Describe the sequence of edits and validations for this subtask.",
    "",
    "## Concrete Steps",
    "",
    "Describe the exact commands to run and expected outputs.",
    "",
    "## Validation and Acceptance",
    "",
    "Describe how to validate that this subtask is complete.",
    "",
    "## Idempotence and Recovery",
    "",
    "Describe how to safely retry or rollback this subtask.",
    "",
    "## Artifacts and Notes",
    "",
    "Record any important artifacts or notes for this subtask.",
    "",
    "## Interfaces and Dependencies",
    "",
    "Describe key interfaces, functions, or external dependencies touched by this subtask.",
    "",
  ].join("\n");
}
