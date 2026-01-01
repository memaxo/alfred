#!/usr/bin/env bun
import { runCli } from "../cli";
import { cleanupTerminal } from "../tui/renderer";

try {
  await runCli(process.argv.slice(2));
} catch (error) {
  cleanupTerminal();
  const msg =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "tui_cli_failed";
  process.stderr.write(`${msg}\n`);
  if (error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exitCode = 1;
}
