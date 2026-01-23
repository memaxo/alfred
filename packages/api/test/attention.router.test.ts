import { describe, expect, test } from "bun:test";
import { attentionRepo } from "@alfred/db";
import { createTestCaller } from "./utils/trpc";

describe("attention router", () => {
  test("lists and resolves attention items", async () => {
    const caller = await createTestCaller({ userId: "test-user" });

    const item = await attentionRepo.createAttentionItem({
      userId: "test-user",
      kind: "pipeline_suspend:clarification",
      status: "open",
      urgency: "high",
      title: "Clarification needed",
      body: "Which option?",
      workflowRunId: null,
      focusSetId: null,
      commitmentId: null,
      payload: { question: "Which option?" },
    });

    const list = await caller.attention.list({ status: "open" });
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(item.id);

    await caller.attention.resolve({ id: item.id });

    const after = await caller.attention.list({ status: "resolved" });
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(item.id);
  });
});

