import { buildAssistantTools, getModelId, getOpenAI } from "@alfred/agent";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";

const assistantRequestSchema = z
  .object({
    messages: z.array(uiMessageSchema).optional(),
  })
  .passthrough();

async function handleAssistantRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await request.json();
    const parsed = assistantRequestSchema.safeParse(rawBody);
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
      tools: buildAssistantTools(),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Assistant stream error:", error);
    return new Response(JSON.stringify({ error: "assistant_stream_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/assistant/$")({
  action: ({ request }) => handleAssistantRequest(request),
  server: {
    handlers: {
      POST: ({ request }) => handleAssistantRequest(request),
    },
  },
});
