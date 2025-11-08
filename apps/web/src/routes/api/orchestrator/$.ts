import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage, streamText } from "ai";
import { z } from "zod";
import { uiMessageSchema } from "@alfred/type/stream.zod";
import { buildOrchestratorTools, getModelId, getOpenAI } from "@alfred/agent";

const orchestratorRequestSchema = z
  .object({
    messages: z.array(uiMessageSchema).optional(),
  })
  .passthrough();

async function handleOrchestratorRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await request.json();
    const parsed = orchestratorRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          issues: parsed.error.issues,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const messages = (parsed.data.messages ?? []) as UIMessage[];

    const model = getOpenAI().chat(getModelId());
    const result = streamText({
      model,
      messages: convertToModelMessages(messages),
      tools: buildOrchestratorTools(),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(
        JSON.stringify({ error: "invalid_json" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    console.error("Orchestrator stream error:", error);
    return new Response(
      JSON.stringify({ error: "orchestrator_stream_failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const Route = createFileRoute("/api/orchestrator/$")({
  action: ({ request }) => handleOrchestratorRequest(request),
  server: {
    handlers: {
      POST: ({ request }) => handleOrchestratorRequest(request),
    },
  },
});
