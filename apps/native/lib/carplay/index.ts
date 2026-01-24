/**
 * ALFRED CarPlay Integration
 *
 * Voice-first coding agent orchestrator for Apple CarPlay.
 *
 * Features:
 * - Voice control with barge-in support
 * - Workflow monitoring and control
 * - Escalation handling and decision queue
 * - PR review and approval
 * - ExecPlan approval flow
 * - Real-time status streaming via NowPlaying
 * - Offline mode with command queuing
 *
 * Usage:
 * ```tsx
 * import { carPlayController, carPlaySync, useCarPlayStore } from '@/lib/carplay';
 *
 * // Initialize controller
 * carPlayController.initialize({ ... });
 *
 * // Start sync
 * carPlaySync.start();
 *
 * // Access state
 * const workflows = useCarPlayStore((s) => s.workflows);
 * ```
 */

// API Client
export * as carPlayApi from "./api";
export type { AudioState } from "./audio";

// Audio
export { carPlayAudio } from "./audio";
export type { CarPlayMode, CarPlayState } from "./controller";
// Controller
export { carPlayController } from "./controller";
// NowPlaying (workflow status streaming)
export * from "./nowplaying";
// Offline mode
export * from "./offline";
export type { DashboardCallbacks } from "./scenes/dashboard";
// Dashboard Scene
export { createDashboardTemplate, refreshDashboard } from "./scenes/dashboard";
// State Store
export {
  useActiveWorkflow,
  useCarPlayStore,
  useConnectionStatus,
  useDecisionCount,
  usePlanCount,
  usePRCount,
  useWorkflows,
} from "./store";
// Sync Manager
export { carPlaySync, mapPipelineEventToCarPlayEvent } from "./sync";
// Templates - Basic
// Templates - Orchestrator
export {
  createAgentGridTemplate,
  createDecisionQueueTemplate,
  createErrorAlert,
  createEscalationAlert,
  createEscalationDetailTemplate,
  createHistoryTemplate,
  createMainTemplate,
  createNotesTemplate,
  createOfflineTemplate,
  createPlanApprovalTemplate,
  createPRDetailTemplate,
  createPRListTemplate,
  createRemindersTemplate,
  createResponseTemplate,
  createVoiceTemplate,
  createWorkflowDetailTemplate,
} from "./templates";
// Types
export type {
  CarPlayEvent,
  CarPlayEventType,
  ConnectionStatus,
  Escalation,
  EscalationPriority,
  EscalationReason,
  ExecPlan,
  ExecPlanPhase,
  OfflineCommand,
  ParsedVoiceCommand,
  PRCIStatus,
  PRReviewStatus,
  PRStatus,
  PullRequest,
  ReviewItem,
  ReviewType,
  TTSPriority,
  TTSRequest,
  VoiceIntent,
  WorkflowState,
  WorkflowStatus,
} from "./types";

// Voice Integration (wires to existing ALFRED voice system)
export * from "./voice";

// Legacy compatibility export
export function setupCarPlay(
  _voice: unknown,
  _onResponse?: (text: string) => void
): void {}
