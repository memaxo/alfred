import {
  accessSync,
  chmodSync,
  existsSync,
  constants as fsConstants,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "bun";

// ============================================================================
// TRACKED SANDBOX CLEANUP (process exit handlers)
// ============================================================================

const activeSandboxes = new Set<string>();

function cleanupAllSandboxes(): void {
  for (const dir of activeSandboxes) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  }
  activeSandboxes.clear();
}

// Register cleanup handlers (only once)
let handlersRegistered = false;
function registerCleanupHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  process.on("exit", cleanupAllSandboxes);
  process.on("SIGINT", () => {
    cleanupAllSandboxes();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanupAllSandboxes();
    process.exit(143);
  });
}

/**
 * Get the number of active (uncleared) sandboxes.
 * Useful for debugging cleanup issues.
 */
export function getActiveSandboxCount(): number {
  return activeSandboxes.size;
}

/**
 * Force cleanup of all tracked sandboxes.
 * Call this in global teardown or to recover from test failures.
 */
export function forceCleanupAllSandboxes(): void {
  cleanupAllSandboxes();
}

// ============================================================================
// PROTECTED PATHS - These paths should NEVER be modified by test utilities
// ============================================================================

const WORKSPACE_ROOT = resolve(process.cwd());
const PROTECTED_PATHS = [
  // Real voice package venv
  join(WORKSPACE_ROOT, "packages/voice/.venv"),
  // UV managed Python installations
  join(os.homedir(), ".local/share/uv/python"),
  // Homebrew Python
  "/opt/homebrew",
  "/usr/local",
  // System Python
  "/usr",
  "/System",
];

/**
 * Error thrown when a test attempts to modify a protected path
 */
export class ProtectedPathError extends Error {
  constructor(
    public readonly attemptedPath: string,
    public readonly protectedPath: string
  ) {
    super(
      "SECURITY: Test attempted to modify protected path!\n" +
        `  Attempted: ${attemptedPath}\n` +
        `  Protected: ${protectedPath}\n` +
        "  This would corrupt the real Python environment.\n" +
        "  Use createIsolatedTestDir() to get a safe temp directory."
    );
    this.name = "ProtectedPathError";
  }
}

/**
 * Error thrown when Python environment is corrupted
 */
export class CorruptedPythonError extends Error {
  constructor(
    public readonly pythonPath: string,
    public readonly reason: string
  ) {
    super(
      "CORRUPTED PYTHON DETECTED!\n" +
        `  Path: ${pythonPath}\n` +
        `  Reason: ${reason}\n` +
        `  To fix: rm -rf "${dirname(dirname(pythonPath))}" && uv sync`
    );
    this.name = "CorruptedPythonError";
  }
}

// ============================================================================
// PATH SAFETY VERIFICATION
// ============================================================================

/**
 * Check if a path is within a protected directory
 * @throws ProtectedPathError if path is protected
 */
export function assertPathNotProtected(targetPath: string): void {
  const resolved = resolve(targetPath);

  for (const protectedPath of PROTECTED_PATHS) {
    if (resolved.startsWith(protectedPath)) {
      throw new ProtectedPathError(resolved, protectedPath);
    }
  }
}

/**
 * Check if a path is safe for test operations (must be in temp directory)
 */
export function isPathSafeForTests(targetPath: string): boolean {
  const resolved = resolve(targetPath);
  const tmpDir = os.tmpdir();

  // Path must be in system temp directory
  if (!resolved.startsWith(tmpDir)) {
    return false;
  }

  // Double-check it's not somehow linked to a protected path
  try {
    const realPath = statSync(resolved).isSymbolicLink()
      ? readFileSync(resolved, "utf8")
      : resolved;

    for (const protectedPath of PROTECTED_PATHS) {
      if (realPath.startsWith(protectedPath)) {
        return false;
      }
    }
  } catch {
    // Path doesn't exist yet, that's fine
  }

  return true;
}

/**
 * Validate that a directory is safe for test modifications
 * @throws ProtectedPathError if directory is not safe
 */
export function assertSafeTestDirectory(dir: string): void {
  assertPathNotProtected(dir);

  if (!isPathSafeForTests(dir)) {
    throw new ProtectedPathError(
      dir,
      `Test directories must be in ${os.tmpdir()}`
    );
  }
}

// ============================================================================
// PYTHON ENVIRONMENT VERIFICATION
// ============================================================================

/**
 * Check if a Python executable is real (not a stub)
 */
export async function isRealPython(pythonPath: string): Promise<{
  isReal: boolean;
  version?: string;
  error?: string;
}> {
  if (!existsSync(pythonPath)) {
    return { isReal: false, error: "Python executable does not exist" };
  }

  // Check if it's a shell script (stub indicator)
  try {
    const content = readFileSync(pythonPath, "utf8");
    if (
      content.startsWith("#!/bin/sh") ||
      content.startsWith("@echo off") ||
      content.includes("Python stub")
    ) {
      return { isReal: false, error: "Python is a stub shell script" };
    }
  } catch {
    // Binary file, which is good
  }

  // Try to execute and get version
  try {
    const proc = spawn([pythonPath, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const output = (stdout + stderr).trim();

    if (exitCode !== 0) {
      return { isReal: false, error: `Python exited with code ${exitCode}` };
    }

    if (output.includes("Python stub") || output === "fake") {
      return { isReal: false, error: "Python returned stub output" };
    }

    const versionMatch = output.match(/Python (\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return { isReal: true, version: versionMatch[1] };
    }

    return { isReal: false, error: `Unexpected output: ${output}` };
  } catch (error) {
    return {
      isReal: false,
      error: `Failed to execute: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Verify the voice package Python environment is healthy
 * @throws CorruptedPythonError if environment is corrupted
 */
export async function verifyVoicePythonHealth(): Promise<{
  healthy: boolean;
  pythonPath: string;
  version?: string;
  error?: string;
}> {
  const voiceDir = join(WORKSPACE_ROOT, "packages/voice");
  const pythonPath =
    process.platform === "win32"
      ? join(voiceDir, ".venv", "Scripts", "python.exe")
      : join(voiceDir, ".venv", "bin", "python");

  const result = await isRealPython(pythonPath);

  if (!result.isReal) {
    return {
      healthy: false,
      pythonPath,
      error: result.error,
    };
  }

  return {
    healthy: true,
    pythonPath,
    version: result.version,
  };
}

/**
 * CI check function - fails fast if Python environment is corrupted
 * Use this in CI to catch corruption early
 */
export async function ciVerifyPythonEnvironment(): Promise<void> {
  console.log("🔍 Verifying Python environment...");

  const health = await verifyVoicePythonHealth();

  if (!health.healthy) {
    const strict = process.env.VOICE_STRICT_PYTHON === "1";
    const isMissingPython = health.error === "Python executable does not exist";
    if (process.env.CI && !strict && isMissingPython) {
      console.warn(
        "⚠️ Voice Python environment not found; skipping voice Python verification.\n" +
          "   To enable in CI, set VOICE_STRICT_PYTHON=1 and ensure 'cd packages/voice && uv sync' has been run."
      );
      return;
    }

    console.error("❌ PYTHON ENVIRONMENT CORRUPTED!");
    console.error(`   Path: ${health.pythonPath}`);
    console.error(`   Error: ${health.error}`);
    console.error("");
    console.error("🔧 To fix, run:");
    console.error(
      `   rm -rf "${dirname(dirname(health.pythonPath))}" && cd packages/voice && uv sync`
    );
    console.error("");

    throw new CorruptedPythonError(
      health.pythonPath,
      health.error ?? "Unknown"
    );
  }

  console.log(`✅ Python environment healthy: ${health.version}`);
  console.log(`   Path: ${health.pythonPath}`);
}

// ============================================================================
// SELF-HEALING MECHANISMS
// ============================================================================

/**
 * Attempt to repair a corrupted Python environment
 * Returns true if repair was successful
 */
export async function attemptPythonRepair(): Promise<{
  repaired: boolean;
  message: string;
}> {
  const voiceDir = join(WORKSPACE_ROOT, "packages/voice");
  const venvPath = join(voiceDir, ".venv");

  console.log("🔧 Attempting to repair Python environment...");

  // Step 1: Remove corrupted venv
  try {
    if (existsSync(venvPath)) {
      console.log(`   Removing corrupted venv: ${venvPath}`);
      rmSync(venvPath, { recursive: true, force: true });
    }
  } catch (error) {
    return {
      repaired: false,
      message: `Failed to remove venv: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Step 2: Check if UV is available
  const uvAvailable = await hasUv();
  if (!uvAvailable) {
    return {
      repaired: false,
      message:
        "UV not available. Install UV and run: cd packages/voice && uv sync",
    };
  }

  // Step 3: Run uv sync
  try {
    console.log("   Running uv sync...");
    const proc = spawn(["uv", "sync"], {
      cwd: voiceDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return {
        repaired: false,
        message: `uv sync failed with code ${exitCode}: ${stderr}`,
      };
    }
  } catch (error) {
    return {
      repaired: false,
      message: `uv sync execution failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Step 4: Verify repair
  const health = await verifyVoicePythonHealth();
  if (health.healthy) {
    console.log(`✅ Python environment repaired: ${health.version}`);
    return {
      repaired: true,
      message: `Repaired successfully: Python ${health.version}`,
    };
  }

  return {
    repaired: false,
    message: `Repair failed: ${health.error}`,
  };
}

/**
 * Ensure Python environment is healthy, attempt repair if needed
 * Use this at the start of tests that require real Python
 */
export async function ensureHealthyPython(): Promise<{
  healthy: boolean;
  version?: string;
  wasRepaired: boolean;
  error?: string;
}> {
  // First check
  let health = await verifyVoicePythonHealth();

  if (health.healthy) {
    return {
      healthy: true,
      version: health.version,
      wasRepaired: false,
    };
  }

  // Attempt repair
  console.warn(`⚠️  Python environment unhealthy: ${health.error}`);
  const repair = await attemptPythonRepair();

  if (repair.repaired) {
    health = await verifyVoicePythonHealth();
    return {
      healthy: health.healthy,
      version: health.version,
      wasRepaired: true,
    };
  }

  return {
    healthy: false,
    wasRepaired: false,
    error: repair.message,
  };
}

// ============================================================================
// ISOLATED TEST DIRECTORY CREATION
// ============================================================================

/**
 * Create a completely isolated test directory
 * This is the ONLY safe way to create test environments
 *
 * Uses tracked sandboxes - automatically cleaned up on process exit
 * even if tests crash before afterEach runs.
 */
export function createIsolatedTestDir(prefix = "alfred-voice-test-"): {
  rootDir: string;
  voiceDir: string;
  cleanup: () => void;
} {
  // Ensure cleanup handlers are registered
  registerCleanupHandlers();

  const rootDir = join(
    os.tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Track for cleanup on process exit
  activeSandboxes.add(rootDir);

  // Create structure
  const voiceDir = join(rootDir, "packages", "voice");
  mkdirSync(voiceDir, { recursive: true });

  // Verify it's safe
  assertSafeTestDirectory(rootDir);

  return {
    rootDir,
    voiceDir,
    cleanup: () => {
      // Remove from tracking first
      activeSandboxes.delete(rootDir);
      try {
        rmSync(rootDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

// ============================================================================
// SAFE TEST UTILITIES (Use these instead of the old functions)
// ============================================================================

/**
 * Check if UV is available in PATH
 */
export async function hasUv(): Promise<boolean> {
  try {
    const findCmd =
      process.platform === "win32" ? ["where", "uv"] : ["which", "uv"];
    const proc = spawn(findCmd, {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const stdout = await new Response(proc.stdout).text();
      const path = stdout.trim().split("\n")[0];
      if (path) {
        try {
          accessSync(path, fsConstants.F_OK);
          return true;
        } catch {
          return false;
        }
      }
    }
  } catch {
    // UV not found
  }
  return false;
}

/**
 * Check if virtual environment exists and has Python executable
 */
export function hasVenv(voiceDir: string): boolean {
  const venvPython =
    process.platform === "win32"
      ? join(voiceDir, ".venv", "Scripts", "python.exe")
      : join(voiceDir, ".venv", "bin", "python");

  try {
    accessSync(venvPython, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Python dependencies are installed
 */
export async function hasPythonDependencies(
  pythonCmd: string[]
): Promise<boolean> {
  try {
    const proc = spawn(
      [
        ...pythonCmd,
        "-c",
        `
import sys
try:
    import faster_whisper
    import piper
    import silero_vad
    import numpy
    sys.exit(0)
except ImportError:
    sys.exit(1)
    `,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Create a temporary virtual environment for testing
 * SAFE: Only works in isolated temp directories
 *
 * @param isolatedVoiceDir - MUST be created via createIsolatedTestDir()
 * @throws ProtectedPathError if directory is not in temp
 */
export function createTestVenv(isolatedVoiceDir: string): string {
  // SAFETY CHECK: Ensure we're not touching real directories
  assertSafeTestDirectory(isolatedVoiceDir);

  const venvBinDir =
    process.platform === "win32"
      ? join(isolatedVoiceDir, ".venv", "Scripts")
      : join(isolatedVoiceDir, ".venv", "bin");

  mkdirSync(venvBinDir, { recursive: true });

  const venvPython =
    process.platform === "win32"
      ? join(venvBinDir, "python.exe")
      : join(venvBinDir, "python");

  // Create a stub Python executable (safe because we're in temp)
  if (process.platform === "win32") {
    writeFileSync(venvPython, "@echo off\necho Python stub\n");
  } else {
    writeFileSync(venvPython, "#!/bin/sh\necho 'Python stub'\n");
    chmodSync(venvPython, 0o755);
  }

  return venvPython;
}

/**
 * Clean up test virtual environment
 * SAFE: Only works in isolated temp directories
 */
export function cleanupTestVenv(isolatedVoiceDir: string): void {
  // SAFETY CHECK
  assertSafeTestDirectory(isolatedVoiceDir);

  const venvPath = join(isolatedVoiceDir, ".venv");
  try {
    rmSync(venvPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Save current environment variables
 */
export function saveEnvVars(
  keys: string[]
): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of keys) {
    saved[key] = process.env[key];
  }
  return saved;
}

/**
 * Restore saved environment variables
 */
export function restoreEnvVars(
  saved: Record<string, string | undefined>
): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * @deprecated Use createIsolatedTestDir() instead
 */
export function createTempDir(prefix = "alfred-voice-test-"): string {
  console.warn(
    "DEPRECATED: createTempDir() is deprecated. Use createIsolatedTestDir() instead."
  );
  return join(
    os.tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Create a fake executable in a directory
 * SAFE: Only works in temp directories
 *
 * @throws ProtectedPathError if directory is not safe
 */
export function createFakeExecutable(dir: string, name: string): string {
  // SAFETY CHECK
  assertSafeTestDirectory(dir);

  mkdirSync(dir, { recursive: true });
  const executable =
    process.platform === "win32" ? join(dir, `${name}.exe`) : join(dir, name);

  if (process.platform === "win32") {
    writeFileSync(executable, "@echo off\necho fake\n");
  } else {
    writeFileSync(executable, "#!/bin/sh\necho 'fake'\n");
    chmodSync(executable, 0o755);
  }

  return executable;
}

// ============================================================================
// TEST SETUP HELPERS
// ============================================================================

/**
 * Setup helper for tests that need isolated Python environments
 * Returns everything needed for safe testing
 */
export async function setupIsolatedPythonTest(): Promise<{
  testDir: ReturnType<typeof createIsolatedTestDir>;
  savedEnv: Record<string, string | undefined>;
  cleanup: () => void;
}> {
  const testDir = createIsolatedTestDir();
  const savedEnv = saveEnvVars([
    "PATH",
    "PYTHONPATH",
    "VOICE_USE_UV",
    "VOICE_PROVIDER",
  ]);

  return {
    testDir,
    savedEnv,
    cleanup: () => {
      restoreEnvVars(savedEnv);
      testDir.cleanup();
    },
  };
}

/**
 * Fail-fast check for test prerequisites
 * Call this at the start of test files that need real Python
 */
export async function failFastPythonCheck(): Promise<void> {
  const health = await verifyVoicePythonHealth();

  if (!health.healthy) {
    const message = [
      "",
      "═══════════════════════════════════════════════════════════════════",
      "  ❌ PYTHON ENVIRONMENT CHECK FAILED - TESTS CANNOT RUN",
      "═══════════════════════════════════════════════════════════════════",
      "",
      `  Python Path: ${health.pythonPath}`,
      `  Error: ${health.error}`,
      "",
      "  🔧 To fix, run these commands:",
      "",
      `     rm -rf "${dirname(dirname(health.pythonPath))}"`,
      "     cd packages/voice && uv sync",
      "",
      "  Or run this to attempt automatic repair:",
      "",
      "     bun run packages/voice/scripts/repair-python.ts",
      "",
      "═══════════════════════════════════════════════════════════════════",
      "",
    ].join("\n");

    console.error(message);
    throw new CorruptedPythonError(
      health.pythonPath,
      health.error ?? "Unknown"
    );
  }
}
