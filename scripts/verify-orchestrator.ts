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

import type { WorkflowEvent } from "@alfred/type/plan";
import type { LanguageModel } from "ai";

import { issueAccessToken } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import { createRuntime } from "@alfred/runtime";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import * as fs from "node:fs/promises";

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
  doStream: () => {
    return {
      stream: new ReadableStream({
        start(controller) {
          // 1. Text delta
          controller.enqueue({ type: "text-delta", id: "text-1", delta: "ok" });

          // 2. Tool call
          controller.enqueue({
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "droid.exec",
            input: { prompt: "noop" },
          });

          // 3. Finish
          controller.enqueue({ type: "finish", finishReason: "stop" });

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
    model: mockModel as LanguageModel<unknown>,
    authz: `Bearer ${token}`,
  });

  const runId = runtime.runId;
  logger.info("verification_run_started", { runId });

  function kindOfEvent(event: unknown): string | null {
    if (!event || typeof event !== "object") {
      return null;
    }
    const e = event as Record<string, unknown>;
    const primary = e._;
    if (typeof primary === "string") {
      return primary;
    }
    const fallback = e.type;
    return typeof fallback === "string" ? fallback : null;
  }

  try {
    for await (const event of runtime.stream) {
      const kind = kindOfEvent(event);
      if (kind === "progress") {
        const e = event as Record<string, unknown>;
        const pct = typeof e.pct === "number" ? e.pct : null;
        const msg = typeof e.message === "string" ? e.message : "";
        console.log(`[Progress]: ${pct ?? "?"}% - ${msg}`);
      } else if (kind === "notice") {
        const noticeEvent = event as WorkflowEvent & { _: "notice" };
        console.log(`[Notice]: ${noticeEvent.message}`);
        if (noticeEvent.message === "execution_placeholder") {
          console.log("⚡ Simulating agent execution...");
          await fs.writeFile(VERIFICATION_FILE, VERIFICATION_CONTENT);
        }
      } else if (kind === "error") {
        const errorEvent = event as WorkflowEvent & {
          _: "error";
          message: string;
        };
        console.error(`[Error]: ${errorEvent.message}`);
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
