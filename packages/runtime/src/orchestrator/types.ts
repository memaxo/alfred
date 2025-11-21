import type { ProjectConfig } from "@alfred/agent/utils/project-detector";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { RuntimeInput } from "../types";

export type OrchestratorContext = {
  input: RuntimeInput;
  runId: string;
  signal: AbortSignal;
  workspace: string;
  history?: WorkflowEvent[];
  projectConfig?: ProjectConfig | null;
};
