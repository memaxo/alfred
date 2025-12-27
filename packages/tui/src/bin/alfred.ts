#!/usr/bin/env bun
import { runCli } from "../cli";

try {
  await runCli(process.argv.slice(2));
} catch (error) {
  const msg =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "tui_cli_failed";
  process.stderr.write(`${msg}\n`);
  process.exitCode = 1;
}
