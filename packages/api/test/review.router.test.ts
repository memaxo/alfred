import { TRPCError } from "@trpc/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import { metricsStub } from "./utils/mock-metrics";
import { createTestCaller, createUnauthedCaller } from "./utils/trpc";

mock.module("@alfred/api/metrics", () => metricsStub);

// Mock review repository
const getReviewQueueMock = vi.fn();
const getPendingReviewCountMock = vi.fn();
const getReviewByIdMock = vi.fn();
const createReviewMock = vi.fn();
const submitReviewMock = vi.fn();
const getAnalyticsMock = vi.fn();
const shouldAutoApproveMock = vi.fn();
const getBlockedReviewsMock = vi.fn();
const getRiskCountsMock = vi.fn();
const getCycleTimeStatsMock = vi.fn();
const getActivityFeedMock = vi.fn();
const getAutoApproveProgressMock = vi.fn();
const getReviewWithContextMock = vi.fn();
// New PM endpoint mocks
const getReviewDependencyGraphMock = vi.fn();
const addReviewDependencyMock = vi.fn();
const delegateReviewMock = vi.fn();
const getDelegatedReviewsMock = vi.fn();
const getReviewAuditLogMock = vi.fn();
const getUserAuditLogMock = vi.fn();
const getReviewTemplatesMock = vi.fn();
const createReviewTemplateMock = vi.fn();
const updateReviewTemplateMock = vi.fn();
const deleteReviewTemplateMock = vi.fn();
const recordTemplateUsageMock = vi.fn();

const graphCreateNodeMock = vi.fn().mockResolvedValue({ id: "node-1" });
const graphRecordAccessMock = vi.fn().mockResolvedValue({ id: "node-1" });
const graphUpdateNodeMock = vi.fn().mockResolvedValue({ id: "node-1" });
const graphDeleteNodeMock = vi.fn().mockResolvedValue(1);

mock.module("@alfred/db", () => ({
  graphRepo: {
    createNode: graphCreateNodeMock,
    recordAccess: graphRecordAccessMock,
    updateNode: graphUpdateNodeMock,
    deleteNode: graphDeleteNodeMock,
  },
  reviewRepo: {
    getReviewQueue: getReviewQueueMock,
    getPendingReviewCount: getPendingReviewCountMock,
    getReviewById: getReviewByIdMock,
    createReview: createReviewMock,
    submitReview: submitReviewMock,
    getAnalytics: getAnalyticsMock,
    shouldAutoApprove: shouldAutoApproveMock,
    getBlockedReviews: getBlockedReviewsMock,
    getRiskCounts: getRiskCountsMock,
    getCycleTimeStats: getCycleTimeStatsMock,
    getActivityFeed: getActivityFeedMock,
    getAutoApproveProgress: getAutoApproveProgressMock,
    getReviewWithContext: getReviewWithContextMock,
    // New PM endpoint mocks
    getReviewDependencyGraph: getReviewDependencyGraphMock,
    addReviewDependency: addReviewDependencyMock,
    delegateReview: delegateReviewMock,
    getDelegatedReviews: getDelegatedReviewsMock,
    getReviewAuditLog: getReviewAuditLogMock,
    getUserAuditLog: getUserAuditLogMock,
    getReviewTemplates: getReviewTemplatesMock,
    createReviewTemplate: createReviewTemplateMock,
    updateReviewTemplate: updateReviewTemplateMock,
    deleteReviewTemplate: deleteReviewTemplateMock,
    recordTemplateUsage: recordTemplateUsageMock,
  },
}));

const TEST_USER_ID = "review-test-user";
// Valid v4 UUIDs (version 4, variant 8/9/a/b)
const TEST_REVIEW_ID = "11111111-1111-4111-8111-111111111111";
const TEST_REVIEW_ID_2 = "22222222-2222-4222-8222-222222222222";
const TEST_REVIEW_ID_3 = "33333333-3333-4333-8333-333333333333";
const TEST_REVIEW_ID_4 = "44444444-4444-4444-8444-444444444444";
const TEST_REVIEW_ID_5 = "55555555-5555-4555-8555-555555555555";

function createMockReview(
  overrides: Partial<{
    id: string;
    userId: string;
    reviewType: string;
    status: string;
    priority: string;
    subjectId: string;
    subjectData: unknown;
    confidence: number;
    createdAt: Date;
    delegatedTo: string | null;
    delegatedBy: string | null;
    delegatedAt: Date | null;
  }> = {}
) {
  return {
    baseBranch: null,
    bugCount: null,
    codeSource: null,
    confidence: overrides.confidence ?? 0.8,
    conversationId: null,
    createdAt: overrides.createdAt ?? new Date(),
    delegatedAt: overrides.delegatedAt ?? null,
    delegatedBy: overrides.delegatedBy ?? null,
    delegatedTo: overrides.delegatedTo ?? null,
    diffSummary: null,
    headBranch: null,
    id: overrides.id ?? TEST_REVIEW_ID,
    messageId: null,
    prNumber: null,
    prUrl: null,
    priority: overrides.priority ?? "medium",
    projectId: null,
    reviewType: overrides.reviewType ?? "tool_execution",
    reviewedAt: null,
    status: overrides.status ?? "pending",
    subjectData: overrides.subjectData ?? { toolName: "test_tool" },
    subjectId: overrides.subjectId ?? "subject-1",
    updatedAt: new Date(),
    userId: overrides.userId ?? TEST_USER_ID,
    verdictData: null,
    workflowRunId: null,
  };
}

describe("reviewRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("queue", () => {
    it("returns pending reviews for authenticated user", async () => {
      const mockReviews = [
        createMockReview({ id: TEST_REVIEW_ID, priority: "critical" }),
        createMockReview({ id: TEST_REVIEW_ID_2, priority: "high" }),
        createMockReview({ id: TEST_REVIEW_ID_3, priority: "medium" }),
      ];

      getReviewQueueMock.mockResolvedValue(mockReviews);
      getPendingReviewCountMock.mockResolvedValue(3);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.queue({
        filter: "all",
        limit: 10,
        offset: 0,
      });

      expect(result.reviews).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
      expect(getReviewQueueMock).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 10,
        offset: 0,
        reviewType: undefined,
        status: "pending",
      });
    });

    it("filters by review type", async () => {
      const mockReviews = [createMockReview({ reviewType: "memory" })];
      getReviewQueueMock.mockResolvedValue(mockReviews);
      getPendingReviewCountMock.mockResolvedValue(1);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.queue({
        filter: "memory",
        limit: 10,
        offset: 0,
      });

      expect(result.reviews).toHaveLength(1);
      expect(getReviewQueueMock).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 10,
        offset: 0,
        reviewType: "memory",
        status: "pending",
      });
    });

    it("supports pagination", async () => {
      const mockReviews = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockReview({ id: `${i}1111111-1111-4111-8111-111111111111` })
        );
      getReviewQueueMock.mockResolvedValue(mockReviews);
      getPendingReviewCountMock.mockResolvedValue(25);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.queue({
        filter: "all",
        limit: 10,
        offset: 0,
      });

      expect(result.reviews).toHaveLength(10);
      expect(result.hasMore).toBe(true);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();

      await expect(
        caller.review.queue({ filter: "all", limit: 10, offset: 0 })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("pendingCount", () => {
    it("returns count of pending reviews", async () => {
      getPendingReviewCountMock.mockResolvedValue(5);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.pendingCount({});

      expect(result.count).toBe(5);
      expect(getPendingReviewCountMock).toHaveBeenCalledWith(
        TEST_USER_ID,
        undefined
      );
    });

    it("filters count by review type", async () => {
      getPendingReviewCountMock.mockResolvedValue(2);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.pendingCount({ filter: "code" });

      expect(result.count).toBe(2);
      expect(getPendingReviewCountMock).toHaveBeenCalledWith(
        TEST_USER_ID,
        "code"
      );
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();

      await expect(caller.review.pendingCount({})).rejects.toThrow(TRPCError);
    });
  });

  describe("details", () => {
    it("returns review details for owner", async () => {
      const mockReview = createMockReview();
      getReviewByIdMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.details({ reviewId: TEST_REVIEW_ID });

      expect(result).toEqual(mockReview);
      expect(getReviewByIdMock).toHaveBeenCalledWith(TEST_REVIEW_ID);
    });

    it("throws NOT_FOUND for non-existent review", async () => {
      getReviewByIdMock.mockResolvedValue(null);

      const caller = await createTestCaller({ userId: TEST_USER_ID });

      await expect(
        caller.review.details({ reviewId: TEST_REVIEW_ID_4 })
      ).rejects.toThrow(TRPCError);
    });

    it("throws FORBIDDEN when accessing another user's review", async () => {
      const mockReview = createMockReview({ userId: "other-user" });
      getReviewByIdMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });

      await expect(
        caller.review.details({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("submit", () => {
    it("approves a review", async () => {
      const mockReview = createMockReview({ status: "pending" });
      const approvedReview = {
        ...mockReview,
        status: "approved",
        reviewedAt: new Date(),
      };

      getReviewByIdMock.mockResolvedValue(mockReview);
      submitReviewMock.mockResolvedValue(approvedReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.submit({
        reviewId: TEST_REVIEW_ID,
        verdict: "approve",
      });

      expect(result.success).toBe(true);
      expect(result.review.status).toBe("approved");
      expect(submitReviewMock).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_USER_ID,
        "approve",
        undefined
      );
    });

    it("rejects a review with correction data", async () => {
      const mockReview = createMockReview({
        reviewType: "memory",
        status: "pending",
      });
      const rejectedReview = {
        ...mockReview,
        status: "rejected",
        reviewedAt: new Date(),
      };

      getReviewByIdMock.mockResolvedValue(mockReview);
      submitReviewMock.mockResolvedValue(rejectedReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.submit({
        correction: {
          type: "delete",
          feedback: "This memory is incorrect",
        },
        reviewId: TEST_REVIEW_ID,
        verdict: "reject",
      });

      expect(result.success).toBe(true);
      expect(result.review.status).toBe("rejected");
    });

    it("skips a review", async () => {
      const mockReview = createMockReview({ status: "pending" });
      const skippedReview = {
        ...mockReview,
        status: "skipped",
        reviewedAt: new Date(),
      };

      getReviewByIdMock.mockResolvedValue(mockReview);
      submitReviewMock.mockResolvedValue(skippedReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.submit({
        reviewId: TEST_REVIEW_ID,
        verdict: "skip",
      });

      expect(result.success).toBe(true);
      expect(result.review.status).toBe("skipped");
    });

    it("throws NOT_FOUND for non-existent review", async () => {
      getReviewByIdMock.mockResolvedValue(null);

      const caller = await createTestCaller({ userId: TEST_USER_ID });

      await expect(
        caller.review.submit({ reviewId: TEST_REVIEW_ID_5, verdict: "approve" })
      ).rejects.toThrow(TRPCError);
    });

    it("throws FORBIDDEN when submitting another user's review", async () => {
      const mockReview = createMockReview({ userId: "other-user" });
      getReviewByIdMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });

      await expect(
        caller.review.submit({ reviewId: TEST_REVIEW_ID, verdict: "approve" })
      ).rejects.toThrow(TRPCError);
    });

    it("throws BAD_REQUEST when review already submitted", async () => {
      const mockReview = createMockReview({ status: "approved" });
      getReviewByIdMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });

      await expect(
        caller.review.submit({ reviewId: TEST_REVIEW_ID, verdict: "approve" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("create", () => {
    it("creates a new review", async () => {
      const mockReview = createMockReview();
      createReviewMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.create({
        confidence: 0.8,
        priority: "medium",
        reviewType: "tool_execution",
        subjectData: { toolName: "file_read", args: { path: "/test.txt" } },
        subjectId: "tool-call-123",
      });

      expect(result.review).toBeDefined();
      expect(result.review.reviewType).toBe("tool_execution");
      expect(createReviewMock).toHaveBeenCalled();
    });

    it("creates a code review with PR metadata", async () => {
      const mockReview = createMockReview({
        reviewType: "code",
        subjectData: { prNumber: 123, prTitle: "Fix bug" },
      });
      createReviewMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.create({
        codeSource: "github_pr",
        confidence: 0.6,
        prNumber: 123,
        prUrl: "https://github.com/owner/repo/pull/123",
        priority: "high",
        reviewType: "code",
        subjectData: { prTitle: "Fix bug", prNumber: 123 },
        subjectId: "pr-123",
      });

      expect(result.review.reviewType).toBe("code");
    });

    it("enriches code review with diff analysis when rawDiff is provided", async () => {
      const rawDiff = [
        "diff --git a/foo.ts b/foo.ts",
        "index 0000000..1111111 100644",
        "--- a/foo.ts",
        "+++ b/foo.ts",
        "@@ -0,0 +1,1 @@",
        '+const apiKey = "super-secret";',
        "",
      ].join("\n");

      const mockReview = createMockReview({
        reviewType: "code",
        subjectData: { rawDiff },
      });
      shouldAutoApproveMock.mockResolvedValue(false);
      createReviewMock.mockResolvedValue(mockReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await caller.review.create({
        codeSource: "local_diff",
        confidence: 0.7,
        priority: "high",
        reviewType: "code",
        subjectData: { rawDiff },
        subjectId: "diff-1",
      });

      expect(createReviewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bugCount: 1,
          reviewType: "code",
          subjectId: "diff-1",
          subjectData: expect.objectContaining({
            bugs: expect.any(Array),
            summary: expect.any(Object),
          }),
        })
      );
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();

      await expect(
        caller.review.create({
          confidence: 0.5,
          priority: "medium",
          reviewType: "tool_execution",
          subjectData: {},
          subjectId: "test",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("analytics", () => {
    it("returns analytics for user", async () => {
      const mockAnalytics = {
        autoApprovePatterns: 5,
        byType: {
          tool_execution: { approved: 50, rejected: 5, approvalRate: 0.91 },
          memory: { approved: 20, rejected: 5, approvalRate: 0.8 },
          message: { approved: 5, rejected: 2, approvalRate: 0.71 },
          workflow: { approved: 3, rejected: 2, approvalRate: 0.6 },
          code: { approved: 2, rejected: 1, approvalRate: 0.67 },
        },
        total: {
          reviewed: 100,
          approved: 80,
          rejected: 15,
          skipped: 5,
          approvalRate: 0.8,
        },
      };
      getAnalyticsMock.mockResolvedValue(mockAnalytics);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.analytics({});

      expect(result.total.reviewed).toBe(100);
      expect(result.total.approvalRate).toBe(0.8);
      expect(result.autoApprovePatterns).toBe(5);
    });

    it("supports custom time range", async () => {
      const mockAnalytics = {
        autoApprovePatterns: 0,
        byType: {},
        total: {
          reviewed: 10,
          approved: 8,
          rejected: 2,
          skipped: 0,
          approvalRate: 0.8,
        },
      };
      getAnalyticsMock.mockResolvedValue(mockAnalytics);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await caller.review.analytics({ days: 30 });

      expect(getAnalyticsMock).toHaveBeenCalledWith(TEST_USER_ID, { days: 30 });
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();

      await expect(caller.review.analytics({})).rejects.toThrow(TRPCError);
    });
  });

  describe("batchApprove", () => {
    it("approves multiple reviews", async () => {
      const mockReviews = [
        createMockReview({ id: TEST_REVIEW_ID, status: "pending" }),
        createMockReview({ id: TEST_REVIEW_ID_2, status: "pending" }),
        createMockReview({ id: TEST_REVIEW_ID_3, status: "pending" }),
      ];

      submitReviewMock.mockImplementation((id) =>
        Promise.resolve({
          ...mockReviews.find((r) => r.id === id),
          status: "approved",
        })
      );

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.batchApprove({
        reviewIds: [TEST_REVIEW_ID, TEST_REVIEW_ID_2, TEST_REVIEW_ID_3],
      });

      expect(result.approved).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("handles partial failures", async () => {
      const mockReview1 = createMockReview({
        id: TEST_REVIEW_ID,
        status: "pending",
      });
      const mockReview2 = createMockReview({
        id: TEST_REVIEW_ID_2,
        status: "approved",
      }); // Already approved

      submitReviewMock
        .mockResolvedValueOnce({ ...mockReview1, status: "approved" })
        .mockRejectedValueOnce(new Error("Already submitted"));

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.batchApprove({
        reviewIds: [TEST_REVIEW_ID, TEST_REVIEW_ID_2],
      });

      expect(result.approved).toBe(1);
      expect(result.failed).toBe(1);
      expect(
        result.results.filter((r: { success: boolean }) => !r.success)
      ).toHaveLength(1);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();

      await expect(
        caller.review.batchApprove({ reviewIds: [TEST_REVIEW_ID] })
      ).rejects.toThrow(TRPCError);
    });
  });
});

describe("reviewRouter - learning integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers learning on tool approval", async () => {
    const mockReview = createMockReview({
      reviewType: "tool_execution",
      subjectData: { nodeId: "node-123", toolName: "file_read" },
    });
    const approvedReview = { ...mockReview, status: "approved" };

    getReviewByIdMock.mockResolvedValue(mockReview);
    submitReviewMock.mockResolvedValue(approvedReview);

    const caller = await createTestCaller({ userId: TEST_USER_ID });
    await caller.review.submit({
      reviewId: TEST_REVIEW_ID,
      verdict: "approve",
    });

    // Verify graphRepo.createNode was called for learning
    const { graphRepo } = await import("@alfred/db");
    expect(graphRepo.createNode).toHaveBeenCalled();
  });

  it("triggers learning on memory rejection with delete", async () => {
    const mockReview = createMockReview({
      reviewType: "memory",
      subjectData: { memoryFact: "Wrong fact", nodeId: "node-456" },
    });
    const rejectedReview = { ...mockReview, status: "rejected" };

    getReviewByIdMock.mockResolvedValue(mockReview);
    submitReviewMock.mockResolvedValue(rejectedReview);

    const caller = await createTestCaller({ userId: TEST_USER_ID });
    await caller.review.submit({
      correction: { type: "delete" },
      reviewId: TEST_REVIEW_ID,
      verdict: "reject",
    });

    const { graphRepo } = await import("@alfred/db");
    expect(graphRepo.deleteNode).toHaveBeenCalledWith("node-456");
  });
});

describe("reviewRouter - batchReject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejects multiple reviews", async () => {
    const mockReviews = [
      createMockReview({ id: TEST_REVIEW_ID }),
      createMockReview({ id: TEST_REVIEW_ID_2 }),
    ];

    submitReviewMock
      .mockResolvedValueOnce({ ...mockReviews[0], status: "rejected" })
      .mockResolvedValueOnce({ ...mockReviews[1], status: "rejected" });

    const caller = await createTestCaller({ userId: TEST_USER_ID });
    const result = await caller.review.batchReject({
      reviewIds: [TEST_REVIEW_ID, TEST_REVIEW_ID_2],
    });

    expect(result.rejected).toBe(2);
    expect(result.failed).toBe(0);
    expect(submitReviewMock).toHaveBeenCalledTimes(2);
  });

  it("handles partial failures", async () => {
    submitReviewMock
      .mockResolvedValueOnce({ ...createMockReview(), status: "rejected" })
      .mockRejectedValueOnce(new Error("DB error"));

    const caller = await createTestCaller({ userId: TEST_USER_ID });
    const result = await caller.review.batchReject({
      reviewIds: [TEST_REVIEW_ID, TEST_REVIEW_ID_2],
    });

    expect(result.rejected).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("passes reason to learning actions", async () => {
    submitReviewMock.mockResolvedValue({
      ...createMockReview(),
      status: "rejected",
    });

    const caller = await createTestCaller({ userId: TEST_USER_ID });
    await caller.review.batchReject({
      reason: "Not appropriate for this context",
      reviewIds: [TEST_REVIEW_ID],
    });

    expect(submitReviewMock).toHaveBeenCalled();
  });

  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = await createUnauthedCaller();
    await expect(
      caller.review.batchReject({ reviewIds: [TEST_REVIEW_ID] })
    ).rejects.toThrow(TRPCError);
  });
});

describe("reviewRouter - auto-approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks auto-approve status when creating review", async () => {
    shouldAutoApproveMock.mockResolvedValue(false);
    createReviewMock.mockResolvedValue(createMockReview());

    const caller = await createTestCaller({ userId: TEST_USER_ID });
    await caller.review.create({
      confidence: 0.9,
      priority: "medium",
      reviewType: "tool_execution",
      subjectData: { toolName: "safe_tool" },
      subjectId: "tool-1",
    });

    // Auto-approve check happens in createReview
    expect(createReviewMock).toHaveBeenCalled();
  });
});

describe("reviewRouter - PM-focused endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("blocked", () => {
    it("returns blocked reviews for authenticated user", async () => {
      const mockBlocked = [
        {
          ...createMockReview(),
          timeBlockedMs: 3_600_000,
          risk: "high" as const,
          blockingCount: 2,
        },
      ];
      getBlockedReviewsMock.mockResolvedValue(mockBlocked);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.blocked();

      expect(result).toEqual(mockBlocked);
      expect(getBlockedReviewsMock).toHaveBeenCalledWith(TEST_USER_ID, 20);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.blocked()).rejects.toThrow(TRPCError);
    });
  });

  describe("riskSummary", () => {
    it("returns risk counts for authenticated user", async () => {
      const mockRisk = {
        high: 3,
        low: 10,
        medium: 5,
        total: 18,
      };
      getRiskCountsMock.mockResolvedValue(mockRisk);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.riskSummary();

      expect(result).toEqual(mockRisk);
      expect(getRiskCountsMock).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.riskSummary()).rejects.toThrow(TRPCError);
    });
  });

  describe("cycleTime", () => {
    it("returns cycle time stats for authenticated user", async () => {
      const mockStats = {
        avgMs: 1_800_000,
        byType: {
          tool_execution: 1_200_000,
          code: 3_600_000,
        },
        slaBreaches: 2,
        trend: [
          { date: "2026-01-20", avgMs: 1_500_000 },
          { date: "2026-01-21", avgMs: 1_800_000 },
        ],
      };
      getCycleTimeStatsMock.mockResolvedValue(mockStats);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.cycleTime();

      expect(result).toEqual(mockStats);
      expect(getCycleTimeStatsMock).toHaveBeenCalledWith(TEST_USER_ID, "week");
    });

    it("supports custom period parameter", async () => {
      const mockStats = {
        avgMs: 1_000_000,
        byType: {},
        slaBreaches: 0,
        trend: [],
      };
      getCycleTimeStatsMock.mockResolvedValue(mockStats);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await caller.review.cycleTime({ period: "month" });

      expect(getCycleTimeStatsMock).toHaveBeenCalledWith(TEST_USER_ID, "month");
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.cycleTime()).rejects.toThrow(TRPCError);
    });
  });

  describe("activityFeed", () => {
    it("returns activity feed for authenticated user", async () => {
      const mockActivity = [
        {
          id: "event-1",
          reviewType: "tool_execution",
          summary: "Approved tool: test_tool",
          timestamp: new Date(),
          type: "approved" as const,
        },
      ];
      getActivityFeedMock.mockResolvedValue(mockActivity);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.activityFeed();

      expect(result).toEqual(mockActivity);
      expect(getActivityFeedMock).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 20,
        since: undefined,
      });
    });

    it("supports custom limit parameter", async () => {
      getActivityFeedMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await caller.review.activityFeed({ limit: 50 });

      expect(getActivityFeedMock).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 50,
        since: undefined,
      });
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.activityFeed()).rejects.toThrow(TRPCError);
    });
  });

  describe("trustProgress", () => {
    it("returns trust progress for authenticated user", async () => {
      const mockProgress = [
        {
          actionType: "tool_execution",
          approvalCount: 4,
          enabled: false,
          threshold: 5,
        },
        {
          actionType: "memory",
          approvalCount: 5,
          enabled: true,
          lastApproved: new Date(),
          threshold: 5,
        },
      ];
      getAutoApproveProgressMock.mockResolvedValue(mockProgress);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.trustProgress();

      expect(result).toEqual(mockProgress);
      expect(getAutoApproveProgressMock).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.trustProgress()).rejects.toThrow(TRPCError);
    });
  });

  describe("fullContext", () => {
    it("returns full context for review owner", async () => {
      const mockContext = {
        ...createMockReview(),
        triggerContext: "User requested file deletion",
        agentReasoning: "This action requires approval for safety",
        relatedFiles: ["src/index.ts", "src/utils.ts"],
        riskFactors: ["High priority", "Affects production"],
        similarReviews: [
          {
            id: TEST_REVIEW_ID_2,
            summary: "Similar tool",
            verdict: "approved",
          },
        ],
      };
      getReviewWithContextMock.mockResolvedValue(mockContext);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.fullContext({
        reviewId: TEST_REVIEW_ID,
      });

      expect(result).toEqual(mockContext);
      expect(getReviewWithContextMock).toHaveBeenCalledWith(TEST_REVIEW_ID);
    });

    it("throws NOT_FOUND for non-existent review", async () => {
      getReviewWithContextMock.mockResolvedValue(null);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.fullContext({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });

    it("throws FORBIDDEN when accessing another user's review", async () => {
      const mockContext = {
        ...createMockReview({ userId: "other-user" }),
        triggerContext: null,
        agentReasoning: null,
        relatedFiles: null,
        riskFactors: null,
        similarReviews: null,
      };
      getReviewWithContextMock.mockResolvedValue(mockContext);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.fullContext({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.fullContext({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW PM ENDPOINT TESTS
  // ─────────────────────────────────────────────────────────────────────────────

  describe("dashboardSummary", () => {
    it("returns consolidated dashboard stats for authenticated user", async () => {
      getReviewQueueMock.mockResolvedValue([
        createMockReview({ priority: "critical" }),
        createMockReview({ priority: "high" }),
        createMockReview({ priority: "medium" }),
      ]);
      getRiskCountsMock.mockResolvedValue({
        high: 2,
        medium: 1,
        low: 0,
        total: 3,
      });
      getAnalyticsMock.mockResolvedValue({
        total: {
          reviewed: 100,
          approved: 80,
          rejected: 20,
          skipped: 0,
          approvalRate: 80,
        },
        byType: {},
        autoApprovePatterns: 5,
      });
      getCycleTimeStatsMock.mockResolvedValue({
        avgCycleTime: 60_000,
        codeAvg: 0,
        toolAvg: 0,
        memoryAvg: 0,
        workflowAvg: 0,
        trend: [],
        slaBreaches: 2,
      });
      getBlockedReviewsMock.mockResolvedValue([createMockReview()]);
      getAutoApproveProgressMock.mockResolvedValue([
        { actionType: "tool", approvalCount: 3, threshold: 5, enabled: false },
      ]);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.dashboardSummary();

      expect(result.pending.total).toBe(3);
      expect(result.pending.critical).toBe(1);
      expect(result.pending.high).toBe(1);
      expect(result.pending.blocked).toBe(1);
      expect(result.risk.high).toBe(2);
      expect(result.performance.approvalRate).toBe(80);
      expect(result.performance.avgCycleMinutes).toBe(1);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.dashboardSummary()).rejects.toThrow(TRPCError);
    });
  });

  describe("dependencies", () => {
    it("returns dependency graph for review owner", async () => {
      const mockGraph = {
        review: createMockReview(),
        dependencies: [
          {
            id: "dep-1",
            reviewId: TEST_REVIEW_ID,
            blockedType: "deploy",
            blockedId: "staging",
            blockedLabel: "Staging deploy",
            isCriticalPath: true,
            resolvedAt: null,
          },
        ],
      };
      getReviewDependencyGraphMock.mockResolvedValue(mockGraph);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.dependencies({
        reviewId: TEST_REVIEW_ID,
      });

      expect(result.review).toBeDefined();
      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0].blockedType).toBe("deploy");
    });

    it("throws NOT_FOUND for non-existent review", async () => {
      getReviewDependencyGraphMock.mockResolvedValue({
        review: null,
        dependencies: [],
      });

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.dependencies({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });

    it("throws FORBIDDEN when accessing another user's review", async () => {
      getReviewDependencyGraphMock.mockResolvedValue({
        review: createMockReview({ userId: "other-user" }),
        dependencies: [],
      });

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.dependencies({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.dependencies({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("addDependency", () => {
    it("adds dependency to review owned by user", async () => {
      getReviewByIdMock.mockResolvedValue(createMockReview());
      addReviewDependencyMock.mockResolvedValue({
        id: "dep-1",
        reviewId: TEST_REVIEW_ID,
        blockedType: "workflow",
        blockedId: "wf-123",
        blockedLabel: "Release workflow",
        isCriticalPath: false,
      });

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.addDependency({
        reviewId: TEST_REVIEW_ID,
        blockedType: "workflow",
        blockedId: "wf-123",
        blockedLabel: "Release workflow",
      });

      expect(result?.blockedType).toBe("workflow");
      expect(addReviewDependencyMock).toHaveBeenCalled();
    });

    it("throws FORBIDDEN when adding to another user's review", async () => {
      const caller = await createTestCaller({ userId: TEST_USER_ID });
      getReviewByIdMock.mockResolvedValueOnce(
        createMockReview({ userId: "other-user" })
      );
      let thrown: unknown = null;
      try {
        await caller.review.addDependency({
          reviewId: TEST_REVIEW_ID,
          blockedType: "workflow",
          blockedId: "wf-123",
        });
      } catch (error) {
        thrown = error;
      }

      expect(getReviewByIdMock).toHaveBeenCalledWith(TEST_REVIEW_ID);
      expect(thrown).toBeInstanceOf(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.addDependency({
          reviewId: TEST_REVIEW_ID,
          blockedType: "workflow",
          blockedId: "wf-123",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("delegate", () => {
    it("delegates review to another user", async () => {
      const delegatedReview = createMockReview({
        delegatedTo: "delegate-user",
        delegatedBy: TEST_USER_ID,
      });
      delegateReviewMock.mockResolvedValue(delegatedReview);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.delegate({
        reviewId: TEST_REVIEW_ID,
        toUserId: "delegate-user",
      });

      expect(result).toBeDefined();
      expect(delegateReviewMock).toHaveBeenCalledWith(
        TEST_REVIEW_ID,
        TEST_USER_ID,
        "delegate-user"
      );
    });

    it("throws NOT_FOUND when review cannot be delegated", async () => {
      delegateReviewMock.mockResolvedValue(null);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.delegate({
          reviewId: TEST_REVIEW_ID,
          toUserId: "delegate-user",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.delegate({
          reviewId: TEST_REVIEW_ID,
          toUserId: "delegate-user",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("delegatedToMe", () => {
    it("returns reviews delegated to current user", async () => {
      const delegatedReviews = [
        createMockReview({ id: TEST_REVIEW_ID, delegatedTo: TEST_USER_ID }),
        createMockReview({ id: TEST_REVIEW_ID_2, delegatedTo: TEST_USER_ID }),
      ];
      getDelegatedReviewsMock.mockResolvedValue(delegatedReviews);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.delegatedToMe();

      expect(result).toHaveLength(2);
      expect(getDelegatedReviewsMock).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.delegatedToMe()).rejects.toThrow(TRPCError);
    });
  });

  describe("auditLog", () => {
    it("returns audit log for review owned by user", async () => {
      getReviewByIdMock.mockResolvedValue(createMockReview());
      const mockLogs = [
        {
          id: "log-1",
          reviewId: TEST_REVIEW_ID,
          action: "viewed",
          createdAt: new Date(),
        },
        {
          id: "log-2",
          reviewId: TEST_REVIEW_ID,
          action: "approved",
          createdAt: new Date(),
        },
      ];
      getReviewAuditLogMock.mockResolvedValue(mockLogs);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.auditLog({ reviewId: TEST_REVIEW_ID });

      expect(result).toHaveLength(2);
      expect(getReviewAuditLogMock).toHaveBeenCalledWith(TEST_REVIEW_ID);
    });

    it("throws FORBIDDEN when accessing another user's review audit", async () => {
      getReviewByIdMock.mockResolvedValue(
        createMockReview({ userId: "other-user" })
      );

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.auditLog({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.auditLog({ reviewId: TEST_REVIEW_ID })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("myAuditLog", () => {
    it("returns user audit log with default limit", async () => {
      const mockLogs = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `log-${i}`,
          reviewId: TEST_REVIEW_ID,
          action: "viewed",
          createdAt: new Date(),
        }));
      getUserAuditLogMock.mockResolvedValue(mockLogs);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.myAuditLog();

      expect(result).toHaveLength(10);
      expect(getUserAuditLogMock).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 50,
        since: undefined,
      });
    });

    it("respects custom limit parameter", async () => {
      getUserAuditLogMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await caller.review.myAuditLog({ limit: 20 });

      expect(getUserAuditLogMock).toHaveBeenCalledWith(TEST_USER_ID, {
        limit: 20,
        since: undefined,
      });
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.myAuditLog()).rejects.toThrow(TRPCError);
    });
  });

  describe("history", () => {
    it("returns completed reviews history", async () => {
      const completedReviews = [
        createMockReview({ id: TEST_REVIEW_ID, status: "approved" }),
        createMockReview({ id: TEST_REVIEW_ID_2, status: "rejected" }),
      ];
      getReviewQueueMock.mockResolvedValue(completedReviews);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.history();

      expect(result).toHaveLength(2);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.history()).rejects.toThrow(TRPCError);
    });
  });

  describe("templates", () => {
    it("returns templates for authenticated user", async () => {
      const mockTemplates = [
        {
          id: "tpl-1",
          userId: TEST_USER_ID,
          name: "Security Concern",
          templateType: "rejection",
          title: "Security Risk",
          message: "Rejected for security reasons",
          isDefault: true,
        },
        {
          id: "tpl-2",
          userId: "system",
          name: "LGTM",
          templateType: "approval",
          title: "Approved",
          message: "Looks good to me",
          isDefault: true,
        },
      ];
      getReviewTemplatesMock.mockResolvedValue(mockTemplates);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.templates();

      expect(result).toHaveLength(2);
      expect(getReviewTemplatesMock).toHaveBeenCalledWith(TEST_USER_ID, {
        templateType: undefined,
        reviewType: undefined,
      });
    });

    it("filters by template type", async () => {
      getReviewTemplatesMock.mockResolvedValue([]);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await caller.review.templates({ templateType: "rejection" });

      expect(getReviewTemplatesMock).toHaveBeenCalledWith(TEST_USER_ID, {
        templateType: "rejection",
        reviewType: undefined,
      });
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(caller.review.templates()).rejects.toThrow(TRPCError);
    });
  });

  describe("createTemplate", () => {
    it("creates a custom template", async () => {
      const newTemplate = {
        id: "tpl-new",
        userId: TEST_USER_ID,
        name: "Custom Rejection",
        templateType: "rejection",
        title: "Not Approved",
        message: "Custom rejection message",
        useCount: 0,
        isDefault: false,
        isActive: true,
      };
      createReviewTemplateMock.mockResolvedValue(newTemplate);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.createTemplate({
        name: "Custom Rejection",
        templateType: "rejection",
        title: "Not Approved",
        message: "Custom rejection message",
      });

      expect(result.name).toBe("Custom Rejection");
      expect(createReviewTemplateMock).toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.createTemplate({
          name: "Test",
          templateType: "rejection",
          title: "Test",
          message: "Test message",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("updateTemplate", () => {
    it("updates a template owned by user", async () => {
      const updatedTemplate = {
        id: "tpl-1",
        userId: TEST_USER_ID,
        name: "Updated Name",
        templateType: "rejection",
        title: "Updated Title",
        message: "Updated message",
      };
      updateReviewTemplateMock.mockResolvedValue(updatedTemplate);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.updateTemplate({
        templateId: "11111111-1111-4111-8111-111111111111",
        title: "Updated Title",
        message: "Updated message",
      });

      expect(result.title).toBe("Updated Title");
    });

    it("throws NOT_FOUND when template not found", async () => {
      updateReviewTemplateMock.mockResolvedValue(null);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.updateTemplate({
          templateId: "11111111-1111-4111-8111-111111111111",
          title: "New Title",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.updateTemplate({
          templateId: "11111111-1111-4111-8111-111111111111",
          title: "New Title",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("deleteTemplate", () => {
    it("deletes a template owned by user", async () => {
      deleteReviewTemplateMock.mockResolvedValue(true);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.deleteTemplate({
        templateId: "11111111-1111-4111-8111-111111111111",
      });

      expect(result.success).toBe(true);
    });

    it("throws NOT_FOUND when template not found or is system template", async () => {
      deleteReviewTemplateMock.mockResolvedValue(false);

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      await expect(
        caller.review.deleteTemplate({
          templateId: "11111111-1111-4111-8111-111111111111",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.deleteTemplate({
          templateId: "11111111-1111-4111-8111-111111111111",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("useTemplate", () => {
    it("records template usage", async () => {
      recordTemplateUsageMock.mockResolvedValue();

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.useTemplate({
        templateId: "11111111-1111-4111-8111-111111111111",
      });

      expect(result.success).toBe(true);
      expect(recordTemplateUsageMock).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111"
      );
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.useTemplate({
          templateId: "11111111-1111-4111-8111-111111111111",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("bulkImport", () => {
    it("imports multiple reviews", async () => {
      createReviewMock.mockResolvedValue(createMockReview());

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.bulkImport({
        reviews: [
          {
            reviewType: "tool_execution",
            priority: "high",
            subjectData: { toolName: "test" },
          },
          {
            reviewType: "memory",
            priority: "low",
            subjectData: { fact: "test fact" },
          },
        ],
      });

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(createReviewMock).toHaveBeenCalledTimes(2);
    });

    it("handles partial failures", async () => {
      createReviewMock
        .mockResolvedValueOnce(createMockReview())
        .mockRejectedValueOnce(new Error("DB error"));

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.bulkImport({
        reviews: [
          { reviewType: "tool_execution", subjectData: { toolName: "test" } },
          { reviewType: "memory", subjectData: { fact: "test" } },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(1);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.bulkImport({
          reviews: [{ reviewType: "tool_execution", subjectData: {} }],
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("exportMetrics", () => {
    it("exports metrics in JSON format", async () => {
      getAnalyticsMock.mockResolvedValue({
        total: {
          reviewed: 100,
          approved: 80,
          rejected: 20,
          skipped: 0,
          approvalRate: 80,
        },
        byType: {},
        autoApprovePatterns: 5,
      });
      getCycleTimeStatsMock.mockResolvedValue({
        avgCycleTime: 60_000,
        codeAvg: 0,
        toolAvg: 0,
        memoryAvg: 0,
        workflowAvg: 0,
        trend: [],
        slaBreaches: 2,
      });
      getRiskCountsMock.mockResolvedValue({
        high: 2,
        medium: 1,
        low: 0,
        total: 3,
      });

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.exportMetrics({ format: "json" });

      expect(result.format).toBe("json");
      expect(result.data).toBeDefined();
      expect(result.data.analytics).toBeDefined();
    });

    it("exports metrics in CSV format", async () => {
      getAnalyticsMock.mockResolvedValue({
        total: {
          reviewed: 100,
          approved: 80,
          rejected: 20,
          skipped: 0,
          approvalRate: 80,
        },
        byType: {},
        autoApprovePatterns: 5,
      });
      getCycleTimeStatsMock.mockResolvedValue({
        avgCycleTime: 60_000,
        trend: [],
        slaBreaches: 2,
      });
      getRiskCountsMock.mockResolvedValue({
        high: 2,
        medium: 1,
        low: 0,
        total: 3,
      });

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.exportMetrics({ format: "csv" });

      expect(result.format).toBe("csv");
      expect(typeof result.data).toBe("string");
      expect(result.data).toContain("Metric,Value");
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.exportMetrics({ format: "json" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("batchReject", () => {
    it("batch rejects multiple reviews", async () => {
      submitReviewMock.mockResolvedValue(
        createMockReview({ status: "rejected" })
      );

      const caller = await createTestCaller({ userId: TEST_USER_ID });
      const result = await caller.review.batchReject({
        reviewIds: [TEST_REVIEW_ID, TEST_REVIEW_ID_2],
        reason: "Security concern",
      });

      expect(result.rejected).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("throws UNAUTHORIZED for unauthenticated users", async () => {
      const caller = await createUnauthedCaller();
      await expect(
        caller.review.batchReject({
          reviewIds: [TEST_REVIEW_ID],
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});
