#!/usr/bin/env bun

import * as fs from "node:fs/promises";
import * as path from "node:path";

type TaskSummary = {
  taskId: string;
  runs: number;
  passed: number;
  failed: number;
};

async function findRewardFiles(
  root: string,
  maxDepth: number
): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) {
      return;
    }
    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isFile() && e.name === "reward.txt") {
        out.push(p);
        continue;
      }
      if (e.isDirectory()) {
        await walk(p, depth + 1);
      }
    }
  }
  await walk(root, 0);
  return out;
}

function readText(p: string): Promise<string | null> {
  return fs
    .readFile(p, "utf8")
    .then((t) => t.trim())
    .catch(() => null);
}

async function main() {
  const root = process.argv[2]
    ? path.resolve(process.argv[2]!)
    : path.resolve(".tmp/harbor-out");
  const rewardFiles = await findRewardFiles(root, 4);
  const byTask = new Map<string, TaskSummary>();

  for (const rewardPath of rewardFiles) {
    const rel = path.relative(root, rewardPath);
    const taskId = rel.split(path.sep)[0] ?? "unknown";
    const reward = await readText(rewardPath);
    const curr = byTask.get(taskId) ?? {
      taskId,
      runs: 0,
      passed: 0,
      failed: 0,
    };
    curr.runs += 1;
    if (reward === "1") {
      curr.passed += 1;
    } else if (reward === "0") {
      curr.failed += 1;
    }
    byTask.set(taskId, curr);
  }

  const summaries = [...byTask.values()];

  summaries.sort((a, b) => a.taskId.localeCompare(b.taskId));

  const totals = summaries.reduce(
    (acc, s) => ({
      tasks: acc.tasks + 1,
      runs: acc.runs + s.runs,
      passed: acc.passed + s.passed,
      failed: acc.failed + s.failed,
    }),
    { tasks: 0, runs: 0, passed: 0, failed: 0 }
  );

  process.stdout.write(
    `${JSON.stringify({ root, totals, summaries }, null, 2)}\n`
  );
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(
      `harbor_summary_failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
