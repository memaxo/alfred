/**
 * OpenAI VCR Integration Test
 *
 * Tests that make actual OpenAI API calls and record them with VCR.
 * Run with VCR_RECORD=1 to capture new responses.
 *
 * Requires OPENAI_API_KEY to be set in environment.
 */

// Preserve the real OPENAI_API_KEY before test utils overwrite it
const REAL_OPENAI_KEY = process.env.OPENAI_API_KEY;

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
// Set correct model format for OpenAI API
process.env.AI_MODEL = "gpt-4o-mini";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import path from "node:path";

const cassettePath = path.join(
  import.meta.dir,
  "__cassettes__",
  "openai-responses.json"
);

let createVCR: typeof import("@alfred/test-kit/vcr").createVCR;
let vcr: Awaited<ReturnType<typeof createVCR>>;
let createTestCaller: typeof import("../utils/trpc").createTestCaller;

beforeAll(async () => {
  // Load VCR
  ({ createVCR } = await import("@alfred/test-kit/vcr"));

  // Create and start VCR
  vcr = createVCR({
    cassettePath,
    strictReplay: false, // Allow passthrough if no recording
  });
  await vcr.start();

  // Load test utilities (this may overwrite OPENAI_API_KEY)
  ({ createTestCaller } = await import("../utils/trpc"));

  // Restore real OpenAI key for VCR recording
  if (REAL_OPENAI_KEY) {
    process.env.OPENAI_API_KEY = REAL_OPENAI_KEY;
    console.log("Using real OpenAI API key for VCR recording");
  } else {
    console.warn("No OPENAI_API_KEY found - tests will fail in record mode");
  }

  console.log(`VCR mode: ${vcr.getMode()}`);
});

afterAll(async () => {
  console.log(`VCR recorded ${vcr?.getInteractionCount()} interactions`);
  await vcr?.stop();
});

describe("OpenAI API with VCR", () => {
  it("records assistant.generate response", async () => {
    const caller = await createTestCaller({
      userId: "vcr-test-user",
      roles: ["owner"],
      scopes: ["assistant.read", "assistant.write"],
    });

    const result = await caller.assistant.generate({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Say hello in one word." }],
        },
      ],
    });

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    console.log(`Assistant response: ${result.text}`);
  });

  it("records multi-turn conversation", async () => {
    const caller = await createTestCaller({
      userId: "vcr-test-user",
      roles: ["owner"],
      scopes: ["assistant.read", "assistant.write"],
    });

    // First turn
    const result1 = await caller.assistant.generate({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "What is 2+2? Answer with just the number." }],
        },
      ],
    });

    expect(result1.text).toBeDefined();
    console.log(`Turn 1: ${result1.text}`);

    // Second turn
    const result2 = await caller.assistant.generate({
      messages: [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "What is 2+2? Answer with just the number." }],
        },
        {
          id: "msg-2",
          role: "assistant",
          parts: [{ type: "text", text: result1.text }],
        },
        {
          id: "msg-3",
          role: "user",
          parts: [{ type: "text", text: "Now multiply that by 3. Just the number." }],
        },
      ],
    });

    expect(result2.text).toBeDefined();
    console.log(`Turn 2: ${result2.text}`);
  });
});
