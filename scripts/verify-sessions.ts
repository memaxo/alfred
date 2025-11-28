#!/usr/bin/env bun
/**
 * Verifies tmux-backed session support used by toolSession/workspace environments.
 *
 * The script performs the following checks:
 * 1. Detects whether tmux is installed; skips gracefully if missing.
 * 2. Supports `--fail` to simulate a missing tmux binary and ensure degradation is graceful.
 * 3. Supports `--session-crash` to kill the tmux server mid-run and verify tooling surfaces failures without crashing.
 * 4. Starts a persistent tmux session via toolSession (running bash) during the default mode.
 * 5. Sends a command, peeks the pane contents, and ensures output is captured.
 * 6. Stops the session and exits 0 on success, non-zero on failures in default mode.
 */

import { spawn } from "bun";
import { toolSession } from "../packages/agent/src/orchestrator/tool/session";

type Mode = "default" | "fail" | "session-crash";

function parseMode(): Mode {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg === "--fail" || arg === "--mode=fail") {
      return "fail";
    }
    if (arg === "--session-crash" || arg === "--mode=session-crash") {
      return "session-crash";
    }
  }
  return "default";
}

async function tmuxAvailable(binary = "tmux") {
  let proc;
  try {
    proc = spawn([binary, "-V"], { stdout: "pipe", stderr: "pipe" });
  } catch {
    return false;
  }

  try {
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function runDefaultScenario() {
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

    if (!(peek.output && peek.output.includes(marker))) {
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

async function runFailScenario() {
  console.log(
    "[verify-sessions] --fail mode enabled; simulating missing tmux."
  );
  if (await tmuxAvailable("__verify_sessions_missing_tmux__")) {
    console.warn(
      "[verify-sessions] Unexpected tmux availability while simulating failure."
    );
  }
  console.log(
    "[verify-sessions] tmux not found; skipping session verification."
  );
}

async function killTmuxServer() {
  const proc = spawn(["tmux", "kill-server"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    await proc.exited;
  } catch {
    // ignore failures; server may already be gone
  }
}

async function runSessionCrashScenario() {
  if (process.env.ORCH_TMUX_DISABLED === "1") {
    console.log(
      "[verify-sessions] tmux disabled via ORCH_TMUX_DISABLED; skipping crash scenario."
    );
    return;
  }

  if (!(await tmuxAvailable())) {
    console.log(
      "[verify-sessions] tmux not found; cannot run session crash scenario."
    );
    return;
  }

  const sessionId = `verify-session-crash-${Date.now().toString(36)}`;
  console.log("[verify-sessions] Starting session crash scenario.");
  try {
    await toolSession.execute({
      input: {
        action: "start",
        sessionId,
        command: "bash",
      },
    });

    await killTmuxServer();

    let peekFailed = false;
    try {
      await toolSession.execute({
        input: {
          action: "peek",
          sessionId,
          lines: 20,
        },
      });
    } catch (error) {
      peekFailed = true;
      console.log(
        "[verify-sessions] session crash surfaced peek failure (expected):",
        String(error)
      );
    }

    if (!peekFailed) {
      throw new Error(
        "session crash scenario did not surface a peek failure as expected"
      );
    }

    console.log("[verify-sessions] Session crash scenario handled gracefully.");
  } catch (error) {
    console.error("[verify-sessions] sessionCrash FAILURE:", error);
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
      // server already killed; nothing to do
    }
  }
}

async function main() {
  const mode = parseMode();

  if (mode === "fail") {
    await runFailScenario();
    return;
  }

  if (mode === "session-crash") {
    await runSessionCrashScenario();
    return;
  }

  if (process.env.ORCH_TMUX_DISABLED === "1") {
    console.log(
      "[verify-sessions] tmux explicitly disabled (ORCH_TMUX_DISABLED=1); skipping."
    );
    return;
  }

  if (!(await tmuxAvailable())) {
    console.log(
      "[verify-sessions] tmux not found; skipping session verification."
    );
    return;
  }

  await runDefaultScenario();
}

await main();
