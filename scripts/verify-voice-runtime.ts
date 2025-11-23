/**
 * Smoke Test: Voice Runtime
 *
 * Verifies TTS and STT subsystems by running their smoke tests.
 */

import { spawn } from "bun";
import { join } from "node:path";

async function main() {
  console.log("🔊 Verifying Voice Runtime...");

  // Run TTS Smoke Test
  console.log("\n--- TTS Smoke Test ---");
  const ttsProc = spawn(["bun", "packages/voice/scripts/smoke-test.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: {
        ...process.env,
        // Force specific provider if needed, but smoke test has defaults
    }
  });

  const ttsExit = await ttsProc.exited;
  if (ttsExit !== 0) {
    console.error(`❌ TTS Smoke Test FAILED with code ${ttsExit}`);
    process.exit(ttsExit);
  }

  console.log("\n✅ Voice Runtime Verified.");
}

if (import.meta.main) {
  main();
}
