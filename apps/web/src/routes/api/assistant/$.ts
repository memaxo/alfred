import { buildAssistantTools } from "@alfred/agent";
import { createFileRoute } from "@tanstack/react-router";
import { handleStreamRequest } from "./stream-handler";

function handleAssistantRequest(request: Request): Promise<Response> {
  return handleStreamRequest(request, buildAssistantTools, "assistant");
}

export const Route = createFileRoute("/api/assistant/$")({
  action: ({ request }) => handleAssistantRequest(request),
  server: {
    handlers: {
      POST: ({ request }) => handleAssistantRequest(request),
    },
  },
});
