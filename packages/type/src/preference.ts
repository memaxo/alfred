import { z } from "zod";
import type { UIMessage } from "./stream";

export const verbositySchema = z.enum([
  "minimal",
  "concise",
  "detailed",
  "verbose",
]);

export const toneSchema = z.enum(["formal", "casual", "technical", "friendly"]);

export const formatSchema = z.enum([
  "bullet",
  "paragraph",
  "structured",
  "narrative",
]);

export const explanationDepthSchema = z.enum(["surface", "moderate", "deep"]);

export const domainNameSchema = z.enum([
  "general",
  "proxmox",
  "git",
  "docker",
  "kubernetes",
]);

export const domainPreferenceSchema = z.enum([
  "config_format",
  "output_style",
  "tool_preference",
  "commit_style",
  "compose_version",
]);

const preferenceKeyPattern =
  /^(response\.(verbosity|tone|format|explanation_depth)|domain\.[a-z0-9_]+\.[a-z0-9_.-]+)$/i;

export const preferenceKeySchema = z
  .string()
  .regex(preferenceKeyPattern, "Invalid preference key format");

export const preferenceValueSchema = z.union([
  verbositySchema,
  toneSchema,
  formatSchema,
  explanationDepthSchema,
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

export const preferenceSourceSchema = z.enum([
  "user",
  "inferred",
  "learned",
  "default",
]);

export const preferenceSchema = z.object({
  key: preferenceKeySchema,
  value: preferenceValueSchema,
  confidence: z.number().min(0).max(1),
  source: preferenceSourceSchema,
  evidence: z.array(z.string().min(1)).optional(),
});

export type ResponseVerbosity = z.infer<typeof verbositySchema>;
export type ResponseTone = z.infer<typeof toneSchema>;
export type ResponseFormat = z.infer<typeof formatSchema>;
export type ResponseDepth = z.infer<typeof explanationDepthSchema>;
export type DomainName = z.infer<typeof domainNameSchema>;
export type DomainPreference = z.infer<typeof domainPreferenceSchema>;
export type PreferenceKey = z.infer<typeof preferenceKeySchema>;
export type PreferenceValue = z.infer<typeof preferenceValueSchema>;
export type PreferenceSource = z.infer<typeof preferenceSourceSchema>;
export type PreferenceRecord = z.infer<typeof preferenceSchema>;
export type PreferenceDetail = Omit<PreferenceRecord, "key">;

export type ConversationHistory = {
  id: string;
  userId: string;
  title?: string;
  messages: UIMessage[];
  createdAt: Date;
  updatedAt: Date;
};

export type ToolCallHistory = {
  eventId: string;
  userId: string;
  toolName: string;
  domain: DomainName | string;
  parameters: Record<string, unknown>;
  timestamp: Date;
};

export type FeedbackHistory = {
  feedbackId: string;
  userId: string;
  messageId?: string;
  conversationId?: string;
  rating?: number;
  tags?: string[];
  timestamp: Date;
};
