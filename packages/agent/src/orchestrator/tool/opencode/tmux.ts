/**
 * Tmux integration for OpenCode executor.
 *
 * Wraps opencode spawning with tmux session management when
 * OH_MY_OPENCODE_SLIM_ENABLED is set.
 */

import { logger } from "@alfred/logger";
import { spawn, type FileSink } from "bun";

import type { OpenCodeToolInput } from "./definition.js";

interface TmuxSpawnOptions {
  runId: string;
  cmd: string;
  args?: string[];
  containerName?: string;
  cwd?: string;
  env: Record<string, string>;
  mode: "acp" | "http";
  port: number;
}

interface TmuxSession {
  attached: boolean;
  createdAt: number;
  name: string;
  runId: string;
}

interface TmuxModule {
  capturePane: (paneId: string, opts?: { lines?: number }) => Promise<string>;
  isOhMyOpencodeSlimEnabled: () => boolean;
  isTmuxAvailable: () => Promise<boolean>;
  listSessions: () => Promise<TmuxSession[]>;
  spawnInTmux: (
    options: TmuxSpawnOptions
  ) => Promise<{ paneId: string; sessionName: string }>;
  stopTmuxSession: (runId: string) => Promise<boolean>;
}

let tmuxModulePromise: Promise<TmuxModule | null> | null = null;
const neverExit = (async (): Promise<number> => {
  await Promise.race([]);
  return 0;
})();

function loadTmuxModule(): Promise<TmuxModule | null> {
  if (!tmuxModulePromise) {
    tmuxModulePromise = (async () => {
      try {
        return (await import("@alfred/oh-my-opencode-slim")) as TmuxModule;
      } catch (error) {
        logger.warn("opencode_tmux_module_missing", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    })();
  }
  return tmuxModulePromise;
}

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
  const tmux = await loadTmuxModule();
  if (!tmux) {
    return false;
  }
  if (!tmux.isOhMyOpencodeSlimEnabled()) {
    return false;
  }
  return tmux.isTmuxAvailable();
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
function spawnDirect(argv: string[], cwd: string | undefined): ProcessHandle {
  const proc = spawn(argv, {
    cwd,
    env: process.env,
    stderr: "pipe",
    stdin: "pipe",
    stdout: "pipe",
  });

  return {
    exited: proc.exited,
    kill: () => {
      try {
        proc.kill();
      } catch {
        // ignore
      }
      return Promise.resolve();
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
  const tmux = await loadTmuxModule();
  if (!tmux) {
    throw new Error("opencode_tmux_missing");
  }
  const options = buildTmuxSpawnOptions(input, runId);
  const result = await tmux.spawnInTmux(options);

  logger.debug("opencode_tmux_spawned", {
    runId,
    sessionName: result.sessionName,
    paneId: result.paneId,
  });

  return {
    handle: {
      captureOutput: (lines?: number) =>
        tmux.capturePane(result.paneId, { lines }),
      // Tmux sessions don't exit in the same way.
      exited: neverExit,
      kill: async () => {
        await tmux.stopTmuxSession(runId);
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
  const handle = spawnDirect(argv, options.cwd);

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
  const tmux = await loadTmuxModule();
  if (!tmux || !tmux.isOhMyOpencodeSlimEnabled()) {
    return [];
  }

  const sessions = await tmux.listSessions();
  return sessions.map((s) => ({
    attached: s.attached,
    createdAt: s.createdAt,
    name: s.name,
    runId: s.runId,
  }));
}

/** Stop an opencode session (tmux or tracked direct) */
export async function stopOpencodeSession(runId: string): Promise<boolean> {
  const tmux = await loadTmuxModule();
  if (!tmux || !tmux.isOhMyOpencodeSlimEnabled()) {
    return false;
  }

  return tmux.stopTmuxSession(runId);
}
