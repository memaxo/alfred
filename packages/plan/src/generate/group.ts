import type { SubTask } from "./types.js";

export type PhaseGroup = {
  name: string;
  subtasks: SubTask[];
};

/**
 * Group subtasks into phases using heuristics
 */
export function groupIntoPhases(
  subtasks: SubTask[],
  options: {
    maxPhases: number;
    preferParallel: boolean;
  }
): PhaseGroup[] {
  if (subtasks.length === 0) {
    return [];
  }

  // Group 1: Setup & Environment
  const setup = subtasks.filter(
    (t) =>
      t.title.toLowerCase().includes("setup") ||
      t.title.toLowerCase().includes("install") ||
      t.title.toLowerCase().includes("configure") ||
      t.requirement.toLowerCase().includes("environment")
  );

  // Group 2: Database & Schema
  const db = subtasks.filter(
    (t) =>
      !setup.includes(t) &&
      (t.title.toLowerCase().includes("db") ||
        t.title.toLowerCase().includes("schema") ||
        t.title.toLowerCase().includes("migration") ||
        t.requirement.toLowerCase().includes("database"))
  );

  // Group 3: Core Logic & API
  const api = subtasks.filter(
    (t) =>
      !(setup.includes(t) || db.includes(t)) &&
      (t.title.toLowerCase().includes("api") ||
        t.title.toLowerCase().includes("logic") ||
        t.title.toLowerCase().includes("backend") ||
        t.title.toLowerCase().includes("service"))
  );

  // Group 4: Frontend & UI
  const ui = subtasks.filter(
    (t) =>
      !(setup.includes(t) || db.includes(t) || api.includes(t)) &&
      (t.title.toLowerCase().includes("ui") ||
        t.title.toLowerCase().includes("frontend") ||
        t.title.toLowerCase().includes("component") ||
        t.title.toLowerCase().includes("page"))
  );

  // Group 5: Testing & Validation
  const tests = subtasks.filter(
    (t) =>
      !(
        setup.includes(t) ||
        db.includes(t) ||
        api.includes(t) ||
        ui.includes(t)
      ) &&
      (t.title.toLowerCase().includes("test") ||
        t.title.toLowerCase().includes("spec") ||
        t.title.toLowerCase().includes("validate") ||
        t.requirement.toLowerCase().includes("verify"))
  );

  // Group 6: Miscellaneous
  const misc = subtasks.filter(
    (t) =>
      !(
        setup.includes(t) ||
        db.includes(t) ||
        api.includes(t) ||
        ui.includes(t) ||
        tests.includes(t)
      )
  );

  const groups: PhaseGroup[] = [];
  if (setup.length > 0) {
    groups.push({ name: "Environment Setup", subtasks: setup });
  }
  if (db.length > 0) {
    groups.push({ name: "Data Architecture", subtasks: db });
  }
  if (api.length > 0) {
    groups.push({ name: "Logic & API", subtasks: api });
  }
  if (ui.length > 0) {
    groups.push({ name: "User Interface", subtasks: ui });
  }
  if (tests.length > 0) {
    groups.push({ name: "Testing & Validation", subtasks: tests });
  }
  if (misc.length > 0) {
    groups.push({ name: "Final Adjustments", subtasks: misc });
  }

  // Consolidate if over maxPhases
  if (groups.length > options.maxPhases) {
    const consolidated = groups.slice(0, options.maxPhases - 1);
    const remaining = groups.slice(options.maxPhases - 1);
    const combinedMisc: SubTask[] = [];
    for (const g of remaining) {
      combinedMisc.push(...g.subtasks);
    }
    consolidated.push({ name: "Consolidated Tasks", subtasks: combinedMisc });
    return consolidated;
  }

  return groups;
}
