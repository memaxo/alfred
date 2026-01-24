/**
 * Review SLA Alert Scheduler
 *
 * Checks for pending reviews approaching or exceeding their SLA deadlines
 * and publishes notifications to users.
 *
 * SLA Thresholds:
 * - Critical: 1 hour
 * - High: 4 hours
 * - Medium: 24 hours
 * - Low: 72 hours
 *
 * Alerts are sent at 75% and 100% of SLA time.
 */

import { db } from "@alfred/db/client";
import {
  reviewQueue,
  type ReviewPriority,
  type ReviewType,
} from "@alfred/db/schema/review";
import { eq } from "drizzle-orm";

import { publishReviewSlaWarning } from "../services/notify";

const SLA_MINUTES: Record<ReviewPriority, number> = {
  critical: 60,
  high: 240,
  low: 4320,
  medium: 1440,
};

const WARNING_THRESHOLD = 0.75; // Alert at 75% of SLA

export interface ReviewSlaSchedulerOptions {
  intervalMs?: number;
  logger?: Pick<Console, "info" | "error" | "warn">;
  now?: () => Date;
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Check for SLA breaches and send warnings
 */
async function checkSlaBreaches(
  logger: Pick<Console, "info" | "error" | "warn">,
  now: () => Date
): Promise<{ checked: number; warnings: number }> {
  const currentTime = now();
  let warnings = 0;

  // Get all pending reviews
  const pendingReviews = await db
    .select({
      createdAt: reviewQueue.createdAt,
      id: reviewQueue.id,
      priority: reviewQueue.priority,
      reviewType: reviewQueue.reviewType,
      subjectData: reviewQueue.subjectData,
      userId: reviewQueue.userId,
    })
    .from(reviewQueue)
    .where(eq(reviewQueue.status, "pending"));

  for (const review of pendingReviews) {
    if (!review.createdAt) {
      continue;
    }

    const priority = review.priority as ReviewPriority;
    const slaMinutes = SLA_MINUTES[priority] ?? SLA_MINUTES.medium;
    const warningMinutes = Math.floor(slaMinutes * WARNING_THRESHOLD);

    const waitingMs =
      currentTime.getTime() - new Date(review.createdAt).getTime();
    const waitingMinutes = Math.floor(waitingMs / 60_000);

    // Check if we should send a warning (at 75% or 100% threshold)
    const atWarningThreshold =
      waitingMinutes >= warningMinutes && waitingMinutes < slaMinutes;
    const atBreachThreshold = waitingMinutes >= slaMinutes;

    if (atWarningThreshold || atBreachThreshold) {
      const summary = getSummary(
        review.reviewType as ReviewType,
        review.subjectData
      );

      publishReviewSlaWarning(review.userId, {
        id: review.id,
        priority,
        reviewType: review.reviewType as ReviewType,
        slaMinutes,
        summary,
        waitingMinutes,
      });

      warnings++;
      logger.info?.(`[review-sla] SLA warning sent for review ${review.id}`, {
        breached: atBreachThreshold,
        priority,
        slaMinutes,
        waitingMinutes,
      });
    }
  }

  return { checked: pendingReviews.length, warnings };
}

function getSummary(reviewType: ReviewType, subjectData: unknown): string {
  const data = subjectData as Record<string, unknown>;
  switch (reviewType) {
    case "tool_execution": {
      return `Tool: ${data.toolName ?? "unknown"}`;
    }
    case "memory": {
      return `Memory: ${(data.fact as string)?.slice(0, 30) ?? "..."}`;
    }
    case "code": {
      return `PR #${data.prNumber ?? "?"}: ${data.prTitle ?? "Code review"}`;
    }
    case "workflow": {
      return `Workflow: ${data.decision ?? "decision"}`;
    }
    case "message": {
      return `Message review`;
    }
    default: {
      return "Review";
    }
  }
}

/**
 * Start the SLA check scheduler
 */
export function startReviewSlaScheduler(
  options: ReviewSlaSchedulerOptions = {}
): void {
  if (running) {
    options.logger?.warn?.("[review-sla] Scheduler already running");
    return;
  }

  const {
    intervalMs = 300_000,
    logger = console,
    now = () => new Date(),
  } = options;

  running = true;
  logger.info?.(
    `[review-sla] Starting scheduler with ${intervalMs}ms interval`
  );

  // Run immediately
  checkSlaBreaches(logger, now).catch((error) => {
    logger.error?.("[review-sla] Initial check failed", { error });
  });

  // Schedule periodic checks
  schedulerHandle = setInterval(() => {
    checkSlaBreaches(logger, now).catch((error) => {
      logger.error?.("[review-sla] Scheduled check failed", { error });
    });
  }, intervalMs);

  // Unref to not block process exit
  if (schedulerHandle.unref) {
    schedulerHandle.unref();
  }
}

/**
 * Stop the SLA check scheduler
 */
export function stopReviewSlaScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
  running = false;
}

/**
 * Check if scheduler is running
 */
export function isReviewSlaSchedulerRunning(): boolean {
  return running;
}
