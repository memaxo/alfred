import type { PipelineEvent } from "@alfred/pipeline";

import { attentionRepo, clarificationRepo, deltaRepo } from "@alfred/db";

// Establish the standard API test mocks (includes @alfred/db shim).
import "./utils/mock-db-client";
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

describe("concierge persistence (db-shim)", () => {
  let upsertAttentionItem: typeof import("../src/services/attention").upsertAttentionItem;
  let ConciergeObserver: typeof import("../src/services/concierge").ConciergeObserver;

  beforeAll(async () => {
    ({ upsertAttentionItem } = await import("../src/services/attention"));
    ({ ConciergeObserver } = await import("../src/services/concierge"));
  });

  beforeEach(async () => {
    // The db shim persists in-module stores; clear by filtering on test user IDs.
    // Ensure our clarification repo has a clean default.
    clarificationRepo.listRequestsByRunId = async () => [];
  });

  test("upsertAttentionItem dedupes by userId+workflowRunId+kind", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await upsertAttentionItem({
      userId,
      workflowRunId: "run-1",
      kind: "pipeline_suspend:clarification",
      urgency: "high",
      title: "Workflow needs input",
      body: "clarification",
      payload: { runId: "run-1" },
    });

    await upsertAttentionItem({
      userId,
      workflowRunId: "run-1",
      kind: "pipeline_suspend:clarification",
      urgency: "high",
      title: "Workflow needs input",
      body: "clarification",
      payload: { runId: "run-1" },
    });

    const rows = await attentionRepo.listAttentionItems({
      userId,
      kind: "pipeline_suspend:clarification",
      status: "open",
      workflowRunId: "run-1",
      limit: 10,
      offset: 0,
    });
    expect(rows).toHaveLength(1);
  });

  test("ConciergeObserver writes attention on suspend and delta on complete", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const runId = `run-${crypto.randomUUID()}`;

    clarificationRepo.listRequestsByRunId = async () => [
      {
        id: `clar-${crypto.randomUUID()}`,
        runId,
        phaseId: "phase-1",
        agentId: "agent-1",
        question: "Which option?",
        options: [{ id: "a", label: "A" }],
        response: null,
        createdAt: new Date(),
      },
    ];

    const pending: Promise<unknown>[] = [];
    const fire = (p: Promise<unknown>) => {
      pending.push(p);
    };

    const obs = new ConciergeObserver({ userId, runId, fire });

    const e1: PipelineEvent = {
      type: "pipeline:suspend",
      reason: "clarification",
      timestamp: 1,
    };
    const e2: PipelineEvent = {
      type: "pipeline:complete",
      summary: {
        runId,
        requirement: "test",
        stages: [],
        totalDurationMs: 1,
        agentsSpawned: 0,
        filesChanged: 0,
        learningInsights: 0,
      },
      summaryText: "Done.",
      timestamp: 2,
    };

    obs.onEvent(e1);
    obs.onEvent(e2);

    await Promise.allSettled(pending);

    const attention = await attentionRepo.listAttentionItems({
      userId,
      status: "open",
      workflowRunId: runId,
      limit: 10,
      offset: 0,
    });
    expect(attention).toHaveLength(1);

    const deltas = await deltaRepo.listDeltaBriefs({
      userId,
      scope: "workflow_run",
      workflowRunId: runId,
      limit: 10,
      offset: 0,
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.scope).toBe("workflow_run");
  });
});
