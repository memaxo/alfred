/**
 * ALFRED CarPlay API Client
 *
 * tRPC client wrapper for CarPlay operations.
 * Provides typed API calls for workflows, plans, PRs, and reviews.
 *
 * Note: This module requires a tRPC client to be set via setTrpcClient()
 * before any API calls are made. The client is typically set by the
 * CarPlay controller during initialization.
 */

import type { TRPCClient } from "@trpc/client";

import type { TRPCAppRouter } from "../../utils/trpc";
import type {
  ExecPlan,
  PullRequest,
  ReviewItem,
  WorkflowState,
  WorkflowStatus,
} from "./types";

// Module-level client reference (set during CarPlay initialization)
let trpcClient: TRPCClient<TRPCAppRouter> | null = null;

// Set the tRPC client (called from controller initialization)
export function setTrpcClient(client: TRPCClient<TRPCAppRouter>): void {
  trpcClient = client;
}

// Get the client or throw if not set
export function getClient(): TRPCClient<TRPCAppRouter> {
  if (!trpcClient) {
    throw new Error(
      "CarPlay API client not initialized. Call setTrpcClient() first."
    );
  }
  return trpcClient;
}

// Workflow APIs
export async function listWorkflows(options?: {
  status?: WorkflowStatus;
  limit?: number;
}): Promise<WorkflowState[]> {
  const client = getClient();
  const runs = await client.workflow.listRuns.query({
    status: options?.status,
    limit: options?.limit ?? 20,
  });

  return runs.map(mapRunToWorkflowState);
}

export async function getWorkflow(
  runId: string
): Promise<WorkflowState | null> {
  try {
    const client = getClient();
    const run = await client.workflow.get.query({ runId });
    return mapRunToWorkflowState(run);
  } catch {
    return null;
  }
}

export async function cancelWorkflow(runId: string): Promise<boolean> {
  const client = getClient();
  const result = await client.workflow.cancel.mutate({ runId });
  return result.cancelled;
}

export async function suspendWorkflow(runId: string): Promise<boolean> {
  const client = getClient();
  const result = await client.workflow.suspend.mutate({ runId });
  return result.ok;
}

export async function resumeWorkflow(
  runId: string,
  options?: { clarificationId?: string; response?: string }
): Promise<boolean> {
  const client = getClient();
  const result = await client.workflow.resume.mutate({
    runId,
    clarificationId: options?.clarificationId,
    response: options?.response,
  });
  return result.ok;
}

// Plan APIs
export async function listPendingPlans(): Promise<ExecPlan[]> {
  const client = getClient();
  const plans = await client.plan.list.query({ status: "pending", limit: 20 });
  return plans.map(mapPlanToExecPlan);
}

export async function getPlan(planId: string): Promise<ExecPlan | null> {
  try {
    const client = getClient();
    const plan = await client.plan.get.query({ planId });
    return mapPlanToExecPlan(plan);
  } catch {
    return null;
  }
}

export async function approvePlan(planId: string): Promise<boolean> {
  try {
    const client = getClient();
    await client.plan.approve.mutate({ planId });
    return true;
  } catch {
    return false;
  }
}

export async function rejectPlan(
  planId: string,
  reason?: string
): Promise<boolean> {
  try {
    const client = getClient();
    await client.plan.reject.mutate({ planId, reason });
    return true;
  } catch {
    return false;
  }
}

// PR APIs
export async function listPullRequests(options?: {
  state?: "open" | "closed" | "all";
  limit?: number;
}): Promise<PullRequest[]> {
  const client = getClient();
  const result = await client.github.pullRequestsList.query({
    state: options?.state ?? "open",
    limit: options?.limit ?? 30,
  });

  return result.pullRequests.map(mapGitHubPRToPullRequest);
}

export async function getPullRequest(
  number: number
): Promise<PullRequest | null> {
  try {
    const client = getClient();
    const pr = await client.github.pullRequestGet.query({ number });
    return mapGitHubPRToPullRequest(pr);
  } catch {
    return null;
  }
}

export async function mergePullRequest(
  number: number,
  method: "merge" | "squash" | "rebase" = "squash"
): Promise<boolean> {
  try {
    const client = getClient();
    const result = await client.github.pullRequestMerge.mutate({
      number,
      method,
    });
    return result.merged;
  } catch {
    return false;
  }
}

// Review APIs
export async function listReviews(options?: {
  filter?:
    | "all"
    | "tool_execution"
    | "message"
    | "memory"
    | "workflow"
    | "code";
  limit?: number;
}): Promise<ReviewItem[]> {
  const client = getClient();
  const result = await client.review.queue.query({
    filter: options?.filter ?? "all",
    limit: options?.limit ?? 20,
  });

  return result.reviews.map(mapReviewToReviewItem);
}

export async function submitReview(
  reviewId: string,
  verdict: "approve" | "reject" | "skip",
  correction?: {
    type: "delete" | "edit" | "replace" | "fix";
    feedback?: string;
  }
): Promise<boolean> {
  try {
    const client = getClient();
    const result = await client.review.submit.mutate({
      reviewId,
      verdict,
      correction,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function batchApproveReviews(
  reviewIds: string[]
): Promise<number> {
  const client = getClient();
  const result = await client.review.batchApprove.mutate({ reviewIds });
  return result.approved;
}

export async function getPendingReviewCount(filter?: string): Promise<number> {
  const client = getClient();
  const result = await client.review.pendingCount.query({
    filter: filter as
      | "all"
      | "tool_execution"
      | "message"
      | "memory"
      | "workflow"
      | "code"
      | undefined,
  });
  return result.count;
}

// Helper: Map backend run to WorkflowState
function mapRunToWorkflowState(run: {
  id: string;
  requirement?: string | null;
  status: string;
  planId?: string | null;
  linearIssueId?: string | null;
  created?: string | Date | null;
  completedAt?: string | Date | null;
  inputData?: unknown;
}): WorkflowState {
  const inputData = run.inputData as { requirement?: string } | null;

  // Handle both string and Date for timestamps
  const parseTimestamp = (val: string | Date | null | undefined): number => {
    if (!val) {
      return Date.now();
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    return new Date(val).getTime();
  };

  return {
    id: run.id,
    requirement: run.requirement ?? inputData?.requirement ?? "",
    status: run.status as WorkflowStatus,
    progress:
      run.status === "completed" ? 100 : run.status === "running" ? 50 : 0,
    completedTasks: 0, // Would need to fetch from snapshot
    totalTasks: 0,
    startedAt: parseTimestamp(run.created),
    updatedAt: parseTimestamp(run.completedAt),
    planId: run.planId ?? undefined,
    linearIssueId: run.linearIssueId ?? undefined,
  };
}

// Helper: Map backend plan to ExecPlan
function mapPlanToExecPlan(plan: {
  id: string;
  intent?: string | null;
  plan?: unknown;
  created?: Date | null;
}): ExecPlan {
  const structured = plan.plan as {
    id?: string;
    title?: string;
    phases?: Array<{
      id: string;
      name: string;
      tasks?: unknown[];
      estimatedMinutes?: number;
    }>;
  } | null;

  const phases = structured?.phases ?? [];
  const subtaskCount = phases.reduce(
    (sum, p) => sum + (p.tasks?.length ?? 0),
    0
  );

  return {
    id: plan.id,
    runId: "", // Would need to lookup
    title: structured?.title ?? plan.intent ?? "Untitled Plan",
    requirement: plan.intent ?? "",
    phases: phases.map((p) => ({
      id: p.id,
      name: p.name,
      taskCount: p.tasks?.length ?? 0,
      estimatedMinutes: p.estimatedMinutes ?? 10,
    })),
    estimatedTime: phases.reduce(
      (sum, p) => sum + (p.estimatedMinutes ?? 10),
      0
    ),
    riskLevel: "medium",
    waveCount: phases.length,
    subtaskCount,
    createdAt: plan.created?.getTime() ?? Date.now(),
  };
}

// Helper: Map GitHub PR to PullRequest
function mapGitHubPRToPullRequest(pr: {
  id: string;
  number: number;
  title: string;
  author: string;
  repository?: string;
  branch: string;
  baseBranch: string;
  status: string;
  reviewStatus: string;
  ciStatus: string;
  additions: number;
  deletions: number;
  isAgentCreated: boolean;
  isDraft: boolean;
  url: string;
  createdAt: string;
  updatedAt: string;
}): PullRequest {
  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    author: pr.author,
    repository: pr.repository ?? "alfred",
    branch: pr.branch,
    baseBranch: pr.baseBranch,
    status: pr.status as "open" | "merged" | "closed",
    reviewStatus: pr.reviewStatus as
      | "pending"
      | "approved"
      | "changes_requested",
    ciStatus: pr.ciStatus as "pending" | "success" | "failure" | "running",
    additions: pr.additions,
    deletions: pr.deletions,
    filesChanged: 0, // Not in list response
    isAgentCreated: pr.isAgentCreated,
    isDraft: pr.isDraft,
    url: pr.url,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
  };
}

// Helper: Map review queue item to ReviewItem
function mapReviewToReviewItem(review: {
  id: string;
  reviewType: string;
  priority: string;
  subjectData?: unknown;
  confidence?: number | null;
  workflowRunId?: string | null;
  prNumber?: number | null;
  created?: Date | null;
}): ReviewItem {
  const subject = review.subjectData as {
    title?: string;
    description?: string;
  } | null;

  return {
    id: review.id,
    type: review.reviewType as ReviewItem["type"],
    priority: review.priority as "critical" | "high" | "normal",
    title: subject?.title ?? `Review ${review.reviewType}`,
    description: subject?.description ?? "",
    confidence: review.confidence ?? 0.5,
    workflowRunId: review.workflowRunId ?? undefined,
    prNumber: review.prNumber ?? undefined,
    createdAt: review.created?.toISOString() ?? new Date().toISOString(),
  };
}

// Voice workflow APIs (uses voice router internally)
export async function parseVoiceIntent(text: string): Promise<{
  type: string;
  intent?: unknown;
  questions?: unknown[];
}> {
  const client = getClient();
  const result = await client.plan.parseIntent.mutate({
    input: text,
    source: "voice",
  });
  return result as { type: string; intent?: unknown; questions?: unknown[] };
}
