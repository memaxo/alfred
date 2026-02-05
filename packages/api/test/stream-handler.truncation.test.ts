import type { UIMessage } from "ai";

import { describe, expect, it, mock, vi } from "bun:test";

const createMessageMock = vi.fn(async () => ({ id: "db-1" }));
mock.module("@alfred/db/repo/conversation", () => ({
  createMessage: createMessageMock,
}));

const kvSetMock = vi.fn(async () => {});
const closeMock = vi.fn(async () => {});
mock.module("@alfred/agent/agentfs", () => ({
  createRunAgentFS: vi.fn(async () => ({
    close: closeMock,
    kv: {
      set: kvSetMock,
    },
  })),
}));

const { __test } = await import("../src/stream-handler");

function repeat(s: string, n: number): string {
  return Array.from({ length: n }, () => s).join("");
}

describe("persistMessages tool truncation", () => {
  it("truncates oversized tool-result payloads before DB write and stores in AgentFS", async () => {
    createMessageMock.mockClear();
    kvSetMock.mockClear();
    closeMock.mockClear();

    const huge = repeat("0123456789 ", 50_000);
    const msg: UIMessage = {
      id: "m-1",
      role: "assistant",
      parts: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "core_git",
          output: { stdout: huge },
        } as any,
      ],
    };

    await __test.persistMessages({
      conversationId: "conv-1",
      existingMessageIds: new Set(),
      messages: [msg],
      modelId: "openai/gpt-4o-mini",
      source: "assistant",
      userId: "user-1",
    });

    expect(kvSetMock).toHaveBeenCalledTimes(1);
    expect(createMessageMock).toHaveBeenCalledTimes(1);
    const args = createMessageMock.mock.calls[0] as unknown as [
      string,
      string,
      UIMessage,
    ];
    const persisted = args?.[2] ?? null;
    expect(persisted).not.toBeNull();
    const part = (persisted as UIMessage).parts?.[0] as any;
    expect(part.type).toBe("tool-result");
    expect(part.output?.summaryText).toContain("Truncated tool result");
    expect(part.output?.ref).toMatchObject({
      kind: "agentfs_kv",
      runId: "conv-1",
    });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
