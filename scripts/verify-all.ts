/**
 * Smoke Test: Full Loop
 *
 * Runs all verification scripts in sequence.
 */

import { spawn } from "bun";

const scripts = [
  "verify-orchestrator.ts",
  "verify-resilience.ts",
  "verify-voice-runtime.ts",
];

async function main() {
  console.log("🚀 Starting Full Smoke Test...");

  for (const script of scripts) {
    console.log(`\n--- Running ${script} ---`);
    const proc = spawn(["bun", `scripts/${script}`], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`\n❌ ${script} FAILED with code ${exitCode}`);
      process.exit(exitCode);
    }
  }

  console.log("\n✅ All smoke tests PASSED.");
}

if (import.meta.main) {
  main();
}
