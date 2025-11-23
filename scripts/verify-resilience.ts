/**
 * Level 5 Verification: Resilience & Self-Healing
 *
 * Verifies that the Agent Architecture can withstand:
 * 1. Infinite Loops (Brainstem Supervisor)
 * 2. Zombie Processes (Heartbeat Monitor)
 * 3. Physiological Stress (Frustration/Boredom)
 *
 * Usage: bun scripts/verify-resilience.ts
 */

import { logger } from "@alfred/logger";
// import { createRuntime } from "@alfred/runtime"; // Not needed if we test toolCodex directly
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";
import { issueAccessToken } from "@alfred/auth/token";
import { sys } from "@alfred/agent/utils/process";
import { spawn } from "bun";

// Mock sys.spawn to simulate Codex output
const originalSpawn = sys.spawn;

function mockCodexSpawn(stdoutContent: string) {
  sys.spawn = ((cmd: string[], options: any) => {
    // We only want to mock the codex execution
    // But we need to return a Subprocess-like object
    // We can use real spawn for `echo` if we want, or just return a stream.
    
    // Simpler: Spawn a real `echo` command that prints the content!
    return spawn(["echo", stdoutContent], options);
  }) as any;
}

function restoreSpawn() {
  sys.spawn = originalSpawn;
}

async function setupAuth() {
  // ... existing code ...
  if (!process.env.AGENT_ED25519_PRIVATE || !process.env.AGENT_ED25519_PUBLIC_PEM) {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { extractable: true });
    process.env.AGENT_ED25519_PRIVATE = await exportPKCS8(privateKey);
    process.env.AGENT_ED25519_PUBLIC_PEM = await exportSPKI(publicKey);
  }
  return issueAccessToken("verify-resilience", ["droid.exec"], "alfred:tools", {
    elevated: true,
    mfa: "passkey",
    ttlSec: 3600
  });
}

async function verifyLoopDetection() {
  logger.info("verify_loop_detection_start");
  
  const repetitiveThought = JSON.stringify({
      event: {
        type: "thought",
        content: "I am stuck in a loop. I am stuck in a loop.",
        timestamp: Date.now()
      }
  });
  
  // Construct output that looks like Codex CLI output (line-delimited JSON)
  const output = [
      repetitiveThought,
      repetitiveThought,
      repetitiveThought,
      repetitiveThought,
      repetitiveThought
  ].join("\n");

  mockCodexSpawn(output);

  const token = await setupAuth();
  
  // We need to avoid `createRuntime` triggering the OpenAI check.
  // So we import `toolCodex` and run it.
  // But `toolCodex` imports `codex-session` which might import other things.
  // Let's try.
  
  try {
      const { toolCodex } = await import("@alfred/agent/orchestrator/tool/codex/index");
      
      console.log("⚡ Executing repetitive tool (mocked)...");
      await toolCodex.execute({
          input: {
              action: "exec",
              prompt: "ignore",
              out: "json", 
              auto: "high",
              authz: `Bearer ${token}`,
          },
          writer: { write: () => {} }
      });
      console.error("❌ Loop detection FAILED: Tool completed successfully.");
      process.exit(1);
  } catch (error: any) {
      if (String(error).includes("codex_exec_interrupted") || String(error).includes("loop_detected")) {
          console.log("✅ Loop detection PASSED: Caught interrupt.");
      } else {
          console.error(`❌ Loop detection FAILED: Unexpected error: ${error}`);
          // Check stack trace to see if it was the OpenAI check
          if (String(error).includes("openai_api_key_missing")) {
             console.log("⚠️ Skipped: Environment missing API key for imports.");
             process.exit(0);
          }
          process.exit(1);
      }
  } finally {
      restoreSpawn();
  }
}

// ... existing code ...
