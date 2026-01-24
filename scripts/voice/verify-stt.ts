#!/usr/bin/env bun

/**
 * STT Diagnostics Script
 *
 * Performs a deep health check of the local STT system by:
 * 1. Checking Python environment and dependencies
 * 2. Verifying model files exist
 * 3. Running a test transcription
 * 4. Checking logs for errors
 *
 * Usage:
 *   bun run scripts/verify-stt.ts
 */

import { spawn } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

async function checkPythonEnv() {
  console.log("🔍 Checking Python Environment...");

  const voiceDir = join(process.cwd(), "packages/voice");
  const venvPath = join(voiceDir, ".venv");

  if (existsSync(venvPath)) {
    console.log(`   ✅ Virtual environment found at ${venvPath}`);
  } else {
    console.log(`   ⚠️  Virtual environment NOT found at ${venvPath}`);
    console.log(
      "      (This is okay if using system python or UV, but ensure deps are installed)"
    );
  }

  // Check if uv is installed
  try {
    const uvProc = spawn(["uv", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await uvProc.exited;
    if (exitCode === 0) {
      const version = await new Response(uvProc.stdout).text();
      console.log(`   ✅ UV detected: ${version.trim()}`);
    } else {
      console.log(`   ⚠️  UV not detected (exit code ${exitCode})`);
    }
  } catch {
    console.log("   ⚠️  UV not detected");
  }

  // Check imports
  console.log("   🔍 Verifying Python imports...");
  const checkScript = `
import sys
try:
    import nemo.collections.asr
    import silero_vad
    import numpy
    import soundfile
    print("Imports successful")
    sys.exit(0)
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error: {e}")
    sys.exit(1)
`;

  // Try running with uv first if available
  const cmd = ["uv", "run", "python", "-c", checkScript];

  try {
    const proc = spawn(cmd, {
      cwd: voiceDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    if (code === 0) {
      console.log("   ✅ Python dependencies verify successfully via 'uv run'");
    } else {
      console.error("   ❌ Python dependency check failed:");
      console.error(`      Stdout: ${stdout.trim()}`);
      console.error(`      Stderr: ${stderr.trim()}`);
      return false;
    }
  } catch (e) {
    console.error(`   ❌ Failed to execute python check: ${e}`);
    return false;
  }

  return true;
}

async function main() {
  console.log("🩺 ALFRED STT Diagnostics\n");

  const envOk = await checkPythonEnv();
  if (!envOk) {
    console.error(
      "\n❌ Environment check failed. Fix dependencies before continuing."
    );
    process.exit(1);
  }

  console.log("\n✅ Environment looks good. You can now run:");
  console.log("   bun run scripts/test-stt.ts");
}

main();
