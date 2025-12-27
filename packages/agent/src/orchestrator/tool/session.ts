import { spawn } from "bun";
import { z } from "zod";
import type { ToolExecuteArgs } from "./shared/context.js";

function tmuxDisabled() {
  return process.env.ORCH_TMUX_DISABLED === "1";
}

export const sessionInputSchema = z.object({
  action: z.enum(["start", "stop", "list", "peek", "send"]),
  sessionId: z.string().min(1).max(50),
  command: z.string().optional(), // Required for start
  text: z.string().optional(), // Required for send
  lines: z.number().int().min(1).max(1000).optional(), // For peek
});

export type SessionToolInput = z.infer<typeof sessionInputSchema>;

async function runTmux(args: string[]) {
  if (tmuxDisabled()) {
    throw new Error("tmux_disabled");
  }

  const tmux = "tmux";
  let proc: ReturnType<typeof spawn>;
  try {
    proc = spawn([tmux, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    throw new Error(
      `tmux_spawn_failed: ${(error as NodeJS.ErrnoException).message}`
    );
  }

  const stdout = proc.stdout
    ? await new Response(proc.stdout as ReadableStream<Uint8Array>).text()
    : "";
  const stderr = proc.stderr
    ? await new Response(proc.stderr as ReadableStream<Uint8Array>).text()
    : "";

  const exitCode = await proc.exited.catch((error) => {
    throw new Error(
      `tmux_exec_failed: ${(error as NodeJS.ErrnoException).message}`
    );
  });

  if (exitCode !== 0) {
    throw new Error(`tmux_failed: ${stderr || stdout || "unknown error"}`);
  }

  return stdout.trim();
}

let runTmuxHandler = runTmux;

export const __sessionInternals = {
  setRunner(replacement: typeof runTmux) {
    runTmuxHandler = replacement;
  },
  resetRunner() {
    runTmuxHandler = runTmux;
  },
};

export const toolSession = {
  name: "session",
  description:
    "Manage persistent terminal sessions (via tmux) for long-running commands or interactivity.",
  inputSchema: sessionInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    output: z.string().optional(),
    sessions: z.array(z.string()).optional(),
  }),
  execute: async ({ input }: ToolExecuteArgs<SessionToolInput>) => {
    const { action, sessionId } = input;

    switch (action) {
      case "start": {
        if (!input.command) {
          throw new Error("command required for start");
        }
        // Create detached session
        // -d: detached
        // -s: session name
        await runTmuxHandler([
          "new-session",
          "-d",
          "-s",
          sessionId,
          input.command,
        ]);
        return {
          ok: true,
          output: `Session ${sessionId} started with: ${input.command}`,
        };
      }

      case "stop": {
        // Kill session
        await runTmuxHandler(["kill-session", "-t", sessionId]);
        return { ok: true, output: `Session ${sessionId} stopped` };
      }

      case "list": {
        try {
          const out = await runTmuxHandler([
            "list-sessions",
            "-F",
            "#{session_name}",
          ]);
          return { ok: true, sessions: out.split("\n").filter(Boolean) };
        } catch (_e) {
          // If no sessions, tmux returns error 1
          return { ok: true, sessions: [] };
        }
      }

      case "peek": {
        const lines = input.lines ?? 20;
        // Capture pane content
        // -p: output to stdout
        // -t: target session
        const out = await runTmuxHandler([
          "capture-pane",
          "-t",
          sessionId,
          "-p",
          "-S",
          `-${lines}`,
        ]);
        return { ok: true, output: out };
      }

      case "send": {
        if (input.text === undefined) {
          throw new Error("text required for send");
        }
        // Send keys
        // -t: target
        // Keys are sent literally. 'Enter' is usually needed.
        // We'll append Enter automatically if not present?
        // Better to be explicit or send "C-m" (Carriage Return)

        // Naive implementation: send text then Enter
        await runTmuxHandler(["send-keys", "-t", sessionId, input.text, "C-m"]);
        return { ok: true, output: `Sent input to ${sessionId}` };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  },
};
