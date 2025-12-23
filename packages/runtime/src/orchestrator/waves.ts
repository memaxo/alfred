import { realpathSync } from "node:fs";
import * as path from "node:path";
import type { Workspace } from "@alfred/agent/environment/types";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
import type {
  AgentSpec,
  WavePlan,
} from "@alfred/agent/orchestrator/multi/spawn";
import {
  buildAgentSpec,
  planWaves,
} from "@alfred/agent/orchestrator/multi/spawn";
import {
  type TrackerContext,
  createTrackerContext,
} from "@alfred/agent/orchestrator/multi/tracker";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../context";
import { AsyncQueue, pLimit } from "../utils/concurrency";
import { runAgent, type AgentOutcome } from "./agent";
import { appendPlanProgressEntry, appendDecisionEntry } from "./execplan";
import { hydrateTrackerContext } from "./hydrate";
import type { OrchestratorContext } from "./types";

export type WavesResult = {
  trackerContext: TrackerContext;
  allAgentOutcomes: AgentOutcome[];
  agentFileHints: Map<string, Set<string>>;
  activeWorkspaces: Workspace[];
  aborted: boolean;
  interrupted?: boolean;
  escalated?: boolean;
  escalationReason?: string;
};

export async function* runWaves(
  ctx: OrchestratorContext
): AsyncGenerator<WorkflowEvent, WavesResult, void> {
  const {
    input,
    runId,
    signal,
    workspace,
    history,
    projectConfig,
    escalationContext,
    authz,
    scanContext,
    userId,
  } = ctx;

  const agentFileHints = new Map<string, Set<string>>();
  const agentSubTaskIds = new Map<string, string>();
  const activeWorkspaces: Workspace[] = [];
  const rootExecPlanPath = path.resolve(
    workspace,
    `.agent/plans/${runId}.root.md`
  );
  const workspaceRoot = realpathSync(workspace);

  const hasEscalationContext = Boolean(
    escalationContext && escalationContext.trim().length > 0
  );
  const cachedExecutionContext = hasEscalationContext
    ? null
    : (scanContext ?? null);

  const effectiveRequirement = hasEscalationContext
    ? `${input.requirement}\n\nESCALATION CONTEXT: ${escalationContext}`
    : input.requirement;

  // Build or reuse execution context
  let context;
  if (cachedExecutionContext) {
    context = cachedExecutionContext;
    yield {
      type: "notice",
      message: "waves_using_cached_context",
    } as WorkflowEvent;
  } else {
    const builder = new ContextBuilder();
    context = await builder.build({
      requirement: effectiveRequirement,
      workspace,
      repoBase: input.repoBase,
      web: input.context?.web,
      topK: input.context?.topK,
      maxTokens: input.context?.maxTokens,
      exts: input.context?.exts,
      ignore: input.context?.ignore,
      seeds: input.context?.seeds,
      authz: undefined,
      userId,
    });
  }

  if (!ctx.scanContext) {
    ctx.scanContext = context;
  }

  // Decompose into subtasks
  const subTasks: SubTask[] = decomposeTask(input.requirement, {
    requirement: effectiveRequirement,
    bundle: context.bundle,
  });

  if (subTasks.length === 0) {
    yield { type: "notice", message: "no_subtasks_to_execute" } as any;
    return {
      trackerContext: createTrackerContext([]),
      allAgentOutcomes: [],
      agentFileHints,
      activeWorkspaces,
      aborted: false,
      interrupted: false,
    };
  }

  // Hydrate tracker context with subtask dependencies
  const trackerContext = hydrateTrackerContext(history, subTasks);
  const trackerContextRef = { current: trackerContext };

  const subTaskById = new Map<string, SubTask>(subTasks.map((t) => [t.id, t]));
  const maxParallelRaw = Number.parseInt(
    process.env.ORCHESTRATOR_MAX_PARALLEL || "2",
    10
  );
  const maxParallel = Number.isFinite(maxParallelRaw)
    ? Math.max(1, maxParallelRaw)
    : 2;
  const waves: WavePlan[] = planWaves(subTasks, { maxParallel });

  if (waves.length === 0) {
    waves.push({
      id: "wave_0",
      agents: subTasks.map((t) => t.id),
      dependsOn: [],
    });
  }

  // Track aggregate failure rates for abort heuristics
  let totalAgents = 0;
  let totalFailedOrStuck = 0;
  let abortedWave: {
    id: string;
    waveFailRate: number;
    overallFailRate: number;
  } | null = null;

  let escalationTrigger: { reason: string } | null = null;
  let hasInterruptedAgents = false;

  const allAgentOutcomes: AgentOutcome[] = [];

  for (const wave of waves) {
    if (signal.aborted) {
      throw new DOMException("Phase aborted", "AbortError");
    }

    // Skip already completed waves (hydration)
    if (trackerContextRef.current.state.waves[wave.id]?.status === "completed") {
      logger.info("wave_hydrated_skipping", { waveId: wave.id });
      yield {
        type: "notice",
        message: `wave_${wave.id}_skipped_already_completed`,
      } as any;
      continue;
    }

    logger.info("multi_agent_wave_start", {
      runId,
      waveId: wave.id,
      agentCount: wave.agents.length,
    });

    yield {
      type: "notice",
      message: `wave_${wave.id}_start`,
    } as any;

    const agentSpecs: AgentSpec[] = wave.agents
      .map((id: string): AgentSpec | null => {
        const task = subTaskById.get(id);
        if (!task) {
          return null;
        }
        const spec = buildAgentSpec(task, runId, workspace, {
          auto: input.auto,
          maxParallel,
          linear: input.linear
            ? {
                issueId: input.linear.issueId,
                sessionId: input.linear.sessionId,
                space: input.linear.space,
                authz: input.linear.authz,
              }
            : undefined,
        });
        agentSubTaskIds.set(spec.agentId, spec.subTaskId);
        return spec;
      })
      .filter((spec: AgentSpec | null): spec is AgentSpec => spec !== null);

    yield {
      type: "event",
      kind: "data-wave-plan",
      data: {
        waveId: wave.id,
        agents: agentSpecs,
        dependsOn: wave.dependsOn,
      },
    } as any;

    await appendPlanProgressEntry(
      rootExecPlanPath,
      `Wave ${wave.id} started with ${agentSpecs.length} agent(s).`,
      false
    );

    trackerContextRef.current.state.waves[wave.id] = { status: "running" };

    // Concurrent Execution using pLimit and AsyncQueue
    const queue = new AsyncQueue<WorkflowEvent>();
    const limit = pLimit(maxParallel);

    const agentPromises = agentSpecs.map((spec) =>
      limit(async () => {
        try {
          return await runAgent({
            spec,
            runId,
            workspace,
            workspaceRoot,
            subTaskById,
            projectConfig,
            activeWorkspaces,
            agentFileHints,
            rootExecPlanPath,
            signal,
            authz,
            userId,
            trackerContextRef,
            queue,
          });
        } catch (error) {
          logger.error("agent_unhandled_error", {
            runId,
            agentId: spec.agentId,
            error: error instanceof Error ? error.message : String(error),
          });
          queue.enqueue({
            type: "notice",
            message: `agent_failed_unhandled:${spec.agentId}`,
          } as any);
          return {
            agentId: spec.agentId,
            stuck: false,
            status: "failed",
            durationSeconds: 0,
            role: "codex",
            escalation: undefined,
            result: {
              summary: "agent failed (unhandled error)",
              artifacts: [],
              changes: [],
              notes: [],
            },
          } as AgentOutcome;
        }
      })
    );

    const allAgentsDone = Promise.all(agentPromises).finally(() => {
      queue.close();
    });

    // Stream events from queue
    for await (const ev of queue) {
      yield ev;
    }

    const agentOutcomes = await allAgentsDone;

    // Process outcomes
    for (const outcome of agentOutcomes) {
      if (outcome.status === "interrupted") {
        hasInterruptedAgents = true;
      }
      if (outcome.escalation) {
        escalationTrigger = { reason: outcome.escalation };
      }
    }

    const anyStuck = agentOutcomes.some((o) => o.stuck);
    trackerContextRef.current.state.waves[wave.id] = {
      status: anyStuck ? "failed" : "completed",
    } as any;

    logger.info("multi_agent_wave_result", {
      runId,
      waveId: wave.id,
      status: anyStuck ? "partial" : "completed",
      agentCount: agentOutcomes.length,
      failedOrStuck: agentOutcomes.filter(
        (o) => o.stuck || o.status === "failed" || o.status === "stuck"
      ).length,
    });

    yield {
      type: "event",
      kind: "wave-result",
      data: {
        waveId: wave.id,
        status: anyStuck ? "partial" : "completed",
        agents: agentOutcomes,
      },
    } as any;

    await appendPlanProgressEntry(
      rootExecPlanPath,
      `Wave ${wave.id} ${anyStuck ? "completed with blockers" : "completed successfully"}.`,
      !anyStuck
    );
    if (anyStuck) {
      await appendDecisionEntry(
        rootExecPlanPath,
        `Wave ${wave.id} encountered blockers`,
        "One or more agents were stuck or failed; review subtask ExecPlans for details."
      );
    }

    // Stop waves if escalated
    if (escalationTrigger) {
      break;
    }

    const waveTotal = agentOutcomes.length;
    const waveFailedOrStuck = agentOutcomes.filter((o) => {
      const status = o.status;
      return o.stuck || status === "failed" || status === "stuck";
    }).length;

    totalAgents += waveTotal;
    totalFailedOrStuck += waveFailedOrStuck;

    allAgentOutcomes.push(...agentOutcomes);

    const waveFailRate = waveTotal > 0 ? waveFailedOrStuck / waveTotal : 0;
    const overallFailRate =
      totalAgents > 0 ? totalFailedOrStuck / totalAgents : 0;

    if (waveFailRate > 0.5 || overallFailRate > 0.4) {
      abortedWave = {
        id: wave.id,
        waveFailRate,
        overallFailRate,
      };
      logger.warn("multi_agent_wave_aborted", {
        runId,
        waveId: wave.id,
        waveFailRate,
        overallFailRate,
      });
      break;
    }
  }

  if (abortedWave) {
    yield {
      type: "event",
      kind: "wave-aborted",
      data: {
        waveId: abortedWave.id,
        waveFailRate: abortedWave.waveFailRate,
        overallFailRate: abortedWave.overallFailRate,
      },
    } as any;

    await appendDecisionEntry(
      rootExecPlanPath,
      `Wave ${abortedWave.id} aborted`,
      `Wave fail rate ${abortedWave.waveFailRate.toFixed(2)}, overall ${abortedWave.overallFailRate.toFixed(2)}`
    );

    // Cleanup worktrees on abort
    for (const ws of activeWorkspaces) {
      try {
        await ws.cleanup();
      } catch {
        /* ignore */
      }
    }
  }

  return {
    trackerContext: trackerContextRef.current,
    allAgentOutcomes,
    agentFileHints,
    activeWorkspaces,
    aborted: !!abortedWave,
    interrupted: hasInterruptedAgents,
    escalated: !!escalationTrigger,
    escalationReason: escalationTrigger?.reason,
  };
}

// Re-export for backwards compatibility
export { hydrateTrackerContext } from "./hydrate";
