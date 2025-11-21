import { spawn } from "bun";

export type RunnerOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
};

export const toolRunner = {
  execute: async (command: string, cwd: string, timeoutMs = 60000): Promise<RunnerOutput> => {
    const start = Date.now();
    
    // Split command into args properly (naive split for MVP)
    // In production this should use a proper shell-quote parser or allow array input
    const [cmd, ...args] = command.split(" ");
    
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
