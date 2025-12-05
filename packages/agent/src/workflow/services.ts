import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import * as conversationRepo from "@alfred/db/repo/conversation";
import { logger } from "@alfred/logger";
import type { Obligation, WorkflowEvent } from "@alfred/type";
import type { RuntimeContext } from "@alfred/type/runtime-context";
import type { UIMessage } from "@alfred/type/stream";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { runPlanV6 } from "./runner";

// Type for the runtime executor (defined here to avoid circular dependency)
type RuntimeExecutor = {
  runId: string;
  summary: string;
  stream: AsyncGenerator<WorkflowEvent, void, void>;
  resume: (payload: { resumeData?: unknown }) => Promise<void>;
  cancel: () => Promise<void>;
};

// Dynamic import to avoid circular dependency with @alfred/runtime
// Using a variable to prevent TypeScript from statically analyzing the import
async function getCreateRuntime(): Promise<(opts: unknown) => RuntimeExecutor> {
  const modulePath = "@alfred/runtime";
  // biome-ignore lint/security/noGlobalEval: Required to prevent TypeScript static analysis
  const runtime = await (eval(`import("${modulePath}")`) as Promise<{
    createRuntime: (opts: unknown) => RuntimeExecutor;
  }>);
  return runtime.createRuntime;
}

const policyObligationSchema = z.object({
  type: z.string().min(1),
  reason: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const workflowInput = z.object({
  runId: z.string().optional(), // Added for recovery/join
  requirement: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("low"),
  mode: z.enum(["sequential", "parallel"]).default("sequential"),
  interactive: z.boolean().optional(),
  authz: z.string().optional(),
  cw: z.string().optional(),
  workspace: z.string().optional(),
  repoBase: z.string().optional(),
  profile: z.string().min(1).optional(),
  authzDeploy: z.string().optional(),
  authzLinear: z.string().optional(),
  preview: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url().optional(),
      tls: z.boolean().optional(),
    })
    .optional(),
  previewBuild: z
    .object({
      context: z.string().min(1),
      dockerfile: z.string().optional(),
      image: z.string().optional(),
      port: z.number().int().min(1).max(65_535).optional(),
      env: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  promote: z
    .object({
      host: z.string().min(1),
      upstream: z.string().url(),
      tls: z.boolean().optional(),
    })
    .optional(),
  linear: z
    .object({
      space: z.string().min(1),
      teamId: z.string().optional(),
      sessionId: z.string().min(1).optional(),
      issueId: z.string().min(1).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      issueUrl: z.string().url().optional(),
    })
    .optional(),
  context: z
    .object({
      enable: z.boolean().optional(),
      web: z.boolean().optional(),
      topK: z.number().int().min(1).max(100).optional(),
      maxTokens: z.number().int().min(2000).max(200_000).optional(),
      exts: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
      seeds: z.array(z.string().url()).optional(),
    })
    .optional(),
  userId: z.string().min(1).optional(),
  policyObligations: z.array(policyObligationSchema).optional(),
});

export type WorkflowInputPayload = z.infer<typeof workflowInput>;

export function shouldUseWorkflowRuntime(): boolean {
  return process.env.USE_WORKFLOW_RUNTIME === "true";
}

export async function createWorkflowExecutor(
  input: z.infer<typeof workflowInput>,
  abortController: AbortController,
  history?: WorkflowEvent[],
  runtimeContext?: RuntimeContext<Record<string, unknown>>
) {
  if (shouldUseWorkflowRuntime()) {
    const model = openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o");
    const createRuntime = await getCreateRuntime();

    return createRuntime({
      input: {
        requirement: input.requirement,
        auto: input.auto,
        workspace: input.workspace,
        repoBase: input.repoBase,
        mode: input.mode,
        interactive: input.interactive,
        context: input.context,
        linear:
          input.linear?.sessionId && input.authzLinear
            ? {
                sessionId: input.linear.sessionId,
                space: input.linear.space,
                authz: input.authzLinear,
              }
            : undefined,
      },
      model,
      signal: abortController.signal,
      stepTimeoutMs: 5 * 60 * 1000,
      workflowTimeoutMs: 30 * 60 * 1000,
      runId: input.runId, // Pass runId if resuming
      history, // Pass history if resuming
      runtimeContext,
    });
  }
  return runPlanV6(
    {
      requirement: input.requirement,
      auto: input.auto,
      workspace: input.workspace,
      repoBase: input.repoBase,
      mode: input.mode,
      context: input.context,
      ...(input.linear?.sessionId && input.authzLinear
        ? {
            linear: {
              sessionId: input.linear.sessionId,
              space: input.linear.space,
              authz: input.authzLinear,
            },
          }
        : {}),
    },
    {
      signal: abortController.signal,
      stepTimeoutMs: 5 * 60 * 1000,
      workflowTimeoutMs: 30 * 60 * 1000,
    }
  );
}

export const mapWorkflowResource = (raw: unknown) => {
  const input = raw as Partial<z.infer<typeof workflowInput>>;
  return {
    kind: "workflow" as const,
    id: "plan",
    attrs: {
      auto: input?.auto ?? "read",
      mode: input?.mode ?? "sequential",
    },
  };
};

export const mapWorkflowRunResource = (raw: unknown) => {
  const input = raw as { runId?: string };
  return {
    kind: "workflow" as const,
    id: input?.runId ?? "run",
    attrs: {},
  };
};

export function coerceRecord(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

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
      options.workflowId
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
        runId,
        conversationId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return persistedCount;
}
