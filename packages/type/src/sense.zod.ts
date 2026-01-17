import { z } from "zod";

import type {
  Bundle,
  Capture,
  CaptureEvidence,
  Receipt,
  ReceiptCorrection,
  ReceiptEvidenceItem,
  ReceiptOutcome,
  WorkingSet,
  WorkingSetItem,
} from "./sense";

const dateSchema = z
  .union([z.date(), z.string().datetime()])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

export const capturePayloadKindSchema = z.enum(["text", "voice", "photo"]);

export const captureStatusSchema = z.enum([
  "new",
  "triaged",
  "converted",
  "archived",
]);

export const captureSurfaceSchema = z.enum(["native", "web", "unknown"]);

export const captureEvidenceSchema: z.ZodType<CaptureEvidence> = z.object({
  capturedAt: dateSchema,
  tags: z.array(z.string().min(1)).max(32).optional(),
  device: z.string().min(1).max(128).optional(),
  surface: captureSurfaceSchema.optional(),
});

export const captureSchema: z.ZodType<Capture> = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  kind: capturePayloadKindSchema,
  status: captureStatusSchema,
  evidence: captureEvidenceSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const bundleSchema: z.ZodType<Bundle> = z.object({
  id: z.string().min(1),
  captureId: z.string().min(1),
  text: z.string().min(1),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const receiptDecisionSchema = z.enum([
  "route",
  "schedule",
  "link",
  "suggest",
]);

export const receiptEvidenceItemSchema: z.ZodType<ReceiptEvidenceItem> =
  z.object({
    key: z.string().min(1).max(64),
    label: z.string().min(1).max(200),
    value: z.string().min(1).max(400).optional(),
    weight: z.number().finite().optional(),
  });

export const receiptOutcomeKindSchema = z.enum([
  "inbox",
  "note",
  "reminder",
  "task",
]);

export const receiptOutcomeSchema: z.ZodType<ReceiptOutcome> = z.object({
  kind: receiptOutcomeKindSchema,
  targetId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});

export const receiptCorrectionSchema: z.ZodType<ReceiptCorrection> = z.object({
  correctedAt: dateSchema,
  outcome: receiptOutcomeSchema,
  note: z.string().min(1).max(400).optional(),
});

export const receiptSchema: z.ZodType<Receipt> = z.object({
  id: z.string().min(1),
  captureId: z.string().min(1),
  decision: receiptDecisionSchema,
  summary: z.string().min(1).max(600),
  evidence: z.array(receiptEvidenceItemSchema).max(64),
  outcome: receiptOutcomeSchema,
  alternatives: z.array(receiptOutcomeSchema).max(8),
  confidence: z.number().finite().min(0).max(1),
  corrections: z.array(receiptCorrectionSchema).max(32),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const workingSetItemKindSchema = z.enum([
  "project",
  "conversation",
  "note",
  "reminder",
  "task",
]);

export const workingSetItemSchema: z.ZodType<WorkingSetItem> = z.object({
  kind: workingSetItemKindSchema,
  id: z.string().min(1),
  label: z.string().min(1).max(256).optional(),
});

export const workingSetSchema: z.ZodType<WorkingSet> = z.object({
  userId: z.string().min(1),
  items: z.array(workingSetItemSchema).max(20),
  focus: workingSetItemSchema.optional(),
  updatedAt: dateSchema,
});
