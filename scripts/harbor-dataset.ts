#!/usr/bin/env bun

import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type TaskDef = {
  id: string;
  requirement: string;
  verifyCmd: string;
};

const TASKS: TaskDef[] = [
  {
    id: "hello",
    requirement: "Create HELLO.txt with the text: hello",
    verifyCmd: "test -f HELLO.txt && grep -qx 'hello' HELLO.txt",
  },
  {
    id: "counter",
    requirement: "Create counter.py that prints numbers 1 to 5, one per line",
    verifyCmd:
      "python3 counter.py | grep -q '^1$' && python3 counter.py | grep -q '^5$' && python3 counter.py | wc -l | grep -q '^5$'",
  },
  {
    id: "greet",
    requirement:
      "Create greet.sh that takes one argument and prints 'Hello, <arg>!'",
    verifyCmd: "bash greet.sh World | grep -q 'Hello, World!'",
  },
  {
    id: "sum",
    requirement:
      "Create sum.js that reads two numbers from stdin and prints their sum",
    verifyCmd: "echo '3\n5' | node sum.js | grep -q '^8$'",
  },
  {
    id: "readme",
    requirement:
      "Create README.md with the title 'Test Project' and a description 'This is a test project for Harbor evaluation.'",
    verifyCmd:
      "test -f README.md && grep -q 'Test Project' README.md && grep -q 'test project for Harbor' README.md",
  },
  {
    id: "json",
    requirement:
      "Create data.json with a JSON object containing 'name': 'alfred' and 'version': '1.0.0'",
    verifyCmd:
      'test -f data.json && cat data.json | grep -q \'"name":\\s*"alfred"\' && cat data.json | grep -q \'"version":\\s*"1.0.0"\'',
  },
  {
    id: "dir",
    requirement:
      "Create a directory 'output' and a file 'output/result.txt' containing 'success'",
    verifyCmd:
      "test -d output && test -f output/result.txt && grep -q 'success' output/result.txt",
  },
  {
    id: "math",
    requirement:
      "Create calc.py with a function add(a, b) that returns a + b, and test it prints '7' when called with 3 and 4",
    verifyCmd:
      "python3 -c 'from calc import add; assert add(3, 4) == 7; print(\"ok\")' | grep -q 'ok'",
  },
];

async function generateDataset(
  outDir: string,
  alfredGitUrl: string,
  alfredGitRef: string
): Promise<void> {
  const datasetRoot = path.resolve(outDir);
  await fs.mkdir(datasetRoot, { recursive: true });

  // Generate each task
  for (const task of TASKS) {
    const _taskDir = path.join(datasetRoot, task.id);
    console.log(`Generating task: ${task.id}`);

    execSync(
      [
        "bun",
        "scripts/harbor.ts",
        "gen",
        "--outDir",
        datasetRoot,
        "--id",
        task.id,
        "--requirement",
        task.requirement,
        "--verify",
        task.verifyCmd,
        "--alfredGitUrl",
        alfredGitUrl,
        "--alfredGitRef",
        alfredGitRef,
      ].join(" "),
      { stdio: "inherit" }
    );
  }

  // Create registry.json
  const registry = {
    version: "1.0",
    name: "alfred-datasets",
    description: "ALFRED evaluation tasks for Harbor",
    tasks: TASKS.map((t) => ({
      id: t.id,
      path: `./${t.id}`,
      requirement: t.requirement,
    })),
  };

  await Bun.write(
    path.join(datasetRoot, "registry.json"),
    JSON.stringify(registry, null, 2)
  );
  console.log(`\nGenerated ${TASKS.length} tasks in ${datasetRoot}`);
  console.log(`Registry written to ${path.join(datasetRoot, "registry.json")}`);
}

async function main() {
  const alfredGitUrl = process.env.ALFRED_GIT_URL;
  const alfredGitRef = process.env.ALFRED_GIT_REF ?? "main";
  const outDir = process.argv[2];

  if (!alfredGitUrl) {
    console.error("ALFRED_GIT_URL environment variable is required");
    process.exit(1);
  }

  if (!outDir) {
    console.error("Usage: bun scripts/harbor-dataset.ts <outDir>");
    console.error(
      "Example: bun scripts/harbor-dataset.ts ./harbor/datasets/alfred"
    );
    process.exit(1);
  }

  await generateDataset(outDir, alfredGitUrl, alfredGitRef);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(
      `harbor_dataset_failed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  });
}
