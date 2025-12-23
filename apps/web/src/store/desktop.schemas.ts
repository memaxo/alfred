import { uiMessageSchema } from "@alfred/type/stream.zod";
import { z } from "zod";

const resourceRefSchema = z.object({
  type: z.enum([
    "note",
    "reminder",
    "thread",
    "workflow_run",
    "preference",
    "integration",
  ]),
  id: z.string(),
});

const baseWindowDataSchema = z.object({
  type: z.string(),
  label: z.string().optional(),
  resourceRef: resourceRefSchema.optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
});

export const chatWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("chat"),
  messages: z.array(uiMessageSchema).optional(),
  error: z.string().optional(),
});

export const terminalWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("terminal"),
  sessionId: z.string().optional(),
});

export const droidWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("droid"),
  prompt: z.string().optional(),
  auto: z.enum(["read", "low", "medium", "high"]).optional(),
  out: z.enum(["text", "json", "debug"]).optional(),
  status: z
    .enum(["idle", "running", "suspended", "completed", "failed"])
    .optional(),
  log: z
    .array(
      z.object({
        id: z.string(),
        channel: z.enum(["stdout", "stderr", "system"]),
        text: z.string(),
        at: z.string(),
      })
    )
    .optional(),
  lastRunId: z.string().uuid().optional(),
  error: z.string().optional(),
  timeoutSec: z.number().optional(),
});

export const noteWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("note"),
  noteId: z.string().uuid().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mode: z.enum(["view", "edit"]).optional(),
  updatedAt: z.string().optional(),
});

export const reminderWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("reminder"),
  reminderId: z.string().uuid().optional(),
  title: z.string().optional(),
  due: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["scheduled", "due", "fired"]).optional(),
  mode: z.enum(["view", "edit"]).optional(),
});

export const todoWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("todo"),
  filter: z.enum(["all", "active", "completed"]).optional(),
});

export const workflowWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("workflow"),
  messages: z.array(uiMessageSchema).optional(),
  status: z
    .enum(["Idle", "running", "completed", "failed", "pending", "starting"])
    .optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  requirement: z.string().optional(),
  runId: z.string().optional(),
  auto: z.enum(["read", "low", "medium", "high"]).optional(),
  mode: z.enum(["sequential", "parallel"]).optional(),
  error: z.string().optional(),
});

export const workflowListWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("workflowlist"),
  filter: z
    .enum(["all", "running", "completed", "failed", "suspended", "cancelled"])
    .optional(),
});

export const settingsWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("settings"),
  autonomy: z.enum(["read", "low", "medium", "high"]).optional(),
  voiceProvider: z.enum(["local", "openai"]).optional(),
});

export const integrationsWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("integrations"),
  lastLinearStatus: z.string().optional(),
});

export const knowledgeWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("knowledge"),
  kind: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  archived: z.string().optional(),
  source: z.enum(["user", "runtime", "rag"]).optional(),
  runId: z.string().optional(),
});

export const conceptWindowDataSchema = baseWindowDataSchema.extend({
  type: z.literal("concept"),
  entityType: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  archived: z.string().optional(),
  description: z.string().optional(),
});

export type ChatWindowData = z.infer<typeof chatWindowDataSchema>;
export type TerminalWindowData = z.infer<typeof terminalWindowDataSchema>;
export type DroidWindowData = z.infer<typeof droidWindowDataSchema>;
export type NoteWindowData = z.infer<typeof noteWindowDataSchema>;
export type ReminderWindowData = z.infer<typeof reminderWindowDataSchema>;
export type TodoWindowData = z.infer<typeof todoWindowDataSchema>;
export type WorkflowWindowData = z.infer<typeof workflowWindowDataSchema>;
export type WorkflowListWindowData = z.infer<
  typeof workflowListWindowDataSchema
>;
export type SettingsWindowData = z.infer<typeof settingsWindowDataSchema>;
export type IntegrationsWindowData = z.infer<
  typeof integrationsWindowDataSchema
>;
export type KnowledgeWindowData = z.infer<typeof knowledgeWindowDataSchema>;
export type ConceptWindowData = z.infer<typeof conceptWindowDataSchema>;

export type WindowDataUnion =
  | ChatWindowData
  | TerminalWindowData
  | DroidWindowData
  | NoteWindowData
  | ReminderWindowData
  | TodoWindowData
  | WorkflowWindowData
  | WorkflowListWindowData
  | SettingsWindowData
  | IntegrationsWindowData
  | KnowledgeWindowData
  | ConceptWindowData;

export const windowDataSchema = z.discriminatedUnion("type", [
  chatWindowDataSchema,
  terminalWindowDataSchema,
  droidWindowDataSchema,
  noteWindowDataSchema,
  reminderWindowDataSchema,
  todoWindowDataSchema,
  workflowWindowDataSchema,
  workflowListWindowDataSchema,
  settingsWindowDataSchema,
  integrationsWindowDataSchema,
  knowledgeWindowDataSchema,
  conceptWindowDataSchema,
]);

export function getWindowDataSchema(
  windowType: string | undefined
): z.ZodTypeAny {
  switch (windowType) {
    case "chat":
      return chatWindowDataSchema;
    case "terminal":
      return terminalWindowDataSchema;
    case "droid":
      return droidWindowDataSchema;
    case "note":
      return noteWindowDataSchema;
    case "reminder":
      return reminderWindowDataSchema;
    case "todo":
      return todoWindowDataSchema;
    case "workflow":
      return workflowWindowDataSchema;
    case "workflowlist":
      return workflowListWindowDataSchema;
    case "settings":
      return settingsWindowDataSchema;
    case "integrations":
      return integrationsWindowDataSchema;
    case "knowledge":
      return knowledgeWindowDataSchema;
    case "concept":
      return conceptWindowDataSchema;
    default:
      return baseWindowDataSchema;
  }
}
