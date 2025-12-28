import * as fs from "node:fs/promises";
import path from "node:path";
import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";

function resolvePlanDir(runId: string): string {
  const base =
    process.env.ALFRED_PLANS_DIR?.trim() || path.join(".agent", "plans");
  const dir = path.isAbsolute(base) ? base : path.resolve(process.cwd(), base);
  return path.join(dir, runId);
}

export async function preparePlanDir(runId: string) {
  const planPath = resolvePlanDir(runId);
  await fs.rm(planPath, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(planPath, { recursive: true });
  return planPath;
}

export async function cleanupPlanDir(runId: string) {
  const planPath = resolvePlanDir(runId);
  await fs.rm(planPath, { recursive: true, force: true }).catch(() => {});
}

type RunnerResponse = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
};

type RunnerHandler = (args: {
  command: string;
  cwd: string;
  timeoutMs?: number;
}) => Promise<RunnerResponse> | RunnerResponse;

export function mockRunner(handler: RunnerHandler) {
  const originalExecute = toolRunner.execute;
  toolRunner.execute = (async (
    command: string,
    cwd: string,
    timeoutMs?: number
  ) => {
    const result = await handler({ command, cwd, timeoutMs });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      exitCode: result.exitCode ?? 0,
      durationMs: result.durationMs ?? 0,
    };
  }) as typeof toolRunner.execute;

  return () => {
    toolRunner.execute = originalExecute;
  };
}
