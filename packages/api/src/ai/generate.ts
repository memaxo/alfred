import { wrapEventEnvelope } from "@alfred/agent/utils/envelope";
import { normalizeToUiMessagesAsync } from "@alfred/agent/utils/normalize-async";
import * as workflowRepo from "@alfred/db/repo/workflow";
import { logger } from "@alfred/logger";
import type { SchemaContext } from "@alfred/type/genui";
import { makeEventId } from "@alfred/type/id";
import { generateText } from "ai";

type PersistArgs = {
  userId: string;
  projectId?: string;
  kind: "assistant" | "orchestrator";
  input: unknown;
  result: unknown;
  schemaContext?: Partial<SchemaContext>;
};

export type GenerateTextInput = Parameters<typeof generateText>[0];

export { generateText };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

function coerceGenerateResult(result: unknown): {
  text?: string | null;
  toolCalls?: Array<{
    id?: string;
    name?: string;
    toolName?: string;
    args?: unknown;
  }> | null;
  toolResults?: Array<{
    id?: string;
    toolName?: string;
    result?: unknown;
    output?: unknown;
  }> | null;
} {
  if (!isRecord(result)) {
    return {};
  }

  const text = typeof result.text === "string" ? result.text : null;

  const toolCalls = Array.isArray(result.toolCalls)
    ? result.toolCalls.map((raw) => {
        const call = isRecord(raw) ? raw : {};
        return {
          id: coerceString(call.id),
          name: coerceString(call.name),
          toolName: coerceString(call.toolName),
          args: call.args,
        };
      })
    : null;

  const toolResults = Array.isArray(result.toolResults)
    ? result.toolResults.map((raw) => {
        const item = isRecord(raw) ? raw : {};
        return {
          id: coerceString(item.id),
          toolName: coerceString(item.toolName),
          result: item.result,
          output: item.output,
        };
      })
    : null;

  return { text, toolCalls, toolResults };
}

/**
 * Persist non-stream generate results to the durable workflow store for replay.
 */
export async function persistResult(args: PersistArgs): Promise<string | null> {
  const runId = crypto.randomUUID();
  try {
    const input = (args.input ?? {}) as Record<string, unknown>;
    const projectId = args.projectId ?? (input.projectId as string | undefined);

    await workflowRepo.createRun({
      id: runId,
      userId: args.userId,
      projectId,
      workflowId: `${args.kind}-generate`,
      status: "completed",
      inputData: args.input,
      stateData: null,
    });
    
    // Use async normalization with GenUI enrichment
    const schemaCtx: Partial<SchemaContext> = args.schemaContext ?? {
      userId: args.userId,
      projectId,
      surface: "web",
      mode: args.kind === "assistant" ? "assistant" : "workflow",
    };
    const uiMessages = await normalizeToUiMessagesAsync(
      coerceGenerateResult(args.result),
      schemaCtx
    );
    const eventId = makeEventId({
      runId,
      type: "ui-message",
      data: uiMessages,
    });
    await workflowRepo.appendEvent({
      runId,
      eventId,
      eventType: "ui-message",
      eventData: wrapEventEnvelope({
        id: eventId,
        type: "ui-message",
        resource: "user",
        data: uiMessages,
      }),
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
