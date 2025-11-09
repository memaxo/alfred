import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { createTestCaller, resetAllMocks, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();

// Lower the per-minute limit for test
process.env.ROUTE_RATE_LIMIT_PER_MINUTE = "2";

const generateTextMock = vi.fn();
const persistResultMock = vi.fn();

mock.module("@alfred/api/ai/generate", () => ({
  generateText: generateTextMock,
  persistResult: persistResultMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({ roles: ["user"], scopes: ["assistant.write"] });
});

afterEach(() => {
  resetAllMocks();
});

describe("rate limiter", () => {
  it("limits assistant.generate beyond per-minute threshold", async () => {
    generateTextMock.mockResolvedValue({ text: "ok" });
    persistResultMock.mockResolvedValue(null);

    const payload = {
      messages: [
        {
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "hi" }],
        },
      ],
    } as any;

    await caller.assistant.generate(payload);
    await caller.assistant.generate(payload);
    await expect(caller.assistant.generate(payload)).rejects.toThrow(/rate_limited/i);
  });
});

