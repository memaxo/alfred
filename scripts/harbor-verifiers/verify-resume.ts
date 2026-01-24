#!/usr/bin/env bun
/**
 * Harbor verifier: Verify checkpoint/resume behavior in trajectory
 *
 * Usage:
 *   bun scripts/harbor-verifiers/verify-resume.ts <trajectory.json> [options]
 *
 * Options:
 *   --resumed <true|false>     Trajectory must show resume behavior
 *   --checkpoint-count <n>     Minimum number of context:set events
 *   --no-duplicate-stages      Stages must not be re-executed
 */

import { parseTrajectory, querySteps } from "@alfred/harbor/inspect";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    resumed: { type: "string" },
    "checkpoint-count": { type: "string" },
    "no-duplicate-stages": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const trajectoryPath = positionals[0];
if (!trajectoryPath) {
  console.error("Usage: verify-resume.ts <trajectory.json> [options]");
  process.exit(1);
}

try {
  const traj = parseTrajectory(trajectoryPath);

  // Check for resume event
  const resumeEvents = querySteps(traj, { eventType: "pipeline:resume" });
  const hasResumed = resumeEvents.length > 0;

  if (values.resumed !== undefined) {
    const expectResumed = values.resumed === "true";
    if (expectResumed && !hasResumed) {
      console.error("FAIL: Expected resume event but none found");
      process.exit(1);
    }
    if (!expectResumed && hasResumed) {
      console.error("FAIL: Found unexpected resume event");
      process.exit(1);
    }
  }

  // Check checkpoint count (context:set events)
  const contextSetEvents = querySteps(traj, { eventType: "context:set" });
  if (values["checkpoint-count"]) {
    const required = Number.parseInt(values["checkpoint-count"], 10);
    if (contextSetEvents.length < required) {
      console.error(
        `FAIL: Checkpoint count ${contextSetEvents.length} < required ${required}`
      );
      process.exit(1);
    }
  }

  // Check for duplicate stage execution
  if (values["no-duplicate-stages"]) {
    const stageEnterEvents = querySteps(traj, { eventType: "stage:enter" });
    const stageNames = stageEnterEvents
      .map((s) => s.extra?.stage as string)
      .filter(Boolean);

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const name of stageNames) {
      if (seen.has(name)) {
        duplicates.push(name);
      }
      seen.add(name);
    }

    if (duplicates.length > 0) {
      console.error(
        `FAIL: Duplicate stage execution detected: ${duplicates.join(", ")}`
      );
      process.exit(1);
    }
  }

  console.log("PASS: Resume verification successful");
  console.log(`  Resumed: ${hasResumed}`);
  console.log(`  Context sets (checkpoints): ${contextSetEvents.length}`);
  if (hasResumed) {
    const fromStages = resumeEvents
      .map((e) => e.extra?.fromStage as string)
      .filter(Boolean);
    console.log(`  Resumed from: ${fromStages.join(", ")}`);
  }
  process.exit(0);
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
