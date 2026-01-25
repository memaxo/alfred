/**
 * ALFRED CarPlay Types
 *
 * TypeScript interfaces for CarPlay state management.
 * Maps backend workflow/escalation/PR data to CarPlay UI.
 */

// Workflow status aligned with backend
export type WorkflowStatus =
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled";

// Workflow state for CarPlay display
export interface WorkflowState {
  id: string;
  requirement: string;
  status: WorkflowStatus;
  progress: number; // 0-100
  currentTask?: string;
  currentPhase?: string;
  completedTasks: number;
  totalTasks: number;
  startedAt: number; // timestamp
  updatedAt: number;
  planId?: string;
  linearIssueId?: string;
}

// Escalation priority levels
export type EscalationPriority = "critical" | "high" | "normal";

// Escalation severity from backend
export type EscalationSeverity = "warning" | "blocking";

// Escalation reasons from agent tool
export type EscalationReason =
  | "missing_dependency"
  | "wrong_architecture"
  | "permission_denied"
  | "resource_exhausted"
  | "external_service_unavailable"
  | "conflicting_requirements"
  | "other";

// Escalation for decision queue
export interface Escalation {
  id: string;
  workflowId: string;
  workflowName: string;
  agentId?: string;
  reason: EscalationReason;
  question: string;
  details: string;
  options: EscalationOption[];
  suggestions?: string[];
  priority: EscalationPriority;
  severity: EscalationSeverity;
  createdAt: number;
}

export interface EscalationOption {
  id: string;
  label: string;
  action: "approve" | "reject" | "defer" | "custom";
  value?: string;
}

// PR status from GitHub router
export type PRStatus = "open" | "merged" | "closed";
export type PRReviewStatus = "pending" | "approved" | "changes_requested";
export type PRCIStatus = "pending" | "success" | "failure" | "running";

// Pull request for review
export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  repository: string;
  branch: string;
  baseBranch: string;
  status: PRStatus;
  reviewStatus: PRReviewStatus;
  ciStatus: PRCIStatus;
  additions: number;
  deletions: number;
  filesChanged: number;
  isAgentCreated: boolean;
  isDraft: boolean;
  url: string;
  createdAt: string;
  updatedAt: string;
}

// ExecPlan for approval
export interface ExecPlan {
  id: string;
  runId: string;
  title: string;
  requirement: string;
  phases: ExecPlanPhase[];
  estimatedTime: number; // minutes
  riskLevel: "low" | "medium" | "high";
  waveCount: number;
  subtaskCount: number;
  createdAt: number;
}

export interface ExecPlanPhase {
  id: string;
  name: string;
  taskCount: number;
  estimatedMinutes: number;
}

// Connection status for sync
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "offline"
  | "reconnecting";

// CarPlay event types from backend stream
export type CarPlayEventType =
  | "workflow:started"
  | "workflow:updated"
  | "workflow:completed"
  | "workflow:failed"
  | "workflow:suspended"
  | "escalation:created"
  | "escalation:resolved"
  | "pr:ready"
  | "pr:merged"
  | "plan:ready"
  | "plan:approved"
  | "plan:rejected"
  | "agent:spawn"
  | "agent:complete"
  | "agent:progress";

// Unified CarPlay event from backend
export interface CarPlayEvent {
  type: CarPlayEventType;
  timestamp: number;
  data:
    | WorkflowEventData
    | EscalationEventData
    | PREventData
    | PlanEventData
    | AgentEventData;
}

export interface WorkflowEventData {
  kind: "workflow";
  runId: string;
  status: WorkflowStatus;
  progress?: number;
  currentTask?: string;
  summary?: string;
  error?: string;
}

export interface EscalationEventData {
  kind: "escalation";
  escalation: Escalation;
}

export interface PREventData {
  kind: "pr";
  pullRequest: PullRequest;
}

export interface PlanEventData {
  kind: "plan";
  plan: ExecPlan;
}

export interface AgentEventData {
  kind: "agent";
  agentId: string;
  workflowId: string;
  taskId?: string;
  status: "spawned" | "running" | "complete" | "error";
  progress?: number;
  outcome?: string;
}

// Review queue item (from review router)
export type ReviewType =
  | "tool_execution"
  | "message"
  | "memory"
  | "workflow"
  | "code";

export interface ReviewItem {
  id: string;
  type: ReviewType;
  priority: EscalationPriority;
  title: string;
  description: string;
  confidence: number;
  workflowRunId?: string;
  prNumber?: number;
  createdAt: string;
}

// Voice command intent types
export type VoiceIntent =
  | "status_query"
  | "control_command"
  | "decision"
  | "task_assignment"
  | "unknown";

export interface ParsedVoiceCommand {
  intent: VoiceIntent;
  action?: "pause" | "resume" | "cancel" | "approve" | "reject" | "defer";
  workflowName?: string;
  workflowId?: string;
  taskDescription?: string;
  confidence: number;
}

// TTS priority for queue
export type TTSPriority = "immediate" | "high" | "normal" | "low";

export interface TTSRequest {
  id: string;
  text: string;
  priority: TTSPriority;
  createdAt: number;
}

// Offline command for queue
export type OfflineCommandType =
  | "escalation_decision"
  | "pr_decision"
  | "plan_decision"
  | "workflow_action";

export interface OfflineCommand {
  id: string;
  type: OfflineCommandType;
  targetId: string;
  action: string;
  reason?: string;
  createdAt: number;
}
