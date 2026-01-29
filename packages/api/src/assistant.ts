import type { UIMessage } from "ai";

import { getAssistantAgentDefaults } from "@alfred/agent";
import { analyzeContext } from "@alfred/agent/assistant/src/adapter";
import { logger } from "@alfred/logger";
import { buildPersonaPrompt } from "@alfred/persona";

import { handleStreamRequest } from "./stream-handler";

export async function handleAssistantRequest(
  request: Request
): Promise<Response> {
  try {
    logger.info("assistant_http_request", {
      url: request.url,
      method: request.method,
      accept: request.headers.get("accept"),
      contentType: request.headers.get("content-type"),
    });

    return await handleStreamRequest(
      request,
      getAssistantAgentDefaults,
      "assistant",
      async (messages: UIMessage[]) => {
        const result = await analyzeContext(messages);
        const persona = buildPersonaPrompt({
          modality: "text",
          honorific: "neutral",
        });

        return {
          system: persona,
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
