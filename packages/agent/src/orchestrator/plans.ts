import path from "node:path";

const PLANS_ENV = "ALFRED_PLANS_DIR";

export function plansBase(): string {
  const raw = process.env[PLANS_ENV]?.trim();
  if (raw) {
    return raw;
  }
  return path.join(".agent", "plans");
}

export function resolvePlansRoot(workspace: string): string {
  const base = plansBase();
  return path.isAbsolute(base) ? base : path.resolve(workspace, base);
}

export function plansPath(_workspace: string, ...segments: string[]): string {
  return path.join(plansBase(), ...segments);
}

export function rootPlanPath(workspace: string, runId: string): string {
  return plansPath(workspace, `${runId}.root.md`);
}

export function runPlansDir(workspace: string, runId: string): string {
  return plansPath(workspace, runId);
}

export function subtaskPlanPath(
  workspace: string,
  runId: string,
  subTaskId: string
): string {
  return plansPath(workspace, runId, `${subTaskId}.md`);
}
