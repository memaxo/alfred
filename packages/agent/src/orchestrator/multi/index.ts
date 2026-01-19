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

// Conflict detection
export {
  aggregateConflictMarkers,
  type ConflictScanResult,
  countConflictMarkers,
  generateConflictExecPlanSkeleton,
} from "./conflict";

// Decomposition
export {
  type DecomposeContext,
  decomposeTask,
  type SubTask,
  type SubTaskId,
} from "./decompose";
// ExecPlan utilities
export {
  appendDecisionLogEntry,
  appendSurpriseEntry,
  applyProgressUpdate,
  type DecisionLogEntry,
  type ExecPlanSnapshot,
  generateSubtaskExecPlanSkeleton,
  interpretExecPlan,
  type PlanProgressUpdate,
  planProgressUpdate,
  type SurpriseEntry,
} from "./execplan";
// Linear sync
export {
  buildTaskIssueMap,
  type LinearSyncConfig,
  type LinearSyncResult,
  syncDepsToLinear,
} from "./linear-sync";

// Merge
export {
  type AgentOutcome,
  buildMergePlan,
  generateMergeExecPlanSkeleton,
  type MergePlan,
} from "./merge";
// Pipeline (state machine for orchestration)
export {
  buildPipelineSummary,
  createPipeline,
  type ExecPlanTracking,
  initializePipelineTracker,
  isAbortedStage,
  isCompletedStage,
  isEscalatedStage,
  isInitStage,
  isMergingStage,
  isPlanningStage,
  isReviewingStage,
  isTerminalStage,
  isWavesStage,
  type MergeContext,
  type OrchestratorPipeline,
  type PipelineExecutionContext,
  type PipelineMetrics,
  type PipelineStage,
  type PipelineSummary,
  type PipelineTrackerState,
  type PipelineTransition,
  type ReviewContext,
  transitionPipeline,
  type WaveExecutionContext,
} from "./pipeline";
// Review
export {
  buildFixerSubTask,
  buildReviewPlan,
  formatReviewFailureDetails,
  generateFixerExecPlanSkeleton,
  generateReviewExecPlanSkeleton,
  type ReviewCheck,
  type ReviewCheckType,
  type ReviewFailureDetail,
  type ReviewPlan,
} from "./review";
// Spawn & Wave Planning
export {
  type AgentId,
  type AgentSpec,
  buildAgentSpec,
  buildFixerAgentSpec,
  planWaves,
  type WaveId,
  type WavePlan,
} from "./spawn";
// Tracker (state tracking for agents and waves)
export {
  type AgentEvent,
  type AgentStatus,
  areAllDepsCompletedWithContext,
  clearAgentDetectorWithContext,
  clearAllDetectorsWithContext,
  cloneTrackerContext,
  createTrackerContext,
  detectStuckWithContext,
  getBlockedTasksWithContext,
  getStuckDetectionDefaults,
  propagateCompletionWithContext,
  resetTrackerContext,
  type StuckDetectionConfig,
  /** @deprecated Use StuckDetectionConfig instead */
  type StuckDetectionOptions,
  type TrackerAgentState,
  type TrackerContext,
  type TrackerState,
  type TrackerWaveState,
  updateTrackerWithContext,
} from "./tracker";
