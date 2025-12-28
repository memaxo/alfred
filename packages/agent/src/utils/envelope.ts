import type { EventEnvelope } from "@alfred/type/envelope";
import { eventEnvelopeSchema } from "@alfred/type/envelope.zod";
import type { EventId, RunId } from "@alfred/type/id";
import type { EventSource } from "@alfred/type/source";

export function wrapEventEnvelope<T>(args: {
  id: string | EventId;
  type: string;
  data: T;
  createdAt?: string;
  resource?: string;
  rootId?: string | RunId;
  parentId?: string | null;
  seq?: number;
  source?: unknown;
}): EventEnvelope<T> {
  return {
    v: 1,
    id: args.id as EventId,
    type: args.type,
    createdAt: args.createdAt ?? new Date().toISOString(),
    resource: args.resource,
    data: args.data,
    // New causal fields
    rootId: args.rootId ? (args.rootId as RunId) : undefined,
    parentId: args.parentId as EventId | null | undefined,
    seq: args.seq,
    source: args.source as EventSource | undefined,
  };
}

export function unwrapEventEnvelope(raw: unknown): {
  envelope: EventEnvelope<unknown> | null;
  data: unknown;
} {
  const parsed = eventEnvelopeSchema.safeParse(raw);
  if (parsed.success) {
    return {
      envelope: {
        ...parsed.data,
        id: parsed.data.id as EventId,
        rootId: parsed.data.rootId as RunId | undefined,
        parentId: parsed.data.parentId as EventId | null | undefined,
        source: parsed.data.source as EventSource | undefined,
      } as EventEnvelope<unknown>,
      data: parsed.data.data,
    };
  }
  return { envelope: null, data: raw };
}
