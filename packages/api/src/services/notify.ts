import type { AttentionItem } from "@alfred/db/schema/attention";
import type { DeltaBrief } from "@alfred/db/schema/delta";
import { logger } from "@alfred/logger";

export type NotifyEvent =
  | {
      type: "attention";
      data: {
        id: string;
        workflowRunId: string | null;
        kind: string;
        status: string;
        urgency: string;
        title: string | null;
        body: string | null;
        createdAt: string | null;
        updatedAt: string | null;
      };
    }
  | {
      type: "delta";
      data: {
        id: string;
        workflowRunId: string | null;
        scope: string;
        summaryText: string;
        createdAt: string | null;
      };
    }
  | { type: "ping"; data: { message: string; timestamp: number } };

type Subscriber = (event: NotifyEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribeToNotify(userId: string, cb: Subscriber): () => void {
  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }
  subscribers.get(userId)?.add(cb);

  logger.debug("notify_subscribed", { userId });

  return () => {
    subscribers.get(userId)?.delete(cb);
    if (subscribers.get(userId)?.size === 0) {
      subscribers.delete(userId);
    }
    logger.debug("notify_unsubscribed", { userId });
  };
}

export function notifyStatus(userId: string): { inAppSubscribers: number; pushConfigured: boolean } {
  return {
    inAppSubscribers: subscribers.get(userId)?.size ?? 0,
    pushConfigured: false,
  };
}

function publish(userId: string, event: NotifyEvent): void {
  const set = subscribers.get(userId);
  if (!set || set.size === 0) {
    return;
  }

  for (const cb of set) {
    try {
      cb(event);
    } catch (error) {
      logger.warn("notify_callback_failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function normalizeAttentionPayload(
  item: AttentionItem
): Extract<NotifyEvent, { type: "attention" }>["data"] {
  return {
    id: item.id,
    workflowRunId: item.workflowRunId,
    kind: item.kind,
    status: item.status,
    urgency: item.urgency,
    title: item.title,
    body: item.body,
    createdAt: item.createdAt?.toISOString() ?? null,
    updatedAt: item.updatedAt?.toISOString() ?? null,
  };
}

function normalizeDeltaPayload(
  brief: DeltaBrief
): Extract<NotifyEvent, { type: "delta" }>["data"] {
  return {
    id: brief.id,
    workflowRunId: brief.workflowRunId,
    scope: brief.scope,
    summaryText: brief.summaryText,
    createdAt: brief.createdAt?.toISOString() ?? null,
  };
}

export function publishAttention(userId: string, item: AttentionItem): void {
  publish(userId, {
    type: "attention",
    data: normalizeAttentionPayload(item),
  });
}

export function publishDelta(userId: string, brief: DeltaBrief): void {
  publish(userId, {
    type: "delta",
    data: normalizeDeltaPayload(brief),
  });
}

export function publishPing(userId: string, message: string): void {
  publish(userId, { type: "ping", data: { message, timestamp: Date.now() } });
}

