import { describe, expect, test } from "bun:test";
import { deltaRepo } from "@alfred/db";
import { createTestCaller } from "./utils/trpc";

describe("delta router", () => {
  test("lists delta briefs", async () => {
    const caller = await createTestCaller({ userId: "test-user" });

    await deltaRepo.createDeltaBrief({
      userId: "test-user",
      scope: "workflow_run",
      workflowRunId: "run-1",
      focusSetId: null,
      commitmentId: null,
      summaryText: "Workflow completed.",
      data: null,
      sinceAt: null,
      untilAt: null,
    });

    const list = await caller.delta.list({ scope: "workflow_run" });
    expect(list).toHaveLength(1);
    expect(list[0]?.scope).toBe("workflow_run");
  });
});
