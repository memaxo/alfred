import { buildTools } from "@alfred/agent";
import { createFileRoute } from "@tanstack/react-router";
import { handleStreamRequest } from "./stream-handler";

async function handleOrchestratorRequest(request: Request): Promise<Response> {
  return handleStreamRequest(request, buildTools, "orchestrator");
}

export const Route = createFileRoute("/api/orchestrator/$")({
  action: ({ request }) => handleOrchestratorRequest(request),
  server: {
    handlers: {
      POST: ({ request }) => handleOrchestratorRequest(request),
    },
  },
});
