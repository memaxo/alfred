#!/usr/bin/env bun
/**
 * Harbor verifier: Verify wave execution in trajectory
 *
 * Usage:
 *   bun scripts/harbor-verifiers/verify-waves.ts <trajectory.json> [options]
 *
 * Options:
 *   --min-waves <n>        Minimum number of waves
 *   --max-waves <n>        Maximum number of waves
 *   --min-agents <n>       Minimum number of agents across all waves
 *   --parallel-agents <n>  At least one wave must have this many agents
 *   --sequential-waves <n> At least this many waves must run sequentially
 *   --handoff-count <n>    Number of agent handoffs expected
 */

import {
  extractWaves,
  parseTrajectory,
  querySteps,
} from "@alfred/harbor/inspect";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "min-waves": { type: "string" },
    "max-waves": { type: "string" },
    "min-agents": { type: "string" },
    "parallel-agents": { type: "string" },
    "sequential-waves": { type: "string" },
    "handoff-count": { type: "string" },
  },
  allowPositionals: true,
});

const trajectoryPath = positionals[0];
if (!trajectoryPath) {
  console.error("Usage: verify-waves.ts <trajectory.json> [options]");
  process.exit(1);
}

try {
  const traj = parseTrajectory(trajectoryPath);
  const waves = extractWaves(traj);

  const minWaves = values["min-waves"]
    ? Number.parseInt(values["min-waves"], 10)
    : 0;
  const maxWaves = values["max-waves"]
    ? Number.parseInt(values["max-waves"], 10)
    : Number.POSITIVE_INFINITY;

  if (waves.length < minWaves) {
    console.error(`FAIL: Too few waves: ${waves.length} < ${minWaves}`);
    process.exit(1);
  }

  if (waves.length > maxWaves) {
    console.error(`FAIL: Too many waves: ${waves.length} > ${maxWaves}`);
    process.exit(1);
  }

  // Count agents from agent-start events
  const agentStarts = querySteps(traj, { eventType: "agent-start" });
  const uniqueAgents = new Set(
    agentStarts.map((s) => s.extra?.agentId as string).filter(Boolean)
  );

  const minAgents = values["min-agents"]
    ? Number.parseInt(values["min-agents"], 10)
    : 0;

  if (uniqueAgents.size < minAgents) {
    console.error(`FAIL: Too few agents: ${uniqueAgents.size} < ${minAgents}`);
    process.exit(1);
  }

  // Check for parallel execution (agents in same wave)
  if (values["parallel-agents"]) {
    const requiredParallel = Number.parseInt(values["parallel-agents"], 10);
    // Heuristic: check if multiple agent-start events have same wave context
    const agentsByWave = new Map<string, string[]>();
    for (const step of agentStarts) {
      // Extract wave from step context or use step position
      const waveId =
        (step.extra?.phaseId as string) ??
        `wave_${Math.floor(step.step_id / 10)}`;
      const agentId = step.extra?.agentId as string;
      if (!agentsByWave.has(waveId)) {
        agentsByWave.set(waveId, []);
      }
      agentsByWave.get(waveId)?.push(agentId);
    }

    const maxParallel = Math.max(
      0,
      ...Array.from(agentsByWave.values()).map((agents) => agents.length)
    );
    if (maxParallel < requiredParallel) {
      console.error(
        `FAIL: Max parallel agents ${maxParallel} < required ${requiredParallel}`
      );
      process.exit(1);
    }
  }

  // Check sequential waves
  if (values["sequential-waves"]) {
    const required = Number.parseInt(values["sequential-waves"], 10);
    const completedWaves = waves.filter((w) => w.status === "completed");
    if (completedWaves.length < required) {
      console.error(
        `FAIL: Sequential waves ${completedWaves.length} < required ${required}`
      );
      process.exit(1);
    }
  }

  // Check handoff count
  if (values["handoff-count"]) {
    const required = Number.parseInt(values["handoff-count"], 10);
    const handoffs = querySteps(traj, { eventType: "agent-handoff" });
    if (handoffs.length < required) {
      console.error(
        `FAIL: Handoff count ${handoffs.length} < required ${required}`
      );
      process.exit(1);
    }
  }

  console.log("PASS: Wave verification successful");
  console.log(`  Waves: ${waves.length}`);
  console.log(`  Unique agents: ${uniqueAgents.size}`);
  console.log(`  Wave IDs: ${waves.map((w) => w.waveId).join(", ")}`);
  process.exit(0);
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
