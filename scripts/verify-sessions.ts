#!/usr/bin/env bun
/**
 * Verifies tmux-backed session support used by toolSession/workspace environments.
 *
 * The script performs the following checks:
 * 1. Detects whether tmux is installed; skips gracefully if missing.
 * 2. Starts a persistent tmux session via toolSession (running bash).
 * 3. Sends a command, peeks the pane contents, and ensures output is captured.
 * 4. Stops the session and exits 0 on success, non-zero on failures.
 */

import { spawn } from "bun";
import { toolSession } from "../packages/agent/src/orchestrator/tool/session";

async function tmuxAvailable() {
  const proc = spawn(["tmux", "-V"], { stdout: "pipe", stderr: "pipe" });
  try {
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function main() {
  if (process.env.ORCH_TMUX_DISABLED === "1") {
    console.log("[verify-sessions] tmux explicitly disabled (ORCH_TMUX_DISABLED=1); skipping.");
    return;
  }

  if (!(await tmuxAvailable())) {
    console.log("[verify-sessions] tmux not found; skipping session verification.");
    return;
  }

  const sessionId = `verify-session-${Date.now().toString(36)}`;
  const marker = `VERIFY_SESSIONS_${Date.now().toString(36)}`;

  try {
    await toolSession.execute({
      input: {
        action: "start",
        sessionId,
        command: "bash",
      },
    });

    await toolSession.execute({
      input: {
        action: "send",
        sessionId,
        text: `echo ${marker}`,
      },
    });

    // Give tmux a brief moment to flush output.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const peek = await toolSession.execute({
      input: {
        action: "peek",
        sessionId,
        lines: 50,
      },
    });

    if (!peek.output || !peek.output.includes(marker)) {
      throw new Error("marker not found in tmux session output");
    }

    console.log("[verify-sessions] Session tool verified successfully.");
  } catch (error) {
    console.error("[verify-sessions] FAILURE:", error);
    process.exitCode = 1;
  } finally {
    try {
      await toolSession.execute({
        input: {
          action: "stop",
          sessionId,
        },
      });
    } catch {
      // ignore cleanup failure
    }
  }
}

await main();
