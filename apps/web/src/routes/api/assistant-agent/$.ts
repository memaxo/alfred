import { createFileRoute } from "@tanstack/react-router";
import type { UIMessage } from "ai";

async function handleRequest(request: Request): Promise<Response> {
  const agentPkg = "@alfred/agent";
  const adapterPkg = "@alfred/agent/assistant/src/adapter";
  const streamHandlerPkg = "@/lib/api/stream-handler";

  const { getAssistantAgentDefaults } = await import(agentPkg);
  const { analyzeContext, getPersonaInstruction } = await import(adapterPkg);
  const { handleStreamRequest } = await import(streamHandlerPkg);

  return handleStreamRequest(
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
}

export const Route = createFileRoute("/api/assistant-agent/$")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) => handleRequest(request),
    },
  },
});
