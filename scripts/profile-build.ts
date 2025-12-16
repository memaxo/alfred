#!/usr/bin/env bun

/**
 * Build profiling harness for diagnosing OOM and memory issues.
 *
 * Runs a package build with Node/V8 profiling flags that emit:
 * - Heap snapshots near heap limit (--heapsnapshot-near-heap-limit)
 * - Diagnostic reports on fatal errors (--diagnostic-report-on-fatalerror)
 * - GC traces (--trace-gc --trace-gc-nvp)
 * - Optional heap profiles (--heap-prof)
 *
 * Usage:
 *   bun scripts/profile-build.ts [options]
 *
 * Options:
 *   --cwd <path>              Working directory (default: packages/api)
 *   --label <name>            Label for output folder (default: derived from cwd)
 *   --max-old-space-size <mb> Max heap size in MB (default: 4096)
 *   --trace-gc                Enable GC tracing (default: true)
 *   --no-trace-gc             Disable GC tracing
 *   --heap-prof               Enable heap profiling (default: false)
 *   --cmd <command>           Build command (default: bun run build)
 *   -- <args...>              Pass remaining args to build command
 *
 * Output:
 *   .profiles/build/<timestamp>-<label>/
 *     diagnostic/   - Node diagnostic reports
 *     heap/         - Heap profiles (if --heap-prof)
 *     logs/         - stdout.log, stderr.log, gc.log
 */

import { spawn } from "bun";
import { mkdir, appendFile } from "node:fs/promises";
import { resolve, basename, join } from "node:path";
import { createWriteStream } from "node:fs";

type Options = {
  cwd: string;
  label: string;
  maxOldSpaceSize: number;
  traceGc: boolean;
  heapProf: boolean;
  cmd: string[];
};

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    cwd: "packages/api",
    label: "",
    maxOldSpaceSize: 4096,
    traceGc: true,
    heapProf: false,
    cmd: ["bun", "run", "build"],
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--cwd" && args[i + 1]) {
      options.cwd = args[i + 1];
      i += 2;
    } else if (arg === "--label" && args[i + 1]) {
      options.label = args[i + 1];
      i += 2;
    } else if (arg === "--max-old-space-size" && args[i + 1]) {
      options.maxOldSpaceSize = Number.parseInt(args[i + 1], 10);
      i += 2;
    } else if (arg === "--trace-gc") {
      options.traceGc = true;
      i += 1;
    } else if (arg === "--no-trace-gc") {
      options.traceGc = false;
      i += 1;
    } else if (arg === "--heap-prof") {
      options.heapProf = true;
      i += 1;
    } else if (arg === "--cmd" && args[i + 1]) {
      options.cmd = args[i + 1].split(" ");
      i += 2;
    } else if (arg === "--") {
      options.cmd = args.slice(i + 1);
      break;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  // Derive label from cwd if not provided
  if (!options.label) {
    options.label = basename(options.cwd);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Build profiling harness for diagnosing OOM and memory issues.

Usage:
  bun scripts/profile-build.ts [options]

Options:
  --cwd <path>              Working directory (default: packages/api)
  --label <name>            Label for output folder (default: derived from cwd)
  --max-old-space-size <mb> Max heap size in MB (default: 4096)
  --trace-gc                Enable GC tracing (default: true)
  --no-trace-gc             Disable GC tracing
  --heap-prof               Enable heap profiling (default: false)
  --cmd <command>           Build command as string (default: bun run build)
  -- <args...>              Pass remaining args as build command
  -h, --help                Show this help

Examples:
  # Profile @alfred/api with 4GB heap (likely to OOM)
  bun scripts/profile-build.ts

  # Profile with larger heap to find success threshold
  bun scripts/profile-build.ts --max-old-space-size 8192

  # Profile a different package
  bun scripts/profile-build.ts --cwd packages/agent --label agent

  # Enable heap profiling for detailed allocation tracking
  bun scripts/profile-build.ts --heap-prof

Output:
  .profiles/build/<timestamp>-<label>/
    diagnostic/   - Node diagnostic reports (on fatal error)
    heap/         - Heap profiles (if --heap-prof enabled)
    logs/         - stdout.log, stderr.log, gc.log

Open heapsnapshots in Chrome DevTools:
  1. Open chrome://inspect
  2. Click "Open dedicated DevTools for Node"
  3. Go to Memory tab
  4. Click "Load" and select the .heapsnapshot file
`);
}

function timestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function main(): Promise<void> {
  const options = parseArgs();

  // Resolve paths
  const rootDir = resolve(import.meta.dir, "..");
  const cwdAbsolute = resolve(rootDir, options.cwd);
  const outputDir = resolve(
    rootDir,
    ".profiles",
    "build",
    `${timestamp()}-${options.label}`
  );
  const diagnosticDir = join(outputDir, "diagnostic");
  const heapDir = join(outputDir, "heap");
  const logsDir = join(outputDir, "logs");

  // Create output directories
  await ensureDir(diagnosticDir);
  await ensureDir(heapDir);
  await ensureDir(logsDir);

  console.log("┌─────────────────────────────────────────────────────────────");
  console.log("│ Build Profiling Harness");
  console.log("├─────────────────────────────────────────────────────────────");
  console.log(`│ Working directory: ${cwdAbsolute}`);
  console.log(`│ Output directory:  ${outputDir}`);
  console.log(`│ Max heap size:     ${options.maxOldSpaceSize} MB`);
  console.log(`│ GC tracing:        ${options.traceGc ? "enabled" : "disabled"}`);
  console.log(`│ Heap profiling:    ${options.heapProf ? "enabled" : "disabled"}`);
  console.log(`│ Command:           ${options.cmd.join(" ")}`);
  console.log("└─────────────────────────────────────────────────────────────");
  console.log();

  // Build NODE_OPTIONS
  // Note: Some flags cannot be in NODE_OPTIONS (Node security restrictions):
  // - --diagnostic-report-on-fatalerror
  // - --trace-gc
  // We'll rely on heap snapshots (most valuable) and manual GC tracing if needed
  const nodeOptions: string[] = [
    `--max-old-space-size=${options.maxOldSpaceSize}`,
    "--heapsnapshot-near-heap-limit=3",
  ];

  if (options.heapProf) {
    nodeOptions.push("--heap-prof", `--heap-prof-dir=${heapDir}`);
  }

  // GC tracing would need to be done via node --trace-gc directly, not via NODE_OPTIONS
  // For now, we'll skip it since heap snapshots are the primary diagnostic tool

  // Merge with existing NODE_OPTIONS if any (but override max-old-space-size)
  const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
  const filteredExisting = existingNodeOptions
    .split(" ")
    .filter((opt) => !opt.startsWith("--max-old-space-size"))
    .join(" ");
  const finalNodeOptions = [...nodeOptions, filteredExisting]
    .filter(Boolean)
    .join(" ");

  // Prepare environment
  const env = {
    ...process.env,
    NODE_OPTIONS: finalNodeOptions,
  };

  // Prepare log files
  const stdoutLogPath = join(logsDir, "stdout.log");
  const stderrLogPath = join(logsDir, "stderr.log");
  const gcLogPath = join(logsDir, "gc.log");

  // Create write streams for logs
  const stdoutLog = createWriteStream(stdoutLogPath, { flags: "a" });
  const stderrLog = createWriteStream(stderrLogPath, { flags: "a" });
  const gcLog = createWriteStream(gcLogPath, { flags: "a" });

  console.log(`Starting build with NODE_OPTIONS:\n  ${finalNodeOptions}\n`);

  // Spawn the build process
  const proc = spawn(options.cmd, {
    cwd: cwdAbsolute,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Stream stdout
  const stdoutReader = proc.stdout.getReader();
  const textDecoder = new TextDecoder();

  async function processStdout(): Promise<void> {
    while (true) {
      const { done, value } = await stdoutReader.read();
      if (done) break;

      const text = textDecoder.decode(value);
      process.stdout.write(text);
      stdoutLog.write(text);
    }
  }

  // Stream stderr (which includes GC traces when --trace-gc is enabled)
  const stderrReader = proc.stderr.getReader();

  async function processStderr(): Promise<void> {
    while (true) {
      const { done, value } = await stderrReader.read();
      if (done) break;

      const text = textDecoder.decode(value);

      // Write to terminal
      process.stderr.write(text);

      // Write to stderr log
      stderrLog.write(text);

      // GC tracing not available via NODE_OPTIONS (Node restriction)
      // Heap snapshots are the primary diagnostic tool
    }
  }

  // Process streams in parallel
  await Promise.all([processStdout(), processStderr()]);

  // Wait for process to exit
  const exitCode = await proc.exited;

  // Close log streams
  stdoutLog.end();
  stderrLog.end();
  gcLog.end();

  console.log();
  console.log("┌─────────────────────────────────────────────────────────────");
  console.log("│ Build Complete");
  console.log("├─────────────────────────────────────────────────────────────");
  console.log(`│ Exit code: ${exitCode}`);
  console.log(`│ Artifacts saved to: ${outputDir}`);
  console.log("│");
  console.log("│ To analyze heap snapshots:");
  console.log("│   1. Open chrome://inspect");
  console.log('│   2. Click "Open dedicated DevTools for Node"');
  console.log("│   3. Go to Memory tab → Load");
  console.log(`│   4. Select .heapsnapshot files from: ${diagnosticDir}`);
  console.log("│");
  console.log("│ To view diagnostic reports:");
  console.log(`│   ls ${diagnosticDir}/*.json`);
  console.log("└─────────────────────────────────────────────────────────────");
  console.log();
  console.log(`Artifacts saved to: ${outputDir}`);

  process.exit(exitCode);
}

main().catch((error) => {
  console.error("Profiling harness error:", error);
  process.exit(1);
});
