import { type buildAssistantTools, getModelId, getOpenAI } from "@alfred/agent";
import { logger } from "@alfred/api/utils/logger";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

const requestSchema = z
  .object({
    messages: z.array(uiMessageSchema).optional(),
  })
  .passthrough();

type BuildToolsFn = () => ReturnType<typeof buildAssistantTools>;

export async function handleStreamRequest(
  request: Request,
  buildTools: BuildToolsFn,
  errorPrefix: string
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await request.json();
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          issues: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const messages = (parsed.data.messages ?? []) as UIMessage[];

    const model = getOpenAI().chat(getModelId());
    const result = streamText({
      model,
      messages: convertToModelMessages(messages),
      tools: buildTools(),
      abortSignal: request.signal,
      onAbort: ({ steps }) => {
        logger.warn(`${errorPrefix}_stream_aborted`, {
          steps: steps.length,
        });
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      consumeSseStream: consumeStream,
      onFinish: ({ isAborted }) => {
        if (isAborted) {
          logger.warn(`${errorPrefix}_stream_aborted_on_finish`);
        }
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    logger.error(`${errorPrefix}_stream_error`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: `${errorPrefix}_stream_failed` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
