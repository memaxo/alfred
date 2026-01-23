import { z } from "zod";

export const focusSetStatusSchema = z.enum(["active", "closed"]);
export const focusLaneSchema = z.enum(["spotlight", "background", "maintenance"]);
export const focusCommitmentStatusSchema = z.enum([
  "active",
  "paused",
  "done",
  "cancelled",
]);

export const attentionStatusSchema = z.enum(["open", "acknowledged", "resolved"]);
export const attentionUrgencySchema = z.enum(["low", "normal", "high", "critical"]);

export const deltaBriefScopeSchema = z.enum([
  "focus_set",
  "commitment",
  "workflow_run",
]);

