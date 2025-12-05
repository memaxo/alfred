#!/usr/bin/env bun
/**
 * Python Environment Repair Script
 *
 * Use this script to repair a corrupted Python environment.
 *
 * Usage:
 *   bun run packages/voice/scripts/repair-python.ts
 *
 * This script will:
 *   1. Check if Python environment is healthy
 *   2. If corrupted, remove the venv and recreate it
 *   3. Verify the repair was successful
 */

import {
  attemptPythonRepair,
  verifyVoicePythonHealth,
} from "../test/utils/python-helpers";

async function main(): Promise<void> {
  console.log("🔍 Python Environment Repair Tool");
  console.log(
    "══════════════════════════════════════════════════════════════\n"
  );

  // Check current health
  console.log("Step 1: Checking current Python environment...\n");
  const initialHealth = await verifyVoicePythonHealth();

  if (initialHealth.healthy) {
    console.log("✅ Python environment is already healthy!");
    console.log(`   Version: ${initialHealth.version}`);
    console.log(`   Path: ${initialHealth.pythonPath}`);
    process.exit(0);
  }

  console.log("❌ Python environment is corrupted:");
  console.log(`   Path: ${initialHealth.pythonPath}`);
  console.log(`   Error: ${initialHealth.error}`);
  console.log("");

  // Attempt repair
  console.log("Step 2: Attempting repair...\n");
  const repair = await attemptPythonRepair();

  if (repair.repaired) {
    console.log("");
    console.log(
      "══════════════════════════════════════════════════════════════"
    );
    console.log(`✅ ${repair.message}`);
    console.log(
      "══════════════════════════════════════════════════════════════"
    );
    process.exit(0);
  }

  console.log("");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("❌ REPAIR FAILED");
  console.log(`   ${repair.message}`);
  console.log("");
  console.log("Manual steps to fix:");
  console.log("  1. rm -rf packages/voice/.venv");
  console.log("  2. cd packages/voice && uv sync");
  console.log("══════════════════════════════════════════════════════════════");
  process.exit(1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
