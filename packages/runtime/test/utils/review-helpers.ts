import * as fs from "node:fs/promises";
import path from "node:path";
import { toolRunner } from "@alfred/agent/orchestrator/tool/runner";

export async function preparePlanDir(runId: string) {
  const planPath = path.join(".agent", "plans", runId);
  await fs.rm(planPath, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(planPath, { recursive: true });
  return planPath;
}

export async function cleanupPlanDir(runId: string) {
  const planPath = path.join(".agent", "plans", runId);
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
