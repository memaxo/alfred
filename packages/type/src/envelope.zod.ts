import { z } from "zod";

export const eventEnvelopeSchema = z.object({
  v: z.literal(1),
  id: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.string().min(1),
  resource: z.string().min(1).optional(),
  data: z.unknown(),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
