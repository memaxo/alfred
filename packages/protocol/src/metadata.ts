/**
 * Agent metadata schemas for tool responses
 *
 * Metadata provides observability and debugging information
 * about agent execution.
 */

import { z } from "zod";

/**
 * Token usage from model responses
 */
export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
});

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

/**
 * Agent metadata included in tool responses
 */
export const agentMetadataSchema = z.object({
  agentName: z.string(),
  agentVersion: z.string().optional(),
  modelUsed: z.string().optional(),
  threadId: z.string().optional(),
  sessionId: z.string().optional(),
  turnDurationMs: z.number().int().nonnegative().optional(),
  tokenUsage: tokenUsageSchema.optional(),
  resumedFromThread: z.boolean().optional(),
  workingDirectory: z.string().optional(),
  autonomyLevel: z.enum(["read", "low", "medium", "high"]).optional(),
});

export type AgentMetadata = z.infer<typeof agentMetadataSchema>;

/**
 * Artifact summary from tool execution
 */
export const artifactSummarySchema = z.object({
  path: z.string(),
  kind: z.string(),
});

export type ArtifactSummary = z.infer<typeof artifactSummarySchema>;

/**
 * Reasoning trace from agent execution
 */
export const reasoningTraceSchema = z.object({
  text: z.string(),
  timestamp: z.number(),
});

export type ReasoningTrace = z.infer<typeof reasoningTraceSchema>;

/**
 * Extended tool output schema with metadata
 */
export const toolOutputWithMetadataSchema = z.object({
  result: z.string(),
  artifacts: z.array(artifactSummarySchema).optional(),
  reasoning: z.array(reasoningTraceSchema).optional(),
  metadata: agentMetadataSchema.optional(),
  sessionState: z
    .object({
      sessionId: z.string(),
      threadId: z.string(),
      canResume: z.boolean(),
      resumeReason: z.string().optional(),
      isResumed: z.boolean().optional(),
    })
    .optional(),
});

export type ToolOutputWithMetadata = z.infer<typeof toolOutputWithMetadataSchema>;

/**
 * Create metadata from execution context
 */
export function createAgentMetadata(params: {
  agentName: string;
  agentVersion?: string;
  modelUsed?: string;
  threadId?: string;
  sessionId?: string;
  turnDurationMs?: number;
  tokenUsage?: TokenUsage;
  resumedFromThread?: boolean;
  workingDirectory?: string;
  autonomyLevel?: "read" | "low" | "medium" | "high";
}): AgentMetadata {
  const metadata: AgentMetadata = {
    agentName: params.agentName,
  };

  if (params.agentVersion) metadata.agentVersion = params.agentVersion;
  if (params.modelUsed) metadata.modelUsed = params.modelUsed;
  if (params.threadId) metadata.threadId = params.threadId;
  if (params.sessionId) metadata.sessionId = params.sessionId;
  if (params.turnDurationMs !== undefined)
    metadata.turnDurationMs = params.turnDurationMs;
  if (params.tokenUsage) metadata.tokenUsage = params.tokenUsage;
  if (params.resumedFromThread !== undefined)
    metadata.resumedFromThread = params.resumedFromThread;
  if (params.workingDirectory) metadata.workingDirectory = params.workingDirectory;
  if (params.autonomyLevel) metadata.autonomyLevel = params.autonomyLevel;

  return metadata;
}
