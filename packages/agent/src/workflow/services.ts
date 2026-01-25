import type { Obligation } from "@alfred/type";
import type { UIMessage } from "@alfred/type/stream";
import type { z } from "zod";

import * as conversationRepo from "@alfred/db/repo/conversation";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";

import type { WorkflowInputPayload, workflowInput } from "./schema.js";

export type { WorkflowInputPayload };

interface WorkflowResourceDescriptor {
  kind: "workflow";
  id: string;
  attrs: Record<string, unknown>;
}

export const mapWorkflowResource = (
  raw: unknown
): WorkflowResourceDescriptor => {
  const input = raw as Partial<z.infer<typeof workflowInput>>;
  return {
    attrs: {
      auto: input?.auto ?? "read",
      mode: input?.mode ?? "sequential",
    },
    id: "plan",
    kind: "workflow" as const,
  };
};

export const mapWorkflowRunResource = (
  raw: unknown
): WorkflowResourceDescriptor => {
  const input = raw as { runId?: string };
  return {
    attrs: {},
    id: input?.runId ?? "run",
    kind: "workflow" as const,
  };
};

// Re-export from canonical location for backward compatibility
export { coerceRecord } from "../utils/coerce";

function requiresBiometric(obligations: Obligation[] | undefined): boolean {
  if (!obligations || obligations.length === 0) {
    return false;
  }
  return obligations.some(
    (obligation) =>
      obligation.type === "biometric" ||
      (typeof obligation.metadata?.code === "string" &&
        obligation.metadata.code === "requireBio")
  );
}

export function ensureObligations(ctx: {
  policy?: { obligations: Obligation[] };
}) {
  const obligations = ctx.policy?.obligations ?? [];
  if (requiresBiometric(obligations)) {
    throw new TRPCError({
      cause: obligations,
      code: "PRECONDITION_FAILED",
      message: "biometric_required",
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
  const chars = [...digest];
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
    metadata: {
      workflowMessageKey,
      auto: input.auto,
      workspace: input.workspace ?? null,
      repoBase: input.repoBase ?? null,
      createdAt: new Date().toISOString(),
    },
    parts: [{ type: "text", text: input.requirement }],
    role: "user",
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
    const metadataObject = (original.metadata ?? {}) as {
      workflowMessageKey?: unknown;
      [key: string]: unknown;
    };

    const metadataKey =
      typeof metadataObject.workflowMessageKey === "string" &&
      metadataObject.workflowMessageKey.length > 0
        ? metadataObject.workflowMessageKey
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
        ...metadataObject,
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
        conversationId,
        error: error instanceof Error ? error.message : String(error),
        messageId,
        runId,
      });
    }
  }
  return persistedCount;
}
