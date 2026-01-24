#!/usr/bin/env bun

/**
 * Canonical Pipeline CLI
 *
 * Runs the new @alfred/pipeline orchestrator to execute workflow requirements.
 *
 * Usage:
 *   bun scripts/pipeline.ts --requirement "Create packages/util/src/string.ts with capitalize function"
 */

import { PipelineRunner, registerDefaultStages } from "@alfred/pipeline";
import {
  ConsoleObserver,
  CostCleanupObserver,
  MetricsObserver,
} from "@alfred/pipeline/observers";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

async function main() {
  const { values } = parseArgs({
    options: {
      requirement: {
        type: "string",
        short: "r",
      },
      workspace: {
        type: "string",
        short: "w",
        default: process.cwd(),
      },
      userId: {
        type: "string",
        short: "u",
        default: "cli-user",
      },
      parallel: {
        type: "boolean",
        short: "p",
        default: false,
      },
    },
  });

  if (!values.requirement) {
    console.error("Error: --requirement is required");
    console.log(
      'Usage: bun scripts/pipeline.ts --requirement "Your task description"'
    );
    process.exit(1);
  }

  const runId = randomUUID();
  console.log(`Starting pipeline run: ${runId}`);
  console.log(`Requirement: ${values.requirement}`);
  console.log(`Workspace: ${values.workspace}`);
  console.log("");

  const runner = new PipelineRunner({
    maxParallel: values.parallel ? 4 : 1,
    enableLearning: true,
    enableLinearSync: false, // No Linear sync from CLI for now
  });

  registerDefaultStages(runner);
  runner.addObserver(new ConsoleObserver());
  runner.addObserver(new MetricsObserver());
  runner.addObserver(new CostCleanupObserver());

  try {
    for await (const _event of runner.run({
      runId,
      requirement: values.requirement,
      workspace: values.workspace,
      userId: values.userId,
    })) {
      // Events are logged by ConsoleObserver
    }

    console.log("");
    console.log("✓ Pipeline completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("✗ Pipeline failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
