import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";

async function handleAssistantRequest(request: Request): Promise<Response> {
  try {
    const agentPkg = "@alfred/agent";
    const personaPkg = "@alfred/persona";

    const { analyzeContext } = await import(
      /* @vite-ignore */ "@alfred/agent/assistant/src/adapter"
    );
    const { buildPersonaPrompt } = await import(/* @vite-ignore */ personaPkg);
    const { getAssistantAgentDefaults } = await import(
      /* @vite-ignore */ agentPkg
    );
    const { handleStreamRequest } = await import(
      "../../lib/api/stream-handler"
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

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) =>
        handleAssistantRequest(request),
    },
  },
});
