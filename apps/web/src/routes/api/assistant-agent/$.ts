import { createFileRoute } from "@tanstack/react-router";

async function handleRequest(request: Request): Promise<Response> {
  const agentPkg = "@alfred/agent";
  const agentStreamHandlerPkg = "@/lib/api/agent-stream-handler";

  const { assistantAgent } = await import(agentPkg);
  const { handleAgentStreamRequest } = await import(agentStreamHandlerPkg);
  
  return handleAgentStreamRequest(request, assistantAgent, "assistant");
}

export const Route = createFileRoute("/api/assistant-agent/$")({
  server: {
    handlers: {
      POST: ({ request }) => handleRequest(request),
    },
  },
});
