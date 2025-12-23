/**
 * Multi-agent orchestration module.
 *
 * This module provides types and functions for decomposing requirements into
 * subtasks, planning execution waves, tracking agent progress, merging outcomes,
 * and reviewing results.
 *
 * @example
 * ```typescript
 * import {
 *   createPipeline,
 *   transitionPipeline,
 *   createTrackerContext,
 *   decomposeTask,
 *   planWaves,
 * } from "@alfred/agent/orchestrator/multi";
 * ```
 */

// Pipeline (state machine for orchestration)
export {
  type OrchestratorPipeline,
  type PipelineStage,
  type PipelineTransition,
  type PipelineSummary,
  type PipelineExecutionContext,
  type PipelineTrackerState,
  type WaveExecutionContext,
  type MergeContext,
  type ReviewContext,
  type ExecPlanTracking,
  type PipelineMetrics,
  createPipeline,
  transitionPipeline,
  buildPipelineSummary,
  initializePipelineTracker,
  isInitStage,
  isPlanningStage,
  isWavesStage,
  isMergingStage,
  isReviewingStage,
  isCompletedStage,
  isEscalatedStage,
  isAbortedStage,
  isTerminalStage,
} from "./pipeline";

// Decomposition
export {
  type SubTask,
  type SubTaskId,
  type DecomposeContext,
  decomposeTask,
} from "./decompose";

// Spawn & Wave Planning
export {
  type AgentId,
  type WaveId,
  type AgentSpec,
  type WavePlan,
  buildAgentSpec,
  buildFixerAgentSpec,
  planWaves,
} from "./spawn";

// Tracker (state tracking for agents and waves)
export {
  type TrackerState,
  type TrackerContext,
  type TrackerAgentState,
  type TrackerWaveState,
  type AgentStatus,
  type AgentEvent,
  type StuckDetectionOptions,
  createTrackerContext,
  cloneTrackerContext,
  resetTrackerContext,
  updateTrackerWithContext,
  detectStuckWithContext,
  getBlockedTasksWithContext,
  areAllDepsCompletedWithContext,
  propagateCompletionWithContext,
  clearAgentDetectorWithContext,
  clearAllDetectorsWithContext,
  getStuckDetectionDefaults,
} from "./tracker";

// Merge
export {
  type AgentOutcome,
  type MergePlan,
  buildMergePlan,
  generateMergeExecPlanSkeleton,
} from "./merge";

// Review
export {
  type ReviewPlan,
  type ReviewCheck,
  type ReviewCheckType,
  type ReviewFailureDetail,
  buildReviewPlan,
  buildFixerSubTask,
  generateReviewExecPlanSkeleton,
  generateFixerExecPlanSkeleton,
  formatReviewFailureDetails,
} from "./review";

// ExecPlan utilities
export {
  type ExecPlanSnapshot,
  type PlanProgressUpdate,
  type DecisionLogEntry,
  type SurpriseEntry,
  interpretExecPlan,
  applyProgressUpdate,
  appendDecisionLogEntry,
  appendSurpriseEntry,
  planProgressUpdate,
  generateSubtaskExecPlanSkeleton,
} from "./execplan";

// Conflict detection
export {
  type ConflictScanResult,
  countConflictMarkers,
  aggregateConflictMarkers,
  generateConflictExecPlanSkeleton,
} from "./conflict";

// Linear sync
export {
  type LinearSyncConfig,
  type LinearSyncResult,
  syncDepsToLinear,
  buildTaskIssueMap,
} from "./linear-sync";
