import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

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
 * Returns the path to the Python executable
 */
export function createTestVenv(voiceDir: string): string {
  const venvBinDir =
    process.platform === "win32"
      ? join(voiceDir, ".venv", "Scripts")
      : join(voiceDir, ".venv", "bin");

  mkdirSync(venvBinDir, { recursive: true });

  const venvPython =
    process.platform === "win32"
      ? join(venvBinDir, "python.exe")
      : join(venvBinDir, "python");

  // Create a stub Python executable
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
 */
export function cleanupTestVenv(voiceDir: string): void {
  const venvPath = join(voiceDir, ".venv");
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
 * Create a temporary directory for testing
 */
export function createTempDir(prefix = "alfred-voice-test-"): string {
  return join(
    os.tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Create a fake executable in a directory
 */
export function createFakeExecutable(dir: string, name: string): string {
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
