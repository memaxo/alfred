import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";

async function handleAssistantRequest(request: Request): Promise<Response> {
  try {
    const loggerPkg = "@alfred/logger";
    const agentPkg = "@alfred/agent";
    const personaPkg = "@alfred/persona";

    const { logger } = await import(/* @vite-ignore */ loggerPkg);
    logger.info("assistant_http_request", {
      url: request.url,
      method: request.method,
      accept: request.headers.get("accept"),
      contentType: request.headers.get("content-type"),
    });

    const { getAssistantAgentDefaults } = await import(
      /* @vite-ignore */ agentPkg
    );
    const { analyzeContext } = await import(
      /* @vite-ignore */ "@alfred/agent/assistant/src/adapter"
    );
    const { buildPersonaPrompt } = await import(/* @vite-ignore */ personaPkg);
    const { handleStreamRequest } = await import(
      "../../../lib/api/stream-handler"
    );

    return await handleStreamRequest(
      request,
      getAssistantAgentDefaults,
      "assistant",
      async (messages: UIMessage[]) => {
        const result = await analyzeContext(messages);
        const persona = buildPersonaPrompt({
          modality: "text",
          honorific: "neutral",
        });
        return {
          system: persona,
          activation: {
            domains: result.domains,
            paths: result.paths,
          },
        };
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

export const Route = createFileRoute("/api/assistant/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        // AI SDK v6 DefaultChatTransport may attempt to reconnect using:
        // GET `${api}/${chatId}/stream`. We don't currently support resuming
        // partial streams in dev, but we must avoid returning the HTML app shell.
        const url = new URL(request.url);
        if (url.pathname.endsWith("/stream")) {
          return new Response(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          });
        }
        return new Response("Not found", { status: 404 });
      },
      POST: ({ request }: { request: Request }) =>
        handleAssistantRequest(request),
    },
  },
});
