import { createFileRoute } from "@tanstack/react-router";

async function handleOrchestratorRequest(request: Request): Promise<Response> {
  try {
    const agentPkg = "@alfred/agent";

    const { getOrchestratorAgentDefaults } = await import(
      /* @vite-ignore */ agentPkg
    );
    const { handleStreamRequest } =
      await import("../../lib/api/stream-handler");

    return await handleStreamRequest(
      request,
      getOrchestratorAgentDefaults,
      "orchestrator"
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

export const Route = createFileRoute("/api/orchestrator")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) =>
        handleOrchestratorRequest(request),
    },
  },
});
