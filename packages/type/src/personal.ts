import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(256).nullable().optional(),
  email: z.string().email().nullable().optional(),
  avatar: z.string().url().nullable().optional(),
  timezone: z.string().min(1).max(128).optional(),
  source: z.string().min(1).max(64).default("user"),
});

export const preferenceListSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

export const preferenceSetSchema = z.object({
  key: z.string().min(1).max(128),
  value: z.any(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().min(1).max(64).default("user"),
});

export const preferenceDeleteSchema = z.object({
  key: z.string().min(1).max(128),
});

export const privacyFactQuerySchema = z.object({
  embedding: z.array(z.number()).length(1536).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  threshold: z.number().min(-1).max(1).default(0.5),
});

export const privacyFactDeleteSchema = z.object({
  id: z.string().uuid(),
  scope: z.string().min(1).max(64).default("fact"),
});

export const privacyEventsQuerySchema = z.object({
  type: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PreferenceListInput = z.infer<typeof preferenceListSchema>;
export type PreferenceSetInput = z.infer<typeof preferenceSetSchema>;
export type PreferenceDeleteInput = z.infer<typeof preferenceDeleteSchema>;
export type PrivacyFactQueryInput = z.infer<typeof privacyFactQuerySchema>;
export type PrivacyFactDeleteInput = z.infer<typeof privacyFactDeleteSchema>;
export type PrivacyEventsQueryInput = z.infer<typeof privacyEventsQuerySchema>;
