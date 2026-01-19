#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type TaskDef = {
  id: string;
  requirement: string;
  verifyCmd: string;
  oracleCmd: string;
  profile: "pr" | "nightly";
  auto?: "read" | "low" | "medium" | "high";
};

function resolveGitCommit(args: {
  gitUrl: string;
  gitRef: string;
}): string | null {
  // Best-effort: prefer a deterministic commit hash for reproducibility.
  // For local file:// clones we can resolve via `git -C <path> rev-parse <ref>`.
  if (args.gitUrl.startsWith("file://")) {
    const localPath = args.gitUrl.slice("file://".length);
    const proc = spawnSync("git", ["-C", localPath, "rev-parse", args.gitRef], {
      encoding: "utf8",
    });
    if (proc.status === 0 && typeof proc.stdout === "string") {
      return proc.stdout.trim() || null;
    }
  }

  // For remote URLs, try `git ls-remote <url> <ref>`.
  if (
    args.gitUrl.startsWith("http://") ||
    args.gitUrl.startsWith("https://") ||
    args.gitUrl.startsWith("git@")
  ) {
    const proc = spawnSync("git", ["ls-remote", args.gitUrl, args.gitRef], {
      encoding: "utf8",
    });
    if (proc.status === 0 && typeof proc.stdout === "string") {
      const line = proc.stdout.trim().split("\n")[0];
      const hash = line?.split(/\s+/)[0];
      return hash && hash.length >= 7 ? hash : null;
    }
  }

  return null;
}

const TASKS: TaskDef[] = [
  {
    id: "atif",
    requirement: "Create OK.txt with the text: ok",
    verifyCmd:
      'cd /alfred && bun -e \'const raw = await Bun.file("/logs/verifier/trajectory.json").text(); const traj = JSON.parse(raw); if (typeof traj.schema_version !== "string" || !traj.schema_version.startsWith("ATIF-")) { console.error("missing_or_invalid_schema_version"); process.exit(1); } if (typeof traj.session_id !== "string" || traj.session_id.length === 0) { console.error("missing_session_id"); process.exit(1); } if (!Array.isArray(traj.steps) || traj.steps.length === 0) { console.error("missing_steps"); process.exit(1); } const { validateAtifTrajectory } = await import("@alfred/runtime/trajectory/validate"); const v = validateAtifTrajectory(traj); if (!v.ok) { console.error(JSON.stringify(v.errors, null, 2)); process.exit(1); }\'',
    oracleCmd: "printf 'ok\n' > OK.txt",
    profile: "pr",
  },
  {
    id: "failtest",
    requirement:
      "Fix the project so `bun test` passes. Do not modify any test files.",
    verifyCmd:
      "bash -lc 'test -f tests.sig && shasum -a 256 test/* | sort | diff -u tests.sig - >/dev/null && bun test'",
    oracleCmd:
      "perl -0777 -i -pe 's/return a \\+ b \\+ 1;/return a + b;/g' src/math.ts",
    profile: "pr",
  },
  {
    id: "regress",
    requirement:
      "Fix the failing test so `bun test` passes, without breaking the regression test. Do not modify any test files.",
    verifyCmd:
      "bash -lc 'test -f tests.sig && shasum -a 256 test/* | sort | diff -u tests.sig - >/dev/null && bun test'",
    oracleCmd:
      "perl -0777 -i -pe 's/return a - b;/return a + b;/g' src/calc.ts",
    profile: "pr",
  },
  {
    id: "stuck",
    requirement:
      "Immediately escalate: write the standard ALFRED escalation file with reason 'harbor_stuck_eval' and exit. Do not modify the workspace.",
    verifyCmd:
      'bash -lc \'f=$(find . -name "ESCALATION-*.md" -type f -size +0c -print -quit); test -n "$f" && grep -q "harbor_stuck_eval" "$f"\'',
    oracleCmd: "printf 'harbor_stuck_eval\n' > ESCALATION-oracle.md",
    profile: "pr",
  },
  {
    id: "context",
    requirement:
      "Fix the project so `bun test` passes. The expected value exists in local code; do not hardcode guesses. Do not modify test files.",
    verifyCmd:
      "bash -lc 'test -f tests.sig && shasum -a 256 test/* | sort | diff -u tests.sig - >/dev/null && bun test'",
    oracleCmd:
      "perl -0777 -i -pe 's/return \"hello\";/return EXPECTED_GREETING;/g' src/greet.ts",
    profile: "pr",
  },
  {
    id: "hello",
    requirement: "Create HELLO.txt with the text: hello",
    verifyCmd: "test -f HELLO.txt && grep -qx 'hello' HELLO.txt",
    oracleCmd: "printf 'hello\n' > HELLO.txt",
    profile: "nightly",
  },
  {
    id: "counter",
    requirement: "Create counter.py that prints numbers 1 to 5, one per line",
    verifyCmd:
      "python3 counter.py | grep -q '^1$' && python3 counter.py | grep -q '^5$' && python3 counter.py | wc -l | grep -q '^5$'",
    oracleCmd:
      "cat > counter.py <<'EOF'\nfor i in range(1, 6):\n    print(i)\nEOF\n",
    profile: "nightly",
  },
  {
    id: "greet",
    requirement:
      "Create greet.sh that takes one argument and prints 'Hello, <arg>!'",
    verifyCmd: "bash greet.sh World | grep -q 'Hello, World!'",
    oracleCmd: `cat > greet.sh <<'EOF'
#!/bin/bash
set -euo pipefail
printf 'Hello, %s!\\n' "\${1-}"
EOF
chmod +x greet.sh
`,
    profile: "nightly",
  },
  {
    id: "sum",
    requirement:
      "Create sum.js that reads two numbers from stdin and prints their sum",
    verifyCmd: "echo '3\n5' | node sum.js | grep -q '^8$'",
    oracleCmd:
      "cat > sum.js <<'EOF'\nconst fs = require('node:fs');\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\nconst a = Number(input[0] ?? 0);\nconst b = Number(input[1] ?? 0);\nprocess.stdout.write(String(a + b));\nEOF\n",
    profile: "nightly",
  },
  {
    id: "readme",
    requirement:
      "Create README.md with the title 'Test Project' and a description 'This is a test project for Harbor evaluation.'",
    verifyCmd:
      "test -f README.md && grep -q 'Test Project' README.md && grep -q 'test project for Harbor' README.md",
    oracleCmd:
      "cat > README.md <<'EOF'\n# Test Project\n\nThis is a test project for Harbor evaluation.\nEOF\n",
    profile: "nightly",
  },
  {
    id: "json",
    requirement:
      "Create data.json with a JSON object containing 'name': 'alfred' and 'version': '1.0.0'",
    verifyCmd:
      'test -f data.json && cat data.json | grep -q \'"name":\\s*"alfred"\' && cat data.json | grep -q \'"version":\\s*"1.0.0"\'',
    oracleCmd:
      'cat > data.json <<\'EOF\'\n{"name":"alfred","version":"1.0.0"}\nEOF\n',
    profile: "nightly",
  },
  {
    id: "dir",
    requirement:
      "Create a directory 'output' and a file 'output/result.txt' containing 'success'",
    verifyCmd:
      "test -d output && test -f output/result.txt && grep -q 'success' output/result.txt",
    oracleCmd: "mkdir -p output && printf 'success\n' > output/result.txt",
    profile: "nightly",
  },
  {
    id: "math",
    requirement:
      "Create calc.py with a function add(a, b) that returns a + b, and test it prints '7' when called with 3 and 4",
    verifyCmd:
      "python3 -c 'from calc import add; assert add(3, 4) == 7; print(\"ok\")' | grep -q 'ok'",
    oracleCmd: "cat > calc.py <<'EOF'\ndef add(a, b):\n    return a + b\nEOF\n",
    profile: "nightly",
  },
  {
    id: "typecheck",
    requirement:
      "Fix the TypeScript project so typechecking passes. Do not weaken types or disable strictness.",
    verifyCmd:
      "node /alfred/node_modules/typescript/bin/tsc -p tsconfig.json --noEmit",
    oracleCmd:
      "perl -0777 -i -pe 's/formatUser\\(\\{ name: 123 \\}\\);/formatUser({ name: \"ok\" });/g' src/index.ts",
    profile: "nightly",
  },
  {
    id: "pair",
    requirement: "Create PAIR.txt with the text: pair",
    verifyCmd:
      'cd /alfred && bun -e \'const raw = await Bun.file("/logs/verifier/trajectory.json").text(); const traj = JSON.parse(raw); const steps = Array.isArray(traj.steps) ? traj.steps : []; const toolCallCount = steps.reduce((n, s) => n + (Array.isArray(s.tool_calls) ? s.tool_calls.length : 0), 0); if (toolCallCount <= 0) { console.error("no_tool_calls" ); process.exit(1); } const { validateAtifTrajectory } = await import("@alfred/runtime/trajectory/validate"); const v = validateAtifTrajectory(traj); if (!v.ok) { console.error(JSON.stringify(v.errors, null, 2)); process.exit(1); }\'',
    oracleCmd: "printf 'pair\n' > PAIR.txt",
    profile: "nightly",
  },
  {
    id: "scope",
    requirement: "Create SCOPE.txt with the text: scope",
    verifyCmd:
      'cd /alfred && bun -e \'const raw = await Bun.file("/logs/verifier/trajectory.json").text(); const traj = JSON.parse(raw); const steps = Array.isArray(traj.steps) ? traj.steps : []; const has = steps.some((s) => (s?.extra?.eventType === "require-scope") || (typeof s?.message === "string" && s.message.includes("require-scope"))); if (!has) { console.error("missing_require_scope_step"); process.exit(1); }\'',
    oracleCmd: "printf 'scope\n' > SCOPE.txt",
    profile: "nightly",
    auto: "medium",
  },
  {
    id: "blocked",
    requirement:
      "Try to read the file MISSING_INPUT.txt and use it to decide what to do. If it does not exist, escalate by writing an escalation file containing the line 'harbor_blocked_missing_input' and exit. Do not create MISSING_INPUT.txt.",
    verifyCmd:
      'bash -lc \'f=$(find . -name "ESCALATION-*.md" -type f -size +0c -print -quit); test -n "$f" && grep -q "harbor_blocked_missing_input" "$f"\'',
    oracleCmd: "printf 'harbor_blocked_missing_input\n' > ESCALATION-oracle.md",
    profile: "nightly",
  },
  {
    id: "lintfix",
    requirement:
      "Fix formatting/lint issues so Biome passes on the workspace. Do not disable rules.",
    verifyCmd:
      "node /alfred/node_modules/@biomejs/biome/bin/biome check --config-path biome.fixture.json .",
    oracleCmd:
      "node /alfred/node_modules/@biomejs/biome/bin/biome format --config-path biome.fixture.json --write . && node /alfred/node_modules/@biomejs/biome/bin/biome check --config-path biome.fixture.json .",
    profile: "nightly",
  },
  {
    id: "build",
    requirement:
      "Fix the project so `bun build src/index.ts --outfile dist/out.js` succeeds.",
    verifyCmd: "bun build src/index.ts --outfile dist/out.js",
    oracleCmd: "perl -0777 -i -pe 's/main\\(;\\s*$/main();\\n/gm' src/index.ts",
    profile: "nightly",
  },
  {
    id: "multifile",
    requirement:
      "Fix the project so `bun test` passes. This requires a multi-file change (not just one file). Do not modify test files.",
    verifyCmd:
      "bash -lc 'test -f tests.sig && shasum -a 256 test/* | sort | diff -u tests.sig - >/dev/null && bun test'",
    oracleCmd: `perl -0777 -i -pe 's/\\$\\{partA\\(\\)\\}\\$\\{partC\\(\\)\\}\\$\\{partB\\(\\)\\}/\\\${partA()}\\\${partB()}\\\${partC()}/g' src/index.ts`,
    profile: "nightly",
  },
];

async function copyDir(src: string, dst: string): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      await copyDir(from, to);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

async function maybeCopyFixture(args: {
  datasetRoot: string;
  taskId: string;
}): Promise<void> {
  const fixtureDir = path.resolve(
    "harbor",
    "fixtures",
    args.taskId,
    "workspace"
  );
  const taskDir = path.join(args.datasetRoot, args.taskId);
  const taskWorkspaceDir = path.join(taskDir, "workspace");

  const exists = await fs
    .stat(fixtureDir)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!exists) {
    return;
  }

  await fs.rm(taskWorkspaceDir, { recursive: true, force: true });
  await copyDir(fixtureDir, taskWorkspaceDir);
}

async function generateDataset(
  outDir: string,
  alfredGitUrl: string,
  alfredGitRef: string,
  profile: "pr" | "nightly"
): Promise<void> {
  const datasetRoot = path.resolve(outDir);
  await fs.mkdir(datasetRoot, { recursive: true });

  // Generate each task
  const tasks = TASKS.filter((t) => t.profile === profile);
  for (const task of tasks) {
    const _taskDir = path.join(datasetRoot, task.id);
    console.log(`Generating task: ${task.id}`);

    const proc = spawnSync(
      "bun",
      [
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
        "--oracle",
        task.oracleCmd,
        ...(task.auto ? (["--auto", task.auto] as const) : ([] as const)),
        "--alfredGitUrl",
        alfredGitUrl,
        "--alfredGitRef",
        alfredGitRef,
      ],
      { stdio: "inherit" }
    );
    if (proc.status !== 0) {
      throw new Error(
        `harbor_gen_failed task=${task.id} status=${proc.status}`
      );
    }

    await maybeCopyFixture({ datasetRoot, taskId: task.id });
  }

  // Create registry.json
  const registry = {
    version: "1.0",
    name: "alfred-datasets",
    description: "ALFRED evaluation tasks for Harbor",
    alfred: {
      gitUrl: alfredGitUrl,
      gitRef: alfredGitRef,
      gitCommit: resolveGitCommit({
        gitUrl: alfredGitUrl,
        gitRef: alfredGitRef,
      }),
    },
    profile,
    tasks: tasks.map((t) => ({
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
  const profile = (
    (process.env.HARBOR_DATASET_PROFILE ?? "pr").trim() === "nightly"
      ? "nightly"
      : "pr"
  ) as "pr" | "nightly";

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

  await generateDataset(outDir, alfredGitUrl, alfredGitRef, profile);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(
      `harbor_dataset_failed: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  });
}
