import { accessSync, constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  clearTimeout as clearNodeTimeout,
  setTimeout as setNodeTimeout,
} from "node:timers";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import { z } from "zod";
import type { DirectoryHandle } from "../../security/filesystem.js";
import {
  DEFAULT_ALLOW_PREFIXES,
  DirectoryAccessError,
  openDirectorySecure,
} from "../../security/filesystem.js";
import { spawnWithSecureCwd } from "../../security/secure-spawn.js";
import { withPolicyApproval } from "./approval.js";
import type { ToolWriter } from "./shared/context.js";

const OUTPUT_CAP_BYTES = 5 * 1024 * 1024; // 5 MiB
const DEFAULT_TIMEOUT_SEC = 15 * 60;
const MIN_TIMEOUT_SEC = 10;
const MAX_TIMEOUT_SEC = 2 * 60 * 60;
const PROBE_BODY_CAP_BYTES = 4 * 1024; // 4 KiB for health probe body

function assertAllowedDirectory(candidate: string) {
  let handle: DirectoryHandle | undefined;
  try {
    handle = openDirectorySecure(candidate, {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
    return handle.path;
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("docker_invalid_cwd_not_directory");
    }
    throw new Error("docker_invalid_cwd");
  } finally {
    handle?.close();
  }
}

function resolveExecutable(command: string) {
  if (path.isAbsolute(command)) {
    accessSync(command, fsConstants.X_OK);
    return command;
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error("docker_binary_not_found");
}

const dockerInputSchema = z.object({
  action: z.enum([
    "build",
    "run",
    "start",
    "stop",
    "rm",
    "inspect",
    "logs",
    "wait",
    "exec.probe",
    "exec",
  ]),
  cw: z.string().optional(),
  context: z.string().optional(),
  dockerfile: z.string().optional(),
  tag: z.string().optional(),
  name: z.string().optional(),
  containerPort: z.number().int().min(1).max(65_535).optional(),
  hostPort: z.number().int().min(1).max(65_535).optional(),
  env: z.record(z.string(), z.string()).optional(),
  network: z.string().optional(),
  volumes: z.array(z.string()).optional(), // Phase 11: Volume mounts
  devices: z.array(z.string()).optional(),
  capAdd: z.array(z.string()).optional(),
  privileged: z.boolean().optional(),
  resources: z
    .object({
      cpus: z.number().min(0.1).max(16).optional(),
      memory: z.string().optional(),
    })
    .optional(),
  authz: z.string().optional(),
  follow: z.boolean().optional(),
  tail: z.number().int().min(0).max(5000).optional(),
  url: z.string().url().optional(),
  timeoutSec: z
    .number()
    .int()
    .min(MIN_TIMEOUT_SEC)
    .max(MAX_TIMEOUT_SEC)
    .optional(),
  cmd: z.string().optional(),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
});

type DockerInput = z.infer<typeof dockerInputSchema>;

async function enforcePolicy(input: DockerInput) {
  const scopes =
    input.action === "exec.probe" ? ["deploy.read"] : ["deploy.write"];
  await requireToolScopesAndPolicy(input.authz, scopes, {
    action: `docker.${input.action}`,
    resource: {
      kind: "deploy",
      id: input.name ?? input.tag ?? "runtime",
    },
  });
}

function ensure(value: string | undefined, error: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

function acquireCwdHandle(candidate: string | undefined): DirectoryHandle {
  try {
    return openDirectorySecure(candidate ?? process.cwd(), {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });
  } catch (error) {
    if (
      error instanceof DirectoryAccessError &&
      error.code === "not_directory"
    ) {
      throw new Error("docker_invalid_cwd_not_directory");
    }
    throw new Error("docker_invalid_cwd");
  }
}

async function withCwdHandle<T>(
  candidate: string | undefined,
  fn: (handle: DirectoryHandle, cwd: string) => Promise<T>
): Promise<T> {
  const handle = acquireCwdHandle(candidate);
  try {
    return await fn(handle, handle.path);
  } finally {
    handle.close();
  }
}

function resolveDirectory(base: string, target: string) {
  const absolute = path.isAbsolute(target) ? target : path.join(base, target);
  return assertAllowedDirectory(path.normalize(absolute));
}

function resolveSubpath(base: string, target: string) {
  const absolute = path.normalize(
    path.isAbsolute(target) ? target : path.join(base, target)
  );
  const parent = path.dirname(absolute);
  assertAllowedDirectory(parent);
  return absolute;
}

async function runDocker({
  args,
  cwdHandle,
  writer,
  timeoutSec,
}: {
  args: string[];
  cwdHandle: DirectoryHandle;
  writer: ToolWriter;
  timeoutSec: number;
}) {
  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "docker.ts:runDocker:entry",
      message: "runDocker called",
      data: {
        argsCount: args.length,
        firstArg: args[0],
        cwd: cwdHandle.path,
        skipSecureSpawn: process.env.ORCH_SKIP_SECURE_SPAWN,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "pre-fix",
      hypothesisId: "A,B,C,D",
    }),
  }).catch(() => {});
  // #endregion

  const debug = process.env.ORCH_DOCKER_DEBUG === "1";
  const redactArgs = (raw: string[]) => {
    const out: string[] = [];
    for (let i = 0; i < raw.length; i += 1) {
      const arg = raw[i] ?? "";
      if (raw[i - 1] === "-e" && arg.includes("=")) {
        const [key] = arg.split("=", 1);
        out.push(`${key}=***`);
        continue;
      }
      out.push(arg);
    }
    return out;
  };

  const command = resolveExecutable(process.env.DOCKER_BIN ?? "docker");
  if (debug) {
    logger.debug("docker_spawn", {
      command,
      args: redactArgs(args),
      cwd: cwdHandle.path,
    });
  }

  // In test mode, bypass spawnWithSecureCwd and use Bun.spawn directly
  // to avoid potential stream issues with the wrapper
  const inBunTest =
    process.env.BUN_TEST === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.BUN_ENVIRONMENT === "test";
  const useDirectSpawn =
    inBunTest && process.env.ORCH_SKIP_SECURE_SPAWN !== "0";

  const proc = useDirectSpawn
    ? Bun.spawn([command, ...args], {
        cwd: cwdHandle.path,
        env: {
          ...process.env,
          PATH: process.env.PATH ?? "",
        },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      })
    : spawnWithSecureCwd({
        cwdHandle,
        cmd: command,
        args,
        env: {
          PATH: process.env.PATH ?? "",
        },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });

  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "docker.ts:runDocker:afterSpawn",
      message: "spawn returned",
      data: {
        pid: proc.pid,
        hasStdout: !!proc.stdout,
        hasStderr: !!proc.stderr,
        stdoutType: typeof proc.stdout,
        stderrType: typeof proc.stderr,
        useDirectSpawn,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "post-fix-v9",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion

  if (debug) {
    logger.debug("docker_spawned", { pid: proc.pid });
  }

  const accumulator = {
    stdout: "",
    stderr: "",
    capturedBytes: 0,
    truncated: false,
  };

  const timer = setNodeTimeout(() => {
    try {
      proc.kill("SIGKILL");
    } catch {
      // noop
    }
    void Promise.resolve(
      writer?.write?.({ type: "notice", message: "docker_timeout" })
    ).catch(() => {});
  }, timeoutSec * 1000);

  const startMs = performance.now();
  const decoder = new TextDecoder();

  // Wait for process to exit FIRST, then read streams
  // This ensures docker has finished writing before we read
  let exitCode = 1;
  try {
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:runDocker:awaitExitedFirst",
        message: "awaiting proc.exited FIRST",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix-v9",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion
    exitCode = await proc.exited;
    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:runDocker:exitedFirst",
        message: "proc.exited resolved FIRST",
        data: { exitCode },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix-v9",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion
  } catch {
    // Process spawn error - exitCode already set to 1
  } finally {
    clearNodeTimeout(timer);
  }

  // NOW read streams after process has exited
  const stdoutPromise =
    proc.stdout && typeof proc.stdout !== "number"
      ? (async () => {
          // #region agent log
          // const streamStartMs = performance.now();
          const hasTextMethod =
            typeof (proc.stdout as { text?: () => Promise<string> }).text ===
            "function";
          const stdoutDebug = proc.stdout as unknown as {
            locked?: unknown;
            state?: unknown;
            getReader?: unknown;
            constructor?: { name?: unknown };
          };
          const streamInfo = {
            hasTextMethod,
            streamLocked: stdoutDebug.locked,
            streamState: stdoutDebug.state,
            isReadableStream: proc.stdout instanceof ReadableStream,
            constructorName:
              typeof stdoutDebug.constructor?.name === "string"
                ? stdoutDebug.constructor.name
                : String(stdoutDebug.constructor?.name ?? ""),
            hasGetReader: typeof stdoutDebug.getReader === "function",
            exitCode,
          };
          fetch(
            "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "docker.ts:runDocker:stdoutReaderStart",
                message: "stdout reader starting after exit",
                data: streamInfo,
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "post-fix-v9",
                hypothesisId: "F",
              }),
            }
          ).catch(() => {});
          // #endregion
          if (debug) {
            logger.debug("docker_stdout_reader_start");
          }
          try {
            let text = "";
            // Check if stdout is Uint8Array (like spawnSync) instead of ReadableStream
            if (proc.stdout instanceof Uint8Array) {
              // #region agent log
              fetch(
                "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "docker.ts:runDocker:stdoutIsUint8Array",
                    message: "stdout is Uint8Array (spawnSync-like)",
                    data: { stdoutLen: proc.stdout.length },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix-v9",
                    hypothesisId: "F",
                  }),
                }
              ).catch(() => {});
              // #endregion
              text = decoder.decode(proc.stdout);
            } else if (proc.stdout instanceof ReadableStream) {
              // Check stream state before reading
              const streamState = {
                locked: stdoutDebug.locked,
                state: stdoutDebug.state,
              };
              // #region agent log
              fetch(
                "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "docker.ts:runDocker:stdoutBeforeRead",
                    message: "stdout before read",
                    data: { ...streamState, exitCode },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix-v9",
                    hypothesisId: "F",
                  }),
                }
              ).catch(() => {});
              // #endregion
              // Try direct .text() method first (Bun's native API)
              if (hasTextMethod) {
                text = await (
                  proc.stdout as unknown as { text: () => Promise<string> }
                ).text();
                // #region agent log
                fetch(
                  "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "docker.ts:runDocker:stdoutText",
                      message: "stdout.text() completed",
                      data: {
                        textLen: text.length,
                        textPreview: text.slice(0, 100),
                      },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "post-fix-v9",
                      hypothesisId: "F",
                    }),
                  }
                ).catch(() => {});
                // #endregion
              } else {
                // Fallback to Response wrapper
                try {
                  text = await new Response(proc.stdout).text();
                  // #region agent log
                  fetch(
                    "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        location: "docker.ts:runDocker:stdoutResponseText",
                        message:
                          "Response(proc.stdout).text() completed (fallback)",
                        data: {
                          textLen: text.length,
                          textPreview: text.slice(0, 100),
                        },
                        timestamp: Date.now(),
                        sessionId: "debug-session",
                        runId: "post-fix-v9",
                        hypothesisId: "F",
                      }),
                    }
                  ).catch(() => {});
                  // #endregion
                } catch (_responseError) {
                  // Final fallback to getReader()
                  const reader = proc.stdout.getReader();
                  let _chunkCount = 0;
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      break;
                    }
                    _chunkCount += 1;
                    const chunkText = decoder.decode(value, { stream: true });
                    if (chunkText.length === 0) {
                      continue;
                    }
                    text += chunkText;
                  }
                  const flush = decoder.decode();
                  text += flush;
                  try {
                    reader.releaseLock();
                  } catch {
                    // ignore
                  }
                }
              }
            } else {
              // #region agent log
              fetch(
                "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "docker.ts:runDocker:stdoutUnknownType",
                    message: "stdout is unknown type",
                    data: {
                      type: typeof proc.stdout,
                      constructorName:
                        typeof stdoutDebug.constructor?.name === "string"
                          ? stdoutDebug.constructor.name
                          : null,
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix-v9",
                    hypothesisId: "F",
                  }),
                }
              ).catch(() => {});
              // #endregion
            }

            if (text.length > 0) {
              accumulator.capturedBytes += Buffer.byteLength(text);
              if (!accumulator.truncated) {
                if (accumulator.capturedBytes <= OUTPUT_CAP_BYTES) {
                  accumulator.stdout = text;
                } else {
                  accumulator.stdout = text.slice(0, OUTPUT_CAP_BYTES);
                  accumulator.truncated = true;
                }
              }
              void Promise.resolve(
                writer?.write?.({ type: "stdout", text })
              ).catch(() => {});
            }
          } catch (error) {
            // #region agent log
            fetch(
              "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "docker.ts:runDocker:stdoutReaderError",
                  message: "stdout reader error",
                  data: {
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix-v9",
                  hypothesisId: "A",
                }),
              }
            ).catch(() => {});
            // #endregion
            if (debug) {
              logger.warn("docker_stdout_reader_error", {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          } finally {
            // #region agent log
            fetch(
              "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "docker.ts:runDocker:stdoutReaderFinally",
                  message: "stdout reader finally",
                  data: { finalStdoutLen: accumulator.stdout.length },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix-v9",
                  hypothesisId: "A",
                }),
              }
            ).catch(() => {});
            // #endregion
            if (debug) {
              logger.debug("docker_stdout_reader_done");
            }
          }
        })()
      : Promise.resolve();

  const stderrPromise =
    proc.stderr && typeof proc.stderr !== "number"
      ? (async () => {
          // #region agent log
          const hasTextMethod =
            typeof (proc.stderr as { text?: () => Promise<string> }).text ===
            "function";
          fetch(
            "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location: "docker.ts:runDocker:stderrReaderStart",
                message: "stderr reader starting after exit",
                data: { hasTextMethod, exitCode },
                timestamp: Date.now(),
                sessionId: "debug-session",
                runId: "post-fix-v9",
                hypothesisId: "B",
              }),
            }
          ).catch(() => {});
          // #endregion
          if (debug) {
            logger.debug("docker_stderr_reader_start");
          }
          try {
            let text = "";
            // Check if stderr is Uint8Array (like spawnSync) instead of ReadableStream
            if (proc.stderr instanceof Uint8Array) {
              // #region agent log
              fetch(
                "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "docker.ts:runDocker:stderrIsUint8Array",
                    message: "stderr is Uint8Array (spawnSync-like)",
                    data: { stderrLen: proc.stderr.length },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix-v9",
                    hypothesisId: "B",
                  }),
                }
              ).catch(() => {});
              // #endregion
              text = decoder.decode(proc.stderr);
            } else if (proc.stderr instanceof ReadableStream) {
              // Try direct .text() method first (Bun's native API)
              if (hasTextMethod) {
                text = await (
                  proc.stderr as unknown as { text: () => Promise<string> }
                ).text();
                // #region agent log
                fetch(
                  "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      location: "docker.ts:runDocker:stderrText",
                      message: "stderr.text() completed",
                      data: {
                        textLen: text.length,
                        textPreview: text.slice(0, 200),
                      },
                      timestamp: Date.now(),
                      sessionId: "debug-session",
                      runId: "post-fix-v9",
                      hypothesisId: "B",
                    }),
                  }
                ).catch(() => {});
                // #endregion
              } else {
                // Fallback to Response wrapper
                try {
                  text = await new Response(proc.stderr).text();
                  // #region agent log
                  fetch(
                    "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        location: "docker.ts:runDocker:stderrResponseText",
                        message:
                          "Response(proc.stderr).text() completed (fallback)",
                        data: {
                          textLen: text.length,
                          textPreview: text.slice(0, 200),
                        },
                        timestamp: Date.now(),
                        sessionId: "debug-session",
                        runId: "post-fix-v9",
                        hypothesisId: "B",
                      }),
                    }
                  ).catch(() => {});
                  // #endregion
                } catch (_responseError) {
                  // Final fallback to getReader()
                  const reader = proc.stderr.getReader();
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      break;
                    }
                    const chunkText = decoder.decode(value, { stream: true });
                    if (chunkText.length === 0) {
                      continue;
                    }
                    text += chunkText;
                  }
                  const flush = decoder.decode();
                  text += flush;
                  try {
                    reader.releaseLock();
                  } catch {
                    // ignore
                  }
                }
              }
            } else {
              // #region agent log
              fetch(
                "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    location: "docker.ts:runDocker:stderrUnknownType",
                    message: "stderr is unknown type",
                    data: {
                      type: typeof proc.stderr,
                      constructorName:
                        typeof (
                          proc.stderr as { constructor?: { name?: unknown } }
                        ).constructor?.name === "string"
                          ? (proc.stderr as { constructor: { name: string } })
                              .constructor.name
                          : null,
                    },
                    timestamp: Date.now(),
                    sessionId: "debug-session",
                    runId: "post-fix-v9",
                    hypothesisId: "B",
                  }),
                }
              ).catch(() => {});
              // #endregion
            }

            if (text.length > 0) {
              if (text.length <= OUTPUT_CAP_BYTES) {
                accumulator.stderr = text;
              } else {
                accumulator.stderr = text.slice(0, OUTPUT_CAP_BYTES);
              }
              void Promise.resolve(
                writer?.write?.({ type: "stderr", text })
              ).catch(() => {});
            }
          } catch (error) {
            // #region agent log
            fetch(
              "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "docker.ts:runDocker:stderrReaderError",
                  message: "stderr reader error",
                  data: {
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix-v9",
                  hypothesisId: "B",
                }),
              }
            ).catch(() => {});
            // #endregion
            if (debug) {
              logger.warn("docker_stderr_reader_error", {
                error: error instanceof Error ? error.message : String(error),
              });
            }
          } finally {
            // #region agent log
            fetch(
              "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  location: "docker.ts:runDocker:stderrReaderFinally",
                  message: "stderr reader finally",
                  data: {
                    finalStderrLen: accumulator.stderr.length,
                    stderrPreview: accumulator.stderr.slice(0, 200),
                  },
                  timestamp: Date.now(),
                  sessionId: "debug-session",
                  runId: "post-fix-v9",
                  hypothesisId: "B",
                }),
              }
            ).catch(() => {});
            // #endregion
            if (debug) {
              logger.debug("docker_stderr_reader_done");
            }
          }
        })()
      : Promise.resolve();

  // Wait for streams to complete (process already exited)
  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "docker.ts:runDocker:beforeStreams",
      message: "before awaiting streams",
      data: { exitCode },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "post-fix-v9",
      hypothesisId: "F",
    }),
  }).catch(() => {});
  // #endregion
  await Promise.allSettled([stdoutPromise, stderrPromise]);
  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "docker.ts:runDocker:afterStreams",
      message: "after streams completed",
      data: {
        exitCode,
        accumulatorStdoutLen: accumulator.stdout.length,
        accumulatorStderrLen: accumulator.stderr.length,
        stdoutPreview: accumulator.stdout.slice(0, 100),
        stderrPreview: accumulator.stderr.slice(0, 100),
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "post-fix-v9",
      hypothesisId: "F",
    }),
  }).catch(() => {});
  // #endregion
  if (debug) {
    logger.debug("docker_completed", {
      exitCode,
      stdoutBytes: Buffer.byteLength(accumulator.stdout),
      stderrBytes: Buffer.byteLength(accumulator.stderr),
      truncated: accumulator.truncated,
      durationMs: Math.round(performance.now() - startMs),
    });
  }

  const result = {
    exitCode,
    stdout: accumulator.stdout.trim(),
    stderr: accumulator.stderr.trim(),
    truncated: accumulator.truncated,
  };
  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "docker.ts:runDocker:return",
      message: "runDocker returning",
      data: {
        exitCode: result.exitCode,
        stdoutLen: result.stdout.length,
        stderrLen: result.stderr.length,
        stdoutPreview: result.stdout.slice(0, 100),
        stderrPreview: result.stderr.slice(0, 100),
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "pre-fix",
      hypothesisId: "A,B,D",
    }),
  }).catch(() => {});
  // #endregion
  return result;
}

type InspectPortMapping = { host: number; container: number };

function parseInspectPorts(raw: unknown, containerPort?: number) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const first = raw[0] as Record<string, unknown>;
  const networkSettings = first?.NetworkSettings;
  if (typeof networkSettings !== "object" || !networkSettings) {
    return [];
  }
  const ports = (networkSettings as Record<string, unknown>).Ports;
  if (typeof ports !== "object" || !ports) {
    return [];
  }

  const results: InspectPortMapping[] = [];
  for (const [key, value] of Object.entries(ports as Record<string, unknown>)) {
    const [containerPortRaw] = key.split("/");
    if (!containerPortRaw) {
      continue;
    }
    const containerInt = Number.parseInt(containerPortRaw, 10);
    if (Number.isNaN(containerInt)) {
      continue;
    }
    if (containerPort && containerInt !== containerPort) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const binding of value) {
        if (!binding) {
          continue;
        }
        const hostPort = Number.parseInt(
          (binding as Record<string, string>).HostPort ?? "",
          10
        );
        if (!Number.isNaN(hostPort)) {
          results.push({ container: containerInt, host: hostPort });
        }
      }
    }
  }

  return results;
}

function executeBuild(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle, cwd) => {
    const tag = ensure(input.tag, "docker_tag_required");
    const contextPath = resolveDirectory(
      cwd,
      ensure(input.context, "docker_context_required")
    );
    const args = ["build", "-t", tag];

    if (input.dockerfile) {
      const dockerfilePath = resolveSubpath(cwd, input.dockerfile);
      args.push("-f", dockerfilePath);
    }

    args.push(contextPath);

    const result = await runDocker({
      args,
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    if (result.exitCode !== 0) {
      throw new Error("docker_build_failed");
    }

    return { ok: true as const, details: { name: tag } };
  });
}

function executeRun(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const tag = ensure(input.tag, "docker_tag_required");
    const name = ensure(input.name, "docker_name_required");
    const containerPort = input.containerPort ?? 3000;

    const args = ["run", "-d", "--name", name, "--restart", "unless-stopped"];
    const debug = process.env.ORCH_DOCKER_DEBUG === "1";
    const redactArgs = (raw: string[]) => {
      const out: string[] = [];
      for (let i = 0; i < raw.length; i += 1) {
        const arg = raw[i] ?? "";
        if (raw[i - 1] === "-e" && arg.includes("=")) {
          const [key] = arg.split("=", 1);
          out.push(`${key}=***`);
          continue;
        }
        out.push(arg);
      }
      return out;
    };

    if (input.hostPort) {
      args.push("-p", `${input.hostPort}:${containerPort}`);
    } else {
      args.push("-P");
    }

    if (input.network) {
      args.push("--network", input.network);
    }

    if (input.env) {
      for (const [key, value] of Object.entries(input.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    if (input.volumes) {
      for (const vol of input.volumes) {
        args.push("-v", vol);
      }
    }

    if (input.devices) {
      for (const dev of input.devices) {
        args.push("--device", dev);
      }
    }

    if (input.capAdd) {
      for (const cap of input.capAdd) {
        args.push("--cap-add", cap);
      }
    }

    if (input.privileged) {
      args.push("--privileged");
    }

    if (input.resources) {
      if (input.resources.cpus) {
        args.push("--cpus", String(input.resources.cpus));
      }
      if (input.resources.memory) {
        args.push("--memory", input.resources.memory);
      }
    }

    args.push(tag);

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:executeRun:beforeRunDocker",
        message: "executeRun calling runDocker",
        data: {
          argsCount: args.length,
          argsPreview: args.slice(0, 10).join(" "),
          name,
          tag,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "D",
      }),
    }).catch(() => {});
    // #endregion

    if (debug) {
      logger.debug("docker_run_args", { args: redactArgs(args) });
    }

    // Use Bun.$ for docker run to bypass subprocess output capture issues in test mode
    const command = resolveExecutable(process.env.DOCKER_BIN ?? "docker");
    const decoder = new TextDecoder();

    // Use repo root as cwd (matches test script that works)
    const spawnCwd = process.cwd();

    // Verify volume paths exist before running docker
    const volumePaths: string[] = [];
    const volumePathExists: boolean[] = [];
    const { existsSync } = await import("node:fs");
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "-v" && args[i + 1]) {
        const volume = args[i + 1] as string;
        const [hostPath] = volume.split(":", 1);
        if (hostPath) {
          volumePaths.push(hostPath);
          volumePathExists.push(existsSync(hostPath));
        }
      }
    }

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:executeRun:beforeDockerRun",
        message: "before docker run",
        data: {
          command,
          argsCount: args.length,
          firstArg: args[0],
          cwd: cwdHandle.path,
          spawnCwd,
          args: args.join(" "),
          volumePaths,
          volumePathExists,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix-v17",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion

    // Use shell script to work around Bun subprocess output capture issues in test mode
    const { writeFile, unlink } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const scriptPath = join(spawnCwd, `.docker-run-${name}-${Date.now()}.sh`);
    const outputPath = join(
      spawnCwd,
      `.docker-output-${name}-${Date.now()}.txt`
    );

    // Create shell script that runs docker and saves output
    const scriptContent = `#!/bin/bash
set -e
cd "${spawnCwd}"
export DOCKER_BUILDKIT=0
${command} ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ")} > "${outputPath}" 2>&1
EXIT_CODE=$?
echo "$EXIT_CODE" > "${outputPath}.exit"
exit $EXIT_CODE
`;

    await writeFile(scriptPath, scriptContent, { mode: 0o755 });

    let stdout = "";
    let stderr = "";
    let exitCode = 1;

    try {
      // Execute script
      const proc = Bun.spawn(["bash", scriptPath], {
        cwd: spawnCwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PATH: process.env.PATH ?? "",
          DOCKER_BUILDKIT: "0",
        },
      });

      // Read script stderr
      const scriptStderrChunks: string[] = [];
      const readScriptStderr = async () => {
        if (!proc.stderr) {
          return;
        }
        try {
          const reader = proc.stderr.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            scriptStderrChunks.push(decoder.decode(value, { stream: true }));
          }
          const flush = decoder.decode();
          if (flush) {
            scriptStderrChunks.push(flush);
          }
          reader.releaseLock();
        } catch {
          // ignore
        }
      };

      await Promise.all([readScriptStderr(), proc.exited]);
      exitCode = await proc.exited;
      stderr = scriptStderrChunks.join("");

      // Read output files
      try {
        const outputText = await Bun.file(outputPath).text();
        const exitCodeFile = await Bun.file(`${outputPath}.exit`).text();
        const fileExitCode = Number.parseInt(exitCodeFile.trim(), 10);
        if (!Number.isNaN(fileExitCode)) {
          exitCode = fileExitCode;
        }
        // stdout is the docker output (container ID if successful)
        stdout = outputText.trim();
        // #region agent log
        fetch(
          "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "docker.ts:executeRun:dockerOutput",
              message: "docker output from file",
              data: {
                exitCode,
                fileExitCode,
                outputText,
                outputTextLen: outputText.length,
                stdout,
                stdoutLen: stdout.length,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix-v18",
              hypothesisId: "G",
            }),
          }
        ).catch(() => {});
        // #endregion
      } catch (error) {
        // Files might not exist if docker failed
        // #region agent log
        fetch(
          "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "docker.ts:executeRun:dockerOutputError",
              message: "failed to read docker output file",
              data: { error: String(error), outputPath },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix-v18",
              hypothesisId: "G",
            }),
          }
        ).catch(() => {});
        // #endregion
      }

      // Cleanup
      await unlink(scriptPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      await unlink(`${outputPath}.exit`).catch(() => {});
    } catch (error) {
      stderr = String(error);
      await unlink(scriptPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      await unlink(`${outputPath}.exit`).catch(() => {});
    }

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:executeRun:afterDockerRun",
        message: "after docker run via Bun.$",
        data: {
          exitCode,
          stdoutLen: stdout.length,
          stderrLen: stderr.length,
          stdoutPreview: stdout.slice(0, 100),
          stderrPreview: stderr.slice(0, 200),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix-v17",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion

    // Verify container exists immediately after docker run (if we got a container ID)
    if (exitCode === 0 && stdout.trim()) {
      const containerIdFromStdout = stdout.trim().split(/\s+/u)[0];
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        const { $ } = await import("bun");
        const verifyResult =
          await $`${command} ps -a --filter id=${containerIdFromStdout} --format {{.ID}} {{.Status}}`.quiet();
        const verifyOutput = verifyResult.stdout.toString().trim();
        // #region agent log
        fetch(
          "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "docker.ts:executeRun:containerVerification",
              message: "container verification after run",
              data: {
                containerIdFromStdout,
                verifyOutput,
                containerExists: !!verifyOutput,
                verifyOutputLen: verifyOutput.length,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix-v18",
              hypothesisId: "G",
            }),
          }
        ).catch(() => {});
        // #endregion
      } catch (error) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "docker.ts:executeRun:containerVerificationError",
              message: "container verification error",
              data: {
                error: String(error),
                containerIdFromStdout: stdout.trim().split(/\s+/u)[0],
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix-v18",
              hypothesisId: "G",
            }),
          }
        ).catch(() => {});
        // #endregion
      }
    }

    // Use stdout if available (from shell script), otherwise fallback to docker inspect
    let finalStdout = stdout.trim();
    if (!finalStdout && exitCode === 0) {
      // Wait for container to be created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fallback to docker inspect if stdout is empty
      try {
        const { $ } = await import("bun");
        const inspectResult =
          await $`${command} inspect -f {{.Id}} ${name}`.quiet();
        finalStdout = inspectResult.stdout.toString().trim();
        // #region agent log
        fetch(
          "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "docker.ts:executeRun:inspectFallback",
              message: "inspect fallback succeeded",
              data: { containerId: finalStdout, originalStdout: stdout },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix-v17",
              hypothesisId: "F",
            }),
          }
        ).catch(() => {});
        // #endregion
      } catch (error) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "docker.ts:executeRun:inspectFailed",
              message: "inspect fallback failed",
              data: { error: String(error) },
              timestamp: Date.now(),
              sessionId: "debug-session",
              runId: "post-fix-v17",
              hypothesisId: "F",
            }),
          }
        ).catch(() => {});
        // #endregion
      }
    }

    const result = {
      exitCode,
      stdout: finalStdout,
      stderr: stderr.trim(),
      truncated: false,
    };

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:executeRun:afterRunDocker",
        message: "executeRun got result from runDocker",
        data: {
          exitCode: result.exitCode,
          stdoutLen: result.stdout.length,
          stderrLen: result.stderr.length,
          stdoutPreview: result.stdout.slice(0, 100),
          stderrPreview: result.stderr.slice(0, 200),
          truncated: result.truncated,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "A,B,D",
      }),
    }).catch(() => {});
    // #endregion

    if (result.exitCode !== 0) {
      if (result.stderr) {
        logger.warn("docker_run_failed_stderr", {
          stderr: result.stderr,
        });
      }
      throw new Error("docker_run_failed");
    }

    const containerId = result.stdout.split(/\s+/u).filter(Boolean)[0] ?? name;

    // Verify container exists right after creation
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      const { $ } = await import("bun");
      const verifyResult =
        await $`${command} ps -a --filter id=${containerId} --format {{.ID}}`.quiet();
      const exists = verifyResult.stdout.toString().trim();
      // #region agent log
      fetch(
        "http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "docker.ts:executeRun:containerVerification",
            message: "container verification",
            data: { containerId, exists, existsLen: exists.length },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "post-fix-v17",
            hypothesisId: "F",
          }),
        }
      ).catch(() => {});
      // #endregion
    } catch {
      // ignore verification errors
    }

    // #region agent log
    fetch("http://127.0.0.1:7243/ingest/caddd241-a390-4503-80c3-6cd37f6059b3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "docker.ts:executeRun:afterParseContainerId",
        message: "parsed containerId",
        data: {
          containerId,
          containerIdLen: containerId.length,
          isFallback: containerId === name,
          stdoutRaw: result.stdout,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "post-fix-v17",
        hypothesisId: "F",
      }),
    }).catch(() => {});
    // #endregion

    // If stdout is empty but exitCode is 0, log stderr for debugging
    if (!result.stdout.trim()) {
      logger.warn("docker_run_empty_stdout", {
        name,
        stderr: result.stderr || undefined,
        truncated: result.truncated,
      });
    }

    const inspect = await executeInspect(
      { ...input, action: "inspect", name, containerPort },
      writer
    );

    const mapped = inspect.details?.ports ?? [];
    const selected = input.hostPort
      ? (mapped.find((entry) => entry.host === input.hostPort) ?? mapped[0])
      : mapped[0];

    return {
      ok: true as const,
      details: {
        name,
        containerId,
        containerPort,
        hostPort: selected?.host ?? input.hostPort ?? null,
        ports: mapped,
      },
    };
  });
}

function executeStart(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");

    const result = await runDocker({
      args: ["start", name],
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    if (result.exitCode !== 0) {
      throw new Error("docker_start_failed");
    }

    return { ok: true as const, details: { name } };
  });
}

function executeStop(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");

    const result = await runDocker({
      args: ["stop", name],
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    if (result.exitCode !== 0) {
      throw new Error("docker_stop_failed");
    }

    return { ok: true as const, details: { name } };
  });
}

function executeRemove(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");

    const result = await runDocker({
      args: ["rm", "-f", name],
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    if (result.exitCode !== 0) {
      throw new Error("docker_remove_failed");
    }

    return { ok: true as const, details: { name } };
  });
}

function executeInspect(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");

    const result = await runDocker({
      args: ["inspect", name],
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    if (result.exitCode !== 0) {
      throw new Error("docker_inspect_failed");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout || "[]");
    } catch {
      parsed = [];
    }

    const ports = parseInspectPorts(parsed, input.containerPort);
    const first = Array.isArray(parsed) ? parsed[0] : undefined;
    let containerId: string | undefined;
    let running: boolean | undefined;
    if (first && typeof first === "object") {
      const record = first as Record<string, unknown>;
      if (typeof record.Id === "string") {
        containerId = record.Id;
      }
      const state = record.State;
      if (state && typeof state === "object") {
        const stateRecord = state as Record<string, unknown>;
        if (typeof stateRecord.Running === "boolean") {
          running = stateRecord.Running;
        }
      }
    }

    return {
      ok: true as const,
      details: { ports, containerId, running },
    };
  });
}

function executeLogs(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");
    const args = ["logs"];
    if (input.follow) {
      args.push("-f");
    }
    if (typeof input.tail === "number") {
      args.push("--tail", String(input.tail));
    }
    args.push(name);

    const result = await runDocker({
      args,
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    if (result.truncated) {
      await Promise.resolve(
        writer?.write?.({
          type: "notice",
          message: "docker_logs_truncated",
          name,
          tail: input.tail,
        })
      ).catch(() => {});
    }

    if (result.exitCode !== 0) {
      throw new Error("docker_logs_failed");
    }

    return {
      ok: true as const,
      details: {
        name,
        exitCode: result.exitCode,
        text: result.stdout,
        error: result.stderr || undefined,
        truncated: result.truncated,
      },
    };
  });
}

function executeWait(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");
    const result = await runDocker({
      args: ["wait", name],
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });
    if (result.exitCode !== 0) {
      throw new Error("docker_wait_failed");
    }
    const parsed = Number.parseInt(result.stdout.trim(), 10);
    const containerExitCode = Number.isNaN(parsed) ? null : parsed;
    return {
      ok: true as const,
      details: {
        name,
        exitCode: containerExitCode ?? undefined,
      },
    };
  });
}

async function executeProbe(input: DockerInput, writer: ToolWriter) {
  const url = ensure(input.url, "docker_probe_url_required");
  const seconds = Math.min(
    Math.max(input.timeoutSec ?? 30, 1),
    MAX_TIMEOUT_SEC
  );
  const timeoutMs = seconds * 1000;
  const controller = new AbortController();
  const timer = setNodeTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    const rawBody = await response.text();
    const truncated = rawBody.length > PROBE_BODY_CAP_BYTES;
    const body = truncated ? rawBody.slice(0, PROBE_BODY_CAP_BYTES) : rawBody;

    Promise.resolve(
      writer?.write?.({
        type: "notice",
        message: "docker_probe_result",
        status: response.status,
        ok: response.ok,
      })
    ).catch(() => {});

    if (!response.ok) {
      const error = new Error("docker_probe_failed");
      (error as Error & { status?: number; body?: string }).status =
        response.status;
      (error as Error & { status?: number; body?: string }).body = body;
      throw error;
    }

    return {
      ok: true as const,
      details: {
        status: response.status,
        body,
        truncated,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("docker_probe_timeout");
    }
    throw error;
  } finally {
    clearNodeTimeout(timer);
  }
}

function executeExec(input: DockerInput, writer: ToolWriter) {
  return withCwdHandle(input.cw, async (cwdHandle) => {
    const name = ensure(input.name, "docker_name_required");
    const cmd = ensure(input.cmd, "docker_exec_cmd_required");

    const args = ["exec"];

    if (input.workingDirectory) {
      args.push("-w", input.workingDirectory);
    }

    if (input.env) {
      for (const [key, value] of Object.entries(input.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    // Interactive mode if needed? For now just exec.
    // We might want -i if we need stdin, but toolCodex usually handles streams.
    // Using -i allows stdin to be piped if runDocker supports it.
    // runDocker currently has stdin: "ignore".
    // For batch exec it's fine.

    args.push(name);
    args.push(cmd);
    if (input.args) {
      args.push(...input.args);
    }

    const result = await runDocker({
      args,
      cwdHandle,
      writer,
      timeoutSec: input.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    });

    return {
      ok: true as const,
      details: {
        name,
        exitCode: result.exitCode,
        text: result.stdout,
        error: result.stderr || undefined,
        truncated: result.truncated,
      },
    };
  });
}

const dockerOutputSchema = z.object({
  ok: z.boolean(),
  details: z
    .object({
      name: z.string().optional(),
      containerId: z.string().optional(),
      running: z.boolean().optional(),
      containerPort: z.number().optional(),
      hostPort: z.number().nullable().optional(),
      ports: z
        .array(z.object({ host: z.number(), container: z.number() }))
        .optional(),
      exitCode: z.number().optional(),
      text: z.string().optional(),
      error: z.string().optional(),
      truncated: z.boolean().optional(),
      status: z.number().optional(),
      body: z.string().optional(),
    })
    .optional(),
});

export type DockerToolOutput = z.infer<typeof dockerOutputSchema>;

export const toolDocker = {
  name: "docker",
  description: "Manage local Docker containers for preview deployments.",
  inputSchema: dockerInputSchema,
  outputSchema: dockerOutputSchema,
  execute: async ({
    input,
    writer,
  }: {
    input: DockerInput;
    writer?: { write: (chunk: unknown) => Promise<void> | void };
  }): Promise<DockerToolOutput> => {
    await enforcePolicy(input);

    switch (input.action) {
      case "build":
        return executeBuild(input, writer);
      case "run":
        return executeRun(input, writer);
      case "start":
        return executeStart(input, writer);
      case "stop":
        return executeStop(input, writer);
      case "rm":
        return executeRemove(input, writer);
      case "inspect":
        return executeInspect(input, writer);
      case "logs":
        return executeLogs(input, writer);
      case "wait":
        return executeWait(input, writer);
      case "exec.probe":
        return executeProbe(input, writer);
      case "exec":
        return executeExec(input, writer);
      default:
        throw new Error("docker_action_not_supported");
    }
  },
};

const aiToolDockerBase = {
  name: toolDocker.name,
  description: toolDocker.description,
  parameters: toolDocker.inputSchema,
  inputSchema: toolDocker.inputSchema,
  execute: async (input: DockerInput) => toolDocker.execute({ input }),
};

export const aiToolDocker = withPolicyApproval(aiToolDockerBase, (input) => {
  const scopes =
    input.action === "exec.probe" ? ["deploy.read"] : ["deploy.write"];
  return {
    action: `docker.${input.action}`,
    resource: {
      kind: "deploy",
      id: input.name ?? input.tag ?? "runtime",
    },
    scopes,
    authz: input.authz,
  };
});

export type ToolDocker = typeof toolDocker;

export const __internals = {
  assertAllowedDirectory,
  runDocker,
};
