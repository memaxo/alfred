import { spawn } from "bun";
import type { ProjectConfig } from "../../utils/project-detector";

export type RunnerOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export const toolRunner = {
  execute: async (
    command: string,
    cwd: string,
    timeoutMs = 60_000,
    projectConfig?: ProjectConfig
  ): Promise<RunnerOutput> => {
    const start = Date.now();

    // Abstract command handling
    // If command is a generic alias like "test", "build", "run", map it to projectConfig
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

    // Split command into args properly (naive split for MVP)
    const [cmd, ...args] = finalCommand.split(" ");

    if (!cmd) {
      throw new Error("Empty command");
    }

    const proc = spawn([cmd, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, CI: "true" }, // Ensure CI mode for cleaner output
    });

    const timeout = setTimeout(() => {
      proc.kill();
    }, timeoutMs);

    try {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return {
        stdout,
        stderr,
        exitCode,
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
