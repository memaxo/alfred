#!/usr/bin/env bun
/**
 * Harbor verifier: Verify plan structure in trajectory
 *
 * Usage:
 *   bun scripts/harbor-verifiers/verify-plan.ts <trajectory.json> [options]
 *
 * Options:
 *   --min-subtasks <n>   Minimum number of subtasks required
 *   --has-dependencies   Plan must have task dependencies
 *   --has-estimates      Plan must include time estimates
 */

import { parseArgs } from "node:util";
import { extractPlan, parseTrajectory } from "@alfred/harbor/inspect";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "min-subtasks": { type: "string" },
    "has-dependencies": { type: "boolean", default: false },
    "has-estimates": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const trajectoryPath = positionals[0];
if (!trajectoryPath) {
  console.error("Usage: verify-plan.ts <trajectory.json> [options]");
  process.exit(1);
}

try {
  const traj = parseTrajectory(trajectoryPath);
  const plan = extractPlan(traj);

  if (!plan) {
    console.error("FAIL: No plan-selected event found in trajectory");
    process.exit(1);
  }

  const minSubtasks = values["min-subtasks"]
    ? Number.parseInt(values["min-subtasks"], 10)
    : 0;

  if (plan.subtaskCount < minSubtasks) {
    console.error(
      `FAIL: Plan has ${plan.subtaskCount} subtasks, minimum required: ${minSubtasks}`
    );
    process.exit(1);
  }

  if (values["has-dependencies"] && !plan.hasDependencies) {
    console.error("FAIL: Plan has no task dependencies");
    process.exit(1);
  }

  if (values["has-estimates"] && !plan.hasEstimates) {
    console.error("FAIL: Plan has no time estimates");
    process.exit(1);
  }

  console.log("PASS: Plan verification successful");
  console.log(`  Subtasks: ${plan.subtaskCount}`);
  console.log(`  Has dependencies: ${plan.hasDependencies}`);
  console.log(`  Has estimates: ${plan.hasEstimates}`);
  process.exit(0);
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
