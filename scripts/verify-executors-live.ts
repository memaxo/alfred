/**
 * Legacy wrapper for executor live verification.
 *
 * This script delegates to `@alfred/evals` (which runs the Codex/OpenCode
 * executor suites inside AgentFS containers).
 *
 * Legacy flags:
 * - `--retain-container` → `--retain always`
 * - `--opencode-http` → `--transport http`
 *
 * Compatibility behavior:
 * - If neither `--confirm-cost` nor `--preflight` is provided, we default to
 *   `--confirm-cost` to preserve historical “run the real providers” behavior.
 */

import { main as evalsMain } from "@alfred/evals/cli";

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function adaptArgv(argv: string[]): string[] {
  const out: string[] = [];
  let legacyRetain = false;
  let legacyHttp = false;

  for (const a of argv) {
    if (a === "--retain-container") {
      legacyRetain = true;
      continue;
    }
    if (a === "--opencode-http") {
      legacyHttp = true;
      continue;
    }
    out.push(a);
  }

  if (legacyRetain && !hasFlag(out, "--retain")) {
    out.push("--retain", "always");
  }
  if (legacyHttp && !hasFlag(out, "--transport")) {
    out.push("--transport", "http");
  }

  if (!hasFlag(out, "--confirm-cost") && !hasFlag(out, "--preflight")) {
    out.push("--confirm-cost");
  }

  return out;
}

await evalsMain(adaptArgv(Bun.argv.slice(2)));
