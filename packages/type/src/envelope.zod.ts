import { z } from "zod";

export const eventEnvelopeSchema = z.object({
  v: z.number().int().positive(),
  id: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.string().min(1),
  data: z.unknown(),

  // --- CAUSAL & CONTEXTUAL (NEW) ---
  /** Optional resource scope */
  resource: z.string().min(1).optional(),
  /** Root workflow run this event belongs to */
  rootId: z.string().min(1).optional(),
  /** The event that caused this one (parent link) */
  parentId: z.string().min(1).nullable().optional(),
  /** Monotonic sequence number within the rootId context */
  seq: z.number().int().optional(),
  /** The actor that produced this event */
  source: z.unknown().optional(), // EventSource type - using unknown for flexibility
});
