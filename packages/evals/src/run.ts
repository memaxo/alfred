import { stopAllServers } from "@alfred/agent/orchestrator/tool/shared/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StepResult } from "./events.js";
import type { StepSpec } from "./runner.js";
import type {
  ExecutorEvalsConfig,
  ExecutorEvalsResult,
  ExecutorEvalsTimeouts,
} from "./types.js";

import { checkDockerAvailable, ensureAgentfsImage } from "./driver/docker.js";
import { createWorkspace, type RunWorkspace } from "./driver/workspace.js";
import { redactConfig, snapshotEnv } from "./redact.js";
import { createConsoleReporter, createJsonlReporter } from "./report.js";
import { runSteps } from "./runner.js";
import { buildSuiteSteps } from "./suite.js";

interface LogRing {
  push: (line: string) => void;
  lines: () => string[];
}

function createLogRing(maxLines: number): LogRing {
  const buf: string[] = [];
  return {
    push: (line) => {
      const parts = line.split("\n");
      for (const p of parts) {
        if (!p) {
          continue;
        }
        buf.push(p);
        if (buf.length > maxLines) {
          buf.shift();
        }
      }
    },
    lines: () => [...buf],
  };
}

function defaultTimeouts(): ExecutorEvalsTimeouts {
  return {
    totalMs: 25 * 60_000,
    dockerMs: 60_000,
    codexMs: 10 * 60_000,
    opencodeMs: 10 * 60_000,
  };
}

function applyEnvOverrides(
  overrides: Record<string, string | undefined>
): () => void {
  const prev = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    prev.set(key, process.env[key]);
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
  return () => {
    for (const [key, value] of prev.entries()) {
      if (typeof value === "string") {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  };
}

async function writeArtifacts(args: {
  artifactsDir: string;
  config: ExecutorEvalsConfig;
  results: StepResult[];
  ok: boolean;
  logTail: string[];
  env: Partial<Record<string, string>>;
}): Promise<void> {
  await mkdir(args.artifactsDir, { recursive: true });
  await writeFile(
    path.join(args.artifactsDir, "summary.json"),
    JSON.stringify(
      {
        ok: args.ok,
        config: args.config,
        env: args.env,
        results: args.results,
        logTail: args.logTail,
      },
      null,
      2
    )
  );
}

function normalizeTimeouts(cfg: ExecutorEvalsConfig): ExecutorEvalsTimeouts {
  const d = defaultTimeouts();
  return {
    totalMs: cfg.timeouts?.totalMs ?? d.totalMs,
    dockerMs: cfg.timeouts?.dockerMs ?? d.dockerMs,
    codexMs: cfg.timeouts?.codexMs ?? d.codexMs,
    opencodeMs: cfg.timeouts?.opencodeMs ?? d.opencodeMs,
  };
}

function defaultArtifactsDir(runId: string): string {
  return path.join(process.cwd(), "tmp", "evals", runId);
}

export async function runExecutorEvals(
  config: ExecutorEvalsConfig
): Promise<ExecutorEvalsResult> {
  const runId = config.runId ?? `evals-${randomUUID()}`;
  const timeouts = normalizeTimeouts(config);
  const artifactsDir = config.artifactsDir ?? defaultArtifactsDir(runId);
  const logRing = createLogRing(500);
  const image =
    config.image ?? process.env.ORCH_DOCKER_IMAGE ?? "alfred-agentfs:codex";

  const baseReporters = config.reporters?.length
    ? config.reporters
    : [createConsoleReporter()];

  const jsonlPath = path.join(artifactsDir, "events.jsonl");
  const reporters = [...baseReporters, createJsonlReporter(jsonlPath)];

  const safeConfig = redactConfig({ ...config, runId, image });
  const envSnapshot = snapshotEnv([
    "ORCH_DOCKER_IMAGE",
    "CEREBRAS_API_KEY",
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
    "OPENCODE_CONFIG_CONTENT",
    "OPENCODE_DISABLE_AUTOUPDATE",
    "ORCH_CODEX_APPROVAL",
    "ORCH_EXEC_PROFILE_STRICT",
  ]);

  let ws: RunWorkspace | null = null;

  const envOverrides: Record<string, string | undefined> = {};
  if (config.strict) {
    envOverrides.ORCH_EXEC_PROFILE_STRICT = "1";
  }
  if (!process.env.ORCH_CODEX_APPROVAL) {
    envOverrides.ORCH_CODEX_APPROVAL = "never";
  }
  if (config.confirmCost) {
    if (!process.env.OPENCODE_CONFIG_CONTENT) {
      envOverrides.OPENCODE_CONFIG_CONTENT = JSON.stringify({
        enabled_providers: ["cerebras"],
        model: "cerebras/gpt-oss-120b",
        autoupdate: false,
      });
    }
    if (!process.env.OPENCODE_DISABLE_AUTOUPDATE) {
      envOverrides.OPENCODE_DISABLE_AUTOUPDATE = "1";
    }

    const codex = process.env.CODEX_API_KEY?.trim();
    const openai = process.env.OPENAI_API_KEY?.trim();
    if (!codex && openai) {
      envOverrides.CODEX_API_KEY = openai;
    }
  }
  const envRestore = applyEnvOverrides(envOverrides);

  const steps: StepSpec[] = [
    {
      id: "preflight_docker",
      label: "Docker preflight",
      timeoutMs: timeouts.dockerMs,
      run: async () => {
        await checkDockerAvailable(timeouts.dockerMs);
      },
    },
    {
      id: "preflight_env",
      label: "Environment preflight",
      timeoutMs: 10_000,
      run: async () => {
        if (!config.authz) {
          throw new Error("missing_authz: pass --authz or use wrapper script");
        }
        if (config.confirmCost) {
          if (!process.env.CEREBRAS_API_KEY?.trim()) {
            throw new Error("missing_env:CEREBRAS_API_KEY");
          }
          if (
            !(
              process.env.CODEX_API_KEY?.trim() ||
              process.env.OPENAI_API_KEY?.trim()
            )
          ) {
            throw new Error("missing_env:CODEX_API_KEY_or_OPENAI_API_KEY");
          }
        }
      },
    },
    {
      id: "ensure_image",
      label: "Ensure AgentFS image",
      timeoutMs: 60 * 60_000,
      skip: () => (config.skipBuild ? "skip_build" : undefined),
      run: async (ctx) => {
        await ensureAgentfsImage({
          authz: config.authz ?? "",
          image,
          timeoutSec: 60 * 60,
          onLog: (t) => ctx.log("stdout", t),
        });
      },
    },
    {
      id: "workspace",
      label: "AgentFS workspace",
      timeoutMs: timeouts.dockerMs,
      skip: () =>
        config.confirmCost || config.preflightOnly
          ? undefined
          : "skipped_without_confirm_cost",
      run: async (ctx) => {
        ws = await createWorkspace({
          authz: config.authz ?? "",
          image,
          retain: config.retain,
          runId,
          cwd: process.cwd(),
        });
        ctx.log("stdout", `container=${ws.containerName}\n`);
      },
    },
  ];

  steps.push(
    ...buildSuiteSteps({
      config: { ...config, image },
      timeouts,
      getWs: () => ws,
    })
  );

  const status: ExecutorEvalsResult["status"] = config.preflightOnly
    ? "preflight_only"
    : config.confirmCost
      ? "completed"
      : "skipped_cost";

  let ok = false;
  let results: StepResult[] = [];
  try {
    ({ ok, results } = await runSteps({
      runId,
      config: safeConfig,
      steps,
      timeoutTotalMs: timeouts.totalMs,
      opts: { reporters },
      logRing,
    }));
  } finally {
    try {
      await stopAllServers("evals_done");
    } catch {
      // ignore
    }
    try {
      if (ws) {
        if (config.retain === "never") {
          await (ws as unknown as RunWorkspace).cleanup();
        } else if (config.retain === "on-fail") {
          if (ok) {
            await (ws as unknown as RunWorkspace).cleanup();
          }
        }
      }
    } catch {
      // ignore
    }
    envRestore();
  }

  const finalStatus = ok ? status : "failed";

  await writeArtifacts({
    artifactsDir,
    config: safeConfig,
    results,
    ok,
    logTail: logRing.lines(),
    env: envSnapshot,
  });

  return {
    runId,
    ok,
    status: finalStatus,
    artifactsDir,
    results,
  };
}
