import { createFileRoute } from "@tanstack/react-router";

async function handleOrchestratorRequest(request: Request): Promise<Response> {
  const agentPkg = "@alfred/agent";
  const streamHandlerPkg = "@/lib/api/stream-handler";

  const { getOrchestratorAgentDefaults } = await import(agentPkg);
  const { handleStreamRequest } = await import(streamHandlerPkg);

  return handleStreamRequest(
    request,
    getOrchestratorAgentDefaults,
    "orchestrator"
  );
}

export const Route = createFileRoute("/api/orchestrator/$")({
  // @ts-expect-error - TanStack Start server handlers
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) =>
        handleOrchestratorRequest(request),
    },
  },
});
