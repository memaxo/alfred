import type { StructuredPlan } from "../generate/types.js";
import type { CheckResult } from "./types.js";

/**
 * Run a specific deterministic check on a plan's workspace
 */
export async function runCheck(
  plan: StructuredPlan,
  check: "typecheck" | "test" | "lint" | "build"
): Promise<CheckResult> {
  const workspace = plan.workspace;
  if (!workspace) {
    return { success: false, error: "No workspace defined for plan" };
  }

  const commands = {
    typecheck: ["bun", "run", "typecheck"],
    test: ["bun", "test"],
    lint: ["bun", "run", "lint"],
    build: ["bun", "run", "build"],
  };

  try {
    const proc = Bun.spawn(commands[check], {
      cwd: workspace,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return {
      success: exitCode === 0,
      output: stdout,
      error: exitCode !== 0 ? stderr : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
