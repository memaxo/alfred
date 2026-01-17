#!/usr/bin/env bun

import * as fs from "node:fs/promises";
import * as path from "node:path";

type GenArgs = {
  outDir: string;
  id: string;
  requirement: string;
  verifyCmd: string;
  timeoutSec: number;
  alfredGitUrl: string;
  alfredGitRef: string;
};

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/harbor.ts gen --outDir <dir> --id <taskId> --requirement <text> --verify <cmd>",
    "",
    "Options:",
    "  --outDir <dir>        Output directory (task folder will be created under it)",
    "  --id <taskId>         Task directory name (single word recommended)",
    "  --requirement <text>  Instruction for ALFRED",
    "  --verify <cmd>        Shell command to verify success (run inside /task/workspace)",
    "  --timeoutSec <n>      Agent/verifier timeout (default 3600)",
    "  --alfredGitUrl <url>  REQUIRED. Git URL to clone ALFRED inside the task container (or env ALFRED_GIT_URL)",
    "  --alfredGitRef <ref>  Git ref/branch/tag (default main)",
  ].join("\n");
}

function parseArgs(argv: string[]): { cmd: string | null; args: GenArgs } {
  const cmd = argv[0] ?? null;
  const out: GenArgs = {
    outDir: "",
    id: "",
    requirement: "",
    verifyCmd: "",
    timeoutSec: 3600,
    alfredGitUrl: process.env.ALFRED_GIT_URL ?? "",
    alfredGitRef: process.env.ALFRED_GIT_REF ?? "main",
  };

  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a) {
      continue;
    }

    if (a === "--outDir") {
      out.outDir = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--id") {
      out.id = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--requirement") {
      out.requirement = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--verify") {
      out.verifyCmd = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--timeoutSec") {
      out.timeoutSec = Number.parseInt(argv[i + 1] ?? "", 10) || out.timeoutSec;
      i += 1;
      continue;
    }
    if (a === "--alfredGitUrl") {
      out.alfredGitUrl = argv[i + 1] ?? out.alfredGitUrl;
      i += 1;
      continue;
    }
    if (a === "--alfredGitRef") {
      out.alfredGitRef = argv[i + 1] ?? out.alfredGitRef;
      i += 1;
    }
  }

  return { cmd, args: out };
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await Bun.write(filePath, content);
}

function dockerfile(args: GenArgs): string {
  return [
    "FROM oven/bun:1.3.5",
    "RUN apt-get update && apt-get install -y git ca-certificates && rm -rf /var/lib/apt/lists/*",
    "",
    `ARG ALFRED_GIT_URL=${args.alfredGitUrl}`,
    `ARG ALFRED_GIT_REF=${args.alfredGitRef}`,
    "",
    "WORKDIR /alfred",
    'RUN git clone --depth 1 --branch "${ALFRED_GIT_REF}" "${ALFRED_GIT_URL}" .',
    "RUN bun install --frozen-lockfile",
    "",
    "WORKDIR /task",
    "COPY . /task",
  ].join("\n");
}

function taskToml(args: GenArgs): string {
  const t = args.timeoutSec;
  return [
    'version = "1.0"',
    "",
    "[metadata]",
    'author_name = "alfred"',
    'author_email = "owner@alfred.local"',
    'difficulty = "medium"',
    'category = "programming"',
    'tags = ["alfred", "workflow"]',
    "",
    "[agent]",
    `timeout_sec = ${t}.0`,
    "",
    "[verifier]",
    `timeout_sec = ${t}.0`,
    "",
  ].join("\n");
}

function solveSh(): string {
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    "# Oracle solution: deterministic implementation that always passes.",
    "# This is the reference implementation used to verify task correctness.",
    "# Harbor will compare agent outputs against this oracle.",
    "",
    "# Harbor convention: the verifier mount is at /logs/verifier",
    "mkdir -p /logs/verifier",
    "",
    "cd /task/workspace",
    "",
    "# Run the oracle implementation (this should always succeed).",
    "# For now, this is a placeholder - replace with deterministic oracle logic.",
    "# The oracle should produce the same result as a perfect agent execution.",
    "",
    "# Mark oracle as successful (always passes).",
    "echo 1 > /logs/verifier/reward.txt",
    "",
  ].join("\n");
}

function agentSh(): string {
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    "# Harbor agent adapter: invokes ALFRED workflow runner.",
    "# Harbor calls this script with -a alfred to run ALFRED as the agent under test.",
    "",
    "# Harbor convention: the verifier mount is at /logs/verifier",
    "mkdir -p /logs/verifier",
    "",
    "REQ_FILE=/task/instruction.md",
    "WORKDIR=/task/workspace",
    "TRAJ=/logs/verifier/trajectory.json",
    "DB=/logs/verifier/alfred.db",
    "",
    'REQ=$(cat "$REQ_FILE")',
    "",
    "cd /alfred",
    "",
    "# Provider selection:",
    "# - If AI_GATEWAY_API_KEY is set, use Vercel AI Gateway (default).",
    "# - If only OPENAI_API_KEY is set, ALFRED will use @ai-sdk/openai directly.",
    "# - Harbor jobs can provide either key depending on their setup.",
    "",
    'export DATABASE_URL="sqlite:$DB"',
    "",
    'bun workflow:run --requirement "$REQ" --workspace "$WORKDIR" --outTrajectory "$TRAJ"',
    "",
  ].join("\n");
}

function testSh(args: GenArgs): string {
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    "mkdir -p /logs/verifier",
    "cd /task/workspace",
    "",
    "# Run verifier command.",
    `if ${args.verifyCmd}; then`,
    "  echo 1 > /logs/verifier/reward.txt",
    "else",
    "  echo 0 > /logs/verifier/reward.txt",
    "fi",
    "",
  ].join("\n");
}

async function chmodX(filePath: string): Promise<void> {
  await fs.chmod(filePath, 0o755);
}

async function genTask(args: GenArgs): Promise<void> {
  const root = path.resolve(args.outDir, args.id);
  await fs.mkdir(root, { recursive: true });

  await writeFile(path.join(root, "task.toml"), taskToml(args));
  await writeFile(
    path.join(root, "instruction.md"),
    `${args.requirement.trim()}\n`
  );
  await writeFile(path.join(root, "environment/Dockerfile"), dockerfile(args));
  await writeFile(path.join(root, "solution/solve.sh"), solveSh());
  await writeFile(path.join(root, "tests/test.sh"), testSh(args));
  await writeFile(path.join(root, "agents/alfred.sh"), agentSh());

  // Minimal workspace placeholder (users can replace this folder with a real repo snapshot).
  await writeFile(
    path.join(root, "workspace/README.md"),
    [
      "# Harbor Task Workspace",
      "",
      "This folder is the task workspace mounted inside the task container at `/task/workspace`.",
      "Replace it with the repo/project you want ALFRED to operate on.",
      "",
    ].join("\n")
  );

  await chmodX(path.join(root, "solution/solve.sh"));
  await chmodX(path.join(root, "tests/test.sh"));
  await chmodX(path.join(root, "agents/alfred.sh"));
}

async function main() {
  const { cmd, args } = parseArgs(process.argv.slice(2));
  if (cmd !== "gen") {
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }
  if (
    !(
      args.outDir &&
      args.id &&
      args.requirement &&
      args.verifyCmd &&
      args.alfredGitUrl
    )
  ) {
    process.stderr.write("Missing required arguments.\n");
    process.stderr.write(`${usage()}\n`);
    process.exit(2);
  }

  await genTask(args);
  process.stdout.write(
    `${JSON.stringify({ ok: true, taskDir: path.resolve(args.outDir, args.id) }, null, 2)}\n`
  );
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(
      `harbor_gen_failed: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  });
}
