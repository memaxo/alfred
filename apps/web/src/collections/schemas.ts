import { z } from "zod";

export const noteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  content: z.string(),
  tags: z.array(z.string()).nullable(),
  created: z.string(),
  updated: z.string(),
});

export type NoteResource = z.infer<typeof noteSchema>;

export const reminderSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  due: z.string(),
  status: z.enum(["scheduled", "due", "fired"]),
  created: z.string(),
  updated: z.string().nullable(),
});

export type ReminderResource = z.infer<typeof reminderSchema>;

export const threadSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  created: z.string(),
  updated: z.string(),
});

export type ThreadResource = z.infer<typeof threadSchema>;

export const workflowRunSchema = z.object({
  id: z.string().uuid(),
  requirement: z.string().nullable(),
  status: z.enum([
    "pending",
    "running",
    "completed",
    "failed",
    "suspended",
    "cancelled",
  ]),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
});

export type WorkflowRunResource = z.infer<typeof workflowRunSchema>;

export const edgeSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string(),
  targetId: z.string(),
  kind: z.string(),
  createdAt: z.string(),
});

export type EdgeResource = z.infer<typeof edgeSchema>;
