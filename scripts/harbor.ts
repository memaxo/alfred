#!/usr/bin/env bun

import * as fs from "node:fs/promises";
import * as path from "node:path";

type GenArgs = {
  outDir: string;
  id: string;
  requirement: string;
  verifyCmd: string;
  oracleCmd: string;
  runner: "oracle" | "alfred";
  auto: "" | "read" | "low" | "medium" | "high";
  timeoutSec: number;
  alfredGitUrl: string;
  alfredGitRef: string;
};

function usage(): string {
  return [
    "Usage:",
    "  bun scripts/harbor.ts gen --outDir <dir> --id <taskId> --requirement <text> --verify <cmd> [--oracle <cmd>]",
    "",
    "Options:",
    "  --outDir <dir>        Output directory (task folder will be created under it)",
    "  --id <taskId>         Task directory name (single word recommended)",
    "  --requirement <text>  Instruction for ALFRED",
    "  --verify <cmd>        Shell command to verify success (run inside /task/workspace)",
    "  --oracle <cmd>        Optional. Shell command that deterministically produces a correct solution (run inside /task/workspace)",
    "  --auto <band>         Optional. read|low|medium|high (passed to bun workflow:run)",
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
    oracleCmd: "",
    runner: "oracle",
    auto: "",
    timeoutSec: 3600,
    alfredGitUrl: process.env.ALFRED_GIT_URL ?? "",
    alfredGitRef: process.env.ALFRED_GIT_REF ?? "dev",
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
    if (a === "--oracle") {
      out.oracleCmd = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (a === "--runner") {
      const v = (argv[i + 1] ?? "").trim().toLowerCase();
      if (v === "oracle" || v === "alfred") {
        out.runner = v;
      }
      i += 1;
      continue;
    }
    if (a === "--auto") {
      const v = (argv[i + 1] ?? "").trim().toLowerCase();
      if (v === "read" || v === "low" || v === "medium" || v === "high") {
        out.auto = v;
      }
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

function dockerfile(_args: GenArgs): string {
  // Simplified Dockerfile for Harbor tasks.
  // Does NOT clone full ALFRED repo (which has native deps that fail to build).
  // The oracle agent just runs solve.sh; ALFRED agent would need separate setup.
  // WORKDIR is /workspace - Harbor runs agents and verifiers from this directory.
  // Workspace files are copied from environment/workspace/ to /workspace.
  if (_args.runner === "alfred") {
    return [
      // Built with docker/harbor/alfred-base.Dockerfile
      "FROM alfred-harbor-base",
      "",
      "WORKDIR /workspace",
      "COPY workspace/ /workspace/",
      "RUN if [ -f package.json ]; then bun install; fi",
    ].join("\n");
  }
  return [
    "FROM oven/bun:1.3.5",
    "RUN apt-get update && apt-get install -y git ca-certificates python3 perl && rm -rf /var/lib/apt/lists/*",
    "",
    "WORKDIR /workspace",
    "COPY workspace/ /workspace/",
    "RUN if [ -f package.json ]; then bun install; fi",
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

function solveSh(args: GenArgs): string {
  // Use unique heredoc delimiter to avoid conflicts with nested heredocs in commands
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    "# Oracle solution: deterministic implementation that should satisfy the verifier.",
    "# This script must NOT write reward files; the verifier owns reward output.",
    "# Runs from WORKDIR (/workspace) set by Dockerfile.",
    "",
    "ORACLE_CMD=$(cat <<'__HARBOR_ORACLE_END__'",
    `${args.oracleCmd}`.trimEnd(),
    "__HARBOR_ORACLE_END__",
    ")",
    "",
    'if [ -z "$ORACLE_CMD" ]; then',
    '  echo "No oracle configured (use --oracle). Skipping oracle execution." >&2',
    "  exit 0",
    "fi",
    "",
    'bash -lc "$ORACLE_CMD"',
    "",
  ].join("\n");
}

function agentSh(args: GenArgs): string {
  // Note: ALFRED agent requires full ALFRED repo with native deps.
  // This script is for reference; actual ALFRED agent execution needs
  // a Dockerfile that builds ALFRED or uses a pre-built image.
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    "# Harbor agent adapter: invokes ALFRED workflow runner.",
    "# Harbor calls this script with -a alfred to run ALFRED as the agent under test.",
    "# NOTE: Requires ALFRED to be installed in /alfred (see full Dockerfile variant).",
    "",
    "# Harbor convention: the verifier mount is at /logs/verifier",
    "mkdir -p /logs/verifier",
    "",
    "REQ_FILE=/instruction.md",
    "WORKSPACE_DIR=/workspace",
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
    ...(args.auto
      ? [
          'bun workflow:run --requirement "$REQ" --workspace "$WORKSPACE_DIR" --outTrajectory "$TRAJ" --auto "' +
            args.auto +
            '"',
        ]
      : [
          'bun workflow:run --requirement "$REQ" --workspace "$WORKSPACE_DIR" --outTrajectory "$TRAJ"',
        ]),
    "",
  ].join("\n");
}

function testSh(args: GenArgs): string {
  return [
    "#!/bin/bash",
    "set -euo pipefail",
    "",
    "mkdir -p /logs/verifier",
    "# Runs from WORKDIR (/workspace) set by Dockerfile.",
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

function dockerComposeWithDockerSock(): string {
  // Harbor uses environment/docker-compose.yaml when present.
  // We mirror Harbor's docker-compose-build.yaml and add /var/run/docker.sock
  // so ALFRED can create AgentFS workspaces from inside the container.
  return [
    "services:",
    "  main:",
    "    build:",
    "      context: ${CONTEXT_DIR}",
    "    image: ${MAIN_IMAGE_NAME}",
    '    command: [ "sh", "-c", "sleep infinity" ]',
    "    network_mode: ${NETWORK_MODE:-bridge}",
    "    environment:",
    "      - TEST_DIR=${TEST_DIR}",
    "      - CONTEXT_DIR=${CONTEXT_DIR}",
    "      - ORCH_ALLOW_CWD_PREFIXES=${CONTEXT_DIR}",
    "      - ORCH_SKIP_SECURE_SPAWN=1",
    "      - ORCH_DOCKER_IMAGE=${ORCH_DOCKER_IMAGE:-alfred-agentfs:codex}",
    "      - ORCH_EXECUTOR=${ORCH_EXECUTOR:-codex}",
    "      - ORCH_EXECUTOR_FALLBACK=${ORCH_EXECUTOR_FALLBACK:-1}",
    "      - ORCH_CODEX_ALLOW_OPENAI_KEY=${ORCH_CODEX_ALLOW_OPENAI_KEY:-1}",
    "      - ORCH_CODEX_APPROVAL=${ORCH_CODEX_APPROVAL:-on-request}",
    "      - OPENAI_API_KEY=${OPENAI_API_KEY:-}",
    "      - CODEX_API_KEY=${CODEX_API_KEY:-}",
    "      - CODEX_MODEL=${CODEX_MODEL:-}",
    "      - FACTORY_API_KEY=${FACTORY_API_KEY:-}",
    "      - AGENT_ED25519_PRIVATE=${AGENT_ED25519_PRIVATE:-}",
    "      - AGENT_ED25519_PUBLIC_PEM=${AGENT_ED25519_PUBLIC_PEM:-}",
    "      - AGENT_ISSUER=${AGENT_ISSUER:-alfred}",
    "      - TOOL_AUDIENCE=${TOOL_AUDIENCE:-alfred:tools}",
    "    volumes:",
    "      - ${HOST_VERIFIER_LOGS_PATH}:${ENV_VERIFIER_LOGS_PATH}",
    "      - ${HOST_AGENT_LOGS_PATH}:${ENV_AGENT_LOGS_PATH}",
    "      - /var/run/docker.sock:/var/run/docker.sock",
    // Mount the host workspace directory at the SAME absolute host path, so
    // Docker launched from inside the container can mount it successfully.
    "      - ${CONTEXT_DIR}/workspace:${CONTEXT_DIR}/workspace:rw",
    "    deploy:",
    "      resources:",
    "        limits:",
    "          cpus: ${CPUS}",
    "          memory: ${MEMORY}",
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
  if (args.runner === "alfred") {
    await writeFile(
      path.join(root, "environment/docker-compose.yaml"),
      dockerComposeWithDockerSock()
    );
  }
  await writeFile(path.join(root, "solution/solve.sh"), solveSh(args));
  await writeFile(path.join(root, "tests/test.sh"), testSh(args));
  await writeFile(path.join(root, "agents/alfred.sh"), agentSh(args));

  // Workspace files go into environment/workspace/ so they're included in Docker build context.
  // The Dockerfile COPYs them to /workspace in the container.
  await writeFile(
    path.join(root, "environment/workspace/README.md"),
    [
      "# Harbor Task Workspace",
      "",
      "This folder is the task workspace copied into the container at `/workspace`.",
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
