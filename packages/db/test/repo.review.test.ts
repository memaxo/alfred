import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER_ID = "review-repo-test-user";

let reviewRepo: typeof import("@alfred/db").reviewRepo;
let db: typeof import("@alfred/db").db;

async function setupTestData() {
  if (!db) {
    return;
  }

  // Ensure user exists
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${TEST_USER_ID}, 'Review Test User', 'review@test.com', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

async function resetReviewTables() {
  if (!db) {
    return;
  }

  await db.execute(
    sql`DELETE FROM review_auto_approve_patterns WHERE user_id = ${TEST_USER_ID}`
  );
  await db.execute(
    sql`DELETE FROM review_analytics WHERE user_id = ${TEST_USER_ID}`
  );
  await db.execute(
    sql`DELETE FROM review_queue WHERE user_id = ${TEST_USER_ID}`
  );
}

describeFn("reviewRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "reviewRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    ({ reviewRepo } = mod);
    ({ db } = mod);
    await setupTestData();
  });

  beforeEach(async () => {
    await resetReviewTables();
  });

  describe("createReview", () => {
    it("creates a new review in pending status", async () => {
      const review = await reviewRepo.createReview({
        confidence: 0.8,
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: { toolName: "file_read", args: { path: "/test.txt" } },
        subjectId: "test-tool-call-123",
        userId: TEST_USER_ID,
      });

      expect(review).toBeDefined();
      expect(review.id).toBeDefined();
      expect(review.status).toBe("pending");
      expect(review.reviewType).toBe("tool_execution");
      expect(review.priority).toBe("medium");
      expect(review.confidence).toBe(0.8);
    });

    it("creates code review with PR metadata", async () => {
      const review = await reviewRepo.createReview({
        codeSource: "github_pr",
        confidence: 0.6,
        prNumber: 456,
        prUrl: "https://github.com/owner/repo/pull/456",
        priority: "high",
        reviewType: "code",
        subjectData: {
          prTitle: "Fix login bug",
          prNumber: 456,
          bugCount: 2,
          summary: "Fixes authentication edge case",
        },
        subjectId: "pr-456",
        userId: TEST_USER_ID,
      });

      expect(review).toBeDefined();
      expect(review.reviewType).toBe("code");
      expect(review.codeSource).toBe("github_pr");
      expect(review.prNumber).toBe(456);
      expect(review.prUrl).toBe("https://github.com/owner/repo/pull/456");
    });
  });

  describe("getReviewQueue", () => {
    it("returns pending reviews sorted by priority and creation time", async () => {
      // Create reviews with different priorities
      await reviewRepo.createReview({
        confidence: 0.9,
        priority: "low",
        reviewType: "memory",
        subjectData: { memoryFact: "User prefers dark mode" },
        subjectId: "mem-1",
        userId: TEST_USER_ID,
      });

      await reviewRepo.createReview({
        confidence: 0.5,
        priority: "critical",
        reviewType: "tool_execution",
        subjectData: { toolName: "shell_execute" },
        subjectId: "tool-1",
        userId: TEST_USER_ID,
      });

      await reviewRepo.createReview({
        confidence: 0.7,
        priority: "high",
        reviewType: "workflow",
        subjectData: { decision: "deploy" },
        subjectId: "wf-1",
        userId: TEST_USER_ID,
      });

      const queue = await reviewRepo.getReviewQueue(TEST_USER_ID, {
        limit: 10,
        status: "pending",
      });

      expect(queue.length).toBe(3);
      // Critical should be first, then high, then low
      expect(queue[0].priority).toBe("critical");
      expect(queue[1].priority).toBe("high");
      expect(queue[2].priority).toBe("low");
    });

    it("filters by review type", async () => {
      await reviewRepo.createReview({
        priority: "medium",
        reviewType: "memory",
        subjectData: { memoryFact: "Fact 1" },
        subjectId: "mem-1",
        userId: TEST_USER_ID,
      });

      await reviewRepo.createReview({
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: { toolName: "test" },
        subjectId: "tool-1",
        userId: TEST_USER_ID,
      });

      const memoryReviews = await reviewRepo.getReviewQueue(TEST_USER_ID, {
        reviewType: "memory",
      });

      expect(memoryReviews.length).toBe(1);
      expect(memoryReviews[0].reviewType).toBe("memory");
    });
  });

  describe("submitReview", () => {
    it("approves a review and updates status", async () => {
      const review = await reviewRepo.createReview({
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: { toolName: "test_tool" },
        subjectId: "tool-1",
        userId: TEST_USER_ID,
      });

      const approved = await reviewRepo.submitReview(
        review.id,
        TEST_USER_ID,
        "approve"
      );

      expect(approved).toBeDefined();
      expect(approved!.status).toBe("approved");
      expect(approved!.reviewedAt).toBeDefined();
    });

    it("rejects a review with correction data", async () => {
      const review = await reviewRepo.createReview({
        priority: "low",
        reviewType: "memory",
        subjectData: { memoryFact: "Wrong fact" },
        subjectId: "mem-1",
        userId: TEST_USER_ID,
      });

      const rejected = await reviewRepo.submitReview(
        review.id,
        TEST_USER_ID,
        "reject",
        { feedback: "This is incorrect", type: "delete" }
      );

      expect(rejected).toBeDefined();
      expect(rejected!.status).toBe("rejected");
      expect(rejected!.verdictData).toBeDefined();
    });
  });

  describe("getPendingReviewCount", () => {
    it("returns correct count of pending reviews", async () => {
      await reviewRepo.createReview({
        priority: "medium",
        reviewType: "memory",
        subjectData: {},
        subjectId: "mem-1",
        userId: TEST_USER_ID,
      });

      await reviewRepo.createReview({
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: {},
        subjectId: "tool-1",
        userId: TEST_USER_ID,
      });

      const count = await reviewRepo.getPendingReviewCount(TEST_USER_ID);
      expect(count).toBe(2);

      const memoryCount = await reviewRepo.getPendingReviewCount(
        TEST_USER_ID,
        "memory"
      );
      expect(memoryCount).toBe(1);
    });
  });

  describe("auto-approve patterns", () => {
    it("tracks approvals and enables auto-approve after threshold", async () => {
      const toolName = "safe_read_file";

      // Create and approve 5 reviews for the same tool
      for (let i = 0; i < 5; i++) {
        const review = await reviewRepo.createReview({
          priority: "medium",
          reviewType: "tool_execution",
          subjectData: { toolName },
          subjectId: `tool-${i}`,
          userId: TEST_USER_ID,
        });

        await reviewRepo.submitReview(review.id, TEST_USER_ID, "approve");
      }

      // Check if auto-approve should be enabled
      const shouldAutoApprove = await reviewRepo.shouldAutoApprove(
        TEST_USER_ID,
        "tool_execution",
        { toolName },
        1
      );

      expect(shouldAutoApprove).toBe(true);
    });

    it("does not enable auto-approve with rejections", async () => {
      const toolName = "risky_tool";

      // Create 3 approvals and 2 rejections
      for (let i = 0; i < 3; i++) {
        const review = await reviewRepo.createReview({
          priority: "medium",
          reviewType: "tool_execution",
          subjectData: { toolName },
          subjectId: `tool-a-${i}`,
          userId: TEST_USER_ID,
        });
        await reviewRepo.submitReview(review.id, TEST_USER_ID, "approve");
      }

      for (let i = 0; i < 2; i++) {
        const review = await reviewRepo.createReview({
          priority: "medium",
          reviewType: "tool_execution",
          subjectData: { toolName },
          subjectId: `tool-r-${i}`,
          userId: TEST_USER_ID,
        });
        await reviewRepo.submitReview(review.id, TEST_USER_ID, "reject");
      }

      const shouldAutoApprove = await reviewRepo.shouldAutoApprove(
        TEST_USER_ID,
        "tool_execution",
        `tool:${toolName}`
      );

      expect(shouldAutoApprove).toBe(false);
    });
  });

  describe("getAnalytics", () => {
    it("returns correct analytics summary", async () => {
      // Create and process several reviews
      const review1 = await reviewRepo.createReview({
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: {},
        subjectId: "tool-1",
        userId: TEST_USER_ID,
      });
      await reviewRepo.submitReview(review1.id, TEST_USER_ID, "approve");

      const review2 = await reviewRepo.createReview({
        priority: "low",
        reviewType: "memory",
        subjectData: {},
        subjectId: "mem-1",
        userId: TEST_USER_ID,
      });
      await reviewRepo.submitReview(review2.id, TEST_USER_ID, "reject");

      const analytics = await reviewRepo.getAnalytics(TEST_USER_ID);

      expect(analytics.total.reviewed).toBe(2);
      expect(analytics.total.approved).toBe(1);
      expect(analytics.total.rejected).toBe(1);
      expect(analytics.total.approvalRate).toBe(50);
    });
  });

  describe("dependency tracking", () => {
    it("adds a dependency to a review", async () => {
      const review = await reviewRepo.createReview({
        priority: "high",
        reviewType: "code",
        subjectData: { prTitle: "Feature PR" },
        subjectId: "pr-100",
        userId: TEST_USER_ID,
      });

      const dep = await reviewRepo.addReviewDependency({
        blockedId: "deploy-staging",
        blockedLabel: "Staging deployment",
        blockedType: "deploy",
        isCriticalPath: true,
        reviewId: review.id,
      });

      expect(dep).toBeDefined();
      expect(dep?.reviewId).toBe(review.id);
      expect(dep?.blockedType).toBe("deploy");
      expect(dep?.isCriticalPath).toBe(true);
    });

    it("gets dependencies for a review", async () => {
      const review = await reviewRepo.createReview({
        priority: "critical",
        reviewType: "workflow",
        subjectData: { decision: "approve budget" },
        subjectId: "wf-200",
        userId: TEST_USER_ID,
      });

      await reviewRepo.addReviewDependency({
        blockedId: "task-1",
        blockedType: "task",
        reviewId: review.id,
      });
      await reviewRepo.addReviewDependency({
        blockedId: "task-2",
        blockedType: "task",
        reviewId: review.id,
      });

      const deps = await reviewRepo.getReviewDependencies(review.id);

      expect(deps.length).toBe(2);
    });

    it("resolves dependencies when review is approved", async () => {
      const review = await reviewRepo.createReview({
        priority: "high",
        reviewType: "tool_execution",
        subjectData: { toolName: "deploy" },
        subjectId: "tool-dep",
        userId: TEST_USER_ID,
      });

      await reviewRepo.addReviewDependency({
        blockedId: "prod-deploy",
        blockedType: "deploy",
        reviewId: review.id,
      });

      await reviewRepo.submitReview(review.id, TEST_USER_ID, "approve");
      await reviewRepo.resolveReviewDependencies(review.id);

      const deps = await reviewRepo.getReviewDependencies(review.id);
      expect(deps.every((d) => d.resolvedAt !== null)).toBe(true);
    });

    it("gets dependency graph for a review", async () => {
      const review = await reviewRepo.createReview({
        priority: "medium",
        reviewType: "code",
        subjectData: { prTitle: "Graph test" },
        subjectId: "pr-graph",
        userId: TEST_USER_ID,
      });

      await reviewRepo.addReviewDependency({
        blockedId: "wf-blocked",
        blockedLabel: "Release workflow",
        blockedType: "workflow",
        reviewId: review.id,
      });

      const graph = await reviewRepo.getReviewDependencyGraph(review.id);

      expect(graph.review).toBeDefined();
      expect(graph.blocks.length).toBe(1);
      expect(graph.blocks[0].blockedLabel).toBe("Release workflow");
    });
  });

  describe("delegation", () => {
    const DELEGATE_USER_ID = "review-delegate-user";

    it("delegates a review to another user", async () => {
      const review = await reviewRepo.createReview({
        priority: "high",
        reviewType: "code",
        subjectData: { prTitle: "Delegated PR" },
        subjectId: "pr-delegate",
        userId: TEST_USER_ID,
      });

      const delegated = await reviewRepo.delegateReview(
        review.id,
        TEST_USER_ID,
        DELEGATE_USER_ID
      );

      expect(delegated).toBeDefined();
      expect(delegated?.delegatedTo).toBe(DELEGATE_USER_ID);
      expect(delegated?.delegatedBy).toBe(TEST_USER_ID);
      expect(delegated?.delegatedAt).toBeDefined();
    });

    it("gets reviews delegated to a user", async () => {
      const review = await reviewRepo.createReview({
        priority: "medium",
        reviewType: "workflow",
        subjectData: { decision: "approve" },
        subjectId: "wf-delegate",
        userId: TEST_USER_ID,
      });

      await reviewRepo.delegateReview(
        review.id,
        TEST_USER_ID,
        DELEGATE_USER_ID
      );

      const delegated = await reviewRepo.getDelegatedReviews(DELEGATE_USER_ID);

      expect(delegated.length).toBeGreaterThanOrEqual(1);
      expect(delegated.some((r) => r.id === review.id)).toBe(true);
    });

    it("does not delegate already processed reviews", async () => {
      const review = await reviewRepo.createReview({
        priority: "low",
        reviewType: "memory",
        subjectData: { fact: "test" },
        subjectId: "mem-delegate",
        userId: TEST_USER_ID,
      });

      await reviewRepo.submitReview(review.id, TEST_USER_ID, "approve");

      const delegated = await reviewRepo.delegateReview(
        review.id,
        TEST_USER_ID,
        DELEGATE_USER_ID
      );

      expect(delegated).toBeNull();
    });
  });

  describe("audit log", () => {
    it("logs review actions", async () => {
      const review = await reviewRepo.createReview({
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: { toolName: "test_tool" },
        subjectId: "tool-audit",
        userId: TEST_USER_ID,
      });

      await reviewRepo.logReviewAction(review.id, TEST_USER_ID, "viewed");
      await reviewRepo.logReviewAction(review.id, TEST_USER_ID, "approved", {
        feedback: "LGTM",
      });

      const logs = await reviewRepo.getReviewAuditLog(review.id);

      expect(logs.length).toBe(2);
      expect(logs.some((l) => l.action === "viewed")).toBe(true);
      expect(logs.some((l) => l.action === "approved")).toBe(true);
    });

    it("gets user audit log with limit", async () => {
      const review = await reviewRepo.createReview({
        priority: "low",
        reviewType: "memory",
        subjectData: {},
        subjectId: "mem-audit",
        userId: TEST_USER_ID,
      });

      for (let i = 0; i < 5; i++) {
        await reviewRepo.logReviewAction(review.id, TEST_USER_ID, "viewed");
      }

      const logs = await reviewRepo.getUserAuditLog(TEST_USER_ID, { limit: 3 });

      expect(logs.length).toBe(3);
    });
  });

  describe("templates", () => {
    it("creates a custom template", async () => {
      const template = await reviewRepo.createReviewTemplate({
        message: "This action was rejected for testing.",
        name: "Test Rejection",
        templateType: "rejection",
        title: "Not Approved",
        userId: TEST_USER_ID,
      });

      expect(template).toBeDefined();
      expect(template.name).toBe("Test Rejection");
      expect(template.templateType).toBe("rejection");
    });

    it("gets templates including system defaults", async () => {
      await reviewRepo.createReviewTemplate({
        message: "Custom approval message",
        name: "Custom Template",
        templateType: "approval",
        title: "Custom Approval",
        userId: TEST_USER_ID,
      });

      const templates = await reviewRepo.getReviewTemplates(TEST_USER_ID);

      // Should include both user templates and system defaults
      expect(templates.length).toBeGreaterThanOrEqual(1);
      const userTemplate = templates.find((t) => t.name === "Custom Template");
      expect(userTemplate).toBeDefined();
    });

    it("filters templates by type", async () => {
      await reviewRepo.createReviewTemplate({
        message: "Rejected message",
        name: "Rejection Only",
        templateType: "rejection",
        title: "Rejected",
        userId: TEST_USER_ID,
      });

      const rejectionTemplates = await reviewRepo.getReviewTemplates(
        TEST_USER_ID,
        { templateType: "rejection" }
      );

      expect(
        rejectionTemplates.every((t) => t.templateType === "rejection")
      ).toBe(true);
    });

    it("updates a template", async () => {
      const template = await reviewRepo.createReviewTemplate({
        message: "Original message",
        name: "Update Test",
        templateType: "approval",
        title: "Original Title",
        userId: TEST_USER_ID,
      });

      const updated = await reviewRepo.updateReviewTemplate(
        template.id,
        TEST_USER_ID,
        { message: "Updated message", title: "Updated Title" }
      );

      expect(updated?.title).toBe("Updated Title");
      expect(updated?.message).toBe("Updated message");
    });

    it("deletes a user template", async () => {
      const template = await reviewRepo.createReviewTemplate({
        message: "Will be deleted",
        name: "Delete Test",
        templateType: "rejection",
        title: "To Delete",
        userId: TEST_USER_ID,
      });

      const deleted = await reviewRepo.deleteReviewTemplate(
        template.id,
        TEST_USER_ID
      );

      expect(deleted).toBe(true);

      const templates = await reviewRepo.getReviewTemplates(TEST_USER_ID);
      expect(templates.find((t) => t.id === template.id)).toBeUndefined();
    });

    it("records template usage", async () => {
      const template = await reviewRepo.createReviewTemplate({
        message: "Usage tracking test",
        name: "Usage Test",
        templateType: "approval",
        title: "Track Usage",
        userId: TEST_USER_ID,
      });

      await reviewRepo.recordTemplateUsage(template.id);
      await reviewRepo.recordTemplateUsage(template.id);

      const templates = await reviewRepo.getReviewTemplates(TEST_USER_ID);
      const updated = templates.find((t) => t.id === template.id);

      expect(updated?.useCount).toBe(2);
      expect(updated?.lastUsedAt).toBeDefined();
    });
  });
});
