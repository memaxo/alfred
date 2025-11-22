import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeInput } from "../types";

export type ProjectType = "node" | "rust" | "python" | "go" | "unknown";

export type ProjectConfig = {
  type: ProjectType;
  testCommand: string;
  runCommand: string;
  installCommand: string;
  buildCommand: string;
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
};
