import type { Timestamp } from "./cognitive";

export type FocusSetStatus = "active" | "closed";
export type FocusLane = "spotlight" | "background" | "maintenance";
export type FocusCommitmentStatus = "active" | "paused" | "done" | "cancelled";

export type FocusSetRecord = {
  id: string;
  title: string | null;
  status: FocusSetStatus;
  wipLimit: number;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  lastTouchedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type FocusCommitmentRecord = {
  id: string;
  focusSetId: string;
  title: string;
  status: FocusCommitmentStatus;
  lane: FocusLane;
  priority: number;
  workflowRunId: string | null;
  conversationId: string | null;
  lastTouchedAt: Timestamp | null;
  metadata: Record<string, unknown> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type AttentionStatus = "open" | "acknowledged" | "resolved";
export type AttentionUrgency = "low" | "normal" | "high" | "critical";

export type AttentionItemRecord = {
  id: string;
  focusSetId: string | null;
  commitmentId: string | null;
  workflowRunId: string | null;
  kind: string;
  status: AttentionStatus;
  urgency: AttentionUrgency;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  resolvedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DeltaBriefScope = "focus_set" | "commitment" | "workflow_run";

export type DeltaBriefRecord = {
  id: string;
  focusSetId: string | null;
  commitmentId: string | null;
  workflowRunId: string | null;
  scope: DeltaBriefScope;
  sinceAt: Timestamp | null;
  untilAt: Timestamp | null;
  summaryText: string;
  data: Record<string, unknown> | null;
  createdAt: Timestamp;
};

