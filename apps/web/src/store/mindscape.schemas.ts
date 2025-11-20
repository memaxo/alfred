import { z } from "zod";
import { uiMessageSchema } from "@alfred/type/stream.zod";

/**
 * Base schema for all artifact data - includes common fields.
 */
const baseArtifactDataSchema = z.object({
  label: z.string().optional(),
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
  status: z.enum(["Idle", "running", "completed", "failed"]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
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
  title: z.string().optional(),
  due: z.string().optional(), // ISO 8601 date string
});

/**
 * Schema for note node data.
 * @example { title: "Meeting notes", content: "Discussed...", tags: ["work", "meeting"] }
 */
export const noteNodeDataSchema = baseArtifactDataSchema.extend({
  title: z.string().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
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

