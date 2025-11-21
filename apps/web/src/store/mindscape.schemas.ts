import { z } from "zod";
import { uiMessageSchema } from "@alfred/type/stream.zod";

const graphMappingSchema = z
  .object({
    dbId: z.string().uuid().optional(),
    hgHash: z.string().optional(),
  })
  .optional();

/**
 * Base schema for all artifact data - includes common fields.
 */
const baseArtifactDataSchema = z.object({
  label: z.string().optional(),
  graph: graphMappingSchema,
});

/**
 * Schema for code node data.
 * @example { path: "/src/components/app.tsx" }
 */
export const codeNodeDataSchema = baseArtifactDataSchema.extend({
  path: z.string().optional(),
});

/**
 * Schema for chat node data.
 * Stores conversation messages and optional error state.
 * @example { messages: [...], error: "Connection failed" }
 */
export const chatNodeDataSchema = baseArtifactDataSchema.extend({
  messages: z.array(uiMessageSchema).optional(),
  error: z.string().optional(),
});

/**
 * Schema for workflow node data.
 * Tracks execution state, plan details, and action messages.
 * @example { status: "running", title: "Build project", messages: [...] }
 */
export const workflowNodeDataSchema = baseArtifactDataSchema.extend({
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

/**
 * Schema for ticket node data.
 * Represents Linear issue data.
 * @example { title: "Fix bug", status: "in_progress", priority: "high", identifier: "LIN-123", issueId: "abc123" }
 */
export const ticketNodeDataSchema = baseArtifactDataSchema.extend({
  title: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  identifier: z.string().optional(),
  issueId: z.string().optional(),
});

/**
 * Schema for reminder node data.
 * @example { title: "Call client", due: "2024-01-15T10:00:00Z" }
 */
export const reminderNodeDataSchema = baseArtifactDataSchema.extend({
  reminderId: z.string().uuid().optional(),
  title: z.string().optional(),
  due: z.string().optional(), // ISO 8601 date string
  description: z.string().optional(),
  status: z.enum(["scheduled", "due", "fired"]).optional(),
  mode: z.enum(["view", "edit"]).optional(),
});

/**
 * Schema for note node data.
 * @example { title: "Meeting notes", content: "Discussed...", tags: ["work", "meeting"] }
 */
export const noteNodeDataSchema = baseArtifactDataSchema.extend({
  noteId: z.string().uuid().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mode: z.enum(["view", "edit"]).optional(),
  updatedAt: z.string().optional(),
});

export const timerNodeDataSchema = baseArtifactDataSchema.extend({
  defaultMinutes: z.number().int().min(1).max(600).optional(),
  lastLabel: z.string().optional(),
});

export const bookmarkNodeDataSchema = baseArtifactDataSchema.extend({
  lastTags: z.array(z.string()).optional(),
});

export const todoNodeDataSchema = baseArtifactDataSchema.extend({
  filter: z.enum(["all", "active", "completed"]).optional(),
});

export const settingsNodeDataSchema = baseArtifactDataSchema.extend({
  autonomy: z.enum(["read", "low", "medium", "high"]).optional(),
  voiceProvider: z.enum(["local", "openai"]).optional(),
});

export const privacyNodeDataSchema = baseArtifactDataSchema.extend({
  lastExportedAt: z.string().optional(),
});

export const profileNodeDataSchema = baseArtifactDataSchema.extend({
  lastUpdatedAt: z.string().optional(),
});

export const integrationsNodeDataSchema = baseArtifactDataSchema.extend({
  lastLinearStatus: z.string().optional(),
});

export const workflowListNodeDataSchema = baseArtifactDataSchema.extend({
  filter: z
    .enum(["all", "running", "completed", "failed", "suspended", "cancelled"])
    .optional(),
});

export const deploymentNodeDataSchema = baseArtifactDataSchema.extend({
  liveHealth: z.boolean().optional(),
});

export const knowledgeNodeDataSchema = baseArtifactDataSchema.extend({
  kind: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Schema for terminal node data.
 * Terminal nodes don't have specific data fields beyond the base.
 */
export const terminalNodeDataSchema = baseArtifactDataSchema;

/**
 * Schema for artifact node data.
 * Generic artifact with optional label.
 */
export const artifactNodeDataSchema = baseArtifactDataSchema;

/**
 * Schema for orb node data.
 * Orb nodes don't have specific data fields beyond the base.
 */
export const orbNodeDataSchema = baseArtifactDataSchema;

/**
 * Discriminated union schema for all artifact data types.
 * Validates node data based on the 'type' field.
 */
export const artifactDataSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("code") }).merge(codeNodeDataSchema),
  z.object({ type: z.literal("chat") }).merge(chatNodeDataSchema),
  z.object({ type: z.literal("workflow") }).merge(workflowNodeDataSchema),
  z.object({ type: z.literal("ticket") }).merge(ticketNodeDataSchema),
  z.object({ type: z.literal("reminder") }).merge(reminderNodeDataSchema),
  z.object({ type: z.literal("note") }).merge(noteNodeDataSchema),
  z.object({ type: z.literal("timer") }).merge(timerNodeDataSchema),
  z.object({ type: z.literal("bookmark") }).merge(bookmarkNodeDataSchema),
  z.object({ type: z.literal("todo") }).merge(todoNodeDataSchema),
  z.object({ type: z.literal("settings") }).merge(settingsNodeDataSchema),
  z.object({ type: z.literal("privacy") }).merge(privacyNodeDataSchema),
  z.object({ type: z.literal("profile") }).merge(profileNodeDataSchema),
  z.object({ type: z.literal("integrations") }).merge(integrationsNodeDataSchema),
  z.object({ type: z.literal("workflowlist") }).merge(workflowListNodeDataSchema),
  z.object({ type: z.literal("deployment") }).merge(deploymentNodeDataSchema),
  z.object({ type: z.literal("knowledge") }).merge(knowledgeNodeDataSchema),
  z.object({ type: z.literal("terminal") }).merge(terminalNodeDataSchema),
  z.object({ type: z.literal("artifact") }).merge(artifactNodeDataSchema),
  z.object({ type: z.literal("orb") }).merge(orbNodeDataSchema),
]);

/**
 * Helper function to get the appropriate schema for a node type.
 * @param nodeType - The type of the node
 * @returns The Zod schema for that node type, or base schema if unknown
 */
export function getNodeDataSchema(
  nodeType: string | undefined
): z.ZodTypeAny {
  switch (nodeType) {
    case "code":
      return codeNodeDataSchema;
    case "chat":
      return chatNodeDataSchema;
    case "workflow":
      return workflowNodeDataSchema;
    case "ticket":
      return ticketNodeDataSchema;
    case "reminder":
      return reminderNodeDataSchema;
    case "note":
      return noteNodeDataSchema;
    case "timer":
      return timerNodeDataSchema;
    case "bookmark":
      return bookmarkNodeDataSchema;
    case "todo":
      return todoNodeDataSchema;
    case "settings":
      return settingsNodeDataSchema;
    case "privacy":
      return privacyNodeDataSchema;
    case "profile":
      return profileNodeDataSchema;
    case "integrations":
      return integrationsNodeDataSchema;
    case "workflowlist":
      return workflowListNodeDataSchema;
    case "deployment":
      return deploymentNodeDataSchema;
    case "knowledge":
      return knowledgeNodeDataSchema;
    case "terminal":
      return terminalNodeDataSchema;
    case "artifact":
      return artifactNodeDataSchema;
    case "orb":
      return orbNodeDataSchema;
    default:
      return baseArtifactDataSchema;
  }
}
