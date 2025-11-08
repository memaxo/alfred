import { google } from "@ai-sdk/google";
import { logger } from "@alfred/api/utils/logger";
import { createFileRoute } from "@tanstack/react-router";
import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

export const Route = createFileRoute("/api/ai/$")({
  loader: async () => {
    // Return initial state for SSR
    return {
      initialMessages: [] as UIMessage[],
    };
  },
  action: async ({ request }) => {
    // Handle POST requests via action
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const { messages }: { messages: UIMessage[] } = await request.json();

      const result = streamText({
        model: google("gemini-2.5-flash"),
        messages: convertToModelMessages(messages),
        abortSignal: request.signal,
        onAbort: async ({ steps }) => {
          logger.warn("ai_stream_aborted", {
            steps: steps.length,
          });
        },
      });

      return result.toUIMessageStreamResponse({
        consumeSseStream: consumeStream,
        onFinish: async ({ isAborted }) => {
          if (isAborted) {
            logger.warn("ai_stream_aborted_on_finish");
          }
        },
      });
    } catch (error) {
      logger.error("ai_api_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response(
        JSON.stringify({ error: "Failed to process AI request" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Keep handler for backward compatibility and streaming support
        try {
          const { messages }: { messages: UIMessage[] } = await request.json();

          const result = streamText({
            model: google("gemini-2.5-flash"),
            messages: convertToModelMessages(messages),
            abortSignal: request.signal,
            onAbort: async ({ steps }) => {
              logger.warn("ai_stream_aborted", {
                steps: steps.length,
              });
            },
          });

          return result.toUIMessageStreamResponse({
            consumeSseStream: consumeStream,
            onFinish: async ({ isAborted }) => {
              if (isAborted) {
                logger.warn("ai_stream_aborted_on_finish");
              }
            },
          });
        } catch (error) {
          logger.error("ai_api_error", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response(
            JSON.stringify({ error: "Failed to process AI request" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
