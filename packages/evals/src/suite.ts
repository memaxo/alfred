import type { RunWorkspace } from "./driver/workspace.js";
import type { StepSpec } from "./runner.js";
import type { ExecutorEvalsConfig, ExecutorEvalsTimeouts } from "./types.js";

import { runCodexOnce } from "./driver/codex.js";
import { findPidInContainer, killPidInContainer } from "./driver/docker.js";
import { runOpenCodeOnce } from "./driver/opencode.js";

function assertExactReply(
  label: string,
  expected: string,
  actual: string
): void {
  const got = actual.trim();
  if (got === expected) {
    return;
  }
  const err = new Error(
    `executor_evals_mismatch: ${label} expected=${expected} got=${got.slice(0, 200)}`
  );
  (err as Error & { details?: Record<string, unknown> }).details = {
    expected,
    actual: got,
  };
  throw err;
}

function wsOrThrow(ws: RunWorkspace | null): RunWorkspace {
  if (!ws) {
    throw new Error("missing_workspace");
  }
  return ws;
}

export function buildSuiteSteps(args: {
  config: ExecutorEvalsConfig;
  timeouts: ExecutorEvalsTimeouts;
  getWs: () => RunWorkspace | null;
}): StepSpec[] {
  const cfg = args.config;
  const shouldRunProviders = Boolean(cfg.confirmCost && !cfg.preflightOnly);
  const runCodex = !cfg.skip?.codex && shouldRunProviders;
  const runOpenCode = !cfg.skip?.opencode && shouldRunProviders;
  const runCrash = !cfg.skip?.crashRecovery && shouldRunProviders;

  const steps: StepSpec[] = [];

  const skipProvider = shouldRunProviders
    ? undefined
    : "skipped_without_confirm_cost";

  if (cfg.profiles === "server" || cfg.profiles === "both") {
    steps.push({
      id: "codex_server_1",
      label: "Codex (server profile, turn 1)",
      timeoutMs: args.timeouts.codexMs,
      skip: () => (runCodex ? undefined : (skipProvider ?? "skipped")),
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const out = await runCodexOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          agentfsDbPath: ws.agentfsDbPath,
          execProfile: "server",
          prompt: "Reply with exactly: codex_ok_1",
          onNotice: (m) => ctx.log("stdout", `[codex] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("codex_ok_1", "codex_ok_1", out);
      },
    });

    steps.push({
      id: "codex_server_2",
      label: "Codex (server profile, turn 2)",
      timeoutMs: args.timeouts.codexMs,
      skip: () => (runCodex ? undefined : (skipProvider ?? "skipped")),
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const out = await runCodexOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          agentfsDbPath: ws.agentfsDbPath,
          execProfile: "server",
          prompt: "Reply with exactly: codex_ok_2",
          onNotice: (m) => ctx.log("stdout", `[codex] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("codex_ok_2", "codex_ok_2", out);
      },
    });
  }

  if (cfg.profiles === "default" || cfg.profiles === "both") {
    steps.push({
      id: "codex_default",
      label: "Codex (default profile)",
      timeoutMs: args.timeouts.codexMs,
      skip: () => (runCodex ? undefined : (skipProvider ?? "skipped")),
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const out = await runCodexOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          agentfsDbPath: ws.agentfsDbPath,
          execProfile: "default",
          prompt: "Reply with exactly: codex_default_ok",
          onNotice: (m) => ctx.log("stdout", `[codex] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("codex_default", "codex_default_ok", out);
      },
    });
  }

  if (cfg.profiles === "server" || cfg.profiles === "both") {
    steps.push({
      id: "opencode_server_1",
      label: `OpenCode (${cfg.transport}, server profile, turn 1)`,
      timeoutMs: args.timeouts.opencodeMs,
      skip: () => (runOpenCode ? undefined : (skipProvider ?? "skipped")),
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const out = await runOpenCodeOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          execProfile: "server",
          transport: cfg.transport,
          model: "cerebras/gpt-oss-120b",
          prompt: "Reply with exactly: opencode_ok_1",
          timeoutSec: Math.ceil(args.timeouts.opencodeMs / 1000),
          onNotice: (m) => ctx.log("stdout", `[opencode] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("opencode_ok_1", "opencode_ok_1", out);
      },
    });

    steps.push({
      id: "opencode_server_2",
      label: `OpenCode (${cfg.transport}, server profile, turn 2)`,
      timeoutMs: args.timeouts.opencodeMs,
      skip: () => (runOpenCode ? undefined : (skipProvider ?? "skipped")),
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const out = await runOpenCodeOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          execProfile: "server",
          transport: cfg.transport,
          model: "cerebras/gpt-oss-120b",
          prompt: "Reply with exactly: opencode_ok_2",
          timeoutSec: Math.ceil(args.timeouts.opencodeMs / 1000),
          onNotice: (m) => ctx.log("stdout", `[opencode] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("opencode_ok_2", "opencode_ok_2", out);
      },
    });
  }

  if (cfg.profiles === "default" || cfg.profiles === "both") {
    steps.push({
      id: "opencode_default",
      label: `OpenCode (${cfg.transport}, default profile)`,
      timeoutMs: args.timeouts.opencodeMs,
      skip: () => (runOpenCode ? undefined : (skipProvider ?? "skipped")),
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const out = await runOpenCodeOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          execProfile: "default",
          transport: cfg.transport,
          model: "cerebras/gpt-oss-120b",
          prompt: "Reply with exactly: opencode_default_ok",
          timeoutSec: Math.ceil(args.timeouts.opencodeMs / 1000),
          onNotice: (m) => ctx.log("stdout", `[opencode] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("opencode_default", "opencode_default_ok", out);
      },
    });
  }

  if (cfg.profiles === "server" || cfg.profiles === "both") {
    steps.push({
      id: "crash_codex",
      label: "Crash recovery (Codex server)",
      timeoutMs: args.timeouts.codexMs,
      skip: () => (runCrash && runCodex ? undefined : "skipped"),
      fatal: false,
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const pid = await findPidInContainer({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          pattern: "codex.*app-server",
        });
        if (!pid) {
          ctx.log("stdout", "[codex] crash recovery skipped: pid_not_found\n");
          return;
        }
        await killPidInContainer({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          pid,
        });

        const out = await runCodexOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          agentfsDbPath: ws.agentfsDbPath,
          execProfile: "server",
          prompt: "Reply with exactly: codex_recovered_ok",
          onNotice: (m) => ctx.log("stdout", `[codex] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });

        assertExactReply("codex_recovered", "codex_recovered_ok", out);
      },
    });

    steps.push({
      id: "crash_opencode",
      label: `Crash recovery (OpenCode ${cfg.transport} server)`,
      timeoutMs: args.timeouts.opencodeMs,
      skip: () => (runCrash && runOpenCode ? undefined : "skipped"),
      fatal: false,
      run: async (ctx) => {
        const ws = wsOrThrow(args.getWs());
        const pattern =
          cfg.transport === "http" ? "opencode.*serve" : "opencode.*acp";
        const pid = await findPidInContainer({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          pattern,
        });
        if (!pid) {
          ctx.log(
            "stdout",
            "[opencode] crash recovery skipped: pid_not_found\n"
          );
          return;
        }
        await killPidInContainer({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          pid,
        });

        const out = await runOpenCodeOnce({
          authz: cfg.authz ?? "",
          containerName: ws.containerName,
          containerCw: ws.containerCw,
          execProfile: "server",
          transport: cfg.transport,
          model: "cerebras/gpt-oss-120b",
          prompt: "Reply with exactly: opencode_recovered_ok",
          timeoutSec: Math.ceil(args.timeouts.opencodeMs / 1000),
          onNotice: (m) => ctx.log("stdout", `[opencode] notice=${m}\n`),
          onStderr: (t) => ctx.log("stderr", t),
        });
        assertExactReply("opencode_recovered", "opencode_recovered_ok", out);
      },
    });
  }

  return steps;
}
