import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";

async function handleAssistantRequest(request: Request): Promise<Response> {
  try {
    const agentPkg = "@alfred/agent";
    const adapterPkg = "@alfred/agent/assistant/src/adapter";

    const { getAssistantAgentDefaults } = await import(
      /* @vite-ignore */ agentPkg
    );
    const { analyzeContext, getPersonaInstruction } = await import(
      /* @vite-ignore */ adapterPkg
    );
    const { handleStreamRequest } = await import(
      "../../../lib/api/stream-handler"
    );

    return await handleStreamRequest(
      request,
      getAssistantAgentDefaults,
      "assistant",
      async (messages: UIMessage[]) => {
        const result = await analyzeContext(messages);
        const persona = getPersonaInstruction(result.domains);
        return {
          system: persona ?? undefined,
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
      POST: ({ request }: { request: Request }) =>
        handleAssistantRequest(request),
    },
  },
});
