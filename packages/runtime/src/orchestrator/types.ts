import type { StuckDetectionOptions } from "@alfred/agent/orchestrator/multi/tracker";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";

export type ProjectType = "node" | "rust" | "python" | "go" | "unknown";

export type ProjectConfig = {
  type: ProjectType;
  testCommand: string;
  runCommand: string;
  installCommand: string;
  buildCommand: string;
  /** Optional stuck detection thresholds for tuning agent behavior */
  stuckDetection?: StuckDetectionOptions;
};

export type OrchestratorContext = {
  input: RuntimeInput;
  runId: string;
  signal: AbortSignal;
  workspace: string;
  history?: WorkflowEvent[];
  projectConfig?: ProjectConfig | null;
  escalationContext?: string; // Reason for previous escalation
  authz?: string;
  scanContext?: ExecutionContext | null;
  userId?: string;
};
