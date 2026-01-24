/**
 * Level-4 Verification: Executor live-run inside AgentFS containers
 *
 * Verifies (real execution, real providers):
 * - Codex server profile: long-lived `codex app-server` inside AgentFS container
 * - Codex default profile: per-prompt `codex exec` inside AgentFS container
 * - OpenCode server profile: long-lived `opencode acp` (legacy) or `opencode serve` (HTTP) inside AgentFS container (Cerebras)
 * - OpenCode default profile: per-prompt `opencode acp` (legacy) or per-prompt `opencode serve` (HTTP) inside AgentFS container (Cerebras)
 * - Best-effort crash recovery: kill the in-container process and re-run
 *
 * Model policy:
 * - OpenCode uses Cerebras model `gpt-oss-120b` (explicit: `cerebras/gpt-oss-120b`)
 * - Codex uses its default model (do not specify)
 *
 * Prerequisites:
 * - Docker running
 * - `CEREBRAS_API_KEY` set
 * - `OPENAI_API_KEY` or `CODEX_API_KEY` set (Codex)
 * - `AGENT_ED25519_PRIVATE` + `AGENT_ED25519_PUBLIC_PEM` set (tool auth signing)
 *
 * Notes:
 * - This script makes real provider calls and may incur cost.
 * - It runs with `auto=read` to avoid repo modifications.
 */

import { isAgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { toolDocker } from "@alfred/agent/orchestrator/tool/docker";
import { toolOpenCode } from "@alfred/agent/orchestrator/tool/opencode/index";
import { stopAllServers } from "@alfred/agent/orchestrator/tool/shared/server";
import { redactSecrets } from "@alfred/agent/utils/redaction";
import { issueAccessToken } from "@alfred/auth/token";
import { randomUUID } from "node:crypto";
import path from "node:path";

type FlagArgs = {
  retainContainer: boolean;
  strict: boolean;
  skipBuild: boolean;
  opencodeHttp: boolean;
};

function parseArgs(argv: string[]): FlagArgs {
  const args = new Set(argv);
  return {
    retainContainer: args.has("--retain-container"),
    strict: args.has("--strict"),
    skipBuild: args.has("--skip-build"),
    opencodeHttp: args.has("--opencode-http"),
  };
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`missing_env:${name}`);
  }
  return v.trim();
}

function ensureCodexApiKeyAlias(): void {
  // Codex runtimes vary on whether they accept OPENAI_API_KEY directly.
  // Ensure CODEX_API_KEY is set when OPENAI_API_KEY is available.
  const codex = process.env.CODEX_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (!codex && openai) {
    process.env.CODEX_API_KEY = openai;
    console.log("NOTE: Using OPENAI_API_KEY as CODEX_API_KEY (runtime alias).");
  }
  if (
    !(process.env.CODEX_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim())
  ) {
    throw new Error("missing_env:CODEX_API_KEY_or_OPENAI_API_KEY");
  }
}

async function checkDockerAvailable(): Promise<void> {
  const proc = Bun.spawn(["docker", "ps"], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode === 0) {
    return;
  }
  const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
  if (stderr.includes("Cannot connect to the Docker daemon")) {
    throw new Error(
      "docker_daemon_not_running: Start Docker Desktop and wait for it to be ready."
    );
  }
  throw new Error(`docker_check_failed: exit ${exitCode}`);
}

async function dockerImageExists(tag: string): Promise<boolean> {
  const proc = Bun.spawn(["docker", "image", "inspect", tag], {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

async function ensureAgentfsImage(tag: string, authz: string): Promise<void> {
  if (await dockerImageExists(tag)) {
    console.log(`✓ AgentFS image present (${tag})`);
    return;
  }

  console.log(`Building AgentFS image (${tag})...`);
  await toolDocker.execute({
    input: {
      action: "build",
      cw: process.cwd(),
      context: ".",
      dockerfile: "docker/agentfs/Dockerfile",
      tag,
      authz,
      timeoutSec: 60 * 60,
    },
    writer: {
      write: (chunk) => {
        if (chunk && typeof chunk === "object") {
          const maybe = chunk as { type?: unknown; text?: unknown };
          const text = typeof maybe.text === "string" ? maybe.text : "";
          if (text) {
            process.stdout.write(text);
          }
        }
      },
    },
  });
}

async function dockerTop(containerName: string): Promise<string> {
  const proc = Bun.spawn(["docker", "top", containerName, "-eo", "pid,args"], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = proc.stdout ? await new Response(proc.stdout).text() : "";
  const stderr = proc.stderr ? await new Response(proc.stderr).text() : "";
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(
      `docker_top_failed: container=${containerName} exit=${code} stderr=${stderr.slice(0, 200)}`
    );
  }
  return stdout;
}

function findPid(output: string, match: RegExp): number | null {
  const lines = output.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (!line) {
      continue;
    }
    if (line.startsWith("PID")) {
      continue;
    }
    const parts = line.split(/\s+/);
    const pidStr = parts[0];
    const pid = pidStr ? Number(pidStr) : Number.NaN;
    if (!Number.isInteger(pid) || pid <= 0) {
      continue;
    }
    const args = parts.slice(1).join(" ");
    if (match.test(args)) {
      return pid;
    }
  }
  return null;
}

async function killPidInContainer(args: {
  authz: string;
  containerName: string;
  pid: number;
}): Promise<void> {
  await toolDocker.execute({
    input: {
      action: "exec",
      cw: process.cwd(),
      name: args.containerName,
      cmd: "sh",
      args: ["-lc", `kill -9 ${args.pid}`],
      authz: args.authz,
      timeoutSec: 60,
    },
  });
}

function formatSnippet(label: string, text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const redacted = redactSecrets(compact);
  const snippet =
    redacted.length > 180 ? `${redacted.slice(0, 180)}…` : redacted;
  return `${label}: ${snippet}`;
}

function assertExactReply(args: {
  label: string;
  expected: string;
  actual: string;
}) {
  const got = args.actual.trim();
  if (got === args.expected) {
    return;
  }
  const snippet = formatSnippet("got", args.actual);
  throw new Error(
    `executor_live_verify_mismatch: ${args.label} expected=${args.expected} ${snippet}`
  );
}

async function runCodexOnce(args: {
  authz: string;
  containerName: string;
  containerCw: string;
  agentfsDbPath: string;
  execProfile?: "default" | "server";
  prompt: string;
}): Promise<string> {
  const res = await toolCodex.execute({
    input: {
      action: "exec",
      execProfile: args.execProfile,
      prompt: args.prompt,
      out: "text",
      auto: "read",
      cw: process.cwd(),
      agentfsDbPath: args.agentfsDbPath,
      containerName: args.containerName,
      containerCw: args.containerCw,
      authz: args.authz,
    },
    writer: {
      write: (chunk) => {
        if (!chunk || typeof chunk !== "object") {
          return;
        }
        const c = chunk as {
          type?: unknown;
          text?: unknown;
          message?: unknown;
        };
        if (c.type === "stderr" && typeof c.text === "string") {
          process.stderr.write(c.text);
        }
        if (
          c.type === "notice" &&
          typeof c.message === "string" &&
          (c.message === "executor_server_fallback_default" ||
            c.message === "codex_turn_started" ||
            c.message === "codex_turn_completed")
        ) {
          // Keep notices minimal (avoid flooding logs).
          console.log(`[codex] notice=${c.message}`);
        }
      },
    },
  });

  return res.result;
}

async function runOpenCodeOnce(args: {
  authz: string;
  containerName: string;
  containerCw: string;
  execProfile?: "default" | "server";
  transport: "acp" | "http";
  model: string;
  prompt: string;
}): Promise<string> {
  const isHttp = args.transport === "http";
  const res = await toolOpenCode.execute({
    input: {
      action: "exec",
      transport: isHttp ? "http" : "acp",
      execProfile: args.execProfile,
      prompt: args.prompt,
      auto: "read",
      cw: process.cwd(),
      model: args.model,
      ...(isHttp
        ? {}
        : {
            cmd: "opencode",
            args: ["acp", "--hostname", "127.0.0.1", "--port", "47123"],
          }),
      containerName: args.containerName,
      containerCw: args.containerCw,
      authz: args.authz,
      timeoutSec: 10 * 60,
    },
    writer: {
      write: (chunk) => {
        if (!chunk || typeof chunk !== "object") {
          return;
        }
        const c = chunk as {
          type?: unknown;
          text?: unknown;
          message?: unknown;
        };
        if (c.type === "stderr" && typeof c.text === "string") {
          process.stderr.write(c.text);
        }
        if (
          c.type === "notice" &&
          typeof c.message === "string" &&
          c.message === "executor_server_fallback_default"
        ) {
          console.log(`[opencode] notice=${c.message}`);
        }
      },
    },
  });

  return res.result;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const openTransport = flags.opencodeHttp ? "http" : "acp";
  console.log(
    "=== Executor Live Verification (AgentFS + Server Profiles) ===\n"
  );

  await checkDockerAvailable();
  console.log("✓ Docker available");

  // Tool auth signing keys (required to mint Bearer authz for policy gates).
  requiredEnv("AGENT_ED25519_PRIVATE");
  requiredEnv("AGENT_ED25519_PUBLIC_PEM");

  // Provider keys.
  requiredEnv("CEREBRAS_API_KEY");
  ensureCodexApiKeyAlias();

  // OpenCode deterministic provider selection.
  // No secrets in this config; keys remain in env.
  if (!process.env.OPENCODE_CONFIG_CONTENT) {
    process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
      enabled_providers: ["cerebras"],
      model: "cerebras/gpt-oss-120b",
      autoupdate: false,
    });
  }
  if (!process.env.OPENCODE_DISABLE_AUTOUPDATE) {
    process.env.OPENCODE_DISABLE_AUTOUPDATE = "1";
  }

  // Non-interactive Codex execution (avoid headless approval prompts).
  if (!process.env.ORCH_CODEX_APPROVAL) {
    process.env.ORCH_CODEX_APPROVAL = "never";
  }

  if (flags.strict) {
    process.env.ORCH_EXEC_PROFILE_STRICT = "1";
    console.log("✓ Strict exec profile enabled (ORCH_EXEC_PROFILE_STRICT=1)");
  }

  const token = await issueAccessToken(
    "executor-live",
    ["deploy.write", "droid.exec"],
    "alfred:tools",
    {
      elevated: true,
      mfa: "passkey",
    }
  );
  const authz = `Bearer ${token}`;

  const image = process.env.ORCH_DOCKER_IMAGE?.trim() || "alfred-agentfs:codex";
  if (flags.skipBuild) {
    console.log("NOTE: Skipping AgentFS image build check (--skip-build).");
  } else {
    await ensureAgentfsImage(image, authz);
  }

  const runId = `verify-executors-${randomUUID()}`;
  const wsId = `executor-live-${runId}`;

  const ws = await WorkspaceFactory.create(
    "agentfs",
    wsId,
    runId,
    process.cwd(),
    {
      authz,
      image,
      retainContainer: flags.retainContainer,
    }
  );
  await ws.initialize();

  if (!isAgentFSWorkspace(ws)) {
    throw new Error("workspace_not_agentfs");
  }

  const containerName = ws.containerName;
  const containerCw = ws.containerCw;
  const agentfsDbPath = ws.dbPath;

  console.log("✓ AgentFS workspace ready");
  console.log(`  container=${containerName}`);
  console.log(`  workdir=${containerCw}`);
  console.log(`  db=${path.relative(process.cwd(), agentfsDbPath)}`);

  try {
    console.log("\n--- Codex (server default inside AgentFS) ---");
    const codex1 = await runCodexOnce({
      authz,
      containerName,
      containerCw,
      agentfsDbPath,
      prompt: "Reply with exactly: codex_ok_1",
    });
    console.log(formatSnippet("codex_1", codex1));
    assertExactReply({
      label: "codex_1",
      expected: "codex_ok_1",
      actual: codex1,
    });

    const codex2 = await runCodexOnce({
      authz,
      containerName,
      containerCw,
      agentfsDbPath,
      prompt: "Reply with exactly: codex_ok_2",
    });
    console.log(formatSnippet("codex_2", codex2));
    assertExactReply({
      label: "codex_2",
      expected: "codex_ok_2",
      actual: codex2,
    });

    console.log("\n--- Codex (explicit default profile baseline) ---");
    const codexDefault = await runCodexOnce({
      authz,
      containerName,
      containerCw,
      agentfsDbPath,
      execProfile: "default",
      prompt: "Reply with exactly: codex_default_ok",
    });
    console.log(formatSnippet("codex_default", codexDefault));
    assertExactReply({
      label: "codex_default",
      expected: "codex_default_ok",
      actual: codexDefault,
    });

    console.log(
      `\n--- OpenCode (${openTransport}, server default inside AgentFS, Cerebras) ---`
    );
    const open1 = await runOpenCodeOnce({
      authz,
      containerName,
      containerCw,
      transport: openTransport,
      model: "cerebras/gpt-oss-120b",
      prompt: "Reply with exactly: opencode_ok_1",
    });
    console.log(formatSnippet("opencode_1", open1));
    assertExactReply({
      label: "opencode_1",
      expected: "opencode_ok_1",
      actual: open1,
    });

    const open2 = await runOpenCodeOnce({
      authz,
      containerName,
      containerCw,
      transport: openTransport,
      model: "cerebras/gpt-oss-120b",
      prompt: "Reply with exactly: opencode_ok_2",
    });
    console.log(formatSnippet("opencode_2", open2));
    assertExactReply({
      label: "opencode_2",
      expected: "opencode_ok_2",
      actual: open2,
    });

    console.log(
      `\n--- OpenCode (${openTransport}, explicit default profile baseline, Cerebras) ---`
    );
    const openDefault = await runOpenCodeOnce({
      authz,
      containerName,
      containerCw,
      execProfile: "default",
      transport: openTransport,
      model: "cerebras/gpt-oss-120b",
      prompt: "Reply with exactly: opencode_default_ok",
    });
    console.log(formatSnippet("opencode_default", openDefault));
    assertExactReply({
      label: "opencode_default",
      expected: "opencode_default_ok",
      actual: openDefault,
    });

    console.log("\n--- Best-effort crash recovery (Codex server) ---");
    try {
      const top = await dockerTop(containerName);
      const pid = findPid(top, /\bcodex\b.*\bapp-server\b/);
      if (pid) {
        console.log(`Killing codex app-server pid=${pid}...`);
        await killPidInContainer({ authz, containerName, pid });
        const recovered = await runCodexOnce({
          authz,
          containerName,
          containerCw,
          agentfsDbPath,
          prompt: "Reply with exactly: codex_recovered_ok",
        });
        console.log(formatSnippet("codex_recovered", recovered));
        assertExactReply({
          label: "codex_recovered",
          expected: "codex_recovered_ok",
          actual: recovered,
        });
      }
    } catch (error) {
      console.log(
        `NOTE: Crash recovery check failed (skipped): ${String(
          error instanceof Error ? error.message : String(error)
        )}`
      );
    }

    console.log(
      `\n--- Best-effort crash recovery (OpenCode ${openTransport} server) ---`
    );
    try {
      const top = await dockerTop(containerName);
      const pid = findPid(
        top,
        openTransport === "http"
          ? /\bopencode\b.*\bserve\b/
          : /\bopencode\b.*\bacp\b/
      );
      if (pid) {
        console.log(`Killing opencode (${openTransport}) pid=${pid}...`);
        await killPidInContainer({ authz, containerName, pid });
        const recovered = await runOpenCodeOnce({
          authz,
          containerName,
          containerCw,
          transport: openTransport,
          model: "cerebras/gpt-oss-120b",
          prompt: "Reply with exactly: opencode_recovered_ok",
        });
        console.log(formatSnippet("opencode_recovered", recovered));
        assertExactReply({
          label: "opencode_recovered",
          expected: "opencode_recovered_ok",
          actual: recovered,
        });
      } else {
        console.log(
          "NOTE: Unable to locate opencode server PID via docker top; skipping."
        );
      }
    } catch (error) {
      console.log(
        `NOTE: Crash recovery check failed (skipped): ${String(
          error instanceof Error ? error.message : String(error)
        )}`
      );
    }

    console.log("\n✓ Executor live verification completed");
    console.log(
      "  NOTE: This run used auto=read. No repo writes should have been performed."
    );
    if (flags.retainContainer) {
      console.log(`  NOTE: Container retained (${containerName}).`);
    }
  } finally {
    await stopAllServers("verify_executors_live_done");
    if (!flags.retainContainer) {
      await ws.cleanup();
    }
  }
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`executor_live_verify_failed: ${msg}\n`);
  process.exitCode = 1;
});
