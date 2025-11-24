import { createFileRoute } from "@tanstack/react-router";

async function handleAssistantRequest(request: Request): Promise<Response> {
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
    async (messages) => {
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

export const Route = createFileRoute("/api/assistant/$")({
  server: {
    handlers: {
      POST: ({ request }) => handleAssistantRequest(request),
    },
  },
});
