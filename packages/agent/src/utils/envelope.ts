import type { EventEnvelope } from "@alfred/type/envelope";
import { eventEnvelopeSchema } from "@alfred/type/envelope.zod";

export function wrapEventEnvelope<T>(args: {
  id: string;
  type: string;
  data: T;
  createdAt?: string;
  resource?: string;
}): EventEnvelope<T> {
  return {
    v: 1,
    id: args.id,
    type: args.type,
    createdAt: args.createdAt ?? new Date().toISOString(),
    resource: args.resource,
    data: args.data,
  };
}

export function unwrapEventEnvelope(raw: unknown): {
  envelope: EventEnvelope<unknown> | null;
  data: unknown;
} {
  const parsed = eventEnvelopeSchema.safeParse(raw);
  if (parsed.success) {
    return {
      envelope: parsed.data,
      data: parsed.data.data,
    };
  }
  return { envelope: null, data: raw };
}
