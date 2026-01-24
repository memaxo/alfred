import { spawn } from "bun";

import type { DirectoryHandle } from "../../security/filesystem.js";
import type { ProjectConfig } from "../../utils/project-detector";

import { spawnWithSecureCwd } from "../../security/secure-spawn.js";

export type RunnerOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

const DEFAULT_HEARTBEAT_MS = 60_000; // 60s default silence limit

export const toolRunner = {
  execute: async (
    command: string,
    cwd: string | DirectoryHandle,
    timeoutMs = 60_000,
    projectConfig?: ProjectConfig
  ): Promise<RunnerOutput> => {
    const start = Date.now();
    const dirHandle = typeof cwd === "string" ? null : cwd;

    // Abstract command handling
    let finalCommand = command;

    if (projectConfig) {
      if (command === "test") {
        finalCommand = projectConfig.testCommand;
      } else if (command === "build") {
        finalCommand = projectConfig.buildCommand;
      } else if (command === "run") {
        finalCommand = projectConfig.runCommand;
      } else if (command === "install") {
        finalCommand = projectConfig.installCommand;
      }
    }

    if (!finalCommand.trim()) {
      throw new Error("Empty command");
    }

    // Use shell delegation to properly handle quoted arguments and complex commands
    const env = { ...process.env };

    const proc =
      dirHandle === null
        ? spawn(["sh", "-c", finalCommand], {
            cwd: cwd as string,
            stdout: "pipe",
            stderr: "pipe",
            env,
          })
        : spawnWithSecureCwd({
            cwdHandle: dirHandle,
            cmd: "sh",
            args: ["-c", finalCommand],
            env,
            stdout: "pipe",
            stderr: "pipe",
          });

    // Heartbeat & Timeout State
    let lastActivity = Date.now();
    let timedOut = false;
    let heartbeatFailed = false;

    // Hard Timeout (Total Duration)
    const totalTimeoutTimer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);

    // Heartbeat Monitor (Silence Duration)
    // Check every 1s if we exceeded silence limit
    const heartbeatInterval = setInterval(() => {
      if (Date.now() - lastActivity > DEFAULT_HEARTBEAT_MS) {
        heartbeatFailed = true;
        proc.kill();
      }
    }, 1000);

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const decoder = new TextDecoder();

    // Stream Readers
    const readStream = async (
      readable: ReadableStream | number | null,
      chunks: string[]
    ) => {
      if (!readable || typeof readable === "number") {
        return;
      }
      const reader = readable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          lastActivity = Date.now();
          chunks.push(decoder.decode(value, { stream: true }));
        }
      } catch {
        // ignore read errors (process killed)
      }
    };

    try {
      await Promise.all([
        readStream(proc.stdout ?? null, stdoutChunks),
        readStream(proc.stderr ?? null, stderrChunks),
        proc.exited,
      ]);

      const exitCode = await proc.exited;

      if (timedOut) {
        throw new Error(`Command timed out after ${timeoutMs}ms`);
      }

      if (heartbeatFailed) {
        throw new Error(
          `Command killed due to inactivity (heartbeat) > ${DEFAULT_HEARTBEAT_MS}ms`
        );
      }

      return {
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        exitCode,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      // Ensure cleanup if promise.all fails
      proc.kill();
      if (timedOut) {
        throw new Error(`Command timed out after ${timeoutMs}ms`);
      }
      if (heartbeatFailed) {
        throw new Error(
          `Command killed due to inactivity (heartbeat) > ${DEFAULT_HEARTBEAT_MS}ms`
        );
      }
      throw err;
    } finally {
      clearTimeout(totalTimeoutTimer);
      clearInterval(heartbeatInterval);
    }
  },
};
