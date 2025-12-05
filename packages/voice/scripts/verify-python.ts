#!/usr/bin/env bun
/**
 * Python Environment Verification Script (for CI)
 *
 * This script verifies that the Python environment is healthy.
 * Use it in CI to fail fast if the environment is corrupted.
 *
 * Usage:
 *   bun run packages/voice/scripts/verify-python.ts
 *
 * Exit codes:
 *   0 - Python environment is healthy
 *   1 - Python environment is corrupted
 */

import { ciVerifyPythonEnvironment } from "../test/utils/python-helpers";

async function main(): Promise<void> {
  try {
    await ciVerifyPythonEnvironment();
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      // Error message already printed by ciVerifyPythonEnvironment
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
