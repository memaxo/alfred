import * as conversationRepo from "@alfred/db/repo/conversation";
import * as userRepo from "@alfred/db/repo/user";
import * as workflowRepo from "@alfred/db/repo/workflow";
import {
  inferDomainPreferences,
  inferPreferencesFromFeedback,
  inferResponsePreferences,
} from "@alfred/agent/preference/inference";
import { mergePreferences } from "@alfred/agent/preference/merger";
import { invalidatePreferenceCache } from "@alfred/agent/preference/loader";
import { buildTools } from "@alfred/agent";
import type {
  ConversationHistory,
  FeedbackHistory,
  ToolCallHistory,
} from "@alfred/type/preference";
import { limitUiMessages } from "@alfred/type/history";
import type { UIMessage } from "@alfred/type/stream";
import { validateUIMessages } from "ai";
import { preferenceHistoryPrunedTotal } from "../metrics";

type ToolSet = Record<string, unknown>;

let cachedWorkflowTools: ToolSet | null = null;

function getWorkflowTools(): ToolSet {
  if (!cachedWorkflowTools) {
    cachedWorkflowTools = buildTools() as ToolSet;
  }
  return cachedWorkflowTools;
}

type WorkflowToolCallRow = Awaited<
  ReturnType<typeof workflowRepo.getToolCalls>
>[number];

export type PreferenceInferenceOptions = {
  lookbackDays?: number;
  conversationLimit?: number;
  toolLimit?: number;
};

export async function runPreferenceInference(
  userId: string,
  options: PreferenceInferenceOptions = {}
): Promise<void> {
  const lookbackDays = options.lookbackDays ?? 30;
  const conversationLimit = options.conversationLimit ?? 50;
  const toolLimit = options.toolLimit ?? 200;

  const conversations = await loadConversationHistory(
    userId,
    lookbackDays,
    conversationLimit
  );
  const toolCalls = await loadToolCalls(userId, lookbackDays, toolLimit);
  const feedback = await loadFeedback(userId, 500);

  const responsePrefs = inferResponsePreferences(conversations);
  const domainPrefs = inferDomainPreferences(toolCalls);
  const feedbackPrefs = inferPreferencesFromFeedback(feedback);

  const merged = mergePreferences([
    responsePrefs,
    domainPrefs,
    feedbackPrefs,
  ]);

  let updated = false;
  for (const [key, detail] of merged) {
    const confidence = detail.confidence ?? 0;
    if (confidence <= 0.6) {
      continue;
    }

    if (detail.source === "user") {
      continue;
    }

    await userRepo.setPreference(
      userId,
      key,
      detail.value,
      confidence,
      detail.source
    );
    updated = true;
  }

  if (updated) {
    await invalidatePreferenceCache(userId);
  }
}

type SchedulerOptions = {
  intervalMs?: number;
  jitterMs?: number;
  batchSize?: number;
  lookbackDays?: number;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

let schedulerHandle: NodeJS.Timeout | null = null;
let running = false;

async function tick(options: Required<SchedulerOptions>) {
  if (running) {
    options.logger.warn?.("preference_inference_tick_skipped_busy");
    return;
  }

  running = true;
  try {
    const userIds = await conversationRepo.getActiveUserIds({
      days: options.lookbackDays,
      limit: options.batchSize,
    });

    for (const userId of userIds) {
      try {
        await runPreferenceInference(userId, {
          lookbackDays: options.lookbackDays,
        });
      } catch (error) {
        options.logger.warn?.("preference_inference_run_failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    running = false;
  }
}

export function startPreferenceInferenceScheduler({
  intervalMs = 6 * 60 * 60 * 1000,
  jitterMs = 60 * 1000,
  batchSize = 25,
  lookbackDays = 30,
  logger = console,
}: SchedulerOptions = {}) {
  if (process.env.SCHED_PREFERENCE_INFERENCE !== "1") {
    logger.info?.(
      "preference_inference_scheduler_disabled",
      "Set SCHED_PREFERENCE_INFERENCE=1 to enable"
    );
    return;
  }

  if (schedulerHandle) {
    logger.warn?.("preference_inference_scheduler_already_running");
    return;
  }

  const run = () =>
    tick({ intervalMs, jitterMs, batchSize, lookbackDays, logger });

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    schedulerHandle = setTimeout(async () => {
      await run();
      scheduleNext();
    }, delay);
  };

  void run().then(scheduleNext, (error) => {
    logger.error?.("preference_inference_scheduler_start_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    scheduleNext();
  });
}

export function stopPreferenceInferenceScheduler() {
  if (schedulerHandle) {
    clearTimeout(schedulerHandle);
    schedulerHandle = null;
  }
}

export async function validateConversationMessages(options: {
  messages: UIMessage[];
  conversationId: string;
  userId: string;
  logger?: Pick<Console, "warn">;
  tools?: ToolSet;
}): Promise<UIMessage[] | null> {
  try {
    const toolset = (options.tools ?? getWorkflowTools()) as Parameters<
      typeof validateUIMessages
    >[0]["tools"];
    const validated = await validateUIMessages({
      messages: options.messages,
      tools: toolset,
    });
    return validated as UIMessage[];
  } catch (error) {
    options.logger?.warn?.("preference_inference_invalid_history", {
      conversationId: options.conversationId,
      userId: options.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function loadConversationHistory(
  userId: string,
  days: number,
  limit: number
): Promise<ConversationHistory[]> {
  const rows = await conversationRepo.getConversations(userId, {
    days,
    limit,
  });

  const histories: ConversationHistory[] = [];
  for (const convo of rows) {
    const history = await conversationRepo.getConversationHistory(
      convo.id,
      userId
    );
    if (!history) continue;
    const validated = await validateConversationMessages({
      messages: (history.messages ?? []) as UIMessage[],
      conversationId: history.conversation.id,
      userId,
      logger: console,
      tools: getWorkflowTools(),
    });
    if (!validated || validated.length === 0) {
      continue;
    }
    const limited = limitUiMessages(validated);
    const dropped = validated.length - limited.length;
    if (dropped > 0) {
      preferenceHistoryPrunedTotal.inc({ source: "inference" }, dropped);
    }
    if (limited.length === 0) {
      continue;
    }

    histories.push({
      id: history.conversation.id,
      userId: history.conversation.userId,
      title: history.conversation.title ?? undefined,
      messages: limited,
      createdAt: history.conversation.created ?? new Date(),
      updatedAt: history.conversation.updated ?? new Date(),
    });
  }

  return histories;
}

async function loadToolCalls(
  userId: string,
  days: number,
  limit: number
): Promise<ToolCallHistory[]> {
  const rows = await workflowRepo.getToolCalls(userId, {
    days,
    limit,
  });

  return rows.map((row: WorkflowToolCallRow) => ({
    eventId: row.eventId,
    userId,
    toolName: row.toolName ?? "tool",
    domain: inferDomain(row.toolName),
    parameters: row.args ?? {},
    timestamp: row.timestamp,
  }));
}

async function loadFeedback(
  userId: string,
  limit: number
): Promise<FeedbackHistory[]> {
  const rows = await userRepo.getFeedback(userId, limit, 0);
  return rows.map((row) => ({
    feedbackId: row.id,
    userId: row.userId,
    messageId: row.messageId ?? undefined,
    conversationId: row.conversationId ?? undefined,
    rating: row.rating ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    timestamp: row.created ?? new Date(),
  }));
}

function inferDomain(toolName?: string): string {
  if (!toolName) return "general";
  const [segment] = toolName.split(".");
  return segment ?? "general";
}
