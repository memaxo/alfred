import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ensureServer,
  __internals as serverRegistry,
  stopAllServers,
} from "@alfred/agent/orchestrator/tool/shared/server";
import type { WorkflowEvent } from "@alfred/type/plan";
import {
  type OrchestratorDeps,
  runOrchestrator,
} from "../src/orchestrator/index";

const tempDirs: string[] = [];

async function drain(
  iterator: AsyncGenerator<WorkflowEvent, void, void>
): Promise<WorkflowEvent[]> {
  const events: WorkflowEvent[] = [];
  while (true) {
    const next = await iterator.next();
    if (next.done) {
      break;
    }
    events.push(next.value);
  }
  return events;
}

function makeDeps(args: {
  escalated?: boolean;
  throwInWaves?: boolean;
}): OrchestratorDeps {
  return {
    runWaves: async function* () {
      yield { _: "notice", message: "waves_started" } as WorkflowEvent;
      if (args.throwInWaves) {
        throw new Error("waves_failed");
      }
      return {
        trackerState: { agents: {}, waves: {} },
        allAgentOutcomes: [],
        agentFileHints: new Map<string, Set<string>>(),
        activeWorkspaces: [] as Array<{
          cleanup: () => Promise<void>;
          id: string;
        }>,
        aborted: false,
        interrupted: false,
        suspended: false,
        escalated: args.escalated === true,
        escalationReason: args.escalated ? "test_escalation" : undefined,
      };
    } as any,
    runMergePhase: async function* () {
      yield { _: "notice", message: "merge_started" } as WorkflowEvent;
      return { mergePlan: {}, conflictScanResult: null };
    } as any,
    runConflictPhase: async function* () {
      yield { _: "notice", message: "conflict_started" } as WorkflowEvent;
      return;
    } as any,
    runMergeAnalysis: async function* () {
      yield { _: "notice", message: "merge_analysis_started" } as WorkflowEvent;
      return;
    } as any,
    runReviewPhase: async function* () {
      yield { _: "notice", message: "review_started" } as WorkflowEvent;
      return;
    } as any,
  } satisfies OrchestratorDeps;
}

describe("runOrchestrator executor server cleanup", () => {
  beforeEach(() => {
    serverRegistry.reset();
  });

  afterEach(async () => {
    await stopAllServers("test_end");
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("stops executor servers on normal completion", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-cleanup-"));
    tempDirs.push(workspace);

    const stop = mock(async (_reason?: string) => {});
    await ensureServer({
      key: "agentfs:test:codex:server",
      start: async () => ({ stop }),
    });

    await drain(
      runOrchestrator(
        { requirement: "noop", auto: "low", workspace },
        "run-cleanup-success",
        new AbortController().signal,
        undefined,
        null,
        undefined,
        undefined,
        null,
        undefined,
        makeDeps({})
      )
    );

    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.calls[0]?.[0]).toBe("workflow_complete");
  });

  it("stops executor servers on escalation early-return", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-cleanup-"));
    tempDirs.push(workspace);

    const stop = mock(async (_reason?: string) => {});
    await ensureServer({
      key: "agentfs:test:opencode:server",
      start: async () => ({ stop }),
    });

    const events = await drain(
      runOrchestrator(
        { requirement: "noop", auto: "low", workspace },
        "run-cleanup-escalated",
        new AbortController().signal,
        undefined,
        null,
        undefined,
        undefined,
        null,
        undefined,
        makeDeps({ escalated: true })
      )
    );

    expect(
      events.some((e) => (e as any).message === "workflow_escalated")
    ).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.calls[0]?.[0]).toBe("workflow_complete");
  });

  it("stops executor servers when waves throws (error path)", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "orch-cleanup-"));
    tempDirs.push(workspace);

    const stop = mock(async (_reason?: string) => {});
    await ensureServer({
      key: "agentfs:test:codex:server",
      start: async () => ({ stop }),
    });

    let threw = false;
    try {
      await drain(
        runOrchestrator(
          { requirement: "noop", auto: "low", workspace },
          "run-cleanup-error",
          new AbortController().signal,
          undefined,
          null,
          undefined,
          undefined,
          null,
          undefined,
          makeDeps({ throwInWaves: true })
        )
      );
    } catch (err: any) {
      threw = true;
      expect(String(err?.message ?? err)).toContain("waves_failed");
    }

    expect(threw).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.calls[0]?.[0]).toBe("workflow_complete");
  });
});
