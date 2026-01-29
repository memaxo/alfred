import { getOrchestratorAgentDefaults } from "@alfred/agent";

import { handleStreamRequest } from "./stream-handler";

export async function handleOrchestratorRequest(
  request: Request
): Promise<Response> {
  try {
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
