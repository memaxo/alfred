#!/usr/bin/env bun

/**
 * Development Environment Guard
 *
 * Prevents instability from concurrent operations:
 * - Duplicate dev servers (Vite, Metro, tsc watch)
 * - Port conflicts
 * - Stale generated files causing infinite loops
 * - File watcher exhaustion
 * - Orphaned processes from previous sessions
 *
 * Run before `bun run dev` or as part of dev script.
 *
 * Usage:
 *   bun scripts/dev-guard.ts          # Interactive mode
 *   bun scripts/dev-guard.ts --fix    # Auto-fix all issues
 *   bun scripts/dev-guard.ts --check  # Check only, exit 1 if issues
 *   bun scripts/dev-guard.ts --kill   # Kill all dev processes
 */

import { existsSync, statSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "bun";

const ROOT_DIR = resolve(import.meta.dir, "..");

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Ports used by ALFRED development */
  ports: {
    web: 3001,
    metro: 8081,
    dbStudio: 5555,
    apiAlt: 3002,
  },

  /** Process patterns to detect */
  processPatterns: [
    { name: "Vite dev server", pattern: /vite.*dev/, critical: true },
    { name: "Metro bundler", pattern: /expo.*start|metro/, critical: true },
    { name: "TypeScript watch", pattern: /tsc.*-[wb]/, critical: false },
    { name: "Turbo dev", pattern: /turbo.*dev/, critical: true },
    { name: "Node dev servers", pattern: /node.*alfred.*dev/, critical: true },
  ],

  /** Files that cause infinite loops when stale */
  volatileFiles: [
    "apps/web/src/routeTree.gen.ts",
    "apps/web/.vinxi",
    "apps/native/.expo",
  ],

  /** Directories with timestamp/lock files to clean */
  cleanupPatterns: [
    "apps/web/.routeTree.gen.ts.timestamp",
    "apps/web/node_modules/.vite",
    ".turbo",
  ],

  /** Minimum recommended file descriptor limit */
  minFileDescriptors: 4096,

  /** macOS fs.inotify equivalent - max_user_watches recommendation */
  minWatchers: 65_536,
} as const;

// ============================================================================
// Types
// ============================================================================

type ProcessInfo = {
  pid: number;
  command: string;
  name: string;
  critical: boolean;
};

type PortInfo = {
  port: number;
  pid: number;
  process: string;
};

type Issue = {
  type: "process" | "port" | "file" | "resource";
  severity: "critical" | "warning";
  description: string;
  fix?: () => Promise<void>;
};

type CheckResult = {
  issues: Issue[];
  processes: ProcessInfo[];
  ports: PortInfo[];
};

// ============================================================================
// Process Detection
// ============================================================================

async function detectDevProcesses(): Promise<ProcessInfo[]> {
  const proc = spawn(["ps", "aux"], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  const processes: ProcessInfo[] = [];
  const lines = stdout.split("\n").slice(1); // Skip header

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) {
      continue;
    }

    const pid = Number.parseInt(parts[1], 10);
    const command = parts.slice(10).join(" ");

    // Skip current process
    if (pid === process.pid) {
      continue;
    }

    for (const { name, pattern, critical } of CONFIG.processPatterns) {
      if (pattern.test(command) && command.includes("alfred")) {
        processes.push({ pid, command, name, critical });
        break;
      }
    }
  }

  return processes;
}

async function killProcess(pid: number): Promise<boolean> {
  try {
    const proc = spawn(["kill", "-9", String(pid)], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return true;
  } catch {
    return false;
  }
}

async function killAllDevProcesses(
  processes: ProcessInfo[]
): Promise<{ killed: number[]; failed: number[] }> {
  const killed: number[] = [];
  const failed: number[] = [];

  for (const { pid } of processes) {
    if (await killProcess(pid)) {
      killed.push(pid);
    } else {
      failed.push(pid);
    }
  }

  return { killed, failed };
}

// ============================================================================
// Port Detection
// ============================================================================

async function detectPortUsage(): Promise<PortInfo[]> {
  const ports: PortInfo[] = [];

  for (const [name, port] of Object.entries(CONFIG.ports)) {
    const proc = spawn(["lsof", "-i", `:${port}`, "-t"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0 && stdout.trim()) {
      const pids = stdout
        .trim()
        .split("\n")
        .map((p) => Number.parseInt(p, 10));
      for (const pid of pids) {
        if (pid && pid !== process.pid) {
          ports.push({ port, pid, process: name });
        }
      }
    }
  }

  return ports;
}

// ============================================================================
// File System Checks
// ============================================================================

function checkVolatileFiles(): Issue[] {
  const issues: Issue[] = [];

  for (const file of CONFIG.volatileFiles) {
    const fullPath = resolve(ROOT_DIR, file);
    if (existsSync(fullPath)) {
      try {
        const stats = statSync(fullPath);
        const age = Date.now() - stats.mtimeMs;

        // If file was modified in last 100ms, something might be writing rapidly
        if (age < 100) {
          issues.push({
            type: "file",
            severity: "critical",
            description: `${file} is being rapidly modified (${age}ms ago) - possible infinite loop`,
            fix: async () => {
              // Wait for any writes to settle
              await Bun.sleep(500);
            },
          });
        }
      } catch {
        // File access error, skip
      }
    }
  }

  return issues;
}

function checkStaleFiles(): Issue[] {
  const issues: Issue[] = [];

  for (const pattern of CONFIG.cleanupPatterns) {
    const fullPath = resolve(ROOT_DIR, pattern);
    if (existsSync(fullPath)) {
      issues.push({
        type: "file",
        severity: "warning",
        description: `Stale file/directory: ${pattern}`,
        fix: async () => {
          try {
            const stats = statSync(fullPath);
            if (stats.isDirectory()) {
              // For directories, we'd need recursive delete - skip for safety
              console.log(`  ℹ️  Skipping directory cleanup: ${pattern}`);
            } else {
              unlinkSync(fullPath);
              console.log(`  🗑️  Removed: ${pattern}`);
            }
          } catch (e) {
            console.log(`  ⚠️  Failed to remove ${pattern}: ${e}`);
          }
        },
      });
    }
  }

  return issues;
}

// ============================================================================
// Resource Checks
// ============================================================================

async function checkFileDescriptorLimit(): Promise<Issue[]> {
  const issues: Issue[] = [];

  try {
    const proc = spawn(["sh", "-c", "ulimit -n"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const limit = Number.parseInt(stdout.trim(), 10);
    if (limit < CONFIG.minFileDescriptors) {
      issues.push({
        type: "resource",
        severity: "warning",
        description: `File descriptor limit (${limit}) is below recommended (${CONFIG.minFileDescriptors})`,
      });
    }
  } catch {
    // Can't check, skip
  }

  return issues;
}

async function checkMacOSWatcherLimit(): Promise<Issue[]> {
  const issues: Issue[] = [];

  if (process.platform !== "darwin") {
    return issues;
  }

  try {
    const proc = spawn(["sysctl", "-n", "kern.maxfiles"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const limit = Number.parseInt(stdout.trim(), 10);
    if (limit < CONFIG.minWatchers) {
      issues.push({
        type: "resource",
        severity: "warning",
        description: `macOS file limit (${limit}) may be insufficient for large monorepo`,
      });
    }
  } catch {
    // Can't check, skip
  }

  return issues;
}

// ============================================================================
// Main Check
// ============================================================================

async function runChecks(): Promise<CheckResult> {
  const [processes, ports, fdIssues, watcherIssues] = await Promise.all([
    detectDevProcesses(),
    detectPortUsage(),
    checkFileDescriptorLimit(),
    checkMacOSWatcherLimit(),
  ]);

  const issues: Issue[] = [...fdIssues, ...watcherIssues];

  // Add process issues
  if (processes.length > 0) {
    const criticalCount = processes.filter((p) => p.critical).length;
    const severity = criticalCount > 1 ? "critical" : "warning";

    issues.push({
      type: "process",
      severity,
      description: `Found ${processes.length} existing dev processes (${criticalCount} critical)`,
      fix: async () => {
        const { killed, failed } = await killAllDevProcesses(processes);
        console.log(`  🔪 Killed ${killed.length} processes`);
        if (failed.length > 0) {
          console.log(`  ⚠️  Failed to kill: ${failed.join(", ")}`);
        }
      },
    });
  }

  // Add port issues
  for (const { port, pid, process: name } of ports) {
    issues.push({
      type: "port",
      severity: "critical",
      description: `Port ${port} (${name}) is in use by PID ${pid}`,
      fix: async () => {
        if (await killProcess(pid)) {
          console.log(`  🔪 Killed process ${pid} on port ${port}`);
        } else {
          console.log(`  ⚠️  Failed to kill process ${pid}`);
        }
      },
    });
  }

  // Add file issues
  issues.push(...checkVolatileFiles());
  issues.push(...checkStaleFiles());

  return { issues, processes, ports };
}

// ============================================================================
// Output Formatting
// ============================================================================

function printBanner(): void {
  console.log("\n🛡️  ALFRED Development Guard");
  console.log("━".repeat(50));
}

function printProcesses(processes: ProcessInfo[]): void {
  if (processes.length === 0) {
    return;
  }

  console.log("\n📋 Detected Dev Processes:");
  for (const { pid, name, command, critical } of processes) {
    const icon = critical ? "🔴" : "🟡";
    const truncCmd =
      command.length > 60 ? `${command.slice(0, 57)}...` : command;
    console.log(`  ${icon} [${pid}] ${name}`);
    console.log(`      ${truncCmd}`);
  }
}

function printPorts(ports: PortInfo[]): void {
  if (ports.length === 0) {
    return;
  }

  console.log("\n🔌 Port Conflicts:");
  for (const { port, pid, process: name } of ports) {
    console.log(`  🔴 Port ${port} (${name}) → PID ${pid}`);
  }
}

function printIssues(issues: Issue[]): void {
  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");

  if (critical.length > 0) {
    console.log("\n🚨 Critical Issues:");
    for (const issue of critical) {
      console.log(`  ❌ ${issue.description}`);
    }
  }

  if (warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    for (const issue of warnings) {
      console.log(`  ⚡ ${issue.description}`);
    }
  }
}

function printSummary(issues: Issue[]): void {
  console.log(`\n${"━".repeat(50)}`);
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  if (critical === 0 && warnings === 0) {
    console.log("✅ Environment is clean - safe to start dev server");
  } else if (critical === 0) {
    console.log(`✅ Ready with ${warnings} warning(s)`);
  } else {
    console.log(`❌ ${critical} critical issue(s), ${warnings} warning(s)`);
    console.log(
      "\n   Run with --fix to auto-resolve, or --kill to terminate all"
    );
  }
}

// ============================================================================
// Interactive Mode
// ============================================================================

async function promptUser(question: string): Promise<boolean> {
  process.stdout.write(`\n${question} (y/N): `);

  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const answer = chunk.toString().trim().toLowerCase();
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      resolve(answer === "y" || answer === "yes");
    };
    process.stdin.resume();
    process.stdin.once("data", onData);
  });
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const autoFix = args.has("--fix") || args.has("-f");
  const checkOnly = args.has("--check") || args.has("-c");
  const killAll = args.has("--kill") || args.has("-k");
  const quiet = args.has("--quiet") || args.has("-q");
  const help = args.has("--help") || args.has("-h");

  if (help) {
    console.log(`
ALFRED Development Guard

Prevents instability from concurrent dev operations.

Usage:
  bun scripts/dev-guard.ts [options]

Options:
  --fix, -f     Auto-fix all detected issues
  --check, -c   Check only, exit 1 if critical issues found
  --kill, -k    Kill all detected dev processes immediately
  --quiet, -q   Minimal output (for scripting)
  --help, -h    Show this help

Examples:
  bun scripts/dev-guard.ts              # Interactive mode
  bun scripts/dev-guard.ts --fix        # Auto-fix before starting dev
  bun scripts/dev-guard.ts --check      # CI/pre-commit check
`);
    process.exit(0);
  }

  if (!quiet) {
    printBanner();
  }

  const result = await runChecks();

  // Kill all mode - just terminate everything
  if (killAll) {
    if (result.processes.length === 0) {
      console.log("No dev processes found.");
      process.exit(0);
    }

    console.log(`Killing ${result.processes.length} processes...`);
    const { killed, failed } = await killAllDevProcesses(result.processes);
    console.log(`Killed: ${killed.length}, Failed: ${failed.length}`);
    process.exit(failed.length > 0 ? 1 : 0);
  }

  if (!quiet) {
    printProcesses(result.processes);
    printPorts(result.ports);
    printIssues(result.issues);
    printSummary(result.issues);
  }

  const criticalIssues = result.issues.filter((i) => i.severity === "critical");

  // Check-only mode
  if (checkOnly) {
    process.exit(criticalIssues.length > 0 ? 1 : 0);
  }

  // Auto-fix mode
  if (autoFix && result.issues.length > 0) {
    console.log("\n🔧 Auto-fixing issues...\n");
    for (const issue of result.issues) {
      if (issue.fix) {
        await issue.fix();
      }
    }

    // Re-check
    const recheck = await runChecks();
    const remaining = recheck.issues.filter((i) => i.severity === "critical");
    if (remaining.length > 0) {
      console.log(`\n⚠️  ${remaining.length} issues remain after fix attempt`);
      process.exit(1);
    }
    console.log("\n✅ All issues resolved");
    process.exit(0);
  }

  // Interactive mode
  if (criticalIssues.length > 0 && !autoFix && !checkOnly) {
    const shouldFix = await promptUser("Fix critical issues?");
    if (shouldFix) {
      for (const issue of criticalIssues) {
        if (issue.fix) {
          await issue.fix();
        }
      }
      console.log("\n✅ Issues addressed. Run dev-guard again to verify.");
    }
  }

  process.exit(criticalIssues.length > 0 ? 1 : 0);
}

// Export for programmatic use
export {
  runChecks,
  detectDevProcesses,
  detectPortUsage,
  killAllDevProcesses,
  type CheckResult,
  type ProcessInfo,
  type PortInfo,
  type Issue,
};

if (import.meta.main) {
  main().catch((error) => {
    console.error("Dev guard error:", error);
    process.exit(1);
  });
}
