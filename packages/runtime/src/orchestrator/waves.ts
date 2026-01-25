import type { Workspace } from "@alfred/agent/environment/types";
import type { SubTask } from "@alfred/agent/orchestrator/multi/decompose";
import type {
  AgentSpec,
  WavePlan,
} from "@alfred/agent/orchestrator/multi/spawn";
import type { WorkflowEvent } from "@alfred/type/plan";

import { isAgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { decomposeTask } from "@alfred/agent/orchestrator/multi/decompose";
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
import { realpathSync } from "node:fs";
import * as path from "node:path";

import type { AgentHandoff, OrchestratorContext } from "./types";

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
import {
  buildStructuredHandoff,
  formatHandoffPrompt,
  generateHandoff,
} from "./handoff.js";
import { hydrateTrackerContext } from "./hydrate";
import { suspendWorkflowForClarification } from "./suspend.js";

function isEnrichmentEnabled(): boolean {
  return process.env.ALFRED_ENRICHMENT === "1";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`enrichment_timeout:${ms}ms`));
    }, ms);

    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((error) => {
        clearTimeout(t);
        reject(error);
      });
  });
}

export interface WavesResult {
  trackerContext: TrackerContext;
  allAgentOutcomes: AgentOutcome[];
  agentFileHints: Map<string, Set<string>>;
  activeWorkspaces: Workspace[];
  aborted: boolean;
  suspended?: boolean;
  interrupted?: boolean;
  escalated?: boolean;
  escalationReason?: string;
}

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
        bundle: null,
        receipts: {
          code: [],
          created: new Date(),
          summary: "context_disabled",
        },
        requirement: effectiveRequirement,
        totalTokens: 0,
      };
      yield {
        _: "notice",
        message: "waves_context_disabled",
      } as WorkflowEvent;
    } else {
      const builder = new ContextBuilder();
      context = await builder.build({
        authz,
        exts: input.context?.exts,
        ignore: input.context?.ignore,
        maxTokens: input.context?.maxTokens,
        repoBase: input.repoBase,
        requirement: effectiveRequirement,
        seeds: input.context?.seeds,
        topK: input.context?.topK,
        userId,
        web: input.context?.web,
        workspace,
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
        data: { planId: ctx.plan.id, phaseCount: ctx.plan.phases.length },
        message: "waves_using_phased_plan",
      } as any;
    } else {
      // Legacy/Generic Path
      subTasks = decomposeTask(input.requirement, {
        bundle: context.bundle,
        requirement: effectiveRequirement,
      });

      if (subTasks.length === 0) {
        yield { _: "notice", message: "no_subtasks_to_execute" } as any;
        return {
          aborted: false,
          activeWorkspaces,
          agentFileHints,
          allAgentOutcomes: [],
          interrupted: false,
          trackerContext: createTrackerContext([]),
        };
      }

      waves = planWaves(subTasks, { maxParallel });
    }

    if (waves.length === 0 && subTasks.length > 0) {
      waves.push({
        agents: subTasks.map((t) => t.id),
        dependsOn: [],
        id: "wave_0",
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

      const { phaseId } = wave;
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
        agentCount: wave.agents.length,
        runId,
        waveId: wave.id,
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
            agentType: wave.agentType,
            agentfsBaseRunId: input.agentfsBaseRunId,
            auto: input.auto,
            clarifications: (input as any).clarifications,
            handoff: previousHandoff
              ? formatHandoffPrompt(previousHandoff)
              : undefined,
            linear: input.linear
              ? {
                  issueId: input.linear.issueId,
                  sessionId: input.linear.sessionId,
                  space: input.linear.space,
                  authz: input.linear.authz,
                }
              : undefined,
            maxParallel,
          });
          agentSubTaskIds.set(spec.agentId, spec.subTaskId);
          return spec;
        })
        .filter((spec: AgentSpec | null): spec is AgentSpec => spec !== null);

      yield {
        data: {
          waveId: wave.id,
          agents: agentSpecs,
          dependsOn: wave.dependsOn,
        },
        kind: "data-wave-plan",
        type: "event",
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
              activeWorkspaces,
              agentFileHints,
              authz,
              phaseId,
              projectConfig,
              queue,
              rootExecPlanPath,
              runId,
              runtimeMcp: ctx.runtimeMcp,
              signal,
              spec,
              subTaskById,
              trackerContextRef,
              userId,
              workspace,
              workspaceRoot,
            });
          } catch (error) {
            if (isAbortError(error)) {
              queue.enqueue({
                _: "notice",
                message: `agent_interrupted_abort:${spec.agentId}`,
              } as any);
              return {
                agentId: spec.agentId,
                durationSeconds: 0,
                escalation: undefined,
                phaseId,
                result: {
                  summary: "agent interrupted (abort)",
                  artifacts: [],
                  changes: [],
                  notes: [],
                },
                role: "codex",
                status: "interrupted",
                stuck: false,
              } as AgentOutcome;
            }
            logger.error("agent_unhandled_error", {
              agentId: spec.agentId,
              error: error instanceof Error ? error.message : String(error),
              runId,
            });
            queue.enqueue({
              _: "notice",
              message: `agent_failed_unhandled:${spec.agentId}`,
            } as any);
            return {
              agentId: spec.agentId,
              durationSeconds: 0,
              escalation: undefined,
              phaseId,
              result: {
                summary: "agent failed (unhandled error)",
                artifacts: [],
                changes: [],
                notes: [],
              },
              role: "codex",
              status: "failed",
              stuck: false,
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

      // Build structured handoff for enrichment (non-blocking)
      if (isEnrichmentEnabled()) {
        const nextWaveIndex = waves.indexOf(wave) + 1;
        const nextWaveId = waves[nextWaveIndex]?.id ?? "final";
        buildStructuredHandoff(wave.id, nextWaveId, agentOutcomes, workspace)
          .then(async (handoff) => {
            logger.debug("structured_handoff_built", {
              decisionsCount: handoff.decisions.length,
              filesCount: handoff.filesModified.length,
              waveId: wave.id,
            });

            const agentfsWs = activeWorkspaces.find(isAgentFSWorkspace);
            if (!agentfsWs) {
              return;
            }

            try {
              const { persistStructuredHandoff } =
                await import("@alfred/agent/agentfs/enrichment");
              await withTimeout(
                persistStructuredHandoff(
                  agentfsWs.getAgent(),
                  wave.id,
                  handoff
                ),
                500
              );
              logger.debug("structured_handoff_persisted", { waveId: wave.id });
            } catch (error) {
              logger.debug("structured_handoff_persist_failed", {
                waveId: wave.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          })
          .catch((error) => {
            logger.warn("structured_handoff_build_failed", {
              waveId: wave.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }

      // Check for clarifications
      for (const outcome of agentOutcomes) {
        const clarification = await detectClarification(outcome, ctx);
        if (clarification) {
          await suspendWorkflowForClarification(runId, clarification);
          yield {
            data: clarification,
            kind: "clarification-requested",
            type: "event",
          } as any;
          return {
            aborted: false,
            activeWorkspaces,
            agentFileHints,
            allAgentOutcomes,
            interrupted: false,
            suspended: true,
            trackerContext: trackerContextRef.current,
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
          yield makePhaseProgressEvent(phaseId, Math.min(1, next / total));
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
        agentCount: agentOutcomes.length,
        failedOrStuck: agentOutcomes.filter(
          (o) => o.stuck || o.status === "failed" || o.status === "stuck"
        ).length,
        runId,
        status: anyStuck ? "partial" : "completed",
        waveId: wave.id,
      });

      yield {
        data: {
          waveId: wave.id,
          status: anyStuck ? "partial" : "completed",
          agents: agentOutcomes,
        },
        kind: "wave-result",
        type: "event",
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
        const { status } = o;
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
            outcomes: outcomesForPhase,
            status: anyStuck ? "partial" : "completed",
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
          data: previousHandoff,
          kind: "agent-handoff",
          type: "event",
        } as any;
      }

      const waveFailRate = waveTotal > 0 ? waveFailedOrStuck / waveTotal : 0;
      const overallFailRate =
        totalAgents > 0 ? totalFailedOrStuck / totalAgents : 0;

      if (waveFailRate > 0.5 || overallFailRate > 0.4) {
        abortedWave = {
          id: wave.id,
          overallFailRate,
          waveFailRate,
        };
        logger.warn("multi_agent_wave_aborted", {
          overallFailRate,
          runId,
          waveFailRate,
          waveId: wave.id,
        });
        break;
      }
    }

    if (abortedWave) {
      yield {
        data: {
          waveId: abortedWave.id,
          waveFailRate: abortedWave.waveFailRate,
          overallFailRate: abortedWave.overallFailRate,
        },
        kind: "wave-aborted",
        type: "event",
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
      aborted: !!abortedWave,
      activeWorkspaces,
      agentFileHints,
      allAgentOutcomes,
      escalated: !!escalationTrigger,
      escalationReason: escalationTrigger?.reason,
      interrupted: hasInterruptedAgents,
      trackerContext: trackerContextRef.current,
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
