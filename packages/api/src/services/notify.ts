import { type AttentionItem } from "@alfred/db/schema/attention";
import { type DeltaBrief } from "@alfred/db/schema/delta";
import { type ReviewPriority, type ReviewType } from "@alfred/db/schema/review";
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
  | {
      type: "review";
      data: {
        id: string;
        reviewType: ReviewType;
        priority: ReviewPriority;
        summary: string;
        blockedCount: number;
        createdAt: string | null;
        isUrgent: boolean;
      };
    }
  | {
      type: "review_sla_warning";
      data: {
        id: string;
        reviewType: ReviewType;
        priority: ReviewPriority;
        summary: string;
        waitingMinutes: number;
        slaMinutes: number;
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

export function notifyStatus(userId: string): {
  inAppSubscribers: number;
  pushConfigured: boolean;
} {
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
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    }
  }
}

function normalizeAttentionPayload(
  item: AttentionItem
): Extract<NotifyEvent, { type: "attention" }>["data"] {
  return {
    body: item.body,
    createdAt: item.createdAt?.toISOString() ?? null,
    id: item.id,
    kind: item.kind,
    status: item.status,
    title: item.title,
    updatedAt: item.updatedAt?.toISOString() ?? null,
    urgency: item.urgency,
    workflowRunId: item.workflowRunId,
  };
}

function normalizeDeltaPayload(
  brief: DeltaBrief
): Extract<NotifyEvent, { type: "delta" }>["data"] {
  return {
    createdAt: brief.createdAt?.toISOString() ?? null,
    id: brief.id,
    scope: brief.scope,
    summaryText: brief.summaryText,
    workflowRunId: brief.workflowRunId,
  };
}

export function publishAttention(userId: string, item: AttentionItem): void {
  publish(userId, {
    data: normalizeAttentionPayload(item),
    type: "attention",
  });
}

export function publishDelta(userId: string, brief: DeltaBrief): void {
  publish(userId, {
    data: normalizeDeltaPayload(brief),
    type: "delta",
  });
}

export function publishPing(userId: string, message: string): void {
  publish(userId, { data: { message, timestamp: Date.now() }, type: "ping" });
}

export function publishReviewCreated(
  userId: string,
  review: {
    id: string;
    reviewType: ReviewType;
    priority: ReviewPriority;
    summary: string;
    blockedCount: number;
    createdAt: Date | null;
  }
): void {
  const isUrgent = review.priority === "critical" || review.priority === "high";
  publish(userId, {
    data: {
      id: review.id,
      reviewType: review.reviewType,
      priority: review.priority,
      summary: review.summary,
      blockedCount: review.blockedCount,
      createdAt: review.createdAt?.toISOString() ?? null,
      isUrgent,
    },
    type: "review",
  });
}

export function publishReviewSlaWarning(
  userId: string,
  review: {
    id: string;
    reviewType: ReviewType;
    priority: ReviewPriority;
    summary: string;
    waitingMinutes: number;
    slaMinutes: number;
  }
): void {
  publish(userId, {
    data: {
      id: review.id,
      reviewType: review.reviewType,
      priority: review.priority,
      summary: review.summary,
      waitingMinutes: review.waitingMinutes,
      slaMinutes: review.slaMinutes,
    },
    type: "review_sla_warning",
  });
}
