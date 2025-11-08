import { generateText } from "ai";
import * as workflowRepo from "@alfred/db/repo/workflow";

type PersistArgs = {
  userId: string;
  kind: "assistant" | "orchestrator";
  input: unknown;
  result: unknown;
};

export type GenerateTextInput = Parameters<typeof generateText>[0];

export const callGenerateText = generateText;

/**
 * Optionally persist non-stream generate results to the durable workflow store
 * for replay. Controlled via ENABLE_GENERATE_PERSIST=1.
 */
export async function persistGenerateResult(args: PersistArgs): Promise<string | null> {
  if (process.env.ENABLE_GENERATE_PERSIST !== "1") {
    return null;
  }
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
  } catch {
    return null;
  }
}
