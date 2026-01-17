/**
 * Phase grouping for subtasks.
 *
 * Uses LLM-based batch classification by default with heuristic fallback.
 * @see .ruler/55-llm-first-classification.md
 */

import type { LanguageModel } from "ai";
import { z } from "zod";

import { classifyBatch, OFFLINE_MODE } from "../classify/index.js";
import type { SubTask } from "./types.js";

/**
 * Phase group result
 */
export type PhaseGroup = {
  name: string;
  subtasks: SubTask[];
};

/**
 * Phase identifiers for grouping
 */
export const PHASE_IDS = ["setup", "db", "api", "ui", "test", "misc"] as const;

export type PhaseId = (typeof PHASE_IDS)[number];

/**
 * Phase metadata for human-readable names
 */
const PHASE_NAMES: Record<PhaseId, string> = {
  setup: "Environment Setup",
  db: "Data Architecture",
  api: "Logic & API",
  ui: "User Interface",
  test: "Testing & Validation",
  misc: "Final Adjustments",
};

/**
 * Schema for batch phase assignment
 */
const phaseAssignmentSchema = z.object({
  assignments: z.array(
    z.object({
      index: z.number(),
      phase: z.enum(PHASE_IDS),
    })
  ),
});

/**
 * Options for phase grouping
 */
export type GroupIntoPhasesOptions = {
  maxPhases: number;
  preferParallel: boolean;
  /** Model to use for classification (required unless ALFRED_CLASSIFY_OFFLINE=1) */
  model?: LanguageModel;
  /** Model key for logging */
  modelKey?: string;
};

/**
 * Heuristic fallback for phase assignment.
 * Used when ALFRED_CLASSIFY_OFFLINE=1 or when LLM call fails.
 */
function assignPhaseHeuristic(subtask: SubTask): PhaseId {
  const title = subtask.title.toLowerCase();
  const requirement = subtask.requirement.toLowerCase();

  // Setup & Environment
  if (
    title.includes("setup") ||
    title.includes("install") ||
    title.includes("configure") ||
    requirement.includes("environment")
  ) {
    return "setup";
  }

  // Database & Schema
  if (
    title.includes("db") ||
    title.includes("schema") ||
    title.includes("migration") ||
    requirement.includes("database")
  ) {
    return "db";
  }

  // Core Logic & API
  if (
    title.includes("api") ||
    title.includes("logic") ||
    title.includes("backend") ||
    title.includes("service")
  ) {
    return "api";
  }

  // Frontend & UI
  if (
    title.includes("ui") ||
    title.includes("frontend") ||
    title.includes("component") ||
    title.includes("page")
  ) {
    return "ui";
  }

  // Testing & Validation
  if (
    title.includes("test") ||
    title.includes("spec") ||
    title.includes("validate") ||
    requirement.includes("verify")
  ) {
    return "test";
  }

  return "misc";
}

/**
 * Group subtasks by phase using heuristics (fallback implementation).
 */
function groupByHeuristics(subtasks: SubTask[]): Map<PhaseId, SubTask[]> {
  const groups = new Map<PhaseId, SubTask[]>();

  for (const phase of PHASE_IDS) {
    groups.set(phase, []);
  }

  for (const subtask of subtasks) {
    const phase = assignPhaseHeuristic(subtask);
    groups.get(phase)?.push(subtask);
  }

  return groups;
}

/**
 * Build the classification prompt for batch phase assignment.
 */
function buildPhasePrompt(subtasks: SubTask[]): string {
  const taskList = subtasks
    .map((t, i) => `${i}: "${t.title}" - ${t.requirement}`)
    .join("\n");

  return `Assign each development task to exactly one phase.

Phases:
- setup: Environment setup, installation, configuration
- db: Database, schema, migrations
- api: Backend logic, API endpoints, services
- ui: Frontend, UI components, pages
- test: Testing, validation, verification
- misc: Other tasks that don't fit above

Tasks:
${taskList}

Return assignments as array of {index, phase} for each task.`;
}

/**
 * Group subtasks into phases.
 *
 * Uses LLM-based batch classification by default for semantic understanding.
 * Falls back to keyword heuristics when:
 * - ALFRED_CLASSIFY_OFFLINE=1 is set
 * - No model is provided
 * - LLM call fails
 *
 * @param subtasks - Array of subtasks to group
 * @param options - Grouping options including model and max phases
 * @returns Array of phase groups
 */
export async function groupIntoPhases(
  subtasks: SubTask[],
  options: GroupIntoPhasesOptions
): Promise<PhaseGroup[]>;
export function groupIntoPhases(
  subtasks: SubTask[],
  options: Omit<GroupIntoPhasesOptions, "model" | "modelKey">
): PhaseGroup[];
export function groupIntoPhases(
  subtasks: SubTask[],
  options: GroupIntoPhasesOptions
): PhaseGroup[] | Promise<PhaseGroup[]> {
  if (subtasks.length === 0) {
    return [];
  }

  const { maxPhases, model, modelKey } = options;

  // Use sync heuristic path if no model or offline mode
  if (OFFLINE_MODE || !model) {
    return groupIntoPhasesSync(subtasks, {
      maxPhases,
      preferParallel: options.preferParallel,
    });
  }

  // Use async LLM path
  return groupIntoPhasesAsync(subtasks, {
    maxPhases,
    preferParallel: options.preferParallel,
    model,
    modelKey,
  });
}

/**
 * Synchronous heuristic-based grouping (original implementation).
 */
function groupIntoPhasesSync(
  subtasks: SubTask[],
  options: { maxPhases: number; preferParallel: boolean }
): PhaseGroup[] {
  const groups = groupByHeuristics(subtasks);
  return consolidateGroups(groups, options.maxPhases);
}

/**
 * Async LLM-based grouping.
 */
async function groupIntoPhasesAsync(
  subtasks: SubTask[],
  options: GroupIntoPhasesOptions & { model: LanguageModel }
): Promise<PhaseGroup[]> {
  const { maxPhases, model, modelKey } = options;

  try {
    const result = await classifyBatch(
      phaseAssignmentSchema,
      buildPhasePrompt(subtasks),
      "",
      {
        model,
        modelKey,
        fallback: () => ({
          assignments: subtasks.map((t, i) => ({
            index: i,
            phase: assignPhaseHeuristic(t) as PhaseId,
          })),
        }),
      }
    );

    // Build groups from assignments
    const groups = new Map<PhaseId, SubTask[]>();
    for (const phase of PHASE_IDS) {
      groups.set(phase, []);
    }

    for (const assignment of result.result.assignments) {
      const subtask = subtasks[assignment.index];
      if (subtask !== undefined && PHASE_IDS.includes(assignment.phase)) {
        groups.get(assignment.phase)?.push(subtask);
      }
    }

    // Handle any subtasks not assigned (defensive)
    const assignedIndices = new Set(
      result.result.assignments.map((a) => a.index)
    );
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      if (subtask !== undefined && !assignedIndices.has(i)) {
        groups.get("misc")?.push(subtask);
      }
    }

    return consolidateGroups(groups, maxPhases);
  } catch {
    // Fall back to heuristics on any error
    return groupIntoPhasesSync(subtasks, options);
  }
}

/**
 * Convert phase groups map to array and consolidate if needed.
 */
function consolidateGroups(
  groups: Map<PhaseId, SubTask[]>,
  maxPhases: number
): PhaseGroup[] {
  const result: PhaseGroup[] = [];

  // Add non-empty groups in order
  for (const phase of PHASE_IDS) {
    const subtasks = groups.get(phase) ?? [];
    if (subtasks.length > 0) {
      result.push({ name: PHASE_NAMES[phase], subtasks });
    }
  }

  // Consolidate if over maxPhases
  if (result.length > maxPhases) {
    const consolidated = result.slice(0, maxPhases - 1);
    const remaining = result.slice(maxPhases - 1);
    const combinedMisc: SubTask[] = [];
    for (const g of remaining) {
      combinedMisc.push(...g.subtasks);
    }
    consolidated.push({ name: "Consolidated Tasks", subtasks: combinedMisc });
    return consolidated;
  }

  return result;
}

/**
 * Group subtasks with full result metadata.
 * Includes classification source and latency.
 */
export async function groupIntoPhasesWithMetadata(
  subtasks: SubTask[],
  options: GroupIntoPhasesOptions & { model: LanguageModel }
): Promise<{
  groups: PhaseGroup[];
  source: "llm" | "fallback";
  latencyMs: number;
}> {
  if (subtasks.length === 0) {
    return { groups: [], source: "fallback", latencyMs: 0 };
  }

  const { maxPhases, model, modelKey, preferParallel } = options;
  const start = performance.now();

  if (OFFLINE_MODE) {
    return {
      groups: groupIntoPhasesSync(subtasks, { maxPhases, preferParallel }),
      source: "fallback",
      latencyMs: performance.now() - start,
    };
  }

  try {
    const result = await classifyBatch(
      phaseAssignmentSchema,
      buildPhasePrompt(subtasks),
      "",
      { model, modelKey }
    );

    const groups = new Map<PhaseId, SubTask[]>();
    for (const phase of PHASE_IDS) {
      groups.set(phase, []);
    }

    for (const assignment of result.result.assignments) {
      const subtask = subtasks[assignment.index];
      if (subtask !== undefined && PHASE_IDS.includes(assignment.phase)) {
        groups.get(assignment.phase)?.push(subtask);
      }
    }

    const assignedIndices = new Set(
      result.result.assignments.map((a) => a.index)
    );
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      if (subtask !== undefined && !assignedIndices.has(i)) {
        groups.get("misc")?.push(subtask);
      }
    }

    return {
      groups: consolidateGroups(groups, maxPhases),
      source: result.source,
      latencyMs: performance.now() - start,
    };
  } catch {
    return {
      groups: groupIntoPhasesSync(subtasks, { maxPhases, preferParallel }),
      source: "fallback",
      latencyMs: performance.now() - start,
    };
  }
}
