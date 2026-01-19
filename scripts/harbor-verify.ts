#!/usr/bin/env bun

import * as fs from "node:fs/promises";
import * as path from "node:path";

type VerifyIssue = { taskId: string; message: string };

function exists(p: string): Promise<boolean> {
  return fs
    .stat(p)
    .then(() => true)
    .catch(() => false);
}

async function verifyTaskDir(
  taskDir: string,
  taskId: string
): Promise<VerifyIssue[]> {
  const issues: VerifyIssue[] = [];
  const required = [
    "task.toml",
    "instruction.md",
    "environment/Dockerfile",
    "agents/alfred.sh",
    "solution/solve.sh",
    "tests/test.sh",
    "workspace",
  ];
  for (const rel of required) {
    if (!(await exists(path.join(taskDir, rel)))) {
      issues.push({ taskId, message: `missing:${rel}` });
    }
  }
  return issues;
}

async function main() {
  const outDir = process.argv[2]
    ? path.resolve(process.argv[2]!)
    : path.resolve(".tmp/harbor-verify");
  const registryPath = path.join(outDir, "registry.json");
  if (!(await exists(registryPath))) {
    process.stderr.write(`harbor_verify_missing_registry: ${registryPath}\n`);
    process.exit(2);
  }

  const registryRaw = await fs.readFile(registryPath, "utf8");
  const registry = JSON.parse(registryRaw) as {
    tasks?: Array<{ id: string; path: string }>;
  };
  const tasks = Array.isArray(registry.tasks) ? registry.tasks : [];
  const issues: VerifyIssue[] = [];

  for (const t of tasks) {
    const taskId = String(t.id);
    const taskRel = String(t.path ?? `./${taskId}`);
    const taskDir = path.resolve(outDir, taskRel);
    issues.push(...(await verifyTaskDir(taskDir, taskId)));
  }

  const ok = issues.length === 0;
  process.stdout.write(
    `${JSON.stringify({ ok, outDir, tasks: tasks.length, issues }, null, 2)}\n`
  );
  if (!ok) {
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(
      `harbor_verify_failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
