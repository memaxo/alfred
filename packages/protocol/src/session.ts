/**
 * Session state types for agent protocol
 *
 * Sessions track the state of an agent interaction across multiple turns.
 */

import { z } from "zod";

export const sessionStatusSchema = z.enum(["active", "completed", "failed"]);

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const sessionStateSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  threadId: z.string().min(1),
  workingDirectory: z.string().min(1),
  status: sessionStatusSchema,
  linearIssueId: z.string().optional(),
  createdAt: z.number(),
  lastAccessedAt: z.number(),
  expiresAt: z.number(),
});

export type SessionState = z.infer<typeof sessionStateSchema>;

export const sessionResumeResultSchema = z.discriminatedUnion("canResume", [
  z.object({
    canResume: z.literal(true),
    session: sessionStateSchema,
  }),
  z.object({
    canResume: z.literal(false),
    reason: z.enum([
      "missing-session",
      "missing-thread",
      "missing-working-directory",
      "directory-mismatch",
      "thread-invalid",
      "timeout",
    ]),
  }),
]);

export type SessionResumeResult = z.infer<typeof sessionResumeResultSchema>;

/**
 * Session state returned in tool responses
 */
export const responseSessionStateSchema = z.object({
  sessionId: z.string(),
  threadId: z.string(),
  canResume: z.boolean(),
  resumeReason: z.string().optional(),
  isResumed: z.boolean().optional(),
});

export type ResponseSessionState = z.infer<typeof responseSessionStateSchema>;
