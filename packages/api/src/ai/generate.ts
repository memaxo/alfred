import * as workflowRepo from "@alfred/db/repo/workflow";
import { generateText } from "ai";
import { logger } from "../utils/logger";

type PersistArgs = {
  userId: string;
  kind: "assistant" | "orchestrator";
  input: unknown;
  result: unknown;
};

export type GenerateTextInput = Parameters<typeof generateText>[0];

export { generateText };

/**
 * Persist non-stream generate results to the durable workflow store for replay.
 */
export async function persistResult(args: PersistArgs): Promise<string | null> {
  const runId = crypto.randomUUID();
  try {
    await workflowRepo.createRun({
      id: runId,
      userId: args.userId,
      workflowId: `${args.kind}-generate`,
      status: "completed",
      inputData: args.input,
      stateData: null,
    });
    await workflowRepo.appendEvent({
      runId,
      eventType: "ui-message",
      eventData: args.result,
    });
    return runId;
  } catch (error) {
    logger.error("persist_result_failed", {
      kind: args.kind,
      userId: args.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
