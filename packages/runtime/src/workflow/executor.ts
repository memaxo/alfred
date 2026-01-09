import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import type { WorkflowInputPayload } from "@alfred/agent/workflow/schema";
import * as conversationRepo from "@alfred/db/repo/conversation";
import { logger } from "@alfred/logger";
import type { Obligation, WorkflowEvent } from "@alfred/type";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import { TRPCError } from "@trpc/server";
import type { LanguageModel } from "ai";
import { createRuntime } from "../core";
import type { RuntimeInput } from "../types";

export function createWorkflowExecutor(
  inputParam: WorkflowInputPayload,
  abortController: AbortController,
  history?: WorkflowEvent[],
  runtimeContext?: RuntimeContext<Record<string, unknown>>
) {
  // Cast model type to resolve version mismatch between @ai-sdk/openai and ai package
  // that can occur due to multiple versions of @ai-sdk/provider in the tree.
  const model = openai(
    process.env.OPENAI_MODEL_PLAN ?? "gpt-4o"
  ) as unknown as LanguageModel;

  const runtimeInput: RuntimeInput = {
    requirement: inputParam.requirement,
    auto: inputParam.auto,
    workspace: inputParam.workspace,
    repoBase: inputParam.repoBase,
    mode: inputParam.mode,
    interactive: inputParam.interactive,
    context: inputParam.context,
    planId: inputParam.planId,
    linear:
      inputParam.linear?.sessionId && inputParam.authzLinear
        ? {
            sessionId: inputParam.linear.sessionId,
            space: inputParam.linear.space,
            authz: inputParam.authzLinear,
            issueId: inputParam.linear.issueId,
          }
        : undefined,
  };
  return createRuntime({
    input: runtimeInput,
    model,
    signal: abortController.signal,
    stepTimeoutMs: 5 * 60 * 1000,
    workflowTimeoutMs: 30 * 60 * 1000,
    runId: inputParam.runId,
    history,
    runtimeContext,
  });
}

export function coerceRecord(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function requiresBiometric(obligations: Obligation[] | undefined): boolean {
  if (!obligations || obligations.length === 0) {
    return false;
  }
  return obligations.some((obligation) => {
    if (obligation.type === "biometric") {
      return true;
    }
    const metadata = obligation.metadata as Record<string, unknown> | null;
    return metadata?.code === "requireBio";
  });
}

export function ensureObligations(ctx: {
  policy?: { obligations: Obligation[] };
}) {
  const obligations = ctx.policy?.obligations ?? [];
  if (requiresBiometric(obligations)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "biometric_required",
      cause: obligations,
    });
  }
}

export function deriveWorkflowTitle(requirement: string): string | undefined {
  const trimmed = requirement.trim();
  if (!trimmed) {
    return;
  }
  const limit = 80;
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 3)}...`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function stableUuidFromSeed(seed: string): string {
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  const chars = digest.split("");
  chars[12] = "4"; // UUID version 4
  const variant = (Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8;
  chars[16] = variant.toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

export function ensureUuid(value: string | undefined, seed: string): string {
  if (typeof value === "string" && UUID_PATTERN.test(value)) {
    return value;
  }
  return stableUuidFromSeed(seed);
}

export function createRequirementMessage(
  input: WorkflowInputPayload,
  runId: string
): UIMessage {
  const workflowMessageKey = `${runId}:requirement`;
  return {
    id: ensureUuid(undefined, workflowMessageKey),
    role: "user",
    parts: [{ type: "text", text: input.requirement }],
    metadata: {
      workflowMessageKey,
      auto: input.auto,
      workspace: input.workspace ?? null,
      repoBase: input.repoBase ?? null,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function ensureWorkflowConversation(options: {
  userId: string;
  workflowId: string;
  title?: string;
  projectId?: string;
}) {
  const existing = await conversationRepo.getConversationByWorkflow(
    options.userId,
    options.workflowId
  );
  if (existing) {
    return { conversation: existing, created: false };
  }

  try {
    const conversation = await conversationRepo.createConversation(
      options.userId,
      options.title,
      options.workflowId,
      options.projectId
    );
    return { conversation, created: true };
  } catch (error) {
    const fallback = await conversationRepo.getConversationByWorkflow(
      options.userId,
      options.workflowId
    );
    if (fallback) {
      return { conversation: fallback, created: false };
    }
    throw error;
  }
}

type WorkflowMetadata = {
  workflowMessageKey?: string;
  auto?: string;
  workspace?: string | null;
  repoBase?: string | null;
  createdAt?: string;
  workflowEventType?: string;
  workflowEventId?: string;
  [key: string]: unknown;
};

export async function persistWorkflowMessages(options: {
  userId: string;
  conversationId: string;
  messages: UIMessage[];
  persistedKeys: Set<string>;
  runId: string;
  baseId?: string;
  eventType?: string;
  eventId?: string;
}): Promise<number> {
  const {
    userId,
    conversationId,
    messages,
    persistedKeys,
    runId,
    baseId,
    eventType,
    eventId,
  } = options;
  let persistedCount = 0;
  for (let index = 0; index < messages.length; index += 1) {
    const original = messages[index];
    if (!original) {
      continue;
    }

    const metadata = (original.metadata ?? {}) as WorkflowMetadata;

    const metadataKey =
      typeof metadata.workflowMessageKey === "string" &&
      metadata.workflowMessageKey.length > 0
        ? metadata.workflowMessageKey
        : null;

    const dedupeKey = baseId
      ? `${baseId}:${index}`
      : metadataKey
        ? metadataKey
        : typeof original.id === "string" && original.id.length > 0
          ? original.id
          : `${runId}:${index}`;

    if (persistedKeys.has(dedupeKey)) {
      continue;
    }

    const messageId = ensureUuid(
      typeof original.id === "string" ? original.id : undefined,
      dedupeKey
    );

    const normalized: UIMessage = {
      ...original,
      id: messageId,
      parts: Array.isArray(original.parts) ? original.parts : [],
      metadata: {
        ...metadata,
        workflowMessageKey: metadataKey ?? dedupeKey,
        ...(eventType ? { workflowEventType: eventType } : {}),
        ...(eventId ? { workflowEventId: eventId } : {}),
      },
    };

    try {
      await conversationRepo.createMessage(userId, conversationId, normalized);
      persistedKeys.add(dedupeKey);
      persistedCount += 1;
    } catch (error) {
      logger.warn("workflow_message_persist_failed", {
        runId,
        conversationId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return persistedCount;
}
