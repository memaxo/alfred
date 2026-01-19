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
  createTrackerContext,
  type TrackerContext,
} from "@alfred/agent/orchestrator/multi/tracker";
import { rootPlanPath } from "@alfred/agent/orchestrator/plans";
import { logger } from "@alfred/logger";
import type { WorkflowEvent } from "@alfred/type/plan";
import { ContextBuilder } from "../context";
import { AsyncQueue, pLimit } from "../utils/concurrency";
import { type AgentOutcome, runAgent } from "./agent";
import { detectClarification } from "./clarify.js";
import { convertPlanToWavePlan } from "./convert.js";
import {
  makeAgentCompleteEvent,
  makeAgentStartEvent,
  makePhaseCompleteEvent,
  makePhaseProgressEvent,
  makePhaseStartEvent,
  makePlanSelectedEvent,
  makeWaveCompleteEvent,
  makeWaveStartEvent,
} from "./events.js";
import { appendDecisionEntry, appendPlanProgressEntry } from "./execplan";
import { flattenPhases } from "./flatten.js";
import { formatHandoffPrompt, generateHandoff } from "./handoff.js";
import { hydrateTrackerContext } from "./hydrate";
import { suspendWorkflowForClarification } from "./suspend.js";
import type { AgentHandoff, OrchestratorContext } from "./types";

export type WavesResult = {
  trackerContext: TrackerContext;
  allAgentOutcomes: AgentOutcome[];
  agentFileHints: Map<string, Set<string>>;
  activeWorkspaces: Workspace[];
  aborted: boolean;
  suspended?: boolean;
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
    rootPlanPath(workspace, runId)
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

  const isAbortError = (error: unknown) =>
    signal.aborted ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError");

  try {
    // Build or reuse execution context
    let context;
    if (cachedExecutionContext) {
      context = cachedExecutionContext;
      yield {
        _: "notice",
        message: "waves_using_cached_context",
      } as WorkflowEvent;
    } else if (input.context?.enable === false) {
      context = {
        requirement: effectiveRequirement,
        receipts: {
          code: [],
          created: new Date(),
          summary: "context_disabled",
        },
        bundle: null,
        totalTokens: 0,
      };
      yield {
        _: "notice",
        message: "waves_context_disabled",
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
        authz,
        userId,
      });
    }

    if (!ctx.scanContext) {
      ctx.scanContext = context;
    }

    const maxParallelRaw = Number.parseInt(
      process.env.ORCHESTRATOR_MAX_PARALLEL || "2",
      10
    );
    const maxParallel = Number.isFinite(maxParallelRaw)
      ? Math.max(1, maxParallelRaw)
      : 2;

    // Decompose into subtasks or use pre-planned subtasks
    let subTasks: SubTask[];
    let waves: WavePlan[];

    if (ctx.plan) {
      // Phased Planning Path
      subTasks = flattenPhases(ctx.plan.phases);
      waves = convertPlanToWavePlan(ctx.plan);

      yield {
        _: "notice",
        message: "waves_using_phased_plan",
        data: { planId: ctx.plan.id, phaseCount: ctx.plan.phases.length },
      } as any;
    } else {
      // Legacy/Generic Path
      subTasks = decomposeTask(input.requirement, {
        requirement: effectiveRequirement,
        bundle: context.bundle,
      });

      if (subTasks.length === 0) {
        yield { _: "notice", message: "no_subtasks_to_execute" } as any;
        return {
          trackerContext: createTrackerContext([]),
          allAgentOutcomes: [],
          agentFileHints,
          activeWorkspaces,
          aborted: false,
          interrupted: false,
        };
      }

      waves = planWaves(subTasks, { maxParallel });
    }

    if (waves.length === 0 && subTasks.length > 0) {
      waves.push({
        id: "wave_0",
        agents: subTasks.map((t) => t.id),
        dependsOn: [],
      });
    }

    // Hydrate tracker context with subtask dependencies
    const trackerContext = hydrateTrackerContext(history, subTasks);
    const trackerContextRef = { current: trackerContext };
    const subTaskById = new Map<string, SubTask>(
      subTasks.map((t) => [t.id, t])
    );

    // Track started phases
    const startedPhases = new Set<string>();
    const completedPhases = new Set<string>();

    if (ctx.plan) {
      yield makePlanSelectedEvent(ctx.plan);
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
    let previousHandoff: AgentHandoff | null = null;

    // Track progress per phase
    const phaseProgress = new Map<string, number>(); // phaseId -> completed tasks count
    const phaseTotalTasks = new Map<string, number>(); // phaseId -> total tasks count

    if (ctx.plan) {
      for (const phase of ctx.plan.phases) {
        phaseTotalTasks.set(phase.id, phase.tasks.length);
        phaseProgress.set(phase.id, 0);
      }
    }

    for (const wave of waves) {
      if (signal.aborted) {
        hasInterruptedAgents = true;
        break;
      }

      const phaseId = wave.phaseId;
      if (ctx.plan && phaseId && !startedPhases.has(phaseId)) {
        const phase = ctx.plan.phases.find((p) => p.id === phaseId);
        if (phase) {
          yield makePhaseStartEvent(phaseId, phase);
          startedPhases.add(phaseId);
        }
      }

      yield makeWaveStartEvent(wave.id);

      // Skip already completed waves (hydration)
      if (
        trackerContextRef.current.state.waves[wave.id]?.status === "completed"
      ) {
        logger.info("wave_hydrated_skipping", { waveId: wave.id });
        yield {
          _: "notice",
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
        _: "notice",
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
            agentType: wave.agentType,
            handoff: previousHandoff
              ? formatHandoffPrompt(previousHandoff)
              : undefined,
            clarifications: (input as any).clarifications,
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

      for (const spec of agentSpecs) {
        yield makeAgentStartEvent(spec.agentId, phaseId ?? "");
      }

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
              phaseId,
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
              runtimeMcp: ctx.runtimeMcp,
            });
          } catch (error) {
            if (isAbortError(error)) {
              queue.enqueue({
                _: "notice",
                message: `agent_interrupted_abort:${spec.agentId}`,
              } as any);
              return {
                agentId: spec.agentId,
                phaseId,
                stuck: false,
                status: "interrupted",
                durationSeconds: 0,
                role: "codex",
                escalation: undefined,
                result: {
                  summary: "agent interrupted (abort)",
                  artifacts: [],
                  changes: [],
                  notes: [],
                },
              } as AgentOutcome;
            }
            logger.error("agent_unhandled_error", {
              runId,
              agentId: spec.agentId,
              error: error instanceof Error ? error.message : String(error),
            });
            queue.enqueue({
              _: "notice",
              message: `agent_failed_unhandled:${spec.agentId}`,
            } as any);
            return {
              agentId: spec.agentId,
              phaseId,
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

      // Check for clarifications
      for (const outcome of agentOutcomes) {
        const clarification = await detectClarification(outcome, ctx);
        if (clarification) {
          await suspendWorkflowForClarification(runId, clarification);
          yield {
            type: "event",
            kind: "clarification-requested",
            data: clarification,
          } as any;
          return {
            trackerContext: trackerContextRef.current,
            allAgentOutcomes,
            agentFileHints,
            activeWorkspaces,
            aborted: false,
            interrupted: false,
            suspended: true,
          } as any;
        }
      }

      for (const outcome of agentOutcomes) {
        yield makeAgentCompleteEvent(outcome.agentId, phaseId ?? "", outcome);

        // Increment phase progress
        if (phaseId && phaseProgress.has(phaseId)) {
          const current = phaseProgress.get(phaseId) ?? 0;
          const total = phaseTotalTasks.get(phaseId) ?? 1;
          const next = current + 1;
          phaseProgress.set(phaseId, next);
          yield makePhaseProgressEvent(phaseId, Math.min(1.0, next / total));
        }
      }

      yield makeWaveCompleteEvent(wave.id);

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

      // Stop waves if escalated/interrupted/aborted.
      if (escalationTrigger || hasInterruptedAgents || signal.aborted) {
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

      // Check for phase completion
      if (ctx.plan && phaseId && !completedPhases.has(phaseId)) {
        const allWavesForPhase = waves.filter((w) => w.phaseId === phaseId);
        const allCompleted = allWavesForPhase.every(
          (w) =>
            w.id === wave.id ||
            trackerContextRef.current.state.waves[w.id]?.status === "completed"
        );

        if (allCompleted) {
          const outcomesForPhase = allAgentOutcomes.filter(
            (o) => o.phaseId === phaseId
          );

          yield makePhaseCompleteEvent(phaseId, {
            status: anyStuck ? "partial" : "completed",
            outcomes: outcomesForPhase,
          });
          completedPhases.add(phaseId);
        }
      }

      // Generate handoff for next wave
      const nextWave = waves[waves.indexOf(wave) + 1];
      if (nextWave) {
        previousHandoff = await generateHandoff(
          wave.id,
          nextWave.id,
          agentOutcomes,
          workspace
        );

        yield {
          type: "event",
          kind: "agent-handoff",
          data: previousHandoff,
        } as any;
      }

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
  } catch (error) {
    // If waves throw, merge/review will never run, so we must ensure workspaces
    // are cleaned up here to avoid leaks.
    if (!isAbortError(error)) {
      for (const ws of activeWorkspaces) {
        try {
          await ws.cleanup();
        } catch {
          /* ignore */
        }
      }
    }
    throw error;
  }
}

// Re-export for backwards compatibility
export { hydrateTrackerContext } from "./hydrate";
