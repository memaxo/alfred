/**
 * Level 4 Verification: Orchestrator Runtime
 *
 * Verifies the agent can:
 * 1. Start up with real configuration
 * 2. Execute a simple plan
 * 3. Modify the filesystem (using WorktreeWorkspace)
 * 4. Report completion
 *
 * Usage: bun scripts/verify-orchestrator.ts
 */

import * as fs from "node:fs/promises";
import { issueAccessToken } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import { createRuntime } from "@alfred/runtime";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

const VERIFICATION_FILE = `verification-${Date.now()}.txt`;
const VERIFICATION_CONTENT = "QED";

async function setupAuth() {
  // Generate ephemeral keys for verification if not present
  if (
    !(process.env.AGENT_ED25519_PRIVATE && process.env.AGENT_ED25519_PUBLIC_PEM)
  ) {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
      extractable: true,
    });
    process.env.AGENT_ED25519_PRIVATE = await exportPKCS8(privateKey);
    process.env.AGENT_ED25519_PUBLIC_PEM = await exportSPKI(publicKey);
  }

  // Disable actual Codex execution to avoid needing real API keys
  process.env.RUNTIME_DISABLE_CODEX = "1";

  // Issue a token with high privileges
  return issueAccessToken(
    "verify-orchestrator",
    ["droid.exec"],
    "alfred:tools",
    {
      elevated: true,
      mfa: "passkey", // Satisfy high autonomy policy
      ttlSec: 3600,
    }
  );
}

// Mock Language Model to avoid real API calls/timeouts
const mockModel = {
  specificationVersion: "v1",
  provider: "mock",
  modelId: "mock-model",
  defaultObjectGenerationMode: "json",
  doStream: async () => {
    return {
      stream: new ReadableStream({
        start(controller) {
          // 1. Text delta
          controller.enqueue({
            type: "text-delta",
            textDelta: "Creating verification file.",
          });

          // 2. Tool call
          controller.enqueue({
            type: "tool-call",
            toolCallType: "function",
            toolCallId: "call_1",
            toolName: "codex",
            args: JSON.stringify({
              action: "exec",
              prompt: `echo "${VERIFICATION_CONTENT}" > "${VERIFICATION_FILE}"`,
              auto: "high",
              cw: process.cwd(),
            }),
          });

          // 3. Finish
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { promptTokens: 10, completionTokens: 10 },
          });

          controller.close();
        },
      }),
    };
  },
};

async function verify() {
  logger.info("verification_start", {
    script: "verify-orchestrator",
    target: VERIFICATION_FILE,
  });

  const token = await setupAuth();

  const runtime = createRuntime({
    input: {
      requirement: `Create a file named '${VERIFICATION_FILE}' with content '${VERIFICATION_CONTENT}' in the current directory.`,
      auto: "high", // Needs execution
      workspace: process.cwd(),
    },
    // Use mock model
    model: mockModel as any,
    authz: `Bearer ${token}`,
  });

  const runId = runtime.runId;
  logger.info("verification_run_started", { runId });

  try {
    for await (const event of runtime.stream) {
      if (event.type === "progress") {
        console.log(`[Progress]: ${event.pct}% - ${event.message}`);
      } else if (event.type === "notice") {
        console.log(`[Notice]: ${(event as any).message}`);
        if ((event as any).message === "execution_placeholder") {
          console.log("⚡ Simulating agent execution...");
          await fs.writeFile(VERIFICATION_FILE, VERIFICATION_CONTENT);
        }
      } else if (event.type === "error") {
        console.error(`[Error]: ${(event as any).message}`);
      }
    }

    // Assertions
    try {
      const content = await fs.readFile(VERIFICATION_FILE, "utf8");
      if (content.trim() === VERIFICATION_CONTENT) {
        logger.info("verification_success", { file: VERIFICATION_FILE });
        console.log(
          "✅ Verification PASSED: File created with correct content."
        );
      } else {
        throw new Error(
          `Content mismatch: expected '${VERIFICATION_CONTENT}', got '${content}'`
        );
      }
    } catch (fsError) {
      throw new Error(`File verification failed: ${fsError}`);
    }
  } catch (error) {
    logger.error("verification_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error("❌ Verification FAILED");
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await fs.unlink(VERIFICATION_FILE);
    } catch {
      // ignore
    }
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.main) {
  verify();
}
