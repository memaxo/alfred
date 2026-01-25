#!/usr/bin/env bun

import type { WorkflowTrajectoryFormat } from "@alfred/db/schema/workflow";

import { db } from "@alfred/db";
import * as trajectoryRepo from "@alfred/db/repo/trajectory";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { validateAtifTrajectory } from "@alfred/runtime/trajectory/validate";
import { sql } from "drizzle-orm";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface HarborRun {
  taskId: string;
  runId: string;
  reward: number;
  trajectoryPath: string;
  metadata?: Record<string, unknown>;
}

async function readReward(rewardPath: string): Promise<number> {
  const content = await Bun.file(rewardPath).text();
  const value = Number.parseFloat(content.trim());
  if (Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`Invalid reward value: ${value} (must be 0.0-1.0)`);
  }
  return value;
}

async function readTrajectory(trajectoryPath: string): Promise<unknown> {
  const content = await Bun.file(trajectoryPath).text();
  return JSON.parse(content);
}

async function readOptionalReason(taskDir: string): Promise<string | null> {
  const p = path.join(taskDir, "reason.txt");
  const exists = await Bun.file(p).exists();
  if (!exists) {
    return null;
  }
  const txt = await Bun.file(p).text();
  const t = txt.trim();
  return t.length > 0 ? t : null;
}

async function ingestRun(run: HarborRun, userId: string): Promise<void> {
  // Ensure user exists
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${userId}, 'Harbor', ${`${userId}@harbor.local`}, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // Read trajectory
  const trajectoryData = await readTrajectory(run.trajectoryPath);
  const traj = trajectoryData as { schema_version?: string; steps?: unknown[] };
  const validation = validateAtifTrajectory(trajectoryData);
  const schemaVersion = traj.schema_version ?? "ATIF-v1.4";
  const reason = await readOptionalReason(path.dirname(run.trajectoryPath));
  const ok = run.reward === 1 && validation.ok;

  // Create workflow run
  const _workflowRun = await workflowRepo.createRun({
    id: run.runId,
    userId,
    workflowId: "harbor",
    status: ok ? "completed" : "failed",
    requirement: `Harbor task: ${run.taskId}`,
    inputData: {
      taskId: run.taskId,
      harborRun: true,
      reward: run.reward,
      trajectoryOk: validation.ok,
      trajectorySchemaVersion: schemaVersion,
      ...(reason ? { reason } : {}),
      ...(run.metadata ?? {}),
    },
  });

  // Upsert trajectory
  await trajectoryRepo.upsertTrajectory({
    runId: run.runId,
    format: "atif" as WorkflowTrajectoryFormat,
    schemaVersion,
    data: trajectoryData,
    lastEventId: null,
    lastSeq: traj.steps?.length ?? null,
    valid: validation.ok,
    errors: ok
      ? null
      : {
          taskId: run.taskId,
          reward: run.reward,
          reason,
          validationErrors: validation.ok ? null : validation.errors,
        },
  });

  console.log(
    `Ingested ${run.taskId} (runId: ${run.runId}, reward: ${run.reward})`
  );
}

async function ingestFromDirectory(
  dir: string,
  userId: string
): Promise<{ ingested: number; failed: number }> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let ingested = 0;
  let failed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const taskDir = path.join(dir, entry.name);
    const rewardPath = path.join(taskDir, "reward.txt");
    const trajectoryPath = path.join(taskDir, "trajectory.json");

    try {
      // Check if both files exist
      const rewardExists = await Bun.file(rewardPath).exists();
      const trajectoryExists = await Bun.file(trajectoryPath).exists();

      if (!(rewardExists && trajectoryExists)) {
        console.warn(
          `Skipping ${entry.name}: missing reward.txt or trajectory.json`
        );
        continue;
      }

      const reward = await readReward(rewardPath);
      const runId = crypto.randomUUID();

      await ingestRun(
        {
          taskId: entry.name,
          runId,
          reward,
          trajectoryPath,
        },
        userId
      );

      ingested += 1;
    } catch (error) {
      console.error(
        `Failed to ingest ${entry.name}:`,
        error instanceof Error ? error.message : String(error)
      );
      failed += 1;
    }
  }

  return { ingested, failed };
}

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/harbor-ingest.ts --dir <harbor-output-dir> [--userId <id>]",
    "",
    "Options:",
    "  --dir <dir>     Harbor output directory (contains task subdirectories with reward.txt and trajectory.json)",
    "  --userId <id>    User ID for workflow runs (default: harbor)",
    "",
    "Example:",
    "  bun scripts/harbor-ingest.ts --dir ./harbor/output",
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  let dir: string | null = null;
  let userId = "harbor";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dir" && args[i + 1]) {
      dir = args[i + 1];
      i += 1;
    } else if (arg === "--userId" && args[i + 1]) {
      userId = args[i + 1];
      i += 1;
    }
  }

  if (!dir) {
    console.error("Missing --dir argument");
    console.error(usage());
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const stats = await ingestFromDirectory(dir, userId);
  console.log(
    `\nIngestion complete: ${stats.ingested} ingested, ${stats.failed} failed`
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(
      `harbor_ingest_failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
