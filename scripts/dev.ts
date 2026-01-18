#!/usr/bin/env bun

/**
 * Safe Development Server Launcher
 *
 * Runs dev-guard checks before starting the development server.
 * Prevents the infinite loop and duplicate process issues.
 *
 * Usage:
 *   bun scripts/dev.ts           # Run guard + dev
 *   bun scripts/dev.ts --skip    # Skip guard, run dev directly
 *   bun scripts/dev.ts web       # Run only web dev
 *   bun scripts/dev.ts native    # Run only native dev
 */

import { resolve } from "node:path";
import { spawn } from "bun";

const ROOT_DIR = resolve(import.meta.dir, "..");

async function runGuard(): Promise<boolean> {
  console.log("🛡️  Running development environment guard...\n");

  const proc = spawn(["bun", "scripts/dev-guard.ts", "--fix"], {
    cwd: ROOT_DIR,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.log("\n❌ Dev guard found unresolvable issues.");
    console.log("   Run 'bun scripts/dev-guard.ts' for details.\n");
    return false;
  }

  console.log("\n");
  return true;
}

async function runDev(filter?: string): Promise<void> {
  const args = ["turbo", "dev", "--concurrency=25"];

  if (filter) {
    args.push(`--filter=${filter}`);
  }

  console.log("🚀 Starting development server...");
  console.log(`   Command: bun ${args.join(" ")}\n`);

  const proc = spawn(["bun", ...args], {
    cwd: ROOT_DIR,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n\n📴 Received ${signal}, shutting down...`);
    proc.kill();
    await proc.exited;
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const exitCode = await proc.exited;
  process.exit(exitCode);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipGuard = args.includes("--skip");
  const help = args.includes("--help") || args.includes("-h");

  if (help) {
    console.log(`
ALFRED Safe Development Server

Usage:
  bun scripts/dev.ts [options] [filter]

Options:
  --skip        Skip the dev-guard checks
  --help, -h    Show this help

Filters:
  web           Run only the web app
  native        Run only the native app
  @alfred/api   Run only the API package
  (any turbo filter pattern)

Examples:
  bun scripts/dev.ts              # Full dev with guard
  bun scripts/dev.ts --skip       # Skip guard (not recommended)
  bun scripts/dev.ts web          # Web only with guard
  bun scripts/dev.ts native       # Native only with guard
`);
    process.exit(0);
  }

  // Extract filter (non-flag argument)
  const filter = args.find(
    (arg) => !(arg.startsWith("--") || arg.startsWith("-"))
  );

  // Run guard unless skipped
  if (skipGuard) {
    console.log("⚠️  Skipping dev-guard checks (--skip flag)\n");
  } else {
    const guardPassed = await runGuard();
    if (!guardPassed) {
      process.exit(1);
    }
  }

  // Start dev server
  await runDev(filter);
}

main().catch((error) => {
  console.error("Dev launcher error:", error);
  process.exit(1);
});
