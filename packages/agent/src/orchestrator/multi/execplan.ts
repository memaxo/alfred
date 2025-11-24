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
  if (!match) {
    return "";
  }

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
  const title = titleMatch ? (titleMatch[1]?.trim() ?? "") : "";

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

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updatePlanSection(
  markdown: string,
  heading: string,
  updater: (existing: string) => string
): string {
  const pattern = new RegExp(
    `(## ${escapeRegExp(heading)}\\s*)([\\s\\S]*?)(?=\\n##\\s+|$)`,
    "m"
  );

  if (pattern.test(markdown)) {
    return markdown.replace(
      pattern,
      (_match, headingLine: string, body: string) => {
        const current = body.trim();
        const next = updater(current).trim();
        const spacing = next ? `\n${next}\n\n` : "\n\n";
        return `${headingLine}${spacing}`;
      }
    );
  }

  const next = updater("").trim();
  const addition =
    next.length > 0
      ? `\n## ${heading}\n\n${next}\n\n`
      : `\n## ${heading}\n\n`;
  return `${markdown.trimEnd()}\n${addition}`;
}

export function applyProgressUpdate(
  markdown: string,
  update: PlanProgressUpdate
): string {
  return updatePlanSection(markdown, "Progress", (existing) =>
    planProgressUpdate(existing, update)
  );
}

export type DecisionLogEntry = {
  decision: string;
  rationale?: string;
  author?: string;
  dateIso?: string;
  note?: string;
};

export function appendDecisionLogEntry(
  markdown: string,
  entry: DecisionLogEntry
): string {
  const lines = [
    `- Decision: ${entry.decision}`,
    entry.rationale ? `  Rationale: ${entry.rationale}` : null,
    entry.note ? `  Note: ${entry.note}` : null,
    `  Date/Author: ${entry.dateIso ?? "(pending)"}${entry.author ? ` / ${entry.author}` : ""}`,
  ].filter(Boolean) as string[];

  const block = lines.join("\n");
  return updatePlanSection(markdown, "Decision Log", (existing) => {
    const trimmed = existing.trim();
    return trimmed ? `${trimmed}\n${block}` : block;
  });
}

export type SurpriseEntry = {
  observation: string;
  evidence?: string;
  action?: string;
  dateIso?: string;
};

export function appendSurpriseEntry(
  markdown: string,
  entry: SurpriseEntry
): string {
  const lines = [
    `- Observation: ${entry.observation}`,
    entry.evidence ? `  Evidence: ${entry.evidence}` : null,
    entry.action ? `  Action: ${entry.action}` : null,
    entry.dateIso ? `  Date: ${entry.dateIso}` : null,
  ].filter(Boolean) as string[];

  const block = lines.join("\n");
  return updatePlanSection(markdown, "Surprises & Discoveries", (existing) => {
    const trimmed = existing.trim();
    return trimmed ? `${trimmed}\n${block}` : block;
  });
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
