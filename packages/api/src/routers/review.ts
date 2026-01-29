/**
 * ALFRED Review Router
 * Swipe-based AI action validation endpoints
 */

import type { ReviewQueueRow, VerdictData } from "@alfred/db/schema/review";

import { graphRepo, reviewRepo } from "@alfred/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../trpc";

// Zod schemas for validation
const reviewTypeSchema = z.enum([
  "tool_execution",
  "message",
  "memory",
  "workflow",
  "code",
]);

const reviewPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

const verdictSchema = z.enum(["approve", "reject", "skip"]);

const correctionSchema = z
  .object({
    data: z.unknown().optional(),
    feedback: z.string().max(500).optional(),
    selectedIssues: z.array(z.string()).optional(),
    type: z.enum(["delete", "edit", "replace", "fix"]),
  })
  .optional();

export const reviewRouter = router({
  /**
   * Get pending reviews for the user
   */
  queue: authedProcedure
    .input(
      z.object({
        filter: z
          .enum([
            "all",
            "tool_execution",
            "message",
            "memory",
            "workflow",
            "code",
          ])
          .default("all"),
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const reviews = await reviewRepo.getReviewQueue(userId, {
        limit: input.limit,
        offset: input.offset,
        reviewType: input.filter === "all" ? undefined : input.filter,
        status: "pending",
      });

      const total = await reviewRepo.getPendingReviewCount(
        userId,
        input.filter === "all" ? undefined : input.filter
      );

      return {
        hasMore: reviews.length === input.limit,
        reviews,
        total,
      };
    }),

  /**
   * Get count of pending reviews
   */
  pendingCount: authedProcedure
    .input(
      z
        .object({
          filter: z
            .enum([
              "all",
              "tool_execution",
              "message",
              "memory",
              "workflow",
              "code",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const count = await reviewRepo.getPendingReviewCount(
        userId,
        input?.filter === "all" ? undefined : input?.filter
      );

      return { count };
    }),

  /**
   * Get review details
   */
  details: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await reviewRepo.getReviewById(input.reviewId);

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found",
        });
      }

      if (review.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this review",
        });
      }

      return review;
    }),

  /**
   * Submit review verdict (approve/reject/skip)
   */
  submit: authedProcedure
    .input(
      z.object({
        correction: correctionSchema,
        reviewId: z.string().uuid(),
        reviewTimeMs: z.number().int().optional(),
        verdict: verdictSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await reviewRepo.getReviewById(input.reviewId);

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found",
        });
      }

      if (review.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to submit this review",
        });
      }

      if (review.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Review already submitted",
        });
      }

      // Submit the review
      const updatedReview = await reviewRepo.submitReview(
        input.reviewId,
        userId,
        input.verdict,
        input.correction as VerdictData | undefined
      );

      if (!updatedReview) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit review",
        });
      }

      // Trigger learning actions based on verdict
      await triggerLearningActions(
        updatedReview,
        input.verdict,
        input.correction
      );

      return {
        review: updatedReview,
        success: true,
      };
    }),

  /**
   * Create a new review (typically called by tool execution handlers)
   */
  create: authedProcedure
    .input(
      z.object({
        reviewType: reviewTypeSchema,
        subjectId: z.string(),
        subjectData: z.any(),
        priority: reviewPrioritySchema.default("medium"),
        confidence: z.number().min(0).max(1).default(0.5),
        conversationId: z.string().optional(),
        messageId: z.string().optional(),
        workflowRunId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        // Code review specific
        codeSource: z
          .enum(["github_pr", "local_diff", "agent_output"])
          .optional(),
        prNumber: z.number().int().optional(),
        prUrl: z.string().url().optional(),
        repository: z.string().optional(),
        bugCount: z.number().int().default(0),
        qualityScore: z.number().min(0).max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const isRecord = (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === "object" && !Array.isArray(value);

      let { subjectData } = input;
      let { bugCount } = input;

      if (input.reviewType === "code") {
        const rawDiff =
          isRecord(subjectData) && typeof subjectData.rawDiff === "string"
            ? subjectData.rawDiff.trim()
            : "";

        if (rawDiff.length > 0) {
          try {
            const { analyzeDiff } = await import("@alfred/code-analysis");
            const analysis = await analyzeDiff({
              type: "raw_diff",
              rawDiff,
            });

            const MAX_BUGS = 50;
            const bugs = analysis.bugs.slice(0, MAX_BUGS);
            const files = analysis.files.map((file) => ({
              additions: file.additions,
              deletions: file.deletions,
              isBinary: file.isBinary,
              isDeleted: file.isDeleted,
              isNew: file.isNew,
              isRenamed: file.isRenamed,
              path: file.path,
            }));

            const next =
              bugCount > 0
                ? bugCount
                : (analysis.summary.bugCount ?? analysis.bugs.length);
            bugCount = Number.isFinite(next) ? Math.max(0, next) : bugCount;

            subjectData = {
              ...(isRecord(subjectData) ? subjectData : { rawDiff }),
              bugs,
              files,
              summary: analysis.summary,
              truncated: analysis.bugs.length > bugs.length,
            };
          } catch {
            // Ignore analysis failures; the review still provides value.
          }
        }
      }

      // Check if should auto-approve
      const shouldAutoApprove = await reviewRepo.shouldAutoApprove(
        userId,
        input.reviewType,
        subjectData as unknown as Parameters<
          typeof reviewRepo.shouldAutoApprove
        >[2],
        input.confidence
      );

      if (shouldAutoApprove) {
        // Auto-approve without creating review
        return {
          autoApproved: true,
          review: null,
        };
      }

      // Create review
      const review = await reviewRepo.createReview({
        bugCount,
        codeSource: input.codeSource,
        confidence: input.confidence,
        conversationId: input.conversationId,
        messageId: input.messageId,
        prNumber: input.prNumber,
        prUrl: input.prUrl,
        priority: input.priority,
        projectId: input.projectId,
        qualityScore: input.qualityScore,
        repository: input.repository,
        reviewType: input.reviewType,
        subjectData: subjectData as unknown as Parameters<
          typeof reviewRepo.createReview
        >[0]["subjectData"],
        subjectId: input.subjectId,
        userId,
        workflowRunId: input.workflowRunId,
      });

      return {
        autoApproved: false,
        review,
      };
    }),

  /**
   * Get review analytics
   */
  analytics: authedProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(90).default(7),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const analytics = await reviewRepo.getAnalytics(userId, {
        days: input?.days ?? 7,
      });

      return analytics;
    }),

  /**
   * Batch approve similar reviews
   */
  batchApprove: authedProcedure
    .input(
      z.object({
        reviewIds: z.array(z.string().uuid()).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const results = await Promise.all(
        input.reviewIds.map(async (reviewId) => {
          try {
            const review = await reviewRepo.submitReview(
              reviewId,
              userId,
              "approve"
            );
            if (review) {
              await triggerLearningActions(review, "approve", null);
            }
            return { reviewId, success: !!review };
          } catch {
            return { reviewId, success: false };
          }
        })
      );

      return {
        approved: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }),

  /**
   * Batch reject reviews
   */
  batchReject: authedProcedure
    .input(
      z.object({
        reason: z.string().optional(),
        reviewIds: z.array(z.string().uuid()).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const results = await Promise.all(
        input.reviewIds.map(async (reviewId) => {
          try {
            const review = await reviewRepo.submitReview(
              reviewId,
              userId,
              "reject"
            );
            if (review) {
              await triggerLearningActions(review, "reject", {
                reason: input.reason,
                type: "feedback",
              });
            }
            return { reviewId, success: !!review };
          } catch {
            return { reviewId, success: false };
          }
        })
      );

      return {
        failed: results.filter((r) => !r.success).length,
        rejected: results.filter((r) => r.success).length,
        results,
      };
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // PM-FOCUSED ENDPOINTS (Web Dashboard)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get blocked work queue (pending reviews that may block work)
   */
  blocked: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const reviews = await reviewRepo.getBlockedReviews(
        userId,
        input?.limit ?? 20
      );

      return reviews;
    }),

  /**
   * Get risk summary (aggregated counts by severity)
   */
  riskSummary: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return await reviewRepo.getRiskCounts(userId);
  }),

  /**
   * Get cycle time statistics
   */
  cycleTime: authedProcedure
    .input(
      z
        .object({
          period: z.enum(["day", "week", "month"]).default("week"),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await reviewRepo.getCycleTimeStats(
        userId,
        input?.period ?? "week"
      );
    }),

  /**
   * Get activity feed (recent events)
   */
  activityFeed: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20),
          since: z.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await reviewRepo.getActivityFeed(userId, {
        limit: input?.limit ?? 20,
        since: input?.since,
      });
    }),

  /**
   * Get trust progress (auto-approve threshold progress)
   */
  trustProgress: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return await reviewRepo.getAutoApproveProgress(userId);
  }),

  /**
   * Get review with full context (for drawer)
   */
  fullContext: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await reviewRepo.getReviewWithContext(input.reviewId);

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found",
        });
      }

      if (review.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this review",
        });
      }

      return review;
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // DASHBOARD SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get consolidated dashboard summary for widget display
   * Returns key metrics in a single call for efficiency
   */
  dashboardSummary: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Fetch all data in parallel
    const [
      pendingQueue,
      riskCounts,
      analytics,
      cycleStats,
      blockedItems,
      trustPatterns,
    ] = await Promise.all([
      reviewRepo.getReviewQueue(userId, { limit: 100, status: "pending" }),
      reviewRepo.getRiskCounts(userId),
      reviewRepo.getAnalytics(userId, { days: 30 }),
      reviewRepo.getCycleTimeStats(userId, "week"),
      reviewRepo.getBlockedReviews(userId),
      reviewRepo.getAutoApproveProgress(userId),
    ]);

    // Calculate summary stats
    const pendingCount = pendingQueue.length;
    const criticalCount = pendingQueue.filter(
      (r: { priority: string }) => r.priority === "critical"
    ).length;
    const highCount = pendingQueue.filter(
      (r: { priority: string }) => r.priority === "high"
    ).length;
    const blockedCount = blockedItems.length;

    // Calculate trust score from patterns (average progress toward auto-approve)
    const trustScore =
      trustPatterns.length > 0
        ? trustPatterns.reduce(
            (sum, p) => sum + Math.min(p.approvalCount / p.threshold, 1),
            0
          ) / trustPatterns.length
        : 0;

    // Average cycle time in minutes
    const avgCycleMinutes = Math.round(cycleStats.avgCycleTime / 60_000);

    return {
      lastUpdated: new Date().toISOString(),
      pending: {
        total: pendingCount,
        critical: criticalCount,
        high: highCount,
        blocked: blockedCount,
      },
      performance: {
        approvalRate: analytics.total.approvalRate,
        avgCycleMinutes,
        totalReviewed: analytics.total.reviewed,
        trustScore,
      },
      risk: {
        high: riskCounts.high,
        medium: riskCounts.medium,
        low: riskCounts.low,
        total: riskCounts.total,
      },
    };
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // DEPENDENCY TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get dependency graph for a review
   */
  dependencies: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const graph = await reviewRepo.getReviewDependencyGraph(input.reviewId);

      if (!graph.review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found",
        });
      }

      if (graph.review.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this review",
        });
      }

      return graph;
    }),

  /**
   * Add a dependency to a review
   */
  addDependency: authedProcedure
    .input(
      z.object({
        blockedId: z.string(),
        blockedLabel: z.string().optional(),
        blockedType: z.enum(["workflow", "task", "pr", "deploy", "review"]),
        isCriticalPath: z.boolean().default(false),
        reviewId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await reviewRepo.getReviewById(input.reviewId);
      if (!review || review.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await reviewRepo.addReviewDependency({
        blockedId: input.blockedId,
        blockedLabel: input.blockedLabel,
        blockedType: input.blockedType,
        isCriticalPath: input.isCriticalPath,
        reviewId: input.reviewId,
      });
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // DELEGATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Delegate a review to another user
   */
  delegate: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
        toUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await reviewRepo.delegateReview(
        input.reviewId,
        userId,
        input.toUserId
      );

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Review not found or already processed",
        });
      }

      return review;
    }),

  /**
   * Get reviews delegated to current user
   */
  delegatedToMe: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    return await reviewRepo.getDelegatedReviews(userId);
  }),

  // ─────────────────────────────────────────────────────────────────────────────
  // AUDIT LOG
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get audit log for a review
   */
  auditLog: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await reviewRepo.getReviewById(input.reviewId);
      if (!review || review.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await reviewRepo.getReviewAuditLog(input.reviewId);
    }),

  /**
   * Get user's recent audit log
   */
  myAuditLog: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          since: z.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await reviewRepo.getUserAuditLog(userId, {
        limit: input?.limit ?? 50,
        since: input?.since,
      });
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get completed reviews history
   */
  history: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
          reviewType: z
            .enum([
              "tool_execution",
              "message",
              "memory",
              "workflow",
              "code",
              "all",
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Get completed reviews (approved, rejected, skipped)
      const reviews = await reviewRepo.getReviewQueue(userId, {
        limit: input?.limit ?? 50,
        offset: input?.offset ?? 0,
        reviewType: input?.reviewType ?? "all",
        status: ["approved", "rejected", "skipped"],
      });

      return reviews;
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATES
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get review templates (user's + system defaults)
   */
  templates: authedProcedure
    .input(
      z
        .object({
          reviewType: z
            .enum(["tool_execution", "message", "memory", "workflow", "code"])
            .optional(),
          templateType: z
            .enum(["rejection", "approval", "request_changes"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await reviewRepo.getReviewTemplates(userId, {
        reviewType: input?.reviewType,
        templateType: input?.templateType,
      });
    }),

  /**
   * Create a custom template
   */
  createTemplate: authedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(2000),
        name: z.string().min(1).max(100),
        reviewType: z
          .enum(["tool_execution", "message", "memory", "workflow", "code"])
          .optional(),
        suggestedCorrection: z.unknown().optional(),
        templateType: z.enum(["rejection", "approval", "request_changes"]),
        title: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await reviewRepo.createReviewTemplate({
        message: input.message,
        name: input.name,
        reviewType: input.reviewType,
        suggestedCorrection: input.suggestedCorrection,
        templateType: input.templateType,
        title: input.title,
        userId,
      });
    }),

  /**
   * Update a template
   */
  updateTemplate: authedProcedure
    .input(
      z.object({
        isActive: z.boolean().optional(),
        message: z.string().min(1).max(2000).optional(),
        name: z.string().min(1).max(100).optional(),
        suggestedCorrection: z.unknown().optional(),
        templateId: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const result = await reviewRepo.updateReviewTemplate(
        input.templateId,
        userId,
        {
          isActive: input.isActive,
          message: input.message,
          name: input.name,
          suggestedCorrection: input.suggestedCorrection,
          title: input.title,
        }
      );

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found or not owned by user",
        });
      }

      return result;
    }),

  /**
   * Delete a template
   */
  deleteTemplate: authedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const deleted = await reviewRepo.deleteReviewTemplate(
        input.templateId,
        userId
      );

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Template not found, not owned by user, or is a system template",
        });
      }

      return { success: true };
    }),

  /**
   * Record template usage (when applying a template)
   */
  useTemplate: authedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await reviewRepo.recordTemplateUsage(input.templateId);
      return { success: true };
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // BULK OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Bulk import reviews from external sources
   */
  bulkImport: authedProcedure
    .input(
      z.object({
        reviews: z
          .array(
            z.object({
              externalId: z.string().optional(),
              priority: z
                .enum(["critical", "high", "medium", "low"])
                .default("medium"),
              reviewType: z.enum([
                "tool_execution",
                "message",
                "memory",
                "workflow",
                "code",
              ]),
              subjectData: z.record(z.string(), z.unknown()),
              subjectId: z.string().default("external-import"),
              summary: z.string().optional(),
            })
          )
          .min(1)
          .max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const results = await Promise.all(
        input.reviews.map(async (reviewInput) => {
          try {
            const review = await reviewRepo.createReview({
              priority: reviewInput.priority,
              reviewType: reviewInput.reviewType,
              subjectData: reviewInput.subjectData as unknown as Parameters<
                typeof reviewRepo.createReview
              >[0]["subjectData"],
              subjectId: reviewInput.subjectId,
              userId,
            });
            return { reviewId: review.id, success: true };
          } catch (error) {
            return {
              error: error instanceof Error ? error.message : "Unknown error",
              success: false,
            };
          }
        })
      );

      return {
        failed: results.filter((r) => !r.success).length,
        imported: results.filter((r) => r.success).length,
        results,
      };
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Export review metrics and analytics
   */
  exportMetrics: authedProcedure
    .input(
      z.object({
        format: z.enum(["json", "csv"]).default("json"),
        includeRawReviews: z.boolean().default(false),
        period: z.enum(["day", "week", "month", "all"]).default("week"),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const periodDays =
        input.period === "day"
          ? 1
          : input.period === "week"
            ? 7
            : input.period === "month"
              ? 30
              : 365;

      const [analytics, cycleStats, riskCounts] = await Promise.all([
        reviewRepo.getAnalytics(userId, { days: periodDays }),
        reviewRepo.getCycleTimeStats(
          userId,
          input.period === "all"
            ? "month"
            : input.period === "day"
              ? "day"
              : input.period
        ),
        reviewRepo.getRiskCounts(userId),
      ]);

      const exportData = {
        analytics: {
          total: analytics.total,
          byType: analytics.byType,
          autoApprovePatterns: analytics.autoApprovePatterns,
        },
        exportedAt: new Date().toISOString(),
        performance: {
          avgCycleTimeMs: cycleStats.avgCycleTime,
          slaBreaches: cycleStats.slaBreaches,
          trend: cycleStats.trend,
        },
        period: input.period,
        risk: riskCounts,
      };

      if (input.format === "csv") {
        // Convert to CSV format
        const rows = [
          ["Metric", "Value"],
          ["Total Reviewed", String(analytics.total.reviewed)],
          ["Total Approved", String(analytics.total.approved)],
          ["Total Rejected", String(analytics.total.rejected)],
          ["Approval Rate", `${analytics.total.approvalRate}%`],
          ["Avg Cycle Time (ms)", String(cycleStats.avgCycleTime)],
          ["SLA Breaches", String(cycleStats.slaBreaches)],
          ["High Risk", String(riskCounts.high)],
          ["Medium Risk", String(riskCounts.medium)],
          ["Low Risk", String(riskCounts.low)],
        ];
        return {
          data: rows.map((row) => row.join(",")).join("\n"),
          format: "csv",
        };
      }

      return {
        data: exportData,
        format: "json",
      };
    }),
});

/**
 * Trigger learning actions based on review verdict
 */
async function triggerLearningActions(
  review: ReviewQueueRow,
  verdict: "approve" | "reject" | "skip",
  correction: unknown
): Promise<void> {
  if (verdict === "skip") {
    return;
  }

  try {
    switch (review.reviewType) {
      case "tool_execution": {
        await handleToolExecutionLearning(review, verdict, correction);
        break;
      }
      case "memory": {
        await handleMemoryLearning(review, verdict, correction);
        break;
      }
      case "message": {
        await handleMessageLearning(review, verdict, correction);
        break;
      }
      case "workflow": {
        await handleWorkflowLearning(review, verdict, correction);
        break;
      }
      case "code": {
        await handleCodeReviewLearning(review, verdict, correction);
        break;
      }
      default: {
        break;
      }
    }
  } catch (error) {
    // Log but don't fail the review submission
    console.error("Failed to trigger learning actions:", error);
  }
}

/**
 * Handle tool execution learning
 */
async function handleToolExecutionLearning(
  review: ReviewQueueRow,
  verdict: "approve" | "reject",
  _correction: unknown
): Promise<void> {
  const subjectData = review.subjectData as {
    toolName?: string;
    nodeId?: string;
  };

  if (verdict === "approve") {
    // Record successful tool usage in the graph for future learning
    if (subjectData.nodeId) {
      // Boost access count to increase relevance in future retrievals
      await graphRepo.recordAccess(subjectData.nodeId);
    }

    // Create a learning node for approved tool execution pattern
    await graphRepo.createNode(
      review.userId,
      `tool_approval_${review.id}`,
      "tool_approval",
      `Approved: ${subjectData.toolName || "unknown tool"}`,
      {
        reviewId: review.id,
        timestamp: Date.now(),
        toolName: subjectData.toolName,
      }
    );
  } else {
    // Create a learning node for rejected tool execution
    await graphRepo.createNode(
      review.userId,
      `tool_rejection_${review.id}`,
      "tool_rejection",
      `Rejected: ${subjectData.toolName || "unknown tool"}`,
      {
        reviewId: review.id,
        timestamp: Date.now(),
        toolName: subjectData.toolName,
      }
    );
  }
}

/**
 * Handle memory association learning
 */
async function handleMemoryLearning(
  review: ReviewQueueRow,
  verdict: "approve" | "reject",
  correction: unknown
): Promise<void> {
  const subjectData = review.subjectData as {
    memoryId?: string;
    nodeId?: string;
    memoryFact?: string;
  };

  if (verdict === "approve") {
    // Boost the memory node's access count to increase relevance
    if (subjectData.nodeId) {
      await graphRepo.recordAccess(subjectData.nodeId);
    }

    // Create an approval record for this memory
    await graphRepo.createNode(
      review.userId,
      `memory_approval_${review.id}`,
      "memory_approval",
      `Approved memory: ${subjectData.memoryFact?.slice(0, 50) || "memory"}`,
      {
        memoryId: subjectData.memoryId,
        nodeId: subjectData.nodeId,
        reviewId: review.id,
        timestamp: Date.now(),
      }
    );
  } else {
    const correctionData = correction as
      | { type?: string; data?: unknown }
      | undefined;

    if (correctionData?.type === "delete" && subjectData.nodeId) {
      // Delete the memory node
      await graphRepo.deleteNode(subjectData.nodeId);
    } else if (correctionData?.type === "edit" && subjectData.nodeId) {
      // Update the memory with correction data
      const editData = correctionData.data as
        | { newContent?: string }
        | undefined;
      if (editData?.newContent) {
        await graphRepo.updateNode(subjectData.nodeId, {
          label: editData.newContent,
        });
      }
    }

    // Create a rejection record
    await graphRepo.createNode(
      review.userId,
      `memory_rejection_${review.id}`,
      "memory_rejection",
      `Rejected memory: ${subjectData.memoryFact?.slice(0, 50) || "memory"}`,
      {
        correctionType: correctionData?.type,
        memoryId: subjectData.memoryId,
        reviewId: review.id,
        timestamp: Date.now(),
      }
    );
  }
}

/**
 * Handle message quality learning
 */
async function handleMessageLearning(
  review: ReviewQueueRow,
  verdict: "approve" | "reject",
  correction: unknown
): Promise<void> {
  const subjectData = review.subjectData as {
    responseStyle?: string;
    messageContent?: string;
  };

  // Create a preference node to learn from message feedback
  await graphRepo.createNode(
    review.userId,
    `message_${verdict}_${review.id}`,
    verdict === "approve" ? "message_style_approved" : "message_style_rejected",
    `${verdict === "approve" ? "Approved" : "Rejected"} message style: ${subjectData.responseStyle || "default"}`,
    {
      contentPreview: subjectData.messageContent?.slice(0, 100),
      correction,
      responseStyle: subjectData.responseStyle,
      reviewId: review.id,
      timestamp: Date.now(),
    }
  );
}

/**
 * Handle workflow decision learning
 */
async function handleWorkflowLearning(
  review: ReviewQueueRow,
  verdict: "approve" | "reject",
  correction: unknown
): Promise<void> {
  const subjectData = review.subjectData as {
    decision?: string;
    workflowRunId?: string;
  };

  // Record workflow decision feedback for autonomy calibration
  await graphRepo.createNode(
    review.userId,
    `workflow_${verdict}_${review.id}`,
    verdict === "approve"
      ? "workflow_decision_approved"
      : "workflow_decision_rejected",
    `${verdict === "approve" ? "Approved" : "Rejected"} decision: ${subjectData.decision || "unknown"}`,
    {
      correction,
      decision: subjectData.decision,
      reviewId: review.id,
      timestamp: Date.now(),
      workflowRunId: subjectData.workflowRunId,
    }
  );
}

/**
 * Handle code review learning
 */
async function handleCodeReviewLearning(
  review: ReviewQueueRow,
  verdict: "approve" | "reject",
  correction: unknown
): Promise<void> {
  const subjectData = review.subjectData as {
    prNumber?: number;
    prTitle?: string;
    bugs?: { id: string; description: string; severity?: string }[];
    summary?: string;
  };

  const correctionData = correction as
    | { selectedIssues?: string[]; feedback?: string }
    | undefined;

  // Record which bugs were confirmed/dismissed
  await graphRepo.createNode(
    review.userId,
    `code_review_${verdict}_${review.id}`,
    verdict === "approve" ? "code_review_approved" : "code_review_rejected",
    `${verdict === "approve" ? "Approved" : "Rejected"} PR #${subjectData.prNumber}: ${subjectData.prTitle || ""}`,
    {
      bugsConfirmed: correctionData?.selectedIssues?.length ?? 0,
      bugsReported: subjectData.bugs?.length ?? 0,
      feedback: correctionData?.feedback,
      prNumber: subjectData.prNumber,
      prTitle: subjectData.prTitle,
      reviewId: review.id,
      timestamp: Date.now(),
    }
  );
}
