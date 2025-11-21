import type { AlfredCodexEvent } from "@alfred/agent/orchestrator/tool/codex";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

const codexRunInputSchema = z.object({
  prompt: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  authz: z.string().optional(),
  sessionId: z.string().min(1).max(255).optional(),
  cw: z.string().optional(),
  model: z.string().optional(),
  profile: z.string().optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  context: z
    .object({
      linearIssueId: z.string().optional(),
      linearSessionId: z.string().optional(),
      linearSpace: z.string().optional(),
      linearAuthz: z.string().optional(),
      relevantFiles: z.array(z.string()).optional(),
    })
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeoutSec: z.number().int().min(30).max(7200).optional(),
});

type CodexStreamEvent =
  | { type: "codex_event"; event: AlfredCodexEvent }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "notice"; message: string; usage?: unknown }
  | {
      type: "complete";
      result: string;
      artifacts?: Array<{ path: string; kind: string }>;
    }
  | { type: "error"; message: string };

const codexProcedures = {
  run: authedProcedure
    .input(codexRunInputSchema)
    .mutation(async ({ input }) => {
      const chunks: string[] = [];
      const events: AlfredCodexEvent[] = [];

      await toolCodex.execute({
        input: {
          action: "exec" as const,
          prompt: input.prompt,
          out: "text",
          auto: input.auto,
          cw: input.cw,
          model: input.model,
          profile: input.profile,
          authz: input.authz,
          timeoutSec: input.timeoutSec,
          env: input.env,
          sessionId: input.sessionId,
          outputSchema: input.outputSchema,
          context: input.context,
        },
        writer: {
          write: (chunk: unknown) => {
            const event = chunk as {
              type?: string;
              text?: string;
              event?: AlfredCodexEvent;
            };
            if (event.type === "stdout" && typeof event.text === "string") {
              chunks.push(event.text);
            } else if (event.type === "codex_event" && event.event) {
              events.push(event.event);
            }
          },
        },
      });

      return {
        result: chunks.join("\n"),
        events,
      };
    }),

  stream: authedProcedure.input(codexRunInputSchema).subscription(({ input }) =>
    observable<CodexStreamEvent>((emit) => {
      void (async () => {
        try {
          const result = await toolCodex.execute({
            input: {
              action: "exec" as const,
              prompt: input.prompt,
              out: "text",
              auto: input.auto,
              cw: input.cw,
              model: input.model,
              profile: input.profile,
              authz: input.authz,
              timeoutSec: input.timeoutSec,
              env: input.env,
              sessionId: input.sessionId,
              outputSchema: input.outputSchema,
              context: input.context,
            },
            writer: {
              write: (chunk: unknown) => {
                const event = chunk as {
                  type?: string;
                  text?: string;
                  message?: string;
                  event?: AlfredCodexEvent;
                  usage?: unknown;
                };

                if (event.type === "stdout" && typeof event.text === "string") {
                  emit.next({ type: "stdout", text: event.text });
                } else if (
                  event.type === "stderr" &&
                  typeof event.text === "string"
                ) {
                  emit.next({ type: "stderr", text: event.text });
                } else if (
                  event.type === "notice" &&
                  typeof event.message === "string"
                ) {
                  emit.next({
                    type: "notice",
                    message: event.message,
                    usage: event.usage,
                  });
                } else if (event.type === "codex_event" && event.event) {
                  emit.next({ type: "codex_event", event: event.event });
                }
              },
            },
          });

          emit.next({
            type: "complete",
            result: result.result,
            artifacts: result.artifacts,
          });
          emit.complete();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          emit.next({ type: "error", message });
          emit.error(
            new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message,
            })
          );
        }
      })();

      return () => {
        // Cleanup: abort signal if needed (would require threading AbortController through)
      };
    })
  ),
};

export const codexRouter: ReturnType<typeof router> = router(codexProcedures);
