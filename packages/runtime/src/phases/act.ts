import type { ProjectConfig } from "@alfred/agent/utils/project-detector";
import type { WorkflowEvent } from "@alfred/type/plan";
import type { ExecutionContext } from "../context";
import { runOrchestrator } from "../orchestrator";
import type { RuntimeInput } from "../types";

export type ActResult = {
  escalated: boolean;
  reason?: string;
};

export async function* executeActPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  history?: WorkflowEvent[],
  projectConfig?: ProjectConfig | null,
  authz?: string,
  cachedContext?: ExecutionContext | null
): AsyncGenerator<WorkflowEvent, ActResult, void> {
  yield { type: "notice", message: "execution_started" } as WorkflowEvent;

  if (signal.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }

  const disableAgents =
    (process.env.NODE_ENV === "test" &&
      process.env.RUNTIME_TEST_ORCHESTRATION !== "1") ||
    process.env.RUNTIME_DISABLE_CODEX === "1";

  if (disableAgents) {
    yield { type: "notice", message: "execution_placeholder" } as WorkflowEvent;
    return { escalated: false };
  }

  yield* runOrchestrator(
    input,
    runId,
    signal,
    history,
    projectConfig,
    undefined,
    authz,
    cachedContext
  );

  return {
    escalated: false,
    reason: undefined,
  };
}
