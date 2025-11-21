import { assistantAgent } from "@alfred/agent";
import { createFileRoute } from "@tanstack/react-router";
import { handleAgentStreamRequest } from "../agent-stream-handler";

function handleRequest(request: Request): Promise<Response> {
  return handleAgentStreamRequest(request, assistantAgent, "assistant");
}

export const Route = createFileRoute("/api/assistant-agent/$")({
  action: ({ request }) => handleRequest(request),
  server: {
    handlers: {
      POST: ({ request }) => handleRequest(request),
    },
  },
});
