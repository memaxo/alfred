import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

import type { Reporter, RunEvent } from "./events.js";

function fmtMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function createConsoleReporter(): Reporter {
  return {
    emit: (event) => {
      switch (event.type) {
        case "run_start": {
          process.stdout.write(
            `=== Evals run start ===\nrunId=${event.runId}\n\n`
          );
          return;
        }
        case "step_start": {
          process.stdout.write(
            `--- ${event.label} (attempt ${event.attempt}) ---\n`
          );
          return;
        }
        case "step_ok": {
          process.stdout.write(
            `[ok] ${event.label} (${fmtMs(event.durationMs)})\n\n`
          );
          return;
        }
        case "step_skip": {
          process.stdout.write(
            `[skip] ${event.label} (reason: ${event.reason})\n\n`
          );
          return;
        }
        case "step_stalled": {
          process.stdout.write(
            `[stall] ${event.label} (${fmtMs(event.msSinceActivity)})\n`
          );
          return;
        }
        case "step_fail": {
          process.stderr.write(
            `[fail] ${event.label} (${fmtMs(event.durationMs)})\n` +
              `  error=${event.error.message}\n\n`
          );
          return;
        }
        case "log": {
          const out =
            event.stream === "stderr" ? process.stderr : process.stdout;
          out.write(event.text);
          return;
        }
        case "artifact": {
          process.stdout.write(`artifact(${event.kind}): ${event.path}\n`);
          return;
        }
        case "run_end": {
          process.stdout.write(
            `=== Evals run end ===\nrunId=${event.runId} ok=${String(event.ok)}\n`
          );
          return;
        }
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    },
  };
}

export function createJsonlReporter(filePath: string): Reporter {
  let ready = false;

  async function ensureReady(): Promise<void> {
    if (ready) {
      return;
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    ready = true;
  }

  return {
    emit: async (event: RunEvent) => {
      await ensureReady();
      await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
    },
  };
}
