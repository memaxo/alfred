/**
 * ALFRED Review Repository
 * Database operations for review queue, analytics, and auto-approve patterns
 */

import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";

import {
  cacheAnalytics,
  cachePendingCount,
  cacheRiskSummary,
  getCachedAnalytics,
  getCachedPendingCount,
  getCachedRiskSummary,
  invalidateTemplateCache,
  invalidateUserReviewCache,
} from "../cache/review";
import { db } from "../client";
import {
  measureQuery,
  reviewCreationDurationSeconds,
  reviewSubmissionDurationSeconds,
  reviewSubmissionsTotal,
} from "../metrics";
import {
  type AuditAction,
  type BlockedType,
  type ReviewDependencyInsert,
  type ReviewDependencyRow,
  type ReviewPriority,
  type ReviewQueueInsert,
  type ReviewQueueRow,
  type ReviewStatus,
  type ReviewSubjectData,
  type ReviewTemplateInsert,
  type ReviewTemplateRow,
  type ReviewType,
  reviewAnalytics,
  reviewAuditLog,
  reviewAutoApprovePatterns,
  reviewDependencies,
  reviewQueue,
  reviewTemplates,
  type TemplateType,
  type VerdictData,
} from "../schema/review";

// Auto-approve threshold (number of approvals needed)
const AUTO_APPROVE_THRESHOLD = 5;

/**
 * Get pending reviews for a user
 */
export async function getReviewQueue(
  userId: string,
  options: {
    reviewType?: ReviewType | "all";
    status?: ReviewStatus | ReviewStatus[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<ReviewQueueRow[]> {
  const { reviewType, status = "pending", limit = 10, offset = 0 } = options;

  const conditions = [eq(reviewQueue.userId, userId)];

  if (Array.isArray(status)) {
    conditions.push(inArray(reviewQueue.status, status));
  } else {
    conditions.push(eq(reviewQueue.status, status));
  }

  if (reviewType && reviewType !== "all") {
    conditions.push(eq(reviewQueue.reviewType, reviewType));
  }

  return await measureQuery("review", "getReviewQueue", async () => {
    return await db
      .select()
      .from(reviewQueue)
      .where(and(...conditions))
      .orderBy(
        sql`CASE 
          WHEN ${reviewQueue.priority} = 'critical' THEN 1
          WHEN ${reviewQueue.priority} = 'high' THEN 2
          WHEN ${reviewQueue.priority} = 'medium' THEN 3
          WHEN ${reviewQueue.priority} = 'low' THEN 4
          ELSE 5
        END`,
        desc(reviewQueue.createdAt)
      )
      .limit(limit)
      .offset(offset);
  });
}

/**
 * Get count of pending reviews (with Redis caching)
 */
export async function getPendingReviewCount(
  userId: string,
  reviewType?: ReviewType | "all"
): Promise<number> {
  // Only cache "all" type counts (most common case)
  if (!reviewType || reviewType === "all") {
    const cached = await getCachedPendingCount(userId);
    if (cached !== null) {
      return cached;
    }
  }

  const conditions = [
    eq(reviewQueue.userId, userId),
    eq(reviewQueue.status, "pending"),
  ];

  if (reviewType && reviewType !== "all") {
    conditions.push(eq(reviewQueue.reviewType, reviewType));
  }

  const result = await measureQuery(
    "review",
    "getPendingReviewCount",
    async () => {
      return await db
        .select({ count: sql<number>`count(*)` })
        .from(reviewQueue)
        .where(and(...conditions));
    }
  );

  const count = Number(result[0]?.count ?? 0);

  // Cache "all" type counts
  if (!reviewType || reviewType === "all") {
    void cachePendingCount(userId, count);
  }

  return count;
}

/**
 * Get a single review by ID
 */
export async function getReviewById(
  reviewId: string
): Promise<ReviewQueueRow | null> {
  const rows = await db
    .select()
    .from(reviewQueue)
    .where(eq(reviewQueue.id, reviewId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Create a new review in the queue
 */
export async function createReview(
  data: Omit<ReviewQueueInsert, "id" | "createdAt" | "updatedAt">
): Promise<ReviewQueueRow> {
  const start = performance.now();
  // Check if auto-approve is enabled for this pattern
  const patternKey = getPatternKey(data.reviewType, data.subjectData);
  const pattern = await getAutoApprovePattern(
    data.userId,
    data.reviewType,
    patternKey
  );

  const autoApproveEligible = pattern?.enabled ?? false;

  const [row] = await db
    .insert(reviewQueue)
    .values({
      ...data,
      autoApproveEligible,
      expiresAt:
        data.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create review");
  }

  // Invalidate cache
  void invalidateUserReviewCache(data.userId);

  reviewCreationDurationSeconds.observe(
    { type: data.reviewType },
    (performance.now() - start) / 1000
  );

  return row;
}

/**
 * Update review status
 */
export async function updateReviewStatus(
  reviewId: string,
  data: {
    status: ReviewStatus;
    reviewedAt?: Date;
    verdictData?: VerdictData;
  }
): Promise<ReviewQueueRow | null> {
  const [row] = await db
    .update(reviewQueue)
    .set({
      reviewedAt: data.reviewedAt ?? new Date(),
      status: data.status,
      updatedAt: new Date(),
      verdictData: data.verdictData,
    })
    .where(eq(reviewQueue.id, reviewId))
    .returning();

  return row ?? null;
}

/**
 * Submit a review verdict (approve/reject/skip)
 */
export async function submitReview(
  reviewId: string,
  userId: string,
  verdict: "approve" | "reject" | "skip",
  verdictData?: VerdictData
): Promise<ReviewQueueRow | null> {
  const start = performance.now();
  const review = await getReviewById(reviewId);
  if (!review || review.userId !== userId) {
    return null;
  }

  const status: ReviewStatus =
    verdict === "approve"
      ? "approved"
      : verdict === "reject"
        ? "rejected"
        : "skipped";

  const updatedReview = await updateReviewStatus(reviewId, {
    status,
    verdictData,
  });

  if (!updatedReview) {
    return null;
  }

  // Update auto-approve pattern
  const patternKey = getPatternKey(review.reviewType, review.subjectData);
  await updateAutoApprovePattern(
    userId,
    review.reviewType,
    patternKey,
    verdict
  );

  // Update analytics
  await updateAnalytics(userId, review.reviewType, verdict);

  // Invalidate cache
  void invalidateUserReviewCache(userId);

  reviewSubmissionsTotal.inc({ type: review.reviewType, verdict });
  reviewSubmissionDurationSeconds.observe(
    { type: review.reviewType, verdict },
    (performance.now() - start) / 1000
  );

  return updatedReview;
}

/**
 * Delete a review
 */
export async function deleteReview(reviewId: string): Promise<boolean> {
  const result = await db
    .delete(reviewQueue)
    .where(eq(reviewQueue.id, reviewId));
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get auto-approve pattern
 */
export async function getAutoApprovePattern(
  userId: string,
  reviewType: ReviewType,
  patternKey: string
) {
  const rows = await db
    .select()
    .from(reviewAutoApprovePatterns)
    .where(
      and(
        eq(reviewAutoApprovePatterns.userId, userId),
        eq(reviewAutoApprovePatterns.reviewType, reviewType),
        eq(reviewAutoApprovePatterns.patternKey, patternKey)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Update auto-approve pattern based on verdict
 */
async function updateAutoApprovePattern(
  userId: string,
  reviewType: ReviewType,
  patternKey: string,
  verdict: "approve" | "reject" | "skip"
): Promise<void> {
  if (verdict === "skip") {
    return;
  }

  const existing = await getAutoApprovePattern(userId, reviewType, patternKey);

  if (existing) {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (verdict === "approve") {
      updates.approvalCount = sql`${reviewAutoApprovePatterns.approvalCount} + 1`;
      updates.lastApprovalAt = new Date();

      // Enable auto-approve after threshold
      const currentCount = existing.approvalCount ?? 0;
      if (currentCount + 1 >= AUTO_APPROVE_THRESHOLD && !existing.enabled) {
        updates.enabled = true;
        updates.enabledAt = new Date();
      }
    } else {
      updates.rejectionCount = sql`${reviewAutoApprovePatterns.rejectionCount} + 1`;
      // Disable auto-approve on rejection
      if (existing.enabled) {
        updates.enabled = false;
      }
    }

    await db
      .update(reviewAutoApprovePatterns)
      .set(updates)
      .where(eq(reviewAutoApprovePatterns.id, existing.id));
  } else {
    // Create new pattern
    await db.insert(reviewAutoApprovePatterns).values({
      approvalCount: verdict === "approve" ? 1 : 0,
      lastApprovalAt: verdict === "approve" ? new Date() : undefined,
      patternKey,
      rejectionCount: verdict === "reject" ? 1 : 0,
      reviewType,
      userId,
    });
  }
}

/**
 * Generate pattern key from review data
 */
function getPatternKey(
  reviewType: ReviewType,
  subjectData: ReviewSubjectData
): string {
  switch (reviewType) {
    case "tool_execution": {
      const data = subjectData as { toolName?: string };
      return `tool:${data.toolName ?? "unknown"}`;
    }
    case "memory": {
      const data = subjectData as { memoryType?: string };
      return `memory:${data.memoryType ?? "unknown"}`;
    }
    case "message": {
      const data = subjectData as { responseStyle?: string };
      return `message:${data.responseStyle ?? "default"}`;
    }
    case "workflow": {
      const data = subjectData as { decision?: string };
      return `workflow:${data.decision ?? "unknown"}`;
    }
    case "code": {
      const data = subjectData as { source?: string };
      return `code:${data.source ?? "unknown"}`;
    }
    default: {
      return `unknown:${reviewType}`;
    }
  }
}

/**
 * Update analytics for user
 */
async function updateAnalytics(
  userId: string,
  reviewType: ReviewType,
  verdict: "approve" | "reject" | "skip"
): Promise<void> {
  const now = new Date();
  const periodStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);

  // Find or create today's analytics record
  const existing = await db
    .select()
    .from(reviewAnalytics)
    .where(
      and(
        eq(reviewAnalytics.userId, userId),
        eq(reviewAnalytics.periodStart, periodStart)
      )
    )
    .limit(1);

  const updates: Record<string, unknown> = {
    totalReviewed: sql`${reviewAnalytics.totalReviewed} + 1`,
  };

  if (verdict === "approve") {
    updates.totalApproved = sql`${reviewAnalytics.totalApproved} + 1`;
    const typeColumn = `${reviewType}_approved` as keyof typeof reviewAnalytics;
    if (reviewAnalytics[typeColumn]) {
      updates[`${reviewType}Approved`] =
        sql`${reviewAnalytics[typeColumn]} + 1`;
    }
  } else if (verdict === "reject") {
    updates.totalRejected = sql`${reviewAnalytics.totalRejected} + 1`;
    const typeColumn = `${reviewType}_rejected` as keyof typeof reviewAnalytics;
    if (reviewAnalytics[typeColumn]) {
      updates[`${reviewType}Rejected`] =
        sql`${reviewAnalytics[typeColumn]} + 1`;
    }
  } else {
    updates.totalSkipped = sql`${reviewAnalytics.totalSkipped} + 1`;
  }

  if (existing[0]) {
    await db
      .update(reviewAnalytics)
      .set(updates)
      .where(eq(reviewAnalytics.id, existing[0].id));
  } else {
    await db.insert(reviewAnalytics).values({
      userId,
      periodStart,
      periodEnd,
      totalReviewed: 1,
      totalApproved: verdict === "approve" ? 1 : 0,
      totalRejected: verdict === "reject" ? 1 : 0,
      totalSkipped: verdict === "skip" ? 1 : 0,
      [`${reviewType}Approved`]: verdict === "approve" ? 1 : 0,
      [`${reviewType}Rejected`]: verdict === "reject" ? 1 : 0,
    });
  }
}

/**
 * Get analytics for user (with Redis caching)
 */
export async function getAnalytics(
  userId: string,
  options: {
    days?: number;
  } = {}
): Promise<{
  total: {
    reviewed: number;
    approved: number;
    rejected: number;
    skipped: number;
    approvalRate: number;
  };
  byType: Record<
    ReviewType,
    { approved: number; rejected: number; approvalRate: number }
  >;
  autoApprovePatterns: number;
}> {
  const { days = 7 } = options;

  // Check cache first
  const cached = await getCachedAnalytics(userId, days);
  if (cached) {
    return cached as {
      total: {
        reviewed: number;
        approved: number;
        rejected: number;
        skipped: number;
        approvalRate: number;
      };
      byType: Record<
        ReviewType,
        { approved: number; rejected: number; approvalRate: number }
      >;
      autoApprovePatterns: number;
    };
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const analyticsRows = await db
    .select()
    .from(reviewAnalytics)
    .where(
      and(
        eq(reviewAnalytics.userId, userId),
        gt(reviewAnalytics.periodStart, since)
      )
    );

  // Aggregate
  const totals = {
    approved: 0,
    rejected: 0,
    reviewed: 0,
    skipped: 0,
  };

  const byType: Record<ReviewType, { approved: number; rejected: number }> = {
    code: { approved: 0, rejected: 0 },
    memory: { approved: 0, rejected: 0 },
    message: { approved: 0, rejected: 0 },
    tool_execution: { approved: 0, rejected: 0 },
    workflow: { approved: 0, rejected: 0 },
  };

  for (const row of analyticsRows) {
    totals.reviewed += row.totalReviewed ?? 0;
    totals.approved += row.totalApproved ?? 0;
    totals.rejected += row.totalRejected ?? 0;
    totals.skipped += row.totalSkipped ?? 0;

    byType.tool_execution.approved += row.toolApproved ?? 0;
    byType.tool_execution.rejected += row.toolRejected ?? 0;
    byType.memory.approved += row.memoryApproved ?? 0;
    byType.memory.rejected += row.memoryRejected ?? 0;
    byType.message.approved += row.messageApproved ?? 0;
    byType.message.rejected += row.messageRejected ?? 0;
    byType.workflow.approved += row.workflowApproved ?? 0;
    byType.workflow.rejected += row.workflowRejected ?? 0;
    byType.code.approved += row.codeApproved ?? 0;
    byType.code.rejected += row.codeRejected ?? 0;
  }

  // Count enabled auto-approve patterns
  const patternCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewAutoApprovePatterns)
    .where(
      and(
        eq(reviewAutoApprovePatterns.userId, userId),
        eq(reviewAutoApprovePatterns.enabled, true)
      )
    );

  const calculateRate = (approved: number, rejected: number) =>
    approved + rejected > 0
      ? Math.round((approved / (approved + rejected)) * 100)
      : 0;

  const result = {
    autoApprovePatterns: Number(patternCount[0]?.count ?? 0),
    byType: Object.fromEntries(
      Object.entries(byType).map(([type, data]) => [
        type,
        {
          ...data,
          approvalRate: calculateRate(data.approved, data.rejected),
        },
      ])
    ) as Record<
      ReviewType,
      { approved: number; rejected: number; approvalRate: number }
    >,
    total: {
      ...totals,
      approvalRate: calculateRate(totals.approved, totals.rejected),
    },
  };

  // Cache the result
  void cacheAnalytics(userId, days, result);

  return result;
}

/**
 * Check if action should be auto-approved
 */
export async function shouldAutoApprove(
  userId: string,
  reviewType: ReviewType,
  subjectData: ReviewSubjectData,
  confidence: number
): Promise<boolean> {
  // High confidence (>0.95) + low risk = auto-approve
  if (confidence > 0.95) {
    const patternKey = getPatternKey(reviewType, subjectData);
    const pattern = await getAutoApprovePattern(userId, reviewType, patternKey);
    return pattern?.enabled ?? false;
  }

  return false;
}

/**
 * Expire old pending reviews
 */
export async function expireOldReviews(): Promise<number> {
  const now = new Date();

  const result = await db
    .update(reviewQueue)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(eq(reviewQueue.status, "pending"), lt(reviewQueue.expiresAt, now))
    );

  return result.rowCount ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PM-FOCUSED QUERIES (Web Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Risk level based on review type and priority
 */
export type RiskLevel = "high" | "medium" | "low";

/**
 * Blocked review with time-blocked calculation
 */
export interface BlockedReview extends ReviewQueueRow {
  timeBlockedMs: number;
  risk: RiskLevel;
  blockingCount: number;
}

/**
 * Get blocked reviews (pending reviews that may block work)
 */
export async function getBlockedReviews(
  userId: string,
  limit = 20
): Promise<BlockedReview[]> {
  const reviews = await db
    .select()
    .from(reviewQueue)
    .where(
      and(eq(reviewQueue.userId, userId), eq(reviewQueue.status, "pending"))
    )
    .orderBy(
      sql`CASE 
        WHEN ${reviewQueue.priority} = 'critical' THEN 1
        WHEN ${reviewQueue.priority} = 'high' THEN 2
        WHEN ${reviewQueue.priority} = 'medium' THEN 3
        WHEN ${reviewQueue.priority} = 'low' THEN 4
        ELSE 5
      END`,
      desc(reviewQueue.createdAt)
    )
    .limit(limit);

  if (reviews.length === 0) {
    return [];
  }

  // Get blocking counts for all reviews
  const reviewIds = reviews.map((r) => r.id);
  const dependencyCounts = await db
    .select({
      reviewId: reviewDependencies.reviewId,
      count: sql<number>`count(*)::int`,
    })
    .from(reviewDependencies)
    .where(inArray(reviewDependencies.reviewId, reviewIds))
    .groupBy(reviewDependencies.reviewId);

  const countMap = new Map(dependencyCounts.map((d) => [d.reviewId, d.count]));
  const now = Date.now();

  return reviews.map((review) => {
    const createdAt = review.createdAt ?? review.updatedAt ?? new Date();
    return {
      ...review,
      timeBlockedMs: now - new Date(createdAt).getTime(),
      risk: calculateRisk(review),
      blockingCount: countMap.get(review.id) ?? 0,
    };
  });
}

/**
 * Calculate risk level for a review
 */
function calculateRisk(review: ReviewQueueRow): RiskLevel {
  // Critical/high priority = high risk
  if (review.priority === "critical" || review.priority === "high") {
    return "high";
  }

  // Code reviews with bugs = medium/high
  if (review.reviewType === "code") {
    const bugCount = review.bugCount ?? 0;
    if (bugCount > 0) {
      return "high";
    }
    return "medium";
  }

  // Workflow decisions = medium
  if (review.reviewType === "workflow") {
    return "medium";
  }

  // Low confidence = medium risk
  if ((review.confidence ?? 0.5) < 0.7) {
    return "medium";
  }

  return "low";
}

/**
 * Risk summary counts
 */
export interface RiskSummary {
  high: number;
  medium: number;
  low: number;
  total: number;
}

/**
 * Get risk counts for pending reviews (with Redis caching)
 */
export async function getRiskCounts(userId: string): Promise<RiskSummary> {
  // Check cache first
  const cached = await getCachedRiskSummary(userId);
  if (cached) {
    return cached;
  }

  const reviews = await db
    .select()
    .from(reviewQueue)
    .where(
      and(eq(reviewQueue.userId, userId), eq(reviewQueue.status, "pending"))
    );

  const counts = { high: 0, low: 0, medium: 0, total: reviews.length };

  for (const review of reviews) {
    const risk = calculateRisk(review);
    counts[risk]++;
  }

  // Cache the result
  void cacheRiskSummary(userId, counts);

  return counts;
}

export interface TrustProgress {
  approvedCount: number;
  rejectedCount: number;
  trustScore: number;
}

export async function getTrustProgress(userId: string): Promise<TrustProgress> {
  const [row] = await db
    .select({
      approvedCount: sql<number>`SUM(CASE WHEN ${reviewQueue.status} = 'approved' THEN 1 ELSE 0 END)`,
      rejectedCount: sql<number>`SUM(CASE WHEN ${reviewQueue.status} = 'rejected' THEN 1 ELSE 0 END)`,
    })
    .from(reviewQueue)
    .where(eq(reviewQueue.userId, userId));

  const approvedCount = Number(row?.approvedCount ?? 0);
  const rejectedCount = Number(row?.rejectedCount ?? 0);
  const total = approvedCount + rejectedCount;
  const trustScore = total > 0 ? approvedCount / total : 0;

  return { approvedCount, rejectedCount, trustScore };
}

/**
 * Cycle time statistics
 */
export interface CycleTimeStats {
  avgCycleTime: number;
  codeAvg: number;
  toolAvg: number;
  memoryAvg: number;
  workflowAvg: number;
  trend: { date: string; avgMs: number }[];
  slaBreaches: number;
}

/**
 * Get cycle time statistics
 */
export async function getCycleTimeStats(
  userId: string,
  period: "day" | "week" | "month"
): Promise<CycleTimeStats> {
  const periodMs =
    period === "day"
      ? 24 * 60 * 60 * 1000
      : period === "week"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  const since = new Date(Date.now() - periodMs);

  const reviews = await db
    .select()
    .from(reviewQueue)
    .where(
      and(
        eq(reviewQueue.userId, userId),
        gt(reviewQueue.reviewedAt, since),
        sql`${reviewQueue.status} IN ('approved', 'rejected')`
      )
    );

  // Calculate average cycle times
  const cycleTimes = {
    all: [] as number[],
    code: [] as number[],
    memory: [] as number[],
    message: [] as number[],
    tool_execution: [] as number[],
    workflow: [] as number[],
  };

  // SLA: 1 hour for critical, 4 hours for high, 24 hours for medium, 72 hours for low
  const slaMs: Record<ReviewPriority, number> = {
    critical: 60 * 60 * 1000,
    high: 4 * 60 * 60 * 1000,
    low: 72 * 60 * 60 * 1000,
    medium: 24 * 60 * 60 * 1000,
  };

  let slaBreaches = 0;

  for (const review of reviews) {
    if (review.createdAt && review.reviewedAt) {
      const cycleTime =
        new Date(review.reviewedAt).getTime() -
        new Date(review.createdAt).getTime();
      cycleTimes.all.push(cycleTime);
      const typeKey = review.reviewType as keyof typeof cycleTimes;
      if (typeKey in cycleTimes) {
        cycleTimes[typeKey].push(cycleTime);
      }

      // Check SLA breach
      const sla = slaMs[review.priority as ReviewPriority] ?? slaMs.medium;
      if (cycleTime > sla) {
        slaBreaches++;
      }
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Build trend data (group by day)
  const trendMap = new Map<string, number[]>();
  for (const review of reviews) {
    if (review.createdAt && review.reviewedAt) {
      const date = new Date(review.reviewedAt).toISOString().split("T")[0];
      const cycleTime =
        new Date(review.reviewedAt).getTime() -
        new Date(review.createdAt).getTime();
      const bucket = trendMap.get(date);
      if (bucket) {
        bucket.push(cycleTime);
      } else {
        trendMap.set(date, [cycleTime]);
      }
    }
  }

  const trend = [...trendMap.entries()]
    .map(([date, times]) => ({
      avgMs: avg(times),
      date,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    avgCycleTime: avg(cycleTimes.all),
    codeAvg: avg(cycleTimes.code),
    memoryAvg: avg(cycleTimes.memory),
    slaBreaches,
    toolAvg: avg(cycleTimes.tool_execution),
    trend,
    workflowAvg: avg(cycleTimes.workflow),
  };
}

/**
 * Activity event for the feed
 */
export interface ActivityEvent {
  id: string;
  type: "created" | "approved" | "rejected" | "auto_approved";
  reviewId: string;
  summary: string;
  reviewType: ReviewType;
  timestamp: Date;
  agent?: string;
}

/**
 * Get recent activity feed
 */
export async function getActivityFeed(
  userId: string,
  options: { limit?: number; since?: Date } = {}
): Promise<ActivityEvent[]> {
  const { limit = 20, since } = options;

  const conditions = [eq(reviewQueue.userId, userId)];

  if (since) {
    conditions.push(gt(reviewQueue.updatedAt, since));
  }

  const reviews = await db
    .select()
    .from(reviewQueue)
    .where(and(...conditions))
    .orderBy(desc(reviewQueue.updatedAt))
    .limit(limit);

  return reviews.map((review) => {
    const eventType: ActivityEvent["type"] =
      review.status === "pending"
        ? "created"
        : review.status === "approved"
          ? review.autoApproveEligible
            ? "auto_approved"
            : "approved"
          : "rejected";

    const subjectData = review.subjectData as unknown as Record<
      string,
      unknown
    >;
    const summary = getSummaryFromSubjectData(review.reviewType, subjectData);

    const timestamp = review.updatedAt ?? review.createdAt ?? new Date();

    return {
      agent: (subjectData.agent as string) ?? undefined,
      id: `${review.id}-${review.status}`,
      reviewId: review.id,
      reviewType: review.reviewType,
      summary,
      timestamp,
      type: eventType,
    };
  });
}

/**
 * Get summary text from subject data
 */
function getSummaryFromSubjectData(
  reviewType: ReviewType,
  subjectData: Record<string, unknown>
): string {
  switch (reviewType) {
    case "tool_execution": {
      return `Tool: ${subjectData.toolName ?? "unknown"}`;
    }
    case "memory": {
      return `Memory: ${(subjectData.fact as string)?.slice(0, 50) ?? "..."}`;
    }
    case "message": {
      return `Message: ${(subjectData.messageContent as string)?.slice(0, 50) ?? "..."}`;
    }
    case "workflow": {
      return `Workflow: ${subjectData.decision ?? "decision"}`;
    }
    case "code": {
      return `PR #${subjectData.prNumber ?? "?"}: ${subjectData.prTitle ?? "Code review"}`;
    }
    default: {
      return "Review";
    }
  }
}

/**
 * Trust progress pattern
 */
export interface TrustPattern {
  actionType: string;
  approvalCount: number;
  threshold: number;
  enabled: boolean;
  lastApproved?: Date;
}

/**
 * Get auto-approve patterns with progress
 */
export async function getAutoApproveProgress(
  userId: string
): Promise<TrustPattern[]> {
  const patterns = await db
    .select()
    .from(reviewAutoApprovePatterns)
    .where(eq(reviewAutoApprovePatterns.userId, userId))
    .orderBy(desc(reviewAutoApprovePatterns.approvalCount));

  return patterns.map((p) => ({
    actionType: p.patternKey,
    approvalCount: p.approvalCount ?? 0,
    enabled: p.enabled ?? false,
    lastApproved: p.lastApprovalAt ?? undefined,
    threshold: AUTO_APPROVE_THRESHOLD,
  }));
}

/**
 * Get review with full context for drawer
 */
export async function getReviewWithContext(reviewId: string): Promise<
  | (ReviewQueueRow & {
      triggerContext?: string;
      agentReasoning?: string;
      relatedFiles?: string[];
      riskFactors?: string[];
      similarReviews?: {
        id: string;
        summary: string;
        verdict: string;
      }[];
    })
  | null
> {
  const review = await getReviewById(reviewId);
  if (!review) {
    return null;
  }

  const subjectData = review.subjectData as unknown as Record<string, unknown>;

  // Extract context from subject data
  const triggerContext =
    (subjectData.reasoning as string) ??
    (subjectData.decision as string) ??
    undefined;

  const agentReasoning =
    (subjectData.reasoning as string) ??
    (subjectData.aiSummary as string) ??
    undefined;

  const relatedFiles =
    (subjectData.files as { path: string }[])?.map((f) => f.path) ?? undefined;

  // Calculate risk factors
  const riskFactors: string[] = [];
  if (review.priority === "critical") {
    riskFactors.push("Critical priority - requires immediate attention");
  }
  if (review.priority === "high") {
    riskFactors.push("High priority - may block important work");
  }
  if ((review.confidence ?? 0.5) < 0.7) {
    riskFactors.push("Low confidence - uncertain outcome");
  }
  if ((review.bugCount ?? 0) > 0) {
    riskFactors.push(`${review.bugCount} potential bugs detected`);
  }
  if (review.reviewType === "workflow") {
    riskFactors.push("Workflow decision - may affect autonomy");
  }

  // Find similar past reviews
  const similarReviews = await db
    .select()
    .from(reviewQueue)
    .where(
      and(
        eq(reviewQueue.userId, review.userId),
        eq(reviewQueue.reviewType, review.reviewType),
        sql`${reviewQueue.status} IN ('approved', 'rejected')`,
        sql`${reviewQueue.id} != ${reviewId}`
      )
    )
    .orderBy(desc(reviewQueue.reviewedAt))
    .limit(3);

  return {
    ...review,
    triggerContext,
    agentReasoning,
    relatedFiles,
    riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
    similarReviews:
      similarReviews.length > 0
        ? similarReviews.map((r) => ({
            id: r.id,
            summary: getSummaryFromSubjectData(
              r.reviewType,
              r.subjectData as unknown as Record<string, unknown>
            ),
            verdict: r.status,
          }))
        : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCY TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a dependency for a review
 */
export async function addReviewDependency(
  dependency: Omit<ReviewDependencyInsert, "id" | "createdAt">
): Promise<ReviewDependencyRow | null> {
  const [result] = await db
    .insert(reviewDependencies)
    .values(dependency)
    .onConflictDoNothing()
    .returning();

  return result ?? null;
}

/**
 * Get dependencies for a review
 */
export async function getReviewDependencies(
  reviewId: string
): Promise<ReviewDependencyRow[]> {
  return await db
    .select()
    .from(reviewDependencies)
    .where(
      and(
        eq(reviewDependencies.reviewId, reviewId),
        sql`${reviewDependencies.resolvedAt} IS NULL`
      )
    )
    .orderBy(desc(reviewDependencies.isCriticalPath));
}

/**
 * Get all reviews that block a specific item
 */
export async function getBlockingReviews(
  blockedType: BlockedType,
  blockedId: string
): Promise<(ReviewDependencyRow & { review: ReviewQueueRow })[]> {
  const deps = await db
    .select()
    .from(reviewDependencies)
    .innerJoin(reviewQueue, eq(reviewDependencies.reviewId, reviewQueue.id))
    .where(
      and(
        eq(reviewDependencies.blockedType, blockedType),
        eq(reviewDependencies.blockedId, blockedId),
        sql`${reviewDependencies.resolvedAt} IS NULL`,
        eq(reviewQueue.status, "pending")
      )
    );

  return deps.map((d) => ({
    ...d.review_dependencies,
    review: d.review_queue,
  }));
}

/**
 * Resolve dependencies when a review is completed
 */
export async function resolveReviewDependencies(
  reviewId: string
): Promise<number> {
  const result = await db
    .update(reviewDependencies)
    .set({ resolvedAt: new Date() })
    .where(
      and(
        eq(reviewDependencies.reviewId, reviewId),
        sql`${reviewDependencies.resolvedAt} IS NULL`
      )
    );

  return result.rowCount ?? 0;
}

/**
 * Get dependency graph for a review (what it blocks and what blocks it)
 */
export async function getReviewDependencyGraph(reviewId: string): Promise<{
  review: ReviewQueueRow | null;
  blocks: ReviewDependencyRow[];
  blockedBy: {
    dependency: ReviewDependencyRow;
    blockingReview: ReviewQueueRow;
  }[];
  totalBlocked: number;
  criticalPathCount: number;
}> {
  const review = await getReviewById(reviewId);
  if (!review) {
    return {
      blockedBy: [],
      blocks: [],
      criticalPathCount: 0,
      review: null,
      totalBlocked: 0,
    };
  }

  // What this review blocks
  const blocks = await getReviewDependencies(reviewId);

  // What blocks this review (if this review depends on other reviews)
  const blockedByDeps = await db
    .select()
    .from(reviewDependencies)
    .innerJoin(reviewQueue, eq(reviewDependencies.reviewId, reviewQueue.id))
    .where(
      and(
        eq(reviewDependencies.blockedType, "review"),
        eq(reviewDependencies.blockedId, reviewId),
        sql`${reviewDependencies.resolvedAt} IS NULL`,
        eq(reviewQueue.status, "pending")
      )
    );

  const blockedBy = blockedByDeps.map((d) => ({
    blockingReview: d.review_queue,
    dependency: d.review_dependencies,
  }));

  return {
    blockedBy,
    blocks,
    criticalPathCount: blocks.filter((b) => b.isCriticalPath).length,
    review,
    totalBlocked: blocks.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a review action
 */
export async function logReviewAction(
  reviewId: string,
  userId: string,
  action: AuditAction,
  actionData?: Record<string, unknown>,
  context?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await db.insert(reviewAuditLog).values({
    action,
    actionData: actionData ?? null,
    ipAddress: context?.ipAddress ?? null,
    reviewId,
    userAgent: context?.userAgent ?? null,
    userId,
  });
}

/**
 * Get audit log for a review
 */
export async function getReviewAuditLog(reviewId: string): Promise<
  {
    id: string;
    action: AuditAction;
    actionData: unknown;
    userId: string;
    createdAt: Date | null;
  }[]
> {
  return await db
    .select({
      action: reviewAuditLog.action,
      actionData: reviewAuditLog.actionData,
      createdAt: reviewAuditLog.createdAt,
      id: reviewAuditLog.id,
      userId: reviewAuditLog.userId,
    })
    .from(reviewAuditLog)
    .where(eq(reviewAuditLog.reviewId, reviewId))
    .orderBy(desc(reviewAuditLog.createdAt));
}

/**
 * Get recent audit log entries for a user
 */
export async function getUserAuditLog(
  userId: string,
  options: { limit?: number; since?: Date } = {}
): Promise<
  {
    id: string;
    reviewId: string;
    action: AuditAction;
    actionData: unknown;
    createdAt: Date | null;
  }[]
> {
  const { limit = 50, since } = options;

  const conditions = [eq(reviewAuditLog.userId, userId)];
  if (since) {
    conditions.push(gt(reviewAuditLog.createdAt, since));
  }

  return await db
    .select({
      action: reviewAuditLog.action,
      actionData: reviewAuditLog.actionData,
      createdAt: reviewAuditLog.createdAt,
      id: reviewAuditLog.id,
      reviewId: reviewAuditLog.reviewId,
    })
    .from(reviewAuditLog)
    .where(and(...conditions))
    .orderBy(desc(reviewAuditLog.createdAt))
    .limit(limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELEGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delegate a review to another user
 */
export async function delegateReview(
  reviewId: string,
  fromUserId: string,
  toUserId: string
): Promise<ReviewQueueRow | null> {
  const [review] = await db
    .update(reviewQueue)
    .set({
      delegatedAt: new Date(),
      delegatedBy: fromUserId,
      delegatedTo: toUserId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reviewQueue.id, reviewId),
        eq(reviewQueue.userId, fromUserId),
        eq(reviewQueue.status, "pending")
      )
    )
    .returning();

  if (review) {
    await logReviewAction(reviewId, fromUserId, "delegated", {
      delegatedTo: toUserId,
    });
  }

  return review ?? null;
}

/**
 * Get reviews delegated to a user
 */
export async function getDelegatedReviews(
  userId: string
): Promise<ReviewQueueRow[]> {
  return await db
    .select()
    .from(reviewQueue)
    .where(
      and(
        eq(reviewQueue.delegatedTo, userId),
        eq(reviewQueue.status, "pending")
      )
    )
    .orderBy(desc(reviewQueue.createdAt));
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get templates for a user (includes system defaults)
 */
export async function getReviewTemplates(
  userId: string,
  options: {
    templateType?: TemplateType;
    reviewType?: ReviewType;
  } = {}
): Promise<ReviewTemplateRow[]> {
  const conditions = [
    sql`(${reviewTemplates.userId} = ${userId} OR ${reviewTemplates.userId} = 'system')`,
    eq(reviewTemplates.isActive, true),
  ];

  if (options.templateType) {
    conditions.push(eq(reviewTemplates.templateType, options.templateType));
  }

  if (options.reviewType) {
    conditions.push(
      sql`(${reviewTemplates.reviewType} = ${options.reviewType} OR ${reviewTemplates.reviewType} IS NULL)`
    );
  }

  return await db
    .select()
    .from(reviewTemplates)
    .where(and(...conditions))
    .orderBy(desc(reviewTemplates.isDefault), desc(reviewTemplates.useCount));
}

/**
 * Create a custom template
 */
export async function createReviewTemplate(
  template: Omit<ReviewTemplateInsert, "id" | "createdAt" | "updatedAt">
): Promise<ReviewTemplateRow> {
  const [result] = await db
    .insert(reviewTemplates)
    .values(template)
    .returning();

  // Invalidate template cache
  void invalidateTemplateCache(template.userId);

  if (!result) {
    throw new Error("review_template_insert_failed");
  }
  return result;
}

/**
 * Update a template
 */
export async function updateReviewTemplate(
  templateId: string,
  userId: string,
  updates: Partial<
    Pick<
      ReviewTemplateInsert,
      "name" | "title" | "message" | "suggestedCorrection" | "isActive"
    >
  >
): Promise<ReviewTemplateRow | null> {
  const [result] = await db
    .update(reviewTemplates)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reviewTemplates.id, templateId),
        eq(reviewTemplates.userId, userId)
      )
    )
    .returning();

  // Invalidate template cache
  if (result) {
    void invalidateTemplateCache(userId);
  }

  return result ?? null;
}

/**
 * Delete a template (user templates only)
 */
export async function deleteReviewTemplate(
  templateId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(reviewTemplates)
    .where(
      and(
        eq(reviewTemplates.id, templateId),
        eq(reviewTemplates.userId, userId),
        sql`${reviewTemplates.userId} != 'system'`
      )
    );

  const deleted = (result.rowCount ?? 0) > 0;

  // Invalidate template cache
  if (deleted) {
    void invalidateTemplateCache(userId);
  }

  return deleted;
}

/**
 * Record template usage
 */
export async function recordTemplateUsage(templateId: string): Promise<void> {
  await db
    .update(reviewTemplates)
    .set({
      lastUsedAt: new Date(),
      useCount: sql`${reviewTemplates.useCount} + 1`,
    })
    .where(eq(reviewTemplates.id, templateId));
}
