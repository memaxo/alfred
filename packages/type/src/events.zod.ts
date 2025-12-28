import { z } from "zod";
import { cognitiveEventSchema } from "./cognitive.zod";
import { workflowEventSchema } from "./plan.zod";
import { voiceStreamServerEventSchema } from "./voice.zod";

/**
 * Zod schema for the unified DomainEvent union.
 */
export const domainEventSchema = z.discriminatedUnion("_", [
  z.object({ _: z.literal("cognitive"), event: cognitiveEventSchema }),
  z.object({ _: z.literal("workflow"), event: workflowEventSchema }),
  z.object({ _: z.literal("stream"), event: z.unknown() }), // Reference stream.zod if needed
  z.object({ _: z.literal("voice"), event: voiceStreamServerEventSchema }),
]);
