import type { ContextBundle } from "@alfred/type/plan";

import type { SubTask, SubTaskId } from "./decompose";
import type { ExecPlanSnapshot } from "./execplan";
import type { AgentOutcome, MergePlan } from "./merge";
import type { ReviewFailureDetail, ReviewPlan } from "./review";
import type { AgentId, AgentSpec, WaveId, WavePlan } from "./spawn";

import { rootPlanPath, subtaskPlanPath } from "../plans";
import {
  createTrackerContext,
  type StuckDetectionOptions,
  type TrackerContext,
} from "./tracker";

/**
 * Execution context built during the plan phase.
 * Mirrors the shape from @alfred/runtime/context without direct import
 * to avoid circular dependencies.
 */
export interface PipelineExecutionContext {
  bundle: ContextBundle | null;
  ragDocumentIds: string[];
  totalTokens: number;
  receipts: {
    code?: { id: string; path?: string; score: number }[];
    web?: { id: string; url?: string; title?: string }[];
  };
}

/**
 * Discriminated union representing each stage of the orchestrator pipeline.
 * Enables type-safe stage transitions and makes the workflow discoverable.
 */
export type PipelineStage =
  | { stage: "init"; requirement: string; workspace: string }
  | {
      stage: "planning";
      context: PipelineExecutionContext;
      subTasks: SubTask[];
    }
  | {
      stage: "waves";
      waves: WavePlan[];
      currentWave: WaveId | null;
      completedWaves: WaveId[];
    }
  | {
      stage: "merging";
      mergePlan: MergePlan;
      analysisComplete: boolean;
    }
  | {
      stage: "reviewing";
      reviewPlan: ReviewPlan;
      fixAttempts: number;
      currentCheck: string | null;
    }
  | { stage: "completed"; summary: PipelineSummary }
  | {
      stage: "escalated";
      reason: string;
      fromStage: Exclude<
        PipelineStage["stage"],
        "escalated" | "completed" | "aborted"
      >;
    }
  | {
      stage: "aborted";
      reason: string;
      fromStage: Exclude<
        PipelineStage["stage"],
        "aborted" | "completed" | "escalated"
      >;
    };

/**
 * Summary of pipeline execution for completed workflows.
 */
export interface PipelineSummary {
  totalSubTasks: number;
  completedAgents: number;
  failedAgents: number;
  stuckAgents: number;
  interruptedAgents: number;
  mergeStatus: "completed" | "conflict" | "failed" | "skipped";
  reviewPassed: boolean;
  fixAttempts: number;
  durationMs: number;
}

/**
 * Re-export TrackerContext as PipelineTrackerState for semantic clarity.
 * TrackerContext encapsulates all tracker state for concurrent workflow support.
 */
export type PipelineTrackerState = TrackerContext;

/**
 * Wave execution context accumulated during the waves phase.
 */
export interface WaveExecutionContext {
  waves: WavePlan[];
  tracker: TrackerContext;
  agentSpecs: Map<AgentId, AgentSpec>;
  fileHints: Map<AgentId, Set<string>>;
  outcomes: AgentOutcome[];
  abortedWave: {
    id: WaveId;
    waveFailRate: number;
    overallFailRate: number;
  } | null;
  hasInterrupted: boolean;
  hasEscalated: boolean;
  escalationReason: string | null;
}

/**
 * Merge phase context accumulated during merging.
 */
export interface MergeContext {
  plan: MergePlan;
  conflictScan: {
    files: string[];
    totalMarkers: number;
    counts: Record<string, number>;
  } | null;
  executionResult: {
    status: "completed" | "conflict" | "failed";
    mergedBranches: string[];
    targetBranch: string;
    conflictBranch?: string;
    conflictFiles?: string[];
    error?: string;
  } | null;
}

/**
 * Review phase context accumulated during review.
 */
export interface ReviewContext {
  plan: ReviewPlan;
  fixAttempts: number;
  failures: ReviewFailureDetail[];
  passed: boolean;
  debuggerPlanPath: string | null;
}

/**
 * ExecPlan tracking for the workflow.
 */
export interface ExecPlanTracking {
  rootPath: string;
  subtaskPaths: Map<SubTaskId, string>;
  snapshots: Map<string, ExecPlanSnapshot>;
}

/**
 * Timing metrics for pipeline phases.
 */
export interface PipelineMetrics {
  startedAt: number;
  endedAt: number | null;
  phaseTimings: Map<
    PipelineStage["stage"],
    { start: number; end: number | null }
  >;
  agentDurations: Map<AgentId, number>;
}

/**
 * The complete orchestrator pipeline state.
 * Documents the multi-agent workflow stages and enables type-safe transitions.
 *
 * Pipeline stages flow:
 *   init → planning → waves → merging → reviewing → completed
 *                 ↘         ↘          ↘          ↘
 *                  escalated/aborted (from any active stage)
 */
export interface OrchestratorPipeline {
  runId: string;
  stage: PipelineStage;

  // Input context (immutable after init)
  input: {
    requirement: string;
    workspace: string;
    auto: "read" | "low" | "medium" | "high";
    linear?: {
      issueId?: string;
      sessionId?: string;
      space?: string;
      authz?: string;
    };
  };

  // Plan phase outputs
  planning: {
    context: PipelineExecutionContext | null;
    subTasks: SubTask[];
    subTaskById: Map<SubTaskId, SubTask>;
    planSummary: string | null;
  };

  // Wave execution state
  waves: WaveExecutionContext | null;

  // Merge phase outputs
  merge: MergeContext | null;

  // Review phase outputs
  review: ReviewContext | null;

  // ExecPlan tracking
  execPlans: ExecPlanTracking;

  // Timing and metrics
  metrics: PipelineMetrics;
}

/**
 * Valid transitions between pipeline stages.
 * Used for runtime validation and documentation.
 */
export type PipelineTransition =
  | {
      from: "init";
      to: "planning";
      context: PipelineExecutionContext;
      subTasks: SubTask[];
    }
  | { from: "planning"; to: "waves"; waves: WavePlan[] }
  | {
      from: "waves";
      to: "merging";
      outcomes: AgentOutcome[];
      mergePlan: MergePlan;
    }
  | { from: "merging"; to: "reviewing"; reviewPlan: ReviewPlan }
  | { from: "reviewing"; to: "completed"; summary: PipelineSummary }
  | { from: "reviewing"; to: "reviewing"; fixAttempt: number }
  | {
      from: Exclude<
        PipelineStage["stage"],
        "completed" | "escalated" | "aborted"
      >;
      to: "escalated";
      reason: string;
    }
  | {
      from: Exclude<
        PipelineStage["stage"],
        "completed" | "escalated" | "aborted"
      >;
      to: "aborted";
      reason: string;
    };

/**
 * Create a new pipeline in the init stage.
 */
export function createPipeline(
  runId: string,
  requirement: string,
  workspace: string,
  options?: {
    auto?: "read" | "low" | "medium" | "high";
    linear?: OrchestratorPipeline["input"]["linear"];
  }
): OrchestratorPipeline {
  const now = Date.now();
  return {
    runId,
    stage: { stage: "init", requirement, workspace },
    input: {
      requirement,
      workspace,
      auto: options?.auto ?? "low",
      linear: options?.linear,
    },
    planning: {
      context: null,
      subTasks: [],
      subTaskById: new Map(),
      planSummary: null,
    },
    waves: null,
    merge: null,
    review: null,
    execPlans: {
      rootPath: rootPlanPath(workspace, runId),
      subtaskPaths: new Map(),
      snapshots: new Map(),
    },
    metrics: {
      startedAt: now,
      endedAt: null,
      phaseTimings: new Map([["init", { start: now, end: null }]]),
      agentDurations: new Map(),
    },
  };
}

/**
 * Transition the pipeline to a new stage.
 * Returns a new pipeline instance (immutable update).
 */
export function transitionPipeline(
  pipeline: OrchestratorPipeline,
  transition: PipelineTransition
): OrchestratorPipeline {
  const now = Date.now();
  const currentStage = pipeline.stage.stage;

  // Validate transition is from current stage
  if (transition.from !== currentStage) {
    throw new Error(
      `Invalid transition: expected from="${currentStage}", got from="${transition.from}"`
    );
  }

  // Close timing for current stage
  const updatedTimings = new Map(pipeline.metrics.phaseTimings);
  const currentTiming = updatedTimings.get(currentStage);
  if (currentTiming) {
    updatedTimings.set(currentStage, { ...currentTiming, end: now });
  }

  // Open timing for new stage
  updatedTimings.set(transition.to, { start: now, end: null });

  const baseUpdate = {
    ...pipeline,
    metrics: {
      ...pipeline.metrics,
      phaseTimings: updatedTimings,
    },
  };

  switch (transition.to) {
    case "planning": {
      const t = transition as Extract<PipelineTransition, { to: "planning" }>;
      const subTaskById = new Map(t.subTasks.map((st) => [st.id, st]));
      const workspaceRoot = pipeline.input.workspace;
      const subtaskPaths = new Map(
        t.subTasks.map((st) => [
          st.id,
          subtaskPlanPath(workspaceRoot, pipeline.runId, st.id),
        ])
      );
      return {
        ...baseUpdate,
        stage: {
          stage: "planning",
          context: t.context,
          subTasks: t.subTasks,
        },
        planning: {
          context: t.context,
          subTasks: t.subTasks,
          subTaskById,
          planSummary: null,
        },
        execPlans: {
          ...baseUpdate.execPlans,
          subtaskPaths,
        },
      };
    }

    case "waves": {
      const t = transition as Extract<PipelineTransition, { to: "waves" }>;
      const { subTasks } = pipeline.planning;
      return {
        ...baseUpdate,
        stage: {
          stage: "waves",
          waves: t.waves,
          currentWave: t.waves[0]?.id ?? null,
          completedWaves: [],
        },
        waves: {
          waves: t.waves,
          tracker: createTrackerContext(subTasks),
          agentSpecs: new Map(),
          fileHints: new Map(),
          outcomes: [],
          abortedWave: null,
          hasInterrupted: false,
          hasEscalated: false,
          escalationReason: null,
        },
      };
    }

    case "merging": {
      const t = transition as Extract<PipelineTransition, { to: "merging" }>;
      return {
        ...baseUpdate,
        stage: {
          stage: "merging",
          mergePlan: t.mergePlan,
          analysisComplete: false,
        },
        waves: pipeline.waves
          ? { ...pipeline.waves, outcomes: t.outcomes }
          : null,
        merge: {
          plan: t.mergePlan,
          conflictScan: null,
          executionResult: null,
        },
      };
    }

    case "reviewing": {
      if (transition.from === "reviewing") {
        // Self-correction loop
        const t = transition as Extract<
          PipelineTransition,
          { from: "reviewing"; to: "reviewing" }
        >;
        return {
          ...baseUpdate,
          stage: {
            stage: "reviewing",
            reviewPlan: pipeline.review?.plan ?? { summary: "", checks: [] },
            fixAttempts: t.fixAttempt,
            currentCheck: null,
          },
          review: pipeline.review
            ? { ...pipeline.review, fixAttempts: t.fixAttempt }
            : null,
        };
      }
      const t = transition as Extract<
        PipelineTransition,
        { from: "merging"; to: "reviewing" }
      >;
      return {
        ...baseUpdate,
        stage: {
          stage: "reviewing",
          reviewPlan: t.reviewPlan,
          fixAttempts: 0,
          currentCheck: null,
        },
        review: {
          plan: t.reviewPlan,
          fixAttempts: 0,
          failures: [],
          passed: false,
          debuggerPlanPath: null,
        },
      };
    }

    case "completed": {
      const t = transition as Extract<PipelineTransition, { to: "completed" }>;
      return {
        ...baseUpdate,
        stage: { stage: "completed", summary: t.summary },
        metrics: {
          ...baseUpdate.metrics,
          endedAt: now,
        },
      };
    }

    case "escalated": {
      const t = transition as Extract<PipelineTransition, { to: "escalated" }>;
      return {
        ...baseUpdate,
        stage: {
          stage: "escalated",
          reason: t.reason,
          fromStage: transition.from as Exclude<
            PipelineStage["stage"],
            "completed" | "escalated" | "aborted"
          >,
        },
        metrics: {
          ...baseUpdate.metrics,
          endedAt: now,
        },
      };
    }

    case "aborted": {
      const t = transition as Extract<PipelineTransition, { to: "aborted" }>;
      return {
        ...baseUpdate,
        stage: {
          stage: "aborted",
          reason: t.reason,
          fromStage: transition.from as Exclude<
            PipelineStage["stage"],
            "completed" | "escalated" | "aborted"
          >,
        },
        metrics: {
          ...baseUpdate.metrics,
          endedAt: now,
        },
      };
    }

    default: {
      throw new Error(
        `Unknown transition target: ${(transition as PipelineTransition & { to: string }).to}`
      );
    }
  }
}

// Type guards for stage access

export function isInitStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "init" }>;
} {
  return p.stage.stage === "init";
}

export function isPlanningStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "planning" }>;
} {
  return p.stage.stage === "planning";
}

export function isWavesStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "waves" }>;
} {
  return p.stage.stage === "waves";
}

export function isMergingStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "merging" }>;
} {
  return p.stage.stage === "merging";
}

export function isReviewingStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "reviewing" }>;
} {
  return p.stage.stage === "reviewing";
}

export function isCompletedStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "completed" }>;
} {
  return p.stage.stage === "completed";
}

export function isEscalatedStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "escalated" }>;
} {
  return p.stage.stage === "escalated";
}

export function isAbortedStage(
  p: OrchestratorPipeline
): p is OrchestratorPipeline & {
  stage: Extract<PipelineStage, { stage: "aborted" }>;
} {
  return p.stage.stage === "aborted";
}

export function isTerminalStage(p: OrchestratorPipeline): boolean {
  return (
    p.stage.stage === "completed" ||
    p.stage.stage === "escalated" ||
    p.stage.stage === "aborted"
  );
}

/**
 * Initialize pipeline tracker state from subtasks.
 * Delegates to createTrackerContext from tracker.ts.
 */
export function initializePipelineTracker(
  subTasks: SubTask[],
  options?: StuckDetectionOptions
): PipelineTrackerState {
  return createTrackerContext(subTasks, options);
}

/**
 * Build pipeline summary from current state.
 */
export function buildPipelineSummary(
  pipeline: OrchestratorPipeline
): PipelineSummary {
  const outcomes = pipeline.waves?.outcomes ?? [];
  const completed = outcomes.filter((o) => o.status === "completed").length;
  const failed = outcomes.filter((o) => o.status === "failed").length;
  const stuck = outcomes.filter((o) => o.status === "stuck").length;
  const interrupted = outcomes.filter(
    (o): o is typeof o & { status: "paused" } => o.status === "paused"
  ).length;

  let mergeStatus: PipelineSummary["mergeStatus"] = "skipped";
  if (pipeline.merge?.executionResult) {
    mergeStatus = pipeline.merge.executionResult.status;
  } else if (pipeline.merge?.plan) {
    mergeStatus =
      pipeline.merge.plan.branches.length > 0 ? "skipped" : "completed";
  }

  return {
    totalSubTasks: pipeline.planning.subTasks.length,
    completedAgents: completed,
    failedAgents: failed,
    stuckAgents: stuck,
    interruptedAgents: interrupted,
    mergeStatus,
    reviewPassed: pipeline.review?.passed ?? false,
    fixAttempts: pipeline.review?.fixAttempts ?? 0,
    durationMs:
      (pipeline.metrics.endedAt ?? Date.now()) - pipeline.metrics.startedAt,
  };
}
