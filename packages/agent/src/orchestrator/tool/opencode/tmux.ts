/**
 * Tmux integration for OpenCode executor.
 *
 * Wraps opencode spawning with tmux session management when
 * OH_MY_OPENCODE_SLIM_ENABLED is set.
 */

import type { FileSink } from "bun";

import { logger } from "@alfred/logger";
import {
  capturePane,
  isOhMyOpencodeSlimEnabled,
  isTmuxAvailable,
  listSessions,
  spawnInTmux,
  stopTmuxSession,
  type TmuxSpawnOptions,
} from "@alfred/oh-my-opencode-slim";
import { spawn } from "bun";

import type { OpenCodeToolInput } from "./definition.js";

/** Result of spawning opencode (either direct or via tmux) */
export interface SpawnResult {
  /** The process or tmux session handle */
  handle: ProcessHandle;
  /** Whether tmux was used */
  useTmux: boolean;
  /** Session/pane info if using tmux */
  tmuxInfo?: {
    sessionName: string;
    paneId: string;
  };
}

/** Handle to a spawned process (direct or tmux) */
export interface ProcessHandle {
  /** Kill the process/session */
  kill: () => Promise<void>;
  /** Get stdout stream (if direct spawn) */
  stdout?: ReadableStream<Uint8Array>;
  /** Get stdin stream (if direct spawn) */
  stdin?: FileSink | number;
  /** Get stderr stream (if direct spawn) */
  stderr?: ReadableStream<Uint8Array>;
  /** Wait for process exit */
  exited: Promise<number>;
  /** Capture output from tmux pane (if tmux) */
  captureOutput?: (lines?: number) => Promise<string>;
}

/** Check if tmux integration should be used */
export async function shouldUseTmux(): Promise<boolean> {
  if (!isOhMyOpencodeSlimEnabled()) {
    return false;
  }
  return isTmuxAvailable();
}

/** Build spawn options from tool input */
function buildTmuxSpawnOptions(
  input: OpenCodeToolInput,
  runId: string
): TmuxSpawnOptions {
  const port = process.env.OPENCODE_PORT
    ? Number.parseInt(process.env.OPENCODE_PORT, 10)
    : 4096;

  return {
    runId,
    cmd: input.cmd ?? process.env.OPENCODE_ACP_CMD ?? "opencode",
    args: input.args,
    containerName: input.containerName,
    cwd: input.containerCw ?? input.cw,
    env: buildEnvMap(input),
    mode: input.transport === "http" ? "http" : "acp",
    port,
  };
}

/** Build environment map from input */
function buildEnvMap(input: OpenCodeToolInput): Record<string, string> {
  const env: Record<string, string> = {};

  // Allowlisted environment variables
  const allowlist = [
    "CEREBRAS_API_KEY",
    "OPENCODE_API_KEY",
    "OPENCODE_CONFIG_CONTENT",
    "OPENCODE_DISABLE_AUTOUPDATE",
  ];

  for (const key of allowlist) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      env[key] = value;
    }
  }

  // Add user-specified env vars
  if (input.env) {
    Object.assign(env, input.env);
  }

  return env;
}

/** Spawn opencode directly (legacy behavior) */
async function spawnDirect(
  argv: string[],
  cwd: string | undefined
): Promise<ProcessHandle> {
  const proc = spawn(argv, {
    cwd,
    env: process.env,
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

  return {
    exited: proc.exited,
    kill: async () => {
      try {
        proc.kill();
      } catch {
        // ignore
      }
    },
    stderr: proc.stderr ?? undefined,
    stdin: proc.stdin ?? undefined,
    stdout: proc.stdout ?? undefined,
  };
}

/** Spawn opencode via tmux */
async function spawnViaTmux(
  input: OpenCodeToolInput,
  runId: string
): Promise<SpawnResult> {
  const options = buildTmuxSpawnOptions(input, runId);
  const result = await spawnInTmux(options);

  logger.debug("opencode_tmux_spawned", {
    runId,
    sessionName: result.sessionName,
    paneId: result.paneId,
  });

  return {
    handle: {
      captureOutput: (lines?: number) => capturePane(result.paneId, { lines }),
      exited: new Promise(() => {}), // Tmux sessions don't exit in the same way
      kill: async () => {
        await stopTmuxSession(runId);
      },
    },
    tmuxInfo: {
      paneId: result.paneId,
      sessionName: result.sessionName,
    },
    useTmux: true,
  };
}

/** Build the argv for spawning opencode */
export function buildOpencodeArgv(input: OpenCodeToolInput): string[] {
  const cmd = input.cmd ?? process.env.OPENCODE_ACP_CMD ?? "opencode";
  const args = input.args ?? [];

  if (input.containerName) {
    const envKeys = [
      "CEREBRAS_API_KEY",
      "OPENCODE_API_KEY",
      "OPENCODE_CONFIG_CONTENT",
      "OPENCODE_DISABLE_AUTOUPDATE",
    ].filter((key) => {
      const value = process.env[key];
      return typeof value === "string" && value.trim().length > 0;
    });

    const port = process.env.OPENCODE_PORT
      ? Number.parseInt(process.env.OPENCODE_PORT, 10)
      : 4096;

    if (input.transport === "http") {
      return [
        "docker",
        "exec",
        "-i",
        "-w",
        input.containerCw ?? "/workspace",
        ...envKeys.flatMap((k) => ["-e", k]),
        input.containerName,
        cmd,
        "serve",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ];
    }

    return [
      "docker",
      "exec",
      "-i",
      "-w",
      input.containerCw ?? "/workspace",
      ...envKeys.flatMap((k) => ["-e", k]),
      input.containerName,
      cmd,
      ...args,
    ];
  }

  return [cmd, ...args];
}

/** Spawn opencode with optional tmux integration */
export async function spawnOpencode(
  input: OpenCodeToolInput,
  options: { runId: string; cwd?: string }
): Promise<SpawnResult> {
  const useTmux = await shouldUseTmux();

  if (useTmux) {
    try {
      return await spawnViaTmux(input, options.runId);
    } catch (error) {
      logger.warn("opencode_tmux_spawn_failed", {
        error: error instanceof Error ? error.message : String(error),
        runId: options.runId,
      });
      // Fall back to direct spawn
    }
  }

  // Direct spawn (legacy behavior)
  const argv = buildOpencodeArgv(input);
  const handle = await spawnDirect(argv, options.cwd);

  return {
    handle,
    useTmux: false,
  };
}

/** List active opencode tmux sessions */
export async function listOpencodeSessions(): Promise<
  {
    name: string;
    runId: string;
    createdAt: number;
    attached: boolean;
  }[]
> {
  if (!isOhMyOpencodeSlimEnabled()) {
    return [];
  }

  const sessions = await listSessions();
  return sessions.map(
    (s: {
      attached: boolean;
      createdAt: number;
      name: string;
      runId: string;
    }) => ({
      attached: s.attached,
      createdAt: s.createdAt,
      name: s.name,
      runId: s.runId,
    })
  );
}

/** Stop an opencode session (tmux or tracked direct) */
export async function stopOpencodeSession(runId: string): Promise<boolean> {
  if (!isOhMyOpencodeSlimEnabled()) {
    return false;
  }

  return stopTmuxSession(runId);
}
