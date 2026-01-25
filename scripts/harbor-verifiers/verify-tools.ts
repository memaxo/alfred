#!/usr/bin/env bun
/**
 * Harbor verifier: Verify tool usage in trajectory
 *
 * Usage:
 *   bun scripts/harbor-verifiers/verify-tools.ts <trajectory.json> [options]
 *
 * Options:
 *   --required <tools>    Comma-separated list of required tools
 *   --sequence <tools>    Comma-separated tool sequence that must appear
 *   --forbidden <tools>   Comma-separated list of forbidden tools
 *   --min-calls <n>       Minimum number of tool calls
 *   --max-calls <n>       Maximum number of tool calls
 */

import {
  assertToolSequence,
  parseTrajectory,
  queryToolCalls,
} from "@alfred/harbor/inspect";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    required: { type: "string" },
    sequence: { type: "string" },
    forbidden: { type: "string" },
    "min-calls": { type: "string" },
    "max-calls": { type: "string" },
  },
  allowPositionals: true,
});

const trajectoryPath = positionals[0];
if (!trajectoryPath) {
  console.error("Usage: verify-tools.ts <trajectory.json> [options]");
  process.exit(1);
}

try {
  const traj = parseTrajectory(trajectoryPath);
  const toolCalls = queryToolCalls(traj);
  const toolNames = new Set(toolCalls.map((c) => c.function_name));

  // Check required tools
  if (values.required) {
    const required = values.required.split(",").map((t) => t.trim());
    const missing = required.filter((t) => !toolNames.has(t));
    if (missing.length > 0) {
      console.error(`FAIL: Missing required tools: ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  // Check forbidden tools
  if (values.forbidden) {
    const forbidden = values.forbidden.split(",").map((t) => t.trim());
    const used = forbidden.filter((t) => toolNames.has(t));
    if (used.length > 0) {
      console.error(`FAIL: Forbidden tools were used: ${used.join(", ")}`);
      process.exit(1);
    }
  }

  // Check tool sequence
  if (values.sequence) {
    const sequence = values.sequence.split(",").map((t) => t.trim());
    try {
      assertToolSequence(traj, sequence);
    } catch {
      console.error(`FAIL: Tool sequence not found: ${sequence.join(" -> ")}`);
      process.exit(1);
    }
  }

  // Check call count bounds
  const minCalls = values["min-calls"]
    ? Number.parseInt(values["min-calls"], 10)
    : 0;
  const maxCalls = values["max-calls"]
    ? Number.parseInt(values["max-calls"], 10)
    : Number.POSITIVE_INFINITY;

  if (toolCalls.length < minCalls) {
    console.error(
      `FAIL: Too few tool calls: ${toolCalls.length} < ${minCalls}`
    );
    process.exit(1);
  }

  if (toolCalls.length > maxCalls) {
    console.error(
      `FAIL: Too many tool calls: ${toolCalls.length} > ${maxCalls}`
    );
    process.exit(1);
  }

  console.log("PASS: Tool verification successful");
  console.log(`  Total tool calls: ${toolCalls.length}`);
  console.log(`  Unique tools: ${[...toolNames].join(", ")}`);
  process.exit(0);
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
