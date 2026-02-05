import type { UIMessage } from "@alfred/type/stream";

import { afterAll, beforeAll, describe, expect, it, mock, vi } from "bun:test";

const summarizeMock = vi.fn(async (_text: string) => ({
  text: "MOCK_SUMMARY",
  compressedTokens: 10,
  compressionRatio: 0.1,
  metadata: { method: "mock" },
  originalTokens: 100,
}));

mock.module("@alfred/summarize", () => ({
  summarize: summarizeMock,
}));

import { compressHistoryMessages } from "../src/compression";

function makeMsg(
  id: number,
  role: "user" | "assistant",
  text: string
): UIMessage {
  return {
    id: `m-${id}`,
    role,
    parts: [{ type: "text", text }],
  } as any;
}

function longText(label: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `${label}-${i}`).join(" ");
}

describe("compressHistoryMessages", () => {
  const prevOffline = process.env.ALFRED_SUMMARIZE_OFFLINE;

  beforeAll(() => {
    process.env.ALFRED_SUMMARIZE_OFFLINE = "1";
  });

  afterAll(() => {
    process.env.ALFRED_SUMMARIZE_OFFLINE = prevOffline;
  });

  it("keeps the last 10 messages unchanged when compression triggers", async () => {
    const messages: UIMessage[] = [];
    for (let i = 0; i < 30; i += 1) {
      messages.push(
        makeMsg(i, i % 2 === 0 ? "user" : "assistant", longText(`msg${i}`, 200))
      );
    }

    const tail = messages.slice(-10).map((m) => (m.parts?.[0] as any)?.text);

    const res = await compressHistoryMessages({
      budgetTokens: 2000,
      messages,
      modelId: "openai/gpt-4o-mini",
      source: "test",
      thresholdRatio: 0.92,
    });

    expect(res.changed).toBe(true);
    const nextTail = res.messages
      .slice(-10)
      .map((m) => (m.parts?.[0] as any)?.text);
    expect(nextTail).toEqual(tail);
  });

  it("does not compress when under threshold", async () => {
    const messages: UIMessage[] = [];
    for (let i = 0; i < 12; i += 1) {
      messages.push(makeMsg(i, "user", "short message"));
    }

    const res = await compressHistoryMessages({
      budgetTokens: 50_000,
      messages,
      modelId: "openai/gpt-4o-mini",
      source: "test",
      thresholdRatio: 0.92,
    });
    expect(res.changed).toBe(false);
    expect(res.method).toBe("none");
  });

  it("caches rolling summaries (second run does not call summarize again)", async () => {
    summarizeMock.mockClear();

    const messages: UIMessage[] = [];
    for (let i = 0; i < 70; i += 1) {
      messages.push(
        makeMsg(i, i % 2 === 0 ? "user" : "assistant", longText(`msg${i}`, 120))
      );
    }

    const args = {
      budgetTokens: 2500,
      messages,
      modelId: "openai/gpt-4o-mini",
      source: "test",
      thresholdRatio: 0.92,
    } as const;

    const r1 = await compressHistoryMessages(args);
    const r2 = await compressHistoryMessages(args);

    expect(r1.changed).toBe(true);
    expect(r2.changed).toBe(true);
    expect(summarizeMock).toHaveBeenCalledTimes(1);
  });
});
